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
    if (!row) return { line1: "", line2: "" };
    const interior = row.numeroInterior ? ` Int ${row.numeroInterior}` : "";
    return {
      line1: `${row.calle} ${row.numeroExterior}${interior}`,
      line2: `Col. ${row.colonia}, CP ${row.cp}`,
    };
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

          main {
            margin: 0 !important;
            padding: 0 !important;
            width: 4in !important;
            height: 2.25in !important;
            overflow: hidden !important;
          }

          .label-root {
            position: static !important;
            width: 3.68in !important;
            height: 2.25in !important;
            margin: 0 0 0 0.16in !important;
            padding: 0.08in 0.16in 0.12in 0.19in !important;
            box-sizing: border-box !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <main className="h-[2.25in] w-[4in] overflow-hidden bg-white p-0 text-black">
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
          className="label-root relative ml-[0.16in] flex h-[2.25in] w-[3.68in] flex-col justify-between p-[0.08in] pr-[0.16in] pb-[0.12in] pl-[0.19in]"
        >
          <img
            src="/images/logoHerencia.png"
            alt="Herencia"
            className="absolute right-[0.16in] top-[0.08in] w-[10mm] h-auto object-contain"
          />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide">Barbacoa Estilo Parral</p>
            <p className="mt-[0.06in] text-[17px] font-bold leading-tight">{row.nombre}</p>
            <p className="mt-[0.05in] text-[13px] leading-tight">{direccion.line1}</p>
            <p className="text-[13px] leading-tight">{direccion.line2}</p>
          </div>

          <div>
            <p className="text-[15px] font-bold">Tel: {row.telefono}</p>
            <p className="mt-[0.04in] text-[9px] tracking-wide">www.deherencia.com</p>
          </div>
        </section>
      </main>
    </>
  );
}
