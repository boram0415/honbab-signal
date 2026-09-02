export interface RankEntry {
  nickname: string;
  score: number;
}

export function Ranking({ entries, monthLabel }: { entries: RankEntry[]; monthLabel: string }) {
  return (
    <div>
      <div className="mb-3 rounded-2xl bg-amber-50 px-4 py-3">
        <h2 className="text-sm font-bold text-amber-900">{monthLabel} 외식왕</h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700">
          혼밥·웨이팅 제보 +3점, 채팅 +1점 · 로그인해야 내 점수가 쌓여요
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="mt-10 text-center text-sm text-slate-400">
          이번 달 첫 기여자가 되어보세요.
          <br />
          로그인하고 제보하면 외식왕에 도전할 수 있어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e, i) => {
            const top = i === 0;
            return (
              <li
                key={`${e.nickname}-${i}`}
                className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm ${
                  top ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-white"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    top
                      ? "bg-amber-400 text-white"
                      : i === 1
                        ? "bg-slate-300 text-white"
                        : i === 2
                          ? "bg-amber-700/70 text-white"
                          : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{e.nickname}</p>
                  {top && <p className="text-[11px] font-bold text-amber-600">이달의 외식왕</p>}
                </div>
                <span className="shrink-0 text-sm font-bold text-slate-700">{e.score}점</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
