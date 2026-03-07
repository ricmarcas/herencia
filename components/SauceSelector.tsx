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
      <h2 className="mb-2 text-center text-2xl font-semibold">Salsas (300ml)</h2>
      <p className="mb-6 text-center text-sm text-neutral-600">Maximo {max} salsas en total</p>

      {items.map((item) => (
        <div key={item.key} className="mb-4 flex items-center justify-between">
          <div>
            <p>{item.label}</p>
            <p className="text-sm">${item.precio}</p>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onChangeSauce(item.key, item.value - 1)}>
              -
            </button>
            <span>{item.value}</span>
            <button type="button" onClick={() => onChangeSauce(item.key, item.value + 1)}>
              +
            </button>
          </div>
        </div>
      ))}

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
