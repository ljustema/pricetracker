-- =========================================================================
-- Row Level Security policies
-- =========================================================================
-- Generated: 2025-05-16 15:00:54
-- This file is part of the PriceTracker database setup
-- =========================================================================

--
-- Name: csv_uploads Users can delete their own CSV uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own CSV uploads" ON public.csv_uploads FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: brand_aliases Users can delete their own brand aliases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own brand aliases" ON public.brand_aliases FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: brands Users can delete their own brands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own brands" ON public.brands FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: companies Users can delete their own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own company" ON public.companies FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: competitors Users can delete their own competitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own competitors" ON public.competitors FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: dismissed_duplicates Users can delete their own dismissed duplicates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own dismissed duplicates" ON public.dismissed_duplicates FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: integrations Users can delete their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own integrations" ON public.integrations FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: products Users can delete their own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own products" ON public.products FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: scraper_ai_sessions Users can delete their own scraper AI sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own scraper AI sessions" ON public.scraper_ai_sessions FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: scraper_url_collection Users can delete their own scraper URL collection; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own scraper URL collection" ON public.scraper_url_collection FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: scraper_analysis Users can delete their own scraper analysis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own scraper analysis" ON public.scraper_analysis FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: scraper_data_extraction Users can delete their own scraper data extraction; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own scraper data extraction" ON public.scraper_data_extraction FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: scraper_script_assembly Users can delete their own scraper script assembly; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own scraper script assembly" ON public.scraper_script_assembly FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: scrapers Users can delete their own scrapers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own scrapers" ON public.scrapers FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: staged_integration_products Users can delete their own staged integration products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own staged integration products" ON public.staged_integration_products FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: csv_uploads Users can insert their own CSV uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own CSV uploads" ON public.csv_uploads FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: brand_aliases Users can insert their own brand aliases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own brand aliases" ON public.brand_aliases FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: brands Users can insert their own brands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own brands" ON public.brands FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: companies Users can insert their own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own company" ON public.companies FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: competitors Users can insert their own competitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own competitors" ON public.competitors FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: dismissed_duplicates Users can insert their own dismissed duplicates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own dismissed duplicates" ON public.dismissed_duplicates FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: integration_runs Users can insert their own integration runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own integration runs" ON public.integration_runs FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: integrations Users can insert their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own integrations" ON public.integrations FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: price_changes Users can insert their own price changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own price changes" ON public.price_changes FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: products Users can insert their own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own products" ON public.products FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: scraped_products Users can insert their own scraped products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own scraped products" ON public.scraped_products FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: scraper_ai_sessions Users can insert their own scraper AI sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own scraper AI sessions" ON public.scraper_ai_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: scraper_url_collection Users can insert their own scraper URL collection; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own scraper URL collection" ON public.scraper_url_collection FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: scraper_analysis Users can insert their own scraper analysis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own scraper analysis" ON public.scraper_analysis FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: scraper_data_extraction Users can insert their own scraper data extraction; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own scraper data extraction" ON public.scraper_data_extraction FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: scraper_runs Users can insert their own scraper runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own scraper runs" ON public.scraper_runs FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: scraper_script_assembly Users can insert their own scraper script assembly; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own scraper script assembly" ON public.scraper_script_assembly FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: scrapers Users can insert their own scrapers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own scrapers" ON public.scrapers FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: staged_integration_products Users can insert their own staged integration products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own staged integration products" ON public.staged_integration_products FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: csv_uploads Users can update their own CSV uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own CSV uploads" ON public.csv_uploads FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: brands Users can update their own brands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own brands" ON public.brands FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: companies Users can update their own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own company" ON public.companies FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: competitors Users can update their own competitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own competitors" ON public.competitors FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: integration_runs Users can update their own integration runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own integration runs" ON public.integration_runs FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: integrations Users can update their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own integrations" ON public.integrations FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: products Users can update their own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own products" ON public.products FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: user_profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.user_profiles FOR UPDATE USING ((auth.uid() = id));

--
-- Name: scraper_ai_sessions Users can update their own scraper AI sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own scraper AI sessions" ON public.scraper_ai_sessions FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: scraper_url_collection Users can update their own scraper URL collection; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own scraper URL collection" ON public.scraper_url_collection FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: scraper_analysis Users can update their own scraper analysis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own scraper analysis" ON public.scraper_analysis FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: scraper_data_extraction Users can update their own scraper data extraction; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own scraper data extraction" ON public.scraper_data_extraction FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: scraper_runs Users can update their own scraper runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own scraper runs" ON public.scraper_runs FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: scraper_script_assembly Users can update their own scraper script assembly; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own scraper script assembly" ON public.scraper_script_assembly FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: scrapers Users can update their own scrapers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own scrapers" ON public.scrapers FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: staged_integration_products Users can update their own staged integration products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own staged integration products" ON public.staged_integration_products FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: csv_uploads Users can view their own CSV uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own CSV uploads" ON public.csv_uploads FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: brand_aliases Users can view their own brand aliases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own brand aliases" ON public.brand_aliases FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: brands Users can view their own brands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own brands" ON public.brands FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: companies Users can view their own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own company" ON public.companies FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: competitors Users can view their own competitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own competitors" ON public.competitors FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: dismissed_duplicates Users can view their own dismissed duplicates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own dismissed duplicates" ON public.dismissed_duplicates FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: integration_runs Users can view their own integration runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own integration runs" ON public.integration_runs FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: integrations Users can view their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own integrations" ON public.integrations FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: price_changes Users can view their own price changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own price changes" ON public.price_changes FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: products Users can view their own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own products" ON public.products FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: user_profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.user_profiles FOR SELECT USING ((auth.uid() = id));

--
-- Name: scraped_products Users can view their own scraped products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scraped products" ON public.scraped_products FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: scraper_ai_sessions Users can view their own scraper AI sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scraper AI sessions" ON public.scraper_ai_sessions FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: scraper_url_collection Users can view their own scraper URL collection; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scraper URL collection" ON public.scraper_url_collection FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: scraper_analysis Users can view their own scraper analysis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scraper analysis" ON public.scraper_analysis FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: scraper_data_extraction Users can view their own scraper data extraction; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scraper data extraction" ON public.scraper_data_extraction FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: scraper_runs Users can view their own scraper runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scraper runs" ON public.scraper_runs FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: scraper_script_assembly Users can view their own scraper script assembly; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scraper script assembly" ON public.scraper_script_assembly FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: scrapers Users can view their own scrapers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scrapers" ON public.scrapers FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: staged_integration_products Users can view their own staged integration products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own staged integration products" ON public.staged_integration_products FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: user_subscriptions Users can view their own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own subscriptions" ON public.user_subscriptions FOR SELECT USING ((auth.uid() = user_id));

