export default function Loading() {
  return (
    <div className="py-3">
      <div className="mb-3 h-6 w-28 animate-pulse rounded bg-slate-100" />
      <div className="mb-3 h-16 animate-pulse rounded-2xl bg-slate-100" />
      <div className="mb-3 h-10 animate-pulse rounded-xl bg-slate-100" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-4">
            <div className="h-14 w-8 animate-pulse rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
