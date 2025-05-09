-- Fix for the auth triggers and functions
-- This migration updates the create_user_for_nextauth function to use the correct column name

-- First, drop the existing trigger
DROP TRIGGER IF EXISTS create_nextauth_user_trigger ON auth.users;

-- Then update the function to use the correct column name
CREATE OR REPLACE FUNCTION public.create_user_for_nextauth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
  RETURN NEW;
END;
$function$;

-- Re-create the trigger
CREATE TRIGGER create_nextauth_user_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_for_nextauth();

-- Add a comment to explain what this function does
COMMENT ON FUNCTION public.create_user_for_nextauth() IS 'Creates a user in the next_auth schema when a user is created in auth.users. Uses the correct column name "emailVerified" (camelCase) instead of "email_verified" (snake_case).';

-- Also update the create_profile_for_user function to handle errors better
CREATE OR REPLACE FUNCTION public.create_profile_for_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Create a user profile when a user is created in auth.users
  BEGIN
    INSERT INTO user_profiles (id, name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'name');
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the transaction
    RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- Add a comment to explain what this function does
COMMENT ON FUNCTION public.create_profile_for_user() IS 'Creates a user profile when a user is created in auth.users. Includes error handling to prevent failures during user creation.';

-- Verify that the next_auth.users table has the correct columns
DO $$
BEGIN
  -- Check if the emailVerified column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'next_auth'
    AND table_name = 'users'
    AND column_name = 'emailVerified'
  ) THEN
    -- Add the column if it doesn't exist
    ALTER TABLE next_auth.users ADD COLUMN "emailVerified" timestamp with time zone;
  END IF;
END $$;

-- Verify that the user_profiles table has the correct columns
DO $$
BEGIN
  -- Check if the name column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name = 'name'
  ) THEN
    -- Add the column if it doesn't exist
    ALTER TABLE public.user_profiles ADD COLUMN name text;
  END IF;
END $$;
