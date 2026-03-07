import type { PreciosCatalogo } from "./producto";

export type CheckoutStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SauceKey = "verde" | "roja" | "chilePasado";

export type PedidoPayload = {
  cp: string;
  envio: number;
  kilos: number;
  verde: number;
  roja: number;
  chilePasado: number;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  calle: string;
  colonia: string;
  numeroExterior: string;
  numeroInterior: string;
  fecha: string;
  ventana: string;
};

export type DatosEnvio = {
  nombre: string;
  email: string;
  telefono: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  colonia: string;
};

export type CheckoutState = {
  step: CheckoutStep;
  pedido: PedidoPayload;
  envioDatos: DatosEnvio;
  precios: PreciosCatalogo;
  maxKilos: number;
  coloniasDisponibles: string[];
  productosCargados: boolean;
  zoneMessage: string;
  error: string;
  isLoading: boolean;
  isPaying: boolean;
};

export type Totales = {
  totalBarbacoa: number;
  totalSalsas: number;
  total: number;
};
