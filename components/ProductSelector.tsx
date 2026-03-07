type ProductSelectorProps = {
  kilos: number;
  maxKilos: number;
  envio: number;
  onSelectKilos: (kilos: number) => void;
  onBack: () => void;
  onNext: () => void;
  onSpecialOrder: () => void;
};

export function ProductSelector({
  kilos,
  maxKilos,
  envio,
  onSelectKilos,
  onBack,
  onNext,
  onSpecialOrder,
}: ProductSelectorProps) {
  const baseOptions = [1, 1.5, 2, 2.5, 3, 3.5, 4];
  const options = baseOptions.filter((value) => value <= maxKilos);

  return (
    <>
      <h2 className="mb-4 text-center text-2xl font-semibold">Selecciona kilos</h2>

      <p className="mb-4 text-center text-sm text-neutral-600">
        {envio === 0 ? "Envio GRATIS" : `Envio $${envio}`}
      </p>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {options.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelectKilos(value)}
            className={`rounded-xl border py-3 ${kilos === value ? "bg-[#7a5c3e] text-white" : ""}`}
          >
            {value} kg
          </button>
        ))}
      </div>

      <button type="button" onClick={onSpecialOrder} className="mb-6 text-sm underline">
        Mas de 4 kg? Pedido especial
      </button>

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
