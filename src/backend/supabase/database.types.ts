// PLACEHOLDER -- replaced wholesale by T24 (`supabase gen types typescript`),
// which is the actual source of truth for this file once Fase 2's schema
// migrations (T10-T19) exist to introspect. Until then this gives the
// clients in client.ts/server.ts a `Database` generic to type against
// without lying about columns/tables that don't exist yet.
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
