export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { google } from "googleapis";
import { appendRow, getSheetData } from "@/lib/sheets";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

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
  const normalized = headers.map((header) => normalizeHeader(header));
  const normalizedCandidates = candidates.map((candidate) => normalizeHeader(candidate));
  return normalized.findIndex((header) => normalizedCandidates.includes(header));
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

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(0, 10);
}

function toNumber(value: string | number | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function updateRow(sheetName: string, rowNumber: number, rowValues: Array<string | number | boolean>) {
  const lastCol = columnToLetter(rowValues.length);

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${sheetName}!A${rowNumber}:${lastCol}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [rowValues],
    },
  });
}

async function upsertCliente(data: {
  telefono: string;
  nombre: string;
  email: string;
  kilos: number;
  total: number;
}): Promise<string> {
  const rows = await getSheetData("Clientes!A1:Z5000");
  const headers = rows[0] ?? [];

  if (!headers.length) {
    return "";
  }

  const idxClienteId = findHeaderIndex(headers, ["ClienteID", "IDCliente"]);
  const idxTelefono = findHeaderIndex(headers, ["Telefono", "Teléfono"]);
  const idxNombre = findHeaderIndex(headers, ["Nombre"]);
  const idxEmail = findHeaderIndex(headers, ["Email", "Correo", "CorreoElectronico"]);
  const idxCompras = findHeaderIndex(headers, ["Compras"]);
  const idxKilos = findHeaderIndex(headers, ["KilosAcumulados", "Kilos"]);
  const idxTotal = findHeaderIndex(headers, ["TotalGastado", "Total"]);
  const idxUltimoPedido = findHeaderIndex(headers, ["UltimoPedido", "FechaUltimoPedido"]);
  const idxFechaAlta = findHeaderIndex(headers, ["FechaAlta", "Alta"]);

  if (idxTelefono < 0) {
    return "";
  }

  const normalizedPhone = normalizePhone(data.telefono);

  const rowIndex = rows.slice(1).findIndex((row) => normalizePhone(String(row[idxTelefono] ?? "")) === normalizedPhone);

  const nowIso = new Date().toISOString();

  if (rowIndex >= 0) {
    const sheetRowNumber = rowIndex + 2;
    const currentRow = rows[sheetRowNumber - 1] ?? [];
    const mutableRow = Array.from({ length: headers.length }, (_, idx) => currentRow[idx] ?? "");

    const existingCompras = idxCompras >= 0 ? toNumber(mutableRow[idxCompras]) : 0;
    const existingKilos = idxKilos >= 0 ? toNumber(mutableRow[idxKilos]) : 0;
    const existingTotal = idxTotal >= 0 ? toNumber(mutableRow[idxTotal]) : 0;

    if (idxTelefono >= 0) mutableRow[idxTelefono] = normalizedPhone;
    if (idxNombre >= 0) mutableRow[idxNombre] = data.nombre;
    if (idxEmail >= 0) mutableRow[idxEmail] = data.email;
    if (idxCompras >= 0) mutableRow[idxCompras] = existingCompras + 1;
    if (idxKilos >= 0) mutableRow[idxKilos] = Number((existingKilos + data.kilos).toFixed(2));
    if (idxTotal >= 0) mutableRow[idxTotal] = Number((existingTotal + data.total).toFixed(2));
    if (idxUltimoPedido >= 0) mutableRow[idxUltimoPedido] = nowIso;

    let clienteId = "";
    if (idxClienteId >= 0) {
      clienteId = String(mutableRow[idxClienteId] ?? "").trim();
      if (!clienteId) {
        clienteId = createId("CLI");
        mutableRow[idxClienteId] = clienteId;
      }
    }

    await updateRow("Clientes", sheetRowNumber, mutableRow);
    return clienteId;
  }

  const newRow = Array.from({ length: headers.length }, () => "");
  const newClienteId = idxClienteId >= 0 ? createId("CLI") : "";

  if (idxClienteId >= 0) newRow[idxClienteId] = newClienteId;
  if (idxTelefono >= 0) newRow[idxTelefono] = normalizedPhone;
  if (idxNombre >= 0) newRow[idxNombre] = data.nombre;
  if (idxEmail >= 0) newRow[idxEmail] = data.email;
  if (idxCompras >= 0) newRow[idxCompras] = 1;
  if (idxKilos >= 0) newRow[idxKilos] = Number(data.kilos.toFixed(2));
  if (idxTotal >= 0) newRow[idxTotal] = Number(data.total.toFixed(2));
  if (idxUltimoPedido >= 0) newRow[idxUltimoPedido] = nowIso;
  if (idxFechaAlta >= 0) newRow[idxFechaAlta] = nowIso;

  await appendRow(`Clientes!A2:${columnToLetter(headers.length)}5000`, newRow);
  return newClienteId;
}

async function upsertDireccion(data: {
  clienteId: string;
  telefono: string;
  cp: string;
  colonia: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
}): Promise<string> {
  const rows = await getSheetData("Direcciones!A1:Z5000");
  const headers = rows[0] ?? [];

  if (!headers.length) {
    return "";
  }

  const idxDireccionId = findHeaderIndex(headers, ["DireccionID", "IDDireccion"]);
  const idxClienteId = findHeaderIndex(headers, ["ClienteID", "IDCliente"]);
  const idxTelefono = findHeaderIndex(headers, ["Telefono", "Teléfono"]);
  const idxCp = findHeaderIndex(headers, ["CP", "CodigoPostal", "Codigo Postal"]);
  const idxColonia = findHeaderIndex(headers, ["Colonia"]);
  const idxCalle = findHeaderIndex(headers, ["Calle"]);
  const idxNumeroExterior = findHeaderIndex(headers, ["NumeroExterior", "Numero Ext", "NumeroExt"]);
  const idxNumeroInterior = findHeaderIndex(headers, ["NumeroInterior", "Numero Int", "NumeroInt"]);
  const idxActiva = findHeaderIndex(headers, ["Activa", "Activo"]);
  const idxFechaActualizacion = findHeaderIndex(headers, ["FechaActualizacion", "Actualizado"]);

  const matches = (row: string[]) => {
    const rowCp = String(row[idxCp] ?? "").trim();
    const rowColonia = String(row[idxColonia] ?? "").trim().toLowerCase();
    const rowCalle = String(row[idxCalle] ?? "").trim().toLowerCase();
    const rowNumExt = String(row[idxNumeroExterior] ?? "").trim().toLowerCase();
    const rowNumInt = String(row[idxNumeroInterior] ?? "").trim().toLowerCase();

    return (
      rowCp === data.cp &&
      rowColonia === data.colonia.trim().toLowerCase() &&
      rowCalle === data.calle.trim().toLowerCase() &&
      rowNumExt === data.numeroExterior.trim().toLowerCase() &&
      rowNumInt === data.numeroInterior.trim().toLowerCase()
    );
  };

  const rowIndex = rows.slice(1).findIndex(matches);

  const nowIso = new Date().toISOString();

  if (rowIndex >= 0) {
    const sheetRowNumber = rowIndex + 2;
    const currentRow = rows[sheetRowNumber - 1] ?? [];
    const mutableRow = Array.from({ length: headers.length }, (_, idx) => currentRow[idx] ?? "");

    if (idxClienteId >= 0) mutableRow[idxClienteId] = data.clienteId;
    if (idxTelefono >= 0) mutableRow[idxTelefono] = normalizePhone(data.telefono);
    if (idxActiva >= 0) mutableRow[idxActiva] = true;
    if (idxFechaActualizacion >= 0) mutableRow[idxFechaActualizacion] = nowIso;

    let direccionId = "";
    if (idxDireccionId >= 0) {
      direccionId = String(mutableRow[idxDireccionId] ?? "").trim();
      if (!direccionId) {
        direccionId = createId("DIR");
        mutableRow[idxDireccionId] = direccionId;
      }
    }

    await updateRow("Direcciones", sheetRowNumber, mutableRow);
    return direccionId;
  }

  const newRow = Array.from({ length: headers.length }, () => "");
  const direccionId = idxDireccionId >= 0 ? createId("DIR") : "";

  if (idxDireccionId >= 0) newRow[idxDireccionId] = direccionId;
  if (idxClienteId >= 0) newRow[idxClienteId] = data.clienteId;
  if (idxTelefono >= 0) newRow[idxTelefono] = normalizePhone(data.telefono);
  if (idxCp >= 0) newRow[idxCp] = data.cp;
  if (idxColonia >= 0) newRow[idxColonia] = data.colonia;
  if (idxCalle >= 0) newRow[idxCalle] = data.calle;
  if (idxNumeroExterior >= 0) newRow[idxNumeroExterior] = data.numeroExterior;
  if (idxNumeroInterior >= 0) newRow[idxNumeroInterior] = data.numeroInterior;
  if (idxActiva >= 0) newRow[idxActiva] = true;
  if (idxFechaActualizacion >= 0) newRow[idxFechaActualizacion] = nowIso;

  await appendRow(`Direcciones!A2:${columnToLetter(headers.length)}5000`, newRow);
  return direccionId;
}

async function appendPedidoByHeaders(payload: {
  sessionId: string;
  createdAt: string;
  telefono: string;
  kilos: number;
  verde: number;
  roja: number;
  chilePasado: number;
  cp: string;
  envio: number;
  total: number;
  fechaEntrega: string;
  ventana: string;
  clienteId: string;
  direccionId: string;
  nombre: string;
  email: string;
  direccion: string;
  colonia: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
}) {
  const rows = await getSheetData("Pedidos!A1:AZ1");
  const headers = rows[0] ?? [];

  if (!headers.length) {
    await appendRow("Pedidos!A2:L1000", [
      payload.sessionId,
      payload.createdAt,
      payload.telefono,
      payload.kilos,
      payload.verde,
      payload.roja,
      payload.chilePasado,
      payload.cp,
      payload.envio,
      payload.total,
      payload.fechaEntrega,
      payload.ventana,
    ]);
    return;
  }

  const row = Array.from({ length: headers.length }, () => "");

  const assign = (candidates: string[], value: string | number | boolean) => {
    const idx = findHeaderIndex(headers, candidates);
    if (idx >= 0) {
      row[idx] = value;
    }
  };

  assign(["ID", "PedidoID"], payload.sessionId);
  assign(["Fecha", "FechaPedido"], payload.createdAt);
  assign(["Telefono", "Teléfono"], payload.telefono);
  assign(["Kilos"], payload.kilos);
  assign(["Verde"], payload.verde);
  assign(["Roja"], payload.roja);
  assign(["ChilePasado", "Chile Pasado"], payload.chilePasado);
  assign(["CP", "CodigoPostal", "Codigo Postal"], payload.cp);
  assign(["Envio", "Envío"], payload.envio);
  assign(["Total"], payload.total);
  assign(["FechaEntrega", "Fecha Entrega"], payload.fechaEntrega);
  assign(["Ventana"], payload.ventana);
  assign(["ClienteID", "IDCliente"], payload.clienteId);
  assign(["DireccionID", "IDDireccion"], payload.direccionId);
  assign(["Nombre"], payload.nombre);
  assign(["Email", "Correo"], payload.email);
  assign(["Direccion", "Dirección"], payload.direccion);
  assign(["Colonia"], payload.colonia);
  assign(["Calle"], payload.calle);
  assign(["NumeroExterior", "Numero Ext", "NumeroExt"], payload.numeroExterior);
  assign(["NumeroInterior", "Numero Int", "NumeroInt"], payload.numeroInterior);

  await appendRow(`Pedidos!A2:${columnToLetter(headers.length)}5000`, row);
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata ?? {};

      const kilos = Number(metadata.kilos ?? 0);
      const verde = Number(metadata.verde ?? 0);
      const roja = Number(metadata.roja ?? 0);
      const chilePasado = Number(metadata.chilePasado ?? 0);
      const envio = Number(metadata.envio ?? 0);
      const total = session.amount_total ? session.amount_total / 100 : 0;

      const cp = String(metadata.cp ?? "").replace(/\D/g, "").slice(0, 5);
      const nombre = String(metadata.nombre ?? "").trim();
      const email = String(metadata.email ?? "").trim().toLowerCase();
      const telefono = normalizePhone(String(metadata.telefono ?? ""));
      const direccion = String(metadata.direccion ?? "").trim();
      const calle = String(metadata.calle ?? "").trim();
      const colonia = String(metadata.colonia ?? "").trim();
      const numeroExterior = String(metadata.numeroExterior ?? "").trim();
      const numeroInterior = String(metadata.numeroInterior ?? "").trim();
      const fechaEntrega = String(metadata.fecha ?? "").trim();
      const ventana = String(metadata.ventana ?? "SIN_VENTANA").trim();

      const clienteId = await upsertCliente({
        telefono,
        nombre,
        email,
        kilos,
        total,
      });

      const direccionId = await upsertDireccion({
        clienteId,
        telefono,
        cp,
        colonia,
        calle,
        numeroExterior,
        numeroInterior,
      });

      await appendPedidoByHeaders({
        sessionId: session.id,
        createdAt: new Date().toISOString(),
        telefono,
        kilos,
        verde,
        roja,
        chilePasado,
        cp,
        envio,
        total,
        fechaEntrega,
        ventana,
        clienteId,
        direccionId,
        nombre,
        email,
        direccion,
        colonia,
        calle,
        numeroExterior,
        numeroInterior,
      });

      const inventario = await getSheetData("Inventario!A2:C20");

      const updatedRows = inventario.map((row) => {
        const [producto, presentacion, stockRaw] = row;
        let stock = Number(stockRaw);

        if (producto === "Barbacoa" && presentacion === "1kg") {
          const usar1kg = Math.min(Math.floor(kilos), stock);
          stock -= usar1kg;
        }

        if (producto === "Barbacoa" && presentacion === "0.5kg") {
          const restante = kilos - Math.floor(kilos);
          if (restante > 0) {
            const usar05 = restante / 0.5;
            stock -= usar05;
          }
        }

        if (producto === "Salsa Verde") {
          stock -= verde;
        }

        if (producto === "Salsa Roja") {
          stock -= roja;
        }

        if (producto === "Salsa de Chile Pasado") {
          stock -= chilePasado;
        }

        return [producto, presentacion, stock];
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: "Inventario!A2:C20",
        valueInputOption: "RAW",
        requestBody: {
          values: updatedRows,
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Webhook error";
    console.error("Webhook error:", message);

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
