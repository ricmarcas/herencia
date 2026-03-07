import type { CheckoutStep } from "@/types/pedido";

type CheckoutHeaderProps = {
  step: CheckoutStep;
};

export function CheckoutHeader({ step }: CheckoutHeaderProps) {
  const etapa = step <= 4 ? 1 : step === 5 ? 2 : 3;

  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-center">
        <div className="flex-1">
          <div className={`h-2 rounded ${etapa >= 1 ? "bg-[#7a5c3e]" : "bg-gray-200"}`} />
          <p className="mt-1">Orden</p>
        </div>

        <div className="mx-2 flex-1">
          <div className={`h-2 rounded ${etapa >= 2 ? "bg-[#7a5c3e]" : "bg-gray-200"}`} />
          <p className="mt-1">Envio</p>
        </div>

        <div className="flex-1">
          <div className={`h-2 rounded ${etapa >= 3 ? "bg-[#7a5c3e]" : "bg-gray-200"}`} />
          <p className="mt-1">Pago</p>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-neutral-500">Paso {step} de 7</p>
    </div>
  );
}
