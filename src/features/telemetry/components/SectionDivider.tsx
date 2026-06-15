export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] font-semibold uppercase tracking-widest text-gray-400 shrink-0">{label}</span>
      <div className="h-px flex-1 bg-linear-to-r from-border/30 to-transparent" />
    </div>
  );
}
