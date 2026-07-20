import { useState, useRef, useEffect } from "react";

const BATTERY_TABLE = [
  { v: 4.20, p: 100 },
  { v: 4.15, p: 95 },
  { v: 4.11, p: 90 },
  { v: 4.08, p: 80 },
  { v: 4.02, p: 70 },
  { v: 3.98, p: 60 },
  { v: 3.95, p: 50 },
  { v: 3.91, p: 40 },
  { v: 3.87, p: 30 },
  { v: 3.82, p: 20 },
  { v: 3.79, p: 15 },
  { v: 3.75, p: 10 },
  { v: 3.70, p: 5 },
  { v: 3.50, p: 0 },
];

export default function MonitorBatteryPopup({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-56" style={{ pointerEvents: 'none' }}>
          <div className="bg-[#1a1d23]/95 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl p-3 text-[11px]">
            <p className="text-white font-semibold mb-2 text-[10px] uppercase tracking-wider">Voltaje → %</p>
            <div className="space-y-1">
              {BATTERY_TABLE.map((row, i) => {
                const barW = row.p;
                const barColor = row.p >= 50 ? 'bg-green-500' : row.p >= 20 ? 'bg-orange-500' : 'bg-red-500';
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-9 text-right font-mono text-white/80 text-[10px]">{row.v.toFixed(2)}V</span>
                    <span className="text-white/30 text-[10px]">→</span>
                    <span className="w-6 text-right font-mono font-bold text-[11px]" style={{ color: row.p >= 50 ? '#4ade80' : row.p >= 20 ? '#fb923c' : '#f87171' }}>{row.p}%</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-white/50 mt-2 border-t border-white/10 pt-2 leading-snug">
              El dispositivo puede funcionar con menos de 3.50V, pero 3.50V es la base segura recomendada.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
