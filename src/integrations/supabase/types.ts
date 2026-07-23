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
      event_settings: {
        Row: {
          allow_guest_uploads: boolean
          allow_memories: boolean
          allow_messages: boolean
          allow_rsvp: boolean
          created_at: string
          event_id: string
          moderate_messages: boolean
          moderate_photos: boolean
          music_url: string | null
          slideshow_duration_seconds: number
          updated_at: string
        }
        Insert: {
          allow_guest_uploads?: boolean
          allow_memories?: boolean
          allow_messages?: boolean
          allow_rsvp?: boolean
          created_at?: string
          event_id: string
          moderate_messages?: boolean
          moderate_photos?: boolean
          music_url?: string | null
          slideshow_duration_seconds?: number
          updated_at?: string
        }
        Update: {
          allow_guest_uploads?: boolean
          allow_memories?: boolean
          allow_messages?: boolean
          allow_rsvp?: boolean
          created_at?: string
          event_id?: string
          moderate_messages?: boolean
          moderate_photos?: boolean
          music_url?: string | null
          slideshow_duration_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_visits: {
        Row: {
          event_id: string
          guest_id: string | null
          id: string
          visited_at: string
        }
        Insert: {
          event_id: string
          guest_id?: string | null
          id?: string
          visited_at?: string
        }
        Update: {
          event_id?: string
          guest_id?: string | null
          id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_visits_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_visits_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          event_type: string | null
          id: string
          latitude: number | null
          location_address: string | null
          location_name: string | null
          longitude: number | null
          owner_id: string
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          theme_color: string | null
          timezone: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_type?: string | null
          id?: string
          latitude?: number | null
          location_address?: string | null
          location_name?: string | null
          longitude?: number | null
          owner_id: string
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          theme_color?: string | null
          timezone?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_type?: string | null
          id?: string
          latitude?: number | null
          location_address?: string | null
          location_name?: string | null
          longitude?: number | null
          owner_id?: string
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          theme_color?: string | null
          timezone?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      gallery: {
        Row: {
          ai_score: number | null
          caption: string | null
          created_at: string
          event_id: string
          featured: boolean
          guest_id: string | null
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          moderation: Database["public"]["Enums"]["moderation_status"]
          public_url: string
          storage_path: string
          uploaded_by_owner: boolean
          width: number | null
        }
        Insert: {
          ai_score?: number | null
          caption?: string | null
          created_at?: string
          event_id: string
          featured?: boolean
          guest_id?: string | null
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          moderation?: Database["public"]["Enums"]["moderation_status"]
          public_url: string
          storage_path: string
          uploaded_by_owner?: boolean
          width?: number | null
        }
        Update: {
          ai_score?: number | null
          caption?: string | null
          created_at?: string
          event_id?: string
          featured?: boolean
          guest_id?: string | null
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          moderation?: Database["public"]["Enums"]["moderation_status"]
          public_url?: string
          storage_path?: string
          uploaded_by_owner?: boolean
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_reactions: {
        Row: {
          created_at: string
          emoji: string
          gallery_id: string
          guest_id: string | null
          id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          gallery_id: string
          guest_id?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          emoji?: string
          gallery_id?: string
          guest_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_reactions_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "gallery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_reactions_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          avatar_url: string | null
          created_at: string
          device_token: string
          event_id: string
          first_name: string
          id: string
          last_name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          device_token: string
          event_id: string
          first_name: string
          id?: string
          last_name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          device_token?: string
          event_id?: string
          first_name?: string
          id?: string
          last_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          author_name: string
          created_at: string
          event_id: string
          guest_id: string | null
          id: string
          media_kind: Database["public"]["Enums"]["media_kind"] | null
          media_url: string | null
          moderation: Database["public"]["Enums"]["moderation_status"]
          text_content: string | null
        }
        Insert: {
          author_name: string
          created_at?: string
          event_id: string
          guest_id?: string | null
          id?: string
          media_kind?: Database["public"]["Enums"]["media_kind"] | null
          media_url?: string | null
          moderation?: Database["public"]["Enums"]["moderation_status"]
          text_content?: string | null
        }
        Update: {
          author_name?: string
          created_at?: string
          event_id?: string
          guest_id?: string | null
          id?: string
          media_kind?: Database["public"]["Enums"]["media_kind"] | null
          media_url?: string | null
          moderation?: Database["public"]["Enums"]["moderation_status"]
          text_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_name: string
          body: string
          created_at: string
          emoji: string | null
          event_id: string
          featured: boolean
          guest_id: string | null
          id: string
          moderation: Database["public"]["Enums"]["moderation_status"]
        }
        Insert: {
          author_name: string
          body: string
          created_at?: string
          emoji?: string | null
          event_id: string
          featured?: boolean
          guest_id?: string | null
          id?: string
          moderation?: Database["public"]["Enums"]["moderation_status"]
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          emoji?: string | null
          event_id?: string
          featured?: boolean
          guest_id?: string | null
          id?: string
          moderation?: Database["public"]["Enums"]["moderation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rsvps: {
        Row: {
          adults: number
          children: number
          created_at: string
          dietary: string | null
          dietary_items: Json | null
          event_id: string
          full_name: string
          guest_id: string | null
          id: string
          note: string | null
          status: Database["public"]["Enums"]["rsvp_status"]
          table_id: string | null
          updated_at: string
        }
        Insert: {
          adults?: number
          children?: number
          created_at?: string
          dietary?: string | null
          dietary_items: Json | null
          event_id: string
          full_name: string
          guest_id?: string | null
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
          table_id?: string | null
          updated_at?: string
        }
        Update: {
          adults?: number
          children?: number
          created_at?: string
          dietary?: string | null
          dietary_items: Json | null
          event_id?: string
          full_name?: string
          guest_id?: string | null
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
          table_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "event_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tables: {
        Row: {
          capacity: number
          color: string | null
          created_at: string
          description: string | null
          event_id: string
          id: string
          name: string
          number: number | null
          position_x: number
          position_y: number
          updated_at: string
        }
        Insert: {
          capacity?: number
          color?: string | null
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          name: string
          number?: number | null
          position_x?: number
          position_y?: number
          updated_at?: string
        }
        Update: {
          capacity?: number
          color?: string | null
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          number?: number | null
          position_x?: number
          position_y?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      slideshow_items: {
        Row: {
          gallery_id: string
          id: string
          position: number
          slideshow_id: string
        }
        Insert: {
          gallery_id: string
          id?: string
          position?: number
          slideshow_id: string
        }
        Update: {
          gallery_id?: string
          id?: string
          position?: number
          slideshow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slideshow_items_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "gallery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slideshow_items_slideshow_id_fkey"
            columns: ["slideshow_id"]
            isOneToOne: false
            referencedRelation: "slideshows"
            referencedColumns: ["id"]
          },
        ]
      }
      slideshows: {
        Row: {
          auto_generated: boolean
          created_at: string
          duration_seconds: number
          event_id: string
          id: string
          music_url: string | null
          name: string
          transition: string | null
          updated_at: string
        }
        Insert: {
          auto_generated?: boolean
          created_at?: string
          duration_seconds?: number
          event_id: string
          id?: string
          music_url?: string | null
          name?: string
          transition?: string | null
          updated_at?: string
        }
        Update: {
          auto_generated?: boolean
          created_at?: string
          duration_seconds?: number
          event_id?: string
          id?: string
          music_url?: string | null
          name?: string
          transition?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slideshows_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          event_id: string
          format: string
          id: string
          status: string
          style: string
          thumbnail_url: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          event_id: string
          format?: string
          id?: string
          status?: string
          style: string
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          event_id?: string
          format?: string
          id?: string
          status?: string
          style?: string
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      event_accepts_public: { Args: { _event_id: string }; Returns: boolean }
      is_event_owner: { Args: { _event_id: string }; Returns: boolean }
    }
    Enums: {
      event_status: "draft" | "published" | "live" | "finished" | "archived"
      media_kind: "photo" | "video" | "audio"
      moderation_status: "pending" | "approved" | "rejected"
      rsvp_status: "confirmed" | "declined" | "pending"
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
      event_status: ["draft", "published", "live", "finished", "archived"],
      media_kind: ["photo", "video", "audio"],
      moderation_status: ["pending", "approved", "rejected"],
      rsvp_status: ["confirmed", "declined", "pending"],
    },
  },
} as const
