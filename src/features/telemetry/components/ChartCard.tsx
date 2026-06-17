export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-red-500 border border-border/10 rounded-lg p-2 shadow-sm">
      <p className="text-[9px] font-semibold text-text-200 mb-1">{title}</p>
      {children}
    </div>
  );
}
