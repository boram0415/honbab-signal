import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// 제보 완료 토글 (관리자 전용: ADMIN_KEY 일치 시에만). service_role로 서버에서만 수행.
export async function POST(req: Request) {
  const { key, id, done } = await req.json().catch(() => ({}));
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 404 });
  }
  if (typeof id !== "string" || typeof done !== "boolean") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await svc.from("suggestions").update({ done }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
