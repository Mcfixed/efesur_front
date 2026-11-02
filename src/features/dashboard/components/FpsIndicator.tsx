import { useFps } from "@/hooks/useFps";
import { useTheme } from "@/context/ThemeContext";

export default function FpsIndicator({ mapLoaded }: { mapLoaded: boolean }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const fps = useFps(mapLoaded);
  
  return (
    <div className="flex items-center gap-2">
      <span className={isDark ? "text-white/50" : "text-slate-500"}>FPS</span>
      <span 
        className="font-bold" 
        style={{ color: fps === null ? (isDark ? '#9ca3af' : '#64748b') : fps >= 50 ? '#4ade80' : fps >= 30 ? '#facc15' : '#f87171' }}
      >
        {fps ?? '—'}
      </span>
    </div>
  );
}
