export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      backlog: {
        Row: {
          created_at: string
          id: number
          note: string
          state: string
          translation: string
          user_id: string
          word: string
        }
        Insert: {
          created_at?: string
          id?: never
          note?: string
          state?: string
          translation: string
          user_id: string
          word: string
        }
        Update: {
          created_at?: string
          id?: never
          note?: string
          state?: string
          translation?: string
          user_id?: string
          word?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          difficulty: number
          due: string
          elapsed_days: number
          lapses: number
          last_review: string | null
          learning_steps: number
          reps: number
          scheduled_days: number
          stability: number
          state: number
          updated_at: string
          user_id: string
          word_id: string
        }
        Insert: {
          difficulty?: number
          due?: string
          elapsed_days?: number
          lapses?: number
          last_review?: string | null
          learning_steps?: number
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          updated_at?: string
          user_id: string
          word_id: string
        }
        Update: {
          difficulty?: number
          due?: string
          elapsed_days?: number
          lapses?: number
          last_review?: string | null
          learning_steps?: number
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          updated_at?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          context: Json | null
          created_at: string
          id: number
          message: string
          resolved_at: string | null
          snapshot: Json
          user_id: string
          word_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: never
          message: string
          resolved_at?: string | null
          snapshot?: Json
          user_id: string
          word_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: never
          message?: string
          resolved_at?: string | null
          snapshot?: Json
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          nickname: string
          updated_at: string
          user_id: string
        }
        Insert: {
          nickname?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          nickname?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          answered_correctly: boolean | null
          answered_genus: string | null
          difficulty: number | null
          duration_ms: number | null
          elapsed_days: number | null
          id: number
          rating: number
          reviewed_at: string
          scheduled_days: number | null
          stability: number | null
          state: number
          user_id: string
          word_id: string
        }
        Insert: {
          answered_correctly?: boolean | null
          answered_genus?: string | null
          difficulty?: number | null
          duration_ms?: number | null
          elapsed_days?: number | null
          id?: never
          rating: number
          reviewed_at?: string
          scheduled_days?: number | null
          stability?: number | null
          state: number
          user_id: string
          word_id: string
        }
        Update: {
          answered_correctly?: boolean | null
          answered_genus?: string | null
          difficulty?: number | null
          duration_ms?: number | null
          elapsed_days?: number | null
          id?: never
          rating?: number
          reviewed_at?: string
          scheduled_days?: number | null
          stability?: number | null
          state?: number
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          ask_genus: boolean
          daily_new_limit: number
          desired_retention: number
          include_drafts: boolean
          input_forms: boolean
          input_noun_plural: boolean
          input_noun_singular: boolean
          input_other: boolean
          input_verb_forms: boolean
          input_verb_infinitive: boolean
          known_interval_days: number
          learn_rankless_only: boolean
          learn_sources: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          ask_genus?: boolean
          daily_new_limit?: number
          desired_retention?: number
          include_drafts?: boolean
          input_forms?: boolean
          input_noun_plural?: boolean
          input_noun_singular?: boolean
          input_other?: boolean
          input_verb_forms?: boolean
          input_verb_infinitive?: boolean
          known_interval_days?: number
          learn_rankless_only?: boolean
          learn_sources?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          ask_genus?: boolean
          daily_new_limit?: number
          desired_retention?: number
          include_drafts?: boolean
          input_forms?: boolean
          input_noun_plural?: boolean
          input_noun_singular?: boolean
          input_other?: boolean
          input_verb_forms?: boolean
          input_verb_infinitive?: boolean
          known_interval_days?: number
          learn_rankless_only?: boolean
          learn_sources?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      word_edits: {
        Row: {
          batch: string
          created_at: string
          disputed: boolean
          field: string
          id: number
          new_value: string | null
          note: string | null
          old_value: string | null
          reason: string
          reverted_at: string | null
          word_id: string
        }
        Insert: {
          batch: string
          created_at?: string
          disputed?: boolean
          field: string
          id?: number
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          reason: string
          reverted_at?: string | null
          word_id: string
        }
        Update: {
          batch?: string
          created_at?: string
          disputed?: boolean
          field?: string
          id?: number
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          reason?: string
          reverted_at?: string | null
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_edits_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      word_marks: {
        Row: {
          created_at: string
          mark: string
          user_id: string
          word_id: string
        }
        Insert: {
          created_at?: string
          mark: string
          user_id: string
          word_id: string
        }
        Update: {
          created_at?: string
          mark?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_marks_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      words: {
        Row: {
          audio_comparative: string | null
          audio_du: string | null
          audio_er: string | null
          audio_head: string | null
          audio_ich: string | null
          audio_ihr: string | null
          audio_plural: string | null
          audio_superlative: string | null
          audio_wir: string | null
          confirmed_at: string | null
          corpus_share: number
          created_at: string
          created_by: string | null
          definition: string
          examples_de: string[]
          examples_ru: string[]
          form_du: string | null
          form_er: string | null
          form_ich: string | null
          form_ihr: string | null
          form_labels: string[]
          form_wir: string | null
          forms: string[]
          frequency: number
          genus: string | null
          head: string
          id: string
          ipa: string
          komparativ: string | null
          plural: string | null
          plural_ending: string | null
          pos: string
          pronunciation_ru: string
          rank: number | null
          register: string | null
          rektion: string[]
          rule_genus: string | null
          rule_label: string
          rule_status: string
          separable_prefix: string | null
          singular: string | null
          stress_infinitive: string | null
          stress_plural: string | null
          stress_singular: string | null
          stress_word: string | null
          suffix: string | null
          superlativ: string | null
          translation: string
          wortart: string | null
        }
        Insert: {
          audio_comparative?: string | null
          audio_du?: string | null
          audio_er?: string | null
          audio_head?: string | null
          audio_ich?: string | null
          audio_ihr?: string | null
          audio_plural?: string | null
          audio_superlative?: string | null
          audio_wir?: string | null
          confirmed_at?: string | null
          corpus_share?: number
          created_at?: string
          created_by?: string | null
          definition?: string
          examples_de?: string[]
          examples_ru?: string[]
          form_du?: string | null
          form_er?: string | null
          form_ich?: string | null
          form_ihr?: string | null
          form_labels?: string[]
          form_wir?: string | null
          forms?: string[]
          frequency?: number
          genus?: string | null
          head: string
          id: string
          ipa?: string
          komparativ?: string | null
          plural?: string | null
          plural_ending?: string | null
          pos: string
          pronunciation_ru?: string
          rank?: number | null
          register?: string | null
          rektion?: string[]
          rule_genus?: string | null
          rule_label?: string
          rule_status?: string
          separable_prefix?: string | null
          singular?: string | null
          stress_infinitive?: string | null
          stress_plural?: string | null
          stress_singular?: string | null
          stress_word?: string | null
          suffix?: string | null
          superlativ?: string | null
          translation: string
          wortart?: string | null
        }
        Update: {
          audio_comparative?: string | null
          audio_du?: string | null
          audio_er?: string | null
          audio_head?: string | null
          audio_ich?: string | null
          audio_ihr?: string | null
          audio_plural?: string | null
          audio_superlative?: string | null
          audio_wir?: string | null
          confirmed_at?: string | null
          corpus_share?: number
          created_at?: string
          created_by?: string | null
          definition?: string
          examples_de?: string[]
          examples_ru?: string[]
          form_du?: string | null
          form_er?: string | null
          form_ich?: string | null
          form_ihr?: string | null
          form_labels?: string[]
          form_wir?: string | null
          forms?: string[]
          frequency?: number
          genus?: string | null
          head?: string
          id?: string
          ipa?: string
          komparativ?: string | null
          plural?: string | null
          plural_ending?: string | null
          pos?: string
          pronunciation_ru?: string
          rank?: number | null
          register?: string | null
          rektion?: string[]
          rule_genus?: string | null
          rule_label?: string
          rule_status?: string
          separable_prefix?: string | null
          singular?: string | null
          stress_infinitive?: string | null
          stress_plural?: string | null
          stress_singular?: string | null
          stress_word?: string | null
          suffix?: string | null
          superlativ?: string | null
          translation?: string
          wortart?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      word_edits_view: {
        Row: {
          batch: string | null
          created_at: string | null
          definition: string | null
          disputed: boolean | null
          field: string | null
          head: string | null
          id: number | null
          is_draft: boolean | null
          new_value: string | null
          note: string | null
          old_value: string | null
          pos: string | null
          rank: number | null
          reason: string | null
          register: string | null
          reverted_at: string | null
          superseded: boolean | null
          translation: string | null
          word_id: string | null
          wortart: string | null
        }
        Relationships: [
          {
            foreignKeyName: "word_edits_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_word: { Args: { p_word: Json }; Returns: string }
      delete_word: { Args: { p_id: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      learn_queue: {
        Args: { p_limit?: number; p_new_limit?: number }
        Returns: Json
      }
      like_escape: { Args: { p_query: string }; Returns: string }
      mark_known: { Args: { p_word_id: string }; Returns: string }
      progress_summary: { Args: never; Returns: Json }
      reset_all_progress: { Args: never; Returns: Json }
      revert_word_edit: { Args: { p_edit: number }; Returns: undefined }
      stats_summary: { Args: { p_tz?: string }; Returns: Json }
      translation_neighbours: {
        Args: { p_exclude?: string; p_label: string; p_translation: string }
        Returns: Json
      }
      unmark_known: { Args: { p_word_id: string }; Returns: undefined }
      update_word: { Args: { p_id: string; p_patch: Json }; Returns: number }
      word_category: {
        Args: { p_pos: string; p_wortart: string }
        Returns: string
      }
      word_label: {
        Args: { p_pos: string; p_wortart: string }
        Returns: string
      }
      word_nests: { Args: { p_kind?: string }; Returns: Json }
      word_status: {
        Args: { card: Database["public"]["Tables"]["cards"]["Row"] }
        Returns: string
      }
      words_facets: { Args: never; Returns: Json }
      words_page: {
        Args: {
          p_draft?: boolean
          p_genus?: string[]
          p_limit?: number
          p_offset?: number
          p_own?: boolean
          p_pos?: string[]
          p_query?: string
          p_ranked?: boolean
          p_status?: string[]
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

