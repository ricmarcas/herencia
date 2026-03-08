import type { Totales } from "@/types/pedido";

type OrderSummaryProps = {
  envio: number;
  totals: Totales;
};

export function OrderSummary({ envio, totals }: OrderSummaryProps) {
  return (
    <div className="mt-8 space-y-1 border-t pt-6 text-sm">
      <p>Barbacoa: ${totals.totalBarbacoa}</p>
      <p>Salsas: ${totals.totalSalsas}</p>
      <p>Subtotal: ${totals.subtotal}</p>
      {totals.descuento > 0 ? <p className="text-green-700">Descuento: -${totals.descuento}</p> : null}
      <p>Envio: ${envio}</p>
      <hr />
      <p className="font-semibold">Total (IVA incluido): ${totals.total}</p>
    </div>
  );
}
