"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getBrowserClient } from "@/lib/supabaseClient";

export default function MyPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [nick, setNick] = useState("");
  const [orig, setOrig] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const sb = getBrowserClient();
    sb.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user?.id ?? null;
      setUid(u);
      if (u) {
        const { data: p } = await sb.from("profiles").select("nickname").eq("id", u).maybeSingle();
        const n = (p?.nickname as string) ?? localStorage.getItem("honbab_nick") ?? "";
        setNick(n);
        setOrig(n);
      }
      setReady(true);
    });
  }, []);

  async function save() {
    const v = nick.trim();
    if (v.length < 1 || v.length > 20) {
      setMsg("닉네임은 1~20자로 입력해주세요");
      return;
    }
    if (v === orig) {
      setMsg("변경된 내용이 없어요");
      return;
    }
    setSaving(true);
    setMsg(null);
    const { error } = await getBrowserClient().from("profiles").update({ nickname: v }).eq("id", uid!);
    if (error) {
      setMsg(error.code === "23505" ? "이미 사용 중인 닉네임이에요" : `저장 실패: ${error.message}`);
    } else {
      setOrig(v);
      localStorage.setItem("honbab_nick", v);
      setMsg("저장됐어요");
      router.refresh();
    }
    setSaving(false);
  }

  async function logout() {
    await getBrowserClient().auth.signOut();
    localStorage.removeItem("honbab_nick");
    localStorage.removeItem("honbab_saved");
    router.push("/");
  }

  if (!ready) {
    return <p className="py-24 text-center text-sm text-slate-400">불러오는 중…</p>;
  }

  if (!uid) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-slate-500">로그인이 필요해요.</p>
        <Link href="/" className="mt-3 inline-block text-sm font-semibold text-slate-900 underline">
          홈으로
        </Link>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-4 flex items-center gap-2">
        <Link href="/" aria-label="뒤로" className="text-slate-400">
          ←
        </Link>
        <h1 className="text-lg font-bold tracking-tight">마이페이지</h1>
      </header>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <label htmlFor="nick" className="text-sm font-semibold text-slate-700">
          닉네임
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="nick"
            value={nick}
            onChange={(e) => {
              setNick(e.target.value);
              if (msg) setMsg(null);
            }}
            maxLength={20}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving || nick.trim() === orig}
            className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-40"
          >
            저장
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-slate-500">{msg}</p>}
        <p className="mt-2 text-[11px] text-slate-400">1~20자 · 다른 사람이 쓰는 닉네임은 쓸 수 없어요</p>
      </section>

      <button
        type="button"
        onClick={logout}
        className="mt-4 w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-500 transition active:scale-[0.99]"
      >
        로그아웃
      </button>
    </div>
  );
}
