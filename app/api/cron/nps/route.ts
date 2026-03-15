export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { Resend } from "resend";
import { getSheetData } from "@/lib/sheets";

const SHEET_RANGE = "MuestrasRegistros!A1:AZ5000";

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

function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization") ?? "";
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";

  if (secret) {
    return authorization === `Bearer ${secret}`;
  }

  return isVercelCron;
}

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shouldSendNps(estatus: string, fechaEntrega: string, nps: string): boolean {
  if (estatus.trim().toLowerCase() !== "entregada") return false;
  if (String(nps).trim().length > 0) return false;
  const entregaDate = parseDate(fechaEntrega);
  if (!entregaDate) return false;

  const diffMs = Date.now() - entregaDate.getTime();
  return diffMs >= 24 * 60 * 60 * 1000;
}

function buildNpsEmailHtml(baseUrl: string, email: string, nombre: string): string {
  const buttons = Array.from({ length: 11 }, (_, score) => {
    const url = `${baseUrl}/nps?email=${encodeURIComponent(email)}&score=${score}`;
    return `<a href="${url}" style="display:inline-block;margin:4px;padding:10px 12px;border-radius:8px;background:#7a5c3e;color:#fff;text-decoration:none;">${score}</a>`;
  }).join("");

  return `
    <h2>¿Que tan probable es que recomiendes Barbacoa Herencia?</h2>
    <p>Hola ${nombre || "cliente"}, tu opinion nos ayuda a mejorar.</p>
    <p>Califica tu experiencia de 0 a 10:</p>
    <div>${buttons}</div>
    <p style="margin-top:16px">Gracias por tu tiempo.</p>
  `;
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  if (!resend) {
    return NextResponse.json({ success: false, message: "RESEND_API_KEY no configurada" }, { status: 500 });
  }

  try {
    const rows = await getSheetData(SHEET_RANGE);
    const headers = rows[0] ?? [];
    const dataRows = rows.slice(1);

    if (!headers.length) {
      return NextResponse.json({ success: false, message: "Hoja sin encabezados" }, { status: 500 });
    }

    const idxEstatus = findHeaderIndex(headers, ["Estatus", "Estado"]);
    const idxFechaEntrega = findHeaderIndex(headers, ["FechaEntrega"]);
    const idxNps = findHeaderIndex(headers, ["NPS"]);
    const idxUltimoEmail = findHeaderIndex(headers, ["UltimoEmail"]);
    const idxEmail = findHeaderIndex(headers, ["Email"]);
    const idxNombre = findHeaderIndex(headers, ["Nombre"]);

    if (idxEstatus < 0 || idxFechaEntrega < 0 || idxNps < 0 || idxUltimoEmail < 0 || idxEmail < 0) {
      return NextResponse.json({ success: false, message: "Faltan columnas requeridas en MuestrasRegistros" }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://deherencia.com";
    let sent = 0;
    let skipped = 0;

    for (let i = 0; i < dataRows.length; i += 1) {
      const row = dataRows[i] ?? [];
      const estatus = String(row[idxEstatus] ?? "");
      const fechaEntrega = String(row[idxFechaEntrega] ?? "");
      const nps = String(row[idxNps] ?? "");
      const email = String(row[idxEmail] ?? "").trim().toLowerCase();
      const nombre = String(idxNombre >= 0 ? row[idxNombre] ?? "" : "").trim();

      if (!shouldSendNps(estatus, fechaEntrega, nps) || !email) {
        skipped += 1;
        continue;
      }

      const sheetRowNumber = i + 2;
      const rowValues: Array<string | number | boolean> = Array.from(
        { length: headers.length },
        (_, idx) => row[idx] ?? ""
      );

      try {
        await resend.emails.send({
          from: resendNoReplyEmail,
          to: [email],
          subject: "¿Cómo fue tu experiencia con tu muestra?",
          html: buildNpsEmailHtml(baseUrl, email, nombre),
        });

        rowValues[idxEstatus] = "seguimiento_1";
        rowValues[idxUltimoEmail] = new Date().toISOString();
        await updateRow(sheetRowNumber, rowValues);
        sent += 1;
      } catch (sendError) {
        console.error(`No se pudo enviar NPS a ${email}:`, sendError);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error ejecutando cron de NPS",
      },
      { status: 500 }
    );
  }
}
