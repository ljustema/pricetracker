\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION assert_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %',label; END IF; END $$;

DO $$
DECLARE
 u uuid := '10000000-0000-0000-0000-000000000001';
 other_u uuid := '10000000-0000-0000-0000-000000000002';
 p uuid := '20000000-0000-0000-0000-000000000001';
 c uuid := '30000000-0000-0000-0000-000000000001';
 c2 uuid := '30000000-0000-0000-0000-000000000002';
 t timestamptz := statement_timestamp();
 processor text;
 result record;
 history_count integer;
BEGIN
 INSERT INTO user_profiles VALUES(u),(other_u);
 INSERT INTO brands VALUES('40000000-0000-0000-0000-000000000001',u,'Test brand');
 INSERT INTO products(id,user_id,name,ean,brand_id,our_retail_price,is_active) VALUES(p,u,'Test','1234567890123','40000000-0000-0000-0000-000000000001',150,true);
 INSERT INTO competitors VALUES(c,u,'Lampan'),(c2,u,'Another competitor');

 -- A freshly read unchanged price remains usable, although its history is old.
 INSERT INTO price_changes_competitors(user_id,product_id,competitor_id,new_competitor_price,changed_at)
 VALUES(u,p,c,100,t - interval '20 days');
 FOREACH processor IN ARRAY ARRAY['process_temp_competitors_batch','process_temp_competitors_batch_keep_temp','process_temp_competitors_batch_with_conflict_detection'] LOOP
   DELETE FROM competitor_price_observations;
   DELETE FROM temp_competitors_scraped_data;
   INSERT INTO temp_competitors_scraped_data(user_id,competitor_id,name,ean,competitor_price,scraped_at)
   VALUES(u,c,'Test','1234567890123',100,t - interval '1 hour');
   EXECUTE format('SELECT * FROM public.%I($1,10)',processor) INTO result USING c;
   PERFORM assert_true(result.processed=1 AND result.errors=0,processor||' success');
   PERFORM assert_true((SELECT verified_at = t - interval '1 hour' AND price=100 FROM competitor_price_observations WHERE competitor_id=c),processor||' acquisition time and unchanged price');
   PERFORM assert_true((SELECT count(*)=1 FROM price_changes_competitors),processor||' no false history changes');

   -- A processing failure rolls its observation back; it cannot renew freshness.
   DELETE FROM temp_competitors_scraped_data;
   INSERT INTO temp_competitors_scraped_data(user_id,competitor_id,name,ean,competitor_price,scraped_at,stock_status)
   VALUES(u,c,'Test','1234567890123',90,t,'explode');
   EXECUTE format('SELECT * FROM public.%I($1,10)',processor) INTO result USING c;
   PERFORM assert_true(result.errors=1,processor||' injected processing error');
   PERFORM assert_true((SELECT verified_at = t - interval '1 hour' AND price=100 FROM competitor_price_observations WHERE competitor_id=c),processor||' failed row does not refresh');
 END LOOP;

 PERFORM record_competitor_price_observation(u,p,c,50,t - interval '2 hours');
 PERFORM assert_true((SELECT price=100 FROM competitor_price_observations WHERE competitor_id=c),'older arrival cannot overwrite');
 PERFORM record_competitor_price_observation(u,p,c,50,t + interval '1 second');
 PERFORM record_competitor_price_observation(u,p,c,0,t);
 PERFORM record_competitor_price_observation(u,p,c,50,NULL);
 PERFORM assert_true((SELECT price=100 FROM competitor_price_observations WHERE competitor_id=c),'future, missing and invalid observations ignored');

 -- Exclude stale cheapest competitor BEFORE choosing minimum and count.
 UPDATE competitor_price_observations SET verified_at=t - interval '72 hours 1 second' WHERE competitor_id=c;
 PERFORM record_competitor_price_observation(u,p,c2,120,t - interval '1 hour');
 SELECT * INTO result FROM get_fresh_price_matching_export(u,NULL,NULL,10,0,'coverage');
 PERFORM assert_true(result.lowest_competitor_price=120 AND result.competitor_count=1 AND result.most_competitive_competitor_name='Another competitor','fresh alternative wins');
 PERFORM assert_true((SELECT count(*)=0 FROM get_fresh_price_matching_export(u,c,NULL,10,0,'coverage')),'competitor filter cannot bypass freshness');
 PERFORM assert_true((SELECT count(*)=0 FROM get_fresh_price_matching_export(other_u,NULL,NULL,10,0,'coverage')),'tenant isolation');
 PERFORM assert_true((SELECT lowest_competitor_price=120 FROM get_priority_products_for_repricing(u,NULL,NULL,10,0)),'priority wrapper fresh');
 PERFORM assert_true((SELECT lowest_competitor_price=120 FROM get_price_matching_coverage_export(u,NULL,NULL,10,0)),'coverage wrapper fresh');

 UPDATE competitor_price_observations SET verified_at=t - interval '72 hours' WHERE competitor_id=c;
 SELECT * INTO result FROM get_fresh_price_matching_export(u,NULL,NULL,10,0,'coverage');
 PERFORM assert_true(result.lowest_competitor_price=100 AND result.competitor_count=2,'exactly 72 hours is valid');
 UPDATE competitor_price_observations SET verified_at=t - interval '72 hours 1 second';
 PERFORM assert_true((SELECT count(*)=0 FROM get_fresh_price_matching_export(u,NULL,NULL,10,0,'coverage')),'all stale yields empty export');

 UPDATE competitor_price_observations SET verified_at=t,price=180 WHERE competitor_id=c2;
 PERFORM assert_true((SELECT count(*)=1 FROM get_fresh_price_matching_export(u,NULL,NULL,10,0,'coverage')),'coverage includes higher fresh prices');
 PERFORM assert_true((SELECT count(*)=0 FROM get_fresh_price_matching_export(u,NULL,NULL,10,0,'priority')),'priority excludes higher fresh prices');
 UPDATE products SET is_active=false WHERE id=p;
 PERFORM assert_true((SELECT count(*)=0 FROM get_fresh_price_matching_export(u,NULL,NULL,10,0,'coverage')),'inactive product excluded');
 -- Changed prices use the newly acquired value without waiting for any view.
 UPDATE products SET is_active=true WHERE id=p;
 UPDATE competitor_price_observations SET verified_at=t - interval '1 minute' WHERE competitor_id=c2;
 DELETE FROM temp_competitors_scraped_data;
 INSERT INTO temp_competitors_scraped_data(user_id,competitor_id,name,ean,competitor_price,scraped_at)
 VALUES(u,c2,'Test','1234567890123',160,t);
 PERFORM * FROM process_temp_competitors_batch(c2,10);
 PERFORM assert_true((SELECT lowest_competitor_price=160 FROM get_fresh_price_matching_export(u,NULL,NULL,10,0,'coverage')),'newly changed price immediately visible');
 -- Processing a delayed old fetch must not make its price fresh today.
 DELETE FROM temp_competitors_scraped_data;
 DELETE FROM competitor_price_observations WHERE competitor_id=c;
 INSERT INTO temp_competitors_scraped_data(user_id,competitor_id,name,ean,competitor_price,scraped_at)
 VALUES(u,c,'Test','1234567890123',80,t - interval '73 hours');
 PERFORM * FROM process_temp_competitors_batch(c,10);
 PERFORM assert_true((SELECT count(*)=0 FROM get_fresh_price_matching_export(u,c,NULL,10,0,'coverage')),'delayed processing retains stale acquisition time');
 RAISE NOTICE 'PASS: processors, rollback, unchanged prices, acquisition time, boundaries, fallback competitor, count, filters, tenant isolation, modes, inactive product';
END $$;
