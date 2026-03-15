export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";
import { verifyNpsOfferToken } from "@/lib/nps-offer";

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

async function isFirstPurchaseByEmail(emailRaw: string): Promise<boolean> {
  const email = String(emailRaw).trim().toLowerCase();
  if (!email) return false;

  const rows = await getSheetData("Clientes!A1:Z5000");
  const headers = rows[0] ?? [];
  const data = rows.slice(1);
  const idxEmail = findHeaderIndex(headers, ["Email", "Correo", "CorreoElectronico"]);
  const idxCompras = findHeaderIndex(headers, ["Compras"]);

  if (idxEmail < 0 || idxCompras < 0) {
    return true;
  }

  const row = data.find((item) => String(item[idxEmail] ?? "").trim().toLowerCase() === email);
  if (!row) return true;

  const compras = Number(row[idxCompras] ?? 0);
  return !Number.isFinite(compras) || compras <= 0;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string };
    const token = String(body.token ?? "").trim();
    const verified = verifyNpsOfferToken(token);

    if (!verified.valid) {
      return NextResponse.json({
        success: true,
        eligible: false,
        message: "Promocion invalida o expirada.",
      });
    }

    const email = verified.email;
    const sampleRows = await getSheetData("MuestrasRegistros!A1:AZ5000");
    const headers = sampleRows[0] ?? [];
    const data = sampleRows.slice(1);

    const idxEmail = findHeaderIndex(headers, ["Email"]);
    const idxNombre = findHeaderIndex(headers, ["Nombre"]);
    const idxTelefono = findHeaderIndex(headers, ["Telefono", "Teléfono"]);
    const idxCp = findHeaderIndex(headers, ["CP", "CodigoPostal", "Codigo Postal"]);
    const idxColonia = findHeaderIndex(headers, ["Colonia"]);
    const idxCalle = findHeaderIndex(headers, ["Calle"]);
    const idxNumeroExterior = findHeaderIndex(headers, ["NumeroExterior", "Numero Ext", "NumeroExt"]);
    const idxNumeroInterior = findHeaderIndex(headers, ["NumeroInterior", "Numero Int", "NumeroInt"]);
    const idxEstatus = findHeaderIndex(headers, ["Estatus", "Estado"]);
    const idxNps = findHeaderIndex(headers, ["NPS"]);

    if (idxEmail < 0 || idxEstatus < 0 || idxNps < 0) {
      return NextResponse.json({
        success: true,
        eligible: false,
        message: "Configuracion incompleta para validar promocion NPS.",
      });
    }

    const row = data.find((item) => String(item[idxEmail] ?? "").trim().toLowerCase() === email);
    if (!row) {
      return NextResponse.json({
        success: true,
        eligible: false,
        message: "No encontramos registro de muestra para esta promocion.",
      });
    }

    const nps = Number(row[idxNps] ?? 0);
    const estatus = String(row[idxEstatus] ?? "").trim().toLowerCase();
    const firstPurchase = await isFirstPurchaseByEmail(email);
    const eligible = nps >= 8 && estatus === "cupon" && firstPurchase;

    return NextResponse.json({
      success: true,
      eligible,
      discountPercent: eligible ? 15 : 0,
      expiresAt: new Date(verified.exp).toISOString(),
      message: eligible
        ? "Promocion NPS activa: 15% en tu primera compra."
        : "La promocion no esta disponible para esta cuenta.",
      profile: {
        nombre: String(idxNombre >= 0 ? row[idxNombre] ?? "" : ""),
        email,
        telefono: String(idxTelefono >= 0 ? row[idxTelefono] ?? "" : ""),
        cp: String(idxCp >= 0 ? row[idxCp] ?? "" : ""),
        colonia: String(idxColonia >= 0 ? row[idxColonia] ?? "" : ""),
        calle: String(idxCalle >= 0 ? row[idxCalle] ?? "" : ""),
        numeroExterior: String(idxNumeroExterior >= 0 ? row[idxNumeroExterior] ?? "" : ""),
        numeroInterior: String(idxNumeroInterior >= 0 ? row[idxNumeroInterior] ?? "" : ""),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        eligible: false,
        message: error instanceof Error ? error.message : "Error validando promocion NPS",
      },
      { status: 500 }
    );
  }
}
