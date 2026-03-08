import type { Producto } from "./producto";
import type { PromoRule } from "./pedido";

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

export type ValidateInventoryResponse = {
  success: boolean;
  message?: string;
};

export type CheckoutResponse = {
  success: boolean;
  url?: string;
  message?: string;
};

export type ColoniasResponse = {
  success: boolean;
  colonias: string[];
  message?: string;
};

export type PromoResponse = {
  success: boolean;
  promociones: PromoRule[];
  telefono: string;
  message?: string;
};
