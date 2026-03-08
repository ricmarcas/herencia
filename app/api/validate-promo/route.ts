export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

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

function readConfig(configRows: string[][]): Record<string, string> {
  return configRows.reduce<Record<string, string>>((acc, row) => {
    const key = String(row[0] ?? "").trim();
    const value = String(row[1] ?? "").trim();
    if (key) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const telefono = normalizePhone(String(body?.telefono ?? ""));

    if (telefono.length !== 10) {
      return NextResponse.json({ success: false, promo: null, message: "Telefono invalido" });
    }

    const [clientesRows, configRows] = await Promise.all([
      getSheetData("Clientes!A1:Z5000"),
      getSheetData("Configuracion!A2:B200"),
    ]);

    if (!clientesRows.length) {
      return NextResponse.json({ success: true, promo: null });
    }

    const headers = clientesRows[0] ?? [];
    const dataRows = clientesRows.slice(1);

    const idxTelefono = findHeaderIndex(headers, ["Telefono", "Teléfono"]);
    const idxCompras = findHeaderIndex(headers, ["Compras"]);

    if (idxTelefono < 0 || idxCompras < 0) {
      return NextResponse.json({ success: true, promo: null });
    }

    const cliente = dataRows.find((row) => normalizePhone(String(row[idxTelefono] ?? "")) === telefono);

    if (!cliente) {
      return NextResponse.json({ success: true, promo: null, message: "No encontramos compras previas para este numero" });
    }

    const compras = Number(cliente[idxCompras] ?? 0);
    const config = readConfig(configRows);

    const promoActiva = String(config.PROMO_ACTIVA ?? "FALSE").toUpperCase() === "TRUE";
    const minCompras = Number(config.PROMO_MIN_COMPRAS ?? "2");
    const promoValor = Number(config.PROMO_VALOR_PORCENTAJE ?? "10");

    if (!promoActiva || compras < minCompras || promoValor <= 0) {
      return NextResponse.json({ success: true, promo: null, message: "Cliente sin promocion vigente" });
    }

    const promoId = config.PROMO_ID || "PROMO_RECOMPRA";
    const nombre = config.PROMO_NOMBRE || "Descuento por recompra";
    const descripcion =
      config.PROMO_DESCRIPCION || `Tienes ${promoValor}% de descuento en productos por ser cliente recurrente.`;

    return NextResponse.json({
      success: true,
      promo: {
        promoId,
        nombre,
        descripcion,
        tipo: "PERCENT",
        valor: promoValor,
        telefono,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      promo: null,
      message: error instanceof Error ? error.message : "Error validando promocion",
    });
  }
}
