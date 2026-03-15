export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getSheetData } from "@/lib/sheets";

const PEDIDOS_RANGE = "Pedidos!A1:AZ5000";
const CLIENTES_RANGE = "Clientes!A1:Z5000";

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

function parseScore(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 10) return null;
  return n;
}

async function updateRow(sheetName: string, rowNumber: number, values: Array<string | number | boolean>) {
  const lastCol = columnToLetter(values.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${sheetName}!A${rowNumber}:${lastCol}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

async function updateClientesAggregates(clienteId: string, npsPedido: number | null): Promise<void> {
  if (!clienteId || npsPedido === null) return;

  const rows = await getSheetData(CLIENTES_RANGE);
  const headers = rows[0] ?? [];
  const data = rows.slice(1);
  if (!headers.length) return;

  const idxClienteId = findHeaderIndex(headers, ["ClienteID", "IDCliente"]);
  if (idxClienteId < 0) return;

  const rowIndex = data.findIndex((row) => String(row[idxClienteId] ?? "").trim() === clienteId);
  if (rowIndex < 0) return;

  const sheetRowNumber = rowIndex + 2;
  const currentRow = rows[sheetRowNumber - 1] ?? [];
  const mutableRow: Array<string | number | boolean> = Array.from(
    { length: headers.length },
    (_, idx) => currentRow[idx] ?? ""
  );

  const idxPromedio = findHeaderIndex(headers, ["NPSPromedio", "NPSPromedioPedido"]);
  const idxConteo = findHeaderIndex(headers, ["NPSConteo", "NPSRespuestas", "NPSPedidos"]);
  const idxUltimo = findHeaderIndex(headers, ["UltimoNPS", "UltimoNPSPedido"]);

  if (idxPromedio >= 0 && idxConteo >= 0) {
    const currentAvg = Number(mutableRow[idxPromedio] ?? 0);
    const currentCount = Number(mutableRow[idxConteo] ?? 0);
    const avg = Number.isFinite(currentAvg) ? currentAvg : 0;
    const count = Number.isFinite(currentCount) ? currentCount : 0;
    const nextCount = count + 1;
    const nextAvg = Number(((avg * count + npsPedido) / nextCount).toFixed(2));
    mutableRow[idxPromedio] = nextAvg;
    mutableRow[idxConteo] = nextCount;
  }
  if (idxUltimo >= 0) {
    mutableRow[idxUltimo] = new Date().toISOString();
  }

  await updateRow("Clientes", sheetRowNumber, mutableRow);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      pedidoId?: string;
      npsPedido?: number | string;
      npsEntrega?: number | string;
      npsSabor?: number | string;
      comentario?: string;
    };

    const pedidoId = String(body.pedidoId ?? "").trim();
    const comentario = String(body.comentario ?? "").trim();
    const npsPedido = parseScore(body.npsPedido);
    const npsEntrega = parseScore(body.npsEntrega);
    const npsSabor = parseScore(body.npsSabor);

    if (!pedidoId) {
      return NextResponse.json({ success: false, message: "pedidoId requerido" }, { status: 400 });
    }
    if (comentario.length > 280) {
      return NextResponse.json({ success: false, message: "Comentario excede 280 caracteres" }, { status: 400 });
    }
    if (npsPedido === null && npsEntrega === null && npsSabor === null && !comentario) {
      return NextResponse.json({ success: false, message: "Nada que actualizar" }, { status: 400 });
    }

    const rows = await getSheetData(PEDIDOS_RANGE);
    const headers = rows[0] ?? [];
    const data = rows.slice(1);
    if (!headers.length) {
      return NextResponse.json({ success: false, message: "Hoja Pedidos sin encabezados" }, { status: 500 });
    }

    const idxId = findHeaderIndex(headers, ["ID", "PedidoID"]);
    const idxClienteId = findHeaderIndex(headers, ["ClienteID", "IDCliente"]);
    const idxNpsPedido = findHeaderIndex(headers, ["NPS_Pedido", "NPSPedido", "NPS"]);
    const idxNpsEntrega = findHeaderIndex(headers, ["NPS_Entrega", "NPSEntrega"]);
    const idxNpsSabor = findHeaderIndex(headers, ["NPS_Sabor", "NPSSabor"]);
    const idxComentario = findHeaderIndex(headers, ["Comentario"]);
    const idxUltimoEmail = findHeaderIndex(headers, ["UltimoEmail"]);

    if (idxId < 0) {
      return NextResponse.json({ success: false, message: "Columna ID no encontrada en Pedidos" }, { status: 500 });
    }

    const rowIndex = data.findIndex((row) => String(row[idxId] ?? "").trim() === pedidoId);
    if (rowIndex < 0) {
      return NextResponse.json({ success: false, message: "Pedido no encontrado" }, { status: 404 });
    }

    const sheetRowNumber = rowIndex + 2;
    const currentRow = rows[sheetRowNumber - 1] ?? [];
    const mutableRow: Array<string | number | boolean> = Array.from(
      { length: headers.length },
      (_, idx) => currentRow[idx] ?? ""
    );

    if (idxNpsPedido >= 0 && npsPedido !== null) mutableRow[idxNpsPedido] = npsPedido;
    if (idxNpsEntrega >= 0 && npsEntrega !== null) mutableRow[idxNpsEntrega] = npsEntrega;
    if (idxNpsSabor >= 0 && npsSabor !== null) mutableRow[idxNpsSabor] = npsSabor;
    if (idxComentario >= 0 && comentario) mutableRow[idxComentario] = comentario;
    if (idxUltimoEmail >= 0) mutableRow[idxUltimoEmail] = new Date().toISOString();

    await updateRow("Pedidos", sheetRowNumber, mutableRow);

    const clienteId = String(idxClienteId >= 0 ? mutableRow[idxClienteId] ?? "" : "").trim();
    await updateClientesAggregates(clienteId, npsPedido);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error actualizando NPS de pedido",
      },
      { status: 500 }
    );
  }
}
