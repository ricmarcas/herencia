export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getSheetData } from "@/lib/sheets";

const PEDIDOS_RANGE = "Pedidos!A1:AZ5000";
const CLIENTES_RANGE = "Clientes!A1:Z5000";
const DIRECCIONES_RANGE = "Direcciones!A1:Z5000";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

type AdminPedidoRow = {
  rowNumber: number;
  id: string;
  fecha: string;
  telefono: string;
  kilos: number;
  verde: number;
  roja: number;
  chilePasado: number;
  cp: string;
  total: number;
  fechaEntregaCliente: string;
  horarioEntrega: string;
  clienteId: string;
  direccionId: string;
  nombre: string;
  email: string;
  calle: string;
  colonia: string;
  numeroExterior: string;
  numeroInterior: string;
  estatus: string;
  fechaEntregaReal: string;
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
  return String(value ?? "").trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return String(value ?? "").replace(/\D/g, "").slice(0, 10);
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAdminPassword(): string {
  return process.env.ADMIN_MUESTRAS_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
}

function isAuthorized(req: Request): boolean {
  const expectedPassword = getAdminPassword();
  const providedPassword = req.headers.get("x-admin-password") ?? "";
  return Boolean(expectedPassword) && providedPassword === expectedPassword;
}

function resolvePedidoStatus(
  estatusRaw: string,
  fechaEntregaRealRaw: string,
  horarioRaw: string
): "solicitud" | "programada" | "entregada" {
  const estatus = normalizeStatus(estatusRaw);
  if (estatus === "entregada") return "entregada";
  if (estatus === "programada") return "programada";
  if (estatus === "solicitud" || estatus === "pendiente") return "solicitud";

  if (String(fechaEntregaRealRaw ?? "").trim()) {
    return "entregada";
  }

  const horario = String(horarioRaw ?? "").trim();
  if (horario.toUpperCase().includes("ENTREGADA")) {
    return "entregada";
  }
  if (horario.length > 0) {
    return "programada";
  }

  return "solicitud";
}

function statusMatchesPedido(current: string, requested: string): boolean {
  const target = normalizeStatus(requested);
  if (target === "solicitud" || target === "programada" || target === "entregada") {
    return normalizeStatus(current) === target;
  }
  return true;
}

async function updateRow(sheetRowNumber: number, values: Array<string | number | boolean>) {
  const lastCol = columnToLetter(values.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Pedidos!A${sheetRowNumber}:${lastCol}${sheetRowNumber}`,
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

    const [pedidosRows, clientesRows, direccionesRows] = await Promise.all([
      getSheetData(PEDIDOS_RANGE),
      getSheetData(CLIENTES_RANGE),
      getSheetData(DIRECCIONES_RANGE),
    ]);

    const pedidosHeaders = pedidosRows[0] ?? [];
    const pedidosData = pedidosRows.slice(1);
    const clientesHeaders = clientesRows[0] ?? [];
    const clientesData = clientesRows.slice(1);
    const direccionesHeaders = direccionesRows[0] ?? [];
    const direccionesData = direccionesRows.slice(1);

    const idxPedidoId = findHeaderIndex(pedidosHeaders, ["ID", "PedidoID"]);
    const idxFecha = findHeaderIndex(pedidosHeaders, ["Fecha", "FechaPedido"]);
    const idxTelefono = findHeaderIndex(pedidosHeaders, ["Telefono", "Teléfono"]);
    const idxKilos = findHeaderIndex(pedidosHeaders, ["Kilos"]);
    const idxVerde = findHeaderIndex(pedidosHeaders, ["Verde"]);
    const idxRoja = findHeaderIndex(pedidosHeaders, ["Roja"]);
    const idxChilePasado = findHeaderIndex(pedidosHeaders, ["ChilePasado", "Chile Pasado"]);
    const idxCp = findHeaderIndex(pedidosHeaders, ["CP", "CodigoPostal", "Codigo Postal"]);
    const idxTotal = findHeaderIndex(pedidosHeaders, ["Total"]);
    const idxFechaEntregaCliente = findHeaderIndex(pedidosHeaders, ["FechaEntrega", "Fecha Entrega"]);
    const idxHorario = findHeaderIndex(pedidosHeaders, ["Ventana", "HorarioEntrega", "Horario"]);
    const idxClienteId = findHeaderIndex(pedidosHeaders, ["ClienteID", "IDCliente"]);
    const idxDireccionId = findHeaderIndex(pedidosHeaders, ["DireccionID", "IDDireccion"]);
    const idxEstatus = findHeaderIndex(pedidosHeaders, ["Estatus", "Estado", "EstatusPedido"]);
    const idxFechaEntregaReal = findHeaderIndex(pedidosHeaders, ["FechaEntregaReal", "EntregadoEl"]);

    const idxCliId = findHeaderIndex(clientesHeaders, ["ClienteID", "IDCliente"]);
    const idxCliNombre = findHeaderIndex(clientesHeaders, ["Nombre"]);
    const idxCliEmail = findHeaderIndex(clientesHeaders, ["Email", "Correo", "CorreoElectronico"]);

    const idxDirId = findHeaderIndex(direccionesHeaders, ["DireccionID", "IDDireccion"]);
    const idxDirCalle = findHeaderIndex(direccionesHeaders, ["Calle"]);
    const idxDirColonia = findHeaderIndex(direccionesHeaders, ["Colonia"]);
    const idxDirNumExt = findHeaderIndex(direccionesHeaders, ["NumeroExterior", "Numero Ext", "NumeroExt"]);
    const idxDirNumInt = findHeaderIndex(direccionesHeaders, ["NumeroInterior", "Numero Int", "NumeroInt"]);

    const rows: AdminPedidoRow[] = pedidosData
      .map((row, index) => {
        const clienteId = String(idxClienteId >= 0 ? row[idxClienteId] ?? "" : "").trim();
        const direccionId = String(idxDireccionId >= 0 ? row[idxDireccionId] ?? "" : "").trim();

        const cliente = idxCliId >= 0
          ? clientesData.find((item) => String(item[idxCliId] ?? "").trim() === clienteId)
          : undefined;
        const direccion = idxDirId >= 0
          ? direccionesData.find((item) => String(item[idxDirId] ?? "").trim() === direccionId)
          : undefined;

        const horario = String(idxHorario >= 0 ? row[idxHorario] ?? "" : "").trim();
        const fechaEntregaReal = String(idxFechaEntregaReal >= 0 ? row[idxFechaEntregaReal] ?? "" : "").trim();
        const estatusResolved = resolvePedidoStatus(
          String(idxEstatus >= 0 ? row[idxEstatus] ?? "" : ""),
          fechaEntregaReal,
          horario
        );

        return {
          rowNumber: index + 2,
          id: String(idxPedidoId >= 0 ? row[idxPedidoId] ?? "" : "").trim(),
          fecha: String(idxFecha >= 0 ? row[idxFecha] ?? "" : "").trim(),
          telefono: normalizePhone(String(idxTelefono >= 0 ? row[idxTelefono] ?? "" : "")),
          kilos: toNumber(String(idxKilos >= 0 ? row[idxKilos] ?? "0" : "0")),
          verde: toNumber(String(idxVerde >= 0 ? row[idxVerde] ?? "0" : "0")),
          roja: toNumber(String(idxRoja >= 0 ? row[idxRoja] ?? "0" : "0")),
          chilePasado: toNumber(String(idxChilePasado >= 0 ? row[idxChilePasado] ?? "0" : "0")),
          cp: String(idxCp >= 0 ? row[idxCp] ?? "" : "").trim(),
          total: toNumber(String(idxTotal >= 0 ? row[idxTotal] ?? "0" : "0")),
          fechaEntregaCliente: String(idxFechaEntregaCliente >= 0 ? row[idxFechaEntregaCliente] ?? "" : "").trim(),
          horarioEntrega: horario,
          clienteId,
          direccionId,
          nombre: String(idxCliNombre >= 0 ? cliente?.[idxCliNombre] ?? "" : "").trim(),
          email: String(idxCliEmail >= 0 ? cliente?.[idxCliEmail] ?? "" : "").trim(),
          calle: String(idxDirCalle >= 0 ? direccion?.[idxDirCalle] ?? "" : "").trim(),
          colonia: String(idxDirColonia >= 0 ? direccion?.[idxDirColonia] ?? "" : "").trim(),
          numeroExterior: String(idxDirNumExt >= 0 ? direccion?.[idxDirNumExt] ?? "" : "").trim(),
          numeroInterior: String(idxDirNumInt >= 0 ? direccion?.[idxDirNumInt] ?? "" : "").trim(),
          estatus: estatusResolved,
          fechaEntregaReal,
        };
      })
      .filter((item) => statusMatchesPedido(item.estatus, estatus));

    return NextResponse.json({ success: true, rows });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error cargando pedidos",
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
      horarioEntrega?: string;
    };

    const action = String(body.action ?? "").trim();
    const rowNumber = Number(body.rowNumber ?? 0);
    const horarioEntrega = String(body.horarioEntrega ?? "").trim();

    if (!rowNumber || rowNumber < 2) {
      return NextResponse.json({ success: false, message: "rowNumber invalido" }, { status: 400 });
    }

    const rows = await getSheetData(PEDIDOS_RANGE);
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

    const idxHorario = findHeaderIndex(headers, ["Ventana", "HorarioEntrega", "Horario"]);
    const idxEstatus = findHeaderIndex(headers, ["Estatus", "Estado", "EstatusPedido"]);
    const idxFechaEntregaReal = findHeaderIndex(headers, ["FechaEntregaReal", "EntregadoEl"]);

    if (action === "programar") {
      if (idxHorario < 0) {
        return NextResponse.json({ success: false, message: "Columna de horario no encontrada (Ventana/Horario)" }, { status: 400 });
      }
      if (!horarioEntrega) {
        return NextResponse.json({ success: false, message: "Horario requerido" }, { status: 400 });
      }

      rowValues[idxHorario] = horarioEntrega;
      if (idxEstatus >= 0) rowValues[idxEstatus] = "programada";
      await updateRow(rowNumber, rowValues);
      return NextResponse.json({ success: true });
    }

    if (action === "entregar") {
      if (idxFechaEntregaReal >= 0) {
        rowValues[idxFechaEntregaReal] = new Date().toISOString();
      } else if (idxHorario >= 0) {
        const current = String(rowValues[idxHorario] ?? "").trim();
        rowValues[idxHorario] = current ? `${current} | ENTREGADA` : "ENTREGADA";
      }

      if (idxEstatus >= 0) rowValues[idxEstatus] = "entregada";
      await updateRow(rowNumber, rowValues);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: "Accion no soportada" }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error actualizando pedido",
      },
      { status: 500 }
    );
  }
}
