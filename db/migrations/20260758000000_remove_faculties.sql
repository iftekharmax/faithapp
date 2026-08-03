-- Migration to remove Faculty related entities and columns
-- Removing faculties table and its references

-- 1. Remove references from applications table
ALTER TABLE public.applications DROP COLUMN IF EXISTS faculty_id;

-- 2. Remove references from university_programs table
ALTER TABLE public.university_programs DROP COLUMN IF EXISTS faculty_id;

-- 3. Drop the faculties table
DROP TABLE IF EXISTS public.faculties CASCADE;
