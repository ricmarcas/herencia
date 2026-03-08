import { getSheetData } from "@/lib/sheets";
import type { PromoRule } from "@/types/pedido";

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const normalizedCandidates = candidates.map((candidate) => normalizeHeader(candidate));
  return normalizedHeaders.findIndex((header) => normalizedCandidates.includes(header));
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

function parseBoolean(value: string): boolean {
  const normalized = normalizeHeader(value);
  return ["true", "1", "si", "yes", "activo", "activa"].includes(normalized);
}

function parseNumber(value: string | undefined, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isDateInRange(value: string, start: string, end: string): boolean {
  if (!start && !end) return true;
  if (start && value < start) return false;
  if (end && value > end) return false;
  return true;
}

function parsePromoType(value: string): PromoRule["tipo"] | null {
  const normalized = normalizeHeader(value);
  if (normalized === "percent") return "PERCENT";
  if (normalized === "freeshipping" || normalized === "enviogratis") return "FREE_SHIPPING";
  if (normalized === "fixed" || normalized === "monto") return "FIXED";
  return null;
}

export async function getEligiblePromotionsByPhone(telefonoRaw: string): Promise<{
  telefono: string;
  promociones: PromoRule[];
  message: string;
}> {
  const telefono = normalizePhone(telefonoRaw);

  if (telefono.length !== 10) {
    return { telefono, promociones: [], message: "Telefono invalido" };
  }

  const [clientesRows, promocionesRows] = await Promise.all([
    getSheetData("Clientes!A1:Z5000"),
    getSheetData("Promociones!A1:Z5000"),
  ]);

  if (!clientesRows.length || !promocionesRows.length) {
    return { telefono, promociones: [], message: "No hay promociones disponibles" };
  }

  const clientesHeaders = clientesRows[0] ?? [];
  const clientesData = clientesRows.slice(1);

  const idxTelefonoCliente = findHeaderIndex(clientesHeaders, ["Telefono", "Teléfono"]);
  const idxComprasCliente = findHeaderIndex(clientesHeaders, ["Compras"]);

  if (idxTelefonoCliente < 0 || idxComprasCliente < 0) {
    return { telefono, promociones: [], message: "No se pudo validar historial del cliente" };
  }

  const cliente = clientesData.find((row) => normalizePhone(String(row[idxTelefonoCliente] ?? "")) === telefono);

  if (!cliente) {
    return { telefono, promociones: [], message: "No encontramos compras previas para este numero" };
  }

  const comprasCliente = parseNumber(String(cliente[idxComprasCliente] ?? "0"), 0);

  const promoHeaders = promocionesRows[0] ?? [];
  const promoData = promocionesRows.slice(1);

  const idxPromoId = findHeaderIndex(promoHeaders, ["PromoID", "ID", "Clave"]);
  const idxNombre = findHeaderIndex(promoHeaders, ["Nombre"]);
  const idxTipo = findHeaderIndex(promoHeaders, ["Tipo"]);
  const idxValor = findHeaderIndex(promoHeaders, ["Valor"]);
  const idxActiva = findHeaderIndex(promoHeaders, ["Activa", "Activo"]);
  const idxFechaInicio = findHeaderIndex(promoHeaders, ["FechaInicio", "Inicio"]);
  const idxFechaFin = findHeaderIndex(promoHeaders, ["FechaFin", "Fin"]);
  const idxMinCompras = findHeaderIndex(promoHeaders, ["MinCompras", "ComprasMinimas"]);
  const idxMinTotal = findHeaderIndex(promoHeaders, ["MinTotal", "MinTotalPedido"]);
  const idxCombinable = findHeaderIndex(promoHeaders, ["Combinable"]);
  const idxPrioridad = findHeaderIndex(promoHeaders, ["Prioridad"]);
  const idxMensaje = findHeaderIndex(promoHeaders, ["Mensaje", "Descripcion", "Descripción"]);

  if (idxPromoId < 0 || idxTipo < 0 || idxValor < 0 || idxActiva < 0) {
    return { telefono, promociones: [], message: "Faltan columnas requeridas en hoja Promociones" };
  }

  const today = todayIso();

  const promociones: PromoRule[] = promoData
    .map((row) => {
      const activa = parseBoolean(String(row[idxActiva] ?? "FALSE"));
      if (!activa) return null;

      const tipo = parsePromoType(String(row[idxTipo] ?? ""));
      if (!tipo) return null;

      const promoId = String(row[idxPromoId] ?? "").trim();
      if (!promoId) return null;

      const fechaInicio = idxFechaInicio >= 0 ? String(row[idxFechaInicio] ?? "").trim() : "";
      const fechaFin = idxFechaFin >= 0 ? String(row[idxFechaFin] ?? "").trim() : "";

      if (!isDateInRange(today, fechaInicio, fechaFin)) {
        return null;
      }

      const minCompras = idxMinCompras >= 0 ? parseNumber(String(row[idxMinCompras] ?? "0"), 0) : 0;
      if (comprasCliente < minCompras) return null;

      const valor = parseNumber(String(row[idxValor] ?? "0"), 0);
      if (valor <= 0) return null;

      const minTotalPedido = idxMinTotal >= 0 ? parseNumber(String(row[idxMinTotal] ?? "0"), 0) : 0;
      const combinable = idxCombinable >= 0 ? parseBoolean(String(row[idxCombinable] ?? "TRUE")) : true;
      const prioridad = idxPrioridad >= 0 ? parseNumber(String(row[idxPrioridad] ?? "100"), 100) : 100;

      return {
        promoId,
        nombre: idxNombre >= 0 ? String(row[idxNombre] ?? promoId) : promoId,
        descripcion: idxMensaje >= 0 ? String(row[idxMensaje] ?? "") : "",
        tipo,
        valor,
        minCompras,
        minTotalPedido,
        combinable,
        prioridad,
      } satisfies PromoRule;
    })
    .filter((promo): promo is PromoRule => promo !== null)
    .sort((a, b) => a.prioridad - b.prioridad);

  return {
    telefono,
    promociones,
    message: promociones.length ? `Encontramos ${promociones.length} promocion(es) vigentes para tu cuenta.` : "Cliente sin promocion vigente",
  };
}

export function applyPromotionsToOrder(subtotal: number, envioBase: number, promociones: PromoRule[]) {
  let descuento = 0;
  let envioFinal = envioBase;
  let percentUsed = false;
  const appliedPromos: PromoRule[] = [];

  for (const promo of [...promociones].sort((a, b) => a.prioridad - b.prioridad)) {
    if (promo.minTotalPedido > 0 && subtotal < promo.minTotalPedido) {
      continue;
    }

    let applied = false;
    if (promo.tipo === "FREE_SHIPPING") {
      if (envioFinal > 0) {
        envioFinal = 0;
        applied = true;
      }
    } else if (promo.tipo === "PERCENT") {
      if (!percentUsed) {
        descuento += Math.round((subtotal * promo.valor) / 100);
        percentUsed = true;
        applied = true;
      }
    } else if (promo.tipo === "FIXED") {
      descuento += Math.round(promo.valor);
      applied = true;
    }

    if (!applied) continue;

    appliedPromos.push(promo);
    if (!promo.combinable) break;
  }

  if (descuento > subtotal) descuento = subtotal;

  return {
    descuento,
    envioFinal,
    appliedPromos,
    total: subtotal - descuento + envioFinal,
  };
}
