-- Migration: Add others_fees JSONB column to university_programs
ALTER TABLE public.university_programs ADD COLUMN IF NOT EXISTS others_fees JSONB DEFAULT '[]'::jsonb;
