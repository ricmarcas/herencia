export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { appendRow, getSheetData } from "@/lib/sheets";

const REGISTROS_RANGE = "MuestrasRegistros!A2:G5000";
const INTENTOS_RANGE = "MuestrasIntentos!A2:I5000";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const notificationEmail = process.env.SAMPLE_ORDERS_TO_EMAIL ?? process.env.SPECIAL_ORDERS_TO_EMAIL;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

type SamplePayload = {
  nombre: string;
  email: string;
  telefono: string;
  cp: string;
  fuente?: string;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
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

async function logAttempt(input: {
  email: string;
  nombre: string;
  telefono: string;
  cp: string;
  resultado: "REGISTERED" | "DUPLICATE" | "ERROR";
  motivo: string;
  ip: string;
  userAgent: string;
}) {
  await appendRow(INTENTOS_RANGE, [
    getNowIso(),
    input.email,
    input.nombre,
    input.telefono,
    input.cp,
    input.resultado,
    input.motivo,
    input.ip,
    input.userAgent,
  ]);
}

function parseBody(raw: unknown): SamplePayload {
  if (!raw || typeof raw !== "object") {
    return { nombre: "", email: "", telefono: "", cp: "", fuente: "" };
  }

  const body = raw as Record<string, unknown>;
  return {
    nombre: String(body.nombre ?? "").trim(),
    email: String(body.email ?? "").trim().toLowerCase(),
    telefono: normalizePhone(String(body.telefono ?? "")),
    cp: normalizeCp(String(body.cp ?? "")),
    fuente: String(body.fuente ?? "landing-muestras").trim(),
  };
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const payload = parseBody(await req.json());

    if (!payload.nombre || !isValidEmail(payload.email) || payload.telefono.length !== 10 || payload.cp.length !== 5) {
      await logAttempt({
        email: payload.email,
        nombre: payload.nombre,
        telefono: payload.telefono,
        cp: payload.cp,
        resultado: "ERROR",
        motivo: "INVALID_DATA",
        ip,
        userAgent,
      });

      return NextResponse.json(
        {
          success: false,
          alreadyRegistered: false,
          message: "Datos incompletos o invalidos.",
        },
        { status: 400 }
      );
    }

    const rows = await getSheetData(REGISTROS_RANGE);
    const alreadyRegistered = rows.some((row) => String(row[1] ?? "").trim().toLowerCase() === payload.email);

    if (alreadyRegistered) {
      await logAttempt({
        email: payload.email,
        nombre: payload.nombre,
        telefono: payload.telefono,
        cp: payload.cp,
        resultado: "DUPLICATE",
        motivo: "EMAIL_ALREADY_REGISTERED",
        ip,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        alreadyRegistered: true,
        message: "Gracias. Ya tenemos tu registro y enviaremos una muestra por persona.",
      });
    }

    await appendRow(REGISTROS_RANGE, [
      getNowIso(),
      payload.email,
      payload.nombre,
      payload.telefono,
      payload.cp,
      payload.fuente || "landing-muestras",
      "REGISTRADO",
    ]);

    await logAttempt({
      email: payload.email,
      nombre: payload.nombre,
      telefono: payload.telefono,
      cp: payload.cp,
      resultado: "REGISTERED",
      motivo: "NEW_SAMPLE_REQUEST",
      ip,
      userAgent,
    });

    if (resend && notificationEmail) {
      const subject = `Nueva solicitud de muestra - ${payload.email}`;
      const html = `
        <h2>Nueva solicitud de muestra</h2>
        <p><strong>Fecha:</strong> ${getNowIso()}</p>
        <p><strong>Nombre:</strong> ${payload.nombre}</p>
        <p><strong>Email:</strong> ${payload.email}</p>
        <p><strong>Telefono:</strong> ${payload.telefono}</p>
        <p><strong>CP:</strong> ${payload.cp}</p>
        <p><strong>Fuente:</strong> ${payload.fuente || "landing-muestras"}</p>
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
        message: "No fue posible registrar tu solicitud en este momento.",
      },
      { status: 500 }
    );
  }
}
