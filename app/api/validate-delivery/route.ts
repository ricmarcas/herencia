export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fecha = body.fecha; // formato esperado: "2026-03-05"
    const ventana = body.ventana; // "9-12" o "15-18"

    if (!fecha || !ventana) {
      return NextResponse.json({
        success: false,
        message: "Fecha y ventana requeridas",
      });
    }

    // Validar ventana
    if (!["9-12", "15-18"].includes(ventana)) {
      return NextResponse.json({
        success: false,
        message: "Ventana de entrega inválida",
      });
    }

    const hoy = new Date();
    const fechaSeleccionada = new Date(fecha);

    // Normalizar hora a 00:00 para comparación limpia
    const hoySinHora = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate()
    );

    const diffMs = fechaSeleccionada.getTime() - hoySinHora.getTime();
    const diffDias = diffMs / (1000 * 60 * 60 * 24);

    // No permitir fechas pasadas
    if (diffDias < 0) {
      return NextResponse.json({
        success: false,
        message: "No puedes seleccionar fechas pasadas",
      });
    }

    // Máximo 7 días adelante
    if (diffDias > 7) {
      return NextResponse.json({
        success: false,
        message: "Solo puedes programar hasta 7 días adelante",
      });
    }

    // Si es hoy y ya pasó mediodía, no permitir hoy
    if (diffDias === 0 && hoy.getHours() >= 12) {
      return NextResponse.json({
        success: false,
        message: "Ya no es posible entrega el mismo día",
      });
    }

    // Leer días sin entrega
    const diasSinEntrega = await getSheetData("DiasSinEntrega!A2:B20");

    const fechaBloqueada = diasSinEntrega.find((row) => {
      const [fechaSheet, activo] = row;
      return fechaSheet === fecha && activo === "TRUE";
    });

    if (fechaBloqueada) {
      return NextResponse.json({
        success: false,
        message: "No realizamos entregas en esa fecha",
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    console.error("Validate delivery error:", error);

    return NextResponse.json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Error validando fecha de entrega",
    });
  }
}