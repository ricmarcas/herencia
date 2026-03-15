"use client";

import { useEffect, useMemo, useState } from "react";

type PrintableSampleRow = {
  rowNumber: number;
  email: string;
  nombre: string;
  telefono: string;
  cp: string;
  colonia: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
};

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
          size: 4in 2.25in;
          margin: 0;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #fff;
          color: #000;
          width: 4in;
          height: 2.25in;
          overflow: hidden;
        }

        @media print {
          .screen-only {
            display: none !important;
          }

          .label-root {
            position: fixed !important;
            left: 0.125in !important;
            top: 0.06in !important;
            width: calc(4in - 0.185in) !important;
            height: calc(2.25in - 0.12in) !important;
            margin: 0 !important;
            padding: 0.08in 0.09in 0.08in 0.12in !important;
          }
        }
      `}</style>

      <main className="bg-white p-2 text-black">
        <div className="screen-only mb-2 w-full max-w-sm">
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
          className="label-root flex h-[2.13in] w-[3.815in] flex-col justify-between p-[0.08in] pl-[0.12in]"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide">Barbacoa Estilo Parral</p>
            <p className="mt-[0.08in] text-[18px] font-bold leading-tight">{row.nombre}</p>
            <p className="mt-[0.08in] text-[13px] leading-tight">{direccion}</p>
          </div>

          <div>
            <p className="text-[16px] font-bold">Tel: {row.telefono}</p>
            <p className="mt-[0.08in] text-[11px] tracking-wide">www.deherencia.com</p>
          </div>
        </section>
      </main>
    </>
  );
}
