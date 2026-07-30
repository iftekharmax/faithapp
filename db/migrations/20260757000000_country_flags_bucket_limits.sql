-- Enforce server-side content-type and size validation on the country-flags bucket.
-- Storage rejects uploads outside these limits with a clear error before RLS runs.
update storage.buckets
set
  file_size_limit = 2 * 1024 * 1024,          -- 2 MB hard limit
  allowed_mime_types = array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'image/gif'
  ]
where id = 'country-flags';
