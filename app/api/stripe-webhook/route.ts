export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { google } from "googleapis";
import { appendRow, getSheetData } from "@/lib/sheets";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      endpointSecret
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const metadata = session.metadata ?? {};

      const kilos = Number(metadata.kilos ?? 0);
      const verde = Number(metadata.verde ?? 0);
      const roja = Number(metadata.roja ?? 0);
      const chilePasado = Number(metadata.chilePasado ?? 0);
      const envio = Number(metadata.envio ?? 0);

      const telefono = metadata.telefono ?? "";
      const direccion = metadata.direccion ?? "";
      const fechaEntrega = metadata.fecha ?? "";
      const ventana = metadata.ventana ?? "";

      const total = session.amount_total
        ? session.amount_total / 100
        : 0;

      // 📝 Guardar en hoja Pedidos
      await appendRow("Pedidos!A2:L1000", [
        session.id,
        new Date().toISOString(),
        telefono,
        kilos,
        verde,
        roja,
        chilePasado,
        direccion,
        envio,
        total,
        fechaEntrega,
        ventana,
      ]);

      // 📦 Obtener inventario actual
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

      // 🔄 Actualizar hoja Inventario
      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth });

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
    const message =
      error instanceof Error ? error.message : "Webhook error";
    console.error("Webhook error:", message);

    return NextResponse.json({ error: message }, { status: 400 });
  }
}