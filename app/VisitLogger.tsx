"use client";

import { useEffect } from "react";

import { getDeviceId } from "@/lib/deviceId";
import { getBrowserClient } from "@/lib/supabaseClient";

// 하루 1회 방문 기록(device_id+day 유니크). 로그인 시 user_id도 함께.
// 실패(테이블 미생성/네트워크)는 조용히 무시 — 방문 로그는 부가 기능.
export default function VisitLogger() {
  useEffect(() => {
    const sb = getBrowserClient();
    sb.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      // 하루 1행: PK(device_id, day)로 보장. 같은 날 재접속은 중복키로 조용히 무시.
      sb.from("visits").insert({ device_id: getDeviceId(), user_id: uid }).then(() => {});
    });
  }, []);

  return null;
}
