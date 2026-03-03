export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      kilos,
      verde = 0,
      roja = 0,
      chilePasado = 0,
      envio = 0,
    } = body;

    if (!kilos || kilos < 1 || kilos > 4) {
      return NextResponse.json({
        success: false,
        message: "Cantidad inválida",
      });
    }

    // 💰 Precios
    const PRECIO_KILO = 580;
    const PRECIO_SALSA = 50;
    const PRECIO_CHILE = 80;

    const subtotalBarbacoa = kilos * PRECIO_KILO;
    const subtotalVerde = verde * PRECIO_SALSA;
    const subtotalRoja = roja * PRECIO_SALSA;
    const subtotalChile = chilePasado * PRECIO_CHILE;

    const total =
      subtotalBarbacoa +
      subtotalVerde +
      subtotalRoja +
      subtotalChile +
      envio;

    // Stripe trabaja en centavos
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: {
              name: `Barbacoa Herencia (${kilos} kg)`,
            },
            unit_amount: PRECIO_KILO * 100,
          },
          quantity: kilos,
        },
        ...(verde > 0
          ? [
              {
                price_data: {
                  currency: "mxn",
                  product_data: { name: "Salsa Verde 300ml" },
                  unit_amount: PRECIO_SALSA * 100,
                },
                quantity: verde,
              },
            ]
          : []),
        ...(roja > 0
          ? [
              {
                price_data: {
                  currency: "mxn",
                  product_data: { name: "Salsa Roja 300ml" },
                  unit_amount: PRECIO_SALSA * 100,
                },
                quantity: roja,
              },
            ]
          : []),
        ...(chilePasado > 0
          ? [
              {
                price_data: {
                  currency: "mxn",
                  product_data: { name: "Salsa de Chile Pasado 300ml" },
                  unit_amount: PRECIO_CHILE * 100,
                },
                quantity: chilePasado,
              },
            ]
          : []),
        ...(envio > 0
          ? [
              {
                price_data: {
                  currency: "mxn",
                  product_data: { name: "Costo de envío" },
                  unit_amount: envio * 100,
                },
                quantity: 1,
              },
            ]
          : []),
      ],
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