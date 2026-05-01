export interface Profile {
  id: string;
  email: string;
  display_name?: string;
  role: 'user' | 'admin';
  is_enrolled: boolean;
  is_blocked?: boolean;
  avatar_url?: string;
  phone?: string;
  created_at: string;
  updated_at?: string;
}

export interface Subject {
  id: string; name: string; name_bn?: string; slug: string;
  icon?: string; color?: string; thumbnail_color?: string;
  description?: string; description_bn?: string;
  display_order: number; is_active: boolean;
}

export interface Cycle {
  id: string; subject_id: string; name: string; name_bn?: string;
  telegram_channel_id?: string; description?: string; description_bn?: string;
  display_order: number; is_active: boolean;
}

export interface Chapter {
  id: string; cycle_id: string; name: string; name_bn?: string;
  description?: string; description_bn?: string;
  requires_enrollment: boolean; display_order: number; is_active: boolean;
}

export interface Video {
  id: string; chapter_id: string; title: string; title_bn?: string;
  description?: string; description_bn?: string;
  source_type?: 'telegram' | 'youtube' | 'drive';
  source_url?: string;
  youtube_video_id?: string; drive_file_id?: string;
  telegram_channel_id?: string; telegram_message_id?: number;
  duration?: string; size_mb?: number; file_size_bytes?: number; mime_type?: string; thumbnail_url?: string;
  display_order: number; is_active: boolean; created_at: string; updated_at?: string;
}

export interface WatchHistory {
  id: string; user_id: string; video_id: string;
  watched_at: string;               // correct column name
  progress_percent: number;         // 0-100
  progress_seconds: number;         // integer seconds
  completed: boolean;               // NOW EXISTS in DB after migration
  watch_count: number;
  updated_at?: string;
}

export interface Announcement {
  id: string; title: string; title_bn?: string;
  body?: string;    // CORRECT field name — NOT "content" (Bug N-012)
  body_bn?: string; // CORRECT field name
  type: 'info' | 'warning' | 'success' | 'urgent';
  is_active: boolean; is_pinned: boolean;
  created_at: string; expires_at?: string;
}

export interface Notification {
  id: string; user_id: string; title: string; title_bn?: string;
  body?: string; body_bn?: string;
  type: 'info' | 'success' | 'warning' | 'system';
  is_read: boolean; action_url?: string; created_at: string;
}

export interface LiveClass {
  id: string; title: string; title_bn?: string;
  subject_id?: string; cycle_id?: string;
  scheduled_at: string; duration_minutes: number;
  meeting_url?: string; stream_url?: string;
  description?: string; description_bn?: string;
  is_active: boolean; is_cancelled: boolean; is_completed: boolean;
  created_at: string;
}

export interface EnrollmentCode {
  id: string; code: string; chapter_id: string;
  subject_id?: string; cycle_id?: string;
  label?: string; notes?: string; max_uses: number; uses_count: number;
  is_active: boolean; generated_by?: string; generated_at: string;
}

export interface ChapterAccess {
  id: string; user_id: string; chapter_id: string;
  enrollment_code_id?: string; device_fingerprint: string;
  device_ip?: string; device_user_agent?: string;
  device_info?: Record<string, unknown>; user_email?: string;
  first_accessed_at: string; last_accessed_at: string;
  access_count: number; is_blocked: boolean;
  blocked_reason?: string; blocked_at?: string;
}

export interface CatalogVideo { id: string; chapter_id?: string; title: string; title_bn?: string; duration?: string; size_mb?: number; display_order?: number; telegram_message_id?: number; is_active?: boolean; source_type?: 'telegram' | 'youtube' | 'drive'; youtube_video_id?: string; drive_file_id?: string; }
export interface CatalogChapter { id: string; cycle_id?: string; name: string; name_bn?: string; requires_enrollment: boolean; display_order: number; videos: CatalogVideo[]; }
export interface CatalogCycle { id: string; name: string; name_bn?: string; display_order: number; telegram_channel_id?: string; chapters: CatalogChapter[]; }
export interface CatalogSubject { id: string; name: string; name_bn?: string; slug: string; thumbnail_color?: string; color?: string; description?: string; display_order: number; cycles: CatalogCycle[]; }
export interface CatalogData { subjects: CatalogSubject[]; total_videos: number; }
