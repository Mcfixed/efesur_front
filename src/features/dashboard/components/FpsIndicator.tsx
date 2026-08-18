import { useFps } from "@/hooks/useFps";
export default function FpsIndicator({ mapLoaded }: { mapLoaded: boolean }) {
  const fps = useFps(mapLoaded);
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/50">FPS</span>
      <span 
        className="font-bold" 
        style={{ color: fps === null ? '#9ca3af' : fps >= 50 ? '#4ade80' : fps >= 30 ? '#facc15' : '#f87171' }}
      >
        {fps ?? '—'}
      </span>
    </div>
  );
}
