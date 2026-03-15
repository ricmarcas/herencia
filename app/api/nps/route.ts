export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getSheetData } from "@/lib/sheets";
import { createNpsOfferToken } from "@/lib/nps-offer";

const SHEET_RANGE = "MuestrasRegistros!A1:AZ5000";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map((item) => normalizeHeader(item));
  const expected = candidates.map((item) => normalizeHeader(item));
  return normalized.findIndex((item) => expected.includes(item));
}

function columnToLetter(column: number): string {
  let temp = column;
  let letter = "";

  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }

  return letter;
}

async function updateRow(sheetRowNumber: number, values: Array<string | number | boolean>) {
  const lastCol = columnToLetter(values.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `MuestrasRegistros!A${sheetRowNumber}:${lastCol}${sheetRowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [values],
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      score?: number | string;
      comment?: string;
    };

    const email = String(body.email ?? "").trim().toLowerCase();
    const comment = String(body.comment ?? "").trim();
    const hasScore = body.score !== undefined && String(body.score).trim().length > 0;
    const score = Number(body.score ?? NaN);

    if (!email) {
      return NextResponse.json({ success: false, message: "Email requerido" }, { status: 400 });
    }

    if (hasScore && (!Number.isInteger(score) || score < 0 || score > 10)) {
      return NextResponse.json({ success: false, message: "Score invalido (0-10)" }, { status: 400 });
    }

    if (comment.length > 280) {
      return NextResponse.json({ success: false, message: "Comentario excede 280 caracteres" }, { status: 400 });
    }

    if (!hasScore && !comment) {
      return NextResponse.json({ success: false, message: "Nada que actualizar" }, { status: 400 });
    }

    const rows = await getSheetData(SHEET_RANGE);
    const headers = rows[0] ?? [];
    const dataRows = rows.slice(1);

    if (!headers.length) {
      return NextResponse.json({ success: false, message: "Hoja sin encabezados" }, { status: 500 });
    }

    const idxEmail = findHeaderIndex(headers, ["Email"]);
    const idxNps = findHeaderIndex(headers, ["NPS"]);
    const idxComentario = findHeaderIndex(headers, ["Comentario"]);
    const idxEstatus = findHeaderIndex(headers, ["Estatus", "Estado"]);
    const idxPromo = findHeaderIndex(headers, ["Promo", "Promocion", "Promoción"]);
    const idxPromoAsignada = findHeaderIndex(headers, ["PromoAsignada", "FechaPromoAsignada"]);
    const idxPromoVigencia = findHeaderIndex(headers, ["PromoVigencia", "Vigencia", "VigenciaPromo"]);

    if (idxEmail < 0) {
      return NextResponse.json({ success: false, message: "Columna Email no encontrada" }, { status: 500 });
    }

    const rowIndex = dataRows.findIndex((row) => String(row[idxEmail] ?? "").trim().toLowerCase() === email);
    if (rowIndex < 0) {
      return NextResponse.json({ success: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const sheetRowNumber = rowIndex + 2;
    const currentRow = rows[sheetRowNumber - 1] ?? [];
    const mutableRow: Array<string | number | boolean> = Array.from(
      { length: headers.length },
      (_, idx) => currentRow[idx] ?? ""
    );

    let offerToken = "";
    let offerExpiresAt = "";

    if (hasScore) {
      if (idxNps < 0) {
        return NextResponse.json({ success: false, message: "Columna NPS no encontrada" }, { status: 500 });
      }
      mutableRow[idxNps] = score;

      if (score >= 8) {
        if (idxEstatus >= 0) {
          mutableRow[idxEstatus] = "cupon";
        }
        if (idxPromo >= 0) {
          mutableRow[idxPromo] = "NPSM+";
        }
        if (idxPromoAsignada >= 0) {
          mutableRow[idxPromoAsignada] = new Date().toISOString();
        }
        if (idxPromoVigencia >= 0) {
          mutableRow[idxPromoVigencia] = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        }
        offerToken = createNpsOfferToken(email, 7);
        offerExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    if (comment) {
      if (idxComentario < 0) {
        return NextResponse.json({ success: false, message: "Columna Comentario no encontrada" }, { status: 500 });
      }
      mutableRow[idxComentario] = comment;
    }

    await updateRow(sheetRowNumber, mutableRow);
    return NextResponse.json({
      success: true,
      offerToken,
      offerExpiresAt,
      offerDiscountPercent: offerToken ? 15 : 0,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error actualizando NPS",
      },
      { status: 500 }
    );
  }
}
