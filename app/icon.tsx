import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// 세로형 3구 신호등 앱 아이콘
export default function Icon() {
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
            gap: 26,
            background: "#1e293b",
            padding: 40,
            borderRadius: 72,
          }}
        >
          <div style={{ width: 104, height: 104, borderRadius: "50%", background: "#f43f5e" }} />
          <div style={{ width: 104, height: 104, borderRadius: "50%", background: "#fbbf24" }} />
          <div style={{ width: 104, height: 104, borderRadius: "50%", background: "#10b981" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
