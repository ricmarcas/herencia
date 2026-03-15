// test inventario
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSheetData } from "@/lib/sheets";
import { applyPromotionsToOrder, getEligiblePromotionsByPhone } from "@/lib/promotions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

function readConfig(rows: string[][]): Record<string, string> {
  return rows.reduce<Record<string, string>>((acc, row) => {
    const key = String(row[0] ?? "").trim();
    const value = String(row[1] ?? "").trim();
    if (key) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

async function getShippingByCp(cpRaw: string): Promise<number | null> {
  const cp = String(cpRaw).replace(/\D/g, "").slice(0, 5);
  if (cp.length !== 5) return null;

  const zonas = await getSheetData("Zonas!A2:C3000");
  const zona = zonas.find((row) => {
    const cpSheet = String(row[0] ?? "").replace(/\D/g, "").padStart(5, "0");
    const tipo = String(row[1] ?? "").trim().toUpperCase();
    const activo = String(row[2] ?? "").trim().toUpperCase();
    return cpSheet === cp && activo === "TRUE" && (tipo === "GRATIS" || tipo === "PAGO");
  });

  if (!zona) return null;
  return String(zona[1] ?? "").trim().toUpperCase() === "GRATIS" ? 0 : 200;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      cp,
      kilos,
      verde = 0,
      roja = 0,
      chilePasado = 0,
      nombre,
      email,
      telefono,
      direccion,
      calle = "",
      colonia = "",
      numeroExterior = "",
      numeroInterior = "",
      utmSource = "",
      utmMedium = "",
      utmCampaign = "",
      utmContent = "",
      utmTerm = "",
      gclid = "",
      landingPath = "",
      referrer = "",
      attributionModel = "last_touch",
      fecha,
      ventana,
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

    const configRows = await getSheetData("Configuracion!A2:B300");
    const config = readConfig(configRows);
    const qaMode = String(config.QA_MODE ?? "FALSE").toUpperCase() === "TRUE";
    const qaPrice = Math.max(10, Number(config.QA_TEST_PRICE_MXN ?? "10"));
    const fallbackQaPhones = "5514928475,5530462228";
    const qaAllowedPhonesRaw = String(config.QA_ALLOWED_PHONES ?? fallbackQaPhones);
    const qaAllowedPhones = qaAllowedPhonesRaw
      .split(",")
      .map((phone) => normalizePhone(phone))
      .filter((phone) => phone.length === 10);
    const isQaOrder = qaMode && qaAllowedPhones.includes(normalizePhone(String(telefono)));

    const envioCalculado = await getShippingByCp(String(cp));
    if (envioCalculado === null) {
      return NextResponse.json({
        success: false,
        message: "CP fuera de cobertura",
      });
    }

    const subtotalProductos =
      Math.round(Number(kilos) * PRECIO_KILO) +
      Number(verde) * PRECIO_SALSA +
      Number(roja) * PRECIO_SALSA +
      Number(chilePasado) * PRECIO_CHILE;

    let descuentoAplicado = 0;
    let envioFinal = envioCalculado;
    let appliedPromoIds = "";
    let appliedPromoType: "NONE" | "MULTI" | "PERCENT" | "FREE_SHIPPING" | "FIXED" = "NONE";
    let appliedPromoValue = 0;

    if (!isQaOrder) {
      const eligiblePromos = await getEligiblePromotionsByPhone(String(telefono));
      const promoResult = applyPromotionsToOrder(subtotalProductos, envioCalculado, eligiblePromos.promociones);
      descuentoAplicado = promoResult.descuento;
      envioFinal = promoResult.envioFinal;
      appliedPromoIds = promoResult.appliedPromos.map((promo) => promo.promoId).join(",");
      appliedPromoType =
        promoResult.appliedPromos.length > 1
          ? "MULTI"
          : (promoResult.appliedPromos[0]?.tipo ?? "NONE");
      appliedPromoValue = promoResult.appliedPromos[0]?.valor ?? 0;
    }

    const totalBarbacoaBase = Math.round(kilos * PRECIO_KILO);
    const totalBarbacoaConDescuento = Math.max(1, totalBarbacoaBase - descuentoAplicado);

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = isQaOrder
      ? [
          {
            price_data: {
              currency: "mxn",
              product_data: {
                name: "Orden QA Herencia",
              },
              unit_amount: qaPrice * 100,
            },
            quantity: 1,
          },
        ]
      : [
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

    if (!isQaOrder) {
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

      if (envioFinal > 0) {
        lineItems.push({
          price_data: {
            currency: "mxn",
            product_data: { name: "Costo de envío" },
            unit_amount: envioFinal * 100,
          },
          quantity: 1,
        });
      }
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
        envio: String(envioFinal),
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
        promoId: String(appliedPromoIds),
        promoTipo: String(appliedPromoType),
        promoValor: String(appliedPromoValue),
        descuento: String(descuentoAplicado),
        qaMode: isQaOrder ? "TRUE" : "FALSE",
        utmSource: String(utmSource),
        utmMedium: String(utmMedium),
        utmCampaign: String(utmCampaign),
        utmContent: String(utmContent),
        utmTerm: String(utmTerm),
        gclid: String(gclid),
        landingPath: String(landingPath),
        referrer: String(referrer).slice(0, 500),
        attributionModel: String(attributionModel),
        npsOfferApplied: "FALSE",
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
