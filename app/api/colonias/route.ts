export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const normalizedCandidates = candidates.map((candidate) => normalizeHeader(candidate));

  return normalizedHeaders.findIndex((header) => normalizedCandidates.includes(header));
}

function isActive(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  const normalized = normalizeHeader(value);
  return ["true", "1", "si", "activo", "activa"].includes(normalized);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cpRaw = searchParams.get("cp") ?? "";
    const cp = cpRaw.replace(/\D/g, "").slice(0, 5);

    if (cp.length !== 5) {
      return NextResponse.json({
        success: false,
        colonias: [],
        message: "Codigo postal invalido",
      });
    }

    const rows = await getSheetData("Colonias!A1:Z3000");

    if (!rows.length) {
      return NextResponse.json({ success: true, colonias: [] });
    }

    const headers = rows[0] ?? [];
    const dataRows = rows.slice(1);

    const cpIndex = findHeaderIndex(headers, ["CP", "CodigoPostal", "Codigo Postal", "d_codigo"]);
    const coloniaIndex = findHeaderIndex(headers, ["Colonia", "Asentamiento", "d_asenta"]);
    const activoIndex = findHeaderIndex(headers, ["Activo", "Cobertura", "Habilitado", "Entrega"]);

    if (cpIndex < 0 || coloniaIndex < 0) {
      return NextResponse.json({
        success: false,
        colonias: [],
        message: "No se encontraron columnas de CP y Colonia en la hoja Colonias",
      });
    }

    const coloniasSet = new Set<string>();

    for (const row of dataRows) {
      const cpValue = String(row[cpIndex] ?? "").replace(/\D/g, "").padStart(5, "0");
      if (cpValue !== cp) {
        continue;
      }

      if (activoIndex >= 0 && !isActive(String(row[activoIndex] ?? ""))) {
        continue;
      }

      const colonia = String(row[coloniaIndex] ?? "").trim();
      if (colonia.length > 0) {
        coloniasSet.add(colonia);
      }
    }

    const colonias = Array.from(coloniasSet).sort((a, b) => a.localeCompare(b, "es"));

    return NextResponse.json({
      success: true,
      colonias,
    });
  } catch (error: unknown) {
    console.error("Colonias API error:", error);

    return NextResponse.json({
      success: false,
      colonias: [],
      message: error instanceof Error ? error.message : "Error consultando colonias",
    });
  }
}
