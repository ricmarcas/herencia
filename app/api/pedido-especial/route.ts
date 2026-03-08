export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const toEmail = process.env.SPECIAL_ORDERS_TO_EMAIL;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const noReplyEmail = process.env.RESEND_NO_REPLY_EMAIL ?? fromEmail;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export async function POST(req: Request) {
  try {
    if (!resend) {
      return NextResponse.json({ success: false, message: "RESEND_API_KEY no configurada" }, { status: 500 });
    }

    if (!toEmail) {
      return NextResponse.json({ success: false, message: "SPECIAL_ORDERS_TO_EMAIL no configurada" }, { status: 500 });
    }

    const body = await req.json();

    const nombre = String(body?.nombre ?? "").trim();
    const telefono = normalizePhone(String(body?.telefono ?? ""));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const cp = String(body?.cp ?? "").replace(/\D/g, "").slice(0, 5);
    const kilos = Number(body?.kilos ?? 0);
    const fechaDeseada = String(body?.fechaDeseada ?? "").trim();
    const detalles = String(body?.detalles ?? "").trim();

    if (!nombre || telefono.length !== 10 || !email || cp.length !== 5 || kilos <= 4 || !detalles) {
      return NextResponse.json({ success: false, message: "Datos incompletos o invalidos" }, { status: 400 });
    }

    const subject = `Pedido especial (${kilos} kg) - ${nombre}`;

    const html = `
      <h2>Nuevo pedido especial</h2>
      <p><strong>Nombre:</strong> ${nombre}</p>
      <p><strong>Telefono:</strong> ${telefono}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>CP:</strong> ${cp}</p>
      <p><strong>Kilos solicitados:</strong> ${kilos}</p>
      <p><strong>Fecha deseada:</strong> ${fechaDeseada || "No especificada"}</p>
      <p><strong>Necesidades especiales:</strong></p>
      <p>${detalles.replace(/\n/g, "<br />")}</p>
    `;

    await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      replyTo: email,
      subject,
      html,
    });

    const confirmationHtml = `
      <h2>Recibimos tu pedido especial</h2>
      <p>Hola ${nombre}, gracias por contactarnos.</p>
      <p>Ya recibimos tu solicitud de pedido especial y te responderemos pronto.</p>
      <p><strong>Resumen:</strong></p>
      <ul>
        <li>CP: ${cp}</li>
        <li>Kilos solicitados: ${kilos}</li>
        <li>Fecha deseada: ${fechaDeseada || "No especificada"}</li>
      </ul>
      <p>Este correo es informativo, por favor no responder.</p>
    `;

    try {
      await resend.emails.send({
        from: noReplyEmail,
        to: [email],
        subject: "Recibimos tu pedido especial - Barbacoa Herencia",
        html: confirmationHtml,
      });
    } catch (confirmationError) {
      console.error("No se pudo enviar correo de confirmacion al cliente:", confirmationError);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error enviando pedido especial",
      },
      { status: 500 }
    );
  }
}
