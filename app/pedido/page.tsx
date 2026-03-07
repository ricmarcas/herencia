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
      <p className="mb-3 text-sm text-neutral-600">Ingresa tu codigo postal para validar cobertura.</p>

      <input
        value={cp}
        onChange={(event) => setCp(event.target.value.replace(/\D/g, "").slice(0, 5))}
        placeholder="Ej. 03020"
        inputMode="numeric"
        className="mb-6 w-full rounded-xl border px-4 py-3"
      />

      <button
        type="button"
        onClick={() => onValidate(cp)}
        disabled={isLoading || cp.trim().length !== 5}
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
  cp,
  nombre,
  email,
  telefono,
  calle,
  numeroExterior,
  numeroInterior,
  colonia,
  coloniasDisponibles,
  onNombreChange,
  onEmailChange,
  onTelefonoChange,
  onCalleChange,
  onNumeroExteriorChange,
  onNumeroInteriorChange,
  onColoniaChange,
  onBack,
  onNext,
}: {
  cp: string;
  nombre: string;
  email: string;
  telefono: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  colonia: string;
  coloniasDisponibles: string[];
  onNombreChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onTelefonoChange: (value: string) => void;
  onCalleChange: (value: string) => void;
  onNumeroExteriorChange: (value: string) => void;
  onNumeroInteriorChange: (value: string) => void;
  onColoniaChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <p className="mb-4 text-sm text-neutral-600">Comparte tus datos de entrega para continuar al pago.</p>

      <input
        value={telefono}
        onChange={(event) => onTelefonoChange(event.target.value)}
        placeholder="Telefono celular (10 digitos)"
        inputMode="numeric"
        maxLength={10}
        className="mb-4 w-full rounded-xl border px-4 py-3"
      />

      <input
        value={nombre}
        onChange={(event) => onNombreChange(event.target.value)}
        placeholder="Nombre de quien recibe"
        className="mb-4 w-full rounded-xl border px-4 py-3"
      />

      <input
        type="email"
        value={email}
        onChange={(event) => onEmailChange(event.target.value)}
        placeholder="Email para confirmaciones"
        className="mb-4 w-full rounded-xl border px-4 py-3"
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <input value={cp} readOnly className="rounded-xl border bg-neutral-100 px-4 py-3 text-neutral-700" />

        <input
          value={numeroExterior}
          onChange={(event) => onNumeroExteriorChange(event.target.value)}
          placeholder="Numero exterior"
          className="rounded-xl border px-4 py-3"
        />
      </div>

      <div className="mb-4">
        <input
          value={calle}
          onChange={(event) => onCalleChange(event.target.value)}
          placeholder="Calle"
          className="w-full rounded-xl border px-4 py-3"
        />
      </div>

      <div className="mb-4">
        <select
          value={coloniasDisponibles.includes(colonia) ? colonia : ""}
          onChange={(event) => onColoniaChange(event.target.value)}
          className="w-full rounded-xl border px-4 py-3"
        >
          <option value="">Selecciona colonia</option>
          {coloniasDisponibles.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <input
          value={coloniasDisponibles.includes(colonia) ? "" : colonia}
          onChange={(event) => onColoniaChange(event.target.value)}
          placeholder="Si no aparece tu colonia, escribela aqui"
          className="w-full rounded-xl border px-4 py-3"
        />
      </div>

      <div className="mb-6">
        <input
          value={numeroInterior}
          onChange={(event) => onNumeroInteriorChange(event.target.value)}
          placeholder="Numero interior (opcional)"
          className="w-full rounded-xl border px-4 py-3"
        />
      </div>

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
  const { state, totals, dateRange, coloniasDisponibles, actions } = useCheckout();

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
            minDate={dateRange.minDate}
            maxDate={dateRange.maxDate}
            onFechaChange={actions.setFecha}
            onBack={actions.backStep}
            onNext={actions.nextStep}
          />
        ) : null}

        {state.step === 5 ? (
          <ConfirmationStep total={totals.total} onBack={actions.backStep} onNext={actions.nextStep} />
        ) : null}

        {state.step === 6 ? (
          <ShippingStep
            cp={state.pedido.cp}
            nombre={state.envioDatos.nombre}
            email={state.envioDatos.email}
            telefono={state.envioDatos.telefono}
            calle={state.envioDatos.calle}
            numeroExterior={state.envioDatos.numeroExterior}
            numeroInterior={state.envioDatos.numeroInterior}
            colonia={state.envioDatos.colonia}
            coloniasDisponibles={coloniasDisponibles}
            onNombreChange={actions.setNombre}
            onEmailChange={actions.setEmail}
            onTelefonoChange={actions.setTelefono}
            onCalleChange={actions.setCalle}
            onNumeroExteriorChange={actions.setNumeroExterior}
            onNumeroInteriorChange={actions.setNumeroInterior}
            onColoniaChange={actions.setColonia}
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
