export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSheetData, appendRow } from "@/lib/sheets";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawCp = body?.cp;

    if (!rawCp) {
      return NextResponse.json({
        success: false,
        message: "Código postal requerido",
      });
    }

    // Limpiar CP (solo números)
    const cp = String(rawCp).replace(/\D/g, "");

    if (cp.length !== 5) {
      return NextResponse.json({
        success: false,
        message: "Código postal inválido",
      });
    }

    // Leer hoja Zonas
    const zonas = await getSheetData("Zonas!A2:C3000");

    if (!zonas || zonas.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No hay zonas configuradas",
      });
    }

    // Buscar CP
    const zonaEncontrada = zonas.find((row) => {
        const [cpSheetRaw, , activo] = row;

        // Normalizar CP del sheet
        const cpSheet = String(cpSheetRaw).padStart(5, "0");
    return cpSheet === cp && activo === "TRUE";
    });

    if (!zonaEncontrada) {
      // Guardar en CP_Solicitados
      await appendRow("CP_Solicitados!A2:B100", [
        new Date().toISOString(),
        cp,
      ]);

      return NextResponse.json({
        success: false,
        message: "Aún no entregamos en tu zona",
      });
    }

    const [, tipo] = zonaEncontrada;

    const envio = tipo === "GRATIS" ? 0 : 200;

    return NextResponse.json({
      success: true,
      envio,
    });
  } catch (error: unknown) {
    console.error("Validate zone error:", error);

    return NextResponse.json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Error validando zona",
    });
  }
}
