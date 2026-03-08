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

export type ColoniasResponse = {
  success: boolean;
  colonias: string[];
  message?: string;
};

export type PromoResponse = {
  success: boolean;
  promo: {
    promoId: string;
    nombre: string;
    descripcion: string;
    tipo: "NONE" | "PERCENT";
    valor: number;
    telefono: string;
  } | null;
  message?: string;
};
