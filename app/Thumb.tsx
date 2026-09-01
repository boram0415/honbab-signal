// 사진 썸네일. photo_url(사용자 업로드)이 있으면 이미지, 없으면 아무것도 렌더 안 함.
export function Thumb({ url, className = "" }: { url: string | null; className?: string }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" className={`object-cover ${className}`} />;
}
