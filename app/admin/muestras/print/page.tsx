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
    <>
      <style jsx global>{`
        @page {
          size: 100mm 55mm;
          margin: 0;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #fff;
          color: #000;
        }

        @media print {
          .print-actions {
            display: none !important;
          }
        }
      `}</style>

      <main className="flex min-h-screen items-start justify-center bg-white p-3 text-black">
        <div className="print-actions mb-3 w-full max-w-sm">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Imprimir etiqueta
          </button>
        </div>

        <section
          aria-label="Etiqueta de envio"
          className="flex h-[55mm] w-[100mm] flex-col justify-between border border-black p-[3mm]"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide">Barbacoa Estilo Parral</p>
            <p className="text-[8px] tracking-wide">www.deherencia.com</p>
            <p className="mt-[2mm] text-[13px] font-bold leading-tight">{row.nombre}</p>
            <p className="mt-[2mm] text-[10px] leading-tight">{direccion}</p>
          </div>

          <div>
            <p className="text-[12px] font-bold">Tel: {row.telefono}</p>
            <p className="mt-[2mm] text-[8px] text-neutral-700">Registro: {formatDate(row.fechaRegistro)}</p>
          </div>
        </section>
      </main>
    </>
  );
}
