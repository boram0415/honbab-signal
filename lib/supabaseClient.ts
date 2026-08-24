import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 브라우저(클라이언트 컴포넌트)용 anon 클라이언트. RLS로 wait_reports INSERT/최근 SELECT만 허용.
let client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return client;
}
