export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      item_adjustments: {
        Row: {
          actor_user_id: string
          created_at: string
          delta: number
          id: string
          new_quantity: number
          note: string | null
          previous_quantity: number
          project_item_id: string
          reason: Database['public']['Enums']['item_adjustment_reason']
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          delta: number
          id?: string
          new_quantity: number
          note?: string | null
          previous_quantity: number
          project_item_id: string
          reason?: Database['public']['Enums']['item_adjustment_reason']
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          delta?: number
          id?: string
          new_quantity?: number
          note?: string | null
          previous_quantity?: number
          project_item_id?: string
          reason?: Database['public']['Enums']['item_adjustment_reason']
        }
      }
      item_photos: {
        Row: {
          created_at: string
          created_by: string
          file_size_bytes: number | null
          mime_type: string | null
          project_item_id: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          file_size_bytes?: number | null
          mime_type?: string | null
          project_item_id: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          file_size_bytes?: number | null
          mime_type?: string | null
          project_item_id?: string
          storage_path?: string
          updated_at?: string
        }
      }
      item_tag_links: {
        Row: {
          created_at: string
          project_item_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          project_item_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          project_item_id?: string
          tag_id?: string
        }
      }
      item_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
      }
      project_items: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string
          currency_code: string
          id: string
          low_stock_threshold: number
          name: string
          notes: string | null
          project_id: string
          quantity: number
          storage_location: string | null
          suggested_item_id: string | null
          unit: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by: string
          currency_code?: string
          id?: string
          low_stock_threshold?: number
          name: string
          notes?: string | null
          project_id: string
          quantity?: number
          storage_location?: string | null
          suggested_item_id?: string | null
          unit?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string
          currency_code?: string
          id?: string
          low_stock_threshold?: number
          name?: string
          notes?: string | null
          project_id?: string
          quantity?: number
          storage_location?: string | null
          suggested_item_id?: string | null
          unit?: string
          updated_at?: string
          vendor?: string | null
        }
      }
      project_members: {
        Row: {
          created_at: string
          invited_by: string | null
          project_id: string
          role: Database['public']['Enums']['project_member_role']
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          project_id: string
          role?: Database['public']['Enums']['project_member_role']
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          project_id?: string
          role?: Database['public']['Enums']['project_member_role']
          user_id?: string
        }
      }
      project_types: {
        Row: {
          created_at: string
          description: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description: string
          id: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          label?: string
          sort_order?: number
        }
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          project_type_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          project_type_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          project_type_id?: string | null
          updated_at?: string
        }
      }
      suggested_items: {
        Row: {
          created_at: string
          default_unit: string
          description: string | null
          id: string
          name: string
          project_type_id: string
        }
        Insert: {
          created_at?: string
          default_unit: string
          description?: string | null
          id: string
          name: string
          project_type_id: string
        }
        Update: {
          created_at?: string
          default_unit?: string
          description?: string | null
          id?: string
          name?: string
          project_type_id?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      adjust_project_item_quantity: {
        Args: {
          adjustment_note?: string | null
          adjustment_reason?: Database['public']['Enums']['item_adjustment_reason']
          delta_value: number
          project_item_uuid: string
        }
        Returns: Database['public']['Tables']['project_items']['Row']
      }
      can_edit_project: {
        Args: {
          project_uuid: string
          user_uuid?: string | null
        }
        Returns: boolean
      }
      can_edit_project_item: {
        Args: {
          project_item_uuid: string
          user_uuid?: string | null
        }
        Returns: boolean
      }
      can_read_project_item: {
        Args: {
          project_item_uuid: string
          user_uuid?: string | null
        }
        Returns: boolean
      }
      can_view_owner_tags: {
        Args: {
          owner_uuid: string
          user_uuid?: string | null
        }
        Returns: boolean
      }
      can_view_profile: {
        Args: {
          target_user_uuid: string
          requester_uuid?: string | null
        }
        Returns: boolean
      }
      create_project_item_with_tags: {
        Args: {
          existing_tag_ids?: string[] | null
          item_cost?: number | null
          item_low_stock_threshold?: number
          item_name: string
          item_notes?: string | null
          item_quantity?: number
          item_storage_location?: string | null
          item_unit?: string
          item_vendor?: string | null
          new_tag_names?: string[] | null
          project_uuid: string
          suggested_item_key?: string | null
        }
        Returns: string
      }
      update_project_item_with_tags: {
        Args: {
          existing_tag_ids?: string[] | null
          item_cost?: number | null
          item_low_stock_threshold?: number
          item_name: string
          item_notes?: string | null
          item_quantity?: number
          item_storage_location?: string | null
          item_unit?: string
          item_vendor?: string | null
          new_tag_names?: string[] | null
          project_item_uuid: string
          suggested_item_key?: string | null
        }
        Returns: string
      }
      is_project_member: {
        Args: {
          project_uuid: string
          user_uuid?: string | null
        }
        Returns: boolean
      }
      is_project_owner: {
        Args: {
          project_uuid: string
          user_uuid?: string | null
        }
        Returns: boolean
      }
      storage_project_id: {
        Args: {
          object_name: string
        }
        Returns: string | null
      }
      users_share_project: {
        Args: {
          left_user_uuid: string
          right_user_uuid: string
        }
        Returns: boolean
      }
    }
    Enums: {
      item_adjustment_reason: 'restock' | 'usage' | 'correction' | 'inventory_count' | 'other'
      project_member_role: 'owner' | 'editor' | 'viewer'
    }
    CompositeTypes: Record<string, never>
  }
}
