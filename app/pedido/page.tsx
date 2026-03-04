"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* =========================
   Tipos
========================= */

type Pedido = {
  cp: string;
  envio: number;
  kilos: number;
  verde: number;
  roja: number;
  chilePasado: number;
  fecha: string;
  ventana: string;
};

/* =========================
   Página Principal
========================= */

export default function PedidoPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const totalSteps = 5;

  const [pedido, setPedido] = useState<Pedido>({
    cp: "",
    envio: 0,
    kilos: 1,
    verde: 0,
    roja: 0,
    chilePasado: 0,
    fecha: "",
    ventana: "",
  });

  /* =========================
     Calcular Total
  ========================= */

  const calcularTotal = () => {
    const precioKilo = 580;
    const precioVerde = 50;
    const precioRoja = 50;
    const precioChile = 80;

    const totalBarbacoa = pedido.kilos * precioKilo;
    const totalSalsas =
      pedido.verde * precioVerde +
      pedido.roja * precioRoja +
      pedido.chilePasado * precioChile;

    return totalBarbacoa + totalSalsas + pedido.envio;
  };

  const next = () => setStep((s) => Math.min(s + 1, totalSteps));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <main className="min-h-screen bg-[#f5f1e8] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">

        <div className="text-sm text-neutral-500 mb-6 text-center">
          Paso {step} de {totalSteps}
        </div>

        {step === 1 && (
          <PasoCodigoPostal
            pedido={pedido}
            setPedido={setPedido}
            next={next}
          />
        )}

        {step === 2 && (
          <PasoKilos
            pedido={pedido}
            setPedido={setPedido}
            next={next}
            back={back}
            router={router}
          />
        )}

        {step === 3 && (
          <PasoSalsas
            pedido={pedido}
            setPedido={setPedido}
            next={next}
            back={back}
          />
        )}

        {step === 4 && (
          <PasoFecha
            pedido={pedido}
            setPedido={setPedido}
            next={next}
            back={back}
          />
        )}

        {step === 5 && (
          <PasoConfirmacion
            pedido={pedido}
            total={calcularTotal()}
            back={back}
          />
        )}

      </div>
    </main>
  );
}

/* =========================
   PASO 1 – CP
========================= */

function PasoCodigoPostal({
  pedido,
  setPedido,
  next,
}: any) {
  const [cp, setCp] = useState("");

  const validar = async () => {
    const res = await fetch("/api/validate-zone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cp }),
    });

    const data = await res.json();

    if (data.success) {
      setPedido({ ...pedido, cp, envio: data.envio });
      next();
    } else {
      alert(
        "Aún no entregamos en tu zona. Pronto activaremos formulario especial."
      );
    }
  };

  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Código Postal
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
   PASO 2 – KILOS
========================= */

function PasoKilos({
  pedido,
  setPedido,
  next,
  back,
  router,
}: any) {

  const opciones = [1, 1.5, 2, 2.5, 3, 3.5, 4];

  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Selecciona kilos
      </h2>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {opciones.map((kg) => (
          <button
            key={kg}
            onClick={() => setPedido({ ...pedido, kilos: kg })}
            className={`py-3 rounded-xl border ${
              pedido.kilos === kg
                ? "bg-[#7a5c3e] text-white"
                : "bg-white"
            }`}
          >
            {kg} kg
          </button>
        ))}
      </div>

      <button
        onClick={() => router.push("/pedido-especial")}
        className="text-sm text-[#7a5c3e] underline mb-6 block text-center"
      >
        ¿Más de 4 kg? Pedido especial para eventos
      </button>

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
   PASO 3 – SALSAS
========================= */

function PasoSalsas({
  pedido,
  setPedido,
  next,
  back,
}: any) {

  const maxPorTipo = pedido.kilos * 3;

  const cambiar = (tipo: string, valor: number) => {
    if (valor < 0) return;
    if (valor > maxPorTipo) return;

    setPedido({ ...pedido, [tipo]: valor });
  };

  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Salsas (300ml)
      </h2>

      <p className="text-sm text-neutral-500 mb-4 text-center">
        Recomendamos 1 envase por kilo.
      </p>

      {[
        { nombre: "Salsa Verde", key: "verde", precio: 50 },
        { nombre: "Salsa Roja", key: "roja", precio: 50 },
        { nombre: "Salsa de Chile Pasado", key: "chilePasado", precio: 80 },
      ].map((salsa) => (
        <div key={salsa.key} className="flex justify-between items-center mb-4">
          <div>
            <p>{salsa.nombre}</p>
            <p className="text-sm text-neutral-500">
              ${salsa.precio}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                cambiar(salsa.key, pedido[salsa.key] - 1)
              }
              className="px-3 border rounded"
            >
              -
            </button>

            <span>{pedido[salsa.key]}</span>

            <button
              onClick={() =>
                cambiar(salsa.key, pedido[salsa.key] + 1)
              }
              className="px-3 border rounded"
            >
              +
            </button>
          </div>
        </div>
      ))}

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
   PASO 4 – FECHA
========================= */

function PasoFecha({
  pedido,
  setPedido,
  next,
  back,
}: any) {

  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Fecha de entrega
      </h2>

      <input
        type="date"
        value={pedido.fecha}
        onChange={(e) =>
          setPedido({ ...pedido, fecha: e.target.value })
        }
        className="w-full border rounded-xl px-4 py-3 mb-6"
      />

      <div className="mb-6">
        <label className="block mb-2">
          <input
            type="radio"
            name="ventana"
            value="9-12"
            onChange={(e) =>
              setPedido({ ...pedido, ventana: e.target.value })
            }
          />{" "}
          9:00 – 12:00
        </label>

        <label>
          <input
            type="radio"
            name="ventana"
            value="15-18"
            onChange={(e) =>
              setPedido({ ...pedido, ventana: e.target.value })
            }
          />{" "}
          15:00 – 18:00
        </label>
      </div>

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
   PASO 5 – CONFIRMAR
========================= */

function PasoConfirmacion({
  pedido,
  total,
  back,
}: any) {

  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Confirmar pedido
      </h2>

      <div className="text-sm space-y-2 mb-6">
        <p>Kilos: {pedido.kilos}</p>
        <p>Salsa Verde: {pedido.verde}</p>
        <p>Salsa Roja: {pedido.roja}</p>
        <p>Chile Pasado: {pedido.chilePasado}</p>
        <p>Envío: ${pedido.envio}</p>
        <hr />
        <p className="font-semibold">
          Total (IVA incluido): ${total}
        </p>
      </div>

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