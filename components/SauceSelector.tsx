import type { SauceKey } from "@/types/pedido";
import type { PreciosCatalogo } from "@/types/producto";

type SauceSelectorProps = {
  verde: number;
  roja: number;
  chilePasado: number;
  precios: PreciosCatalogo;
  available: {
    verde: boolean;
    roja: boolean;
    chilePasado: boolean;
  };
  onChangeSauce: (sauce: SauceKey, value: number) => void;
  onBack: () => void;
  onNext: () => void;
};

export function SauceSelector({
  verde,
  roja,
  chilePasado,
  precios,
  available,
  onChangeSauce,
  onBack,
  onNext,
}: SauceSelectorProps) {
  const items: Array<{ label: string; key: SauceKey; value: number; precio: number }> = [
    { label: "Salsa Verde (300ml)", key: "verde", value: verde, precio: precios.verde },
    { label: "Salsa Roja (300ml)", key: "roja", value: roja, precio: precios.roja },
    { label: "Salsa de Chile Pasado (300ml)", key: "chilePasado", value: chilePasado, precio: precios.chilePasado },
  ];

  return (
    <>
      <p className="mb-6 text-sm text-neutral-700">
        Recomendamos 300ml de salsa por cada kilo de barbacoa.
      </p>

      {items
        .filter((item) => available[item.key])
        .map((item) => (
        <div key={item.key} className="mb-4 rounded-xl border border-neutral-300 bg-white p-3">
          <div className="mb-2">
            <p className="font-medium text-neutral-900">{item.label}</p>
            <p className="text-sm text-neutral-700">${item.precio}</p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onChangeSauce(item.key, item.value - 1)}
              className="h-9 w-9 rounded-full border-2 border-neutral-500 bg-white text-lg font-semibold text-neutral-900"
            >
              -
            </button>
            <span className="min-w-8 text-center text-lg font-semibold text-neutral-900">{item.value}</span>
            <button
              type="button"
              onClick={() => onChangeSauce(item.key, item.value + 1)}
              className="h-9 w-9 rounded-full border-2 border-[#5e452e] bg-[#7a5c3e] text-lg font-semibold text-white"
            >
              +
            </button>
          </div>
        </div>
      ))}

      {!available.verde && !available.roja && !available.chilePasado ? (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Por el momento no hay salsas disponibles.
        </p>
      ) : null}

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
