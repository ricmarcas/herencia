import type { PreciosCatalogo } from "./producto";

export type CheckoutStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SauceKey = "verde" | "roja" | "chilePasado";
export type PromoType = "PERCENT" | "FREE_SHIPPING" | "FIXED";

export type PromoRule = {
  promoId: string;
  nombre: string;
  descripcion: string;
  tipo: PromoType;
  valor: number;
  minCompras: number;
  minTotalPedido: number;
  combinable: boolean;
  prioridad: number;
};

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
  promoId: string;
  promoTipo: "NONE" | PromoType | "MULTI";
  promoValor: number;
  descuento: number;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  gclid: string;
  landingPath: string;
  referrer: string;
  attributionModel: "last_touch";
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
  saucesStock: {
    verde: boolean;
    roja: boolean;
    chilePasado: boolean;
  };
  coloniasDisponibles: string[];
  productosCargados: boolean;
  zoneMessage: string;
  error: string;
  isLoading: boolean;
  isPaying: boolean;
  promoLookupPhone: string;
  promoMessage: string;
  isPromoLoading: boolean;
  promo: {
    phone: string;
    promociones: PromoRule[];
  } | null;
};

export type Totales = {
  totalBarbacoa: number;
  totalSalsas: number;
  subtotal: number;
  descuento: number;
  envioFinal: number;
  appliedPromos: PromoRule[];
  total: number;
};
