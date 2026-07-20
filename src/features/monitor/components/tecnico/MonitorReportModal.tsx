import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useMonitorDevices } from "../../hooks/useMonitor";
import { monitorService } from "../../services/monitor.service";
import { IconX, IconFileReport, IconBattery, IconWifi, IconDashboard, IconAlertTriangle, IconTemperature, IconMapPin, IconServer, IconScale, IconChartLine } from "@tabler/icons-react";

interface Props {
  onClose: () => void;
}

type ReportType = 'general' | 'battery' | 'connectivity' | 'executive' | 'alerts' | 'temperature' | 'gps' | 'gateway' | 'sla' | 'comparative';

const REPORT_OPTIONS: { key: ReportType; label: string; desc: string; icon: any }[] = [
  { key: 'general', label: 'Reporte general', desc: 'Métricas y alertas por dispositivo', icon: IconFileReport },
  { key: 'executive', label: 'Ejecutivo', desc: 'Resumen mensual de alto nivel', icon: IconDashboard },
  { key: 'battery', label: 'Salud de baterías', desc: 'Estado, voltaje y proyección', icon: IconBattery },
  { key: 'connectivity', label: 'Conectividad', desc: 'SNR, RSSI y cobertura', icon: IconWifi },
  { key: 'temperature', label: 'Temperatura', desc: 'Sensor térmico por dispositivo', icon: IconTemperature },
  { key: 'alerts', label: 'Alertas', desc: 'Análisis avanzado de incidentes', icon: IconAlertTriangle },
  { key: 'gps', label: 'Tracking GPS', desc: 'Recorridos y velocidad', icon: IconMapPin },
  { key: 'gateway', label: 'Gateway', desc: 'Estado de infraestructura', icon: IconServer },
  { key: 'sla', label: 'SLA / Cumplimiento', desc: 'Disponibilidad y tiempos', icon: IconScale },
  { key: 'comparative', label: 'Comparativo', desc: 'Período vs período anterior', icon: IconChartLine },
];

export default function MonitorReportModal({ onClose }: Props) {
  const { data: allDevices } = useMonitorDevices();
  const [fromDate, setFromDate] = useState(format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [reportType, setReportType] = useState<ReportType>('general');

  const deviceTypes = useMemo(() => {
    const types = new Set((allDevices || []).map(d => d.type_device));
    return [...types].sort();
  }, [allDevices]);

  const devicesByType = useMemo(() => {
    const map = new Map<string, typeof allDevices>();
    (allDevices || []).forEach(d => {
      const arr = map.get(d.type_device) || [];
      arr.push(d);
      map.set(d.type_device, arr);
    });
    return map;
  }, [allDevices]);

  const toggleAll = () => {
    if (selectedIds.size === (allDevices || []).length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set((allDevices || []).map(d => d.id)));
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

  const generatePDF = async () => {
    if (selectedIds.size === 0) return;
    if (reportType === 'general') await generateGeneralPDF();
    else if (reportType === 'battery') await generateBatteryPDF();
    else if (reportType === 'connectivity') await generateConnectivityPDF();
    else if (reportType === 'executive') await generateExecutivePDF();
    else if (reportType === 'alerts') await generateAlertsPDF();
    else if (reportType === 'temperature') await generateTemperaturePDF();
    else if (reportType === 'gps') await generateGpsPDF();
    else if (reportType === 'gateway') await generateGatewayPDF();
    else if (reportType === 'sla') await generateSlaPDF();
    else if (reportType === 'comparative') await generateComparativePDF();
  };

  const generateGeneralPDF = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      const data = await monitorService.getReport({
        deviceIds: [...selectedIds],
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
      });
      setReportData(data);

      const selectedDevices = (allDevices || []).filter(d => selectedIds.has(d.id));
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

      // ─── Agrupar telemetría por dispositivo ───
      const deviceMap = new Map<number, { bat: number[]; temp: number[]; snr: number[]; rssi: number[]; ts: Date[]; gwCount: number[] }>();

      selectedDevices.forEach(d => deviceMap.set(d.id, { bat: [], temp: [], snr: [], rssi: [], ts: [], gwCount: [] }));

      data.telemetry.forEach((t: any) => {
        const rx = Array.isArray(t.rxinfo) ? t.rxinfo : typeof t.rxinfo === 'string' ? (() => { try { return JSON.parse(t.rxinfo); } catch { return []; } })() : [];
        const gw = rx[0] || {};
        const entry = deviceMap.get(t.device_id);
        if (!entry) return;
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
                    <span style="color:${a.type === 'critica' ? '#ef4444' : '#f59e0b'};font-weight:600;flex-shrink:0">●</span>
                    <span style="font-weight:600;color:#333;flex-shrink:0">${a.type}</span>
                    <span style="color:#888;flex-shrink:0">${format(new Date(a.created_at), "dd/MM HH:mm")}</span>
                    ${a.metadata?.reason ? `<span style="color:#999;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.metadata.reason}</span>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>` : ''}
          </div>
        `);
      });

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
  // REPORTE EJECUTIVO
  // ═══════════════════════════════════════════
  const generateExecutivePDF = async () => {
    setLoading(true);
    try {
      const data = await monitorService.getReportExecutive();
      setReportData(data);
      const title = `Ejecutivo - ${format(new Date(), "yyyy-MM-dd")}`;
      const { activeDevices, activeToday, alertsByType, topAlertDevices, gateways } = data;
      const gwOnline = (gateways || []).filter((g: any) => g.last_seen && new Date(g.last_seen).getTime() > Date.now() - 3600000).length;

      const sections = [`<div style="font-family:Arial,sans-serif;padding:30px">
        <div style="text-align:center;padding:40px 20px"><h1 style="font-size:24px;color:#111;margin:0 0 6px">Reporte Ejecutivo</h1><p style="font-size:12px;color:#666">${format(new Date(), "MMMM yyyy")}</p></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
          <div style="flex:1;min-width:100px;background:#f0fdf4;border-radius:8px;padding:14px;text-align:center;border:1px solid #bbf7d0"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Sensores activos</p><p style="font-size:22px;font-weight:700;color:#16a34a;margin:4px 0 0">${activeToday} / ${activeDevices}</p></div>
          <div style="flex:1;min-width:100px;background:#fef2f2;border-radius:8px;padding:14px;text-align:center;border:1px solid #fecaca"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Alertas críticas</p><p style="font-size:22px;font-weight:700;color:#ef4444;margin:4px 0 0">${(alertsByType || []).find((a: any) => a.type === 'critica')?.total || 0}</p></div>
          <div style="flex:1;min-width:100px;background:#fffbeb;border-radius:8px;padding:14px;text-align:center;border:1px solid #fde68a"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Gateways online</p><p style="font-size:22px;font-weight:700;color:#d97706;margin:4px 0 0">${gwOnline} / ${(gateways || []).length}</p></div>
          <div style="flex:1;min-width:100px;background:#f9fafb;border-radius:8px;padding:14px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Cobertura</p><p style="font-size:22px;font-weight:700;color:#111;margin:4px 0 0">${activeDevices > 0 ? Math.round(activeToday / activeDevices * 100) : 0}%</p></div>
        </div>
        ${topAlertDevices?.length ? `<h2 style="font-size:13px;color:#333;margin:0 0 8px">Top dispositivos con más alertas</h2><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#f3f4f6"><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Dispositivo</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Tipo</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Alertas</th></tr></thead><tbody>${topAlertDevices.map((d: any) => `<tr><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:600">${d.name}</td><td style="padding:5px 8px;border:1px solid #e5e7eb;color:#666">${d.type_device}</td><td style="padding:5px 8px;border:1px solid #e5e7eb;color:#ef4444;font-weight:700">${d.total}</td></tr>`).join('')}</tbody></table>` : ''}
        ${gateways?.length ? `<h2 style="font-size:13px;color:#333;margin:16px 0 8px">Estado de gateways</h2><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#f3f4f6"><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Gateway</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Estado</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Firmware</th></tr></thead><tbody>${gateways.map((g: any) => `<tr><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:600">${g.name}</td><td style="padding:5px 8px;border:1px solid #e5e7eb"><span style="color:${g.last_seen && new Date(g.last_seen).getTime() > Date.now() - 3600000 ? '#16a34a' : '#ef4444'};font-weight:600">${g.last_seen && new Date(g.last_seen).getTime() > Date.now() - 3600000 ? 'Online' : 'Offline'}</span></td><td style="padding:5px 8px;border:1px solid #e5e7eb;color:#666">${g.firmware_version || '—'}</td></tr>`).join('')}</tbody></table>` : ''}
      </div>`];

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{margin:12mm 10mm}body{font-family:Arial,sans-serif;color:#222;background:#fff;margin:0;padding:0}</style></head><body>${sections.join('\n')}</body></html>`;
      const win = window.open('', '_blank'); win?.document.write(html); win?.document.close(); setTimeout(() => win?.print(), 500);
    } catch (e) { console.error('Error ejecutivo:', e); }
    setLoading(false);
  };

  // ═══════════════════════════════════════════
  // REPORTE ALERTAS
  // ═══════════════════════════════════════════
  const generateAlertsPDF = async () => {
    setLoading(true);
    try {
      const data = await monitorService.getReportAlerts({ deviceIds: [...selectedIds], from: fromDate ? new Date(fromDate).toISOString() : undefined, to: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined });
      setReportData(data);
      const title = `Alertas - ${format(new Date(), "yyyy-MM-dd")}`;
      const alerts = data.alerts || [];
      const resTimes = data.resolutionTimes || [];
      const criticals = alerts.filter((a: any) => a.type === 'critica');
      const attentions = alerts.filter((a: any) => a.type === 'atencion');

      const sections = [`<div style="font-family:Arial,sans-serif;padding:30px">
        <div style="text-align:center;padding:30px 20px"><h1 style="font-size:22px;color:#111;margin:0 0 6px">Reporte de Alertas</h1><p style="font-size:12px;color:#666">${fromDate} → ${toDate} · ${alerts.length} alertas</p></div>
        <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
          <div style="flex:1;min-width:100px;background:#fef2f2;border-radius:8px;padding:12px;text-align:center;border:1px solid #fecaca"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Críticas</p><p style="font-size:20px;font-weight:700;color:#ef4444;margin:2px 0 0">${criticals.length}</p></div>
          <div style="flex:1;min-width:100px;background:#fffbeb;border-radius:8px;padding:12px;text-align:center;border:1px solid #fde68a"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Atención</p><p style="font-size:20px;font-weight:700;color:#d97706;margin:2px 0 0">${attentions.length}</p></div>
          <div style="flex:1;min-width:100px;background:#f0fdf4;border-radius:8px;padding:12px;text-align:center;border:1px solid #bbf7d0"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Resueltas</p><p style="font-size:20px;font-weight:700;color:#16a34a;margin:2px 0 0">${alerts.filter((a: any) => a.status === 'resolved' || a.resolved_at).length}</p></div>
          <div style="flex:1;min-width:100px;background:#f9fafb;border-radius:8px;padding:12px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Tiempo prom. resolución</p><p style="font-size:20px;font-weight:700;color:#111;margin:2px 0 0">${resTimes.length > 0 ? (resTimes.reduce((s: number, r: any) => s + Number(r.avg_hours), 0) / resTimes.length).toFixed(1) + 'h' : '—'}</p></div>
        </div>
        ${resTimes.length ? `<h2 style="font-size:13px;color:#333;margin:0 0 8px">Tiempo de resolución por tipo</h2><table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px"><thead><tr style="background:#f3f4f6"><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Tipo</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Promedio (horas)</th></tr></thead><tbody>${resTimes.map((r: any) => `<tr><td style="padding:5px 8px;border:1px solid #e5e7eb">${r.type}</td><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:700">${Number(r.avg_hours).toFixed(1)}h</td></tr>`).join('')}</tbody></table>` : ''}
        <h2 style="font-size:13px;color:#333;margin:0 0 8px">Últimas alertas (${Math.min(alerts.length, 30)})</h2>
        <table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr style="background:#f3f4f6"><th style="padding:4px 6px;text-align:left;border:1px solid #e5e7eb">Dispositivo</th><th style="padding:4px 6px;text-align:left;border:1px solid #e5e7eb">Tipo</th><th style="padding:4px 6px;text-align:left;border:1px solid #e5e7eb">Fecha</th></tr></thead><tbody>${alerts.slice(0, 30).map((a: any) => `<tr><td style="padding:4px 6px;border:1px solid #e5e7eb;font-weight:600">${a.device_name}</td><td style="padding:4px 6px;border:1px solid #e5e7eb"><span style="color:${a.type === 'critica' ? '#ef4444' : '#f59e0b'}">${a.type}</span></td><td style="padding:4px 6px;border:1px solid #e5e7eb;color:#888">${format(new Date(a.created_at), "dd/MM HH:mm")}</td></tr>`).join('')}</tbody></table>
      </div>`];

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{margin:12mm 10mm}body{font-family:Arial,sans-serif;color:#222;background:#fff;margin:0;padding:0}</style></head><body>${sections.join('\n')}</body></html>`;
      const win = window.open('', '_blank'); win?.document.write(html); win?.document.close(); setTimeout(() => win?.print(), 500);
    } catch (e) { console.error('Error alertas:', e); }
    setLoading(false);
  };

  // ═══════════════════════════════════════════
  // REPORTE TEMPERATURA
  // ═══════════════════════════════════════════
  const generateTemperaturePDF = async () => {
    setLoading(true);
    try {
      const data = await monitorService.getReportTemperature({ deviceIds: [...selectedIds], from: fromDate ? new Date(fromDate).toISOString() : undefined, to: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined });
      setReportData(data);
      const selectedDevices = (allDevices || []).filter(d => selectedIds.has(d.id));
      const title = `Temperatura - ${format(new Date(), "yyyy-MM-dd")}`;
      const deviceMap = new Map<number, { temps: number[]; timestamps: Date[] }>();
      selectedDevices.forEach(d => deviceMap.set(d.id, { temps: [], timestamps: [] }));
      data.telemetry.forEach((t: any) => { const e = deviceMap.get(t.device_id); if (!e) return; const tc = t.object?.temperature_C; if (tc != null) e.temps.push(Number(tc)); e.timestamps.push(new Date(t.ts)); });

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const sparkline = (vals: number[], c: string, h = 36) => { if (vals.length < 2) return ''; const mn=Math.min(...vals), mx=Math.max(...vals), r=mx-mn||1; return `<svg viewBox="0 0 360 ${h}" style="display:block;width:100%;height:auto"><polyline points="${vals.map((v,i)=>`${(i/(vals.length-1))*360},${h-6-((v-mn)/r)*(h-12)}`).join(' ')}" fill="none" stroke="${c}" stroke-width="1"/></svg>`; };
      const allTemps = data.telemetry.map((t: any) => t.object?.temperature_C != null ? Number(t.object.temperature_C) : null).filter((v: any): v is number => v != null);
      const avgGlobal = avg(allTemps);
      const minGlobal = allTemps.length ? Math.min(...allTemps) : 0;
      const maxGlobal = allTemps.length ? Math.max(...allTemps) : 0;
      const outOfRange = allTemps.filter((v: number) => v > 50 || v < -10).length;

      const sections = [`<div style="font-family:Arial,sans-serif;padding:30px">
        <div style="text-align:center;padding:30px"><h1 style="font-size:22px;color:#111;margin:0 0 6px">Reporte de Temperatura</h1><p style="font-size:12px;color:#666">${fromDate} → ${toDate}</p></div>
        <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
          <div style="flex:1;min-width:80px;background:#f9fafb;border-radius:8px;padding:12px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Promedio</p><p style="font-size:18px;font-weight:700;color:#111;margin:2px 0 0">${avgGlobal.toFixed(1)}°C</p></div>
          <div style="flex:1;min-width:80px;background:#f9fafb;border-radius:8px;padding:12px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Mínima</p><p style="font-size:18px;font-weight:700;color:#3b82f6;margin:2px 0 0">${minGlobal.toFixed(1)}°C</p></div>
          <div style="flex:1;min-width:80px;background:#f9fafb;border-radius:8px;padding:12px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Máxima</p><p style="font-size:18px;font-weight:700;color:#ef4444;margin:2px 0 0">${maxGlobal.toFixed(1)}°C</p></div>
          <div style="flex:1;min-width:80px;background:#fef2f2;border-radius:8px;padding:12px;text-align:center;border:1px solid #fecaca"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Fuera de rango</p><p style="font-size:18px;font-weight:700;color:#ef4444;margin:2px 0 0">${outOfRange}</p></div>
        </div>
      </div>`];

      selectedDevices.forEach((device) => {
        const e = deviceMap.get(device.id); if (!e || e.temps.length < 2) return;
        const dm = avg(e.temps); const lo = Math.min(...e.temps); const hi = Math.max(...e.temps);
        sections.push(`<div style="page-break-after:always;font-family:Arial,sans-serif;padding:24px">
          <div style="border-bottom:2px solid #e5e7eb;padding-bottom:10px;margin-bottom:14px"><h2 style="font-size:15px;color:#111;margin:0">${device.name}</h2><p style="font-size:10px;color:#888;margin:2px 0 0">${device.dev_eui} · ${device.type_device} · ${e.temps.length} registros</p></div>
          <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:70px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Prom</p><p style="font-size:14px;font-weight:700;color:#111;margin:2px 0 0">${dm.toFixed(1)}°C</p></div>
            <div style="flex:1;min-width:70px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Mín</p><p style="font-size:14px;font-weight:700;color:#3b82f6;margin:2px 0 0">${lo.toFixed(1)}°C</p></div>
            <div style="flex:1;min-width:70px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Máx</p><p style="font-size:14px;font-weight:700;color:#ef4444;margin:2px 0 0">${hi.toFixed(1)}°C</p></div>
          </div>
          ${sparkline(e.temps, '#f97316')}
          <p style="font-size:8px;color:#999;margin:4px 0 0">${format(e.timestamps[0], "dd/MM HH:mm")} → ${format(e.timestamps[e.timestamps.length-1], "dd/MM HH:mm")}</p>
        </div>`);
      });

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{margin:12mm 10mm}body{font-family:Arial,sans-serif;color:#222;background:#fff;margin:0;padding:0}</style></head><body>${sections.join('\n')}</body></html>`;
      const win = window.open('', '_blank'); win?.document.write(html); win?.document.close(); setTimeout(() => win?.print(), 500);
    } catch (e) { console.error('Error temperatura:', e); }
    setLoading(false);
  };

  // ═══════════════════════════════════════════
  // REPORTE GPS
  // ═══════════════════════════════════════════
  const generateGpsPDF = async () => {
    setLoading(true);
    try {
      const data = await monitorService.getReportGps({ deviceIds: [...selectedIds], from: fromDate ? new Date(fromDate).toISOString() : undefined, to: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined });
      setReportData(data);
      const selectedDevices = (allDevices || []).filter(d => selectedIds.has(d.id));
      const title = `GPS - ${format(new Date(), "yyyy-MM-dd")}`;
      const deviceMap = new Map<number, { lats: number[]; lngs: number[]; speeds: number[]; timestamps: Date[] }>();
      selectedDevices.filter(d => d.type_device === 'Gps').forEach(d => deviceMap.set(d.id, { lats: [], lngs: [], speeds: [], timestamps: [] }));
      data.telemetry.forEach((t: any) => { const e = deviceMap.get(t.device_id); if (!e) return; if (t.object?.latitude) e.lats.push(Number(t.object.latitude)); if (t.object?.longitude) e.lngs.push(Number(t.object.longitude)); if (t.object?.speed) e.speeds.push(Number(t.object.speed)); e.timestamps.push(new Date(t.ts)); });

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const sections = [`<div style="font-family:Arial,sans-serif;padding:30px"><div style="text-align:center;padding:30px"><h1 style="font-size:22px;color:#111;margin:0 0 6px">Reporte Tracking GPS</h1><p style="font-size:12px;color:#666">${fromDate} → ${toDate} · ${deviceMap.size} dispositivos GPS</p></div></div>`];

      deviceMap.forEach((e, deviceId) => {
        const device = selectedDevices.find(d => d.id === deviceId); if (!device || e.lats.length < 2) return;
        const avgSpeed = avg(e.speeds);
        sections.push(`<div style="page-break-after:always;font-family:Arial,sans-serif;padding:24px">
          <div style="border-bottom:2px solid #e5e7eb;padding-bottom:10px;margin-bottom:14px"><h2 style="font-size:15px;color:#111;margin:0">${device.name}</h2><p style="font-size:10px;color:#888;margin:2px 0 0">${device.dev_eui} · ${device.type_device}</p></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <div style="flex:1;min-width:70px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Puntos</p><p style="font-size:16px;font-weight:700;color:#111;margin:2px 0 0">${e.lats.length}</p></div>
            <div style="flex:1;min-width:70px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Vel. Prom</p><p style="font-size:16px;font-weight:700;color:#111;margin:2px 0 0">${avgSpeed.toFixed(1)} m/s</p></div>
            <div style="flex:1;min-width:70px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Inicio</p><p style="font-size:11px;font-weight:600;color:#666;margin:2px 0 0">${format(e.timestamps[0], "dd/MM HH:mm")}</p></div>
            <div style="flex:1;min-width:70px;background:#f9fafb;border-radius:6px;padding:10px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:9px;color:#888;margin:0;text-transform:uppercase">Fin</p><p style="font-size:11px;font-weight:600;color:#666;margin:2px 0 0">${format(e.timestamps[e.timestamps.length-1], "dd/MM HH:mm")}</p></div>
          </div>
        </div>`);
      });

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{margin:12mm 10mm}body{font-family:Arial,sans-serif;color:#222;background:#fff;margin:0;padding:0}</style></head><body>${sections.join('\n')}</body></html>`;
      const win = window.open('', '_blank'); win?.document.write(html); win?.document.close(); setTimeout(() => win?.print(), 500);
    } catch (e) { console.error('Error gps:', e); }
    setLoading(false);
  };

  // ═══════════════════════════════════════════
  // REPORTE GATEWAY
  // ═══════════════════════════════════════════
  const generateGatewayPDF = async () => {
    setLoading(true);
    try {
      const data = await monitorService.getReportGateway();
      setReportData(data);
      const title = `Gateway - ${format(new Date(), "yyyy-MM-dd")}`;
      const gws = data.gateways || [];
      const online = gws.filter((g: any) => g.last_seen && new Date(g.last_seen).getTime() > Date.now() - 3600000);

      const sections = [`<div style="font-family:Arial,sans-serif;padding:30px">
        <div style="text-align:center;padding:30px"><h1 style="font-size:22px;color:#111;margin:0 0 6px">Reporte de Gateways</h1><p style="font-size:12px;color:#666">${gws.length} gateways · ${online.length} online</p></div>
        <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
          <div style="flex:1;min-width:100px;background:#f0fdf4;border-radius:8px;padding:12px;text-align:center;border:1px solid #bbf7d0"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Online</p><p style="font-size:22px;font-weight:700;color:#16a34a;margin:2px 0 0">${online.length}</p></div>
          <div style="flex:1;min-width:100px;background:#fef2f2;border-radius:8px;padding:12px;text-align:center;border:1px solid #fecaca"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Offline</p><p style="font-size:22px;font-weight:700;color:#ef4444;margin:2px 0 0">${gws.length - online.length}</p></div>
          <div style="flex:1;min-width:100px;background:#f9fafb;border-radius:8px;padding:12px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Total disp. conectados</p><p style="font-size:22px;font-weight:700;color:#111;margin:2px 0 0">${gws.reduce((s: number, g: any) => s + (g.device_count || 0), 0)}</p></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#f3f4f6"><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Gateway</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Estado</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Dispositivos</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Firmware</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">IP</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Batería</th></tr></thead><tbody>${gws.map((g: any) => `<tr><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:600">${g.name}</td><td style="padding:5px 8px;border:1px solid #e5e7eb"><span style="color:${g.last_seen && new Date(g.last_seen).getTime() > Date.now() - 3600000 ? '#16a34a' : '#ef4444'};font-weight:600">${g.last_seen && new Date(g.last_seen).getTime() > Date.now() - 3600000 ? 'Online' : 'Offline'}</span></td><td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center;font-weight:700">${g.device_count || 0}</td><td style="padding:5px 8px;border:1px solid #e5e7eb;color:#666">${g.firmware_version || '—'}</td><td style="padding:5px 8px;border:1px solid #e5e7eb;color:#666">${g.ip_internal || '—'}</td><td style="padding:5px 8px;border:1px solid #e5e7eb;color:#666">${g.battery || '—'}</td></tr>`).join('')}</tbody></table>
      </div>`];

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{margin:12mm 10mm}body{font-family:Arial,sans-serif;color:#222;background:#fff;margin:0;padding:0}</style></head><body>${sections.join('\n')}</body></html>`;
      const win = window.open('', '_blank'); win?.document.write(html); win?.document.close(); setTimeout(() => win?.print(), 500);
    } catch (e) { console.error('Error gateway:', e); }
    setLoading(false);
  };

  // ═══════════════════════════════════════════
  // REPORTE SLA
  // ═══════════════════════════════════════════
  const generateSlaPDF = async () => {
    setLoading(true);
    try {
      const data = await monitorService.getReportAlerts({ deviceIds: [...selectedIds], from: fromDate ? new Date(fromDate).toISOString() : undefined, to: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined });
      const execData = await monitorService.getReportExecutive();
      setReportData(data);
      const title = `SLA - ${format(new Date(), "yyyy-MM-dd")}`;
      const alerts = data.alerts || [];
      const resTimes = data.resolutionTimes || [];
      const totalAlerts = alerts.length;
      const resolvedCount = alerts.filter((a: any) => a.resolved_at).length;
      const criticalCount = alerts.filter((a: any) => a.type === 'critica').length;
      const resolvedCritical = alerts.filter((a: any) => a.type === 'critica' && a.resolved_at).length;
      const avgResTime = resTimes.length > 0 ? (resTimes.reduce((s: number, r: any) => s + Number(r.avg_hours), 0) / resTimes.length) : 0;
      const slaCritical = criticalCount > 0 ? (resolvedCritical / criticalCount * 100) : 100;
      const coverage = execData?.activeDevices > 0 ? Math.round((execData.activeToday || 0) / execData.activeDevices * 100) : 0;

      const sections = [`<div style="font-family:Arial,sans-serif;padding:30px">
        <div style="text-align:center;padding:30px"><h1 style="font-size:22px;color:#111;margin:0 0 6px">Reporte SLA / Cumplimiento</h1><p style="font-size:12px;color:#666">${fromDate} → ${toDate}</p></div>
        <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
          <div style="flex:1;min-width:100px;background:#f0fdf4;border-radius:8px;padding:12px;text-align:center;border:1px solid #bbf7d0"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Cobertura</p><p style="font-size:22px;font-weight:700;color:#16a34a;margin:2px 0 0">${coverage}%</p></div>
          <div style="flex:1;min-width:100px;background:#fef2f2;border-radius:8px;padding:12px;text-align:center;border:1px solid #fecaca"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Alertas totales</p><p style="font-size:22px;font-weight:700;color:#111;margin:2px 0 0">${totalAlerts}</p></div>
          <div style="flex:1;min-width:100px;background:#fffbeb;border-radius:8px;padding:12px;text-align:center;border:1px solid #fde68a"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">% Resueltas</p><p style="font-size:22px;font-weight:700;color:#d97706;margin:2px 0 0">${totalAlerts > 0 ? Math.round(resolvedCount / totalAlerts * 100) : 100}%</p></div>
          <div style="flex:1;min-width:100px;background:#f9fafb;border-radius:8px;padding:12px;text-align:center;border:1px solid #e5e7eb"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Tiempo resolución</p><p style="font-size:22px;font-weight:700;color:#111;margin:2px 0 0">${avgResTime.toFixed(1)}h</p></div>
        </div>
        <h2 style="font-size:13px;color:#333;margin:0 0 8px">Indicadores de cumplimiento</h2>
        <table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#f3f4f6"><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Indicador</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Valor</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb">Estado</th></tr></thead><tbody>
          <tr><td style="padding:5px 8px;border:1px solid #e5e7eb">Cobertura de red</td><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:700">${coverage}%</td><td style="padding:5px 8px;border:1px solid #e5e7eb"><span style="color:${coverage >= 80 ? '#16a34a' : coverage >= 50 ? '#d97706' : '#ef4444'};font-weight:600">${coverage >= 80 ? 'Cumple' : coverage >= 50 ? 'Regular' : 'Crítico'}</span></td></tr>
          <tr><td style="padding:5px 8px;border:1px solid #e5e7eb">Resolución de críticas</td><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:700">${slaCritical.toFixed(0)}%</td><td style="padding:5px 8px;border:1px solid #e5e7eb"><span style="color:${slaCritical >= 90 ? '#16a34a' : slaCritical >= 70 ? '#d97706' : '#ef4444'};font-weight:600">${slaCritical >= 90 ? 'Cumple' : slaCritical >= 70 ? 'Regular' : 'Crítico'}</span></td></tr>
          <tr><td style="padding:5px 8px;border:1px solid #e5e7eb">Tiempo promedio resolución</td><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:700">${avgResTime.toFixed(1)}h</td><td style="padding:5px 8px;border:1px solid #e5e7eb"><span style="color:${avgResTime <= 4 ? '#16a34a' : avgResTime <= 24 ? '#d97706' : '#ef4444'};font-weight:600">${avgResTime <= 4 ? 'Cumple' : avgResTime <= 24 ? 'Regular' : 'Crítico'}</span></td></tr>
      </tbody></table>
      </div>`];

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{margin:12mm 10mm}body{font-family:Arial,sans-serif;color:#222;background:#fff;margin:0;padding:0}</style></head><body>${sections.join('\n')}</body></html>`;
      const win = window.open('', '_blank'); win?.document.write(html); win?.document.close(); setTimeout(() => win?.print(), 500);
    } catch (e) { console.error('Error sla:', e); }
    setLoading(false);
  };

  // ═══════════════════════════════════════════
  // REPORTE COMPARATIVO
  // ═══════════════════════════════════════════
  const generateComparativePDF = async () => {
    setLoading(true);
    try {
      const msPerDay = 86400000;
      const p1Start = fromDate;
      const p1End = toDate;
      const daysDiff = Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / msPerDay) + 1;
      const p2Start = format(new Date(new Date(fromDate).getTime() - daysDiff * msPerDay), "yyyy-MM-dd");
      const p2End = format(new Date(new Date(fromDate).getTime() - msPerDay), "yyyy-MM-dd");

      const data = await monitorService.getReportComparative({
        deviceIds: [...selectedIds],
        period1Start: new Date(p1Start).toISOString(),
        period1End: new Date(p1End + "T23:59:59").toISOString(),
        period2Start: new Date(p2Start).toISOString(),
        period2End: new Date(p2End + "T23:59:59").toISOString(),
      });
      setReportData(data);
      const title = `Comparativo - ${format(new Date(), "yyyy-MM-dd")}`;
      const { period1, period2 } = data;
      const calcTrend = (v1: number, v2: number) => {
        if (v2 === 0) return { dir: '—', pct: 0 };
        const pct = Math.round(((v1 - v2) / v2) * 100);
        return { dir: pct > 0 ? '↑' : pct < 0 ? '↓' : '—', pct: Math.abs(pct) };
      };
      const t1 = period1 ? { tel: parseInt(period1.total_telemetry || 0), volt: period1.avg_voltage ? Number(period1.avg_voltage) : 0, temp: period1.avg_temperature ? Number(period1.avg_temperature) : 0, alerts: period1.alerts ? parseInt(period1.alerts.total || 0) : 0 } : { tel: 0, volt: 0, temp: 0, alerts: 0 };
      const t2 = period2 ? { tel: parseInt(period2.total_telemetry || 0), volt: period2.avg_voltage ? Number(period2.avg_voltage) : 0, temp: period2.avg_temperature ? Number(period2.avg_temperature) : 0, alerts: period2.alerts ? parseInt(period2.alerts.total || 0) : 0 } : { tel: 0, volt: 0, temp: 0, alerts: 0 };
      const telTrend = calcTrend(t1.tel, t2.tel);
      const voltTrend = calcTrend(t1.volt, t2.volt);
      const alertsTrend = calcTrend(t1.alerts, t2.alerts);

      const sections = [`<div style="font-family:Arial,sans-serif;padding:30px">
        <div style="text-align:center;padding:30px"><h1 style="font-size:22px;color:#111;margin:0 0 6px">Reporte Comparativo</h1><p style="font-size:12px;color:#666">${p1Start} → ${p1End} vs ${p2Start} → ${p2End}</p></div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:16px"><thead><tr style="background:#f3f4f6"><th style="padding:8px 10px;text-align:left;border:1px solid #e5e7eb">Métrica</th><th style="padding:8px 10px;text-align:center;border:1px solid #e5e7eb">Período actual</th><th style="padding:8px 10px;text-align:center;border:1px solid #e5e7eb">Período anterior</th><th style="padding:8px 10px;text-align:center;border:1px solid #e5e7eb">Tendencia</th></tr></thead>
        <tbody>
          <tr><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600">Registros</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center">${t1.tel.toLocaleString()}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center">${t2.tel.toLocaleString()}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;font-weight:700;color:${telTrend.dir === '↑' ? '#16a34a' : telTrend.dir === '↓' ? '#ef4444' : '#888'}">${telTrend.dir} ${telTrend.pct > 0 ? telTrend.pct + '%' : ''}</td></tr>
          <tr><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600">Voltaje promedio</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center">${t1.volt.toFixed(3)}V</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center">${t2.volt.toFixed(3)}V</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;font-weight:700;color:${voltTrend.dir === '↑' ? '#16a34a' : voltTrend.dir === '↓' ? '#ef4444' : '#888'}">${voltTrend.dir} ${voltTrend.pct > 0 ? voltTrend.pct + '%' : ''}</td></tr>
          <tr><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600">Alertas</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center">${t1.alerts}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center">${t2.alerts}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;font-weight:700;color:${alertsTrend.dir === '↑' ? '#ef4444' : alertsTrend.dir === '↓' ? '#16a34a' : '#888'}">${alertsTrend.dir} ${alertsTrend.pct > 0 ? alertsTrend.pct + '%' : ''}</td></tr>
        </tbody></table>
        <p style="font-size:9px;color:#999;margin-top:12px">↑ mejora · ↓ empeora · las alertas ↑ es negativo</p>
      </div>`];

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{margin:12mm 10mm}body{font-family:Arial,sans-serif;color:#222;background:#fff;margin:0;padding:0}</style></head><body>${sections.join('\n')}</body></html>`;
      const win = window.open('', '_blank'); win?.document.write(html); win?.document.close(); setTimeout(() => win?.print(), 500);
    } catch (e) { console.error('Error comparativo:', e); }
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
                {selectedIds.size === (allDevices || []).length ? 'Deseleccionar todos' : 'Seleccionar todos'}
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
