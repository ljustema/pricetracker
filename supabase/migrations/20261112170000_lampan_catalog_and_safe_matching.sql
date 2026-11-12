BEGIN;

ALTER TABLE public.competitor_price_observations ADD COLUMN competitor_url text;

CREATE TABLE public.competitor_url_checks(
 user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
 competitor_id uuid NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
 url text NOT NULL,last_checked_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,competitor_id,url)
);
ALTER TABLE public.competitor_url_checks ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.competitor_url_checks TO service_role;
CREATE FUNCTION public.record_competitor_url_checks(p_scraper_id uuid,p_urls text[],p_checked_at timestamptz)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF cardinality(p_urls)>100 OR p_checked_at>statement_timestamp() OR p_checked_at IS NULL THEN
  RAISE EXCEPTION 'Invalid URL check batch';
 END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_urls) u WHERE u !~ '^https://lampan[.]se/p/[^?#]+/$') THEN
  RAISE EXCEPTION 'Invalid Lampan product URL';
 END IF;
 INSERT INTO public.competitor_url_checks(user_id,competitor_id,url,last_checked_at)
 SELECT s.user_id,s.competitor_id,u,p_checked_at FROM scrapers s CROSS JOIN unnest(p_urls) u
 WHERE s.id=p_scraper_id AND s.competitor_id IS NOT NULL
 ON CONFLICT(user_id,competitor_id,url) DO UPDATE
 SET last_checked_at=GREATEST(competitor_url_checks.last_checked_at,EXCLUDED.last_checked_at);
END;
$$;
REVOKE ALL ON FUNCTION public.record_competitor_url_checks(uuid,text[],timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_competitor_url_checks(uuid,text[],timestamptz) TO service_role;

CREATE FUNCTION public.record_competitor_price_observation_v2(
 p_user_id uuid,p_product_id uuid,p_competitor_id uuid,p_price numeric,
 p_verified_at timestamptz,p_url text
) RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM public.record_competitor_price_observation(p_user_id,p_product_id,p_competitor_id,p_price,p_verified_at);
 UPDATE public.competitor_price_observations
 SET competitor_url=COALESCE(NULLIF(p_url,''),competitor_url)
 WHERE user_id=p_user_id AND product_id=p_product_id AND competitor_id=p_competitor_id
 AND verified_at=p_verified_at AND price=p_price AND p_price>0 AND p_verified_at<=statement_timestamp();
END;
$$;
REVOKE ALL ON FUNCTION public.record_competitor_price_observation_v2(uuid,uuid,uuid,numeric,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_competitor_price_observation_v2(uuid,uuid,uuid,numeric,timestamptz,text) TO service_role;

CREATE FUNCTION public.normalize_matching_brand(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=public,pg_temp AS $$
 SELECT regexp_replace(lower(normalize(COALESCE(value,''),NFKD)),'[^a-z0-9]','','g');
$$;

CREATE OR REPLACE FUNCTION public.find_or_create_brand(p_user_id uuid,p_name text) RETURNS uuid
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE found_id uuid; matches uuid[];
BEGIN
 IF NULLIF(btrim(p_name),'') IS NULL THEN RETURN NULL; END IF;
 SELECT array_agg(id) INTO matches FROM brands WHERE user_id=p_user_id AND name=p_name;
 IF cardinality(matches)=1 THEN RETURN matches[1]; END IF;
 IF cardinality(matches)>1 THEN RAISE EXCEPTION USING ERRCODE='PT001',MESSAGE='ambiguous_brand_match'; END IF;
 SELECT array_agg(DISTINCT brand_id) INTO matches FROM brand_aliases WHERE user_id=p_user_id AND alias_name=p_name;
 IF cardinality(matches)=1 THEN RETURN matches[1]; END IF;
 IF cardinality(matches)>1 THEN RAISE EXCEPTION USING ERRCODE='PT001',MESSAGE='ambiguous_brand_alias'; END IF;
 SELECT array_agg(DISTINCT id) INTO matches FROM (
   SELECT id FROM brands WHERE user_id=p_user_id AND normalize_matching_brand(name)=normalize_matching_brand(p_name)
   UNION SELECT brand_id FROM brand_aliases WHERE user_id=p_user_id AND normalize_matching_brand(alias_name)=normalize_matching_brand(p_name)
 ) candidates;
 IF cardinality(matches)=1 THEN RETURN matches[1]; END IF;
 IF cardinality(matches)>1 THEN RAISE EXCEPTION USING ERRCODE='PT001',MESSAGE='ambiguous_brand_match'; END IF;
 INSERT INTO brands(user_id,name,is_active,needs_review) VALUES(p_user_id,btrim(p_name),true,true) RETURNING id INTO found_id;
 RETURN found_id;
END;
$$;

-- Exact identifiers only: never silently attach a competitor variant to a
-- different EAN, or select the first of several SKU/brand candidates.
CREATE FUNCTION public.resolve_competitor_product(
 p_user_id uuid,p_ean text,p_brand text,p_sku text,p_brand_id uuid
) RETURNS uuid LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE ids uuid[]; own_ids uuid[]; distinct_eans integer; normalized text;
 valid_ean boolean:=public.is_valid_ean(p_ean); settings jsonb;
BEGIN
 IF valid_ean THEN
  SELECT array_agg(id ORDER BY id) INTO ids FROM products WHERE user_id=p_user_id AND ean=btrim(p_ean);
  IF cardinality(ids)=1 THEN RETURN ids[1]; END IF;
  IF cardinality(ids)>1 THEN RAISE EXCEPTION USING ERRCODE='PT001',MESSAGE='ambiguous_ean_match'; END IF;
 END IF;
 settings:=public.get_user_matching_settings(p_user_id);
 IF COALESCE((settings->>'sku_brand_fallback')::boolean,true)=false THEN RETURN NULL; END IF;
 normalized:=public.normalize_sku_for_matching(p_sku);
 IF NULLIF(normalized,'') IS NULL OR p_brand_id IS NULL THEN RETURN NULL; END IF;
 SELECT array_agg(id ORDER BY id),
   array_agg(id ORDER BY id) FILTER(WHERE our_retail_price IS NOT NULL AND is_active=true),
   count(DISTINCT ean) FILTER(WHERE public.is_valid_ean(ean))
 INTO ids,own_ids,distinct_eans
 FROM products WHERE user_id=p_user_id AND brand_id=p_brand_id
 AND public.normalize_sku_for_matching(sku)=normalized;
 IF COALESCE(cardinality(ids),0)=0 THEN RETURN NULL; END IF;
 IF valid_ean AND EXISTS(SELECT 1 FROM products WHERE id=ANY(ids) AND public.is_valid_ean(ean) AND ean<>btrim(p_ean)) THEN
  RAISE EXCEPTION USING ERRCODE='PT002',MESSAGE='conflicting_ean_for_sku_brand';
 END IF;
 IF distinct_eans>1 THEN RAISE EXCEPTION USING ERRCODE='PT001',MESSAGE='ambiguous_sku_brand_match'; END IF;
 IF cardinality(own_ids)=1 THEN RETURN own_ids[1]; END IF;
 IF cardinality(ids)=1 THEN RETURN ids[1]; END IF;
 RAISE EXCEPTION USING ERRCODE='PT001',MESSAGE='ambiguous_sku_brand_match';
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_competitor_product(uuid,text,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_competitor_product(uuid,text,text,text,uuid) TO authenticated,service_role;

DO $patch$
DECLARE signature text; definition text; start_pos integer; end_pos integer;
 creation constant text:=E'IF matched_product_id IS NULL THEN\n                INSERT INTO products';
 old_observation constant text:=E'PERFORM public.record_competitor_price_observation(\n                temp_record.user_id, matched_product_id, temp_record.competitor_id,\n                temp_record.competitor_price, temp_record.scraped_at\n            );';
 new_observation constant text:=E'PERFORM public.record_competitor_price_observation_v2(\n                temp_record.user_id, matched_product_id, temp_record.competitor_id,\n                temp_record.competitor_price, temp_record.scraped_at, temp_record.competitor_url\n            );';
 rejection constant text:=E'EXCEPTION WHEN OTHERS THEN\n            IF SQLSTATE IN (''PT001'',''PT002'') THEN\n                INSERT INTO public.scraper_run_rejections(scraper_id,user_id,competitor_id,reason,had_ean,had_brand,had_sku,had_name,sample_name,sample_url)\n                VALUES(temp_record.scraper_id,temp_record.user_id,temp_record.competitor_id,SQLERRM,\n                    public.is_valid_ean(temp_record.ean),NULLIF(temp_record.brand,'''') IS NOT NULL,\n                    NULLIF(temp_record.sku,'''') IS NOT NULL,NULLIF(temp_record.name,'''') IS NOT NULL,\n                    temp_record.name,temp_record.competitor_url);\n            END IF;';
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.process_temp_competitors_batch(uuid,integer)',
  'public.process_temp_competitors_batch_keep_temp(uuid,integer)',
  'public.process_temp_competitors_batch_with_conflict_detection(uuid,integer)'] LOOP
  definition:=replace(pg_get_functiondef(signature::regprocedure),chr(13),'');
  start_pos:=position('-- STEP 2: Product matching' IN definition);
  end_pos:=position(creation IN definition);
  IF start_pos=0 OR end_pos<=start_pos OR position(old_observation IN definition)=0
    OR position('EXCEPTION WHEN OTHERS THEN' IN definition)=0 THEN
   RAISE EXCEPTION 'Unexpected processor definition: %',signature;
  END IF;
  definition:=left(definition,start_pos-1)||E'-- STEP 2: Deterministic identifier matching\n            matched_product_id := public.resolve_competitor_product(\n                temp_record.user_id,temp_record.ean,temp_record.brand,temp_record.sku,v_brand_id\n            );\n\n            '||substring(definition FROM end_pos);
  definition:=replace(definition,old_observation,new_observation);
  definition:=replace(definition,'EXCEPTION WHEN OTHERS THEN',rejection);
  EXECUTE definition;
 END LOOP;
END;
$patch$;

-- The own-store import must use the same identifier rules, so a newly added
-- own product attaches to an existing competitor entity by its real EAN.
DO $integration_patch$
DECLARE signature text; definition text; start_pos integer; end_pos integer; record_name text; failure_handler text;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.process_temp_integrations_scraped_data()',
  'public.process_temp_integrations_scraped_data_logic(public.temp_integrations_scraped_data)'] LOOP
  definition:=replace(pg_get_functiondef(signature::regprocedure),chr(13),'');
  start_pos:=position('existing_product_id := NULL;' IN definition);
  end_pos:=position('-- Get current prices for price change tracking' IN definition);
  IF start_pos=0 OR end_pos<=start_pos OR position('existing_product_id := public.resolve_competitor_product' IN definition)>0 THEN
   RAISE EXCEPTION 'Unexpected integration matching definition: %',signature;
  END IF;
  record_name:=CASE WHEN signature='public.process_temp_integrations_scraped_data()' THEN 'NEW' ELSE 'record_data' END;
  failure_handler:=CASE WHEN record_name='NEW' THEN E'NEW.status := ''error''; NEW.error_message := SQLERRM; RETURN NEW;'
    ELSE E'UPDATE public.temp_integrations_scraped_data SET status=''error'',error_message=SQLERRM WHERE id=record_data.id; RETURN;' END;
  definition:=left(definition,start_pos-1)||format(E'BEGIN\n      existing_product_id := public.resolve_competitor_product(%1$s.user_id,%1$s.ean,%1$s.brand,%1$s.sku,v_brand_id);\n    EXCEPTION WHEN SQLSTATE ''PT001'' OR SQLSTATE ''PT002'' THEN\n      %2$s\n    END;\n\n    ',record_name,failure_handler)||substring(definition FROM end_pos);
  EXECUTE definition;
 END LOOP;
END;
$integration_patch$;

-- A single JSON document avoids PostgREST's row cap. Rebuilt for every job so
-- additions/removals in our catalog and explicit brand aliases take effect.
CREATE FUNCTION public.get_competitor_catalog_context(p_scraper_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 WITH target AS(SELECT user_id,competitor_id FROM scrapers WHERE id=p_scraper_id),
 own AS(SELECT p.* FROM products p JOIN target t ON t.user_id=p.user_id
   WHERE p.is_active=true AND p.our_retail_price IS NOT NULL),
 owned_brands AS(SELECT DISTINCT b.id,b.name FROM brands b JOIN own p ON p.brand_id=b.id AND p.user_id=b.user_id WHERE b.is_active=true),
 history AS(SELECT DISTINCT ON(h.product_id) h.product_id,h.competitor_url,h.changed_at
   FROM price_changes_competitors h JOIN target t ON t.user_id=h.user_id AND t.competitor_id=h.competitor_id
   WHERE h.new_competitor_price IS NOT NULL AND h.competitor_url IS NOT NULL
   ORDER BY h.product_id,h.changed_at DESC),
 sources AS(SELECT h.product_id,COALESCE(o.competitor_url,h.competitor_url) url,o.verified_at
   FROM history h CROSS JOIN target t LEFT JOIN competitor_price_observations o
    ON o.user_id=t.user_id AND o.competitor_id=t.competitor_id AND o.product_id=h.product_id
   UNION ALL SELECT o.product_id,o.competitor_url,o.verified_at FROM competitor_price_observations o
    JOIN target t ON t.user_id=o.user_id AND t.competitor_id=o.competitor_id
    WHERE o.competitor_url IS NOT NULL AND NOT EXISTS(SELECT 1 FROM history h WHERE h.product_id=o.product_id))
 SELECT jsonb_build_object('version',1,'generatedAt',statement_timestamp(),
  'brands',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,
    'aliases',COALESCE((SELECT jsonb_agg(a.alias_name ORDER BY a.alias_name) FROM brand_aliases a JOIN target t ON t.user_id=a.user_id WHERE a.brand_id=b.id),'[]'::jsonb)) ORDER BY b.name) FROM owned_brands b),'[]'::jsonb),
  'ownProducts',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'ean',p.ean,'sku',p.sku,'brandId',p.brand_id) ORDER BY p.id)
    FROM own p JOIN owned_brands b ON b.id=p.brand_id),'[]'::jsonb),
  'known',COALESCE((SELECT jsonb_agg(jsonb_build_object('url',s.url,'productId',p.id,'brandId',p.brand_id,'verifiedAt',s.verified_at,'checkedAt',c.last_checked_at)
    ORDER BY GREATEST(c.last_checked_at,s.verified_at) ASC NULLS FIRST,p.id)
    FROM sources s JOIN own p ON p.id=s.product_id JOIN owned_brands b ON b.id=p.brand_id
    LEFT JOIN competitor_url_checks c ON c.user_id=p.user_id AND c.competitor_id=(SELECT competitor_id FROM target) AND c.url=s.url),'[]'::jsonb),
  'seen',COALESCE((SELECT jsonb_agg(jsonb_build_object('url',s.url,'verifiedAt',s.checked_at) ORDER BY s.url)
    FROM(SELECT url,max(checked_at) checked_at FROM(
      SELECT url,verified_at checked_at FROM sources
      UNION ALL SELECT c.url,c.last_checked_at FROM competitor_url_checks c JOIN target t ON t.user_id=c.user_id AND t.competitor_id=c.competitor_id
    ) all_checks GROUP BY url) s),'[]'::jsonb),
  'urlChecks',true
 ) FROM target;
$$;
REVOKE ALL ON FUNCTION public.get_competitor_catalog_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_competitor_catalog_context(uuid) TO service_role;
COMMIT;
