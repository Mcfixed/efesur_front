export const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded px-3.5 py-2.5 shadow-2xl text-[11px] min-w-35">
      <p className="text-gray-300  text-[12px] mb-1.5 border-b border-white/5 pb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold leading-5 text-[12px]">
          {p.name}: <span className="text-white font-bold">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </p>
      ))}
    </div>
  );
};
