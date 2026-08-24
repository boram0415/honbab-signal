import type { SignalColor } from "@/lib/types";

export const CHIP: Record<SignalColor, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  yellow: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  gray: "bg-slate-100 text-slate-500 ring-slate-200",
};

const LAMPS: Array<{ key: SignalColor; on: string; glow: string }> = [
  { key: "red", on: "bg-rose-500", glow: "shadow-[0_0_9px_2px_rgba(244,63,94,0.75)]" },
  { key: "yellow", on: "bg-amber-400", glow: "shadow-[0_0_9px_2px_rgba(251,191,36,0.75)]" },
  { key: "green", on: "bg-emerald-500", glow: "shadow-[0_0_9px_2px_rgba(16,185,129,0.75)]" },
];

const SIZES = {
  sm: { box: "gap-1.5 rounded-xl p-1.5", lamp: "h-4 w-4" },
  lg: { box: "gap-2.5 rounded-2xl p-3", lamp: "h-9 w-9" },
};

export function TrafficLight({
  color,
  size = "sm",
}: {
  color: SignalColor;
  size?: "sm" | "lg";
}) {
  const s = SIZES[size];
  return (
    <div
      className={`flex flex-col items-center bg-slate-800 ring-1 ring-slate-900/50 ${s.box}`}
    >
      {LAMPS.map((l) => {
        const on = color === l.key;
        return (
          <span
            key={l.key}
            aria-hidden
            className={`rounded-full ${s.lamp} ${on ? `${l.on} ${l.glow}` : "bg-slate-600/40"}`}
          />
        );
      })}
    </div>
  );
}
