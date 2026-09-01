// 익명 기기 식별자 (localStorage). 로그인 없이 중복 제보 완화용.
export function makeId(): string {
  // 일부 폰/인앱 브라우저는 crypto.randomUUID 미지원 → 폴백
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getDeviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = makeId();
    localStorage.setItem("device_id", id);
  }
  return id;
}
