import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Productos!A2:D",
    });

    const rows = response.data.values;

    if (!rows) {
      return NextResponse.json({ success: false });
    }

    const productos = rows
      .filter((row) => row[3] === "TRUE")
      .map((row) => ({
        nombre: row[0],
        presentacion: row[1],
        precio: Number(row[2]),
      }));

    return NextResponse.json({
      success: true,
      productos,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      error: "Error leyendo productos",
    });
  }
}