-- database.sql
-- Run this in the Supabase SQL Editor

-- 1. Create the files table
create table public.files (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security
alter table public.files enable row level security;

-- 3. Create RLS Policies for the files table
create policy "Users can view their own files"
  on public.files for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy "Users can insert their own files"
  on public.files for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "Users can update their own files"
  on public.files for update
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy "Users can delete their own files"
  on public.files for delete
  to authenticated
  using ( (select auth.uid()) = user_id );

-- 4. Create indexes for performance
create index files_user_id_idx on public.files (user_id);
create index files_name_idx on public.files (name);

-- 5. Create Storage Bucket
insert into storage.buckets (id, name, public) 
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- 6. Create Storage Policies
-- Policy to allow authenticated users to view their own files in the documents bucket
create policy "Users can view their own document objects"
  on storage.objects for select
  to authenticated
  using ( bucket_id = 'documents' and auth.uid() = owner );

-- Policy to allow authenticated users to upload files to the documents bucket
create policy "Users can upload document objects"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'documents' and auth.uid() = owner );

-- Policy to allow authenticated users to update their own files in the documents bucket
create policy "Users can update their own document objects"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'documents' and auth.uid() = owner );

-- Policy to allow authenticated users to delete their own files in the documents bucket
create policy "Users can delete their own document objects"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'documents' and auth.uid() = owner );
