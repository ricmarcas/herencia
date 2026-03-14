export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getSheetData } from "@/lib/sheets";

const SHEET_RANGE = "MuestrasRegistros!A1:AZ5000";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

type SampleAdminRow = {
  rowNumber: number;
  fechaRegistro: string;
  email: string;
  nombre: string;
  telefono: string;
  cp: string;
  colonia: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  estatus: string;
  fechaProgramada: string;
  fechaEntrega: string;
  nps: string;
  comentario: string;
  ultimoEmail: string;
};

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

function normalizeStatus(value: string): string {
  return value.trim().toLowerCase();
}

function getAdminPassword(): string {
  return process.env.ADMIN_MUESTRAS_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
}

function isAuthorized(req: Request): boolean {
  const expectedPassword = getAdminPassword();
  const providedPassword = req.headers.get("x-admin-password") ?? "";
  return Boolean(expectedPassword) && providedPassword === expectedPassword;
}

function buildRow(headers: string[], row: string[], rowNumber: number): SampleAdminRow {
  const idxFechaRegistro = findHeaderIndex(headers, ["FechaRegistro"]);
  const idxEmail = findHeaderIndex(headers, ["Email"]);
  const idxNombre = findHeaderIndex(headers, ["Nombre"]);
  const idxTelefono = findHeaderIndex(headers, ["Telefono", "Teléfono"]);
  const idxCp = findHeaderIndex(headers, ["CP", "CodigoPostal", "Codigo Postal"]);
  const idxColonia = findHeaderIndex(headers, ["Colonia"]);
  const idxCalle = findHeaderIndex(headers, ["Calle"]);
  const idxNumeroExterior = findHeaderIndex(headers, ["NumeroExterior", "Numero Ext", "NumeroExt"]);
  const idxNumeroInterior = findHeaderIndex(headers, ["NumeroInterior", "Numero Int", "NumeroInt"]);
  const idxEstatus = findHeaderIndex(headers, ["Estatus", "Estado"]);
  const idxFechaProgramada = findHeaderIndex(headers, ["FechaProgramada"]);
  const idxFechaEntrega = findHeaderIndex(headers, ["FechaEntrega"]);
  const idxNps = findHeaderIndex(headers, ["NPS"]);
  const idxComentario = findHeaderIndex(headers, ["Comentario"]);
  const idxUltimoEmail = findHeaderIndex(headers, ["UltimoEmail"]);

  const getValue = (index: number) => String(index >= 0 ? row[index] ?? "" : "");

  return {
    rowNumber,
    fechaRegistro: getValue(idxFechaRegistro),
    email: getValue(idxEmail),
    nombre: getValue(idxNombre),
    telefono: getValue(idxTelefono),
    cp: getValue(idxCp),
    colonia: getValue(idxColonia),
    calle: getValue(idxCalle),
    numeroExterior: getValue(idxNumeroExterior),
    numeroInterior: getValue(idxNumeroInterior),
    estatus: getValue(idxEstatus),
    fechaProgramada: getValue(idxFechaProgramada),
    fechaEntrega: getValue(idxFechaEntrega),
    nps: getValue(idxNps),
    comentario: getValue(idxComentario),
    ultimoEmail: getValue(idxUltimoEmail),
  };
}

function statusMatches(rowStatus: string, requested: string): boolean {
  const current = normalizeStatus(rowStatus);
  const target = normalizeStatus(requested);

  if (target === "solicitud") {
    return current === "solicitud" || current === "registrado";
  }

  return current === target;
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

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const estatus = (searchParams.get("estatus") ?? "solicitud").trim();

    const rows = await getSheetData(SHEET_RANGE);
    const headers = rows[0] ?? [];
    const dataRows = rows.slice(1);

    const mappedRows = dataRows
      .map((row, index) => buildRow(headers, row, index + 2))
      .filter((row) => statusMatches(row.estatus, estatus));

    return NextResponse.json({
      success: true,
      rows: mappedRows,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error cargando registros",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      action?: string;
      rowNumber?: number;
      fechaProgramada?: string;
    };

    const action = String(body.action ?? "").trim();
    const rowNumber = Number(body.rowNumber ?? 0);
    const fechaProgramadaRaw = String(body.fechaProgramada ?? "").trim();

    if (!rowNumber || rowNumber < 2) {
      return NextResponse.json({ success: false, message: "rowNumber invalido" }, { status: 400 });
    }

    const rows = await getSheetData(SHEET_RANGE);
    const headers = rows[0] ?? [];
    const dataRows = rows.slice(1);
    const target = dataRows[rowNumber - 2] ?? [];

    if (!headers.length || !target.length) {
      return NextResponse.json({ success: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const rowValues: Array<string | number | boolean> = Array.from(
      { length: headers.length },
      (_, idx) => target[idx] ?? ""
    );

    const idxEstatus = findHeaderIndex(headers, ["Estatus", "Estado"]);
    const idxFechaProgramada = findHeaderIndex(headers, ["FechaProgramada"]);
    const idxFechaEntrega = findHeaderIndex(headers, ["FechaEntrega"]);

    if (idxEstatus < 0) {
      return NextResponse.json({ success: false, message: "Columna Estatus no encontrada" }, { status: 400 });
    }

    if (action === "programar") {
      if (idxFechaProgramada < 0) {
        return NextResponse.json({ success: false, message: "Columna FechaProgramada no encontrada" }, { status: 400 });
      }

      if (!fechaProgramadaRaw) {
        return NextResponse.json({ success: false, message: "FechaProgramada requerida" }, { status: 400 });
      }

      const parsed = new Date(fechaProgramadaRaw);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ success: false, message: "FechaProgramada invalida" }, { status: 400 });
      }

      rowValues[idxFechaProgramada] = parsed.toISOString();
      rowValues[idxEstatus] = "programada";
      await updateRow(rowNumber, rowValues);
      return NextResponse.json({ success: true });
    }

    if (action === "entregar") {
      if (idxFechaEntrega < 0) {
        return NextResponse.json({ success: false, message: "Columna FechaEntrega no encontrada" }, { status: 400 });
      }

      rowValues[idxFechaEntrega] = new Date().toISOString();
      rowValues[idxEstatus] = "entregada";
      await updateRow(rowNumber, rowValues);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: "Accion no soportada" }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error actualizando registro",
      },
      { status: 500 }
    );
  }
}
