"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/* =========================
TIPOS
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

type ProductoAPI = {
  nombre: string;
  presentacion: string;
  precio: number;
};

type ValidateZoneResponse = {
  success: boolean;
  envio: number;
};

type MaxInventoryResponse = {
  success: boolean;
  maxKilos: number;
};

type CheckoutResponse = {
  success: boolean;
  url?: string;
  message?: string;
};

/* =========================
PAGE
========================= */

export default function PedidoPage() {

  const router = useRouter();

  const [step, setStep] = useState(1);

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

  const [productosCargados, setProductosCargados] = useState(false);

  /* =========================
  CARGAR PRODUCTOS
  ========================= */

  const cargarProductos = async () => {

    const res = await fetch("/api/productos");
    const data = await res.json() as { success: boolean; productos: ProductoAPI[] };

    if (!data.success) return;

    const lista = data.productos;

    const buscar = (nombre: string) =>
      lista.find(p => p.nombre === nombre)?.precio || 0;

    setPrecios({
      barbacoa: buscar("Barbacoa"),
      verde: buscar("Salsa Verde"),
      roja: buscar("Salsa Roja"),
      chilePasado: buscar("Salsa de Chile Pasado"),
    });

    setProductosCargados(true);
  };

  /* =========================
  TOTALES
  ========================= */

  const totalBarbacoa = pedido.kilos * precios.barbacoa;

  const totalSalsas =
    pedido.verde * precios.verde +
    pedido.roja * precios.roja +
    pedido.chilePasado * precios.chilePasado;

  const total = totalBarbacoa + totalSalsas + pedido.envio;

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => s - 1);

  return (
    <main className="min-h-screen bg-[#f5f1e8] flex items-center justify-center px-4 py-12">

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">

        <div className="text-sm text-neutral-500 mb-6 text-center">
          Paso {step} de 5
        </div>

        {step === 1 && (
          <PasoCodigoPostal
            setPedido={setPedido}
            next={next}
            cargarProductos={cargarProductos}
          />
        )}

        {step === 2 && productosCargados && (
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
          <PasoConfirmacion
            pedido={pedido}
            total={total}
            back={back}
          />
        )}

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
PASO 1
========================= */

type Paso1Props = {
  setPedido: React.Dispatch<React.SetStateAction<Pedido>>;
  next: () => void;
  cargarProductos: () => Promise<void>;
};

function PasoCodigoPostal({
  setPedido,
  next,
  cargarProductos,
}: Paso1Props) {

  const [cpInput, setCpInput] = useState("");
  const [mensaje, setMensaje] = useState("");

  const validar = async () => {

    const res = await fetch("/api/validate-zone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ cp: cpInput })
    });

    const data = await res.json() as ValidateZoneResponse;

    if (!data.success) {
      setMensaje("Aún no entregamos en tu zona.");
      return;
    }

    setPedido(prev => ({
      ...prev,
      cp: cpInput,
      envio: data.envio,
    }));

    setMensaje(
      data.envio === 0
        ? "✅ Entregamos en tu zona – Envío GRATIS"
        : `✅ Entregamos en tu zona – Envío $${data.envio}`
    );

    await cargarProductos();

    next();
  };

  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Código Postal
      </h2>

      <input
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
PASO 2
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

  const [maxKilos, setMaxKilos] = useState<number>(4);

  useEffect(() => {

    const consultarInventario = async () => {

      const res = await fetch("/api/max-inventory");
      const data = await res.json() as MaxInventoryResponse;

      if (data.success) {
        setMaxKilos(data.maxKilos);
      }

    };

    consultarInventario();

  }, []);

  const todasOpciones = [1,1.5,2,2.5,3,3.5,4];
  const opciones = todasOpciones.filter(k => k <= maxKilos);

  return (
    <>
      <h2 className="text-2xl font-semibold mb-4 text-center">
        Selecciona kilos
      </h2>

      <p className="text-sm text-center text-neutral-600 mb-4">
        {pedido.envio === 0
          ? "Envío GRATIS"
          : `Envío $${pedido.envio}`}
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">

        {opciones.map(kg => (

          <button
            key={kg}
            onClick={() =>
              setPedido(prev => {

                const maxSalsas = kg * 3;

                return {
                  ...prev,
                  kilos: kg,
                  verde: Math.min(prev.verde, maxSalsas),
                  roja: Math.min(prev.roja, maxSalsas),
                  chilePasado: Math.min(prev.chilePasado, maxSalsas),
                };

              })
            }
            className={`py-3 rounded-xl border ${
              pedido.kilos === kg
                ? "bg-[#7a5c3e] text-white"
                : ""
            }`}
          >
            {kg} kg
          </button>

        ))}

      </div>

      <button
        onClick={() => router.push("/pedido-especial")}
        className="text-sm underline mb-6"
      >
        ¿Más de 4 kg? Pedido especial
      </button>

      <div className="flex justify-between">

        <button onClick={back}>
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
PASO 3
========================= */

type SalsaKey = "verde" | "roja" | "chilePasado";

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

  const cambiar = (tipo: SalsaKey, valor: number) => {

    if (valor < 0) return;
    if (valor > max) valor = max;

    setPedido(prev => ({ ...prev, [tipo]: valor }));

  };

  const salsas = [
    { nombre:"Salsa Verde", key:"verde" as SalsaKey, precio:precios.verde },
    { nombre:"Salsa Roja", key:"roja" as SalsaKey, precio:precios.roja },
    { nombre:"Salsa de Chile Pasado", key:"chilePasado" as SalsaKey, precio:precios.chilePasado },
  ];

  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Salsas (300ml)
      </h2>

      {salsas.map(salsa => {

        const value = pedido[salsa.key];

        return (

          <div key={salsa.key} className="flex justify-between mb-4">

            <div>
              <p>{salsa.nombre}</p>
              <p className="text-sm">${salsa.precio}</p>
            </div>

            <div className="flex gap-2 items-center">

              <button onClick={()=>cambiar(salsa.key,value-1)}>
                -
              </button>

              <span>{value}</span>

              <button onClick={()=>cambiar(salsa.key,value+1)}>
                +
              </button>

            </div>

          </div>

        );

      })}

      <div className="flex justify-between">

        <button onClick={back}>Atrás</button>

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
PASO 4
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
        onChange={(e)=>
          setPedido(prev=>({
            ...prev,
            fecha:e.target.value
          }))
        }
        className="w-full border rounded-xl px-4 py-3 mb-6"
      />

      <div className="mb-6">

        <label className="block mb-2">

          <input
            type="radio"
            value="9-12"
            checked={pedido.ventana==="9-12"}
            onChange={(e)=>
              setPedido(prev=>({
                ...prev,
                ventana:e.target.value
              }))
            }
          />

          9:00 – 12:00

        </label>

        <label>

          <input
            type="radio"
            value="15-18"
            checked={pedido.ventana==="15-18"}
            onChange={(e)=>
              setPedido(prev=>({
                ...prev,
                ventana:e.target.value
              }))
            }
          />

          15:00 – 18:00

        </label>

      </div>

      <div className="flex justify-between">

        <button onClick={back}>
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
  pedido,
  total,
  back,
}: {
  pedido: Pedido;
  total: number;
  back: () => void;
}) {

  const [loading,setLoading]=useState(false);

  const pagar = async () => {

    try {

      setLoading(true);

      const res = await fetch("/api/create-checkout-session",{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify(pedido)
      });

      const data = await res.json() as CheckoutResponse;

      if(!data.success){
        alert(data.message || "Error creando pago");
        setLoading(false);
        return;
      }

      if(data.url){
        window.location.href = data.url;
      }

    } catch (error) {

      console.error(error);
      alert("Error conectando con Stripe");
      setLoading(false);

    }

  };

  return (
    <>
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Confirmar pedido
      </h2>

      <p className="text-center mb-6">
        Total a pagar: ${total}
      </p>

      <div className="flex justify-between">

        <button onClick={back}>
          Atrás
        </button>

        <button
          onClick={pagar}
          disabled={loading}
          className="bg-[#7a5c3e] text-white px-6 py-3 rounded-xl"
        >
          {loading ? "Procesando..." : "Pagar ahora"}
        </button>

      </div>
    </>
  );
}