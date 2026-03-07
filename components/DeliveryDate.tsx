type DeliveryDateProps = {
  fecha: string;
  ventana: string;
  onFechaChange: (value: string) => void;
  onVentanaChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
};

export function DeliveryDate({
  fecha,
  ventana,
  onFechaChange,
  onVentanaChange,
  onBack,
  onNext,
}: DeliveryDateProps) {
  return (
    <>
      <h2 className="mb-6 text-center text-2xl font-semibold">Fecha de entrega</h2>

      <input
        type="date"
        value={fecha}
        onChange={(event) => onFechaChange(event.target.value)}
        className="mb-6 w-full rounded-xl border px-4 py-3"
      />

      <div className="mb-6">
        <label className="mb-2 block">
          <input
            type="radio"
            value="9-12"
            checked={ventana === "9-12"}
            onChange={(event) => onVentanaChange(event.target.value)}
          />
          <span className="ml-2">9:00 - 12:00</span>
        </label>

        <label>
          <input
            type="radio"
            value="15-18"
            checked={ventana === "15-18"}
            onChange={(event) => onVentanaChange(event.target.value)}
          />
          <span className="ml-2">15:00 - 18:00</span>
        </label>
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
