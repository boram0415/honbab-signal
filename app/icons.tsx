export function HeartIcon({
  filled,
  className = "",
  color,
}: {
  filled: boolean;
  className?: string;
  color?: string;
}) {
  const c = color ?? "#f43f5e";
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill={filled ? c : "none"}
      stroke={filled ? c : "#cbd5e1"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20.3S3.6 14.9 3.6 8.9A4.3 4.3 0 0 1 12 6.1a4.3 4.3 0 0 1 8.4 2.8c0 6-8.4 11.4-8.4 11.4z" />
    </svg>
  );
}

// 지도 "내 위치" 크로스헤어 아이콘
export function LocationIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2" />
    </svg>
  );
}
