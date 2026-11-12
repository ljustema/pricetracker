\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION assert_true(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %',label; END IF; END $$;
DO $$
DECLARE
 u uuid:='10000000-0000-0000-0000-000000000001';v uuid:='10000000-0000-0000-0000-000000000002';
 b uuid:='20000000-0000-0000-0000-000000000001';b2 uuid:='20000000-0000-0000-0000-000000000002';
 p uuid:='30000000-0000-0000-0000-000000000001';p2 uuid:='30000000-0000-0000-0000-000000000002';
 c uuid:='40000000-0000-0000-0000-000000000001';s uuid:='50000000-0000-0000-0000-000000000001';
 found uuid;raised boolean;plan jsonb;processor text;r record;before_count bigint;at timestamptz:=statement_timestamp();
BEGIN
 INSERT INTO user_profiles VALUES(u),(v);
 INSERT INTO brands(id,user_id,name) VALUES(b,u,'By Rydéns'),(b2,u,'Another brand');
 INSERT INTO brand_aliases VALUES(u,b,'Rydens');
 INSERT INTO competitors VALUES(c,u,'Lampan');INSERT INTO scrapers VALUES(s,u,c);
 INSERT INTO products(id,user_id,brand_id,name,sku,ean,our_retail_price) VALUES
 (p,u,b,'Own variant A','A-100','7318303297953',100),
 (p2,u,b,'Competitor variant B','A100','9008606355051',NULL);
 PERFORM assert_true(find_or_create_brand(u,'BY RYDENS')=b,'normalized existing brand reused');
 PERFORM assert_true(find_or_create_brand(u,'rydéns')=b,'explicit alias normalization reused');
 INSERT INTO brand_aliases VALUES(u,b2,'Rydens');
 raised:=false;BEGIN PERFORM find_or_create_brand(u,'Rydens');EXCEPTION WHEN SQLSTATE 'PT001' THEN raised:=true;END;
 PERFORM assert_true(raised,'ambiguous brand alias rejected instead of choosing first');
 DELETE FROM brand_aliases WHERE user_id=u AND brand_id=b2 AND alias_name='Rydens';
 PERFORM assert_true(resolve_competitor_product(u,'7318303297953','By Rydens','A100',b)=p,'EAN wins against ambiguous normalized SKU');
 PERFORM assert_true(resolve_competitor_product(u,'9008606355051','By Rydens','A100',b)=p2,'different variant EAN never mapped to own product');
 raised:=false;BEGIN PERFORM resolve_competitor_product(u,NULL,'By Rydens','A100',b);EXCEPTION WHEN SQLSTATE 'PT001' THEN raised:=true;END;
 PERFORM assert_true(raised,'missing EAN and ambiguous SKU rejected');
 raised:=false;BEGIN PERFORM resolve_competitor_product(u,'7340037008000','By Rydens','A100',b);EXCEPTION WHEN SQLSTATE 'PT002' THEN raised:=true;END;
 PERFORM assert_true(raised,'contradictory EAN on same SKU rejected');
 PERFORM assert_true(resolve_competitor_product(v,'7318303297953','By Rydens','A100',b) IS NULL,'tenant isolation');
 PERFORM assert_true(resolve_competitor_product(u,NULL,'Another brand','A100',b2) IS NULL,'brand isolation');
 PERFORM assert_true(resolve_competitor_product(u,NULL,'By Rydens','---',b) IS NULL,'empty normalized SKU cannot match');
 INSERT INTO test_matching_settings VALUES(u,'{"sku_brand_fallback":false}');
 PERFORM assert_true(resolve_competitor_product(u,NULL,'By Rydens','A100',b) IS NULL,'SKU fallback setting respected');
 DELETE FROM test_matching_settings;
 UPDATE products SET ean=NULL WHERE id=p2;
 PERFORM assert_true(resolve_competitor_product(u,NULL,'By Rydens','A100',b)=p,'unambiguous own product preferred over identifier-less duplicate');
 UPDATE products SET ean='9008606355051' WHERE id=p2;

 FOREACH processor IN ARRAY ARRAY['process_temp_competitors_batch','process_temp_competitors_batch_keep_temp','process_temp_competitors_batch_with_conflict_detection'] LOOP
  DELETE FROM temp_competitors_scraped_data;
  INSERT INTO temp_competitors_scraped_data(user_id,scraper_id,competitor_id,name,brand,sku,competitor_price,competitor_url,scraped_at)
  VALUES(u,s,c,'Ambiguous listing','By Rydéns','A100',50,'https://lampan.se/p/ambiguous/',at);
  EXECUTE format('SELECT * FROM %I($1,10)',processor) INTO r USING c;
  PERFORM assert_true(r.errors=1,processor||' reports ambiguity');
  PERFORM assert_true((SELECT count(*)=0 FROM competitor_price_observations),processor||' ambiguous input cannot verify price');
  PERFORM assert_true((SELECT count(*)>0 FROM scraper_run_rejections WHERE reason='ambiguous_sku_brand_match'),processor||' preserves review reason');
 END LOOP;
 DELETE FROM temp_competitors_scraped_data;
 INSERT INTO temp_competitors_scraped_data(user_id,scraper_id,competitor_id,name,brand,sku,ean,competitor_price,competitor_url,scraped_at)
 VALUES(u,s,c,'Own variant A','By Rydéns','A100','7318303297953',50,'https://lampan.se/p/current/',at-interval '1 minute');
 PERFORM * FROM process_temp_competitors_batch(c,10);
 PERFORM assert_true((SELECT price=50 AND competitor_url='https://lampan.se/p/current/' FROM competitor_price_observations WHERE product_id=p),'matched price stores original verification and URL');
 PERFORM record_competitor_price_observation_v2(u,p,c,50,at,'https://lampan.se/p/new-url/');
 PERFORM assert_true((SELECT competitor_url='https://lampan.se/p/new-url/' FROM competitor_price_observations WHERE product_id=p),'unchanged price can update product URL');
 plan:=get_competitor_catalog_context(s);
 PERFORM assert_true(jsonb_array_length(plan->'known')=1,'only owned product enters priority plan');
 PERFORM assert_true(plan->'known'->0->>'url'='https://lampan.se/p/new-url/','plan prefers current verified URL over old history URL');
 PERFORM record_competitor_url_checks(s,ARRAY['https://lampan.se/p/unavailable/'],at);
 PERFORM assert_true(EXISTS(SELECT 1 FROM jsonb_array_elements(get_competitor_catalog_context(s)->'seen') x WHERE x->>'url'='https://lampan.se/p/unavailable/'),'unavailable URL progress preserved without price');
 PERFORM assert_true((SELECT count(*)=1 FROM competitor_price_observations),'URL checks do not invent prices');

 INSERT INTO products(user_id,brand_id,name,sku,ean,our_retail_price)
 SELECT u,b,'Additional own product '||g,'NEW-'||g,NULL,100 FROM generate_series(1,1105) g;
 plan:=get_competitor_catalog_context(s);
 PERFORM assert_true(jsonb_array_length(plan->'ownProducts')=1106,'catalog contains own products after row1000');
 INSERT INTO products(user_id,brand_id,name,sku,our_retail_price) VALUES(u,b2,'New own brand product','N-1',100);
 PERFORM assert_true(jsonb_array_length(get_competitor_catalog_context(s)->'brands')=2,'newly added own brand included automatically');
 UPDATE brands SET is_active=false WHERE id=b2;
 PERFORM assert_true(jsonb_array_length(get_competitor_catalog_context(s)->'brands')=1,'explicit inactive brand excluded');
 UPDATE competitor_price_observations SET verified_at=at-interval '73 hours';
 PERFORM assert_true((SELECT count(*)=0 FROM get_fresh_price_matching_export(u,c,NULL,100,0,'coverage')),'72-hour rule unchanged');
 RAISE NOTICE 'PASS: matching, ambiguity, variants, aliases, tenant/brand isolation, all processors, URL provenance, discovery progress, complete catalog and new brands';
END;
$$;
