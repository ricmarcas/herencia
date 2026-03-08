export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getEligiblePromotionsByPhone } from "@/lib/promotions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await getEligiblePromotionsByPhone(String(body?.telefono ?? ""));

    return NextResponse.json({
      success: true,
      promociones: result.promociones,
      telefono: result.telefono,
      message: result.message,
    });
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      promociones: [],
      telefono: "",
      message: error instanceof Error ? error.message : "Error validando promocion",
    });
  }
}
