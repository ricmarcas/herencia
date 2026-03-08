export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

export async function GET() {
  try {
    const inventario = await getSheetData("Inventario!A2:C50");

    let stockVerde = 0;
    let stockRoja = 0;
    let stockChilePasado = 0;

    for (const row of inventario) {
      const [producto, , stockRaw] = row;
      const stock = Number(stockRaw ?? 0);

      if (producto === "Salsa Verde") stockVerde = stock;
      if (producto === "Salsa Roja") stockRoja = stock;
      if (producto === "Salsa de Chile Pasado") stockChilePasado = stock;
    }

    return NextResponse.json({
      success: true,
      verde: stockVerde > 0,
      roja: stockRoja > 0,
      chilePasado: stockChilePasado > 0,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        verde: true,
        roja: true,
        chilePasado: true,
        message: error instanceof Error ? error.message : "Error consultando inventario de salsas",
      },
      { status: 500 }
    );
  }
}
