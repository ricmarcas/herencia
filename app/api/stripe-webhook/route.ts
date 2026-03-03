export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { appendRow, getSheetData } from "@/lib/sheets";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const sig = headers().get("stripe-signature");

    if (!sig) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      endpointSecret
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const {
        kilos,
        verde,
        roja,
        chilePasado,
        envio,
        telefono,
        direccion,
        fecha,
        ventana,
      } = session.metadata as Record<string, string>;

      const kilosNum = Number(kilos);
      const verdeNum = Number(verde);
      const rojaNum = Number(roja);
      const chileNum = Number(chilePasado);
      const envioNum = Number(envio);

      const total = session.amount_total
        ? session.amount_total / 100
        : 0;

      // 📝 Guardar en hoja Pedidos
      await appendRow("Pedidos!A2:L1000", [
        session.id,
        new Date().toISOString(),
        telefono,
        kilosNum,
        verdeNum,
        rojaNum,
        chileNum,
        direccion, // usamos direccion como CP/campo editable luego
        envioNum,
        total,
        fecha,
        ventana,
      ]);

      // 📦 Descontar inventario
      const inventario = await getSheetData("Inventario!A2:C20");

      const updatedRows = inventario.map((row) => {
        const [producto, presentacion, stockRaw] = row;
        let stock = Number(stockRaw);

        if (producto === "Barbacoa" && presentacion === "1kg") {
          const usar1kg = Math.min(
            Math.floor(kilosNum),
            stock
          );
          stock -= usar1kg;
        }

        if (producto === "Barbacoa" && presentacion === "0.5kg") {
          const restante =
            kilosNum - Math.floor(kilosNum);
          if (restante > 0) {
            const usar05 = restante / 0.5;
            stock -= usar05;
          }
        }

        if (producto === "Salsa Verde") {
          stock -= verdeNum;
        }

        if (producto === "Salsa Roja") {
          stock -= rojaNum;
        }

        if (producto === "Salsa de Chile Pasado") {
          stock -= chileNum;
        }

        return [producto, presentacion, stock];
      });

      // Actualizar hoja inventario
      // Reescribimos rango completo
      const stripeSheets = await import("@/lib/sheets");

      const { google } = await import("googleapis");

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
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}