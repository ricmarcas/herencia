"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

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

type Precios = {
  barbacoa: number;
  verde: number;
  roja: number;
  chilePasado: number;
};

/* =========================
   Página Principal
========================= */

export default function PedidoPage() {
  const router = useRouter();

  const [step, setStep] = useState<number>(1);

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

  const [precios, setPrecios] = useState<Precios>({
    barbacoa: 0,
    verde: 0,
    roja: 0,
    chilePasado: 0,
  });

  const [loadingPrecios, setLoadingPrecios] = useState<boolean>(true);

  /* =========================
     Cargar productos dinámicos
  ========================== */

  useEffect(() => {
    const cargarProductos = async () => {
      try {
        const res = await fetch("/api/productos");
        const data = await res.json();

        if (data.success) {
          const lista = data.productos;

          setPrecios({
            barbacoa:
              lista.find((p: { nombre: string }) => p.nombre === "Barbacoa")
                ?.precio || 0,
            verde:
              lista.find((p: { nombre: string }) => p.nombre === "Salsa Verde")
                ?.precio || 0,
            roja:
              lista.find((p: { nombre: string }) => p.nombre === "Salsa Roja")
                ?.precio || 0,
            chilePasado:
              lista.find(
                (p: { nombre: string }) =>
                  p.nombre === "Salsa de Chile Pasado"
              )?.precio || 0,
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingPrecios(false);
      }
    };

    cargarProductos();
  }, []);

  if (loadingPrecios) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Cargando productos...</p>
      </main>
    );
  }

  /* =========================
     Totales dinámicos
  ========================== */

  const totalBarbacoa = pedido.kilos * precios.barbacoa;
  const totalSalsas =
    pedido.verde * precios.verde +
    pedido.roja * precios.roja +
    pedido.chilePasado * precios.chilePasado;

  const total = totalBarbacoa + totalSalsas + pedido.envio;

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  return (
    <main className="min-h-screen bg-[#f5f1e8] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">

        <div className="text-sm text-neutral-500 mb-6 text-center">
          Paso {step} de 5
        </div>

        {step === 1 && (
          <PasoCodigoPostal setPedido={setPedido} next={next} />
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
            precios={precios}
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
          <PasoConfirmacion total={total} back={back} />
        )}

        {/* RESUMEN (no en paso 1) */}
        {step > 1 && (
          <div className="mt-8 pt-6 border-t text-sm space-y-1">
            <p>Barbacoa: ${totalBarbacoa}</p>
            <p>Salsas: ${totalSalsas}</p>
            <p>Envío: ${pedido.envio}</p>
            <hr />
            <p className="font-semibold">
              Total (IVA incluido): ${total}
            </p>
          </div>
        )}

      </div>
    </main>
  );
}

/* =========================
   PASO 1 – CP
========================= */

type Paso1Props = {
  setPedido: React.Dispatch<React.SetStateAction<Pedido>>;
  next: () => void;
};

function PasoCodigoPostal({ setPedido, next }: Paso1Props) {
  const [cpInput, setCpInput] = useState<string>("");
  const [mensaje, setMensaje] = useState<string>("");

  const validar = async () => {
    const res = await fetch("/api/validate-zone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cp: cpInput }),
    });

    const data = await res.json();

    if (data.success) {
      setPedido((prev) => ({
        ...prev,
        cp: cpInput,
        envio: data.envio,
      }));

      setMensaje(
        data.envio === 0
          ? "✅ Entregamos en tu zona – Envío GRATIS"
          : `✅ Entregamos en tu zona – Costo de envío: $${data.envio}`
      );

      setTimeout(() => next(), 800);
    } else {
      setMensaje("Aún no entregamos en tu zona.");
    }
  };

  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Código Postal
      </h2>

      <input
        type="text"
        value={cpInput}
        onChange={(e) => setCpInput(e.target.value)}
        placeholder="Ej. 03020"
        className="w-full border rounded-xl px-4 py-3 mb-6"
      />

      <button
        onClick={validar}
        className="w-full bg-[#7a5c3e] text-white py-3 rounded-xl"
      >
        Validar zona
      </button>

      {mensaje && (
        <p className="mt-4 text-center text-sm text-neutral-600">
          {mensaje}
        </p>
      )}
    </>
  );
}

/* =========================
   PASO 2 – KILOS
========================= */

type Paso2Props = {
  pedido: Pedido;
  setPedido: React.Dispatch<React.SetStateAction<Pedido>>;
  next: () => void;
  back: () => void;
  router: AppRouterInstance;
};

function PasoKilos({
  pedido,
  setPedido,
  next,
  back,
  router,
}: Paso2Props) {

  const opciones = [1, 1.5, 2, 2.5, 3, 3.5, 4];

  return (
    <>
      <h2 className="text-2xl font-semibold mb-4 text-center">
        Selecciona kilos
      </h2>

      <p className="text-sm text-center text-neutral-600 mb-4">
        {pedido.envio === 0
          ? "✅ Entregamos en tu zona – Envío GRATIS"
          : `✅ Entregamos en tu zona – Envío $${pedido.envio}`}
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {opciones.map((kg) => (
          <button
            key={kg}
            onClick={() =>
              setPedido((prev) => {
                const nuevoMax = kg * 3;
                return {
                  ...prev,
                  kilos: kg,
                  verde: Math.min(prev.verde, nuevoMax),
                  roja: Math.min(prev.roja, nuevoMax),
                  chilePasado: Math.min(prev.chilePasado, nuevoMax),
                };
              })
            }
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
        ¿Más de 4 kg? Pedido especial
      </button>

      <div className="flex justify-between">
        <button onClick={back} className="text-neutral-500">
          Atrás
        </button>

        <button
          onClick={next}
          className="bg-[#7a5c3e] text-white px-6 py-3 rounded-xl"
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

type Paso3Props = {
  pedido: Pedido;
  setPedido: React.Dispatch<React.SetStateAction<Pedido>>;
  next: () => void;
  back: () => void;
  precios: Precios;
};

function PasoSalsas({
  pedido,
  setPedido,
  next,
  back,
  precios,
}: Paso3Props) {

  const max = pedido.kilos * 3;

  const cambiar = (
    tipo: "verde" | "roja" | "chilePasado",
    valor: number
  ) => {
    if (valor < 0) return;
    if (valor > max) valor = max;

    setPedido((prev) => ({ ...prev, [tipo]: valor }));
  };

  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Salsas (300ml)
      </h2>

      {[
        { nombre: "Salsa Verde", key: "verde", precio: precios.verde },
        { nombre: "Salsa Roja", key: "roja", precio: precios.roja },
        { nombre: "Salsa de Chile Pasado", key: "chilePasado", precio: precios.chilePasado },
      ].map((salsa) => (
        <div key={salsa.key} className="flex justify-between items-center mb-4">
          <div>
            <p>{salsa.nombre}</p>
            <p className="text-sm text-neutral-500">${salsa.precio}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                cambiar(
                  salsa.key as "verde" | "roja" | "chilePasado",
                  (pedido[salsa.key as keyof Pedido] as number) - 1
                )
              }
              className="px-3 border rounded"
            >
              -
            </button>

            <span>{pedido[salsa.key as keyof Pedido]}</span>

            <button
              onClick={() =>
                cambiar(
                  salsa.key as "verde" | "roja" | "chilePasado",
                  (pedido[salsa.key as keyof Pedido] as number) + 1
                )
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
          className="bg-[#7a5c3e] text-white px-6 py-3 rounded-xl"
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

type Paso4Props = {
  pedido: Pedido;
  setPedido: React.Dispatch<React.SetStateAction<Pedido>>;
  next: () => void;
  back: () => void;
};

function PasoFecha({
  pedido,
  setPedido,
  next,
  back,
}: Paso4Props) {
  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Fecha de entrega
      </h2>

      <input
        type="date"
        value={pedido.fecha}
        onChange={(e) =>
          setPedido((prev) => ({
            ...prev,
            fecha: e.target.value,
          }))
        }
        className="w-full border rounded-xl px-4 py-3 mb-6"
      />

      <div className="mb-6">
        <label className="block mb-2">
          <input
            type="radio"
            value="9-12"
            checked={pedido.ventana === "9-12"}
            onChange={(e) =>
              setPedido((prev) => ({
                ...prev,
                ventana: e.target.value,
              }))
            }
          />{" "}
          9:00 – 12:00
        </label>

        <label>
          <input
            type="radio"
            value="15-18"
            checked={pedido.ventana === "15-18"}
            onChange={(e) =>
              setPedido((prev) => ({
                ...prev,
                ventana: e.target.value,
              }))
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
          className="bg-[#7a5c3e] text-white px-6 py-3 rounded-xl"
        >
          Continuar
        </button>
      </div>
    </>
  );
}

/* =========================
   PASO 5
========================= */

function PasoConfirmacion({
  total,
  back,
}: {
  total: number;
  back: () => void;
}) {
  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Confirmar pedido
      </h2>

      <p className="text-center mb-6">
        Total a pagar: ${total}
      </p>

      <div className="flex justify-between">
        <button onClick={back} className="text-neutral-500">
          Atrás
        </button>

        <button className="bg-[#7a5c3e] text-white px-6 py-3 rounded-xl">
          Pagar ahora
        </button>
      </div>
    </>
  );
}