-- ====================================================================
-- UniPrep Database Schema Initialization
-- Execute this script in your Supabase SQL Editor
-- ====================================================================

-- Create app_settings table to store API keys
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert the Mistral API keys (comma-separated for fallback logic)
INSERT INTO public.app_settings (key, value)
VALUES ('mistral_api_key', 'YOUR_MISTRAL_API_KEY_1,YOUR_MISTRAL_API_KEY_2')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Create exam_prep_questions table for the AI generated exam questions
CREATE TABLE IF NOT EXISTS public.exam_prep_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution text,
  faculty text,
  department text,
  course_code text NOT NULL,
  course_title text,
  topic text NOT NULL,
  level text,
  video_link text,
  order_id integer,
  question text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_answer text NOT NULL,
  explanation text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create exam_discussion_messages table for chat history
CREATE TABLE IF NOT EXISTS public.exam_discussion_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  discussion_id text NOT NULL,
  round_index integer NOT NULL,
  user_name text NOT NULL,
  message text,
  audio_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add topic column to exam_discussions
ALTER TABLE public.exam_discussions ADD COLUMN IF NOT EXISTS topic text;

-- Function to get exact server time in milliseconds
-- This ensures perfectly synchronized timers across all clients regardless of their local device clock
CREATE OR REPLACE FUNCTION public.get_server_time_ms()
RETURNS bigint AS $$
BEGIN
  RETURN (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
END;
$$ LANGUAGE plpgsql;

-- Create exam_discussion_votes table for storing user votes
CREATE TABLE IF NOT EXISTS public.exam_discussion_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  discussion_id text NOT NULL,
  round_index integer NOT NULL,
  user_id text NOT NULL,
  user_name text NOT NULL,
  selected_option integer,
  is_correct boolean NOT NULL,
  time_taken integer,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create exam_flashcards table for storing flashcard decks
CREATE TABLE IF NOT EXISTS public.exam_flashcards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution text,
  faculty text,
  department text,
  course_code text NOT NULL,
  course_title text,
  topic text NOT NULL,
  level text,
  order_id integer,
  front text NOT NULL,
  back text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
