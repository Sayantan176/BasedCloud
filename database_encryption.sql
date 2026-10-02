-- Run this in the Supabase SQL Editor to prepare the database for E2E encryption

-- 1. Add is_encrypted column to existing files table
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false NOT NULL;

-- 2. Create the user_keys table for storing wrapped encryption keys
CREATE TABLE IF NOT EXISTS public.user_keys (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  salt text NOT NULL,
  wrapped_mek text NOT NULL,
  kek_iv text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Secure the user_keys table with Row Level Security
ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;

-- 4. Create policy so users can only manage their own keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_keys' AND policyname = 'Users can manage their own keys'
  ) THEN
    CREATE POLICY "Users can manage their own keys"
      ON public.user_keys FOR ALL
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END
$$;
