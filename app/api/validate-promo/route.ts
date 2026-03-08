export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";
import type { PromoRule, PromoType } from "@/types/pedido";

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

function isDateInRange(value: string, start: string, end: string): boolean {
  if (!start && !end) {
    return true;
  }

  if (start && value < start) {
    return false;
  }

  if (end && value > end) {
    return false;
  }

  return true;
}

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parsePromoType(value: string): PromoType | null {
  const normalized = normalizeHeader(value);
  if (normalized === "percent") return "PERCENT";
  if (normalized === "freeshipping" || normalized === "enviogratis") return "FREE_SHIPPING";
  if (normalized === "fixed" || normalized === "monto") return "FIXED";
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const telefono = normalizePhone(String(body?.telefono ?? ""));

    if (telefono.length !== 10) {
      return NextResponse.json({ success: false, promociones: [], telefono, message: "Telefono invalido" });
    }

    const [clientesRows, promocionesRows] = await Promise.all([
      getSheetData("Clientes!A1:Z5000"),
      getSheetData("Promociones!A1:Z5000"),
    ]);

    if (!clientesRows.length || !promocionesRows.length) {
      return NextResponse.json({ success: true, promociones: [], telefono, message: "No hay promociones disponibles" });
    }

    const clientesHeaders = clientesRows[0] ?? [];
    const clientesData = clientesRows.slice(1);

    const idxTelefonoCliente = findHeaderIndex(clientesHeaders, ["Telefono", "Teléfono"]);
    const idxComprasCliente = findHeaderIndex(clientesHeaders, ["Compras"]);

    if (idxTelefonoCliente < 0 || idxComprasCliente < 0) {
      return NextResponse.json({ success: true, promociones: [], telefono, message: "No se pudo validar historial del cliente" });
    }

    const cliente = clientesData.find((row) => normalizePhone(String(row[idxTelefonoCliente] ?? "")) === telefono);

    if (!cliente) {
      return NextResponse.json({
        success: true,
        promociones: [],
        telefono,
        message: "No encontramos compras previas para este numero",
      });
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
      return NextResponse.json({
        success: true,
        promociones: [],
        telefono,
        message: "Faltan columnas requeridas en hoja Promociones",
      });
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
        if (comprasCliente < minCompras) {
          return null;
        }

        const valor = parseNumber(String(row[idxValor] ?? "0"), 0);
        if (valor <= 0) {
          return null;
        }

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

    const message =
      promociones.length > 0
        ? `Encontramos ${promociones.length} promocion(es) vigentes para tu cuenta.`
        : "Cliente sin promocion vigente";

    return NextResponse.json({
      success: true,
      promociones,
      telefono,
      message,
    });
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      promociones: [],
      telefono: "",
      message: error instanceof Error ? error.message : "Error validando promocion",
    });
  }
}
