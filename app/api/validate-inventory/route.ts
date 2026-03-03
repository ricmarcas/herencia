export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const kilos = Number(body.kilos);
    const verde = Number(body.verde || 0);
    const roja = Number(body.roja || 0);
    const chilePasado = Number(body.chilePasado || 0);

    if (!kilos || kilos < 1 || kilos > 4) {
      return NextResponse.json({
        success: false,
        message: "Cantidad de kilos inválida (1 a 4 kg)",
      });
    }

    const inventario = await getSheetData("Inventario!A2:C20");

    let stock1kg = 0;
    let stock05kg = 0;
    let stockVerde = 0;
    let stockRoja = 0;
    let stockChile = 0;

    inventario.forEach((row) => {
      const [producto, presentacion, stockRaw] = row;
      const stock = Number(stockRaw);

      if (producto === "Barbacoa" && presentacion === "1kg") {
        stock1kg = stock;
      }

      if (producto === "Barbacoa" && presentacion === "0.5kg") {
        stock05kg = stock;
      }

      if (producto === "Salsa Verde") {
        stockVerde = stock;
      }

      if (producto === "Salsa Roja") {
        stockRoja = stock;
      }

      if (producto === "Salsa de Chile Pasado") {
        stockChile = stock;
      }
    });

    // 🔥 Calcular máximo posible real
    const maxTotalDisponible = stock1kg + stock05kg * 0.5;

    if (kilos > maxTotalDisponible) {
      return NextResponse.json({
        success: false,
        message: "Inventario insuficiente",
        maxDisponible: maxTotalDisponible,
      });
    }

    // 🥩 Intentar cubrir kilos
    const usar1kg = Math.min(Math.floor(kilos), stock1kg);
    const restante = kilos - usar1kg;

    let usar05kg = 0;

    if (restante > 0) {
      usar05kg = restante / 0.5;

      if (usar05kg > stock05kg) {
        return NextResponse.json({
          success: false,
          message: "Inventario insuficiente",
          maxDisponible: maxTotalDisponible,
        });
      }
    }

    // 🌶 Validar límites de salsa
    const maxSalsaPorTipo = kilos * 3;

    if (verde > maxSalsaPorTipo || roja > maxSalsaPorTipo || chilePasado > maxSalsaPorTipo) {
      return NextResponse.json({
        success: false,
        message: "Excede límite de salsas por kilo",
      });
    }

    if (verde > stockVerde || roja > stockRoja || chilePasado > stockChile) {
      return NextResponse.json({
        success: false,
        message: "Stock insuficiente de salsas",
      });
    }

    return NextResponse.json({
      success: true,
      detalle: {
        usar1kg,
        usar05kg,
      },
    });
  } catch (error: unknown) {
    console.error("Validate inventory error:", error);

    return NextResponse.json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Error validando inventario",
    });
  }
}