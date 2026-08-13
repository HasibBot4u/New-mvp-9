# RLS Policy Documentation

## Public Access Policies

- **Video Variants:** Publicly selectable by anyone looking to play active videos.
  - table: `video_variants`
  - policy: `Public video variants` FOR SELECT
  - check: `is_active = true AND deleted_at IS NULL` (Note: assuming `videos.deleted_at` filters cascade or are handled in queries)

## User Authentication Policies

All user access policies verify against `auth.uid()`.

- **Profiles:** Users can only view their own profile, except admins.
  - table: `profiles`
  - policy: `Users can view own profile` FOR SELECT
  - check: `id = auth.uid() OR is_admin()`

- **Device Sessions:** Users can only view their own device sessions.
  - table: `device_sessions`
  - policy: `Users can view own devices` FOR ALL
  - check: `user_id = auth.uid()`

- **Payments:** Users can only view their own payments, except admins.
  - table: `payments`
  - policy: `Users can view own payments` FOR SELECT
  - check: `user_id = auth.uid() OR is_admin()`

- **Download Queue (Offline):** 
  - table: `download_queue`
  - policy: `Users view own download queue` FOR SELECT
  - check: `user_id = auth.uid()`
  - policy: `Users process own download queue` FOR ALL
  - check: `user_id = auth.uid()`

- **Content Reports (Reporting Issues):**
  - table: `content_reports`
  - policy: `Users can report content` FOR INSERT
  - check: `reporter_id = auth.uid()`
  - policy: `Admins can view reports` FOR SELECT
  - check: `is_admin()`

## Administration Restrictions

- **Video Analytics:** Statistics are locked to admins only to prevent leakage of user data.
  - table: `video_analytics`
  - policy: `Admins can view analytics` FOR SELECT
  - check: `is_admin()`

## Functions Reference

- `is_admin()`: Verifies if the request's user has `'admin'` row set in `profiles.role`.
