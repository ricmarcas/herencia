import type { Totales } from "@/types/pedido";

type ProductSelectorProps = {
  kilos: number;
  maxKilos: number;
  envio: number;
  totals: Totales;
  promoMessage: string;
  isPromoLoading: boolean;
  onSelectKilos: (kilos: number) => void;
  onBack: () => void;
  onNext: () => void;
  onSpecialOrder: () => void;
};

export function ProductSelector({
  kilos,
  maxKilos,
  envio,
  totals,
  promoMessage,
  isPromoLoading,
  onSelectKilos,
  onBack,
  onNext,
  onSpecialOrder,
}: ProductSelectorProps) {
  const baseOptions = [1, 1.5, 2, 2.5, 3, 3.5, 4];
  const options = baseOptions.filter((value) => value <= maxKilos);

  return (
    <>
      <p className="mb-4 text-sm text-neutral-700">Elige la cantidad de barbacoa.</p>

      <p className="mb-4 rounded-lg bg-amber-50 py-2 text-center text-sm font-medium text-amber-900">
        {envio === 0 ? "Envio GRATIS" : `Envio $${envio}`}
      </p>

      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
        <div className="flex justify-between">
          <span>Subtotal barbacoa</span>
          <span>${totals.totalBarbacoa}</span>
        </div>
        {totals.descuento > 0 ? (
          <div className="mt-1 flex justify-between font-medium text-green-700">
            <span>Descuento aplicado</span>
            <span>-${totals.descuento}</span>
          </div>
        ) : null}
        <div className="mt-1 flex justify-between">
          <span>Envio</span>
          <span>${totals.envioFinal}</span>
        </div>
        <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
          <span>Total parcial</span>
          <span>${totals.total}</span>
        </div>
      </div>

      {promoMessage ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {isPromoLoading ? "Validando promocion..." : promoMessage}
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-3 gap-3">
        {options.map((value) => {
          const isSelected = kilos === value;

          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelectKilos(value)}
              className={`rounded-xl border-2 py-3 text-sm font-semibold transition ${
                isSelected
                  ? "border-[#5e452e] bg-[#7a5c3e] text-white"
                  : "border-neutral-400 bg-white text-neutral-900 active:bg-neutral-100"
              }`}
            >
              {value} kg
            </button>
          );
        })}
      </div>

      <button type="button" onClick={onSpecialOrder} className="mb-6 text-sm font-medium text-[#5e452e] underline">
        Mas de 4 kg? Pedido especial
      </button>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="font-medium text-neutral-700">
          Atras
        </button>

        <button type="button" onClick={onNext} className="rounded-xl bg-[#7a5c3e] px-6 py-3 font-semibold text-white">
          Continuar
        </button>
      </div>
    </>
  );
}
