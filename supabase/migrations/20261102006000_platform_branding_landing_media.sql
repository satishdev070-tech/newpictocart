-- Allow GIF + MP4 on platform-branding for Super Admin landing media (steps / feature pages).
-- Keep public read; writes still require platform.settings.manage (existing policies).

update storage.buckets
set
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'video/mp4'
  ]
where id = 'platform-branding';
