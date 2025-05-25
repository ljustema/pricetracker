-- =========================================================================
-- Next Auth schema and related objects
-- =========================================================================
-- Generated: 2025-05-25 12:05:14
-- This file is part of the PriceTracker database setup
-- =========================================================================

--
-- Name: next_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA next_auth;

--
-- Name: uid(); Type: FUNCTION; Schema: next_auth; Owner: -
--

CREATE FUNCTION next_auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select
  	coalesce(
		nullif(current_setting('request.jwt.claim.sub', true), ''),
		(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
	)::uuid
$$;

--
-- Name: create_user_for_nextauth(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_user_for_nextauth() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Create a user in the next_auth schema when a user is created in auth.users
  INSERT INTO next_auth.users (id, name, email, "emailVerified", image)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    NOW(),
    NEW.raw_user_meta_data->>'avatar_url'
  );

--
-- Name: update_user_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Update the user_profile when next_auth.users is updated
  UPDATE public.user_profiles
  SET 
    name = NEW.name,
    avatar_url = NEW.image,
    updated_at = NOW()
  WHERE id = NEW.id;

--
-- Name: accounts; Type: TABLE; Schema: next_auth; Owner: -
--

CREATE TABLE next_auth.accounts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at bigint,
    token_type text,
    scope text,
    id_token text,
    session_state text,
    oauth_token_secret text,
    oauth_token text,
    "userId" uuid
);

--
-- Name: sessions; Type: TABLE; Schema: next_auth; Owner: -
--

CREATE TABLE next_auth.sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    expires timestamp with time zone NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" uuid
);

--
-- Name: users; Type: TABLE; Schema: next_auth; Owner: -
--

CREATE TABLE next_auth.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text,
    email text,
    "emailVerified" timestamp with time zone,
    image text,
    language text,
    notification_preferences jsonb,
    timezone text
);

--
-- Name: verification_tokens; Type: TABLE; Schema: next_auth; Owner: -
--

CREATE TABLE next_auth.verification_tokens (
    identifier text,
    token text NOT NULL,
    expires timestamp with time zone NOT NULL
);

--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);

--
-- Name: users email_unique; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.users
    ADD CONSTRAINT email_unique UNIQUE (email);

--
-- Name: accounts provider_unique; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.accounts
    ADD CONSTRAINT provider_unique UNIQUE (provider, "providerAccountId");

--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

--
-- Name: sessions sessiontoken_unique; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.sessions
    ADD CONSTRAINT sessiontoken_unique UNIQUE ("sessionToken");

--
-- Name: verification_tokens token_identifier_unique; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.verification_tokens
    ADD CONSTRAINT token_identifier_unique UNIQUE (token, identifier);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: verification_tokens verification_tokens_pkey; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.verification_tokens
    ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (token);

--
-- Name: users update_user_profile_trigger; Type: TRIGGER; Schema: next_auth; Owner: -
--

CREATE TRIGGER update_user_profile_trigger AFTER UPDATE ON next_auth.users FOR EACH ROW EXECUTE FUNCTION public.update_user_profile();

--
-- Name: accounts accounts_userId_fkey; Type: FK CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.accounts
    ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES next_auth.users(id) ON DELETE CASCADE;

--
-- Name: sessions sessions_userId_fkey; Type: FK CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.sessions
    ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES next_auth.users(id) ON DELETE CASCADE;

--
-- Name: admin_communication_log admin_communication_log_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_communication_log
    ADD CONSTRAINT admin_communication_log_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES next_auth.users(id);

--
-- Name: admin_communication_log admin_communication_log_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_communication_log
    ADD CONSTRAINT admin_communication_log_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES next_auth.users(id);

--
-- Name: companies companies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_user_id_fkey FOREIGN KEY (user_id) REFERENCES next_auth.users(id);

