-- Run this in the Supabase SQL Editor to enforce the 250MB storage quota at the DB layer

-- Create a function to check user storage quota
CREATE OR REPLACE FUNCTION check_storage_quota()
RETURNS trigger AS $$
DECLARE
  current_usage bigint;
  max_usage constant bigint := 262144000; -- 250 MB
  new_file_size bigint;
BEGIN
  -- Get current usage from public.files table
  SELECT COALESCE(SUM(size_bytes), 0) INTO current_usage
  FROM public.files
  WHERE user_id = auth.uid() AND id != NEW.id;
  
  new_file_size := NEW.size_bytes;
  
  IF current_usage + COALESCE(new_file_size, 0) > max_usage THEN
    RAISE EXCEPTION 'Upload would exceed your 250 MB storage limit.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS enforce_storage_quota ON public.files;

-- Create the trigger
CREATE TRIGGER enforce_storage_quota
BEFORE INSERT OR UPDATE ON public.files
FOR EACH ROW
EXECUTE FUNCTION check_storage_quota();
