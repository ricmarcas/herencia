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

export type SauceStockResponse = {
  success: boolean;
  verde: boolean;
  roja: boolean;
  chilePasado: boolean;
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

export type SampleRequestResponse = {
  success: boolean;
  alreadyRegistered: boolean;
  message: string;
};

export type ValidateNpsOfferResponse = {
  success: boolean;
  eligible: boolean;
  discountPercent?: number;
  expiresAt?: string;
  message?: string;
  profile?: {
    nombre: string;
    email: string;
    telefono: string;
    cp: string;
    colonia: string;
    calle: string;
    numeroExterior: string;
    numeroInterior: string;
  };
};
