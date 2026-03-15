export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { google } from "googleapis";
import { Resend } from "resend";
import { appendRow, getSheetData } from "@/lib/sheets";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
const resendApiKey = process.env.RESEND_API_KEY;
const orderNotificationEmail = process.env.ORDER_NOTIFICATIONS_TO_EMAIL ?? process.env.SPECIAL_ORDERS_TO_EMAIL;
const resendFromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const resend = resendApiKey ? new Resend(resendApiKey) : null;

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

function toNumber(value: string | number | boolean | undefined): number {
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
    const mutableRow: Array<string | number | boolean> = Array.from(
      { length: headers.length },
      (_, idx) => currentRow[idx] ?? ""
    );

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

  const newRow: Array<string | number | boolean> = Array.from({ length: headers.length }, () => "");
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
    const mutableRow: Array<string | number | boolean> = Array.from(
      { length: headers.length },
      (_, idx) => currentRow[idx] ?? ""
    );

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

  const newRow: Array<string | number | boolean> = Array.from({ length: headers.length }, () => "");
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
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  gclid: string;
  landingPath: string;
  referrer: string;
  attributionModel: string;
}) {
  const rows = await getSheetData("Pedidos!A1:AZ1");
  const headers = rows[0] ?? [];

  if (!headers.length) {
    await appendRow("Pedidos!A2:W5000", [
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
      payload.clienteId,
      payload.direccionId,
      payload.utmSource,
      payload.utmMedium,
      payload.utmCampaign,
      payload.utmContent,
      payload.utmTerm,
      payload.gclid,
      payload.landingPath,
      payload.referrer,
      payload.attributionModel,
    ]);
    return;
  }

  const row: Array<string | number | boolean> = Array.from({ length: headers.length }, () => "");

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
  assign(["UTMSource", "utm_source"], payload.utmSource);
  assign(["UTMMedium", "utm_medium"], payload.utmMedium);
  assign(["UTMCampaign", "utm_campaign"], payload.utmCampaign);
  assign(["UTMContent", "utm_content"], payload.utmContent);
  assign(["UTMTerm", "utm_term"], payload.utmTerm);
  assign(["GCLID", "gclid"], payload.gclid);
  assign(["LandingPath", "landing_path"], payload.landingPath);
  assign(["Referrer", "referer"], payload.referrer);
  assign(["AttributionModel", "attribution_model"], payload.attributionModel);

  await appendRow(`Pedidos!A2:${columnToLetter(headers.length)}5000`, row);
}

async function isSessionAlreadyProcessed(sessionId: string): Promise<boolean> {
  const rows = await getSheetData("Pedidos!A1:AZ5000");
  const headers = rows[0] ?? [];
  const data = rows.slice(1);
  if (!headers.length) return false;

  const idxId = findHeaderIndex(headers, ["ID", "PedidoID"]);
  if (idxId < 0) return false;

  return data.some((row) => String(row[idxId] ?? "").trim() === sessionId);
}

async function sendPaidOrderNotification(payload: {
  qaMode: boolean;
  sessionId: string;
  nombre: string;
  email: string;
  telefono: string;
  cp: string;
  calle: string;
  colonia: string;
  numeroExterior: string;
  numeroInterior: string;
  kilos: number;
  verde: number;
  roja: number;
  chilePasado: number;
  envio: number;
  total: number;
  fechaEntrega: string;
}) {
  if (!resend || !orderNotificationEmail) {
    return;
  }

  const interiorText = payload.numeroInterior ? ` Int ${payload.numeroInterior}` : "";
  const direccion = `${payload.calle} ${payload.numeroExterior}${interiorText}, Col. ${payload.colonia}, CP ${payload.cp}`;
  const qaLabel = payload.qaMode ? " (ORDEN QA)" : "";
  const subject = `Nuevo pedido pagado${qaLabel} - ${payload.nombre || payload.telefono}`;

  const html = `
    <h2>Nuevo pedido pagado${qaLabel}</h2>
    <p><strong>ID Stripe:</strong> ${payload.sessionId}</p>
    <p><strong>Nombre:</strong> ${payload.nombre || "No especificado"}</p>
    <p><strong>Email:</strong> ${payload.email || "No especificado"}</p>
    <p><strong>Telefono:</strong> ${payload.telefono}</p>
    <p><strong>Direccion:</strong> ${direccion}</p>
    <hr />
    <p><strong>Barbacoa:</strong> ${payload.kilos} kg</p>
    <p><strong>Salsa Verde:</strong> ${payload.verde}</p>
    <p><strong>Salsa Roja:</strong> ${payload.roja}</p>
    <p><strong>Salsa Chile Pasado:</strong> ${payload.chilePasado}</p>
    <p><strong>Envio:</strong> $${payload.envio} MXN</p>
    <p><strong>Total pagado:</strong> $${payload.total} MXN</p>
    <p><strong>Fecha entrega:</strong> ${payload.fechaEntrega || "Sin fecha"}</p>
  `;

  await resend.emails.send({
    from: resendFromEmail,
    to: [orderNotificationEmail],
    subject,
    html,
    replyTo: payload.email || undefined,
  });
}

async function markSampleLeadAsCliente(emailRaw: string, clienteId: string): Promise<void> {
  const email = String(emailRaw).trim().toLowerCase();
  if (!email) return;

  const rows = await getSheetData("MuestrasRegistros!A1:AZ5000");
  const headers = rows[0] ?? [];
  const data = rows.slice(1);
  if (!headers.length) return;

  const idxEmail = findHeaderIndex(headers, ["Email"]);
  const idxEstatus = findHeaderIndex(headers, ["Estatus", "Estado"]);
  const idxComentario = findHeaderIndex(headers, ["Comentario"]);
  const idxUltimoEmail = findHeaderIndex(headers, ["UltimoEmail"]);

  if (idxEmail < 0 || idxEstatus < 0) return;

  const rowIndex = data.findIndex((row) => String(row[idxEmail] ?? "").trim().toLowerCase() === email);
  if (rowIndex < 0) return;

  const sheetRowNumber = rowIndex + 2;
  const currentRow = rows[sheetRowNumber - 1] ?? [];
  const mutableRow: Array<string | number | boolean> = Array.from(
    { length: headers.length },
    (_, idx) => currentRow[idx] ?? ""
  );

  mutableRow[idxEstatus] = "cliente";
  if (idxUltimoEmail >= 0) {
    mutableRow[idxUltimoEmail] = new Date().toISOString();
  }
  if (idxComentario >= 0) {
    const previous = String(mutableRow[idxComentario] ?? "").trim();
    const note = `Convertido a cliente (${clienteId || "sin_id"})`;
    mutableRow[idxComentario] = previous ? `${previous} | ${note}` : note;
  }

  await updateRow("MuestrasRegistros", sheetRowNumber, mutableRow);
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
      const alreadyProcessed = await isSessionAlreadyProcessed(session.id);
      if (alreadyProcessed) {
        return NextResponse.json({ received: true, deduplicated: true });
      }

      const metadata = session.metadata ?? {};
      const qaMode = String(metadata.qaMode ?? "FALSE").toUpperCase() === "TRUE";

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
      const calle = String(metadata.calle ?? "").trim();
      const colonia = String(metadata.colonia ?? "").trim();
      const numeroExterior = String(metadata.numeroExterior ?? "").trim();
      const numeroInterior = String(metadata.numeroInterior ?? "").trim();
      const fechaEntrega = String(metadata.fecha ?? "").trim();
      const ventana = String(metadata.ventana ?? "SIN_VENTANA").trim();
      const utmSource = String(metadata.utmSource ?? "").trim();
      const utmMedium = String(metadata.utmMedium ?? "").trim();
      const utmCampaign = String(metadata.utmCampaign ?? "").trim();
      const utmContent = String(metadata.utmContent ?? "").trim();
      const utmTerm = String(metadata.utmTerm ?? "").trim();
      const gclid = String(metadata.gclid ?? "").trim();
      const landingPath = String(metadata.landingPath ?? "").trim();
      const referrer = String(metadata.referrer ?? "").trim();
      const attributionModel = String(metadata.attributionModel ?? "last_touch").trim();

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
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        gclid,
        landingPath,
        referrer,
        attributionModel,
      });

      try {
        await markSampleLeadAsCliente(email, clienteId);
      } catch (crmError) {
        console.error("No se pudo actualizar estatus de muestra a cliente:", crmError);
      }

      try {
        await sendPaidOrderNotification({
          qaMode,
          sessionId: session.id,
          nombre,
          email,
          telefono,
          cp,
          calle,
          colonia,
          numeroExterior,
          numeroInterior,
          kilos,
          verde,
          roja,
          chilePasado,
          envio,
          total,
          fechaEntrega,
        });
      } catch (notifyError) {
        console.error("No se pudo enviar notificacion de pedido pagado:", notifyError);
      }

      if (!qaMode) {
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
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Webhook error";
    console.error("Webhook error:", message);

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
