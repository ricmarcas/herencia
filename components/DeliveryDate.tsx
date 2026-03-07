type DeliveryDateProps = {
  fecha: string;
  minDate: string;
  maxDate: string;
  onFechaChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
};

export function DeliveryDate({ fecha, minDate, maxDate, onFechaChange, onBack, onNext }: DeliveryDateProps) {
  return (
    <>
      <p className="mb-4 text-sm text-neutral-600">Selecciona una fecha de entrega.</p>

      <input
        type="date"
        value={fecha}
        min={minDate}
        max={maxDate}
        onChange={(event) => onFechaChange(event.target.value)}
        className="mb-2 w-full rounded-xl border px-4 py-3"
      />

      <p className="mb-6 text-xs text-neutral-500">Disponible del {minDate} al {maxDate}.</p>

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
