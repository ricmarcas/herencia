"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckoutHeader } from "@/components/CheckoutHeader";
import { DeliveryDate } from "@/components/DeliveryDate";
import { OrderSummary } from "@/components/OrderSummary";
import { ProductSelector } from "@/components/ProductSelector";
import { SauceSelector } from "@/components/SauceSelector";
import { useCheckout } from "@/features/checkout/useCheckout";

function PostalCodeStep({
  onValidate,
  isLoading,
  message,
}: {
  onValidate: (cp: string) => Promise<boolean>;
  isLoading: boolean;
  message: string;
}) {
  const [cp, setCp] = useState("");

  return (
    <>
      <h2 className="mb-6 text-center text-2xl font-semibold">Codigo Postal</h2>

      <input
        value={cp}
        onChange={(event) => setCp(event.target.value)}
        placeholder="Ej. 03020"
        className="mb-6 w-full rounded-xl border px-4 py-3"
      />

      <button
        type="button"
        onClick={() => onValidate(cp)}
        disabled={isLoading || cp.trim().length === 0}
        className="w-full rounded-xl bg-[#7a5c3e] py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Validando..." : "Validar zona"}
      </button>

      {message ? <p className="mt-4 text-center text-sm text-neutral-600">{message}</p> : null}
    </>
  );
}

function ConfirmationStep({ total, onBack, onNext }: { total: number; onBack: () => void; onNext: () => void }) {
  return (
    <>
      <h2 className="mb-6 text-center text-2xl font-semibold">Confirmar pedido</h2>
      <p className="mb-6 text-center">Total a pagar: ${total}</p>

      <div className="flex justify-between">
        <button type="button" onClick={onBack}>
          Atras
        </button>

        <button type="button" onClick={onNext} className="rounded-xl bg-[#7a5c3e] px-6 py-3 text-white">
          Continuar
        </button>
      </div>
    </>
  );
}

function ShippingStep({
  telefono,
  direccion,
  onTelefonoChange,
  onDireccionChange,
  onBack,
  onNext,
}: {
  telefono: string;
  direccion: string;
  onTelefonoChange: (value: string) => void;
  onDireccionChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <h2 className="mb-6 text-center text-2xl font-semibold">Datos de entrega</h2>

      <input
        value={telefono}
        onChange={(event) => onTelefonoChange(event.target.value)}
        placeholder="Telefono"
        className="mb-4 w-full rounded-xl border px-4 py-3"
      />

      <textarea
        value={direccion}
        onChange={(event) => onDireccionChange(event.target.value)}
        placeholder="Direccion completa"
        className="mb-6 w-full rounded-xl border px-4 py-3"
      />

      <div className="flex justify-between">
        <button type="button" onClick={onBack}>
          Atras
        </button>

        <button type="button" onClick={onNext} className="rounded-xl bg-[#7a5c3e] px-6 py-3 text-white">
          Continuar al pago
        </button>
      </div>
    </>
  );
}

function PaymentStep({
  total,
  isPaying,
  onBack,
  onPay,
}: {
  total: number;
  isPaying: boolean;
  onBack: () => void;
  onPay: () => Promise<void>;
}) {
  return (
    <>
      <h2 className="mb-6 text-center text-2xl font-semibold">Pago</h2>
      <p className="mb-6 text-center">Total a pagar: ${total}</p>

      <div className="flex justify-between">
        <button type="button" onClick={onBack}>
          Atras
        </button>

        <button
          type="button"
          onClick={onPay}
          disabled={isPaying}
          className="rounded-xl bg-[#7a5c3e] px-6 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPaying ? "Procesando..." : "Pagar ahora"}
        </button>
      </div>
    </>
  );
}

export default function PedidoPage() {
  const router = useRouter();
  const { state, totals, actions } = useCheckout();

  const goToPayment = async () => {
    const url = await actions.startPayment();
    if (url) {
      window.location.href = url;
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-4 py-12">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <CheckoutHeader step={state.step} />

        {state.error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}

        {state.step === 1 ? (
          <PostalCodeStep
            onValidate={actions.validateAndLoadZone}
            isLoading={state.isLoading}
            message={state.zoneMessage}
          />
        ) : null}

        {state.step === 2 && state.productosCargados ? (
          <ProductSelector
            kilos={state.pedido.kilos}
            maxKilos={state.maxKilos}
            envio={state.pedido.envio}
            onSelectKilos={actions.setKilos}
            onBack={actions.backStep}
            onNext={actions.nextStep}
            onSpecialOrder={() => router.push("/pedido-especial")}
          />
        ) : null}

        {state.step === 3 ? (
          <SauceSelector
            kilos={state.pedido.kilos}
            verde={state.pedido.verde}
            roja={state.pedido.roja}
            chilePasado={state.pedido.chilePasado}
            precios={state.precios}
            onChangeSauce={actions.setSauce}
            onBack={actions.backStep}
            onNext={actions.nextStep}
          />
        ) : null}

        {state.step === 4 ? (
          <DeliveryDate
            fecha={state.pedido.fecha}
            ventana={state.pedido.ventana}
            onFechaChange={actions.setFecha}
            onVentanaChange={actions.setVentana}
            onBack={actions.backStep}
            onNext={actions.nextStep}
          />
        ) : null}

        {state.step === 5 ? (
          <ConfirmationStep total={totals.total} onBack={actions.backStep} onNext={actions.nextStep} />
        ) : null}

        {state.step === 6 ? (
          <ShippingStep
            telefono={state.envioDatos.telefono}
            direccion={state.envioDatos.direccion}
            onTelefonoChange={actions.setTelefono}
            onDireccionChange={actions.setDireccion}
            onBack={actions.backStep}
            onNext={actions.nextStep}
          />
        ) : null}

        {state.step === 7 ? (
          <PaymentStep total={totals.total} isPaying={state.isPaying} onBack={actions.backStep} onPay={goToPayment} />
        ) : null}

        {state.step > 1 ? <OrderSummary envio={state.pedido.envio} totals={totals} /> : null}
      </div>
    </main>
  );
}
