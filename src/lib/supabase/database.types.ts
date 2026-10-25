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
    PostgrestVersion: "14.18"
  }
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
      ai_credit_accounts: {
        Row: {
          balance: number
          created_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_action_costs: {
        Row: {
          credits: number
          kind: string
          label: string
          minutes_saved: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          credits?: number
          kind: string
          label: string
          minutes_saved?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          credits?: number
          kind?: string
          label?: string
          minutes_saved?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
        ]
      }
      ai_credit_ledger: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string | null
          delta: number
          id: string
          kind: string
          metadata: Json
          note: string | null
          reference_id: string | null
          tenant_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          kind: string
          metadata?: Json
          note?: string | null
          reference_id?: string | null
          tenant_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          kind?: string
          metadata?: Json
          note?: string | null
          reference_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_credit_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_packs: {
        Row: {
          active: boolean
          code: string
          credits: number
          label: string
          price: number
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          code: string
          credits: number
          label: string
          price: number
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          credits?: number
          label?: string
          price?: number
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
        ]
      }
      ai_credit_promos: {
        Row: {
          active: boolean
          bonus_pct: number
          code: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          max_uses: number | null
          starts_at: string | null
          uses: number
        }
        Insert: {
          active?: boolean
          bonus_pct: number
          code: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          max_uses?: number | null
          starts_at?: string | null
          uses?: number
        }
        Update: {
          active?: boolean
          bonus_pct?: number
          code?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          max_uses?: number | null
          starts_at?: string | null
          uses?: number
        }
        Relationships: [
        ]
      }
      ai_credit_purchase_requests: {
        Row: {
          amount: number
          bonus_credits: number
          created_at: string
          credits: number
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          method: string
          pack: string
          payment_reference: string | null
          promo_code: string | null
          requested_by: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          amount: number
          bonus_credits?: number
          created_at?: string
          credits: number
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          method: string
          pack: string
          payment_reference?: string | null
          promo_code?: string | null
          requested_by?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          bonus_credits?: number
          created_at?: string
          credits?: number
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          method?: string
          pack?: string
          payment_reference?: string | null
          promo_code?: string | null
          requested_by?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_purchase_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_settings: {
        Row: {
          base_cost_per_credit: number
          critical_balance: number
          custom_credits_per_rupee: number
          custom_max: number
          custom_min: number
          freelancer_hourly: number
          id: number
          low_balance: number
          margin_multiplier: number
          updated_at: string
          updated_by: string | null
          welcome_credits: number
        }
        Insert: {
          base_cost_per_credit?: number
          critical_balance?: number
          custom_credits_per_rupee?: number
          custom_max?: number
          custom_min?: number
          freelancer_hourly?: number
          id?: number
          low_balance?: number
          margin_multiplier?: number
          updated_at?: string
          updated_by?: string | null
          welcome_credits?: number
        }
        Update: {
          base_cost_per_credit?: number
          critical_balance?: number
          custom_credits_per_rupee?: number
          custom_max?: number
          custom_min?: number
          freelancer_hourly?: number
          id?: number
          low_balance?: number
          margin_multiplier?: number
          updated_at?: string
          updated_by?: string | null
          welcome_credits?: number
        }
        Relationships: [
        ]
      }
      ai_feature_routes: {
        Row: {
          enabled: boolean
          fallback_model: string | null
          fallback_provider: string | null
          feature_key: string
          primary_model: string | null
          primary_provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          fallback_model?: string | null
          fallback_provider?: string | null
          feature_key: string
          primary_model?: string | null
          primary_provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          fallback_model?: string | null
          fallback_provider?: string | null
          feature_key?: string
          primary_model?: string | null
          primary_provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
        ]
      }
      ai_generations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          input: Json
          kind: string
          model: string | null
          output: Json
          provider: string
          tenant_id: string
          tokens: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          input?: Json
          kind: string
          model?: string | null
          output?: Json
          provider: string
          tenant_id: string
          tokens?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          input?: Json
          kind?: string
          model?: string | null
          output?: Json
          provider?: string
          tenant_id?: string
          tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_prices: {
        Row: {
          model: string
          price_per_million: number
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          model: string
          price_per_million: number
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          model?: string
          price_per_million?: number
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
        ]
      }
      analytics_events: {
        Row: {
          customer_id: string | null
          event_name: string
          id: number
          metadata: Json
          occurred_at: string
          order_id: string | null
          path: string | null
          product_id: string | null
          session_id: string | null
          tenant_id: string
          value: number | null
        }
        Insert: {
          customer_id?: string | null
          event_name: string
          id?: never
          metadata?: Json
          occurred_at?: string
          order_id?: string | null
          path?: string | null
          product_id?: string | null
          session_id?: string | null
          tenant_id: string
          value?: number | null
        }
        Update: {
          customer_id?: string | null
          event_name?: string
          id?: never
          metadata?: Json
          occurred_at?: string
          order_id?: string | null
          path?: string | null
          product_id?: string | null
          session_id?: string | null
          tenant_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_type: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          ip_hash: string | null
          metadata: Json
          request_id: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          ip_hash?: string | null
          metadata?: Json
          request_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          ip_hash?: string | null
          metadata?: Json
          request_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_name: string | null
          body: Json
          cover_path: string | null
          created_at: string
          created_by: string | null
          excerpt: string | null
          id: string
          published_at: string | null
          seo: Json
          slug: string
          status: string
          tags: string[]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          body?: Json
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          published_at?: string | null
          seo?: Json
          slug: string
          status?: string
          tags?: string[]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          body?: Json
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          published_at?: string | null
          seo?: Json
          slug?: string
          status?: string
          tags?: string[]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_profiles: {
        Row: {
          audience: string | null
          donts: string | null
          dos: string | null
          keywords: string[]
          languages: string[]
          tenant_id: string
          updated_at: string
          voice: string | null
        }
        Insert: {
          audience?: string | null
          donts?: string | null
          dos?: string | null
          keywords?: string[]
          languages?: string[]
          tenant_id: string
          updated_at?: string
          voice?: string | null
        }
        Update: {
          audience?: string | null
          donts?: string | null
          dos?: string | null
          keywords?: string[]
          languages?: string[]
          tenant_id?: string
          updated_at?: string
          voice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          quantity: number
          saved_for_later: boolean
          tenant_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          quantity: number
          saved_for_later?: boolean
          tenant_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          quantity?: number
          saved_for_later?: boolean
          tenant_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_tenant_id_cart_id_fkey"
            columns: ["tenant_id", "cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "cart_items_tenant_id_variant_id_fkey"
            columns: ["tenant_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          customer_id: string | null
          discount_code: string | null
          email: string | null
          expires_at: string
          id: string
          note: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          discount_code?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          note?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          discount_code?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          note?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_tenant_id_customer_id_fkey"
            columns: ["tenant_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "carts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          name: string
          parent_id: string | null
          position: number
          seo: Json
          slug: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name: string
          parent_id?: string | null
          position?: number
          seo?: Json
          slug: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name?: string
          parent_id?: string | null
          position?: number
          seo?: Json
          slug?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tenant_id_parent_id_fkey"
            columns: ["tenant_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      collection_products: {
        Row: {
          collection_id: string
          position: number
          product_id: string
          tenant_id: string
        }
        Insert: {
          collection_id: string
          position?: number
          product_id: string
          tenant_id: string
        }
        Update: {
          collection_id?: string
          position?: number
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_products_tenant_id_collection_id_fkey"
            columns: ["tenant_id", "collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "collection_products_tenant_id_product_id_fkey"
            columns: ["tenant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          position: number
          published_at: string | null
          rules: Json
          seo: Json
          slug: string
          sort_order: string
          status: string
          tenant_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          position?: number
          published_at?: string | null
          rules?: Json
          seo?: Json
          slug: string
          sort_order?: string
          status?: string
          tenant_id: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          position?: number
          published_at?: string | null
          rules?: Json
          seo?: Json
          slug?: string
          sort_order?: string
          status?: string
          tenant_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_invoices: {
        Row: {
          commission: number
          created_at: string
          created_by: string | null
          due_date: string
          gmv: number
          id: string
          invoice_number: string
          paid_at: string | null
          paid_via: string | null
          payment_reference: string | null
          period_end: string
          period_start: string
          rate_bps: number
          status: string
          tenant_id: string
          updated_at: string
          waive_reason: string | null
        }
        Insert: {
          commission: number
          created_at?: string
          created_by?: string | null
          due_date: string
          gmv: number
          id?: string
          invoice_number: string
          paid_at?: string | null
          paid_via?: string | null
          payment_reference?: string | null
          period_end: string
          period_start: string
          rate_bps: number
          status?: string
          tenant_id: string
          updated_at?: string
          waive_reason?: string | null
        }
        Update: {
          commission?: number
          created_at?: string
          created_by?: string | null
          due_date?: string
          gmv?: number
          id?: string
          invoice_number?: string
          paid_at?: string | null
          paid_via?: string | null
          payment_reference?: string | null
          period_end?: string
          period_start?: string
          rate_bps?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          waive_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          subject: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          subject?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          subject?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_templates: {
        Row: {
          active: boolean
          category: string
          created_at: string
          elements: Json
          height: number
          id: string
          key: string
          name: string
          version: number
          width: number
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          elements: Json
          height: number
          id?: string
          key: string
          name: string
          version?: number
          width: number
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          elements?: Json
          height?: number
          id?: string
          key?: string
          name?: string
          version?: number
          width?: number
        }
        Relationships: []
      }
      creatives: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          output_path: string | null
          template_key: string
          template_version: number
          tenant_id: string
          updated_at: string
          values: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          output_path?: string | null
          template_key: string
          template_version: number
          tenant_id: string
          updated_at?: string
          values?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          output_path?: string | null
          template_key?: string
          template_version?: number
          tenant_id?: string
          updated_at?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "creatives_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string | null
          landmark: string | null
          line1: string
          line2: string | null
          name: string
          phone: string
          postal_code: string
          state: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          line1: string
          line2?: string | null
          name: string
          phone: string
          postal_code: string
          state: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          line1?: string
          line2?: string | null
          name?: string
          phone?: string
          postal_code?: string
          state?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_tenant_id_customer_id_fkey"
            columns: ["tenant_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      customer_whatsapp_optins: {
        Row: {
          consent_text: string | null
          consented_at: string | null
          created_at: string
          customer_id: string | null
          id: string
          opted_in: boolean
          order_id: string | null
          phone: string
          revoked_at: string | null
          source: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          consent_text?: string | null
          consented_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          opted_in?: boolean
          order_id?: string | null
          phone: string
          revoked_at?: string | null
          source: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          consent_text?: string | null
          consented_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          opted_in?: boolean
          order_id?: string | null
          phone?: string
          revoked_at?: string | null
          source?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_whatsapp_optins_tenant_id_customer_id_fkey"
            columns: ["tenant_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "customer_whatsapp_optins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          accepts_marketing: boolean
          attribution: Json
          auth_user_id: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          last_order_at: string | null
          marketing_consent_at: string | null
          note: string | null
          orders_count: number
          phone: string | null
          status: string
          tags: string[]
          tenant_id: string
          total_spent: number
          updated_at: string
        }
        Insert: {
          accepts_marketing?: boolean
          attribution?: Json
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_order_at?: string | null
          marketing_consent_at?: string | null
          note?: string | null
          orders_count?: number
          phone?: string | null
          status?: string
          tags?: string[]
          tenant_id: string
          total_spent?: number
          updated_at?: string
        }
        Update: {
          accepts_marketing?: boolean
          attribution?: Json
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_order_at?: string | null
          marketing_consent_at?: string | null
          note?: string | null
          orders_count?: number
          phone?: string | null
          status?: string
          tags?: string[]
          tenant_id?: string
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_collections: {
        Row: {
          collection_id: string
          discount_id: string
          tenant_id: string
        }
        Insert: {
          collection_id: string
          discount_id: string
          tenant_id: string
        }
        Update: {
          collection_id?: string
          discount_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_collections_tenant_id_collection_id_fkey"
            columns: ["tenant_id", "collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "discount_collections_tenant_id_discount_id_fkey"
            columns: ["tenant_id", "discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      discount_products: {
        Row: {
          discount_id: string
          product_id: string
          tenant_id: string
        }
        Insert: {
          discount_id: string
          product_id: string
          tenant_id: string
        }
        Update: {
          discount_id?: string
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_products_tenant_id_discount_id_fkey"
            columns: ["tenant_id", "discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "discount_products_tenant_id_product_id_fkey"
            columns: ["tenant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      discount_usages: {
        Row: {
          amount: number
          created_at: string
          customer_id: string | null
          discount_id: string
          email: string | null
          id: string
          order_id: string
          phone: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id?: string | null
          discount_id: string
          email?: string | null
          id?: string
          order_id: string
          phone?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          discount_id?: string
          email?: string | null
          id?: string
          order_id?: string
          phone?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_usages_tenant_id_discount_id_fkey"
            columns: ["tenant_id", "discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "discount_usages_tenant_id_order_id_fkey"
            columns: ["tenant_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      discounts: {
        Row: {
          applies_to: string
          automatic: boolean
          code: string | null
          config: Json
          created_at: string
          ends_at: string | null
          id: string
          max_discount: number | null
          min_subtotal: number
          per_customer_limit: number | null
          starts_at: string
          status: string
          tenant_id: string
          title: string
          type: string
          updated_at: string
          usage_count: number
          usage_limit: number | null
          value: number
        }
        Insert: {
          applies_to?: string
          automatic?: boolean
          code?: string | null
          config?: Json
          created_at?: string
          ends_at?: string | null
          id?: string
          max_discount?: number | null
          min_subtotal?: number
          per_customer_limit?: number | null
          starts_at?: string
          status?: string
          tenant_id: string
          title: string
          type: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          value?: number
        }
        Update: {
          applies_to?: string
          automatic?: boolean
          code?: string | null
          config?: Json
          created_at?: string
          ends_at?: string | null
          id?: string
          max_discount?: number | null
          min_subtotal?: number
          per_customer_limit?: number | null
          starts_at?: string
          status?: string
          tenant_id?: string
          title?: string
          type?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          created_at: string
          dns_records: Json
          hostname: string
          id: string
          is_primary: boolean
          last_checked_at: string | null
          last_error: string | null
          provider: string | null
          provider_ref: string | null
          provider_status: string | null
          redirect_hostname: string | null
          ssl_status: string
          status: string
          tenant_id: string
          type: string
          updated_at: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          dns_records?: Json
          hostname: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          provider?: string | null
          provider_ref?: string | null
          provider_status?: string | null
          redirect_hostname?: string | null
          ssl_status?: string
          status?: string
          tenant_id: string
          type: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          dns_records?: Json
          hostname?: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          provider?: string | null
          provider_ref?: string | null
          provider_status?: string | null
          redirect_hostname?: string | null
          ssl_status?: string
          status?: string
          tenant_id?: string
          type?: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          created_at: string
          error: string | null
          id: number
          idempotency_key: string | null
          kind: string
          provider: string
          provider_message_id: string | null
          recipient_hash: string
          recipient_masked: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: never
          idempotency_key?: string | null
          kind: string
          provider?: string
          provider_message_id?: string | null
          recipient_hash: string
          recipient_masked?: string | null
          status: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: never
          idempotency_key?: string | null
          kind?: string
          provider?: string
          provider_message_id?: string | null
          recipient_hash?: string
          recipient_masked?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          settings: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          settings?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          settings?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          group_name: string
          id: string
          position: number
          question: string
          status: string
          tenant_id: string
        }
        Insert: {
          answer: string
          group_name?: string
          id?: string
          position?: number
          question: string
          status?: string
          tenant_id: string
        }
        Update: {
          answer?: string
          group_name?: string
          id?: string
          position?: number
          question?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faqs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          default_enabled: boolean
          description: string | null
          key: string
        }
        Insert: {
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          key: string
        }
        Update: {
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          key?: string
        }
        Relationships: []
      }
      gbp_reviews: {
        Row: {
          comment: string | null
          id: string
          location_name: string
          replied_at: string | null
          reply: string | null
          review_id: string
          review_time: string | null
          reviewer_name: string | null
          star_rating: number | null
          synced_at: string
          tenant_id: string
        }
        Insert: {
          comment?: string | null
          id?: string
          location_name: string
          replied_at?: string | null
          reply?: string | null
          review_id: string
          review_time?: string | null
          reviewer_name?: string | null
          star_rating?: number | null
          synced_at?: string
          tenant_id: string
        }
        Update: {
          comment?: string | null
          id?: string
          location_name?: string
          replied_at?: string | null
          reply?: string | null
          review_id?: string
          review_time?: string | null
          reviewer_name?: string | null
          star_rating?: number | null
          synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gbp_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_levels: {
        Row: {
          available: number
          incoming: number
          location_id: string
          reserved: number
          tenant_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          available?: number
          incoming?: number
          location_id: string
          reserved?: number
          tenant_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          available?: number
          incoming?: number
          location_id?: string
          reserved?: number
          tenant_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "inventory_levels_tenant_id_variant_id_fkey"
            columns: ["tenant_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          active: boolean
          address: Json
          created_at: string
          id: string
          is_default: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          available_after: number
          created_at: string
          created_by: string | null
          delta: number
          id: number
          location_id: string
          note: string | null
          reason: string
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
          variant_id: string
        }
        Insert: {
          available_after: number
          created_at?: string
          created_by?: string | null
          delta: number
          id?: never
          location_id: string
          note?: string | null
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
          variant_id: string
        }
        Update: {
          available_after?: number
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: never
          location_id?: string
          note?: string | null
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "inventory_movements_tenant_id_variant_id_fkey"
            columns: ["tenant_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          location_id: string
          order_id: string | null
          quantity: number
          status: string
          tenant_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          location_id: string
          order_id?: string | null
          quantity: number
          status?: string
          tenant_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          location_id?: string
          order_id?: string | null
          quantity?: number
          status?: string
          tenant_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "inventory_reservations_tenant_id_variant_id_fkey"
            columns: ["tenant_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      invoices: {
        Row: {
          data: Json
          id: string
          invoice_number: string
          issued_at: string
          order_id: string
          tenant_id: string
        }
        Insert: {
          data: Json
          id?: string
          invoice_number: string
          issued_at?: string
          order_id: string
          tenant_id: string
        }
        Update: {
          data?: Json
          id?: string
          invoice_number?: string
          issued_at?: string
          order_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_id_order_id_fkey"
            columns: ["tenant_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      marketing_dates: {
        Row: {
          created_at: string
          id: string
          kind: string
          notes: string | null
          on_date: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          on_date: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          on_date?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_dates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string | null
          bytes: number
          created_at: string
          filename: string | null
          folder: string
          height: number | null
          id: string
          mime_type: string
          storage_path: string
          tenant_id: string
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          bytes: number
          created_at?: string
          filename?: string | null
          folder?: string
          height?: number | null
          id?: string
          mime_type: string
          storage_path: string
          tenant_id: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          bytes?: number
          created_at?: string
          filename?: string | null
          folder?: string
          height?: number | null
          id?: string
          mime_type?: string
          storage_path?: string
          tenant_id?: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          highlight: boolean
          id: string
          image_path: string | null
          link_ref: string | null
          link_type: string
          menu_id: string
          parent_id: string | null
          position: number
          tenant_id: string
          title: string
          url: string | null
        }
        Insert: {
          highlight?: boolean
          id?: string
          image_path?: string | null
          link_ref?: string | null
          link_type: string
          menu_id: string
          parent_id?: string | null
          position?: number
          tenant_id: string
          title: string
          url?: string | null
        }
        Update: {
          highlight?: boolean
          id?: string
          image_path?: string | null
          link_ref?: string | null
          link_type?: string
          menu_id?: string
          parent_id?: string | null
          position?: number
          tenant_id?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_tenant_id_menu_id_fkey"
            columns: ["tenant_id", "menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "menu_items_tenant_id_parent_id_fkey"
            columns: ["tenant_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      menus: {
        Row: {
          handle: string
          id: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          handle: string
          id?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          handle?: string
          id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_jobs: {
        Row: {
          attempts: number
          cart_id: string | null
          channel: string
          created_at: string
          delivered_at: string | null
          event: string
          id: string
          idempotency_key: string
          language_code: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          order_id: string | null
          params: Json
          preview: string | null
          provider_message_id: string | null
          read_at: string | null
          recipient: string
          sent_at: string | null
          status: string
          template_name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          cart_id?: string | null
          channel?: string
          created_at?: string
          delivered_at?: string | null
          event: string
          id?: string
          idempotency_key: string
          language_code: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          order_id?: string | null
          params?: Json
          preview?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          template_name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          cart_id?: string | null
          channel?: string
          created_at?: string
          delivered_at?: string | null
          event?: string
          id?: string
          idempotency_key?: string
          language_code?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          order_id?: string | null
          params?: Json
          preview?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          template_name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: number
          provider_message_id: string | null
          recipient_hash: string
          status: string
          template_key: string
          tenant_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          id?: never
          provider_message_id?: string | null
          recipient_hash: string
          status: string
          template_key: string
          tenant_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: never
          provider_message_id?: string | null
          recipient_hash?: string
          status?: string
          template_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          muted_types: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          muted_types?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          muted_types?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          active: boolean
          body: string
          channel: string
          id: string
          key: string
          subject: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          channel?: string
          id?: string
          key: string
          subject?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          channel?: string
          id?: string
          key?: string
          subject?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          dedupe_key: string | null
          id: string
          link: string | null
          read_at: string | null
          scope: string
          tenant_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          dedupe_key?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          scope: string
          tenant_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          dedupe_key?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          scope?: string
          tenant_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          data: Json
          id: number
          message: string | null
          order_id: string
          tenant_id: string
          type: string
          visible_to_customer: boolean
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          data?: Json
          id?: never
          message?: string | null
          order_id: string
          tenant_id: string
          type: string
          visible_to_customer?: boolean
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          data?: Json
          id?: never
          message?: string | null
          order_id?: string
          tenant_id?: string
          type?: string
          visible_to_customer?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "order_events_tenant_id_order_id_fkey"
            columns: ["tenant_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      order_items: {
        Row: {
          compare_at_price: number | null
          discount_total: number
          hsn_code: string | null
          id: string
          image_path: string | null
          line_total: number
          options: Json
          order_id: string
          product_id: string | null
          product_title: string
          quantity: number
          returned_quantity: number
          sku: string | null
          tax_rate: number
          tax_total: number
          tenant_id: string
          unit_price: number
          variant_id: string | null
          variant_title: string | null
        }
        Insert: {
          compare_at_price?: number | null
          discount_total?: number
          hsn_code?: string | null
          id?: string
          image_path?: string | null
          line_total: number
          options?: Json
          order_id: string
          product_id?: string | null
          product_title: string
          quantity: number
          returned_quantity?: number
          sku?: string | null
          tax_rate?: number
          tax_total?: number
          tenant_id: string
          unit_price: number
          variant_id?: string | null
          variant_title?: string | null
        }
        Update: {
          compare_at_price?: number | null
          discount_total?: number
          hsn_code?: string | null
          id?: string
          image_path?: string | null
          line_total?: number
          options?: Json
          order_id?: string
          product_id?: string | null
          product_title?: string
          quantity?: number
          returned_quantity?: number
          sku?: string | null
          tax_rate?: number
          tax_total?: number
          tenant_id?: string
          unit_price?: number
          variant_id?: string | null
          variant_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_tenant_id_order_id_fkey"
            columns: ["tenant_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "order_items_tenant_id_product_id_fkey"
            columns: ["tenant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "order_items_tenant_id_variant_id_fkey"
            columns: ["tenant_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      orders: {
        Row: {
          attribution: Json
          billing_address: Json | null
          cancel_reason: string | null
          cancelled_at: string | null
          cart_id: string | null
          cod_fee: number
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_id: string | null
          customer_snapshot: Json
          discount_code: string | null
          discount_snapshot: Json | null
          discount_total: number
          email: string | null
          fulfillment_status: string
          grand_total: number
          id: string
          idempotency_key: string
          note: string | null
          order_number: number
          payment_method: string
          payment_status: string
          phone: string
          placed_at: string
          prices_include_tax: boolean
          refunded_total: number
          shipping_address: Json
          shipping_rate_snapshot: Json | null
          shipping_total: number
          staff_note: string | null
          status: string
          subtotal: number
          tax_total: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attribution?: Json
          billing_address?: Json | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cart_id?: string | null
          cod_fee?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_snapshot?: Json
          discount_code?: string | null
          discount_snapshot?: Json | null
          discount_total?: number
          email?: string | null
          fulfillment_status?: string
          grand_total: number
          id?: string
          idempotency_key: string
          note?: string | null
          order_number: number
          payment_method: string
          payment_status?: string
          phone: string
          placed_at?: string
          prices_include_tax?: boolean
          refunded_total?: number
          shipping_address: Json
          shipping_rate_snapshot?: Json | null
          shipping_total?: number
          staff_note?: string | null
          status?: string
          subtotal: number
          tax_total?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attribution?: Json
          billing_address?: Json | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cart_id?: string | null
          cod_fee?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_snapshot?: Json
          discount_code?: string | null
          discount_snapshot?: Json | null
          discount_total?: number
          email?: string | null
          fulfillment_status?: string
          grand_total?: number
          id?: string
          idempotency_key?: string
          note?: string | null
          order_number?: number
          payment_method?: string
          payment_status?: string
          phone?: string
          placed_at?: string
          prices_include_tax?: boolean
          refunded_total?: number
          shipping_address?: Json
          shipping_rate_snapshot?: Json | null
          shipping_total?: number
          staff_note?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_tenant_id_customer_id_fkey"
            columns: ["tenant_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          body: Json
          created_at: string
          id: string
          kind: string
          published_at: string | null
          seo: Json
          slug: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: Json
          created_at?: string
          id?: string
          kind?: string
          published_at?: string | null
          seo?: Json
          slug: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: Json
          created_at?: string
          id?: string
          kind?: string
          published_at?: string | null
          seo?: Json
          slug?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_commissions: {
        Row: {
          amount: number
          base_amount: number
          created_at: string
          id: string
          kind: string
          partner_id: string
          payout_id: string | null
          period_month: string
          rate_bps: number
          status: string
          tenant_id: string | null
        }
        Insert: {
          amount: number
          base_amount: number
          created_at?: string
          id?: string
          kind: string
          partner_id: string
          payout_id?: string | null
          period_month: string
          rate_bps: number
          status?: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          base_amount?: number
          created_at?: string
          id?: string
          kind?: string
          partner_id?: string
          payout_id?: string | null
          period_month?: string
          rate_bps?: number
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_commissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "partner_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_credit_ledger: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string | null
          delta: number
          id: string
          kind: string
          note: string | null
          partner_id: string
          reference_id: string | null
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          kind: string
          note?: string | null
          partner_id: string
          reference_id?: string | null
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          kind?: string
          note?: string | null
          partner_id?: string
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_credit_ledger_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_demo_shops: {
        Row: {
          active: boolean
          category: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          position: number
          tenant_id: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          position?: number
          tenant_id: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          position?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_demo_shops_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          partner_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          partner_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          partner_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_invites_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_license_batches: {
        Row: {
          batch_number: string
          created_at: string
          created_by: string | null
          credit_applied: number
          id: string
          license_type: string
          paid_at: string | null
          partner_id: string
          payment_reference: string | null
          payment_status: string
          qty: number
          request_id: string | null
          subtotal: number
          total: number
          unit_price: number
        }
        Insert: {
          batch_number: string
          created_at?: string
          created_by?: string | null
          credit_applied?: number
          id?: string
          license_type: string
          paid_at?: string | null
          partner_id: string
          payment_reference?: string | null
          payment_status?: string
          qty: number
          request_id?: string | null
          subtotal: number
          total: number
          unit_price: number
        }
        Update: {
          batch_number?: string
          created_at?: string
          created_by?: string | null
          credit_applied?: number
          id?: string
          license_type?: string
          paid_at?: string | null
          partner_id?: string
          payment_reference?: string | null
          payment_status?: string
          qty?: number
          request_id?: string | null
          subtotal?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_license_batches_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_license_requests: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by: string | null
          decision_note: string | null
          id: string
          license_type: string
          notes: string | null
          partner_id: string
          qty: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_note?: string | null
          id?: string
          license_type?: string
          notes?: string | null
          partner_id: string
          qty: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_note?: string | null
          id?: string
          license_type?: string
          notes?: string | null
          partner_id?: string
          qty?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_license_requests_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "partner_license_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_license_requests_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_licenses: {
        Row: {
          batch_id: string
          consumed_at: string | null
          created_at: string
          id: string
          license_key: string
          license_type: string
          partner_id: string
          revoked_at: string | null
          revoked_by: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          batch_id: string
          consumed_at?: string | null
          created_at?: string
          id?: string
          license_key: string
          license_type: string
          partner_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          batch_id?: string
          consumed_at?: string | null
          created_at?: string
          id?: string
          license_key?: string
          license_type?: string
          partner_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_licenses_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "partner_license_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_licenses_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_licenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_one_time_codes: {
        Row: {
          code_hash: string
          code_hint: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          note: string | null
          status: string
          used_at: string | null
          used_by_partner_id: string | null
          value: number
        }
        Insert: {
          code_hash: string
          code_hint: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          status?: string
          used_at?: string | null
          used_by_partner_id?: string | null
          value: number
        }
        Update: {
          code_hash?: string
          code_hint?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          status?: string
          used_at?: string | null
          used_by_partner_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_one_time_codes_used_by_partner_id_fkey"
            columns: ["used_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_payouts: {
        Row: {
          amount: number
          commission_count: number
          created_at: string
          created_by: string | null
          direct_amount: number
          id: string
          method: string
          notes: string | null
          override_amount: number
          paid_at: string | null
          paid_by: string | null
          partner_id: string
          period_cutoff: string
          status: string
          utr: string | null
        }
        Insert: {
          amount: number
          commission_count?: number
          created_at?: string
          created_by?: string | null
          direct_amount?: number
          id?: string
          method?: string
          notes?: string | null
          override_amount?: number
          paid_at?: string | null
          paid_by?: string | null
          partner_id: string
          period_cutoff: string
          status?: string
          utr?: string | null
        }
        Update: {
          amount?: number
          commission_count?: number
          created_at?: string
          created_by?: string | null
          direct_amount?: number
          id?: string
          method?: string
          notes?: string | null
          override_amount?: number
          paid_at?: string | null
          paid_by?: string | null
          partner_id?: string
          period_cutoff?: string
          status?: string
          utr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_payouts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_referrals: {
        Row: {
          created_at: string
          created_by: string | null
          license_id: string | null
          partner_id: string
          source: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          license_id?: string | null
          partner_id: string
          source: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          license_id?: string | null
          partner_id?: string
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_referrals_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "partner_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          agency_payout_bps: number | null
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          city: string | null
          company_name: string | null
          created_at: string
          created_by: string | null
          credit_balance: number
          direct_bps: number
          email: string
          gstin: string | null
          id: string
          license_price: number | null
          name: string
          notes: string | null
          override_bps: number
          pan: string | null
          parent_partner_id: string | null
          partner_code: string
          partner_type: string
          payout_method: string | null
          phone: string | null
          region_name: string | null
          state_name: string | null
          status: string
          tier: string
          updated_at: string
          upi_id: string | null
          user_id: string | null
        }
        Insert: {
          agency_payout_bps?: number | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          credit_balance?: number
          direct_bps?: number
          email: string
          gstin?: string | null
          id?: string
          license_price?: number | null
          name: string
          notes?: string | null
          override_bps?: number
          pan?: string | null
          parent_partner_id?: string | null
          partner_code?: string
          partner_type?: string
          payout_method?: string | null
          phone?: string | null
          region_name?: string | null
          state_name?: string | null
          status?: string
          tier?: string
          updated_at?: string
          upi_id?: string | null
          user_id?: string | null
        }
        Update: {
          agency_payout_bps?: number | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          credit_balance?: number
          direct_bps?: number
          email?: string
          gstin?: string | null
          id?: string
          license_price?: number | null
          name?: string
          notes?: string | null
          override_bps?: number
          pan?: string | null
          parent_partner_id?: string | null
          partner_code?: string
          partner_type?: string
          payout_method?: string | null
          phone?: string | null
          region_name?: string | null
          state_name?: string | null
          status?: string
          tier?: string
          updated_at?: string
          upi_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_parent_partner_id_fkey"
            columns: ["parent_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          error_code: string | null
          error_description: string | null
          id: string
          method: string | null
          order_id: string
          paid_at: string | null
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          error_code?: string | null
          error_description?: string | null
          id?: string
          method?: string | null
          order_id: string
          paid_at?: string | null
          provider: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          error_code?: string | null
          error_description?: string | null
          id?: string
          method?: string | null
          order_id?: string
          paid_at?: string | null
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_tenant_id_order_id_fkey"
            columns: ["tenant_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      pincode_rules: {
        Row: {
          cod_allowed: boolean
          deliverable: boolean
          extra_days: number
          prefix: string
          tenant_id: string
        }
        Insert: {
          cod_allowed?: boolean
          deliverable?: boolean
          extra_days?: number
          prefix: string
          tenant_id: string
        }
        Update: {
          cod_allowed?: boolean
          deliverable?: boolean
          extra_days?: number
          prefix?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pincode_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_requests: {
        Row: {
          billing_cycle: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          from_plan_id: string | null
          id: string
          note: string | null
          plan_id: string
          requested_by: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          from_plan_id?: string | null
          id?: string
          note?: string | null
          plan_id: string
          requested_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          from_plan_id?: string | null
          id?: string
          note?: string | null
          plan_id?: string
          requested_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_requests_from_plan_id_fkey"
            columns: ["from_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          code: string
          commission_bps: number
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          limits: Json
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
          trial_days: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          commission_bps?: number
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          limits?: Json
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          commission_bps?: number
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          limits?: Json
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Relationships: [
        ]
      }
      platform_app_credentials: {
        Row: {
          client_id: string | null
          extra: Json
          provider: string
          secret_ciphertext: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id?: string | null
          extra?: Json
          provider: string
          secret_ciphertext?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string | null
          extra?: Json
          provider?: string
          secret_ciphertext?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_role_permissions: {
        Row: {
          permission: string
          role: string
        }
        Insert: {
          permission: string
          role: string
        }
        Update: {
          permission?: string
          role?: string
        }
        Relationships: []
      }
      platform_settings: {
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
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      product_media: {
        Row: {
          alt_text: string | null
          created_at: string
          height: number | null
          id: string
          media_type: string
          position: number
          product_id: string
          storage_path: string
          tenant_id: string
          variant_id: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          height?: number | null
          id?: string
          media_type?: string
          position?: number
          product_id: string
          storage_path: string
          tenant_id: string
          variant_id?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          height?: number | null
          id?: string
          media_type?: string
          position?: number
          product_id?: string
          storage_path?: string
          tenant_id?: string
          variant_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_tenant_id_product_id_fkey"
            columns: ["tenant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "product_media_tenant_id_variant_id_fkey"
            columns: ["tenant_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      product_option_values: {
        Row: {
          id: string
          option_id: string
          position: number
          swatch: string | null
          tenant_id: string
          value: string
        }
        Insert: {
          id?: string
          option_id: string
          position?: number
          swatch?: string | null
          tenant_id: string
          value: string
        }
        Update: {
          id?: string
          option_id?: string
          position?: number
          swatch?: string | null
          tenant_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_tenant_id_option_id_fkey"
            columns: ["tenant_id", "option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      product_options: {
        Row: {
          id: string
          name: string
          position: number
          product_id: string
          tenant_id: string
        }
        Insert: {
          id?: string
          name: string
          position: number
          product_id: string
          tenant_id: string
        }
        Update: {
          id?: string
          name?: string
          position?: number
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_tenant_id_product_id_fkey"
            columns: ["tenant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      product_types: {
        Row: {
          created_at: string
          industries: string[]
          key: string
          label: string
          plural_label: string | null
          position: number
          status: string
          template: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          industries?: string[]
          key: string
          label: string
          plural_label?: string | null
          position?: number
          status?: string
          template?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          industries?: string[]
          key?: string
          label?: string
          plural_label?: string | null
          position?: number
          status?: string
          template?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          allow_backorder: boolean
          barcode: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          id: string
          low_stock_threshold: number | null
          option1: string | null
          option2: string | null
          option3: string | null
          position: number
          price: number
          product_id: string
          sku: string | null
          status: string
          tenant_id: string
          title: string
          track_inventory: boolean
          updated_at: string
          weight_grams: number
        }
        Insert: {
          allow_backorder?: boolean
          barcode?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          id?: string
          low_stock_threshold?: number | null
          option1?: string | null
          option2?: string | null
          option3?: string | null
          position?: number
          price: number
          product_id: string
          sku?: string | null
          status?: string
          tenant_id: string
          title?: string
          track_inventory?: boolean
          updated_at?: string
          weight_grams?: number
        }
        Update: {
          allow_backorder?: boolean
          barcode?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          id?: string
          low_stock_threshold?: number | null
          option1?: string | null
          option2?: string | null
          option3?: string | null
          position?: number
          price?: number
          product_id?: string
          sku?: string | null
          status?: string
          tenant_id?: string
          title?: string
          track_inventory?: boolean
          updated_at?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_tenant_id_product_id_fkey"
            columns: ["tenant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      products: {
        Row: {
          attributes: Json
          brand: string | null
          care_instructions: string | null
          category_id: string | null
          created_at: string
          description: string | null
          featured: boolean
          hsn_code: string | null
          id: string
          max_compare_at_price: number | null
          max_price: number | null
          min_price: number | null
          product_type: string
          published_at: string | null
          rating_avg: number
          rating_count: number
          return_info: string | null
          sales_count: number
          search_vector: unknown
          seo: Json
          shipping_info: string | null
          short_description: string | null
          size_chart_id: string | null
          slug: string
          status: string
          tags: string[]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          brand?: string | null
          care_instructions?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          hsn_code?: string | null
          id?: string
          max_compare_at_price?: number | null
          max_price?: number | null
          min_price?: number | null
          product_type?: string
          published_at?: string | null
          rating_avg?: number
          rating_count?: number
          return_info?: string | null
          sales_count?: number
          search_vector?: unknown
          seo?: Json
          shipping_info?: string | null
          short_description?: string | null
          size_chart_id?: string | null
          slug: string
          status?: string
          tags?: string[]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          brand?: string | null
          care_instructions?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          hsn_code?: string | null
          id?: string
          max_compare_at_price?: number | null
          max_price?: number | null
          min_price?: number | null
          product_type?: string
          published_at?: string | null
          rating_avg?: number
          rating_count?: number
          return_info?: string | null
          sales_count?: number
          search_vector?: unknown
          seo?: Json
          shipping_info?: string | null
          short_description?: string | null
          size_chart_id?: string | null
          slug?: string
          status?: string
          tags?: string[]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_category_id_fkey"
            columns: ["tenant_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_size_chart_id_fkey"
            columns: ["tenant_id", "size_chart_id"]
            isOneToOne: false
            referencedRelation: "size_charts"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_counters: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      redirects: {
        Row: {
          created_at: string
          from_path: string
          id: string
          status_code: number
          tenant_id: string
          to_path: string
        }
        Insert: {
          created_at?: string
          from_path: string
          id?: string
          status_code?: number
          tenant_id: string
          to_path: string
        }
        Update: {
          created_at?: string
          from_path?: string
          id?: string
          status_code?: number
          tenant_id?: string
          to_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "redirects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method: string
          order_id: string
          payment_id: string | null
          provider_refund_id: string | null
          reason: string | null
          return_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          order_id: string
          payment_id?: string | null
          provider_refund_id?: string | null
          reason?: string | null
          return_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          order_id?: string
          payment_id?: string | null
          provider_refund_id?: string | null
          reason?: string | null
          return_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_tenant_id_order_id_fkey"
            columns: ["tenant_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "refunds_tenant_id_payment_id_fkey"
            columns: ["tenant_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "refunds_tenant_id_return_id_fkey"
            columns: ["tenant_id", "return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      return_items: {
        Row: {
          order_item_id: string
          quantity: number
          reason: string | null
          return_id: string
          tenant_id: string
        }
        Insert: {
          order_item_id: string
          quantity: number
          reason?: string | null
          return_id: string
          tenant_id: string
        }
        Update: {
          order_item_id?: string
          quantity?: number
          reason?: string | null
          return_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_items_tenant_id_order_item_id_fkey"
            columns: ["tenant_id", "order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "return_items_tenant_id_return_id_fkey"
            columns: ["tenant_id", "return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_note: string | null
          id: string
          order_id: string
          reason: string
          refund_amount: number | null
          resolution: string
          restock: boolean
          return_number: number
          staff_note: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_note?: string | null
          id?: string
          order_id: string
          reason: string
          refund_amount?: number | null
          resolution?: string
          restock?: boolean
          return_number: number
          staff_note?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_note?: string | null
          id?: string
          order_id?: string
          reason?: string
          refund_amount?: number | null
          resolution?: string
          restock?: boolean
          return_number?: number
          staff_note?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_tenant_id_customer_id_fkey"
            columns: ["tenant_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "returns_tenant_id_order_id_fkey"
            columns: ["tenant_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string
          body: string | null
          created_at: string
          customer_id: string | null
          id: string
          order_id: string | null
          product_id: string
          rating: number
          source: string
          status: string
          tenant_id: string
          title: string | null
          updated_at: string
          verified_purchase: boolean
        }
        Insert: {
          author_name: string
          body?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          order_id?: string | null
          product_id: string
          rating: number
          source?: string
          status?: string
          tenant_id: string
          title?: string | null
          updated_at?: string
          verified_purchase?: boolean
        }
        Update: {
          author_name?: string
          body?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          order_id?: string | null
          product_id?: string
          rating?: number
          source?: string
          status?: string
          tenant_id?: string
          title?: string | null
          updated_at?: string
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_tenant_id_customer_id_fkey"
            columns: ["tenant_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "reviews_tenant_id_order_id_fkey"
            columns: ["tenant_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "reviews_tenant_id_product_id_fkey"
            columns: ["tenant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission: string
          role: string
        }
        Insert: {
          permission: string
          role: string
        }
        Update: {
          permission?: string
          role?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string
          delivered_at: string | null
          dimensions: Json | null
          id: string
          metadata: Json
          order_id: string
          provider: string
          provider_ref: string | null
          shipped_at: string | null
          status: string
          tenant_id: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          dimensions?: Json | null
          id?: string
          metadata?: Json
          order_id: string
          provider?: string
          provider_ref?: string | null
          shipped_at?: string | null
          status?: string
          tenant_id: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          dimensions?: Json | null
          id?: string
          metadata?: Json
          order_id?: string
          provider?: string
          provider_ref?: string | null
          shipped_at?: string | null
          status?: string
          tenant_id?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_tenant_id_order_id_fkey"
            columns: ["tenant_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          active: boolean
          cod_allowed: boolean
          created_at: string
          estimated_days_max: number
          estimated_days_min: number
          id: string
          max_subtotal: number | null
          max_weight_grams: number | null
          min_subtotal: number
          min_weight_grams: number
          name: string
          pincode_prefixes: string[]
          position: number
          price: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cod_allowed?: boolean
          created_at?: string
          estimated_days_max?: number
          estimated_days_min?: number
          id?: string
          max_subtotal?: number | null
          max_weight_grams?: number | null
          min_subtotal?: number
          min_weight_grams?: number
          name: string
          pincode_prefixes?: string[]
          position?: number
          price?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cod_allowed?: boolean
          created_at?: string
          estimated_days_max?: number
          estimated_days_min?: number
          id?: string
          max_subtotal?: number | null
          max_weight_grams?: number | null
          min_subtotal?: number
          min_weight_grams?: number
          name?: string
          pincode_prefixes?: string[]
          position?: number
          price?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      size_charts: {
        Row: {
          chart: Json
          created_at: string
          id: string
          name: string
          tenant_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          chart?: Json
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          chart?: Json
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "size_charts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_campaigns: {
        Row: {
          color: string
          created_at: string
          ends_on: string | null
          goal: string | null
          id: string
          name: string
          starts_on: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          ends_on?: string | null
          goal?: string | null
          id?: string
          name: string
          starts_on?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          ends_on?: string | null
          goal?: string | null
          id?: string
          name?: string
          starts_on?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_conversations: {
        Row: {
          channel: string
          created_at: string
          external_thread_id: string
          id: string
          last_inbound_at: string | null
          last_message_at: string | null
          last_preview: string | null
          participant_id: string
          participant_name: string | null
          status: string
          tenant_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          external_thread_id: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_preview?: string | null
          participant_id: string
          participant_name?: string | null
          status?: string
          tenant_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          external_thread_id?: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_preview?: string | null
          participant_id?: string
          participant_name?: string | null
          status?: string
          tenant_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_hashtag_sets: {
        Row: {
          created_at: string
          id: string
          name: string
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tags?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tags?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_hashtag_sets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_messages: {
        Row: {
          body: string
          conversation_id: string
          direction: string
          error: string | null
          external_id: string | null
          id: string
          media_url: string | null
          sent_at: string
          sent_by: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          body?: string
          conversation_id: string
          direction: string
          error?: string | null
          external_id?: string | null
          id?: string
          media_url?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          direction?: string
          error?: string | null
          external_id?: string | null
          id?: string
          media_url?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_messages_tenant_id_conversation_id_fkey"
            columns: ["tenant_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "social_conversations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "social_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          campaign_id: string | null
          caption: string
          created_at: string
          created_by: string | null
          hashtags: string[]
          id: string
          link_url: string | null
          manual_done: string[]
          media_paths: string[]
          notes: string | null
          pillar: string | null
          platforms: string[]
          product_id: string | null
          published_at: string | null
          results: Json
          scheduled_at: string | null
          status: string
          tenant_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          caption?: string
          created_at?: string
          created_by?: string | null
          hashtags?: string[]
          id?: string
          link_url?: string | null
          manual_done?: string[]
          media_paths?: string[]
          notes?: string | null
          pillar?: string | null
          platforms?: string[]
          product_id?: string | null
          published_at?: string | null
          results?: Json
          scheduled_at?: string | null
          status?: string
          tenant_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          caption?: string
          created_at?: string
          created_by?: string | null
          hashtags?: string[]
          id?: string
          link_url?: string | null
          manual_done?: string[]
          media_paths?: string[]
          notes?: string | null
          pillar?: string | null
          platforms?: string[]
          product_id?: string | null
          published_at?: string | null
          results?: Json
          scheduled_at?: string | null
          status?: string
          tenant_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_campaign_fk"
            columns: ["tenant_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "social_campaigns"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "social_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_tenant_id_product_id_fkey"
            columns: ["tenant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      store_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          position: number
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          position?: number
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          position?: number
          slug?: string
        }
        Relationships: []
      }
      store_locations: {
        Row: {
          active: boolean
          address: Json
          hours: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          position: number
          tenant_id: string
        }
        Insert: {
          active?: boolean
          address?: Json
          hours?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          position?: number
          tenant_id: string
        }
        Update: {
          active?: boolean
          address?: Json
          hours?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          position?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: Json
          category_id: string | null
          checkout_settings: Json
          cod_settings: Json
          created_at: string
          currency: string
          description: string | null
          email: string | null
          favicon_path: string | null
          festive_settings: Json
          gstin: string | null
          integrations: Json
          launch_status: string
          launched_at: string | null
          legal_name: string | null
          locale: string
          logo_path: string | null
          low_stock_default: number
          name: string
          order_prefix: string
          phone: string | null
          seo: Json
          site_mode: string
          social: Json
          tagline: string | null
          tax_settings: Json
          tenant_id: string
          timezone: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: Json
          category_id?: string | null
          checkout_settings?: Json
          cod_settings?: Json
          created_at?: string
          currency?: string
          description?: string | null
          email?: string | null
          favicon_path?: string | null
          festive_settings?: Json
          gstin?: string | null
          integrations?: Json
          launch_status?: string
          launched_at?: string | null
          legal_name?: string | null
          locale?: string
          logo_path?: string | null
          low_stock_default?: number
          name: string
          order_prefix?: string
          phone?: string | null
          seo?: Json
          site_mode?: string
          social?: Json
          tagline?: string | null
          tax_settings?: Json
          tenant_id: string
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: Json
          category_id?: string | null
          checkout_settings?: Json
          cod_settings?: Json
          created_at?: string
          currency?: string
          description?: string | null
          email?: string | null
          favicon_path?: string | null
          festive_settings?: Json
          gstin?: string | null
          integrations?: Json
          launch_status?: string
          launched_at?: string | null
          legal_name?: string | null
          locale?: string
          logo_path?: string | null
          low_stock_default?: number
          name?: string
          order_prefix?: string
          phone?: string | null
          seo?: Json
          site_mode?: string
          social?: Json
          tagline?: string | null
          tax_settings?: Json
          tenant_id?: string
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_sessions: {
        Row: {
          ended_at: string | null
          expires_at: string
          id: string
          platform_user_id: string
          reason: string
          started_at: string
          tenant_id: string
        }
        Insert: {
          ended_at?: string | null
          expires_at: string
          id?: string
          platform_user_id: string
          reason: string
          started_at?: string
          tenant_id: string
        }
        Update: {
          ended_at?: string | null
          expires_at?: string
          id?: string
          platform_user_id?: string
          reason?: string
          started_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_counters: {
        Row: {
          key: string
          tenant_id: string
          value: number
        }
        Insert: {
          key: string
          tenant_id: string
          value?: number
        }
        Update: {
          key?: string
          tenant_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_custom_roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          permissions: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          permissions?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          permissions?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_custom_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_feature_flags: {
        Row: {
          config: Json
          enabled: boolean
          feature_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          enabled: boolean
          feature_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          enabled?: boolean
          feature_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_flags_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "tenant_feature_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_integrations: {
        Row: {
          connected_at: string | null
          created_at: string
          enabled: boolean
          environment: string
          expires_at: string | null
          id: string
          kind: string
          last_verified_at: string | null
          provider: string
          public_config: Json
          secrets_encrypted: string | null
          status: string
          status_message: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          enabled?: boolean
          environment?: string
          expires_at?: string | null
          id?: string
          kind: string
          last_verified_at?: string | null
          provider: string
          public_config?: Json
          secrets_encrypted?: string | null
          status?: string
          status_message?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          enabled?: boolean
          environment?: string
          expires_at?: string | null
          id?: string
          kind?: string
          last_verified_at?: string | null
          provider?: string
          public_config?: Json
          secrets_encrypted?: string | null
          status?: string
          status_message?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          custom_role_id: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: string
          tenant_id: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          custom_role_id?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role: string
          tenant_id: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          custom_role_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: string
          tenant_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_custom_role_fk"
            columns: ["tenant_id", "custom_role_id"]
            isOneToOne: false
            referencedRelation: "tenant_custom_roles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_memberships: {
        Row: {
          created_at: string
          custom_role_id: string | null
          id: string
          invited_by: string | null
          role: string
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_role_id?: string | null
          id?: string
          invited_by?: string | null
          role: string
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_role_id?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_custom_role_fk"
            columns: ["tenant_id", "custom_role_id"]
            isOneToOne: false
            referencedRelation: "tenant_custom_roles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payment_settings: {
        Row: {
          enabled: boolean
          key_id: string | null
          key_secret_encrypted: string | null
          mode: string
          provider: string
          tenant_id: string
          updated_at: string
          webhook_secret_encrypted: string | null
        }
        Insert: {
          enabled?: boolean
          key_id?: string | null
          key_secret_encrypted?: string | null
          mode?: string
          provider?: string
          tenant_id: string
          updated_at?: string
          webhook_secret_encrypted?: string | null
        }
        Update: {
          enabled?: boolean
          key_id?: string | null
          key_secret_encrypted?: string | null
          mode?: string
          provider?: string
          tenant_id?: string
          updated_at?: string
          webhook_secret_encrypted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payment_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_product_types: {
        Row: {
          created_at: string
          created_by: string | null
          key: string
          label: string
          template: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          key: string
          label: string
          template?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          key?: string
          label?: string
          template?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_product_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_usage: {
        Row: {
          metric: string
          period_start: string
          tenant_id: string
          updated_at: string
          value: number
        }
        Insert: {
          metric: string
          period_start: string
          tenant_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          metric?: string
          period_start?: string
          tenant_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          plan_id: string | null
          slug: string
          status: string
          status_reason: string | null
          store_type: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          plan_id?: string | null
          slug: string
          status?: string
          status_reason?: string | null
          store_type?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          plan_id?: string | null
          slug?: string
          status?: string
          status_reason?: string | null
          store_type?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_versions: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          published_at: string | null
          published_by: string | null
          status: string
          tenant_id: string
          theme_key: string
          updated_at: string
          version: number
        }
        Insert: {
          config: Json
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          published_at?: string | null
          published_by?: string | null
          status: string
          tenant_id: string
          theme_key?: string
          updated_at?: string
          version: number
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          published_at?: string | null
          published_by?: string | null
          status?: string
          tenant_id?: string
          theme_key?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "theme_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          active: boolean
          author: string
          category: string
          config: Json
          created_at: string
          created_by: string | null
          demo_host: string | null
          description: string | null
          features: string[]
          id: string
          key: string
          name: string
          position: number
          preview_paths: string[]
          published_at: string | null
          source: string
          source_url: string | null
          style: string | null
          supported_sections: string[]
          tagline: string | null
          tags: string[]
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          author?: string
          category: string
          config: Json
          created_at?: string
          created_by?: string | null
          demo_host?: string | null
          description?: string | null
          features?: string[]
          id?: string
          key: string
          name: string
          position?: number
          preview_paths?: string[]
          published_at?: string | null
          source?: string
          source_url?: string | null
          style?: string | null
          supported_sections?: string[]
          tagline?: string | null
          tags?: string[]
          updated_at?: string
          version?: string
        }
        Update: {
          active?: boolean
          author?: string
          category?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          demo_host?: string | null
          description?: string | null
          features?: string[]
          id?: string
          key?: string
          name?: string
          position?: number
          preview_paths?: string[]
          published_at?: string | null
          source?: string
          source_url?: string | null
          style?: string | null
          supported_sections?: string[]
          tagline?: string | null
          tags?: string[]
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          error: string | null
          event_id: string
          event_type: string | null
          id: string
          processed_at: string | null
          provider: string
          received_at: string
          tenant_id: string | null
        }
        Insert: {
          error?: string | null
          event_id: string
          event_type?: string | null
          id?: string
          processed_at?: string | null
          provider: string
          received_at?: string
          tenant_id?: string | null
        }
        Update: {
          error?: string | null
          event_id?: string
          event_type?: string | null
          id?: string
          processed_at?: string | null
          provider?: string
          received_at?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_notification_settings: {
        Row: {
          body_text: string | null
          enabled: boolean
          event: string
          language_code: string | null
          param_format: string
          param_names: string[]
          template_name: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_text?: string | null
          enabled?: boolean
          event: string
          language_code?: string | null
          param_format?: string
          param_names?: string[]
          template_name?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_text?: string | null
          enabled?: boolean
          event?: string
          language_code?: string | null
          param_format?: string
          param_names?: string[]
          template_name?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_notification_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          created_at: string
          customer_id: string
          product_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          product_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_tenant_id_customer_id_fkey"
            columns: ["tenant_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "wishlist_items_tenant_id_product_id_fkey"
            columns: ["tenant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token_hash: string }; Returns: string }
      accept_partner_invite: {
        Args: {
          p_token_hash: string
        }
        Returns: string
      }
      ai_credit_debit: {
        Args: { p_kind: string; p_reference?: string | null; p_tenant: string }
        Returns: { balance: number; ledger_id: string }[]
      }
      ai_credit_refund: { Args: { p_ledger: string; p_note?: string | null }; Returns: number }
      adjust_inventory: {
        Args: {
          p_delta: number
          p_location?: string
          p_note?: string
          p_reason: string
          p_variant: string
        }
        Returns: number
      }
      cancel_order: {
        Args: { p_order: string; p_reason: string }
        Returns: undefined
      }
      cancel_plan_request: { Args: { p_request: string }; Returns: undefined }
      close_own_store: {
        Args: { p_confirm_slug: string; p_tenant: string }
        Returns: undefined
      }
      create_tenant: {
        Args: { p_name: string; p_root_domain: string; p_slug: string }
        Returns: string
      }
      dashboard_funnel: {
        Args: { p_from: string; p_tenant: string; p_to: string }
        Returns: {
          event_name: string
          events: number
          sessions: number
        }[]
      }
      dashboard_sales_daily: {
        Args: { p_from: string; p_tenant: string; p_to: string }
        Returns: {
          day: string
          orders: number
          revenue: number
        }[]
      }
      dashboard_top_pages: {
        Args: {
          p_from: string
          p_limit?: number
          p_tenant: string
          p_to: string
        }
        Returns: {
          path: string
          sessions: number
          views: number
        }[]
      }
      dashboard_top_products: {
        Args: {
          p_from: string
          p_limit?: number
          p_tenant: string
          p_to: string
        }
        Returns: {
          product_id: string
          revenue: number
          title: string
          units: number
        }[]
      }
      decide_ai_credit_purchase: {
        Args: { p_approve: boolean; p_note?: string | null; p_payment_reference?: string | null; p_request: string }
        Returns: number
      }
      end_support_session: { Args: { p_session: string }; Returns: undefined }
      inventory_overview: {
        Args: { p_tenant: string }
        Returns: {
          allow_backorder: boolean
          available: number
          incoming: number
          low_stock: boolean
          low_stock_threshold: number
          out_of_stock: boolean
          position: number
          product_id: string
          product_status: string
          product_title: string
          reserved: number
          sku: string
          tenant_id: string
          track_inventory: boolean
          variant_id: string
          variant_status: string
          variant_title: string
        }[]
      }
      issue_order_invoice: { Args: { p_order: string }; Returns: string }
      list_tenant_members: {
        Args: { p_tenant: string }
        Returns: {
          created_at: string
          custom_role_id: string
          custom_role_name: string
          display_name: string
          email: string
          last_sign_in_at: string
          membership_id: string
          role: string
          status: string
          user_id: string
        }[]
      }
      media_usage: {
        Args: { p_path: string; p_tenant: string }
        Returns: {
          kind: string
          label: string
          ref_id: string
        }[]
      }
      move_custom_domain: {
        Args: { p_domain: string; p_target: string }
        Returns: {
          hostname: string
          made_primary: boolean
          new_domain: string
          source_tenant: string
          target_tenant: string
        }[]
      }
      notifications_run_reminders: { Args: never; Returns: Json }
      notify_platform_event: {
        Args: {
          p_body: string
          p_data: Json
          p_dedupe: string
          p_link: string
          p_perm: string
          p_title: string
          p_type: string
        }
        Returns: number
      }
      platform_accrue_partner_commissions: {
        Args: {
          p_month: string
        }
        Returns: number
      }
      platform_adjust_partner_credit: {
        Args: {
          p_delta: number
          p_kind: string
          p_note: string
          p_partner: string
        }
        Returns: number
      }
      platform_ai_credit_insights: {
        Args: never
        Returns: Json
      }
      platform_ai_usage: {
        Args: {
          p_from?: string
        }
        Returns: {
          calls: number
          model: string
          provider: string
          tokens: number
        }[]
      }
      platform_create_partner_code: {
        Args: {
          p_expires?: string
          p_note?: string
          p_value: number
        }
        Returns: string
      }
      platform_create_tenant: {
        Args: {
          p_name: string
          p_owner: string
          p_plan?: string
          p_root_domain: string
          p_slug: string
          p_status?: string
        }
        Returns: string
      }
      platform_dashboard: { Args: never; Returns: Json }
      platform_decide_license_request: {
        Args: {
          p_approve: boolean
          p_note?: string
          p_paid?: boolean
          p_reference?: string
          p_request: string
          p_unit_price?: number
        }
        Returns: string
      }
      platform_decide_plan_request: {
        Args: {
          p_approve: boolean
          p_months?: number
          p_note: string
          p_request: string
        }
        Returns: undefined
      }
      platform_find_user_by_email: {
        Args: { p_email: string }
        Returns: string
      }
      platform_generate_commission_invoices: {
        Args: {
          p_period_start: string
        }
        Returns: {
          created: number
          total_commission: number
        }[]
      }
      platform_gmv_by_tenant: {
        Args: {
          p_from?: string
          p_to?: string
        }
        Returns: {
          gmv: number
          orders: number
          tenant_id: string
        }[]
      }
      platform_issue_license_batch: {
        Args: {
          p_paid?: boolean
          p_partner: string
          p_qty: number
          p_reference?: string
          p_request?: string
          p_type: string
          p_unit_price: number
        }
        Returns: string
      }
      platform_list_stores: {
        Args: {
          p_category?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_plan?: string
          p_q?: string
          p_sort?: string
          p_status?: string
          p_to?: string
          p_type?: string
        }
        Returns: {
          category_name: string
          created_at: string
          customers: number
          last_activity: string
          name: string
          orders: number
          owner_email: string
          plan_name: string
          primary_domain: string
          products: number
          revenue: number
          slug: string
          status: string
          store_type: string
          tenant_id: string
          total_count: number
        }[]
      }
      platform_mark_license_batch_paid: {
        Args: {
          p_batch: string
          p_reference: string
        }
        Returns: undefined
      }
      platform_overview: { Args: never; Returns: Json }
      platform_partner_leaderboard: {
        Args: {
          p_from: string
          p_to: string
        }
        Returns: {
          commission: number
          gmv: number
          licenses: number
          partner_code: string
          partner_id: string
          partner_name: string
          partner_type: string
          state_name: string
          tier: string
        }[]
      }
      platform_partner_orgs: {
        Args: {
          p_type?: string
        }
        Returns: {
          amount_paid: number
          company_name: string
          created_at: string
          credit_balance: number
          email: string
          licenses_redeemed: number
          licenses_total: number
          name: string
          parent_id: string
          parent_name: string
          partner_code: string
          partner_id: string
          partner_type: string
          status: string
          team_count: number
          tier: string
        }[]
      }
      platform_pending_partner_payouts: {
        Args: {
          p_cutoff: string
        }
        Returns: {
          bank_account_holder: string
          bank_account_last4: string
          bank_ifsc: string
          commission_count: number
          direct_amount: number
          override_amount: number
          partner_code: string
          partner_id: string
          partner_name: string
          payout_method: string
          tier: string
          total_amount: number
          upi_id: string
        }[]
      }
      platform_redeem_partner_code: {
        Args: {
          p_code: string
          p_partner: string
        }
        Returns: number
      }
      platform_revoke_partner_code: {
        Args: {
          p_code: string
        }
        Returns: undefined
      }
      platform_revoke_partner_license: {
        Args: {
          p_license: string
        }
        Returns: undefined
      }
      platform_run_partner_payout_batch: {
        Args: {
          p_cutoff: string
          p_method?: string
          p_min_amount?: number
        }
        Returns: {
          carried_over: number
          payouts_created: number
          total_amount: number
        }[]
      }
      platform_set_agency_payout: {
        Args: {
          p_agency: string
          p_bps: number
        }
        Returns: number
      }
      platform_set_commission_invoice_status: {
        Args: {
          p_invoice: string
          p_note?: string
          p_reference?: string
          p_status: string
        }
        Returns: undefined
      }
      platform_set_store_partner: {
        Args: {
          p_partner: string
          p_tenant: string
        }
        Returns: undefined
      }
      platform_settle_partner_payout: {
        Args: {
          p_note?: string
          p_paid: boolean
          p_payout: string
          p_utr?: string
        }
        Returns: undefined
      }
      platform_storage_usage: {
        Args: { p_limit?: number; p_tenant?: string }
        Returns: {
          bytes: number
          files: number
          tenant_id: string
        }[]
      }
      platform_tenant_counts: { Args: { p_tenant: string }; Returns: Json }
      platform_tenant_list_stats: {
        Args: { p_tenants: string[] }
        Returns: {
          gmv: number
          orders: number
          owner_email: string
          products: number
          tenant_id: string
        }[]
      }
      platform_user_detail: {
        Args: {
          p_user: string
        }
        Returns: Json
      }
      platform_user_directory: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_tenant?: string
          p_type?: string
        }
        Returns: {
          created_at: string
          customer_stores: number
          display_name: string
          email: string
          email_confirmed: boolean
          last_sign_in_at: string
          phone: string
          platform_role: string
          stores: Json
          total_count: number
          user_id: string
          user_types: string[]
        }[]
      }
      platform_user_emails: {
        Args: { p_user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      platform_user_stats: {
        Args: never
        Returns: {
          customers: number
          platform: number
          sellers: number
          total: number
        }[]
      }
      publish_theme: {
        Args: { p_label?: string; p_tenant: string }
        Returns: string
      }
      redeem_partner_license: {
        Args: {
          p_key: string
          p_tenant: string
        }
        Returns: string
      }
      remove_custom_domain: {
        Args: { p_domain: string }
        Returns: {
          hostname: string
          provider_ref: string
          tenant_id: string
        }[]
      }
      replace_menu_items: {
        Args: { p_items: Json; p_menu: string }
        Returns: number
      }
      request_plan: {
        Args: {
          p_cycle: string
          p_note: string
          p_plan: string
          p_tenant: string
        }
        Returns: string
      }
      request_ai_credit_purchase: {
        Args: {
          p_amount?: number
          p_method: string
          p_pack: string
          p_promo?: string
          p_tenant: string
        }
        Returns: string
      }
      rollback_theme: { Args: { p_version: string }; Returns: string }
      save_discount: {
        Args: {
          p_collection_ids: string[]
          p_discount: Json
          p_id: string
          p_product_ids: string[]
          p_tenant: string
        }
        Returns: string
      }
      save_product: {
        Args: { p_payload: Json; p_tenant: string }
        Returns: string
      }
      set_collection_products: {
        Args: { p_collection: string; p_product_ids: string[] }
        Returns: number
      }
      grant_ai_credits: { Args: { p_credits: number; p_note: string; p_tenant: string }; Returns: number }
      set_inventory: {
        Args: {
          p_available: number
          p_location?: string
          p_note?: string
          p_variant: string
        }
        Returns: number
      }
      set_primary_domain: { Args: { p_domain: string }; Returns: string }
      set_tenant_status: {
        Args: { p_reason: string; p_status: string; p_tenant: string }
        Returns: undefined
      }
      start_support_session: {
        Args: { p_minutes?: number; p_reason: string; p_tenant: string }
        Returns: string
      }
      storefront_features: { Args: { p_tenant: string }; Returns: Json }
      storefront_list_products: {
        Args: {
          p_category?: string
          p_collection?: string
          p_colours?: string[]
          p_exclude?: string
          p_fabrics?: string[]
          p_featured?: boolean
          p_in_stock?: boolean
          p_limit?: number
          p_max_price?: number
          p_min_price?: number
          p_occasions?: string[]
          p_offset?: number
          p_on_sale?: boolean
          p_product_ids?: string[]
          p_product_types?: string[]
          p_query?: string
          p_sizes?: string[]
          p_sort?: string
          p_tags?: string[]
          p_tenant: string
        }
        Returns: {
          product_id: string
          total_count: number
        }[]
      }
      storefront_listing_facets: {
        Args: {
          p_category?: string
          p_collection?: string
          p_query?: string
          p_tenant: string
        }
        Returns: Json
      }
      storefront_pincode_rule: {
        Args: { p_pincode: string; p_tenant: string }
        Returns: {
          cod_allowed: boolean
          deliverable: boolean
          extra_days: number
        }[]
      }
      storefront_redirect: {
        Args: { p_path: string; p_tenant: string }
        Returns: {
          status_code: number
          to_path: string
        }[]
      }
      submit_contact_message: {
        Args: {
          p_email: string
          p_message: string
          p_name: string
          p_phone: string
          p_subject: string
          p_tenant: string
        }
        Returns: string
      }
      submit_review: {
        Args: {
          p_author: string
          p_body: string
          p_product: string
          p_rating: number
          p_tenant: string
          p_title: string
        }
        Returns: string
      }
      svc_cancel_order: {
        Args: { p_order: string; p_reason: string }
        Returns: undefined
      }
      svc_claim_notification_job: {
        Args: { p_job: string }
        Returns: {
          attempts: number
          cart_id: string | null
          channel: string
          created_at: string
          delivered_at: string | null
          event: string
          id: string
          idempotency_key: string
          language_code: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          order_id: string | null
          params: Json
          preview: string | null
          provider_message_id: string | null
          read_at: string | null
          recipient: string
          sent_at: string | null
          status: string
          template_name: string
          tenant_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      svc_claim_notification_jobs: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          cart_id: string | null
          channel: string
          created_at: string
          delivered_at: string | null
          event: string
          id: string
          idempotency_key: string
          language_code: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          order_id: string | null
          params: Json
          preview: string | null
          provider_message_id: string | null
          read_at: string | null
          recipient: string
          sent_at: string | null
          status: string
          template_name: string
          tenant_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      svc_create_return: {
        Args: {
          p_customer: string
          p_items: Json
          p_note: string
          p_order: string
          p_reason: string
          p_tenant: string
        }
        Returns: string
      }
      svc_expire_unpaid_orders: { Args: never; Returns: number }
      svc_issue_invoice: { Args: { p_order: string }; Returns: string }
      svc_mark_order_paid: {
        Args: {
          p_amount: number
          p_method: string
          p_order: string
          p_provider: string
          p_provider_order_id: string
          p_provider_payment_id: string
        }
        Returns: boolean
      }
      svc_newsletter_subscribe: {
        Args: { p_email: string; p_tenant: string }
        Returns: undefined
      }
      svc_place_order: {
        Args: { p_items: Json; p_order: Json }
        Returns: string
      }
      svc_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      svc_record_refund: {
        Args: {
          p_actor: string
          p_amount: number
          p_method: string
          p_order: string
          p_provider_refund_id: string
          p_reason: string
          p_return: string
          p_status: string
        }
        Returns: string
      }
      tenant_entitlements: { Args: { p_tenant: string }; Returns: Json }
      update_fulfillment: {
        Args: {
          p_carrier?: string
          p_order: string
          p_status: string
          p_tracking?: string
          p_tracking_url?: string
        }
        Returns: undefined
      }
      update_return_status: {
        Args: { p_note?: string; p_return: string; p_status: string }
        Returns: undefined
      }
      variant_stock: {
        Args: { p_variant_ids: string[] }
        Returns: {
          available: number
          in_stock: boolean
          variant_id: string
        }[]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
