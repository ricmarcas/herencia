export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { appendRow, getSheetData } from "@/lib/sheets";

const REGISTROS_READ_RANGE = "MuestrasRegistros!A2:S5000";
const REGISTROS_APPEND_RANGE = "MuestrasRegistros!A:S";
const INTENTOS_APPEND_RANGE = "MuestrasIntentos!A:V";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const notificationEmail = process.env.SAMPLE_ORDERS_TO_EMAIL ?? process.env.SPECIAL_ORDERS_TO_EMAIL;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

type SamplePayload = {
  nombre: string;
  email: string;
  telefono: string;
  cp: string;
  colonia: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  fuente: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  gclid: string;
  landingPath: string;
  referrer: string;
};

type AttemptLogInput = {
  email: string;
  nombre: string;
  telefono: string;
  cp: string;
  colonia: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  fuente: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  gclid: string;
  landingPath: string;
  referrer: string;
  resultado: "REGISTERED" | "DUPLICATE" | "ERROR";
  motivo: string;
  ip: string;
  userAgent: string;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

function isValidMxPhone(value: string): boolean {
  return /^[2-9]\d{9}$/.test(value);
}

function normalizeCp(value: string): string {
  return value.replace(/\D/g, "").slice(0, 5);
}

function getNowIso(): string {
  return new Date().toISOString();
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (!forwardedFor) {
    return "unknown";
  }

  return forwardedFor.split(",")[0]?.trim() ?? "unknown";
}

async function logAttempt(input: AttemptLogInput) {
  await appendRow(INTENTOS_APPEND_RANGE, [
    getNowIso(),
    input.email,
    input.nombre,
    input.telefono,
    input.cp,
    input.colonia,
    input.calle,
    input.numeroExterior,
    input.numeroInterior,
    input.fuente,
    input.utmSource,
    input.utmMedium,
    input.utmCampaign,
    input.utmContent,
    input.utmTerm,
    input.gclid,
    input.landingPath,
    input.referrer,
    input.resultado,
    input.motivo,
    input.ip,
    input.userAgent,
  ]);
}

async function safeLogAttempt(input: AttemptLogInput) {
  try {
    await logAttempt(input);
  } catch (logError) {
    console.error("No se pudo registrar intento de muestra:", logError);
  }
}

function parseBody(raw: unknown): SamplePayload {
  if (!raw || typeof raw !== "object") {
    return {
      nombre: "",
      email: "",
      telefono: "",
      cp: "",
      colonia: "",
      calle: "",
      numeroExterior: "",
      numeroInterior: "",
      fuente: "landing-muestras",
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
      utmContent: "",
      utmTerm: "",
      gclid: "",
      landingPath: "/muestras",
      referrer: "",
    };
  }

  const body = raw as Record<string, unknown>;
  return {
    nombre: String(body.nombre ?? "").trim(),
    email: String(body.email ?? "").trim().toLowerCase(),
    telefono: normalizePhone(String(body.telefono ?? "")),
    cp: normalizeCp(String(body.cp ?? "")),
    colonia: String(body.colonia ?? "").trim(),
    calle: String(body.calle ?? "").trim(),
    numeroExterior: String(body.numeroExterior ?? "").trim(),
    numeroInterior: String(body.numeroInterior ?? "").trim(),
    fuente: String(body.fuente ?? "landing-muestras").trim() || "landing-muestras",
    utmSource: String(body.utmSource ?? "").trim(),
    utmMedium: String(body.utmMedium ?? "").trim(),
    utmCampaign: String(body.utmCampaign ?? "").trim(),
    utmContent: String(body.utmContent ?? "").trim(),
    utmTerm: String(body.utmTerm ?? "").trim(),
    gclid: String(body.gclid ?? "").trim(),
    landingPath: String(body.landingPath ?? "/muestras").trim() || "/muestras",
    referrer: String(body.referrer ?? "").trim(),
  };
}

function toAttemptInput(payload: SamplePayload, extra: Pick<AttemptLogInput, "resultado" | "motivo" | "ip" | "userAgent">): AttemptLogInput {
  return {
    email: payload.email,
    nombre: payload.nombre,
    telefono: payload.telefono,
    cp: payload.cp,
    colonia: payload.colonia,
    calle: payload.calle,
    numeroExterior: payload.numeroExterior,
    numeroInterior: payload.numeroInterior,
    fuente: payload.fuente,
    utmSource: payload.utmSource,
    utmMedium: payload.utmMedium,
    utmCampaign: payload.utmCampaign,
    utmContent: payload.utmContent,
    utmTerm: payload.utmTerm,
    gclid: payload.gclid,
    landingPath: payload.landingPath,
    referrer: payload.referrer,
    ...extra,
  };
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const payload = parseBody(await req.json());

    if (
      !payload.nombre ||
      !isValidEmail(payload.email) ||
      !isValidMxPhone(payload.telefono) ||
      payload.cp.length !== 5 ||
      !payload.colonia ||
      !payload.calle ||
      !payload.numeroExterior
    ) {
      await safeLogAttempt(
        toAttemptInput(payload, {
          resultado: "ERROR",
          motivo: "INVALID_DATA",
          ip,
          userAgent,
        })
      );

      return NextResponse.json(
        {
          success: false,
          alreadyRegistered: false,
          message: "Completa nombre, email, telefono celular valido, CP, colonia, calle y numero exterior.",
        },
        { status: 400 }
      );
    }

    const rows = await getSheetData(REGISTROS_READ_RANGE);
    const alreadyRegistered = rows.some((row) => String(row[1] ?? "").trim().toLowerCase() === payload.email);

    if (alreadyRegistered) {
      await safeLogAttempt(
        toAttemptInput(payload, {
          resultado: "DUPLICATE",
          motivo: "EMAIL_ALREADY_REGISTERED",
          ip,
          userAgent,
        })
      );

      return NextResponse.json({
        success: true,
        alreadyRegistered: true,
        message: "Gracias. Ya tenemos tu registro y enviaremos una muestra por persona.",
      });
    }

    await appendRow(REGISTROS_APPEND_RANGE, [
      getNowIso(),
      payload.email,
      payload.nombre,
      payload.telefono,
      payload.cp,
      payload.colonia,
      payload.calle,
      payload.numeroExterior,
      payload.numeroInterior,
      payload.fuente,
      payload.utmSource,
      payload.utmMedium,
      payload.utmCampaign,
      payload.utmContent,
      payload.utmTerm,
      payload.gclid,
      payload.landingPath,
      payload.referrer,
      "solicitud",
    ]);

    await safeLogAttempt(
      toAttemptInput(payload, {
        resultado: "REGISTERED",
        motivo: "NEW_SAMPLE_REQUEST",
        ip,
        userAgent,
      })
    );

    if (resend && notificationEmail) {
      const subject = `Nueva solicitud de muestra - ${payload.email}`;
      const html = `
        <h2>Nueva solicitud de muestra</h2>
        <p><strong>Fecha:</strong> ${getNowIso()}</p>
        <p><strong>Nombre:</strong> ${payload.nombre}</p>
        <p><strong>Email:</strong> ${payload.email}</p>
        <p><strong>Telefono:</strong> ${payload.telefono}</p>
        <p><strong>CP:</strong> ${payload.cp}</p>
        <p><strong>Colonia:</strong> ${payload.colonia}</p>
        <p><strong>Calle:</strong> ${payload.calle}</p>
        <p><strong>Numero exterior:</strong> ${payload.numeroExterior}</p>
        <p><strong>Numero interior:</strong> ${payload.numeroInterior || "N/A"}</p>
        <p><strong>Fuente:</strong> ${payload.fuente}</p>
        <p><strong>UTM Source:</strong> ${payload.utmSource || "N/A"}</p>
        <p><strong>UTM Medium:</strong> ${payload.utmMedium || "N/A"}</p>
        <p><strong>UTM Campaign:</strong> ${payload.utmCampaign || "N/A"}</p>
        <p><strong>UTM Content:</strong> ${payload.utmContent || "N/A"}</p>
        <p><strong>UTM Term:</strong> ${payload.utmTerm || "N/A"}</p>
        <p><strong>gclid:</strong> ${payload.gclid || "N/A"}</p>
        <p><strong>Landing Path:</strong> ${payload.landingPath || "/muestras"}</p>
        <p><strong>Referrer:</strong> ${payload.referrer || "N/A"}</p>
      `;

      try {
        await resend.emails.send({
          from: resendFromEmail,
          to: [notificationEmail],
          replyTo: payload.email,
          subject,
          html,
        });
      } catch (emailError) {
        console.error("Error enviando notificacion de muestra:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      alreadyRegistered: false,
      message: "Gracias por registrarte. Te contactaremos para el envio de tu muestra.",
    });
  } catch (error: unknown) {
    console.error("Error procesando solicitud de muestra:", error);

    return NextResponse.json(
      {
        success: false,
        alreadyRegistered: false,
        message: error instanceof Error ? error.message : "No fue posible registrar tu solicitud en este momento.",
      },
      { status: 500 }
    );
  }
}
