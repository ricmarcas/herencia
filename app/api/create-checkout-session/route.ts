// test inventario
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      cp,
      kilos,
      verde = 0,
      roja = 0,
      chilePasado = 0,
      envio = 0,
      nombre,
      email,
      telefono,
      direccion,
      calle = "",
      colonia = "",
      numeroExterior = "",
      numeroInterior = "",
      fecha,
      ventana,
      promoId = "",
      promoTipo = "NONE",
      promoValor = 0,
      descuento = 0,
    } = body;

    if (!kilos || kilos < 1 || kilos > 4) {
      return NextResponse.json({
        success: false,
        message: "Cantidad inválida",
      });
    }

    if (!cp || !telefono || !direccion || !fecha || !ventana || !nombre || !email) {
      return NextResponse.json({
        success: false,
        message: "Datos incompletos del pedido",
      });
    }

    // 💰 Precios
    const PRECIO_KILO = 580;
    const PRECIO_SALSA = 50;
    const PRECIO_CHILE = 80;

    const descuentoAplicado =
      promoTipo === "PERCENT" && Number(promoValor) > 0
        ? Math.max(0, Math.round(Number(descuento)))
        : 0;

    const totalBarbacoaBase = Math.round(kilos * PRECIO_KILO);
    const totalBarbacoaConDescuento = Math.max(1, totalBarbacoaBase - descuentoAplicado);

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "mxn",
          product_data: {
            name: `Barbacoa Herencia (${kilos} kg)`,
          },
          unit_amount: totalBarbacoaConDescuento * 100,
        },
        quantity: 1,
      },
    ];

    if (verde > 0) {
      lineItems.push({
        price_data: {
          currency: "mxn",
          product_data: { name: "Salsa Verde 300ml" },
          unit_amount: PRECIO_SALSA * 100,
        },
        quantity: verde,
      });
    }

    if (roja > 0) {
      lineItems.push({
        price_data: {
          currency: "mxn",
          product_data: { name: "Salsa Roja 300ml" },
          unit_amount: PRECIO_SALSA * 100,
        },
        quantity: roja,
      });
    }

    if (chilePasado > 0) {
      lineItems.push({
        price_data: {
          currency: "mxn",
          product_data: { name: "Salsa de Chile Pasado 300ml" },
          unit_amount: PRECIO_CHILE * 100,
        },
        quantity: chilePasado,
      });
    }

    if (envio > 0) {
      lineItems.push({
        price_data: {
          currency: "mxn",
          product_data: { name: "Costo de envío" },
          unit_amount: envio * 100,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: lineItems,
      metadata: {
        kilos: String(kilos),
        verde: String(verde),
        roja: String(roja),
        chilePasado: String(chilePasado),
        envio: String(envio),
        cp: String(cp),
        nombre: String(nombre),
        email: String(email),
        telefono: String(telefono),
        direccion: String(direccion),
        calle: String(calle),
        colonia: String(colonia),
        numeroExterior: String(numeroExterior),
        numeroInterior: String(numeroInterior),
        fecha: String(fecha),
        ventana: String(ventana),
        promoId: String(promoId),
        promoTipo: String(promoTipo),
        promoValor: String(promoValor),
        descuento: String(descuentoAplicado),
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cancel`,
    });

    return NextResponse.json({
      success: true,
      url: session.url,
    });
  } catch (error: unknown) {
    console.error("Stripe error:", error);

    return NextResponse.json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Error creando sesión Stripe",
    });
  }
}
