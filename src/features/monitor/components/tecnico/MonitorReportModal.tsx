import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { useMonitorDevices } from "../../hooks/useMonitor";
import { monitorService } from "../../services/monitor.service";
import { IconX, IconFileReport, IconBattery, IconWifi, IconAlertTriangle } from "@tabler/icons-react";

interface Props {
  onClose: () => void;
}

type ReportType = 'general' | 'battery' | 'connectivity' | 'alerts';

const REPORT_OPTIONS: { key: ReportType; label: string; desc: string; icon: any }[] = [
  { key: 'general', label: 'Reporte general', desc: 'Métricas y alertas por dispositivo', icon: IconFileReport },
  { key: 'battery', label: 'Salud de baterías', desc: 'Estado, voltaje y proyección', icon: IconBattery },
  { key: 'connectivity', label: 'Conectividad', desc: 'SNR, RSSI y cobertura', icon: IconWifi },
  { key: 'alerts', label: 'Alertas y Tracking', desc: 'Alertas y recorridos por dispositivo', icon: IconAlertTriangle },
];

export default function MonitorReportModal({ onClose }: Props) {
  const { data: allDevices } = useMonitorDevices();
  const [fromDate, setFromDate] = useState(format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [reportType, setReportType] = useState<ReportType>('general');

  // Dispositivos visibles: todos los tipos en todos los reportes
  const visibleDevices = useMemo(() => (allDevices || []), [allDevices]);

  const deviceTypes = useMemo(() => {
    const types = new Set(visibleDevices.map(d => d.type_device));
    return [...types].sort();
  }, [visibleDevices]);

  const devicesByType = useMemo(() => {
    const map = new Map<string, typeof allDevices>();
    visibleDevices.forEach(d => {
      const arr = map.get(d.type_device) || [];
      arr.push(d);
      map.set(d.type_device, arr);
    });
    return map;
  }, [visibleDevices]);

  const toggleAll = () => {
    if (selectedIds.size === visibleDevices.length && visibleDevices.every(d => selectedIds.has(d.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleDevices.map(d => d.id)));
    }
  };

  const toggleDevice = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleType = (type: string) => {
    const typeIds = (devicesByType.get(type) || []).map(d => d.id);
    const allSelected = typeIds.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);
    typeIds.forEach(id => { if (allSelected) next.delete(id); else next.add(id); });
    setSelectedIds(next);
  };

  // Al cambiar de tipo de reporte, limpiar selecciones que ya no son válidas
  useEffect(() => {
    const validIds = new Set(visibleDevices.map(d => d.id));
    setSelectedIds(prev => new Set([...prev].filter(id => validIds.has(id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, allDevices]);

  const generatePDF = async () => {
    if (selectedIds.size === 0) return;
    if (reportType === 'general') await generateGeneralPDF();
    else if (reportType === 'battery') await generateBatteryPDF();
    else if (reportType === 'connectivity') await generateConnectivityPDF();
    else if (reportType === 'alerts') await generateAlertsPDF();
  };

  const generateGeneralPDF = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      // Gateway → lectores asignados (el gateway tiene id_device_father apuntando al lector)
      const lectorsByGateway = new Map<number, any[]>();
      const lectoresById = new Map<number, any>();
      (allDevices || []).filter(d => d.type_device === 'Lector').forEach(d => lectoresById.set(d.id, d));
      (allDevices || []).forEach(d => {
        if (d.type_device === 'Gateway' && d.id_device_father) {
          const lector = lectoresById.get(d.id_device_father);
          if (lector) {
            const arr = lectorsByGateway.get(d.id) || [];
            arr.push(lector);
            lectorsByGateway.set(d.id, arr);
          }
        }
      });
      const selectedDevices = (allDevices || []).filter(d => selectedIds.has(d.id));
      // Expandir deviceIds: incluir los lectores de los gateways seleccionados
      const expandedIds = new Set(selectedIds);
      selectedDevices.forEach(d => {
        if (d.type_device === 'Gateway') {
          (lectorsByGateway.get(d.id) || []).forEach(l => expandedIds.add(l.id));
        }
      });

      const data = await monitorService.getReport({
        deviceIds: [...expandedIds],
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
      });
      setReportData(data);
      const title = `Reporte EFESUR - ${format(new Date(), "yyyy-MM-dd")}`;
      const isSingleDay = fromDate === toDate;
      const dayCount = fromDate && toDate
        ? Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1
        : 30;

      // ─── Helper: sparkline con SVG, min/max, fechas ───
      const sparkline = (values: (number | null)[], color: string, unit = '', height = 50, timestamps?: Date[]) => {
        const valid = values.filter((v): v is number => v != null);
        if (valid.length < 2) return '';
        const min = Math.min(...valid);
        const max = Math.max(...valid);
        const range = max - min || 1;
        const w = 360;
        const padTop = 16;
        const padBottom = 18;
        const chartH = height - padTop - padBottom;
        const pts = valid.map((v, i) => `${(i / (valid.length - 1)) * w},${padTop + chartH - ((v - min) / range) * chartH}`).join(' ');
        const fmt = (v: number) => unit ? (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + unit : v.toFixed(1);
        const latest = valid[valid.length - 1];
        // Etiquetas del eje X: dinámico según cantidad de días
        const fmtDate = (d: Date) => String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
        const fmtTime = (d: Date) => String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
        const dateLabels = timestamps && timestamps.length > 1 ? (() => {
          const count = Math.min(isSingleDay ? 8 : dayCount <= 3 ? 10 : 12, timestamps.length);
          const step = (timestamps.length - 1) / (count - 1);
          const items: { x: number; label: string; isDate: boolean }[] = [];
          if (isSingleDay) {
            // 1 día → solo horas
            for (let i = 0; i < count; i++) {
              const idx = Math.round(i * step);
              const x = (idx / (timestamps.length - 1)) * w;
              items.push({ x, label: fmtTime(timestamps[idx]), isDate: false });
            }
          } else if (dayCount <= 3) {
            // 2-3 días → fecha al cambiar de día, horas dentro del mismo día
            let prevDateStr = '';
            for (let i = 0; i < count; i++) {
              const idx = Math.round(i * step);
              const d = timestamps[idx];
              const dateStr = fmtDate(d);
              if (dateStr !== prevDateStr) {
                const x = (idx / (timestamps.length - 1)) * w;
                items.push({ x, label: dateStr, isDate: true });
                prevDateStr = dateStr;
              } else {
                const x = (idx / (timestamps.length - 1)) * w;
                items.push({ x, label: fmtTime(d), isDate: false });
              }
            }
          } else {
            // 4+ días → solo fechas
            let prevDateStr = '';
            for (let i = 0; i < count; i++) {
              const idx = Math.round(i * step);
              const d = timestamps[idx];
              const dateStr = fmtDate(d);
              if (dateStr !== prevDateStr) {
                const x = (idx / (timestamps.length - 1)) * w;
                items.push({ x, label: dateStr, isDate: true });
                prevDateStr = dateStr;
              }
            }
          }
          return items;
        })() : [];
        return `
        <div style="position:relative;width:100%">
          <svg viewBox="0 0 ${w} ${height}" style="display:block;width:100%;height:auto">
            <line x1="0" y1="${padTop + chartH}" x2="${w}" y2="${padTop + chartH}" stroke="#e5e7eb" stroke-width="1"/>
            <line x1="0" y1="${padTop}" x2="${w}" y2="${padTop}" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4 4"/>
            <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="2" y="${padTop - 3}" font-size="8" fill="#888" font-family="Arial,sans-serif" font-weight="600">Máx</text>
            <text x="22" y="${padTop - 3}" font-size="10" fill="#333" font-family="monospace" font-weight="700">${fmt(max)}</text>
            <text x="${w - 88}" y="${padTop - 3}" font-size="8" fill="#888" font-family="Arial,sans-serif" font-weight="600">Actual</text>
            <text x="${w - 52}" y="${padTop - 3}" font-size="10" fill="${color}" font-family="monospace" font-weight="700">${latest != null ? fmt(latest) : '—'}</text>
            <text x="2" y="${height - 6}" font-size="8" fill="#888" font-family="Arial,sans-serif" font-weight="600">Mín</text>
            <text x="20" y="${height - 6}" font-size="10" fill="#333" font-family="monospace" font-weight="700">${fmt(min)}</text>
            ${dateLabels.map((dl: any) => `
              <line x1="${dl.x}" y1="${padTop + chartH}" x2="${dl.x}" y2="${padTop + chartH + 3}" stroke="#d1d5db" stroke-width="0.5"/>
              <text x="${dl.x}" y="${height - 2}" font-size="${dl.isDate ? '7' : '6'}" fill="${dl.isDate ? '#555' : '#999'}" font-family="Arial,sans-serif" font-weight="${dl.isDate ? '700' : '400'}" text-anchor="middle">${dl.label}</text>
            `).join('')}
          </svg>
        </div>`;
      };

      // ─── Helper: barra de progreso ───
      const bar = (pct: number, color: string) =>
        `<div style="height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;margin:2px 0">
          <div style="height:100%;width:${Math.max(0, Math.min(100, pct))}%;background:${color};border-radius:4px"></div>
        </div>`;

      // ─── Helper: promedio ───
      const avg = (arr: (number | null)[]) => {
        const valid = arr.filter((v): v is number => v != null);
        return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
      };

      // ─── Helper: escape HTML ───
      const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

      // ─── Agrupar telemetría por dispositivo ───
      const deviceMap = new Map<number, { bat: number[]; temp: number[]; snr: number[]; rssi: number[]; ts: Date[]; gwCount: number[] }>();

      selectedDevices.forEach(d => deviceMap.set(d.id, { bat: [], temp: [], snr: [], rssi: [], ts: [], gwCount: [] }));

      // ─── Telemetría de lectores (para mostrar en los gateways) ───
      // Estructura del objeto lector:
      // { mppt: { chargeState, panelPower_W, batteryVoltage_V, batteryCurrent_A, panelVoltage_V, loadCurrent_A, temp, loadState },
      //   charger220: { State, Error, battery_V, battery_A },
      //   sensores: { presenseSensor, distancePrecenseSensor, openingDoorSensor } }
      const lectorMap = new Map<number, { volt: number[]; power: number[]; current: number[]; temp: number[]; panelV: number[]; loadA: number[]; loadState: number[]; chargeState: number[]; chargerState: string[]; sensores: any[]; ts: Date[] }>();
      (allDevices || []).filter(d => d.type_device === 'Lector').forEach(d => {
        lectorMap.set(d.id, { volt: [], power: [], current: [], temp: [], panelV: [], loadA: [], loadState: [], chargeState: [], chargerState: [], sensores: [], ts: [] });
      });

      data.telemetry.forEach((t: any) => {
        const rx = Array.isArray(t.rxinfo) ? t.rxinfo : typeof t.rxinfo === 'string' ? (() => { try { return JSON.parse(t.rxinfo); } catch { return []; } })() : [];
        const gw = rx[0] || {};
        const entry = deviceMap.get(t.device_id);
        if (entry) {
          if (t.object?.voltage_mV != null) {
            const mv = Number(t.object.voltage_mV);
            entry.bat.push(mv);
          }
          if (t.object?.temperature_C != null) {
            const tc = Number(t.object.temperature_C);
            entry.temp.push(tc);
          }
          if (gw?.snr != null) {
            const sn = Number(gw.snr);
            entry.snr.push(sn);
          }
          if (gw?.rssi != null) {
            const rs = Number(gw.rssi);
            entry.rssi.push(rs);
          }
          entry.ts.push(new Date(t.ts));
          entry.gwCount.push(rx.length);
        }
        // Datos de lector (asignados a un gateway)
        const le = lectorMap.get(t.device_id);
        if (le) {
          const o = t.object || {};
          const batV = o.charger220?.battery_V ?? o.mppt?.batteryVoltage_V;
          if (batV != null) le.volt.push(Number(batV));
          if (o.mppt?.panelPower_W != null) le.power.push(Number(o.mppt.panelPower_W));
          if (o.mppt?.batteryCurrent_A != null) le.current.push(Number(o.mppt.batteryCurrent_A));
          if (o.mppt?.temp != null) le.temp.push(Number(o.mppt.temp));
          if (o.mppt?.panelVoltage_V != null) le.panelV.push(Number(o.mppt.panelVoltage_V));
          if (o.mppt?.loadCurrent_A != null) le.loadA.push(Number(o.mppt.loadCurrent_A));
          if (o.mppt?.loadState != null) le.loadState.push(Number(o.mppt.loadState));
          if (o.mppt?.chargeState != null) le.chargeState.push(Number(o.mppt.chargeState));
          if (o.charger220?.State != null) le.chargerState.push(String(o.charger220.State));
          if (o.sensores) le.sensores.push(o.sensores);
          le.ts.push(new Date(t.ts));
        }
      });

      const sections: string[] = [];

      // Sin resumen ejecutivo — cada dispositivo va directo

      // ═══════════════════════════════════════════
      // PÁGINA POR DISPOSITIVO
      // ═══════════════════════════════════════════
      selectedDevices.forEach((device) => {
        const entry = deviceMap.get(device.id);
        // Aunque no tenga datos, mostramos la página con info básica
        const dAvgBat = entry ? avg(entry.bat) : null;
        const dAvgTemp = entry ? avg(entry.temp) : null;
        const dAvgSnr = entry ? avg(entry.snr) : null;
        const dAvgRssi = entry ? avg(entry.rssi) : null;
        const devAlerts = (data.alerts || []).filter((a: any) => a.device_id === device.id || a.device_name === device.name);

        const entryTs = entry?.ts?.length || 0;
        const batSpark = entry ? sparkline(entry.bat.map(v => v / 1000), '#22c55e', 'V', 50, entry.ts) : '';
        const tempSpark = entry ? sparkline(entry.temp, '#f97316', '°C', 50, entry.ts) : '';
        const snrSpark = entry ? sparkline(entry.snr, '#3b82f6', 'dB', 50, entry.ts) : '';
        const rssiSpark = entry ? sparkline(entry.rssi, '#8b5cf6', 'dBm', 50, entry.ts) : '';

        const dBatPct = dAvgBat != null ? Math.max(0, Math.min(100, ((dAvgBat / 1000 - 3.3) / 0.9) * 100)) : 0;
        const dSnrPct = dAvgSnr != null ? Math.max(0, Math.min(100, ((dAvgSnr + 5) / 25) * 100)) : 0;
        const dRssiPct = dAvgRssi != null ? Math.max(0, Math.min(100, ((dAvgRssi + 130) / 50) * 100)) : 0;

        sections.push(`
          <div style="page-break-after:always;font-family:Arial,sans-serif;padding:30px 30px 20px">
            <div style="display:flex;align-items:center;gap:12px;border-bottom:2px solid #e5e7eb;padding-bottom:12px;margin-bottom:16px">
              ${device.type_device === 'Gateway'
                ? '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v6M8 7l4 4 4-4"/><path d="M6 11h12"/><path d="M8 15l-2 3"/><path d="M16 15l2 3"/></svg>'
                : device.type_device === 'Lector'
                ? '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#059669" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M8 7h8M8 11h6"/></svg>'
                : device.type_device === 'SubEstacion'
                ? '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#d97706" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21h16"/><path d="M5 21V7l8-3v17"/><path d="M13 11h6v10"/><path d="M9 12v.01"/><path d="M9 16v.01"/></svg>'
                : '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#7c3aed" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11a3 3 0 100-6 3 3 0 000 6z"/><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/></svg>'}
              <div>
                <h2 style="font-size:16px;color:#111;margin:0">${device.name}</h2>
                <p style="font-size:11px;color:#888;margin:2px 0 0">${device.dev_eui} · ${device.type_device} · ${entryTs} registros</p>
              </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:10px">
              <div style="background:#f9fafb;border-radius:8px;padding:12px;border:1px solid #e5e7eb">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                  <p style="font-size:12px;color:#555;margin:0;text-transform:uppercase;font-weight:700">Batería</p>
                  <p style="font-size:14px;font-weight:700;color:#111;margin:0"><span style="font-size:10px;color:#888;font-weight:400">Prom </span>${dAvgBat != null ? (dAvgBat / 1000).toFixed(2) + 'V' : '—'} · ${dAvgBat != null ? Math.round(dBatPct) + '%' : '—'}</p>
                </div>
                ${bar(dBatPct, dAvgBat != null && dAvgBat / 1000 >= 3.7 ? '#22c55e' : '#f97316')}
                <div style="margin-top:4px">${batSpark}</div>
              </div>
              <div style="background:#f9fafb;border-radius:8px;padding:12px;border:1px solid #e5e7eb">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                  <p style="font-size:12px;color:#555;margin:0;text-transform:uppercase;font-weight:700">Temperatura</p>
                  <p style="font-size:14px;font-weight:700;color:#111;margin:0"><span style="font-size:10px;color:#888;font-weight:400">Prom </span>${dAvgTemp != null ? dAvgTemp.toFixed(1) + '°C' : '—'}</p>
                </div>
                ${bar(dAvgTemp != null ? Math.max(0, Math.min(100, ((dAvgTemp - 10) / 40) * 100)) : 50, '#f97316')}
                <div style="margin-top:4px">${tempSpark}</div>
              </div>
              <div style="background:#f9fafb;border-radius:8px;padding:12px;border:1px solid #e5e7eb">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                  <p style="font-size:12px;color:#555;margin:0;text-transform:uppercase;font-weight:700">SNR</p>
                  <p style="font-size:14px;font-weight:700;color:#111;margin:0"><span style="font-size:10px;color:#888;font-weight:400">Prom </span>${dAvgSnr != null ? dAvgSnr.toFixed(1) + ' dB' : '—'}</p>
                </div>
                ${bar(dSnrPct, '#3b82f6')}
                <div style="margin-top:4px">${snrSpark}</div>
              </div>
              <div style="background:#f9fafb;border-radius:8px;padding:12px;border:1px solid #e5e7eb">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                  <p style="font-size:12px;color:#555;margin:0;text-transform:uppercase;font-weight:700">RSSI</p>
                  <p style="font-size:14px;font-weight:700;color:#111;margin:0"><span style="font-size:10px;color:#888;font-weight:400">Prom </span>${dAvgRssi != null ? dAvgRssi.toFixed(1) + ' dBm' : '—'}</p>
                </div>
                ${bar(dRssiPct, dAvgRssi != null && dAvgRssi < -118 ? '#ef4444' : '#8b5cf6')}
                <div style="margin-top:4px">${rssiSpark}</div>
              </div>
            </div>

            ${devAlerts.length > 0 ? `
            <div style="margin-top:16px">
              <h3 style="font-size:13px;color:#333;margin:0 0 8px">Alertas (${devAlerts.length})</h3>
              <div style="column-count:3;column-gap:16px;column-rule:1px solid #f3f4f6">
                ${devAlerts.map((a: any) => `
                  <div style="font-size:10px;padding:3px 0;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:6px;break-inside:avoid">
                    <span style="color:${a.type === 'critica' || a.type === 'apertura' ? '#ef4444' : '#f59e0b'};font-weight:600;flex-shrink:0">●</span>
                    <span style="font-weight:600;color:#333;flex-shrink:0">${a.type}</span>
                    <span style="color:#888;flex-shrink:0">${format(new Date(a.created_at), "dd/MM HH:mm")}</span>
                    ${a.metadata?.reason ? `<span style="color:#999;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.metadata.reason}</span>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>` : ''}

            ${device.type_device === 'Gateway' ? (() => {
              const lectores = lectorsByGateway.get(device.id) || [];
              if (!lectores.length) return '';
              const lectoresHtml = lectores.map(lector => {
                const le = lectorMap.get(lector.id);
                const lectorAlerts = (data.alerts || []).filter((a: any) => a.device_id === lector.id || a.device_name === lector.name);
                if (!le || !le.ts.length) return `
                  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-bottom:14px">
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="font-size:12px;font-weight:700;color:#047857">${esc(lector.name)}</span>
                      <span style="font-size:10px;color:#888">${esc(lector.dev_eui)} · Lector</span>
                    </div>
                    <p style="font-size:10px;color:#9ca3af;margin:6px 0 0">Sin telemetría en el período</p>
                  </div>`;
                const avgVolt = avg(le.volt);
                const avgPower = avg(le.power);
                const avgCurrent = avg(le.current);
                const avgTemp = avg(le.temp);
                const last = le.ts.length - 1;
                const chargerState = le.chargerState[last];
                const sensors = le.sensores[last] || {};
                const voltSpark = le.volt.length > 1 ? sparkline(le.volt, '#22c55e', 'V', 44, le.ts) : '';
                const powerSpark = le.power.length > 1 ? sparkline(le.power, '#f59e0b', 'W', 44, le.ts) : '';
                const currentSpark = le.current.length > 1 ? sparkline(le.current, '#3b82f6', 'A', 44, le.ts) : '';
                const tempSpark = le.temp.length > 1 ? sparkline(le.temp, '#ef4444', '°C', 44, le.ts) : '';
                const panelVSpark = le.panelV.length > 1 ? sparkline(le.panelV, '#8b5cf6', 'V', 44, le.ts) : '';
                const loadASpark = le.loadA.length > 1 ? sparkline(le.loadA, '#0ea5e9', 'A', 44, le.ts) : '';
                return `
                  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-bottom:14px">
                    <div style="display:flex;align-items:center;gap:8px;border-bottom:1px solid #d1fae5;padding-bottom:8px;margin-bottom:10px">
                      <span style="font-size:12px;font-weight:700;color:#047857">${esc(lector.name)}</span>
                      <span style="font-size:10px;color:#888">${esc(lector.dev_eui)} · Lector</span>
                      <span style="margin-left:auto;font-size:10px;font-weight:600;color:${chargerState === 'Flotación' ? '#16a34a' : chargerState === 'Carga' ? '#d97706' : '#666'}">${esc(chargerState || '—')}</span>
                    </div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
                      <div style="flex:1;min-width:80px;background:#fff;border-radius:6px;padding:8px;text-align:center;border:1px solid #d1fae5"><p style="font-size:8px;color:#888;margin:0;text-transform:uppercase">Batería</p><p style="font-size:15px;font-weight:700;color:#111;margin:2px 0 0">${avgVolt != null ? avgVolt.toFixed(2) + 'V' : '—'}</p></div>
                      <div style="flex:1;min-width:80px;background:#fff;border-radius:6px;padding:8px;text-align:center;border:1px solid #d1fae5"><p style="font-size:8px;color:#888;margin:0;text-transform:uppercase">Potencia</p><p style="font-size:15px;font-weight:700;color:#111;margin:2px 0 0">${avgPower != null ? avgPower.toFixed(1) + 'W' : '—'}</p></div>
                      <div style="flex:1;min-width:80px;background:#fff;border-radius:6px;padding:8px;text-align:center;border:1px solid #d1fae5"><p style="font-size:8px;color:#888;margin:0;text-transform:uppercase">Corriente</p><p style="font-size:15px;font-weight:700;color:#111;margin:2px 0 0">${avgCurrent != null ? avgCurrent.toFixed(2) + 'A' : '—'}</p></div>
                      <div style="flex:1;min-width:80px;background:#fff;border-radius:6px;padding:8px;text-align:center;border:1px solid #d1fae5"><p style="font-size:8px;color:#888;margin:0;text-transform:uppercase">Temp</p><p style="font-size:15px;font-weight:700;color:#111;margin:2px 0 0">${avgTemp != null ? avgTemp.toFixed(1) + '°C' : '—'}</p></div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                      <div>${voltSpark ? `<p style="font-size:9px;color:#555;margin:0 0 2px;font-weight:600">Batería (V)</p>${voltSpark}` : ''}</div>
                      <div>${powerSpark ? `<p style="font-size:9px;color:#555;margin:0 0 2px;font-weight:600">Potencia panel (W)</p>${powerSpark}` : ''}</div>
                      <div>${currentSpark ? `<p style="font-size:9px;color:#555;margin:0 0 2px;font-weight:600">Corriente batería (A)</p>${currentSpark}` : ''}</div>
                      <div>${tempSpark ? `<p style="font-size:9px;color:#555;margin:0 0 2px;font-weight:600">Temperatura (°C)</p>${tempSpark}` : ''}</div>
                      <div>${panelVSpark ? `<p style="font-size:9px;color:#555;margin:0 0 2px;font-weight:600">Voltaje panel (V)</p>${panelVSpark}` : ''}</div>
                      <div>${loadASpark ? `<p style="font-size:9px;color:#555;margin:0 0 2px;font-weight:600">Corriente carga (A)</p>${loadASpark}` : ''}</div>
                    </div>
                    ${sensors && Object.keys(sensors).length ? `
                    <div style="margin-top:8px;font-size:9px;color:#666;display:flex;gap:10px;flex-wrap:wrap">
                      ${sensors.presenseSensor != null ? `<span>Presencia: <b>${sensors.presenseSensor ? 'Sí' : 'No'}</b></span>` : ''}
                      ${sensors.openingDoorSensor != null ? `<span>Puerta: <b>${sensors.openingDoorSensor ? 'Abierta' : 'Cerrada'}</b></span>` : ''}
                      ${sensors.distancePrecenseSensor != null ? `<span>Distancia: <b>${sensors.distancePrecenseSensor}</b></span>` : ''}
                    </div>` : ''}
                    ${lectorAlerts.length > 0 ? `
                    <div style="margin-top:10px;border-top:1px solid #d1fae5;padding-top:8px">
                      <p style="font-size:11px;font-weight:700;color:#dc2626;margin:0 0 6px">Alertas del lector (${lectorAlerts.length})</p>
                      <div style="column-count:2;column-gap:12px;column-rule:1px solid #f3f4f6">
                        ${lectorAlerts.map((a: any) => `
                          <div style="font-size:9px;padding:2px 0;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:5px;break-inside:avoid">
                            <span style="color:${a.type === 'critica' || a.type === 'apertura' ? '#ef4444' : '#f59e0b'};font-weight:600">●</span>
                            <span style="font-weight:600;color:#333">${esc(a.type)}</span>
                            <span style="color:#888">${format(new Date(a.created_at), "dd/MM HH:mm")}</span>
                          </div>`).join('')}
                      </div>
                    </div>` : ''}
                  </div>`;
              }).join('');
              return `
                <div style="margin-top:20px;border-top:2px solid #e5e7eb;padding-top:14px">
                  <h3 style="font-size:13px;color:#333;margin:0 0 10px">Lectores asignados (${lectores.length})</h3>
                  ${lectoresHtml}
                </div>`;
            })() : ''}
          </div>
        `);
      });

      // ─── Tabla grande final: TODOS los datos seleccionados en el rango ───
      const movLabel = (o: any) => {
        if (!o) return { text: '—', color: '#9ca3af' };
        if (o.packetType?.startsWith?.('COMMAND')) return { text: o.systemMessage || o.packetType, color: '#0891b2' };
        if (o.packetType === 'CONFIG_REPORT') return { text: 'Config Report', color: '#7c3aed' };
        if (o.packetType === 'QA_VALIDATION') return { text: 'QA Validación', color: '#7c3aed' };
        if (o.systemStatus?.freeFallFlag) return { text: 'Caída libre', color: '#dc2626' };
        if (o.systemStatus?.motionFlag) return { text: 'Movimiento', color: '#ca8a04' };
        if (o.voltage_mV != null && o.temperature_C != null) return { text: 'KeepAlive', color: '#16a34a' };
        return { text: '—', color: '#9ca3af' };
      };
      const allRows = (data.telemetry || []).map((t: any) => {
        const mov = movLabel(t.object);
        const rx = Array.isArray(t.rxinfo) ? t.rxinfo : typeof t.rxinfo === 'string' ? (() => { try { return JSON.parse(t.rxinfo); } catch { return []; } })() : [];
        const gw = rx[0] || {};
        return `<tr>
          <td style="padding:4px 6px;border:1px solid #e5e7eb;white-space:nowrap;font-size:9px">${esc(t.device_name || '—')}</td>
          <td style="padding:4px 6px;border:1px solid #e5e7eb;white-space:nowrap;font-size:9px">${format(new Date(t.ts), "dd/MM HH:mm:ss")}</td>
          <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px">${esc(t.object?.packetType || '—')}</td>
          <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px">${t.object?.voltage_mV != null ? Number(t.object.voltage_mV).toFixed(0) + ' mV' : '—'}</td>
          <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px">${t.object?.temperature_C != null ? Number(t.object.temperature_C).toFixed(1) + '°' : '—'}</td>
          <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px">${t.object?.latitude != null ? Number(t.object.latitude).toFixed(6) : '—'}</td>
          <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px">${t.object?.longitude != null ? Number(t.object.longitude).toFixed(6) : '—'}</td>
          <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px">${gw?.snr != null ? Number(gw.snr).toFixed(1) : '—'}</td>
          <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px">${gw?.rssi != null ? Number(gw.rssi).toFixed(1) : '—'}</td>
          <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px">${t.object?.satellites != null ? t.object.satellites : '—'}</td>
          <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px">${esc(t.object?.systemStatus?.operatingMode || t.object?.operatingMode || '—')}</td>
          <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px;color:${mov.color};font-weight:600">${esc(mov.text)}</td>
        </tr>`;
      }).join('');

      sections.push(`<div style="font-family:Arial,sans-serif;padding:24px">
        <div style="border-bottom:2px solid #e5e7eb;padding-bottom:10px;margin-bottom:14px">
          <h2 style="font-size:15px;color:#111;margin:0">Telemetría completa</h2>
          <p style="font-size:10px;color:#888;margin:2px 0 0">Todos los registros de telemetry_data_all en el período ${fromDate} → ${toDate} · ${data.telemetry?.length || 0} registros</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:9px">
          <thead><tr style="background:#f3f4f6">
            <th style="padding:5px 6px;text-align:left;border:1px solid #e5e7eb">Dispositivo</th>
            <th style="padding:5px 6px;text-align:left;border:1px solid #e5e7eb">Fecha</th>
            <th style="padding:5px 6px;text-align:left;border:1px solid #e5e7eb">Tipo</th>
            <th style="padding:5px 6px;text-align:center;border:1px solid #e5e7eb">Batería</th>
            <th style="padding:5px 6px;text-align:center;border:1px solid #e5e7eb">Temp</th>
            <th style="padding:5px 6px;text-align:left;border:1px solid #e5e7eb">Latitud</th>
            <th style="padding:5px 6px;text-align:left;border:1px solid #e5e7eb">Longitud</th>
            <th style="padding:5px 6px;text-align:center;border:1px solid #e5e7eb">SNR</th>
            <th style="padding:5px 6px;text-align:center;border:1px solid #e5e7eb">RSSI</th>
            <th style="padding:5px 6px;text-align:center;border:1px solid #e5e7eb">Sat</th>
            <th style="padding:5px 6px;text-align:center;border:1px solid #e5e7eb">Modo</th>
            <th style="padding:5px 6px;text-align:left;border:1px solid #e5e7eb">Movimiento</th>
          </tr></thead>
          <tbody>${allRows || `<tr><td colspan="12" style="padding:8px;border:1px solid #e5e7eb;text-align:center;color:#9ca3af">Sin telemetría en el período</td></tr>`}</tbody>
        </table>
      </div>`);

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
        <style>
          @page{margin:15mm 12mm}
          body{font-family:Arial,sans-serif;color:#222;background:#fff;margin:0;padding:0}
          @media print{body{padding:0}}
        </style></head><body>
        ${sections.join('\n')}
      </body></html>`;

      const win = window.open('', '_blank');
      win?.document.write(html);
      win?.document.close();
      setTimeout(() => win?.print(), 500);
    } catch (e) {
      console.error('Error generando reporte:', e);
    }
    setLoading(false);
  };

  // ═══════════════════════════════════════════
  // REPORTE SALUD DE BATERÍAS
  // ═══════════════════════════════════════════
  const generateBatteryPDF = async () => {
    setLoading(true);
    try {
      const data = await monitorService.getReportBattery({
        deviceIds: [...selectedIds],
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
      });
      setReportData(data);

      const selectedDevices = (allDevices || []).filter(d => selectedIds.has(d.id));
      const title = `Baterías - ${format(new Date(), "yyyy-MM-dd")}`;
      const deviceMap = new Map<number, { voltages: number[]; timestamps: Date[] }>();
      selectedDevices.forEach(d => deviceMap.set(d.id, { voltages: [], timestamps: [] }));

      data.telemetry.forEach((t: any) => {
        const entry = deviceMap.get(t.device_id);
        if (!entry) return;
        const mv = t.object?.voltage_mV != null ? Number(t.object.voltage_mV) : null;
        if (mv != null) entry.voltages.push(mv);
        entry.timestamps.push(new Date(t.ts));
      });

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

      const sparkline = (voltages: number[], color: string, height = 40) => {
        if (voltages.length < 2) return '';
        const min = Math.min(...voltages);
        const max = Math.max(...voltages);
        const range = max - min || 1;
        const w = 360;
        const pts = voltages.map((v, i) => `${(i / (voltages.length - 1)) * w},${height - 6 - ((v - min) / range) * (height - 12)}`).join(' ');
        return `<svg viewBox="0 0 ${w} ${height}" style="display:block;width:100%;height:auto"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      };

      const bar = (pct: number, c: string) =>
        `<div style="height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.max(0, Math.min(100, pct))}%;background:${c};border-radius:3px"></div></div>`;

      const sections: string[] = [];
      sections.push(`
        <div style="page-break-after:always;font-family:Arial,sans-serif;padding:30px">
          <div style="text-align:center;padding:40px 20px">
            <h1 style="font-size:22px;color:#111;margin:0 0 6px">Reporte de Salud de Baterías</h1>
            <p style="font-size:12px;color:#666;margin:0 0 24px">${fromDate} → ${toDate} · ${selectedDevices.length} dispositivos</p>
          </div>

          <div style="margin-bottom:20px">
            <h2 style="font-size:14px;color:#333;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin:0 0 12px">Resumen general</h2>
            <div style="display:flex;gap:12px;flex-wrap:wrap">
              ${(() => {
                const allMv = data.telemetry.map((t: any) => t.object?.voltage_mV != null ? Number(t.object.voltage_mV) : null).filter((v: any): v is number => v != null);
                const avgV = allMv.length > 0 ? avg(allMv) / 1000 : 0;
                const lowBat = allMv.filter((v: number) => v < 3400).length;
                const critBat = allMv.filter((v: number) => v < 3200).length;
                return `
                <div style="flex:1;min-width:120px;background:#f9fafb;border-radius:8px;padding:12px;border:1px solid #e5e7eb;text-align:center">
                  <p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Voltaje promedio</p>
                  <p style="font-size:20px;font-weight:700;color:#111;margin:4px 0 0">${avgV.toFixed(3)}V</p>
                </div>
                <div style="flex:1;min-width:120px;background:#f9fafb;border-radius:8px;padding:12px;border:1px solid #e5e7eb;text-align:center">
                  <p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Batería baja</p>
                  <p style="font-size:20px;font-weight:700;color:#f97316;margin:4px 0 0">${lowBat}</p>
                </div>
                <div style="flex:1;min-width:120px;background:#f9fafb;border-radius:8px;padding:12px;border:1px solid #e5e7eb;text-align:center">
                  <p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Batería crítica</p>
                  <p style="font-size:20px;font-weight:700;color:#ef4444;margin:4px 0 0">${critBat}</p>
                </div>
                <div style="flex:1;min-width:120px;background:#f9fafb;border-radius:8px;padding:12px;border:1px solid #e5e7eb;text-align:center">
                  <p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Total registros</p>
                  <p style="font-size:20px;font-weight:700;color:#111;margin:4px 0 0">${data.total.toLocaleString()}</p>
                </div>`;
              })()}
            </div>
          </div>
        </div>
      `);

      selectedDevices.forEach((device) => {
        const entry = deviceMap.get(device.id);
        const v = entry?.voltages || [];
        const ts = entry?.timestamps || [];
        if (v.length < 2) return;
        const avgV = avg(v) / 1000;
        const minV = Math.min(...v) / 1000;
        const maxV = Math.max(...v) / 1000;
        const lastV = v[v.length - 1] / 1000;
        const pct = Math.max(0, Math.min(100, ((lastV - 3.3) / 0.9) * 100));
        const healthColor = avgV >= 3.7 ? '#22c55e' : avgV >= 3.4 ? '#f97316' : '#ef4444';

        sections.push(`
          <div style="page-break-after:always;font-family:Arial,sans-serif;padding:24px">
            <div style="display:flex;align-items:center;gap:10px;border-bottom:2px solid #e5e7eb;padding-bottom:10px;margin-bottom:14px">
              <div>
                <h2 style="font-size:15px;color:#111;margin:0">${device.name}</h2>
                <p style="font-size:10px;color:#888;margin:2px 0 0">${device.dev_eui} · ${device.type_device}</p>
              </div>
            </div>

            <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
              <div style="flex:1;min-width:80px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb">
                <p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Promedio</p>
                <p style="font-size:15px;font-weight:700;color:${healthColor};margin:2px 0 0">${avgV.toFixed(3)}V</p>
              </div>
              <div style="flex:1;min-width:80px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb">
                <p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Mínimo</p>
                <p style="font-size:15px;font-weight:700;color:#111;margin:2px 0 0">${minV.toFixed(3)}V</p>
              </div>
              <div style="flex:1;min-width:80px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb">
                <p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Máximo</p>
                <p style="font-size:15px;font-weight:700;color:#111;margin:2px 0 0">${maxV.toFixed(3)}V</p>
              </div>
              <div style="flex:1;min-width:80px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb">
                <p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Actual</p>
                <p style="font-size:15px;font-weight:700;color:#111;margin:2px 0 0">${lastV.toFixed(3)}V</p>
              </div>
              <div style="flex:1;min-width:80px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb">
                <p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Salud</p>
                <p style="font-size:15px;font-weight:700;color:#111;margin:2px 0 0">${Math.round(pct)}%</p>
              </div>
            </div>

            ${bar(pct, healthColor)}
            <p style="font-size:10px;color:#888;margin:4px 0 12px">Nivel de batería: ${Math.round(pct)}%</p>

            <div style="margin-top:8px">${sparkline(v, healthColor, 40)}</div>
            <p style="font-size:8px;color:#999;margin:2px 0 0">${v.length} registros · ${format(ts[0], "dd/MM HH:mm")} → ${format(ts[ts.length - 1], "dd/MM HH:mm")}</p>
          </div>
        `);
      });

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
        <style>@page{margin:12mm 10mm}body{font-family:Arial,sans-serif;color:#222;background:#fff;margin:0;padding:0}</style></head><body>
        ${sections.join('\n')}
      </body></html>`;
      const win = window.open('', '_blank');
      win?.document.write(html);
      win?.document.close();
      setTimeout(() => win?.print(), 500);
    } catch (e) { console.error('Error en reporte baterías:', e); }
    setLoading(false);
  };

  // ═══════════════════════════════════════════
  // REPORTE CONECTIVIDAD
  // ═══════════════════════════════════════════
  const generateConnectivityPDF = async () => {
    setLoading(true);
    try {
      const data = await monitorService.getReportConnectivity({
        deviceIds: [...selectedIds],
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
      });
      setReportData(data);

      const selectedDevices = (allDevices || []).filter(d => selectedIds.has(d.id));
      const title = `Conectividad - ${format(new Date(), "yyyy-MM-dd")}`;
      const gateways = data.gateways || [];

      const deviceMap = new Map<number, { snr: number[]; rssi: number[]; gwCount: number[]; timestamps: Date[] }>();
      selectedDevices.forEach(d => deviceMap.set(d.id, { snr: [], rssi: [], gwCount: [], timestamps: [] }));

      data.telemetry.forEach((t: any) => {
        const entry = deviceMap.get(t.device_id);
        if (!entry) return;
        const rx = Array.isArray(t.rxinfo) ? t.rxinfo : typeof t.rxinfo === 'string' ? (() => { try { return JSON.parse(t.rxinfo); } catch { return []; } })() : [];
        const gw = rx[0] || {};
        if (gw?.snr != null) entry.snr.push(Number(gw.snr));
        if (gw?.rssi != null) entry.rssi.push(Number(gw.rssi));
        entry.gwCount.push(rx.length);
        entry.timestamps.push(new Date(t.ts));
      });

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const sparkline = (vals: number[], color: string, height = 36) => {
        if (vals.length < 2) return '';
        const mn = Math.min(...vals);
        const mx = Math.max(...vals);
        const rng = mx - mn || 1;
        const w = 360;
        const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${height - 6 - ((v - mn) / rng) * (height - 12)}`).join(' ');
        return `<svg viewBox="0 0 ${w} ${height}" style="display:block;width:100%;height:auto"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      };

      const sections: string[] = [];
      sections.push(`
        <div style="page-break-after:always;font-family:Arial,sans-serif;padding:30px">
          <div style="text-align:center;padding:40px 20px">
            <h1 style="font-size:22px;color:#111;margin:0 0 6px">Reporte de Conectividad</h1>
            <p style="font-size:12px;color:#666;margin:0 0 24px">${fromDate} → ${toDate} · ${selectedDevices.length} dispositivos · ${gateways.length} gateways</p>
          </div>

          <div style="margin-bottom:20px">
            <h2 style="font-size:14px;color:#333;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin:0 0 12px">Resumen de gateways</h2>
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead><tr style="background:#f3f4f6">
                <th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Gateway</th>
                <th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Firmware</th>
                <th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">IP</th>
              </tr></thead>
              <tbody>
                ${gateways.map((gw: any) => `
                  <tr>
                    <td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:600">${gw.name}</td>
                    <td style="padding:5px 8px;border:1px solid #e5e7eb;color:#666">${gw.firmware_version || '—'}</td>
                    <td style="padding:5px 8px;border:1px solid #e5e7eb;color:#666">${gw.ip_internal || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `);

      selectedDevices.forEach((device) => {
        const entry = deviceMap.get(device.id);
        if (!entry || entry.snr.length < 2) return;
        const avgSnr = avg(entry.snr);
        const avgRssi = avg(entry.rssi);
        const avgGwCount = avg(entry.gwCount);
        const snrColor = avgSnr >= 10 ? '#22c55e' : avgSnr >= 5 ? '#f97316' : '#ef4444';
        const rssiColor = avgRssi >= -100 ? '#22c55e' : avgRssi >= -115 ? '#f97316' : '#ef4444';

        sections.push(`
          <div style="page-break-after:always;font-family:Arial,sans-serif;padding:24px">
            <div style="display:flex;align-items:center;gap:10px;border-bottom:2px solid #e5e7eb;padding-bottom:10px;margin-bottom:14px">
              <div>
                <h2 style="font-size:15px;color:#111;margin:0">${device.name}</h2>
                <p style="font-size:10px;color:#888;margin:2px 0 0">${device.dev_eui} · ${device.type_device}</p>
              </div>
            </div>

            <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
              <div style="flex:1;min-width:80px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb">
                <p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">SNR Prom</p>
                <p style="font-size:15px;font-weight:700;color:${snrColor};margin:2px 0 0">${avgSnr.toFixed(1)} dB</p>
              </div>
              <div style="flex:1;min-width:80px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb">
                <p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">RSSI Prom</p>
                <p style="font-size:15px;font-weight:700;color:${rssiColor};margin:2px 0 0">${avgRssi.toFixed(1)} dBm</p>
              </div>
              <div style="flex:1;min-width:80px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb">
                <p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Gateways</p>
                <p style="font-size:15px;font-weight:700;color:#111;margin:2px 0 0">${avgGwCount.toFixed(1)}</p>
              </div>
              <div style="flex:1;min-width:80px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb">
                <p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Registros</p>
                <p style="font-size:15px;font-weight:700;color:#111;margin:2px 0 0">${entry.snr.length}</p>
              </div>
            </div>

            <p style="font-size:10px;color:#888;margin:0 0 4px;text-transform:uppercase;font-weight:600">SNR</p>
            ${sparkline(entry.snr, '#3b82f6', 36)}

            <p style="font-size:10px;color:#888;margin:8px 0 4px;text-transform:uppercase;font-weight:600">RSSI</p>
            ${sparkline(entry.rssi, '#8b5cf6', 36)}

            <p style="font-size:8px;color:#999;margin:4px 0 0">${entry.snr.length} registros · ${format(entry.timestamps[0], "dd/MM HH:mm")} → ${format(entry.timestamps[entry.timestamps.length - 1], "dd/MM HH:mm")}</p>
          </div>
        `);
      });

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
        <style>@page{margin:12mm 10mm}body{font-family:Arial,sans-serif;color:#222;background:#fff;margin:0;padding:0}</style></head><body>
        ${sections.join('\n')}
      </body></html>`;
      const win = window.open('', '_blank');
      win?.document.write(html);
      win?.document.close();
      setTimeout(() => win?.print(), 500);
    } catch (e) { console.error('Error en reporte conectividad:', e); }
    setLoading(false);
  };

  // ═══════════════════════════════════════════
  // REPORTE ALERTAS Y TRACKING (fusionado)
  // - GPS: sección por dispositivo con recorridos y mapas
  // - Otros tipos: sección por dispositivo con sus alertas
  // ═══════════════════════════════════════════
  const generateAlertsPDF = async () => {
    setLoading(true);
    try {
      const params = { deviceIds: [...selectedIds], from: fromDate ? new Date(fromDate).toISOString() : undefined, to: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined };
      const [alertsData, gpsData] = await Promise.all([
        monitorService.getReportAlerts(params),
        monitorService.getReportGps(params),
      ]);
      setReportData(alertsData);
      const selectedDevices = (allDevices || []).filter(d => selectedIds.has(d.id));
      const title = `Alertas y Tracking - ${format(new Date(), "yyyy-MM-dd")}`;
      const alerts = alertsData?.alerts || [];
      const resTimes = alertsData?.resolutionTimes || [];
      const gpsDevices = selectedDevices.filter(d => d.type_device === 'Gps');
      const gpsIds = new Set(gpsDevices.map(d => d.id));

      // Mapas GPS: acumular telemetría por dispositivo
      const deviceMap = new Map<number, { lats: number[]; lngs: number[]; speeds: number[]; timestamps: Date[]; rows: any[] }>();
      gpsDevices.forEach(d => deviceMap.set(d.id, { lats: [], lngs: [], speeds: [], timestamps: [], rows: [] }));
      (gpsData?.telemetry || []).forEach((t: any) => { const e = deviceMap.get(t.device_id); if (!e) return; if (t.object?.latitude) e.lats.push(Number(t.object.latitude)); if (t.object?.longitude) e.lngs.push(Number(t.object.longitude)); if (t.object?.speed) e.speeds.push(Number(t.object.speed)); e.timestamps.push(new Date(t.ts)); e.rows.push(t); });

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
      const criticals = alerts.filter((a: any) => a.type === 'critica' || a.type === 'apertura');
      const attentions = alerts.filter((a: any) => a.type === 'atencion' || a.type === 'apertura' || a.type === 'presencia');

      const sections = [`<div style="font-family:Arial,sans-serif;padding:30px">
        <div style="text-align:center;padding:30px 20px"><h1 style="font-size:22px;color:#111;margin:0 0 6px">Reporte de Alertas y Tracking</h1><p style="font-size:12px;color:#666">${fromDate} → ${toDate} · ${selectedDevices.length} dispositivos · ${alerts.length} alertas</p></div>
        <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
          <div style="flex:1;min-width:100px;background:#fef2f2;border-radius:8px;padding:12px;text-align:center;border:1px solid #fecaca"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Críticas</p><p style="font-size:20px;font-weight:700;color:#ef4444;margin:2px 0 0">${criticals.length}</p></div>
          <div style="flex:1;min-width:100px;background:#fffbeb;border-radius:8px;padding:12px;text-align:center;border:1px solid #fde68a"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Atención</p><p style="font-size:20px;font-weight:700;color:#d97706;margin:2px 0 0">${attentions.length}</p></div>
          <div style="flex:1;min-width:100px;background:#f0fdf4;border-radius:8px;padding:12px;text-align:center;border:1px solid #bbf7d0"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Resueltas</p><p style="font-size:20px;font-weight:700;color:#16a34a;margin:2px 0 0">${alerts.filter((a: any) => a.status === 'resolved' || a.resolved_at).length}</p></div>
          <div style="flex:1;min-width:100px;background:#f9fafb;border-radius:8px;padding:12px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Tiempo prom. resolución</p><p style="font-size:20px;font-weight:700;color:#111;margin:2px 0 0">${resTimes.length > 0 ? (resTimes.reduce((s: number, r: any) => s + Number(r.avg_hours), 0) / resTimes.length).toFixed(1) + 'h' : '—'}</p></div>
        </div>
        ${resTimes.length ? `<h2 style="font-size:13px;color:#333;margin:0 0 8px">Tiempo de resolución por tipo</h2><table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px"><thead><tr style="background:#f3f4f6"><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Tipo</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Promedio (horas)</th></tr></thead><tbody>${resTimes.map((r: any) => `<tr><td style="padding:5px 8px;border:1px solid #e5e7eb">${esc(r.type)}</td><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:700">${Number(r.avg_hours).toFixed(1)}h</td></tr>`).join('')}</tbody></table>` : ''}
      </div>`];

      // Helper: mapa Leaflet real del recorrido de una alerta
      const trackMaps: { id: string; label: string; points: any[] }[] = [];
      let mapCounter = 0;
      const trackMapDiv = (pts: any[], label: string) => {
        if (!pts || pts.length < 2) return '<p style="color:#9ca3af;font-size:10px;margin:0">Sin recorrido registrado</p>';
        const id = `track-map-${++mapCounter}`;
        trackMaps.push({ id, label, points: pts });
        const startT = format(new Date(pts[0].timestamp), "dd/MM HH:mm");
        const endT = format(new Date(pts[pts.length - 1].timestamp), "dd/MM HH:mm");
        return `<div style="margin-top:8px">
          <div id="${id}" class="track-map" style="width:690px;max-width:100%;height:320px;border:1px solid #e2e8f0;border-radius:8px;background:#e8e8e8;overflow:hidden"></div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:8px;color:#888">
            <span>🟢 Inicio ${startT}</span>
            <span>${pts.length} puntos</span>
            <span>🔴 Fin ${endT}</span>
          </div>
        </div>`;
      };

      // ─── 1) Sección por dispositivo ───
      // GPS → resumen + cada alerta con su recorrido (mapa)
      // Otros → sus alertas (tipos y detalles)
      selectedDevices.forEach((device) => {
        const isGps = gpsIds.has(device.id);
        const e = deviceMap.get(device.id);
        const devAlerts = alerts.filter((a: any) => a.device_id === device.id || a.device_name === device.name);

        const alertsHtml = devAlerts.length > 0 ? devAlerts.map((a: any) => `
          <div style="border:1px solid ${isGps ? '#fecaca' : '#f3f4f6'};border-radius:8px;margin-bottom:12px;padding:10px;background:#fff">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="background:${a.type === 'critica' || a.type === 'apertura' || a.type === 'presencia' ? '#fef2f2' : '#fefce8'};color:${a.type === 'critica' || a.type === 'apertura' || a.type === 'presencia' ? '#dc2626' : '#a16207'};font-weight:700;font-size:10px;text-transform:uppercase;padding:3px 8px;border-radius:4px">${esc(a.type)}</span>
              <span style="font-size:10px;color:${a.resolved_at ? '#16a34a' : '#dc2626'};font-weight:600">${a.resolved_at ? '● Resuelta' : '● Activa'}</span>
              <span style="font-size:10px;color:#666;white-space:nowrap">${format(new Date(a.created_at), "dd/MM HH:mm:ss")}</span>
              ${a.resolved_at ? `<span style="font-size:9px;color:#888">→ ${format(new Date(a.resolved_at), "dd/MM HH:mm")}</span>` : ''}
            </div>
            ${a.metadata?.reason ? `<p style="font-size:10px;color:#555;margin:6px 0 0"><b>Motivo:</b> ${esc(a.metadata.reason)}</p>` : ''}
            ${a.metadata?.details ? `<p style="font-size:9px;color:#888;margin:2px 0 0">${esc(typeof a.metadata.details === 'string' ? a.metadata.details : JSON.stringify(a.metadata.details))}</p>` : ''}
            ${isGps ? trackMapDiv(a.tracking_data || [], `${esc(a.type)} ${format(new Date(a.created_at), "dd/MM HH:mm")}`) : ''}
          </div>`).join('') : '<p style="font-size:11px;color:#9ca3af;margin:0">Sin alertas en el período</p>';

        sections.push(`<div style="page-break-after:always;font-family:Arial,sans-serif;padding:24px">
          <div style="border-bottom:2px solid #e5e7eb;padding-bottom:10px;margin-bottom:14px"><h2 style="font-size:15px;color:#111;margin:0">${esc(device.name)}</h2><p style="font-size:10px;color:#888;margin:2px 0 0">${esc(device.dev_eui)} · ${esc(device.type_device)}</p></div>
          ${isGps && e ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
            <div style="flex:1;min-width:70px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Puntos</p><p style="font-size:16px;font-weight:700;color:#111;margin:2px 0 0">${e.rows.length}</p></div>
            <div style="flex:1;min-width:70px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Vel. Prom</p><p style="font-size:16px;font-weight:700;color:#111;margin:2px 0 0">${avg(e.speeds).toFixed(1)} m/s</p></div>
            <div style="flex:1;min-width:70px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Inicio</p><p style="font-size:11px;font-weight:600;color:#666;margin:2px 0 0">${e.timestamps.length ? format(e.timestamps[0], "dd/MM HH:mm") : '—'}</p></div>
            <div style="flex:1;min-width:70px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Fin</p><p style="font-size:11px;font-weight:600;color:#666;margin:2px 0 0">${e.timestamps.length ? format(e.timestamps[e.timestamps.length-1], "dd/MM HH:mm") : '—'}</p></div>
          </div>` : ''}
          <div style="margin-top:6px">
            <h3 style="font-size:12px;color:#333;margin:0 0 10px;text-transform:uppercase">${isGps ? `Alertas y recorridos (${devAlerts.length})` : `Alertas (${devAlerts.length})`}</h3>
            ${alertsHtml}
          </div>
        </div>`);
      });

      // ─── 2) Tabla grande final: telemetría de los GPS seleccionados ───
      const movLabel = (o: any) => {
        if (!o) return { text: '—', color: '#9ca3af' };
        if (o.packetType?.startsWith?.('COMMAND')) return { text: o.systemMessage || o.packetType, color: '#0891b2' };
        if (o.packetType === 'CONFIG_REPORT') return { text: 'Config Report', color: '#7c3aed' };
        if (o.packetType === 'QA_VALIDATION') return { text: 'QA Validación', color: '#7c3aed' };
        if (o.systemStatus?.freeFallFlag) return { text: 'Caída libre', color: '#dc2626' };
        if (o.systemStatus?.motionFlag) return { text: 'Movimiento', color: '#ca8a04' };
        if (o.voltage_mV != null && o.temperature_C != null) return { text: 'KeepAlive', color: '#16a34a' };
        return { text: '—', color: '#9ca3af' };
      };
      const allRows = (gpsData?.telemetry || [])
        .map((t: any) => {
          const mov = movLabel(t.object);
          return `<tr>
            <td style="padding:4px 6px;border:1px solid #e5e7eb;white-space:nowrap;font-size:9px">${esc(t.device_name || '—')}</td>
            <td style="padding:4px 6px;border:1px solid #e5e7eb;white-space:nowrap;font-size:9px">${format(new Date(t.ts), "dd/MM HH:mm:ss")}</td>
            <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px">${esc(t.object?.packetType || '—')}</td>
            <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px">${t.object?.voltage_mV != null ? Number(t.object.voltage_mV).toFixed(0) + ' mV' : '—'}</td>
            <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px">${t.object?.temperature_C != null ? Number(t.object.temperature_C).toFixed(1) + '°' : '—'}</td>
            <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px">${t.object?.latitude != null ? Number(t.object.latitude).toFixed(6) : '—'}</td>
            <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px">${t.object?.longitude != null ? Number(t.object.longitude).toFixed(6) : '—'}</td>
            <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px">${t.object?.satellites != null ? t.object.satellites : '—'}</td>
            <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px">${esc(t.object?.systemStatus?.operatingMode || t.object?.operatingMode || '—')}</td>
            <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px;color:${mov.color};font-weight:600">${esc(mov.text)}</td>
          </tr>`;
        }).join('');

      if (gpsData?.telemetry?.length) {
        sections.push(`<div style="font-family:Arial,sans-serif;padding:24px">
          <div style="border-bottom:2px solid #e5e7eb;padding-bottom:10px;margin-bottom:14px">
            <h2 style="font-size:15px;color:#111;margin:0">Telemetría completa (GPS)</h2>
            <p style="font-size:10px;color:#888;margin:2px 0 0">Todos los registros de telemetry_data_all en el período ${fromDate} → ${toDate} · ${gpsData.telemetry.length} registros</p>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:9px">
            <thead><tr style="background:#f3f4f6">
              <th style="padding:5px 6px;text-align:left;border:1px solid #e5e7eb">Dispositivo</th>
              <th style="padding:5px 6px;text-align:left;border:1px solid #e5e7eb">Fecha</th>
              <th style="padding:5px 6px;text-align:left;border:1px solid #e5e7eb">Tipo</th>
              <th style="padding:5px 6px;text-align:center;border:1px solid #e5e7eb">Batería</th>
              <th style="padding:5px 6px;text-align:center;border:1px solid #e5e7eb">Temp</th>
              <th style="padding:5px 6px;text-align:left;border:1px solid #e5e7eb">Latitud</th>
              <th style="padding:5px 6px;text-align:left;border:1px solid #e5e7eb">Longitud</th>
              <th style="padding:5px 6px;text-align:center;border:1px solid #e5e7eb">Sat</th>
              <th style="padding:5px 6px;text-align:center;border:1px solid #e5e7eb">Modo</th>
              <th style="padding:5px 6px;text-align:left;border:1px solid #e5e7eb">Movimiento</th>
            </tr></thead>
            <tbody>${allRows}</tbody>
          </table>
        </div>`);
      }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          @page{margin:12mm 10mm}
          body{font-family:Arial,sans-serif;color:#222;background:#fff;margin:0;padding:0}
          .leaflet-container{background:#dfe6ea}
          .leaflet-control-attribution{font-size:8px !important}
          .track-map{page-break-inside:avoid}
        </style>
      </head><body>
        ${sections.join('\n')}
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
        <script>
          window.__TRACK_MAPS__ = ${JSON.stringify(trackMaps)};
          window.__MAPS__ = [];
          function initMaps() {
            var maps = window.__TRACK_MAPS__ || [];
            if (maps.length === 0) { setTimeout(function(){ window.print(); }, 400); return; }
            var pending = 0;
            function checkDone() {
              if (pending <= 0) {
                setTimeout(function(){
                  window.__MAPS__.forEach(function(mm){
                    try { mm.invalidateSize(); } catch(e){}
                  });
                  setTimeout(function(){ window.print(); }, 700);
                }, 250);
              }
            }
            maps.forEach(function(m) {
              pending++;
              var finished = false;
              function done() {
                if (finished) return;
                finished = true;
                pending--;
                checkDone();
              }
              var el = document.getElementById(m.id);
              if (!el) { done(); return; }
              try {
                var map = L.map(m.id, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
                window.__MAPS__.push(map);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
                var pts = m.points.map(function(p){ return [parseFloat(p.latitude), parseFloat(p.longitude)]; });
                L.polyline(pts, { color: '#ef4444', weight: 3, opacity: 0.85 }).addTo(map);
                pts.forEach(function(pos, i) {
                  var isFirst = i === 0, isLast = i === pts.length - 1;
                  var color = isFirst ? '#22c55e' : isLast ? '#ef4444' : '#3b82f6';
                  L.circleMarker(pos, { radius: isFirst || isLast ? 8 : 4, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9 }).addTo(map);
                });
                map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
                map.whenReady(function(){
                  setTimeout(function(){ map.invalidateSize(); }, 100);
                });
                map.on('load', done);
                setTimeout(done, 8000);
              } catch (e) { done(); }
            });
          }
          if (document.readyState === 'complete') initMaps();
          else window.addEventListener('load', initMaps);
        <\/script>
      </body></html>`;
      const win = window.open('', '_blank', 'width=1000,height=1400'); win?.document.write(html); win?.document.close();
    } catch (e) { console.error('Error alertas:', e); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-bg-100 border border-border/40 shadow-2xl w-full max-w-3xl rounded-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/30">
          <h3 className="text-base font-bold text-text-200">Generar reporte</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-200/50 text-text-300 hover:text-text-200 transition-colors">
            <IconX size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Tipo de reporte */}
          <div>
            <p className="text-xs font-bold text-text-300 uppercase tracking-wider mb-3">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-200 mr-1.5 align-middle"></span>
              Tipo de reporte
            </p>
            <div className="grid grid-cols-5 gap-2">
              {REPORT_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => setReportType(opt.key)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 text-center transition-all ${
                    reportType === opt.key
                      ? 'border-brand-100/50 bg-brand-100/10 text-text-200 shadow-sm'
                      : 'border-border/30 bg-bg-200/30 text-text-300 hover:border-border/60 hover:bg-bg-200/60 hover:text-text-200'
                  }`}>
                  <opt.icon size={18} className={reportType === opt.key ? 'text-brand-200' : 'text-text-300'} />
                  <span className="text-[10px] font-bold leading-tight">{opt.label}</span>
                  <span className="text-[7px] opacity-60 leading-tight hidden sm:block">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fechas */}
          <div>
            <p className="text-xs font-bold text-text-300 uppercase tracking-wider mb-3">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 align-middle"></span>
              Período
            </p>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-text-300 block mb-1.5 font-medium">Desde</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="w-full bg-bg-200 border border-border/50 rounded-lg px-3.5 py-2.5 text-sm text-text-200 outline-none focus:border-brand-100/50 focus:ring-1 focus:ring-brand-100/30 transition-colors" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-text-300 block mb-1.5 font-medium">Hasta</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="w-full bg-bg-200 border border-border/50 rounded-lg px-3.5 py-2.5 text-sm text-text-200 outline-none focus:border-brand-100/50 focus:ring-1 focus:ring-brand-100/30 transition-colors" />
              </div>
            </div>
          </div>

          {/* Dispositivos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-text-300 uppercase tracking-wider">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500 mr-1.5 align-middle"></span>
                Dispositivos
              </p>
              <button onClick={toggleAll}
                className="text-xs font-semibold text-brand-200 hover:text-brand-100 transition-colors">
                {selectedIds.size === visibleDevices.length && visibleDevices.length > 0 ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {deviceTypes.map(type => {
                const devices = devicesByType.get(type) || [];
                const typeSelected = devices.every(d => selectedIds.has(d.id));
                const typePartial = devices.some(d => selectedIds.has(d.id)) && !typeSelected;
                return (
                  <div key={type} className="bg-bg-200/40 rounded-xl border border-border/20 overflow-hidden">
                    <label className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer hover:bg-bg-200/60 transition-colors">
                      <input type="checkbox" checked={typeSelected} ref={el => { if (el) el.indeterminate = typePartial; }}
                        onChange={() => toggleType(type)}
                        className="w-4 h-4 rounded border-border/60 text-brand-200 focus:ring-brand-100/30 accent-brand-200" />
                      <span className="text-sm font-bold text-text-200">{type}</span>
                      <span className="text-xs text-text-300 font-medium">({devices.length})</span>
                    </label>
                    <div className="ml-7 pb-2 space-y-0.5 border-t border-border/10 pt-1">
                      {devices.map(d => (
                        <label key={d.id}
                          className="flex items-center gap-2.5 px-3.5 py-1.5 cursor-pointer rounded-md hover:bg-bg-200/40 transition-colors">
                          <input type="checkbox" checked={selectedIds.has(d.id)}
                            onChange={() => toggleDevice(d.id)}
                            className="w-3.5 h-3.5 rounded border-border/60 text-brand-200 focus:ring-brand-100/30 accent-brand-200" />
                          <span className="text-sm text-text-200">{d.name}</span>
                          <span className="text-[10px] text-text-300 font-mono ml-auto">{d.dev_eui}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-border/30 flex items-center justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-text-300 hover:text-text-200 bg-bg-200/50 hover:bg-bg-200 rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={generatePDF} disabled={selectedIds.size === 0 || loading}
            className="flex items-center gap-2.5 px-5 py-2.5 text-sm font-bold text-white bg-brand-200 hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm">
            <IconFileReport size={18} />
            {loading ? 'Generando...' : `Generar PDF  ·  ${selectedIds.size} dispositivo${selectedIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
