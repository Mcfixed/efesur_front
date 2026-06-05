import { useState, useRef, useEffect } from "react";
import { IconSearch } from "@tabler/icons-react";
import type { DashboardData, GatewayDevice } from "../types/dashboard.types";

interface Props {
  data?: DashboardData;
  gateways: GatewayDevice[];
  onFlyTo: (lng: number, lat: number) => void;
}

interface SearchItem {
  id: string;
  name: string;
  subtitle: string;
  type: "device" | "gateway";
  lng: number;
  lat: number;
}

export default function MapSearchBox({ data, gateways, onFlyTo }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Construir índice de búsqueda
  const allItems: SearchItem[] = [
    ...(data?.devices || []).map(d => ({
      id: `dev-${d.id}`,
      name: d.name,
      subtitle: `${d.type_device} · ${d.dev_eui}`,
      type: "device" as const,
      lng: Number(d.longitude_current),
      lat: Number(d.latitude_current),
    })),
    ...gateways.filter(g => g.latitude_current && g.longitude_current).map(g => ({
      id: `gw-${g.id}`,
      name: g.name,
      subtitle: `${g.company_name} · ${g.dev_eui}`,
      type: "gateway" as const,
      lng: Number(g.longitude_current),
      lat: Number(g.latitude_current),
    })),
  ];

  // Filtrar al escribir
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) { setResults([]); setOpen(false); return; }
    const filtered = allItems.filter(
      item =>
        item.name.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
    );
    setResults(filtered.slice(0, 20));
    setOpen(filtered.length > 0);
  }, [query, data, gateways]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const select = (item: SearchItem) => {
    if (!item.lng || !item.lat) return;
    onFlyTo(item.lng, item.lat);
    setQuery(item.name);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  };

  return (
    <div ref={containerRef} className="absolute top-2 right-13 z-20 w-72">
      <div className="relative">
        <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-300 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar sensor o gateway..."
          className="w-full bg-bg-100/90 backdrop-blur-sm border border-border/40 rounded-lg pl-8 pr-3 py-2 text-[12px] text-text-100 placeholder:text-text-300 outline-none focus:border-brand-100/50 focus:bg-bg-100 shadow-lg transition-colors"
        />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg-100 border border-border/30 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {results.map(item => (
            <button
              key={item.id}
              onClick={() => select(item)}
              className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-bg-200 transition-colors border-b border-border/10 last:border-0"
            >
              <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${item.type === 'gateway' ? 'bg-green-400' : 'bg-blue-400'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-text-100 truncate">{item.name}</p>
                <p className="text-[10px] text-text-300 truncate">{item.subtitle}</p>
              </div>
              <span className={`text-[9px] font-medium uppercase shrink-0 mt-0.5 ${item.type === 'gateway' ? 'text-green-400' : 'text-blue-400'}`}>
                {item.type === 'gateway' ? 'GW' : 'DEV'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
