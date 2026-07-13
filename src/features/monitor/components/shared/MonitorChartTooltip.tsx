export const MonitorChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1d23]/90 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2.5 shadow-2xl text-[11px] min-w-36">
      <p className="text-white/60 text-[10px] mb-2 border-b border-white/5 pb-1.5 font-medium tracking-wide">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 leading-5 text-[11px]">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-white/50 font-medium">{p.name}:</span>
          <span className="text-white font-bold ml-auto" style={{ color: p.color }}>
            {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
};
