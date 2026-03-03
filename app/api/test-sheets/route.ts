import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

export async function GET() {
  try {
    const data = await getSheetData("Inventario!A2:C10");

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      error: "Error leyendo Sheet",
    });
  }
}