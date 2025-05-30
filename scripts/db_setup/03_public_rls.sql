-- =========================================================================
-- Row Level Security policies
-- =========================================================================
-- Generated: 2025-05-28 15:44:40
-- This file is part of the PriceTracker database setup
-- =========================================================================

--
-- Name: support_messages Users can add messages to own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add messages to own conversations" ON public.support_messages FOR INSERT WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.support_conversations
  WHERE ((support_conversations.id = support_messages.conversation_id) AND (support_conversations.user_id = auth.uid()))))));

--
-- Name: support_conversations Users can create conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create conversations" ON public.support_conversations FOR INSERT WITH CHECK ((user_id = auth.uid()));

--
-- Name: professional_scraper_requests Users can create scraper requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create scraper requests" ON public.professional_scraper_requests FOR INSERT WITH CHECK ((user_id = auth.uid()));

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
-- Name: scrapers Users can insert their own scrapers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own scrapers" ON public.scrapers FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: staged_integration_products Users can insert their own staged integration products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own staged integration products" ON public.staged_integration_products FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: support_conversations Users can update own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own conversations" ON public.support_conversations FOR UPDATE USING ((user_id = auth.uid()));

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
-- Name: scrapers Users can update their own scrapers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own scrapers" ON public.scrapers FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: staged_integration_products Users can update their own staged integration products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own staged integration products" ON public.staged_integration_products FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: support_messages Users can view messages in own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages in own conversations" ON public.support_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.support_conversations
  WHERE ((support_conversations.id = support_messages.conversation_id) AND (support_conversations.user_id = auth.uid())))));

--
-- Name: support_conversations Users can view own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own conversations" ON public.support_conversations FOR SELECT USING ((user_id = auth.uid()));

--
-- Name: professional_scraper_requests Users can view own scraper requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own scraper requests" ON public.professional_scraper_requests FOR SELECT USING ((user_id = auth.uid()));

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

--
-- Name: admin_communication_log admin_communication_log_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_communication_log_insert_policy ON public.admin_communication_log FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.admin_role = ANY (ARRAY['super_admin'::text, 'support_admin'::text]))))));

--
-- Name: admin_communication_log admin_communication_log_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_communication_log_select_policy ON public.admin_communication_log FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.admin_role = ANY (ARRAY['super_admin'::text, 'support_admin'::text]))))));

