export type AppRole = "admin" | "user";

export interface Profile {
  id: string;
  email: string;
  display_name?: string | null;
  role: AppRole;
  is_enrolled?: boolean;
  is_blocked?: boolean;
  avatar_url?: string | null;
  phone?: string | null;
  created_at?: string;
}

export interface Subject {
  id: string; name: string; name_bn: string | null; slug: string;
  icon: string | null; color: string | null;
  display_order: number; is_active: boolean;
  created_at?: string;
}

export interface Cycle {
  id: string; subject_id: string; name: string; name_bn: string | null;
  display_order: number; is_active: boolean;
}

export interface Chapter {
  id: string; cycle_id: string; name: string; name_bn: string | null;
  slug: string | null; description: string | null;
  requires_enrollment: boolean; display_order: number; is_active: boolean;
}

export interface Video {
  id: string; chapter_id: string; title: string; title_bn: string | null;
  source_type: "telegram" | "youtube" | "drive";
  telegram_channel_id: string | null;
  telegram_message_id: string | null;
  youtube_id: string | null;
  drive_file_id: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  display_order: number; is_active: boolean;
  size_mb: number | null;
}

export interface WatchHistoryRow {
  id: string; user_id: string; video_id: string;
  progress_seconds: number; completed: boolean;
  updated_at: string; watched_at: string;
}

export interface VideoNote {
  id: string; user_id: string; video_id: string;
  content: string; updated_at: string; created_at: string;
}

export interface VideoBookmark {
  id: string; user_id: string; video_id: string;
  timestamp_seconds: number; label: string | null; created_at: string;
}

export interface EnrollmentCode {
  id: string; code: string; chapter_id: string | null;
  max_uses: number; uses_count: number; is_active: boolean;
  expires_at: string | null; created_by: string | null; created_at: string;
}

export interface ChapterAccessRow {
  id: string; user_id: string; chapter_id: string;
  device_fingerprint: string | null; ip_address: string | null;
  granted_at: string; code_used: string | null;
}

export interface ActivityLog {
  id: string; user_id: string | null; action: string;
  metadata: Record<string, unknown>; created_at: string;
  ip_address: string | null; user_agent: string | null;
}

export interface Announcement {
  id: string; title: string; content: string | null;
  is_pinned: boolean; is_active: boolean;
  created_at: string; created_by: string | null;
}

export interface Notification {
  id: string; user_id: string; title: string; message: string | null;
  type: string; is_read: boolean; created_at: string; action_url: string | null;
}

export interface LiveClass {
  id: string; title: string; description: string | null;
  start_time: string; end_time: string | null;
  join_url: string | null; is_active: boolean;
  subject_id: string | null; created_by: string | null;
}

export interface CycleCompletion {
  id: string; user_id: string; cycle_id: string; completed_at: string;
}

export interface Quiz {
  id: string; title: string; chapter_id: string;
  time_limit_seconds: number | null; is_active: boolean;
}

export interface QuizQuestion {
  id: string; quiz_id: string; question: string;
  options: string[]; correct_idx: number;
  explanation: string | null; order_index: number;
}

export interface QuizAttempt {
  id: string; user_id: string; quiz_id: string;
  score: number; answers: Record<string, unknown>;
  started_at: string; completed_at: string | null;
}

export interface QaQuestion {
  id: string; user_id: string; chapter_id: string;
  title: string; body: string | null; created_at: string;
  is_answered: boolean; votes: number;
}

export interface QaAnswer {
  id: string; question_id: string; user_id: string;
  body: string; created_at: string;
  is_accepted: boolean; votes: number;
}
