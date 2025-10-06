-- =========================================================================
-- Next Auth schema and related objects
-- =========================================================================
-- Generated: 2025-10-06 10:14:01
-- This file is part of the PriceTracker database setup
-- =========================================================================

--
-- Name: create_user_for_nextauth(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_user_for_nextauth() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    SET search_path TO 'public'
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
-- Name: admin_communication_log admin_communication_log_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_communication_log
    ADD CONSTRAINT admin_communication_log_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES next_auth.users(id);

--
-- Name: admin_communication_log admin_communication_log_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_communication_log
    ADD CONSTRAINT admin_communication_log_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES next_auth.users(id);

