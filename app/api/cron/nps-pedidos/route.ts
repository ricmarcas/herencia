export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { Resend } from "resend";
import { getSheetData } from "@/lib/sheets";
import { appendHerenciaSignature } from "@/lib/email-brand";

const PEDIDOS_RANGE = "Pedidos!A1:AZ5000";
const CLIENTES_RANGE = "Clientes!A1:Z5000";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const resendNoReplyEmail = process.env.RESEND_NO_REPLY_EMAIL ?? resendFromEmail;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

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

function findHeaderIndexes(headers: string[], candidates: string[]): number[] {
  const normalized = headers.map((item) => normalizeHeader(item));
  const expected = candidates.map((item) => normalizeHeader(item));
  const indexes: number[] = [];
  normalized.forEach((item, index) => {
    if (expected.includes(item)) indexes.push(index);
  });
  return indexes;
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

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeStatus(value: string): string {
  return String(value ?? "").trim().toLowerCase();
}

function isNpsFollowupStatus(value: string): boolean {
  const status = normalizeStatus(value);
  return status.startsWith("seguimiento_");
}

function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization") ?? "";
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (secret) return authorization === `Bearer ${secret}`;
  return isVercelCron;
}

function isAuthorizedAdmin(req: Request): boolean {
  const expectedPassword = process.env.ADMIN_MUESTRAS_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
  const providedPassword = req.headers.get("x-admin-password") ?? "";
  return Boolean(expectedPassword) && providedPassword === expectedPassword;
}

function resolvePublicBaseUrl(req: Request): string {
  const configured = String(process.env.NPS_BASE_URL ?? "").trim();
  if (configured.includes("deherencia.com")) return configured.replace(/\/$/, "");
  const origin = new URL(req.url).origin;
  if (origin.includes("deherencia.com")) return origin.replace(/\/$/, "");
  return "https://www.deherencia.com";
}

function shouldSendNpsPedido(estatus: string, fechaEntregaReal: string, npsPedido: string): boolean {
  if (normalizeStatus(estatus) !== "entregada") return false;
  if (String(npsPedido).trim().length > 0) return false;
  const entregaDate = parseDate(fechaEntregaReal);
  if (!entregaDate) return false;
  return Date.now() - entregaDate.getTime() >= 24 * 60 * 60 * 1000;
}

function buildNpsPedidoEmailHtml(baseUrl: string, pedidoId: string, nombre: string): string {
  const buttons = Array.from({ length: 11 }, (_, score) => {
    const url = `${baseUrl}/nps-pedido?pedidoId=${encodeURIComponent(pedidoId)}&score=${score}`;
    return `<a href="${url}" style="display:inline-block;margin:4px;padding:10px 12px;border-radius:8px;background:#7a5c3e;color:#fff;text-decoration:none;">${score}</a>`;
  }).join("");

  return appendHerenciaSignature(`
    <h2>Como fue tu experiencia con tu pedido?</h2>
    <p>Hola ${nombre || "cliente"}, gracias por comprar en Barbacoa Estilo Parral.</p>
    <p>1) Evalua tu experiencia general (0 a 10):</p>
    <div>${buttons}</div>
    <p style="margin-top:12px">Despues podras evaluar entrega y sabor en un paso final.</p>
  `);
}

async function updateRow(sheetRowNumber: number, values: Array<string | number | boolean>) {
  const lastCol = columnToLetter(values.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Pedidos!A${sheetRowNumber}:${lastCol}${sheetRowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

async function runNpsPedidos(req: Request) {
  if (!resend) {
    return NextResponse.json({ success: false, message: "RESEND_API_KEY no configurada" }, { status: 500 });
  }

  try {
    const [pedidosRows, clientesRows] = await Promise.all([
      getSheetData(PEDIDOS_RANGE),
      getSheetData(CLIENTES_RANGE),
    ]);

    const pHeaders = pedidosRows[0] ?? [];
    const pData = pedidosRows.slice(1);
    const cHeaders = clientesRows[0] ?? [];
    const cData = clientesRows.slice(1);

    const idxPedidoId = findHeaderIndex(pHeaders, ["ID", "PedidoID"]);
    const idxClienteId = findHeaderIndex(pHeaders, ["ClienteID", "IDCliente"]);
    const idxEstatus = findHeaderIndex(pHeaders, ["Estatus", "Estado", "EstatusPedido"]);
    const idxNpsPedido = findHeaderIndex(pHeaders, ["NPS_Pedido", "NPSPedido", "NPS"]);
    const idxUltimoEmail = findHeaderIndex(pHeaders, ["UltimoEmail"]);
    const idxFechaEntregaIndexes = findHeaderIndexes(pHeaders, ["FechaEntrega", "Fecha Entrega"]);
    const idxFechaEntregaReal = idxFechaEntregaIndexes[1] ?? findHeaderIndex(pHeaders, ["FechaEntregaReal", "EntregadoEl"]);

    const idxCClienteId = findHeaderIndex(cHeaders, ["ClienteID", "IDCliente"]);
    const idxCEmail = findHeaderIndex(cHeaders, ["Email", "Correo", "CorreoElectronico"]);
    const idxCNombre = findHeaderIndex(cHeaders, ["Nombre"]);

    if (idxPedidoId < 0 || idxClienteId < 0 || idxEstatus < 0 || idxNpsPedido < 0 || idxUltimoEmail < 0 || idxFechaEntregaReal < 0) {
      return NextResponse.json({ success: false, message: "Faltan columnas requeridas en Pedidos" }, { status: 500 });
    }
    if (idxCClienteId < 0 || idxCEmail < 0) {
      return NextResponse.json({ success: false, message: "Faltan columnas requeridas en Clientes" }, { status: 500 });
    }

    const lastEmailByClienteId = new Map<string, Date>();
    for (const row of pData) {
      const clienteId = String(row[idxClienteId] ?? "").trim();
      const raw = String(row[idxUltimoEmail] ?? "").trim();
      const estatus = String(idxEstatus >= 0 ? row[idxEstatus] ?? "" : "");
      if (!clienteId || !raw) continue;
      if (!isNpsFollowupStatus(estatus)) continue;
      const parsed = parseDate(raw);
      if (!parsed) continue;
      const current = lastEmailByClienteId.get(clienteId);
      if (!current || parsed.getTime() > current.getTime()) lastEmailByClienteId.set(clienteId, parsed);
    }

    const baseUrl = resolvePublicBaseUrl(req);
    let sent = 0;
    let skipped = 0;

    for (let i = 0; i < pData.length; i += 1) {
      const row = pData[i] ?? [];
      const pedidoId = String(row[idxPedidoId] ?? "").trim();
      const clienteId = String(row[idxClienteId] ?? "").trim();
      const estatus = String(row[idxEstatus] ?? "");
      const fechaEntregaReal = String(row[idxFechaEntregaReal] ?? "");
      const npsPedido = String(row[idxNpsPedido] ?? "");

      if (!pedidoId || !clienteId || !shouldSendNpsPedido(estatus, fechaEntregaReal, npsPedido)) {
        skipped += 1;
        continue;
      }

      const lastEmail = lastEmailByClienteId.get(clienteId);
      if (lastEmail && Date.now() - lastEmail.getTime() < 30 * 24 * 60 * 60 * 1000) {
        skipped += 1;
        continue;
      }

      const cliente = cData.find((item) => String(item[idxCClienteId] ?? "").trim() === clienteId);
      const email = String(idxCEmail >= 0 ? cliente?.[idxCEmail] ?? "" : "").trim().toLowerCase();
      const nombre = String(idxCNombre >= 0 ? cliente?.[idxCNombre] ?? "" : "").trim();
      if (!email) {
        skipped += 1;
        continue;
      }

      const rowNumber = i + 2;
      const rowValues: Array<string | number | boolean> = Array.from({ length: pHeaders.length }, (_, idx) => row[idx] ?? "");

      try {
        await resend.emails.send({
          from: resendNoReplyEmail,
          to: [email],
          subject: "Queremos evaluar tu experiencia con tu pedido",
          html: buildNpsPedidoEmailHtml(baseUrl, pedidoId, nombre),
        });

        const nowIso = new Date().toISOString();
        if (idxEstatus >= 0) {
          rowValues[idxEstatus] = "seguimiento_1";
        }
        rowValues[idxUltimoEmail] = nowIso;
        await updateRow(rowNumber, rowValues);
        lastEmailByClienteId.set(clienteId, new Date(nowIso));
        sent += 1;
      } catch (sendError) {
        console.error(`No se pudo enviar NPS de pedido ${pedidoId}:`, sendError);
      }
    }

    return NextResponse.json({ success: true, sent, skipped });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error ejecutando cron NPS pedidos",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  return runNpsPedidos(req);
}

export async function POST(req: Request) {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  return runNpsPedidos(req);
}
