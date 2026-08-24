import { createClient } from "@supabase/supabase-js";

// 서버 컴포넌트용 읽기 클라이언트. anon key만 사용(RLS로 SELECT만 허용).
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY가 필요합니다.");
  }
  return createClient(url, anonKey, { auth: { persistSession: false } });
}
