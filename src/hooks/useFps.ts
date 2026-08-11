import { useState, useEffect, useRef } from "react";

/**
 * Mide los FPS en tiempo real usando requestAnimationFrame.
 * Actualiza el estado cada ~500ms con el promedio del último segundo.
 * @param enabled - Si false, no mide (retorna null).
 */
export function useFps(enabled = true): number | null {
  const [fps, setFps] = useState<number | null>(null);
  const framesRef = useRef(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setFps(null);
      return;
    }

    let rafId: number;
    let intervalId: ReturnType<typeof setInterval>;
    framesRef.current = 0;
    lastTimeRef.current = performance.now();

    const tick = () => {
      framesRef.current += 1;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    intervalId = setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTimeRef.current) / 1000;
      // FPS en esta ventana de ~500ms
      const current = dt > 0 ? Math.round(framesRef.current / dt) : 0;
      setFps(current);
      framesRef.current = 0;
      lastTimeRef.current = now;
    }, 500);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(intervalId);
    };
  }, [enabled]);

  return fps;
}
