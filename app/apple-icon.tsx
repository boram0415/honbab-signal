import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS 홈 화면 아이콘 (세로형 3구 신호등)
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 9,
            background: "#1e293b",
            padding: 14,
            borderRadius: 26,
          }}
        >
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f43f5e" }} />
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fbbf24" }} />
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#10b981" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
