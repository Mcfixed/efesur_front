import { useEffect, useRef } from "react";

export function useCriticalAlertSound(criticalCount: number) {
  const prevCount = useRef(0);

  useEffect(() => {
    if (criticalCount > prevCount.current && prevCount.current > 0) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } catch { /* fallback silencioso */ }
    }
    prevCount.current = criticalCount;
  }, [criticalCount]);
}
