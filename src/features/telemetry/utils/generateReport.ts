import { format } from "date-fns";

export async function generateSensorReport(fetchFn: () => Promise<any[]>) {
  const raw = await fetchFn();
  const gateways = raw.filter((d: any) => d.type_device === 'Gateway');
  const gpsList = raw.filter((d: any) => d.type_device === 'Gps');
  const now = format(new Date(), "yyyy-MM-dd HH:mm");

  const hrsSince = (ts: string) => {
    if (!ts) return null;
    return (Date.now() - new Date(ts).getTime()) / 3600000;
  };

  const gwState = (d: any) => {
    const h = hrsSince(d.last_seen);
    if (h === null) return { text: 'Sin datos', cls: 'badge-off' };
    if (h <= 0.083) return { text: 'Online', cls: 'badge-on' };
    return { text: 'Offline', cls: 'badge-off' };
  };

  const gpsState = (ts: string) => {
    const h = hrsSince(ts);
    if (h === null) return { text: 'Sin datos', cls: 'badge-off' };
    if (h <= 12) return { text: 'Activo', cls: 'badge-on' };
    return { text: 'Inactivo', cls: 'badge-off' };
  };

  const batInfo = (d: any) => {
    const v = d.object?.voltage_mV;
    if (!v) return { text: '—', cls: '' };
    const volts = (v / 1000).toFixed(2);
    if (v >= 3700 && v <= 4100) return { text: `${volts}V`, cls: 'ok' };
    return { text: `${volts}V ⚠`, cls: 'warn' };
  };

  const gwOn = gateways.filter((d: any) => { const h = hrsSince(d.last_seen); return h !== null && h <= 0.083; }).length;
  const gwNoData = gateways.filter((d: any) => !d.last_seen).length;
  const gpsOn = gpsList.filter((d: any) => { const h = hrsSince(d.last_telemetry_ts || d.last_seen); return h !== null && h <= 12; }).length;
  const gpsNoData = gpsList.filter((d: any) => !d.last_telemetry_ts).length;
  const batOk = gpsList.filter((d: any) => d.object?.voltage_mV && d.object.voltage_mV >= 3700 && d.object.voltage_mV <= 4100).length;

  let h = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte de Sensores</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#1a1a2e;max-width:1100px;margin:0 auto}
    .header{border-bottom:3px solid #2563eb;padding-bottom:15px;margin-bottom:25px}
    .header h1{font-size:26px;color:#1a1a2e}
    .header .sub{color:#6b7280;font-size:13px;margin-top:4px}
    .header .date{color:#9ca3af;font-size:11px;margin-top:2px}
    .summary{display:flex;gap:12px;margin-bottom:30px;flex-wrap:wrap}
    .summary-item{flex:1;min-width:140px;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;background:#f9fafb}
    .summary-item .label{font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;margin-bottom:2px}
    .summary-item .value{font-size:28px;font-weight:700;color:#1a1a2e}
    .summary-item .detail{font-size:11px;color:#6b7280;margin-top:2px}
    .section-title{font-size:16px;font-weight:600;color:#1a1a2e;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin:30px 0 12px}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    th{background:#1a1a2e;color:white;font-size:8.5px;text-transform:uppercase;letter-spacing:0.5px;padding:7px 6px;border:1px solid #1a1a2e;text-align:left}
    td{padding:5px 6px;border:1px solid #d1d5db;vertical-align:middle}
    tr:nth-child(even){background:#f9fafb}
    .mono{font-family:'Consolas','Courier New',monospace;font-size:9.5px}
    .badge{display:inline-block;padding:1px 8px;border-radius:10px;font-size:8px;font-weight:600}
    .badge-on{background:#dcfce7;color:#166534}
    .badge-off{background:#fee2e2;color:#991b1b}
    .ok{color:#16a34a;font-weight:600}
    .warn{color:#ea580c;font-weight:600}
    .dim{color:#9ca3af}
    .footer{border-top:1px solid #e5e7eb;margin-top:35px;padding-top:12px;text-align:center;font-size:10px;color:#9ca3af}
    .page-break{page-break-before:always}
    @media print{body{padding:20px}td,th{font-size:9px}}
  </style></head><body>`;

  h += `<div class="header">
    <h1>Reporte de Estado de Sensores</h1>
    <div class="sub">Sistema de Monitoreo EFESUR</div>
    <div class="date">Generado: ${now} | Total: ${raw.length}</div>
  </div>
  <div class="summary">
    <div class="summary-item"><div class="label">Gateways</div><div class="value">${gateways.length}</div><div class="detail">${gwOn} online · ${gateways.length - gwOn - gwNoData} offline · ${gwNoData} sin datos</div></div>
    <div class="summary-item"><div class="label">Sensores GPS</div><div class="value">${gpsList.length}</div><div class="detail">${gpsOn} activos · ${gpsList.length - gpsOn - gpsNoData} inactivos · ${gpsNoData} sin datos</div></div>
    <div class="summary-item"><div class="label">Batería GPS</div><div class="value">${batOk}</div><div class="detail">${gpsList.length - batOk} fuera de rango (3.7V-4.1V)</div></div>
    <div class="summary-item"><div class="label">Sin telemetría</div><div class="value">${gpsNoData + gwNoData}</div><div class="detail">dispositivos sin dato registrado</div></div>
  </div>`;

  // Gateways
  h += `<div class="section-title">📡 Gateways</div><table><thead><tr><th>#</th><th>Estado</th><th>Nombre</th><th>EUI</th><th>Empresa</th><th>Firmware</th><th>IP</th><th>Último reporte</th><th>Mejor SNR</th></tr></thead><tbody>`;
  gateways.forEach((d: any, i: number) => {
    const st = gwState(d);
    const rx = Array.isArray(d.rxinfo) ? d.rxinfo : [];
    const bestSnr = rx.length ? Math.max(...rx.map((g: any) => g.snr ?? -999)) : null;
    const fw = d.firmware_version || d.object?.firmware_version || '—';
    const ip = d.ip_internal || d.object?.ip_internal || '—';
    const ts = (d.last_telemetry_ts || d.last_seen) ? format(new Date(d.last_telemetry_ts || d.last_seen), "yyyy-MM-dd HH:mm") : '—';
    h += `<tr><td style="text-align:center;color:#9ca3af">${i+1}</td><td style="text-align:center"><span class="badge ${st.cls}">${st.text}</span></td><td><strong>${d.name}</strong></td><td class="mono">${d.dev_eui}</td><td>${d.company_name || '—'}</td><td class="mono">${fw}</td><td class="mono">${ip}</td><td class="mono">${ts}</td><td class="mono" style="text-align:center">${bestSnr !== null && bestSnr > -999 ? bestSnr.toFixed(1) : '—'}</td></tr>`;
  });
  h += `</tbody></table>`;

  // GPS
  h += `<div class="section-title page-break">📍 Sensores GPS</div><table><thead><tr><th>#</th><th>Estado</th><th>Nombre</th><th>EUI</th><th>Empresa</th><th>Modo</th><th>Batería</th><th>Temp</th><th>Mov</th><th>Sat</th><th>Tipo paquete</th><th>Último reporte</th><th>Gateways</th></tr></thead><tbody>`;
  gpsList.forEach((d: any, i: number) => {
    const obj = d.object || {};
    const st = gpsState(d.last_telemetry_ts || d.last_seen);
    const bat = batInfo(d);
    const temp = obj.temperature_C != null ? `${obj.temperature_C}°C` : '—';
    const mov = obj.systemStatus?.motionFlag ? 'Sí' : 'No';
    const sat = obj.satellites ?? '—';
    const pkt = obj.packetType || '—';
    const mode = obj.systemStatus?.operatingMode || d.operating_mode || '—';
    const ts = d.last_telemetry_ts ? format(new Date(d.last_telemetry_ts), "yyyy-MM-dd HH:mm") : '—';
    const rx = Array.isArray(d.rxinfo) ? d.rxinfo : [];
    const gwStr = rx.length > 0 ? rx.map((g: any) => g.gatewayId?.slice(-6) || '?').join(', ') : '—';
    h += `<tr><td style="text-align:center;color:#9ca3af">${i+1}</td><td style="text-align:center"><span class="badge ${st.cls}">${st.text}</span></td><td><strong>${d.name}</strong></td><td class="mono">${d.dev_eui}</td><td>${d.company_name || '—'}</td><td class="mono">${mode}</td><td class="mono ${bat.cls}" style="text-align:center">${bat.text}</td><td class="mono" style="text-align:center">${temp}</td><td style="text-align:center">${mov}</td><td style="text-align:center">${sat}</td><td style="font-size:9px">${pkt.replace('_', ' ')}</td><td class="mono" style="font-size:9.5px">${ts}</td><td style="font-size:9px">${gwStr}</td></tr>`;
  });
  h += `</tbody></table><div class="footer">EFESUR · ${now}</div></body></html>`;

  const win = window.open('', '_blank');
  win?.document.write(h);
  win?.document.close();
  win?.print();
}
