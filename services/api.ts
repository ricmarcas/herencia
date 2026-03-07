import type {
  CheckoutResponse,
  ColoniasResponse,
  MaxInventoryResponse,
  ProductosResponse,
  ValidateZoneResponse,
} from "@/types/api";
import type { PedidoPayload } from "@/types/pedido";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error("Error de red en API");
  }
  return (await response.json()) as T;
}

export async function validateZone(cp: string): Promise<ValidateZoneResponse> {
  const response = await fetch("/api/validate-zone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cp }),
  });

  return parseJson<ValidateZoneResponse>(response);
}

export async function getProductos(): Promise<ProductosResponse> {
  const response = await fetch("/api/productos");
  return parseJson<ProductosResponse>(response);
}

export async function getMaxInventory(): Promise<MaxInventoryResponse> {
  const response = await fetch("/api/max-inventory");
  return parseJson<MaxInventoryResponse>(response);
}

export async function getColonias(cp: string): Promise<ColoniasResponse> {
  const encodedCp = encodeURIComponent(cp);
  const response = await fetch(`/api/colonias?cp=${encodedCp}`);
  return parseJson<ColoniasResponse>(response);
}

export async function createCheckoutSession(pedido: PedidoPayload): Promise<CheckoutResponse> {
  const response = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pedido),
  });

  return parseJson<CheckoutResponse>(response);
}
