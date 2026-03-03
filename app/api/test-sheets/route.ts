export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

export async function GET() {
  try {
    const data = await getSheetData("Inventario!A2:C10");

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: unknown) {
    console.error("Sheets error:", error);

    return NextResponse.json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error reading sheet",
    });
  }
}