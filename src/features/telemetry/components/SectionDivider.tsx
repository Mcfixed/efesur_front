export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] pl-2 font-semibold uppercase tracking-widest text-text-200 shrink-0">{label}</span>
      <div className="h-px flex-1 bg-linear-to-r from-transparent via-gray-300/30 to-transparent" />
    </div>
  );
}
