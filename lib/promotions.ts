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

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizePromoCode(value: string): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function toPromoRule(code: string): PromoRule | null {
  if (code === "FF") {
    return {
      promoId: "FF",
      titulo: "Friends&Family",
      nombre: "Friends&Family",
      descripcion: "15% permanente en pedidos",
      tipo: "PERCENT",
      valor: 15,
      minCompras: 0,
      minTotalPedido: 0,
      combinable: false,
      prioridad: 1,
    };
  }

  if (code === "NPSM+") {
    return {
      promoId: "NPSM+",
      titulo: "Nos gusta que te guste",
      nombre: "Nos gusta que te guste",
      descripcion: "15% por evaluacion de muestra",
      tipo: "PERCENT",
      valor: 15,
      minCompras: 0,
      minTotalPedido: 0,
      combinable: false,
      prioridad: 2,
    };
  }

  if (code === "5K") {
    return {
      promoId: "5K",
      titulo: "Compras acumuladas",
      nombre: "Compras acumuladas",
      descripcion: "15% por recompra despues de 5kg acumulados",
      tipo: "PERCENT",
      valor: 15,
      minCompras: 0,
      minTotalPedido: 0,
      combinable: false,
      prioridad: 3,
    };
  }

  return null;
}

function promoIsVigente(code: string, vigenciaRaw: string): boolean {
  if (code === "FF") {
    return true;
  }

  const vigencia = parseDate(String(vigenciaRaw ?? "").trim());
  if (!vigencia) {
    return false;
  }
  return vigencia.getTime() >= Date.now();
}

function extractPromoFromRecord(headers: string[], row: string[]): PromoRule | null {
  const idxPromo = findHeaderIndex(headers, ["Promo", "Promocion", "Promoción"]);
  if (idxPromo < 0) return null;

  const idxPromoVigencia = findHeaderIndex(headers, ["PromoVigencia", "VigenciaPromo", "Vigencia"]);
  const promoCode = normalizePromoCode(String(row[idxPromo] ?? ""));
  if (!promoCode || promoCode === "0" || promoCode === "NONE") {
    return null;
  }

  const rule = toPromoRule(promoCode);
  if (!rule) return null;

  const vigenciaRaw = idxPromoVigencia >= 0 ? String(row[idxPromoVigencia] ?? "") : "";
  if (!promoIsVigente(promoCode, vigenciaRaw)) {
    return null;
  }

  return rule;
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

  const [clientesRows, muestrasRows] = await Promise.all([
    getSheetData("Clientes!A1:Z5000"),
    getSheetData("MuestrasRegistros!A1:AZ5000"),
  ]);

  if (!clientesRows.length && !muestrasRows.length) {
    return { telefono, promociones: [], message: "No hay promociones disponibles" };
  }

  const promociones: PromoRule[] = [];

  if (clientesRows.length) {
    const clientesHeaders = clientesRows[0] ?? [];
    const clientesData = clientesRows.slice(1);
    const idxTelefonoCliente = findHeaderIndex(clientesHeaders, ["Telefono", "Teléfono"]);
    if (idxTelefonoCliente >= 0) {
      const clienteRow = [...clientesData]
        .reverse()
        .find((row) => normalizePhone(String(row[idxTelefonoCliente] ?? "")) === telefono);
      if (clienteRow) {
        const promo = extractPromoFromRecord(clientesHeaders, clienteRow);
        if (promo) promociones.push(promo);
      }
    }
  }

  if (muestrasRows.length) {
    const muestrasHeaders = muestrasRows[0] ?? [];
    const muestrasData = muestrasRows.slice(1);
    const idxTelefonoMuestra = findHeaderIndex(muestrasHeaders, ["Telefono", "Teléfono"]);
    if (idxTelefonoMuestra >= 0) {
      const muestraRow = [...muestrasData]
        .reverse()
        .find((row) => normalizePhone(String(row[idxTelefonoMuestra] ?? "")) === telefono);
      if (muestraRow) {
        const promo = extractPromoFromRecord(muestrasHeaders, muestraRow);
        if (promo) promociones.push(promo);
      }
    }
  }

  const ff = promociones.find((promo) => promo.promoId === "FF");
  const normalizedPromos = ff ? [ff] : [...promociones].sort((a, b) => a.prioridad - b.prioridad);

  return {
    telefono,
    promociones: normalizedPromos,
    message: normalizedPromos.length
      ? `Cupon ${normalizedPromos[0].titulo} ${normalizedPromos[0].valor}% aplicado.`
      : "No hay promocion vigente para este celular.",
  };
}

export function applyPromotionsToOrder(subtotal: number, envioBase: number, promociones: PromoRule[]) {
  let bestPromo: PromoRule | null = null;
  let bestDiscount = 0;
  let bestShipping = envioBase;

  for (const promo of promociones) {
    if (promo.minTotalPedido > 0 && subtotal < promo.minTotalPedido) continue;

    let descuento = 0;
    let envioFinal = envioBase;
    if (promo.tipo === "FREE_SHIPPING") {
      envioFinal = 0;
    } else if (promo.tipo === "PERCENT") {
      descuento = Math.round((subtotal * promo.valor) / 100);
    } else if (promo.tipo === "FIXED") {
      descuento = Math.round(promo.valor);
    }

    if (descuento > subtotal) descuento = subtotal;
    const ahorroTotal = descuento + Math.max(0, envioBase - envioFinal);
    const bestAhorro = bestDiscount + Math.max(0, envioBase - bestShipping);
    if (!bestPromo || ahorroTotal > bestAhorro || (ahorroTotal === bestAhorro && promo.prioridad < bestPromo.prioridad)) {
      bestPromo = promo;
      bestDiscount = descuento;
      bestShipping = envioFinal;
    }

    if (promo.promoId === "FF") {
      bestPromo = promo;
      bestDiscount = descuento;
      bestShipping = envioFinal;
      break;
    }
  }

  return {
    descuento: bestDiscount,
    envioFinal: bestShipping,
    appliedPromos: bestPromo ? [bestPromo] : [],
    total: subtotal - bestDiscount + bestShipping,
  };
}
