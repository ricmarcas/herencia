"use client";

import { useEffect, useMemo, useState } from "react";

type PrintableSampleRow = {
  rowNumber: number;
  fechaRegistro: string;
  email: string;
  nombre: string;
  telefono: string;
  cp: string;
  colonia: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
};

function formatDate(value: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-MX");
}

export default function AdminMuestrasPrintPage() {
  const [row, setRow] = useState<PrintableSampleRow | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key") ?? "";
    if (!key) {
      setError("No se encontro la referencia de impresion.");
      return;
    }

    const raw = window.localStorage.getItem(key);
    if (!raw) {
      setError("No se encontro la informacion para imprimir.");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as PrintableSampleRow;
      setRow(parsed);
      window.localStorage.removeItem(key);
    } catch {
      setError("No se pudo leer la informacion para imprimir.");
    }
  }, []);

  useEffect(() => {
    if (!row) return;
    const timer = window.setTimeout(() => {
      window.print();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [row]);

  const direccion = useMemo(() => {
    if (!row) return "";
    const interior = row.numeroInterior ? ` Int ${row.numeroInterior}` : "";
    return `${row.calle} ${row.numeroExterior}${interior}, Col. ${row.colonia}, CP ${row.cp}`;
  }, [row]);

  if (error) {
    return (
      <main className="min-h-screen bg-white p-8 text-black">
        <p>{error}</p>
      </main>
    );
  }

  if (!row) {
    return (
      <main className="min-h-screen bg-white p-8 text-black">
        <p>Cargando formato de impresion...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white p-8 text-black">
      <h1 className="mb-4 text-2xl font-semibold">Entrega de muestra</h1>
      <button
        type="button"
        onClick={() => window.print()}
        className="mb-4 rounded-lg border px-4 py-2 text-sm"
      >
        Imprimir
      </button>
      <div className="rounded-xl border border-neutral-300 p-4">
        <p className="mb-2"><strong>Nombre:</strong> {row.nombre}</p>
        <p className="mb-2"><strong>Direccion:</strong> {direccion}</p>
        <p className="mb-2"><strong>Telefono:</strong> {row.telefono}</p>
        <p className="mb-2"><strong>Email:</strong> {row.email}</p>
        <p className="mb-2"><strong>Fecha solicitud:</strong> {formatDate(row.fechaRegistro)}</p>
      </div>
    </main>
  );
}
