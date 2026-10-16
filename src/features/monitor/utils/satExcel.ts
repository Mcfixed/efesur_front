import * as XLSX from "xlsx";
import { format } from "date-fns";
import { voltageToPercent } from "./battery";
import type { MonitorSatReport, MonitorSatSensor, MonitorSatGateway } from "../types/monitor.types";

// ─── Anexo SAT: "Documento verificación funcionamiento" ───
// Genera el Excel de respaldo para el protocolo SAT de monitoreo de catenarias.
// Sin colores ni formatos condicionales: solo datos, anchos de columna y autofiltro,
// para que sea auditable y simple de revisar (y de pegar en el informe SAT).
// La clasificación se hace aquí (el backend entrega datos crudos de la ventana).

/** Umbrales aplicados. Los del protocolo son fijos; los internos se acuerdan con el mandante. */
export const SAT_CRITERIOS = {
  rssiMinDbm: -120,          // §8.3.4: RSSI máximo aceptable -120 dBm (debe ser >= -120)
  snrMinDb: 5,               // criterio interno de calidad de enlace
  batMinPct: 5,              // §8.3.4: batería entre 5% y 100%
  batMaxPct: 100,
  modoProduccion: "PRODUCCION", // §13: 98% de los sensores en modo Producción
  keepalive: "4 h",         // el sensor reporta estado cada 4 h; más de eso sin datos = interrupción
};

/** Versiones de hardware: van grabadas en el equipo, así que son fijas y no las reporta la plataforma. */
export const SAT_VERSIONES = {
  gateway: "60.0.0.49",
  sensor: "v3.0.0",
};

export type SatResultado = "CONFORME" | "NO CONFORME" | "INCONCLUSO";

const fechaHora = (ts?: string | null) => (ts ? format(new Date(ts), "yyyy-MM-dd HH:mm") : "");
const n0 = (v: number | null | undefined, dec = 0) => (v == null ? "" : Number(v.toFixed(dec)));

// ─── Presentación ───
// La versión community de SheetJS no escribe negrita, colores ni bordes, así que el orden visual
// se logra con celdas combinadas, formato numérico real, anchos, altos de fila y grupos colapsables.
type Celda = string | number | "" | XLSX.CellObject;
type Fila = Celda[];

/**
 * Celda numérica con formato de Excel (por ejemplo "0.0", "#,##0" o "0.000000").
 * Acepta texto porque las columnas `numeric` de PostgreSQL llegan como string.
 */
const num = (v: number | string | null | undefined, z: string, dec = 0): Celda => {
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? { v: Number(n.toFixed(dec)), t: "n", z } : "";
};

const pctDiasConDatos = (diasConDatos: number, diasVentana: number) =>
  diasVentana > 0 ? Math.round((diasConDatos / diasVentana) * 100) : 0;

/** Hoja con título combinado (fila 1), fila en blanco, encabezados (fila 3) y datos desde la 4. */
function hojaTitulada(titulo: string, headers: string[], filas: Fila[], anchos: number[], grupos: { desde: number; hasta: number }[] = []) {
  const ws = XLSX.utils.aoa_to_sheet([[{ v: titulo, t: "s" }], [], headers, ...filas]);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
  ws["!cols"] = anchos.map(wch => ({ wch }));
  grupos.forEach(g => {
    for (let c = g.desde; c <= g.hasta; c++) {
      const info = ws["!cols"]![c];
      if (info) info.level = 1; // columna agrupable (se puede colapsar desde Excel)
    }
  });
  ws["!rows"] = [{ hpt: 26 }, { hpt: 6 }, { hpt: 30 }];
  ws["!autofilter"] = { ref: `A3:${XLSX.utils.encode_col(headers.length - 1)}${filas.length + 3}` };
  return ws;
}

/** Vía / PK / postes tal como aparecen en el nombre del sensor en la plataforma (V1PK0/13C-14C). */
export function desglosaNombre(name: string) {
  const m = name.match(/^\s*V\s*(\d+)\s*PK\s*(\d+)\s*\/\s*(\S+)/i);
  if (!m) return { via: "", pk: "", postes: "" };
  return { via: `V${m[1]}`, pk: `PK ${m[2]}`, postes: m[3] };
}

function textoGateways(s: MonitorSatSensor): string {
  const lista = (s.gateways ?? []).map(g => g.name || g.eui).filter(Boolean);
  if (lista.length) return lista.join(", ");
  return s.gw_name || s.gw_eui || "";
}

/** Clasifica un sensor y explica el porqué en Observación. */
export function clasificarSensor(s: MonitorSatSensor, diasVentana: number): { resultado: SatResultado; observacion: string } {
  const registros = s.registros ?? 0;
  const modo = (s.operating_mode ?? "").trim().toUpperCase();
  const batPct = voltageToPercent(s.bat_mv);
  const nGw = (s.gateways ?? []).length || (s.gw_eui ? 1 : 0);
  const diasConDatos = s.dias ?? 0;

  const notas: string[] = [];
  if (registros === 0) notas.push(`sin registros en ${diasVentana} días`);
  if (registros > 0 && nGw === 0) notas.push("último dato sin gateway identificado");
  if (s.huecos) notas.push(`${s.huecos} interrupción(es) de más de ${SAT_CRITERIOS.keepalive} sin datos${s.hueco_en_curso ? " (una en curso)" : ""}`);
  if (registros > 0 && diasConDatos < diasVentana) notas.push(`${diasConDatos}/${diasVentana} días con datos`);
  if (s.eventos) notas.push(`${s.eventos} evento(s) de movimiento/impacto`);

  // El modo de operación lo fija el mandante: si no está en Producción, no se puede evaluar el resto.
  if (modo !== SAT_CRITERIOS.modoProduccion) {
    notas.unshift(`modo ${s.operating_mode || "no definido"} (el protocolo exige Producción)`);
    return { resultado: "INCONCLUSO", observacion: notas.join("; ") };
  }

  const causas: string[] = [];
  if (registros === 0) causas.push("sin datos en la ventana");
  if (s.rssi == null) causas.push("sin RSSI registrado");
  else if (s.rssi < SAT_CRITERIOS.rssiMinDbm) causas.push(`RSSI ${n0(s.rssi, 1)} dBm sobre el umbral (${SAT_CRITERIOS.rssiMinDbm} dBm)`);
  if (s.snr == null) causas.push("sin SNR registrado");
  else if (s.snr < SAT_CRITERIOS.snrMinDb) causas.push(`SNR ${n0(s.snr, 1)} dB bajo el criterio (${SAT_CRITERIOS.snrMinDb} dB)`);
  if (batPct == null) causas.push("sin reporte de batería");
  else if (batPct < SAT_CRITERIOS.batMinPct || batPct > SAT_CRITERIOS.batMaxPct) causas.push(`batería ${batPct}% fuera de 5-100%`);

  if (causas.length === 0) return { resultado: "CONFORME", observacion: notas.join("; ") };
  return { resultado: "NO CONFORME", observacion: [...causas, ...notas].join("; ") };
}

function clasificarGateway(g: MonitorSatGateway): { resultado: string; observacion: string } {
  const up = g.uplinks ?? 0;
  const notas: string[] = [];
  if (g.is_active && up === 0) notas.push("habilitado pero sin retransmisiones en la ventana");
  if (!g.is_active && up > 0) notas.push("deshabilitado pero recibiendo datos (revisar)");
  if (g.is_active && up > 0) return { resultado: "OPERATIVO", observacion: notas.join("; ") };
  return { resultado: "NO OPERATIVO", observacion: notas.join("; ") };
}

export function generarAnexoSat(data: MonitorSatReport) {
  const dias = data.dias;
  const sensores = data.sensores ?? [];
  const gateways = data.gateways ?? [];
  const clasificados = sensores.map(s => ({ s, ...clasificarSensor(s, dias) }));

  const cuenta = { CONFORME: 0, "NO CONFORME": 0, INCONCLUSO: 0 } as Record<SatResultado, number>;
  clasificados.forEach(c => { cuenta[c.resultado]++; });
  const conDatos = sensores.filter(s => (s.registros ?? 0) > 0).length;
  const gwsOperativos = gateways.filter(g => clasificarGateway(g).resultado === "OPERATIVO").length;

  const wb = XLSX.utils.book_new();

  // ─── 1) Control documental ───
  // Las secciones se destacan combinando las dos columnas y dándoles más alto de fila.
  const control: (string | number)[][] = [];
  const bandas: number[] = [];
  const banda = (titulo: string) => { bandas.push(control.length); control.push([titulo, ""]); };
  const dato = (etiqueta: string, valor: string | number) => control.push([etiqueta, valor]);

  control.push(["DOCUMENTO DE VERIFICACIÓN DE FUNCIONAMIENTO", ""]);
  control.push(["", ""]);
  dato("Proyecto", "Monitoreo de catenarias — sensores GPS y gateways LoRaWAN");
  dato("Documento de referencia", "Protocolo SAT de monitoreo de catenarias (versión preliminar, marzo 2026)");
  dato("Objeto", "Acreditar el funcionamiento del sistema en la ventana analizada: detección, transmisión, recepción por gateway y visualización en plataforma");
  dato("Fuente de los datos", "Plataforma EFESUR — registros de telemetría (uplinks) y alertas");
  dato("Ventana analizada", `${data.desde} a ${data.hasta} (${dias} días)`);
  dato("Fecha de emisión", format(new Date(), "yyyy-MM-dd HH:mm"));
  control.push(["", ""]);

  banda("UNIVERSO ANALIZADO");
  dato("Sensores activos en plataforma", sensores.length);
  dato("Sensores con datos en la ventana", conDatos);
  dato("Gateways en plataforma", gateways.length);
  dato("Gateways operativos", gwsOperativos);
  control.push(["", ""]);

  banda("RESUMEN DE RESULTADOS");
  dato("Conformes", cuenta.CONFORME);
  dato("No conformes", cuenta["NO CONFORME"]);
  dato("Inconclusos (no evaluables)", cuenta.INCONCLUSO);
  control.push(["", ""]);

  banda("CRITERIOS APLICADOS");
  dato("Modo de operación", `El protocolo exige modo ${SAT_CRITERIOS.modoProduccion}. Si el sensor no está en ese modo, el resultado queda INCONCLUSO`);
  dato("Recepción", "El último dato debe haber sido recibido por al menos 1 gateway");
  dato("RSSI", `Mayor o igual a ${SAT_CRITERIOS.rssiMinDbm} dBm`);
  dato("SNR", `Mayor o igual a ${SAT_CRITERIOS.snrMinDb} dB (criterio interno)`);
  dato("Batería", `${SAT_CRITERIOS.batMinPct}% a ${SAT_CRITERIOS.batMaxPct}%`);
  dato("Continuidad", `Se cuenta una interrupción por cada silencio de más de ${SAT_CRITERIOS.keepalive} sin datos (incluye el inicio del período y el que está en curso). Es evidencia informativa: no modifica el resultado`);
  control.push(["", ""]);

  banda("OBSERVACIONES GENERALES");
  dato("Alcance de la evidencia", "El documento se genera con datos de plataforma. No incluye mediciones en terreno ni prueba de movimiento inducido: esos ítems quedan para la inspección en sitio");
  dato("PK del protocolo", "La columna PK de este anexo reproduce el nombre del sensor en plataforma. La equivalencia con los PK del protocolo (formato PK 27+709) se completa en las columnas FAT y SAT");
  dato("Versiones de hardware", `Sensores ${SAT_VERSIONES.sensor} · Gateways ${SAT_VERSIONES.gateway}. Van grabadas en el equipo al momento del despliegue: permanecen fijas durante la operación`);
  control.push(["", ""]);

  banda("FIRMAS");
  dato("FAT", "Nombre / cargo / fecha");
  dato("SAT", "Nombre / cargo / fecha");
  dato("Mandante (EFE)", "Nombre / cargo / fecha");

  const wsControl = XLSX.utils.aoa_to_sheet(control);
  wsControl["!cols"] = [{ wch: 34 }, { wch: 110 }];
  wsControl["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    ...bandas.map(r => ({ s: { r, c: 0 }, e: { r, c: 1 } }))];
  const altosControl: XLSX.RowInfo[] = [];
  altosControl[0] = { hpt: 30 };
  bandas.forEach(r => { altosControl[r] = { hpt: 22 }; });
  wsControl["!rows"] = altosControl;
  XLSX.utils.book_append_sheet(wb, wsControl, "Control documental");

  // ─── 2) Matriz de cumplimiento ───
  const headMatriz = ["Ítem", "Sensor (plataforma)", "DevEUI", "Vía", "PK", "Poste(s)", "Modo", "Gateway(s)",
    "Último dato", "Registros", "Días", "Disponibilidad %", "RSSI (dBm)", "SNR (dB)", "Batería %",
    "Eventos mov.", "FAT", "SAT", "RESULTADO", "Observación"];
  const filasMatriz: Fila[] = clasificados.map((c, i) => {
    const { s } = c;
    const { via, pk, postes } = desglosaNombre(s.name);
    return [num(i + 1, "0"), s.name, s.dev_eui, via, pk, postes, s.operating_mode ?? "", textoGateways(s),
      fechaHora(s.ultimo_ts), num(s.registros ?? 0, "#,##0"), num(s.dias ?? 0, "0"),
      num(pctDiasConDatos(s.dias ?? 0, dias), "0"), num(s.rssi, "0.0"), num(s.snr, "0.0"),
      num(voltageToPercent(s.bat_mv), "0"), num(s.eventos ?? 0, "0"), "", "", c.resultado, c.observacion];
  });
  const wsMatriz = hojaTitulada(
    `MATRIZ DE CUMPLIMIENTO · ventana ${data.desde} a ${data.hasta} (${dias} días) · ${sensores.length} sensores · generado ${format(new Date(), "yyyy-MM-dd HH:mm")}`,
    headMatriz, filasMatriz,
    [6, 30, 22, 6, 9, 14, 13, 30, 17, 10, 7, 15, 11, 9, 11, 12, 10, 10, 14, 70],
    [{ desde: 16, hasta: 17 }], // FAT y SAT: se completan en la inspección, quedan agrupadas
  );
  XLSX.utils.book_append_sheet(wb, wsMatriz, "Matriz de cumplimiento");

  // ─── 3) Detalle por sensor ───
  const headDetalle = ["Ítem", "Sensor", "DevEUI", "Vía", "PK", "Poste(s)", "Latitud", "Longitud", "Modo",
    "Registros", "Días con datos", "Primer dato", "Último dato", "Último reporte (plataforma)",
    "Interrupciones (más de 4 h)", "Batería (mV)", "Batería %", "Temperatura (°C)", "Satélites",
    "Eventos de movimiento", "Último evento", "Gateways que recibieron el último dato", "Mejor gateway",
    "SNR (dB)", "RSSI (dBm)"];
  const filasDetalle: Fila[] = sensores.map((s, i) => {
    const { via, pk, postes } = desglosaNombre(s.name);
    return [num(i + 1, "0"), s.name, s.dev_eui, via, pk, postes,
      num(s.latitude_current, "0.000000"), num(s.longitude_current, "0.000000"), s.operating_mode ?? "",
      num(s.registros ?? 0, "#,##0"), num(s.dias ?? 0, "0"), fechaHora(s.primer_ts), fechaHora(s.ultimo_ts), fechaHora(s.last_seen),
      num(s.huecos ?? 0, "0"), num(s.bat_mv, "#,##0"), num(voltageToPercent(s.bat_mv), "0"),
      num(s.temp_c, "0.0"), num(s.sats, "0"),
      num(s.eventos ?? 0, "0"), fechaHora(s.ultimo_evento), textoGateways(s), s.gw_name ?? s.gw_eui ?? "",
      num(s.snr, "0.0"), num(s.rssi, "0.0")];
  });
  const wsDetalle = hojaTitulada(
    `DETALLE POR SENSOR · ventana ${data.desde} a ${data.hasta} (${dias} días) · generado ${format(new Date(), "yyyy-MM-dd HH:mm")}`,
    headDetalle, filasDetalle,
    [6, 30, 22, 6, 9, 14, 11, 11, 13, 10, 14, 17, 17, 22, 26, 13, 11, 16, 10, 18, 17, 40, 22, 9, 11],
    [{ desde: 6, hasta: 8 }, { desde: 14, hasta: 20 }], // coordenadas y datos de hardware: agrupables
  );
  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle por sensor");

  // ─── 4) Gateways ───
  const headGw = ["Ítem", "Gateway", "DevEUI", "Habilitado", "Último reporte", "Uplinks retransmitidos",
    "Sensores servidos", "Firmware", "RESULTADO", "Observación"];
  const filasGw: Fila[] = gateways.map((g, i) => {
    const c = clasificarGateway(g);
    return [num(i + 1, "0"), g.name, g.dev_eui, g.is_active ? "Sí" : "No", fechaHora(g.last_seen),
      num(g.uplinks ?? 0, "#,##0"), num(g.sensores ?? 0, "#,##0"), SAT_VERSIONES.gateway, c.resultado, c.observacion];
  });
  const wsGw = hojaTitulada(
    `GATEWAYS · ventana ${data.desde} a ${data.hasta} (${dias} días) · ${gateways.length} gateways · ${gwsOperativos} operativos`,
    headGw, filasGw,
    [6, 26, 22, 11, 17, 20, 16, 12, 15, 60],
  );
  XLSX.utils.book_append_sheet(wb, wsGw, "Gateways");

  // ─── 5) Prueba funcional (§8.3.3) ───
  const headFunc = ["Ítem", "Sensor", "DevEUI", "PK", "Detección de movimiento (terreno)", "Transmisión",
    "Recepción por al menos 1 gateway", "Visualización en plataforma", "Último dato recibido", "RESULTADO", "Observación"];
  const filasFunc: Fila[] = sensores.map((s, i) => {
    const { pk } = desglosaNombre(s.name);
    const transmite = (s.registros ?? 0) > 0;
    const recibe = textoGateways(s) !== "";
    const visible = !!s.ultimo_ts;
    const observacion = !transmite
      ? "Sin transmisiones en la ventana: no se puede acreditar la prueba"
      : !recibe
        ? "Se recibieron datos pero el último no trae gateway identificado"
        : "";
    const resultado = transmite && recibe && visible ? "POR VERIFICAR EN TERRENO" : "NO CONFORME";
    return [num(i + 1, "0"), s.name, s.dev_eui, pk, "Pendiente (inspección en sitio)",
      transmite ? "Sí" : "No", recibe ? "Sí" : "No", visible ? "Sí" : "No",
      fechaHora(s.ultimo_ts), resultado, observacion];
  });
  const wsFunc = hojaTitulada(
    `PRUEBA FUNCIONAL (protocolo §8.3.3) · ventana ${data.desde} a ${data.hasta} (${dias} días) · ${sensores.length} sensores`,
    headFunc, filasFunc,
    [6, 30, 22, 9, 30, 12, 30, 24, 18, 26, 60],
  );
  XLSX.utils.book_append_sheet(wb, wsFunc, "Prueba funcional");

  // ─── 6) Criterios y abreviaturas ───
  const criterios: string[][] = [
    ["CRITERIO", "VALOR APLICADO", "ORIGEN", "DESCRIPCIÓN"],
    ["Modo de operación", SAT_CRITERIOS.modoProduccion, "Protocolo, aprobación general",
      "Los sensores deben estar en modo Producción. En otro modo (por ejemplo 'normal') el resultado queda INCONCLUSO"],
    ["Recepción", "Al menos 1 gateway", "Protocolo §8.3.3",
      "El dato debe haber sido recibido por a lo menos un gateway de la red"],
    ["RSSI", `${SAT_CRITERIOS.rssiMinDbm} dBm`, "Protocolo §8.3.4",
      "Nivel mínimo aceptable de señal. El valor registrado debe ser mayor o igual al umbral"],
    ["SNR", `${SAT_CRITERIOS.snrMinDb} dB`, "Criterio interno (EFESUR)",
      "Calidad de enlace respecto del ruido. Umbral acordado con el mandante"],
    ["Batería", `${SAT_CRITERIOS.batMinPct}% a ${SAT_CRITERIOS.batMaxPct}%`, "Protocolo §8.3.4",
      "Porcentaje estimado a partir del voltaje reportado en el último dato"],
    ["Continuidad", `Más de ${SAT_CRITERIOS.keepalive} sin datos = 1 interrupción`, "Keepalive del sensor (4 h)",
      "El sensor reporta estado cada 4 h y puede enviar datos de movimiento en cualquier momento. Se cuentan los silencios de más de 4 h, incluido el del inicio del período y el que está en curso. Es evidencia informativa: no modifica el RESULTADO del sensor"],
    ["Firmware", `Sensores ${SAT_VERSIONES.sensor} · Gateways ${SAT_VERSIONES.gateway}`, "Versión de hardware (protocolo §8.3.4 exige V3.0.0 en el sensor)",
      "La versión va grabada en el equipo, no la reporta la plataforma: se acredita por declaración del fabricante y permanece fija durante la operación"],
    ["Posición GPS", "0 a 10 m respecto del plan", "Protocolo §8.3.4",
      "Requiere medición en terreno: no evaluable con datos de plataforma"],
    ["", "", "", ""],
    ["ABREVIATURAS Y GLOSARIO", "", "", ""],
    ["CONFORME", "Cumple todos los criterios verificables con datos de plataforma", "", ""],
    ["NO CONFORME", "En modo Producción pero incumple al menos un criterio verificable", "", ""],
    ["INCONCLUSO", "No evaluable: el sensor no está en modo Producción (decisión del mandante)", "", ""],
    ["POR VERIFICAR EN TERRENO", "Requiere inspección en sitio para acreditar el ítem", "", ""],
    ["OPERATIVO / NO OPERATIVO", "Gateway habilitado y con retransmisiones en la ventana / no lo está", "", ""],
    ["PK", "Nombre del sensor en la plataforma (formato V1PK0/13C-14C). La equivalencia con los PK del protocolo se completa en FAT y SAT", "", ""],
    ["Interrupción", "Silencio de más de 4 h sin ningún dato: el keepalive configurado (4 h) no llegó", "", ""],
    ["Uplink", "Retransmisión de un dato de sensor realizada por un gateway", "", ""],
    ["", "", "", ""],
    [`Nota: documento generado automáticamente desde la plataforma EFESUR el ${format(new Date(), "yyyy-MM-dd HH:mm")}. Las columnas FAT y SAT de la matriz se completan durante la inspección`, "", "", ""],
  ];
  // Presentación: título combinado, banda de glosario y nota final a todo el ancho
  criterios.unshift(["CRITERIOS Y ABREVIATURAS DEL ANEXO", "", "", ""], ["", "", "", ""]);
  const idxHeader = criterios.findIndex(f => f[0] === "CRITERIO");
  const idxAbrev = criterios.findIndex(f => f[0] === "ABREVIATURAS Y GLOSARIO");
  const idxNota = criterios.findIndex(f => String(f[0]).startsWith("Nota:"));
  const wsCriterios = XLSX.utils.aoa_to_sheet(criterios);
  wsCriterios["!cols"] = [{ wch: 28 }, { wch: 46 }, { wch: 28 }, { wch: 80 }];
  wsCriterios["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    ...(idxAbrev > 0 ? [{ s: { r: idxAbrev, c: 0 }, e: { r: idxAbrev, c: 3 } }] : []),
    ...(idxNota > 0 ? [{ s: { r: idxNota, c: 0 }, e: { r: idxNota, c: 3 } }] : []),
  ];
  const altosCrit: XLSX.RowInfo[] = [];
  altosCrit[0] = { hpt: 26 };
  if (idxHeader > 0) altosCrit[idxHeader] = { hpt: 30 };
  if (idxAbrev > 0) altosCrit[idxAbrev] = { hpt: 22 };
  wsCriterios["!rows"] = altosCrit;
  XLSX.utils.book_append_sheet(wb, wsCriterios, "Criterios");

  XLSX.writeFile(wb, `ANEXO-SAT_Verificacion_Funcionamiento_${data.desde}_${data.hasta}.xlsx`);
  return { total: sensores.length, ...cuenta, gateways: gateways.length };
}
