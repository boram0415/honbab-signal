import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      ".env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY를 설정하세요.",
    );
  }

  const testName = `__rls_check_${Date.now()}__`;
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await anonClient.from("restaurants").insert({
    name: testName,
    category: "RLS_TEST",
    walk_min: 0,
    price_min: 0,
    price_max: 0,
    solo_status: "green",
  });

  if (!error) {
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: cleanupError } = await serviceClient
      .from("restaurants")
      .delete()
      .eq("name", testName);
    if (cleanupError) {
      throw new Error(`RLS 검증 실패 및 테스트 행 정리 실패: ${cleanupError.message}`);
    }
    throw new Error("RLS 검증 실패: anon key로 restaurants INSERT가 허용되었습니다.");
  }

  const isRlsRejection = /row-level security|permission denied/i.test(error.message);
  if (!isRlsRejection) {
    throw new Error(`RLS 차단을 확인할 수 없는 오류입니다: ${error.message}`);
  }

  console.log("RLS 확인 성공: anon key의 restaurants INSERT가 거부되었습니다.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
