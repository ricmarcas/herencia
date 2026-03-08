import type { SauceKey } from "@/types/pedido";
import type { PreciosCatalogo } from "@/types/producto";

type SauceSelectorProps = {
  kilos: number;
  verde: number;
  roja: number;
  chilePasado: number;
  precios: PreciosCatalogo;
  onChangeSauce: (sauce: SauceKey, value: number) => void;
  onBack: () => void;
  onNext: () => void;
};

export function SauceSelector({
  kilos,
  verde,
  roja,
  chilePasado,
  precios,
  onChangeSauce,
  onBack,
  onNext,
}: SauceSelectorProps) {
  const max = kilos * 3;

  const items: Array<{ label: string; key: SauceKey; value: number; precio: number }> = [
    { label: "Salsa Verde", key: "verde", value: verde, precio: precios.verde },
    { label: "Salsa Roja", key: "roja", value: roja, precio: precios.roja },
    { label: "Salsa de Chile Pasado", key: "chilePasado", value: chilePasado, precio: precios.chilePasado },
  ];

  return (
    <>
      <p className="mb-6 text-sm text-neutral-700">Selecciona hasta {max} salsas en total.</p>

      {items.map((item) => (
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
