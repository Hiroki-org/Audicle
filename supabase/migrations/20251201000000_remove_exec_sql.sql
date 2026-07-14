-- Remove the insecure exec_sql RPC function
DROP FUNCTION IF EXISTS exec_sql;

-- Drop existing constraint if exists (ignore error if not exists)
DO $$ BEGIN
    ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_url_key;
EXCEPTION WHEN others THEN NULL; END $$;

-- Add composite unique constraint (ignore if already exists)
DO $$ BEGIN
    ALTER TABLE public.articles ADD CONSTRAINT articles_owner_email_url_key UNIQUE (owner_email, url);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- Ensure playlist_items has correct constraint
DO $$ BEGIN
    ALTER TABLE public.playlist_items DROP CONSTRAINT IF EXISTS playlist_items_playlist_id_article_id_key;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.playlist_items ADD CONSTRAINT playlist_items_playlist_id_article_id_key UNIQUE (playlist_id, article_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
