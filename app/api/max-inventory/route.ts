import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

export async function GET() {

  try {

    const rows = await getSheetData("Inventario");

    let stock1kg = 0;
    let stock05kg = 0;

    rows.forEach((r: string[]) => {

      if (r[0] === "Barbacoa" && r[1] === "1kg") {
        stock1kg = Number(r[2]);
      }

      if (r[0] === "Barbacoa" && r[1] === "0.5kg") {
        stock05kg = Number(r[2]);
      }

    });

    const maxKilos = stock1kg + stock05kg * 0.5;

    return NextResponse.json({
      success: true,
      maxKilos
    });

  } catch {

    return NextResponse.json({
      success: false,
      error: "Error leyendo inventario"
    });

  }

}
