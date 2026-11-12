\set ON_ERROR_STOP on
CREATE TRIGGER integration_fixture_process BEFORE INSERT ON public.temp_integrations_scraped_data
FOR EACH ROW EXECUTE FUNCTION public.process_temp_integrations_scraped_data();
DO $$
DECLARE u uuid:='10000000-0000-0000-0000-000000000001';
 b uuid:='20000000-0000-0000-0000-000000000001';
 p uuid:='30000000-0000-0000-0000-000000000002';
 c uuid:='40000000-0000-0000-0000-000000000001';
 s uuid:='50000000-0000-0000-0000-000000000001';
 integration uuid:='60000000-0000-0000-0000-000000000001';
 row_id uuid;stage record;before_count bigint;
BEGIN
 INSERT INTO integrations(id,configuration) VALUES(integration,'{}');
 INSERT INTO price_changes_competitors(user_id,product_id,competitor_id,new_competitor_price,changed_at,competitor_url)
 VALUES(u,p,c,70,now(),'https://lampan.se/p/variant-b/');
 PERFORM assert_true(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(get_competitor_catalog_context(s)->'known') k WHERE k->>'productId'=p::text),'competitor-only product not yet in own priority plan');
 INSERT INTO temp_integrations_scraped_data(user_id,integration_id,integration_run_id,name,sku,brand,ean,our_retail_price,our_wholesale_price,currency_code,our_url,status)
 VALUES(u,integration,gen_random_uuid(),'New own product','A100','By Rydéns','9008606355051',101,50,'SEK','https://own.example/new/','pending') RETURNING * INTO stage;
 PERFORM assert_true(stage.status='processed','actual own import trigger processes new product: '||COALESCE(stage.error_message,''));
 PERFORM assert_true((SELECT name='New own product' FROM products WHERE id=p),'new own import attaches to correct existing competitor entity');
 PERFORM assert_true((SELECT our_retail_price=101 FROM products WHERE id=p),'own price updates correct variant');
 PERFORM assert_true((SELECT count(*)=1 FROM products WHERE user_id=u AND ean='9008606355051'),'no duplicate entity created');
 PERFORM assert_true(EXISTS(SELECT 1 FROM jsonb_array_elements(get_competitor_catalog_context(s)->'known') k WHERE k->>'productId'=p::text),'new own product immediately enters next nightly plan');
 SELECT count(*) INTO before_count FROM products;
 BEGIN
 INSERT INTO temp_integrations_scraped_data(user_id,integration_id,integration_run_id,name,sku,brand,ean,our_retail_price,currency_code,status)
 VALUES(u,integration,gen_random_uuid(),'Conflicting incoming variant','A100','By Rydéns','7340037008000',999,'SEK','pending') RETURNING * INTO stage;
 PERFORM assert_true(stage.status='error' AND stage.error_message LIKE '%conflicting_ean_for_sku_brand%','own import preserves conflict as reviewable error');
 EXCEPTION WHEN SQLSTATE 'PT002' THEN NULL; END;
 PERFORM assert_true((SELECT count(*)=before_count FROM products),'conflicting input creates no wrong product');
 PERFORM assert_true((SELECT our_retail_price=101 FROM products WHERE id=p),'conflicting input cannot overwrite existing price');
 RAISE NOTICE 'PASS: real own-store trigger/new products/correct EAN entity/automatic next-plan inclusion/conflict safety';
END;
$$;
