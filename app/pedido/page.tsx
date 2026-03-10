"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckoutHeader } from "@/components/CheckoutHeader";
import { DeliveryDate } from "@/components/DeliveryDate";
import { OrderSummary } from "@/components/OrderSummary";
import { ProductSelector } from "@/components/ProductSelector";
import { SauceSelector } from "@/components/SauceSelector";
import { useCheckout } from "@/features/checkout/useCheckout";
import type { CheckoutState, Totales } from "@/types/pedido";
import type { PreciosCatalogo } from "@/types/producto";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

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

function PromoLookup({
  telefono,
  promoMessage,
  isLoading,
  onTelefonoChange,
  onValidatePromo,
}: {
  telefono: string;
  promoMessage: string;
  isLoading: boolean;
  onTelefonoChange: (value: string) => void;
  onValidatePromo: () => Promise<boolean>;
}) {
  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="mb-2 text-sm font-medium text-amber-900">Tienes promociones por recompra?</p>
      <p className="mb-3 text-xs text-amber-900">Valida tu celular para aplicar descuento antes de continuar.</p>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          value={telefono}
          onChange={(event) => onTelefonoChange(event.target.value)}
          inputMode="numeric"
          maxLength={10}
          placeholder="Celular (10 digitos)"
          className="rounded-xl border px-4 py-2"
        />
        <button
          type="button"
          onClick={() => onValidatePromo()}
          disabled={isLoading}
          className="rounded-xl bg-amber-700 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Validando" : "Aplicar"}
        </button>
      </div>

      {promoMessage ? <p className="mt-2 text-xs text-amber-900">{promoMessage}</p> : null}
    </div>
  );
}

function ConfirmationStep({
  totals,
  precios,
  pedido,
  onBack,
  onNext,
}: {
  totals: Totales;
  precios: PreciosCatalogo;
  pedido: CheckoutState["pedido"];
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <p className="mb-3 text-sm text-neutral-600">Revisa el detalle de tu pedido antes de continuar a datos de entrega.</p>

      <div className="mb-6 rounded-xl border p-4 text-sm">
        <div className="mb-2 flex justify-between">
          <span>Barbacoa ({pedido.kilos} kg)</span>
          <span>${totals.totalBarbacoa}</span>
        </div>

        {pedido.verde > 0 ? (
          <div className="mb-1 flex justify-between text-neutral-700">
            <span>Salsa Verde (300ml) x{pedido.verde} (${precios.verde} c/u)</span>
            <span>${pedido.verde * precios.verde}</span>
          </div>
        ) : null}

        {pedido.roja > 0 ? (
          <div className="mb-1 flex justify-between text-neutral-700">
            <span>Salsa Roja (300ml) x{pedido.roja} (${precios.roja} c/u)</span>
            <span>${pedido.roja * precios.roja}</span>
          </div>
        ) : null}

        {pedido.chilePasado > 0 ? (
          <div className="mb-1 flex justify-between text-neutral-700">
            <span>Salsa Chile Pasado (300ml) x{pedido.chilePasado} (${precios.chilePasado} c/u)</span>
            <span>${pedido.chilePasado * precios.chilePasado}</span>
          </div>
        ) : null}

        <div className="mt-3 border-t pt-2">
          <div className="flex justify-between">
            <span>Subtotal productos</span>
            <span>${totals.subtotal}</span>
          </div>
          {totals.descuento > 0 ? (
            <div className="flex justify-between text-green-700">
              <span>Descuento promocion</span>
              <span>-${totals.descuento}</span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span>Envio</span>
            <span>${totals.envioFinal}</span>
          </div>
          <div className="mt-2 flex justify-between font-semibold">
            <span>Total</span>
            <span>${totals.total}</span>
          </div>
        </div>
      </div>

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
  const emailHasContent = email.trim().length > 0;
  const emailInvalid = emailHasContent && !isValidEmail(email);

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
        className={`mb-1 w-full rounded-xl border px-4 py-3 ${emailInvalid ? "border-red-500" : ""}`}
      />
      {emailInvalid ? <p className="mb-3 text-xs text-red-600">Formato de email invalido.</p> : <div className="mb-3" />}

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
        {state.step === 1 ? (
          <div className="mb-6 overflow-hidden rounded-2xl border border-neutral-200">
            <video
              src="/videos/barbacoa.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="h-48 w-full object-cover"
            />
          </div>
        ) : null}

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
          <>
            <PromoLookup
              telefono={state.promoLookupPhone}
              promoMessage={state.promoMessage}
              isLoading={state.isPromoLoading}
              onTelefonoChange={actions.setPromoLookupPhone}
              onValidatePromo={actions.validateCustomerPromo}
            />
            <ProductSelector
              kilos={state.pedido.kilos}
              maxKilos={state.maxKilos}
            envio={state.pedido.envio}
            onSelectKilos={actions.setKilos}
            onBack={actions.backStep}
            onNext={actions.nextStep}
            onSpecialOrder={() => router.push(`/pedido-especial?cp=${state.pedido.cp}`)}
          />
        </>
      ) : null}

        {state.step === 3 ? (
          <SauceSelector
            verde={state.pedido.verde}
            roja={state.pedido.roja}
            chilePasado={state.pedido.chilePasado}
            precios={state.precios}
            available={state.saucesStock}
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
          <ConfirmationStep
            totals={totals}
            precios={state.precios}
            pedido={state.pedido}
            onBack={actions.backStep}
            onNext={actions.nextStep}
          />
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

        {state.step > 1 && state.step !== 5 ? <OrderSummary envio={totals.envioFinal} totals={totals} /> : null}
      </div>
    </main>
  );
}
