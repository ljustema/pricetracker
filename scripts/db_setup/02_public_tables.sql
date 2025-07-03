-- =========================================================================
-- Public schema tables and sequences
-- =========================================================================
-- Generated: 2025-07-03 11:48:45
-- This file is part of the PriceTracker database setup
-- =========================================================================

BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';

--
-- Name: integration_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    products_processed integer DEFAULT 0,
    products_updated integer DEFAULT 0,
    products_created integer DEFAULT 0,
    error_message text,
    log_details jsonb,
    created_at timestamp with time zone DEFAULT now(),
    test_products jsonb,
    configuration jsonb,
    last_progress_update timestamp with time zone
);

--
-- Name: temp_integrations_scraped_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temp_integrations_scraped_data (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    integration_run_id uuid NOT NULL,
    integration_id uuid NOT NULL,
    user_id uuid NOT NULL,
    prestashop_product_id text,
    name text NOT NULL,
    sku text,
    ean text,
    brand text,
    our_retail_price numeric(10,2),
    our_wholesale_price numeric(10,2),
    image_url text,
    raw_data jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    currency_code text,
    our_url text,
    stock_quantity integer,
    stock_status text,
    availability_date date,
    raw_stock_data jsonb,
    CONSTRAINT temp_integrations_scraped_data_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code))))
);

--
-- Name: COLUMN temp_integrations_scraped_data.stock_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_integrations_scraped_data.stock_quantity IS 'Numeric stock quantity from integration';

--
-- Name: COLUMN temp_integrations_scraped_data.stock_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_integrations_scraped_data.stock_status IS 'Text stock status from integration';

--
-- Name: COLUMN temp_integrations_scraped_data.availability_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_integrations_scraped_data.availability_date IS 'Future availability date if product is out of stock';

--
-- Name: COLUMN temp_integrations_scraped_data.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_integrations_scraped_data.raw_stock_data IS 'Raw stock data from integration including detailed stock information';

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);

--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';

--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);

--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';

--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);

--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';

--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';

--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';

--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);

--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';

--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);

--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';

--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid
);

--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';

--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;

--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);

--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';

--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);

--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';

--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';

--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text
);

--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';

--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';

--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);

--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';

--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);

--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';

--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';

--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';

--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';

--
-- Name: admin_communication_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_communication_log (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    admin_user_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    communication_type text DEFAULT 'email'::text NOT NULL,
    subject text,
    message_content text NOT NULL,
    sent_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'sent'::text,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: TABLE admin_communication_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.admin_communication_log IS 'Logs communications sent by admins to users.';

--
-- Name: COLUMN admin_communication_log.admin_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.admin_communication_log.admin_user_id IS 'The ID of the admin who sent the communication.';

--
-- Name: COLUMN admin_communication_log.target_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.admin_communication_log.target_user_id IS 'The ID of the user who received the communication.';

--
-- Name: brand_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_aliases (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    alias_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    needs_review boolean DEFAULT false NOT NULL
);

--
-- Name: competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    website text NOT NULL,
    logo_url text,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: csv_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.csv_uploads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    competitor_id uuid NOT NULL,
    filename text NOT NULL,
    file_content text NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now(),
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    error_message text
);

--
-- Name: debug_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.debug_logs (
    id integer NOT NULL,
    message text,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: debug_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.debug_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: debug_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.debug_logs_id_seq OWNED BY public.debug_logs.id;

--
-- Name: dismissed_duplicates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dismissed_duplicates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    brand_id_1 uuid NOT NULL,
    brand_id_2 uuid NOT NULL,
    dismissal_key text NOT NULL,
    dismissed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brand_id_order CHECK ((brand_id_1 < brand_id_2))
);

--
-- Name: integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    platform text NOT NULL,
    name text NOT NULL,
    api_url text NOT NULL,
    api_key text NOT NULL,
    status text DEFAULT 'pending_setup'::text NOT NULL,
    last_sync_at timestamp with time zone,
    last_sync_status text,
    sync_frequency text DEFAULT 'daily'::text,
    configuration jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    next_run_time timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL
);

--
-- Name: COLUMN integrations.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.integrations.is_active IS 'Whether the integration is active and should run on schedule';

--
-- Name: marketing_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    company text,
    message text NOT NULL,
    contact_type text DEFAULT 'general'::text,
    status text DEFAULT 'new'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT marketing_contacts_contact_type_check CHECK ((contact_type = ANY (ARRAY['general'::text, 'sales'::text, 'support'::text, 'partnership'::text]))),
    CONSTRAINT marketing_contacts_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'resolved'::text])))
);

--
-- Name: newsletter_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text,
    subscribed_at timestamp with time zone DEFAULT now(),
    unsubscribed_at timestamp with time zone,
    is_active boolean DEFAULT true
);

--
-- Name: price_changes_competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_changes_competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    competitor_id uuid,
    old_competitor_price numeric(10,2),
    new_competitor_price numeric(10,2),
    price_change_percentage numeric(10,2),
    changed_at timestamp with time zone DEFAULT now(),
    integration_id uuid,
    currency_code text,
    competitor_url text,
    old_our_retail_price numeric(10,2),
    new_our_retail_price numeric(10,2),
    our_url text,
    CONSTRAINT check_at_least_one_price CHECK (((new_competitor_price IS NOT NULL) OR (new_our_retail_price IS NOT NULL))),
    CONSTRAINT check_competitor_price_has_competitor_id CHECK ((((old_competitor_price IS NULL) AND (new_competitor_price IS NULL)) OR ((competitor_id IS NOT NULL) AND (integration_id IS NULL)))),
    CONSTRAINT check_our_retail_price_has_integration_id CHECK ((((old_our_retail_price IS NULL) AND (new_our_retail_price IS NULL)) OR ((integration_id IS NOT NULL) AND (competitor_id IS NULL)))),
    CONSTRAINT check_price_consistency CHECK ((((old_competitor_price IS NULL) = (new_competitor_price IS NULL)) OR ((old_our_retail_price IS NULL) = (new_our_retail_price IS NULL)))),
    CONSTRAINT check_price_type_consistency CHECK ((((old_competitor_price IS NULL) AND (old_our_retail_price IS NULL)) OR ((old_competitor_price IS NOT NULL) AND (old_our_retail_price IS NULL)) OR ((old_competitor_price IS NULL) AND (old_our_retail_price IS NOT NULL)))),
    CONSTRAINT price_changes_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code)))),
    CONSTRAINT price_changes_source_check CHECK (((competitor_id IS NOT NULL) OR (integration_id IS NOT NULL)))
);

--
-- Name: COLUMN price_changes_competitors.currency_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.price_changes_competitors.currency_code IS 'ISO 4217 currency code (e.g., SEK, USD)';

--
-- Name: price_changes_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_changes_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    supplier_id uuid,
    old_our_wholesale_price numeric(10,2),
    new_our_wholesale_price numeric(10,2),
    price_change_percentage numeric(10,2),
    currency_code text DEFAULT 'SEK'::text,
    supplier_url text,
    minimum_order_quantity integer DEFAULT 1,
    lead_time_days integer,
    changed_at timestamp with time zone DEFAULT now(),
    change_source text DEFAULT 'manual'::text,
    old_supplier_price numeric(10,2),
    new_supplier_price numeric(10,2),
    old_supplier_recommended_price numeric(10,2),
    new_supplier_recommended_price numeric(10,2),
    integration_id uuid,
    our_url text,
    CONSTRAINT check_exactly_one_source CHECK ((((supplier_id IS NOT NULL) AND (integration_id IS NULL)) OR ((supplier_id IS NULL) AND (integration_id IS NOT NULL)))),
    CONSTRAINT check_our_wholesale_price_has_integration_id CHECK ((((old_our_wholesale_price IS NULL) AND (new_our_wholesale_price IS NULL)) OR ((integration_id IS NOT NULL) AND (supplier_id IS NULL)))),
    CONSTRAINT check_supplier_price_consistency CHECK (((old_supplier_price IS NULL) = (new_supplier_price IS NULL))),
    CONSTRAINT check_supplier_price_has_supplier_id CHECK ((((old_supplier_price IS NULL) AND (new_supplier_price IS NULL)) OR ((supplier_id IS NOT NULL) AND (integration_id IS NULL)))),
    CONSTRAINT price_changes_suppliers_change_source_check CHECK ((change_source = ANY (ARRAY['manual'::text, 'csv'::text, 'scraper'::text, 'integration'::text])))
);

--
-- Name: product_custom_field_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_custom_field_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    custom_field_id uuid NOT NULL,
    value text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source_type character varying(20),
    source_id uuid,
    last_updated_by character varying(20),
    confidence_score integer DEFAULT 100,
    created_by_source character varying(20),
    value_hash text
);

--
-- Name: product_custom_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_custom_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    field_name text NOT NULL,
    field_type text NOT NULL,
    is_required boolean DEFAULT false,
    default_value text,
    validation_rules jsonb,
    created_at timestamp with time zone DEFAULT now(),
    update_strategy character varying(20) DEFAULT 'source_priority'::character varying,
    source_priority jsonb DEFAULT '{"manual": 100, "supplier": 60, "competitor": 40, "integration": 80}'::jsonb,
    allow_auto_update boolean DEFAULT true,
    CONSTRAINT user_custom_fields_field_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'number'::text, 'boolean'::text, 'url'::text, 'date'::text])))
);

--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    sku text,
    ean text,
    brand text,
    category text,
    description text,
    image_url text,
    our_retail_price numeric(10,2),
    our_wholesale_price numeric(10,2),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    brand_id uuid NOT NULL,
    currency_code text,
    our_url text,
    CONSTRAINT products_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code))))
);

--
-- Name: COLUMN products.currency_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.currency_code IS 'ISO 4217 currency code (e.g., SEK, USD)';

--
-- Name: COLUMN products.our_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.our_url IS 'URL to the product on the source platform';

--
-- Name: products_dismissed_duplicates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products_dismissed_duplicates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id_1 uuid NOT NULL,
    product_id_2 uuid NOT NULL,
    dismissal_key text NOT NULL,
    dismissed_at timestamp without time zone DEFAULT now(),
    CONSTRAINT product_id_order CHECK ((product_id_1 < product_id_2))
);

--
-- Name: professional_scraper_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.professional_scraper_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    competitor_id uuid,
    name text NOT NULL,
    email text NOT NULL,
    website text NOT NULL,
    requirements text NOT NULL,
    additional_info text,
    status text DEFAULT 'submitted'::text,
    quoted_price numeric(10,2),
    estimated_delivery_days integer,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT professional_scraper_requests_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'reviewing'::text, 'quoted'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);

--
-- Name: rate_limit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_address inet NOT NULL,
    endpoint text NOT NULL,
    attempts integer DEFAULT 1,
    window_start timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: scraper_ai_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraper_ai_sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    competitor_id uuid NOT NULL,
    url text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    current_phase text NOT NULL,
    analysis_data jsonb DEFAULT '{}'::jsonb,
    url_collection_data jsonb DEFAULT '{}'::jsonb,
    data_extraction_data jsonb DEFAULT '{}'::jsonb,
    assembly_data jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT scraper_ai_sessions_current_phase_check CHECK ((current_phase = ANY (ARRAY['analysis'::text, 'data-validation'::text, 'assembly'::text, 'complete'::text])))
);

--
-- Name: TABLE scraper_ai_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.scraper_ai_sessions IS 'AI scraper sessions with phases: analysis, data-validation, assembly, complete';

--
-- Name: COLUMN scraper_ai_sessions.current_phase; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.current_phase IS 'Current phase of the AI scraper generation process: analysis, data-validation, assembly, complete';

--
-- Name: COLUMN scraper_ai_sessions.analysis_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.analysis_data IS 'Data from the site analysis phase';

--
-- Name: COLUMN scraper_ai_sessions.url_collection_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.url_collection_data IS 'Legacy: Data from the URL collection phase (now part of data-validation)';

--
-- Name: COLUMN scraper_ai_sessions.data_extraction_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.data_extraction_data IS 'Data from the data validation phase (previously data-extraction)';

--
-- Name: COLUMN scraper_ai_sessions.assembly_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.assembly_data IS 'Data from the script assembly phase';

--
-- Name: scraper_run_timeouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraper_run_timeouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    timeout_at timestamp with time zone NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: scraper_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraper_runs (
    id uuid NOT NULL,
    scraper_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'initializing'::text,
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    is_test_run boolean DEFAULT false,
    product_count integer DEFAULT 0,
    current_batch integer DEFAULT 0,
    total_batches integer,
    error_message text,
    progress_messages text[],
    created_at timestamp with time zone DEFAULT now(),
    execution_time_ms bigint,
    products_per_second numeric(10,2),
    scraper_type text,
    error_details text,
    claimed_by_worker_at timestamp with time zone,
    current_phase integer
);

--
-- Name: scrapers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scrapers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    competitor_id uuid,
    name text NOT NULL,
    url text NOT NULL,
    schedule jsonb NOT NULL,
    is_active boolean DEFAULT false,
    status text DEFAULT 'idle'::text,
    error_message text,
    last_run timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    scraper_type character varying(20) DEFAULT 'ai'::character varying NOT NULL,
    python_script text,
    script_metadata jsonb,
    test_results jsonb,
    execution_time bigint,
    last_products_per_second numeric(10,2),
    typescript_script text,
    scrape_only_own_products boolean DEFAULT false NOT NULL,
    filter_by_active_brands boolean DEFAULT false NOT NULL,
    supplier_id uuid,
    next_run_time timestamp with time zone,
    CONSTRAINT scrapers_target_check CHECK ((((competitor_id IS NOT NULL) AND (supplier_id IS NULL)) OR ((competitor_id IS NULL) AND (supplier_id IS NOT NULL))))
);

--
-- Name: TABLE scrapers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.scrapers IS 'Stores scraper configurations for different types: AI, Python, and CSV';

--
-- Name: COLUMN scrapers.execution_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scrapers.execution_time IS 'Time in milliseconds it took to run the scraper';

--
-- Name: COLUMN scrapers.last_products_per_second; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scrapers.last_products_per_second IS 'Products per second metric from the most recently completed successful run.';

--
-- Name: COLUMN scrapers.scrape_only_own_products; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scrapers.scrape_only_own_products IS 'Flag to only scrape products matching the user''s own product catalog (based on EAN/SKU/Brand matching)';

--
-- Name: stock_changes_competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_changes_competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    competitor_id uuid,
    integration_id uuid,
    old_stock_quantity integer,
    new_stock_quantity integer,
    old_stock_status text,
    new_stock_status text,
    old_availability_date date,
    new_availability_date date,
    stock_change_quantity integer,
    changed_at timestamp with time zone DEFAULT now(),
    raw_stock_data jsonb,
    competitor_url text,
    our_url text,
    CONSTRAINT stock_changes_source_check CHECK (((competitor_id IS NOT NULL) OR (integration_id IS NOT NULL)))
);

--
-- Name: TABLE stock_changes_competitors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stock_changes_competitors IS 'Tracks stock level changes for competitor products over time';

--
-- Name: COLUMN stock_changes_competitors.stock_change_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stock_changes_competitors.stock_change_quantity IS 'Calculated field: new_stock_quantity - old_stock_quantity';

--
-- Name: COLUMN stock_changes_competitors.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stock_changes_competitors.raw_stock_data IS 'JSON data containing detailed stock information like product combinations/variants';

--
-- Name: stock_changes_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_changes_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    supplier_id uuid,
    integration_id uuid,
    old_stock_quantity integer,
    new_stock_quantity integer,
    old_stock_status text,
    new_stock_status text,
    old_availability_date date,
    new_availability_date date,
    stock_change_quantity integer,
    changed_at timestamp with time zone DEFAULT now(),
    raw_stock_data jsonb,
    supplier_url text,
    our_url text,
    CONSTRAINT stock_changes_suppliers_source_check CHECK (((supplier_id IS NOT NULL) OR (integration_id IS NOT NULL)))
);

--
-- Name: TABLE stock_changes_suppliers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stock_changes_suppliers IS 'Tracks stock level changes for supplier products over time';

--
-- Name: COLUMN stock_changes_suppliers.stock_change_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stock_changes_suppliers.stock_change_quantity IS 'Calculated field: new_stock_quantity - old_stock_quantity';

--
-- Name: COLUMN stock_changes_suppliers.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stock_changes_suppliers.raw_stock_data IS 'JSON data containing detailed stock information';

--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    website text,
    contact_email text,
    contact_phone text,
    logo_url text,
    notes text,
    login_username text,
    login_password text,
    api_key text,
    api_url text,
    login_url text,
    price_file_url text,
    scraping_config jsonb,
    sync_frequency text DEFAULT 'weekly'::text,
    last_sync_at timestamp with time zone,
    last_sync_status text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT suppliers_sync_frequency_check CHECK ((sync_frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'manual'::text])))
);

--
-- Name: support_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    admin_user_id uuid,
    subject text NOT NULL,
    status text DEFAULT 'open'::text,
    priority text DEFAULT 'medium'::text,
    category text DEFAULT 'general'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    last_read_by_user timestamp with time zone,
    last_read_by_admin timestamp with time zone,
    CONSTRAINT support_conversations_category_check CHECK ((category = ANY (ARRAY['general'::text, 'technical'::text, 'billing'::text, 'scraper_request'::text, 'feature_request'::text]))),
    CONSTRAINT support_conversations_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT support_conversations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])))
);

--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid,
    sender_id uuid,
    sender_type text NOT NULL,
    message_content text NOT NULL,
    is_internal boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    read_by_recipient boolean DEFAULT false,
    CONSTRAINT support_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['user'::text, 'admin'::text])))
);

--
-- Name: temp_competitors_scraped_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temp_competitors_scraped_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    scraper_id uuid,
    competitor_id uuid NOT NULL,
    product_id uuid,
    name text NOT NULL,
    competitor_price numeric(10,2) NOT NULL,
    competitor_url text,
    image_url text,
    sku text,
    brand text,
    scraped_at timestamp with time zone DEFAULT now(),
    ean text,
    currency_code text,
    raw_data jsonb,
    stock_quantity integer,
    stock_status text,
    availability_date date,
    raw_stock_data jsonb,
    processed boolean DEFAULT false,
    CONSTRAINT temp_competitors_scraped_data_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code))))
);

--
-- Name: COLUMN temp_competitors_scraped_data.stock_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_competitors_scraped_data.stock_quantity IS 'Numeric stock quantity extracted from competitor site';

--
-- Name: COLUMN temp_competitors_scraped_data.stock_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_competitors_scraped_data.stock_status IS 'Text stock status (e.g., "I lager", "Ej i lager")';

--
-- Name: COLUMN temp_competitors_scraped_data.availability_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_competitors_scraped_data.availability_date IS 'Future availability date if product is out of stock';

--
-- Name: COLUMN temp_competitors_scraped_data.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_competitors_scraped_data.raw_stock_data IS 'Raw stock data from scraper including combinations and metadata';

--
-- Name: temp_suppliers_scraped_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temp_suppliers_scraped_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    scraper_id uuid NOT NULL,
    run_id text NOT NULL,
    name text,
    sku text,
    brand text,
    ean text,
    supplier_price numeric(10,2),
    currency_code text DEFAULT 'SEK'::text,
    supplier_url text,
    image_url text,
    minimum_order_quantity integer DEFAULT 1,
    lead_time_days integer,
    stock_quantity integer,
    product_description text,
    category text,
    scraped_at timestamp with time zone DEFAULT now(),
    processed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    supplier_recommended_price numeric(10,2),
    raw_data jsonb,
    stock_status text,
    availability_date date,
    raw_stock_data jsonb
);

--
-- Name: COLUMN temp_suppliers_scraped_data.supplier_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.supplier_price IS 'Supplier cost price (what they charge us)';

--
-- Name: COLUMN temp_suppliers_scraped_data.stock_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.stock_quantity IS 'Numeric stock quantity from supplier (renamed from stock_level)';

--
-- Name: COLUMN temp_suppliers_scraped_data.supplier_recommended_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.supplier_recommended_price IS 'Supplier recommended retail price (what they suggest we charge customers)';

--
-- Name: COLUMN temp_suppliers_scraped_data.stock_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.stock_status IS 'Text stock status from supplier';

--
-- Name: COLUMN temp_suppliers_scraped_data.availability_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.availability_date IS 'Future availability date if product is out of stock';

--
-- Name: COLUMN temp_suppliers_scraped_data.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.raw_stock_data IS 'Raw stock data from supplier including detailed stock information';

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    name text,
    avatar_url text,
    subscription_tier text DEFAULT 'free'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email text,
    admin_role text,
    is_suspended boolean DEFAULT false
);

--
-- Name: COLUMN user_profiles.admin_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.admin_role IS 'Defines the admin role for the user, if any (e.g., super_admin, support_admin).';

--
-- Name: COLUMN user_profiles.is_suspended; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.is_suspended IS 'Indicates if the user account is currently suspended by an admin.';

--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text,
    address text,
    org_number text,
    primary_currency text,
    secondary_currencies text[],
    currency_format text,
    matching_rules jsonb,
    price_thresholds jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    auto_create_custom_fields boolean DEFAULT true,
    custom_fields_update_strategy character varying(20) DEFAULT 'source_priority'::character varying,
    custom_fields_source_priority jsonb DEFAULT '{"manual": 100, "supplier": 60, "competitor": 40, "integration": 80}'::jsonb,
    CONSTRAINT companies_primary_currency_check CHECK ((char_length(primary_currency) = 3))
);

--
-- Name: user_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    price_id text,
    status text DEFAULT 'inactive'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);

--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);

--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text
);

--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';

--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);

--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';

--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);

--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text,
    created_by text,
    idempotency_key text
);

--
-- Name: seed_files; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.seed_files (
    path text NOT NULL,
    hash text NOT NULL
);

--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);

--
-- Name: debug_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debug_logs ALTER COLUMN id SET DEFAULT nextval('public.debug_logs_id_seq'::regclass);

--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);

--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);

--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);

--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);

--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);

--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);

--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);

--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);

--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);

--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);

--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);

--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);

--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);

--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);

--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);

--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);

--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);

--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);

--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);

--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: admin_communication_log admin_communication_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_communication_log
    ADD CONSTRAINT admin_communication_log_pkey PRIMARY KEY (id);

--
-- Name: brand_aliases brand_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_aliases
    ADD CONSTRAINT brand_aliases_pkey PRIMARY KEY (id);

--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);

--
-- Name: user_settings companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);

--
-- Name: competitors competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_pkey PRIMARY KEY (id);

--
-- Name: csv_uploads csv_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csv_uploads
    ADD CONSTRAINT csv_uploads_pkey PRIMARY KEY (id);

--
-- Name: debug_logs debug_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debug_logs
    ADD CONSTRAINT debug_logs_pkey PRIMARY KEY (id);

--
-- Name: dismissed_duplicates dismissed_duplicates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT dismissed_duplicates_pkey PRIMARY KEY (id);

--
-- Name: integration_runs integration_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_runs
    ADD CONSTRAINT integration_runs_pkey PRIMARY KEY (id);

--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);

--
-- Name: marketing_contacts marketing_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_contacts
    ADD CONSTRAINT marketing_contacts_pkey PRIMARY KEY (id);

--
-- Name: newsletter_subscriptions newsletter_subscriptions_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscriptions
    ADD CONSTRAINT newsletter_subscriptions_email_key UNIQUE (email);

--
-- Name: newsletter_subscriptions newsletter_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscriptions
    ADD CONSTRAINT newsletter_subscriptions_pkey PRIMARY KEY (id);

--
-- Name: price_changes_competitors price_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_pkey PRIMARY KEY (id);

--
-- Name: price_changes_suppliers price_changes_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_pkey PRIMARY KEY (id);

--
-- Name: product_custom_field_values product_custom_field_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_field_values
    ADD CONSTRAINT product_custom_field_values_pkey PRIMARY KEY (id);

--
-- Name: product_custom_field_values product_custom_field_values_product_id_custom_field_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_field_values
    ADD CONSTRAINT product_custom_field_values_product_id_custom_field_id_key UNIQUE (product_id, custom_field_id);

--
-- Name: products_dismissed_duplicates products_dismissed_duplicates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT products_dismissed_duplicates_pkey PRIMARY KEY (id);

--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);

--
-- Name: professional_scraper_requests professional_scraper_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_scraper_requests
    ADD CONSTRAINT professional_scraper_requests_pkey PRIMARY KEY (id);

--
-- Name: rate_limit_log rate_limit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_log
    ADD CONSTRAINT rate_limit_log_pkey PRIMARY KEY (id);

--
-- Name: scraper_ai_sessions scraper_ai_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_ai_sessions
    ADD CONSTRAINT scraper_ai_sessions_pkey PRIMARY KEY (id);

--
-- Name: scraper_run_timeouts scraper_run_timeouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_run_timeouts
    ADD CONSTRAINT scraper_run_timeouts_pkey PRIMARY KEY (id);

--
-- Name: scraper_runs scraper_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_runs
    ADD CONSTRAINT scraper_runs_pkey PRIMARY KEY (id);

--
-- Name: scrapers scrapers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrapers
    ADD CONSTRAINT scrapers_pkey PRIMARY KEY (id);

--
-- Name: stock_changes_competitors stock_changes_competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT stock_changes_competitors_pkey PRIMARY KEY (id);

--
-- Name: stock_changes_suppliers stock_changes_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT stock_changes_suppliers_pkey PRIMARY KEY (id);

--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);

--
-- Name: support_conversations support_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_conversations
    ADD CONSTRAINT support_conversations_pkey PRIMARY KEY (id);

--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);

--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_pkey PRIMARY KEY (id);

--
-- Name: temp_integrations_scraped_data temp_integrations_scraped_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_integrations_scraped_data
    ADD CONSTRAINT temp_integrations_scraped_data_pkey PRIMARY KEY (id);

--
-- Name: temp_suppliers_scraped_data temp_suppliers_scraped_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_suppliers_scraped_data
    ADD CONSTRAINT temp_suppliers_scraped_data_pkey PRIMARY KEY (id);

--
-- Name: brand_aliases unique_brand_alias; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_aliases
    ADD CONSTRAINT unique_brand_alias UNIQUE (user_id, brand_id, alias_name);

--
-- Name: dismissed_duplicates unique_dismissed_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT unique_dismissed_pair UNIQUE (user_id, brand_id_1, brand_id_2);

--
-- Name: products_dismissed_duplicates unique_dismissed_product_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT unique_dismissed_product_pair UNIQUE (user_id, product_id_1, product_id_2);

--
-- Name: brands unique_user_brand; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT unique_user_brand UNIQUE (user_id, name);

--
-- Name: product_custom_fields user_custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_fields
    ADD CONSTRAINT user_custom_fields_pkey PRIMARY KEY (id);

--
-- Name: product_custom_fields user_custom_fields_user_id_field_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_fields
    ADD CONSTRAINT user_custom_fields_user_id_field_name_key UNIQUE (user_id, field_name);

--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);

--
-- Name: user_settings user_settings_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_unique UNIQUE (user_id);

--
-- Name: user_subscriptions user_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id);

--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);

--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);

--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);

--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);

--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);

--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);

--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);

--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);

--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);

--
-- Name: schema_migrations schema_migrations_idempotency_key_key; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_idempotency_key_key UNIQUE (idempotency_key);

--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);

--
-- Name: seed_files seed_files_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.seed_files
    ADD CONSTRAINT seed_files_pkey PRIMARY KEY (path);

--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;

--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;

--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;

--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;

--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;

--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;

--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;

--
-- Name: brand_aliases brand_aliases_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_aliases
    ADD CONSTRAINT brand_aliases_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;

--
-- Name: brand_aliases brand_aliases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_aliases
    ADD CONSTRAINT brand_aliases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: brands brands_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: competitors competitors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: csv_uploads csv_uploads_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csv_uploads
    ADD CONSTRAINT csv_uploads_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);

--
-- Name: csv_uploads csv_uploads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csv_uploads
    ADD CONSTRAINT csv_uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: dismissed_duplicates dismissed_duplicates_brand_id_1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT dismissed_duplicates_brand_id_1_fkey FOREIGN KEY (brand_id_1) REFERENCES public.brands(id) ON DELETE CASCADE;

--
-- Name: dismissed_duplicates dismissed_duplicates_brand_id_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT dismissed_duplicates_brand_id_2_fkey FOREIGN KEY (brand_id_2) REFERENCES public.brands(id) ON DELETE CASCADE;

--
-- Name: dismissed_duplicates dismissed_duplicates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT dismissed_duplicates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: stock_changes_competitors fk_stock_competitors_competitor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT fk_stock_competitors_competitor FOREIGN KEY (competitor_id) REFERENCES public.competitors(id) ON DELETE CASCADE;

--
-- Name: stock_changes_competitors fk_stock_competitors_integration; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT fk_stock_competitors_integration FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE;

--
-- Name: stock_changes_competitors fk_stock_competitors_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT fk_stock_competitors_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

--
-- Name: stock_changes_competitors fk_stock_competitors_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT fk_stock_competitors_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: stock_changes_suppliers fk_stock_suppliers_integration; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT fk_stock_suppliers_integration FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE;

--
-- Name: stock_changes_suppliers fk_stock_suppliers_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT fk_stock_suppliers_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

--
-- Name: stock_changes_suppliers fk_stock_suppliers_supplier; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT fk_stock_suppliers_supplier FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;

--
-- Name: stock_changes_suppliers fk_stock_suppliers_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT fk_stock_suppliers_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: integration_runs integration_runs_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_runs
    ADD CONSTRAINT integration_runs_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id);

--
-- Name: integration_runs integration_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_runs
    ADD CONSTRAINT integration_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

--
-- Name: integrations integrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

--
-- Name: price_changes_competitors price_changes_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);

--
-- Name: price_changes_competitors price_changes_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE;

--
-- Name: price_changes_competitors price_changes_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

--
-- Name: price_changes_suppliers price_changes_suppliers_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id);

--
-- Name: price_changes_suppliers price_changes_suppliers_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

--
-- Name: price_changes_suppliers price_changes_suppliers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);

--
-- Name: price_changes_suppliers price_changes_suppliers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: price_changes_competitors price_changes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: product_custom_field_values product_custom_field_values_custom_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_field_values
    ADD CONSTRAINT product_custom_field_values_custom_field_id_fkey FOREIGN KEY (custom_field_id) REFERENCES public.product_custom_fields(id);

--
-- Name: product_custom_field_values product_custom_field_values_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_field_values
    ADD CONSTRAINT product_custom_field_values_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id);

--
-- Name: products_dismissed_duplicates products_dismissed_duplicates_product_id_1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT products_dismissed_duplicates_product_id_1_fkey FOREIGN KEY (product_id_1) REFERENCES public.products(id);

--
-- Name: products_dismissed_duplicates products_dismissed_duplicates_product_id_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT products_dismissed_duplicates_product_id_2_fkey FOREIGN KEY (product_id_2) REFERENCES public.products(id);

--
-- Name: products_dismissed_duplicates products_dismissed_duplicates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT products_dismissed_duplicates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: products products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: professional_scraper_requests professional_scraper_requests_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_scraper_requests
    ADD CONSTRAINT professional_scraper_requests_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);

--
-- Name: professional_scraper_requests professional_scraper_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_scraper_requests
    ADD CONSTRAINT professional_scraper_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

--
-- Name: scraper_ai_sessions scraper_ai_sessions_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_ai_sessions
    ADD CONSTRAINT scraper_ai_sessions_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);

--
-- Name: scraper_ai_sessions scraper_ai_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_ai_sessions
    ADD CONSTRAINT scraper_ai_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: scraper_run_timeouts scraper_run_timeouts_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_run_timeouts
    ADD CONSTRAINT scraper_run_timeouts_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.scraper_runs(id) ON DELETE CASCADE;

--
-- Name: scraper_runs scraper_runs_scraper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_runs
    ADD CONSTRAINT scraper_runs_scraper_id_fkey FOREIGN KEY (scraper_id) REFERENCES public.scrapers(id);

--
-- Name: scraper_runs scraper_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_runs
    ADD CONSTRAINT scraper_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: scrapers scrapers_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrapers
    ADD CONSTRAINT scrapers_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);

--
-- Name: scrapers scrapers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrapers
    ADD CONSTRAINT scrapers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);

--
-- Name: scrapers scrapers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrapers
    ADD CONSTRAINT scrapers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: suppliers suppliers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: support_conversations support_conversations_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_conversations
    ADD CONSTRAINT support_conversations_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.user_profiles(id);

--
-- Name: support_conversations support_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_conversations
    ADD CONSTRAINT support_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

--
-- Name: support_messages support_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.support_conversations(id) ON DELETE CASCADE;

--
-- Name: support_messages support_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.user_profiles(id);

--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id) ON DELETE CASCADE;

--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_scraper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_scraper_id_fkey FOREIGN KEY (scraper_id) REFERENCES public.scrapers(id);

--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: temp_integrations_scraped_data temp_integrations_scraped_data_integration_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_integrations_scraped_data
    ADD CONSTRAINT temp_integrations_scraped_data_integration_run_id_fkey FOREIGN KEY (integration_run_id) REFERENCES public.integration_runs(id) ON DELETE CASCADE;

--
-- Name: temp_suppliers_scraped_data temp_suppliers_scraped_data_scraper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_suppliers_scraped_data
    ADD CONSTRAINT temp_suppliers_scraped_data_scraper_id_fkey FOREIGN KEY (scraper_id) REFERENCES public.scrapers(id);

--
-- Name: temp_suppliers_scraped_data temp_suppliers_scraped_data_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_suppliers_scraped_data
    ADD CONSTRAINT temp_suppliers_scraped_data_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);

--
-- Name: temp_suppliers_scraped_data temp_suppliers_scraped_data_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_suppliers_scraped_data
    ADD CONSTRAINT temp_suppliers_scraped_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: product_custom_fields user_custom_fields_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_fields
    ADD CONSTRAINT user_custom_fields_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: user_subscriptions user_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);

--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);

--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);

--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;

--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_communication_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_communication_log ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_aliases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_aliases ENABLE ROW LEVEL SECURITY;

--
-- Name: brands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

--
-- Name: competitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

--
-- Name: csv_uploads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.csv_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: debug_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: dismissed_duplicates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dismissed_duplicates ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integration_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: price_changes_competitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_changes_competitors ENABLE ROW LEVEL SECURITY;

--
-- Name: price_changes_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_changes_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: product_custom_field_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_custom_field_values ENABLE ROW LEVEL SECURITY;

--
-- Name: product_custom_fields; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_custom_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: products_dismissed_duplicates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products_dismissed_duplicates ENABLE ROW LEVEL SECURITY;

--
-- Name: professional_scraper_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.professional_scraper_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: scraper_ai_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraper_ai_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: scraper_run_timeouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraper_run_timeouts ENABLE ROW LEVEL SECURITY;

--
-- Name: scraper_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraper_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: scrapers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scrapers ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_changes_competitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_changes_competitors ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_changes_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_changes_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: support_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: support_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: temp_competitors_scraped_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.temp_competitors_scraped_data ENABLE ROW LEVEL SECURITY;

--
-- Name: temp_integrations_scraped_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.temp_integrations_scraped_data ENABLE ROW LEVEL SECURITY;

--
-- Name: temp_suppliers_scraped_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.temp_suppliers_scraped_data ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

