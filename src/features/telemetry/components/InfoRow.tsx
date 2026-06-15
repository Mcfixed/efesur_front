export function InfoRow({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <div className="flex justify-between items-center gap-2 border-b border-border/5 last:border-0">
      <span className="text-[10px] text-text-300 shrink-0">{label}</span>
      <span className={`text-[10px] text-right truncate max-w-[60%] ${color || 'text-text-200'} ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
