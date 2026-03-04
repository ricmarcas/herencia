"use client";

import { useState } from "react";

export default function PedidoPage() {
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  const next = () => setStep((prev) => Math.min(prev + 1, totalSteps));
  const back = () => setStep((prev) => Math.max(prev - 1, 1));

  return (
    <main className="min-h-screen bg-[#f5f1e8] flex items-center justify-center px-4 py-12">

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">

        {/* Indicador */}
        <div className="text-sm text-neutral-500 mb-6 text-center">
          Paso {step} de {totalSteps}
        </div>

        {/* Contenido dinámico */}
        {step === 1 && <PasoCodigoPostal next={next} />}
        {step === 2 && <PasoKilos next={next} back={back} />}
        {step === 3 && <PasoSalsas next={next} back={back} />}
        {step === 4 && <PasoFecha next={next} back={back} />}
        {step === 5 && <PasoConfirmacion back={back} />}

      </div>

    </main>
  );
}

/* =========================
   PASO 1 – Código Postal
========================= */

function PasoCodigoPostal({ next }: { next: () => void }) {
  const [cp, setCp] = useState("");

  const validar = async () => {
    const res = await fetch("/api/validate-zone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cp }),
    });

    const data = await res.json();

    if (data.success) {
      next();
    } else {
      alert("Aún no entregamos en tu zona. Pronto agregaremos formulario especial.");
    }
  };

  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Ingresa tu Código Postal
      </h2>

      <input
        type="text"
        value={cp}
        onChange={(e) => setCp(e.target.value)}
        placeholder="Ej. 03020"
        className="w-full border rounded-xl px-4 py-3 mb-6"
      />

      <button
        onClick={validar}
        className="w-full bg-[#7a5c3e] hover:bg-[#5f452f] text-white py-3 rounded-xl"
      >
        Validar zona
      </button>
    </>
  );
}

/* =========================
   PASO 2 – Kilos
========================= */

function PasoKilos({ next, back }: { next: () => void; back: () => void }) {
  const [kilos, setKilos] = useState(1);

  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Selecciona kilos
      </h2>

      <input
        type="number"
        min={1}
        max={4}
        value={kilos}
        onChange={(e) => setKilos(Number(e.target.value))}
        className="w-full border rounded-xl px-4 py-3 mb-6"
      />

      <div className="flex justify-between">
        <button onClick={back} className="text-neutral-500">
          Atrás
        </button>

        <button
          onClick={next}
          className="bg-[#7a5c3e] hover:bg-[#5f452f] text-white px-6 py-3 rounded-xl"
        >
          Continuar
        </button>
      </div>
    </>
  );
}

/* =========================
   PASO 3 – Salsas
========================= */

function PasoSalsas({ next, back }: { next: () => void; back: () => void }) {
  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Selecciona salsas
      </h2>

      <p className="text-neutral-600 text-center mb-6">
        Recomendamos 1 envase (300ml) por kilo.
      </p>

      <div className="flex justify-between">
        <button onClick={back} className="text-neutral-500">
          Atrás
        </button>

        <button
          onClick={next}
          className="bg-[#7a5c3e] hover:bg-[#5f452f] text-white px-6 py-3 rounded-xl"
        >
          Continuar
        </button>
      </div>
    </>
  );
}

/* =========================
   PASO 4 – Fecha
========================= */

function PasoFecha({ next, back }: { next: () => void; back: () => void }) {
  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Fecha de entrega
      </h2>

      <input
        type="date"
        className="w-full border rounded-xl px-4 py-3 mb-6"
      />

      <div className="flex justify-between">
        <button onClick={back} className="text-neutral-500">
          Atrás
        </button>

        <button
          onClick={next}
          className="bg-[#7a5c3e] hover:bg-[#5f452f] text-white px-6 py-3 rounded-xl"
        >
          Continuar
        </button>
      </div>
    </>
  );
}

/* =========================
   PASO 5 – Confirmación
========================= */

function PasoConfirmacion({ back }: { back: () => void }) {
  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Confirmar pedido
      </h2>

      <p className="text-center text-neutral-600 mb-6">
        Aquí conectaremos con Stripe.
      </p>

      <div className="flex justify-between">
        <button onClick={back} className="text-neutral-500">
          Atrás
        </button>

        <button className="bg-[#7a5c3e] hover:bg-[#5f452f] text-white px-6 py-3 rounded-xl">
          Pagar ahora
        </button>
      </div>
    </>
  );
}