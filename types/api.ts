import type { Producto } from "./producto";

export type ValidateZoneResponse = {
  success: boolean;
  envio: number;
};

export type ProductosResponse = {
  success: boolean;
  productos: Producto[];
};

export type MaxInventoryResponse = {
  success: boolean;
  maxKilos: number;
};

export type CheckoutResponse = {
  success: boolean;
  url?: string;
  message?: string;
};
