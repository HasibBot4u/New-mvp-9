export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string | null
          body_bn: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          is_pinned: boolean
          title: string
          title_bn: string | null
          type: string
        }
        Insert: {
          body?: string | null
          body_bn?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_pinned?: boolean
          title: string
          title_bn?: string | null
          type?: string
        }
        Update: {
          body?: string | null
          body_bn?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_pinned?: boolean
          title?: string
          title_bn?: string | null
          type?: string
        }
        Relationships: []
      }
      chapter_access: {
        Row: {
          access_count: number
          blocked_reason: string | null
          chapter_id: string
          device_fingerprint: string | null
          device_user_agent: string | null
          enrollment_code_id: string | null
          first_accessed_at: string
          id: string
          is_blocked: boolean
          last_accessed_at: string
          user_id: string
        }
        Insert: {
          access_count?: number
          blocked_reason?: string | null
          chapter_id: string
          device_fingerprint?: string | null
          device_user_agent?: string | null
          enrollment_code_id?: string | null
          first_accessed_at?: string
          id?: string
          is_blocked?: boolean
          last_accessed_at?: string
          user_id: string
        }
        Update: {
          access_count?: number
          blocked_reason?: string | null
          chapter_id?: string
          device_fingerprint?: string | null
          device_user_agent?: string | null
          enrollment_code_id?: string | null
          first_accessed_at?: string
          id?: string
          is_blocked?: boolean
          last_accessed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_access_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_access_enrollment_code_id_fkey"
            columns: ["enrollment_code_id"]
            isOneToOne: false
            referencedRelation: "enrollment_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          created_at: string
          cycle_id: string
          description: string | null
          description_bn: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          name_bn: string | null
          requires_enrollment: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          description?: string | null
          description_bn?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          name_bn?: string | null
          requires_enrollment?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          description?: string | null
          description_bn?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          name_bn?: string | null
          requires_enrollment?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_completions: {
        Row: {
          completed_at: string | null
          cycle_id: string
          id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          cycle_id: string
          id?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          cycle_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_completions_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          created_at: string
          description: string | null
          description_bn: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          name_bn: string | null
          subject_id: string
          telegram_channel_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_bn?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          name_bn?: string | null
          subject_id: string
          telegram_channel_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_bn?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          name_bn?: string | null
          subject_id?: string
          telegram_channel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycles_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_codes: {
        Row: {
          chapter_id: string
          code: string
          created_by: string | null
          expires_at: string | null
          generated_at: string
          generated_by: string | null
          id: string
          is_active: boolean
          label: string | null
          max_uses: number
          notes: string | null
          uses_count: number
        }
        Insert: {
          chapter_id: string
          code: string
          created_by?: string | null
          expires_at?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          max_uses?: number
          notes?: string | null
          uses_count?: number
        }
        Update: {
          chapter_id?: string
          code?: string
          created_by?: string | null
          expires_at?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          max_uses?: number
          notes?: string | null
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_codes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      live_classes: {
        Row: {
          created_at: string
          cycle_id: string | null
          description: string | null
          description_bn: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          is_cancelled: boolean
          is_completed: boolean
          meeting_url: string | null
          scheduled_at: string
          stream_url: string | null
          subject_id: string | null
          title: string
          title_bn: string | null
        }
        Insert: {
          created_at?: string
          cycle_id?: string | null
          description?: string | null
          description_bn?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          is_cancelled?: boolean
          is_completed?: boolean
          meeting_url?: string | null
          scheduled_at: string
          stream_url?: string | null
          subject_id?: string | null
          title: string
          title_bn?: string | null
        }
        Update: {
          created_at?: string
          cycle_id?: string | null
          description?: string | null
          description_bn?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          is_cancelled?: boolean
          is_completed?: boolean
          meeting_url?: string | null
          scheduled_at?: string
          stream_url?: string | null
          subject_id?: string | null
          title?: string
          title_bn?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_classes_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          body_bn: string | null
          created_at: string
          id: string
          is_read: boolean
          title: string
          title_bn: string | null
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          body_bn?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          title: string
          title_bn?: string | null
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          body_bn?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          title?: string
          title_bn?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_blocked: boolean
          last_active_at: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          is_blocked?: boolean
          last_active_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_blocked?: boolean
          last_active_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qa_answers: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_accepted: boolean | null
          question_id: string
          user_id: string
          votes: number | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_accepted?: boolean | null
          question_id: string
          user_id: string
          votes?: number | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_accepted?: boolean | null
          question_id?: string
          user_id?: string
          votes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "qa_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_questions: {
        Row: {
          body: string
          chapter_id: string | null
          created_at: string | null
          id: string
          is_answered: boolean | null
          title: string
          user_id: string
          votes: number | null
        }
        Insert: {
          body: string
          chapter_id?: string | null
          created_at?: string | null
          id?: string
          is_answered?: boolean | null
          title: string
          user_id: string
          votes?: number | null
        }
        Update: {
          body?: string
          chapter_id?: string | null
          created_at?: string | null
          id?: string
          is_answered?: boolean | null
          title?: string
          user_id?: string
          votes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          completed_at: string | null
          id: string
          quiz_id: string
          score: number
          started_at: string | null
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          id?: string
          quiz_id: string
          score?: number
          started_at?: string | null
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          id?: string
          quiz_id?: string
          score?: number
          started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_idx: number
          explanation: string | null
          id: string
          options: Json
          order_index: number | null
          question: string
          quiz_id: string
        }
        Insert: {
          correct_idx: number
          explanation?: string | null
          id?: string
          options: Json
          order_index?: number | null
          question: string
          quiz_id: string
        }
        Update: {
          correct_idx?: number
          explanation?: string | null
          id?: string
          options?: Json
          order_index?: number | null
          question?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          chapter_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          time_limit_seconds: number | null
          title: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          time_limit_seconds?: number | null
          title: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          time_limit_seconds?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          description_bn: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          name_bn: string | null
          slug: string
          thumbnail_color: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          description_bn?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_bn?: string | null
          slug: string
          thumbnail_color?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          description_bn?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_bn?: string | null
          slug?: string
          thumbnail_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_bookmarks: {
        Row: {
          created_at: string | null
          id: string
          label: string | null
          timestamp_seconds: number
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label?: string | null
          timestamp_seconds?: number
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string | null
          timestamp_seconds?: number
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_bookmarks_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          chapter_id: string
          created_at: string
          description: string | null
          description_bn: string | null
          display_order: number
          drive_file_id: string | null
          duration: string | null
          id: string
          is_active: boolean
          size_mb: number | null
          source_type: string
          source_url: string | null
          telegram_channel_id: string | null
          telegram_message_id: number | null
          thumbnail_url: string | null
          title: string
          title_bn: string | null
          updated_at: string
          youtube_video_id: string | null
        }
        Insert: {
          chapter_id: string
          created_at?: string
          description?: string | null
          description_bn?: string | null
          display_order?: number
          drive_file_id?: string | null
          duration?: string | null
          id?: string
          is_active?: boolean
          size_mb?: number | null
          source_type?: string
          source_url?: string | null
          telegram_channel_id?: string | null
          telegram_message_id?: number | null
          thumbnail_url?: string | null
          title: string
          title_bn?: string | null
          updated_at?: string
          youtube_video_id?: string | null
        }
        Update: {
          chapter_id?: string
          created_at?: string
          description?: string | null
          description_bn?: string | null
          display_order?: number
          drive_file_id?: string | null
          duration?: string | null
          id?: string
          is_active?: boolean
          size_mb?: number | null
          source_type?: string
          source_url?: string | null
          telegram_channel_id?: string | null
          telegram_message_id?: number | null
          thumbnail_url?: string | null
          title?: string
          title_bn?: string | null
          updated_at?: string
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_history: {
        Row: {
          completed: boolean
          id: string
          progress_percent: number
          progress_seconds: number
          updated_at: string
          user_id: string
          video_id: string
          watch_count: number
          watched_at: string
        }
        Insert: {
          completed?: boolean
          id?: string
          progress_percent?: number
          progress_seconds?: number
          updated_at?: string
          user_id: string
          video_id: string
          watch_count?: number
          watched_at?: string
        }
        Update: {
          completed?: boolean
          id?: string
          progress_percent?: number
          progress_seconds?: number
          updated_at?: string
          user_id?: string
          video_id?: string
          watch_count?: number
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_history_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_stats: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      redeem_enrollment_code: {
        Args: { _code: string; _device_fingerprint?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
