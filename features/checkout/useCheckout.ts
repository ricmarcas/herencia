"use client";

import { useMemo, useReducer } from "react";
import {
  createCheckoutSession,
  getColonias,
  getMaxInventory,
  getProductos,
  getSauceStock,
  validateNpsOffer,
  validateInventory,
  validatePromo,
  validateZone,
} from "@/services/api";
import { getCheckoutAttributionFromStorage } from "@/lib/attribution";
import type { CheckoutStep, PedidoPayload, PromoRule, SauceKey, Totales } from "@/types/pedido";
import type { CheckoutState } from "@/types/pedido";
import type { PreciosCatalogo, Producto } from "@/types/producto";

const DEFAULT_DELIVERY_WINDOW = "SIN_VENTANA";

const initialState: CheckoutState = {
  step: 1,
  pedido: {
    cp: "",
    envio: 0,
    kilos: 1,
    verde: 0,
    roja: 0,
    chilePasado: 0,
    nombre: "",
    email: "",
    telefono: "",
    direccion: "",
    calle: "",
    colonia: "",
    numeroExterior: "",
    numeroInterior: "",
    fecha: "",
    ventana: DEFAULT_DELIVERY_WINDOW,
    promoId: "",
    promoTipo: "NONE",
    promoValor: 0,
    descuento: 0,
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmContent: "",
    utmTerm: "",
    gclid: "",
    landingPath: "",
    referrer: "",
    attributionModel: "last_touch",
    npsOfferToken: "",
  },
  envioDatos: {
    nombre: "",
    email: "",
    telefono: "",
    calle: "",
    numeroExterior: "",
    numeroInterior: "",
    colonia: "",
  },
  precios: {
    barbacoa: 0,
    verde: 0,
    roja: 0,
    chilePasado: 0,
  },
  maxKilos: 4,
  saucesStock: {
    verde: true,
    roja: true,
    chilePasado: true,
  },
  coloniasDisponibles: [],
  productosCargados: false,
  zoneMessage: "",
  error: "",
  isLoading: false,
  isPaying: false,
  promoLookupPhone: "",
  promoMessage: "",
  isPromoLoading: false,
  npsOfferMessage: "",
  isNpsOfferLoading: false,
  extraPromos: [],
  promo: null,
};

type CheckoutAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_PAYING"; payload: boolean }
  | { type: "SET_PROMO_LOADING"; payload: boolean }
  | { type: "SET_NPS_OFFER_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string }
  | { type: "SET_ZONE_MESSAGE"; payload: string }
  | { type: "SET_PROMO_MESSAGE"; payload: string }
  | { type: "SET_NPS_OFFER_MESSAGE"; payload: string }
  | { type: "SET_STEP"; payload: CheckoutStep }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_ZONE"; payload: { cp: string; envio: number } }
  | { type: "SET_PRECIOS"; payload: PreciosCatalogo }
  | { type: "SET_COLONIAS"; payload: string[] }
  | { type: "SET_PRODUCTOS_CARGADOS"; payload: boolean }
  | { type: "SET_MAX_KILOS"; payload: number }
  | { type: "SET_SAUCE_STOCK"; payload: { verde: boolean; roja: boolean; chilePasado: boolean } }
  | { type: "SET_KILOS"; payload: number }
  | { type: "SET_SAUCE"; payload: { key: SauceKey; value: number } }
  | { type: "SET_FECHA"; payload: string }
  | { type: "SET_NOMBRE"; payload: string }
  | { type: "SET_EMAIL"; payload: string }
  | { type: "SET_TELEFONO"; payload: string }
  | { type: "SET_CALLE"; payload: string }
  | { type: "SET_NUMERO_EXTERIOR"; payload: string }
  | { type: "SET_NUMERO_INTERIOR"; payload: string }
  | { type: "SET_COLONIA"; payload: string }
  | { type: "SET_PROMO_LOOKUP_PHONE"; payload: string }
  | { type: "SET_NPS_OFFER_TOKEN"; payload: string }
  | { type: "SET_EXTRA_PROMOS"; payload: PromoRule[] }
  | {
      type: "SET_NPS_PREFILL";
      payload: {
        nombre: string;
        email: string;
        telefono: string;
        cp: string;
        colonia: string;
        calle: string;
        numeroExterior: string;
        numeroInterior: string;
      };
    }
  | {
      type: "SET_PROMO";
      payload: {
        phone: string;
        promociones: PromoRule[];
      } | null;
    };

function toPrecios(productos: Producto[]): PreciosCatalogo {
  const buscar = (nombre: string) => productos.find((item) => item.nombre === nombre)?.precio ?? 0;

  return {
    barbacoa: buscar("Barbacoa"),
    verde: buscar("Salsa Verde"),
    roja: buscar("Salsa Roja"),
    chilePasado: buscar("Salsa de Chile Pasado"),
  };
}

function clampSauce(value: number, kilos: number): number {
  const max = kilos * 3;
  if (value < 0) {
    return 0;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateRange() {
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const maxDate = new Date(tomorrow);
  maxDate.setDate(maxDate.getDate() + 6);

  return {
    minDate: formatDateLocal(tomorrow),
    maxDate: formatDateLocal(maxDate),
  };
}

function isDateInRange(value: string): boolean {
  if (!value) {
    return false;
  }

  const { minDate, maxDate } = getDateRange();
  return value >= minDate && value <= maxDate;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function buildDireccion(state: CheckoutState): string {
  const { calle, numeroExterior, numeroInterior, colonia } = state.envioDatos;
  const interiorSegment = numeroInterior.trim().length > 0 ? ` Int ${numeroInterior.trim()}` : "";

  return `${calle.trim()} ${numeroExterior.trim()}${interiorSegment}, Col. ${colonia.trim()}, CP ${state.pedido.cp}`;
}

function checkoutReducer(state: CheckoutState, action: CheckoutAction): CheckoutState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_PAYING":
      return { ...state, isPaying: action.payload };

    case "SET_PROMO_LOADING":
      return { ...state, isPromoLoading: action.payload };

    case "SET_NPS_OFFER_LOADING":
      return { ...state, isNpsOfferLoading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "SET_ZONE_MESSAGE":
      return { ...state, zoneMessage: action.payload };

    case "SET_PROMO_MESSAGE":
      return { ...state, promoMessage: action.payload };

    case "SET_NPS_OFFER_MESSAGE":
      return { ...state, npsOfferMessage: action.payload };

    case "SET_STEP":
      return { ...state, step: action.payload };

    case "NEXT_STEP": {
      const nextStep = Math.min(7, state.step + 1) as CheckoutStep;
      return { ...state, step: nextStep };
    }

    case "PREV_STEP": {
      const prevStep = Math.max(1, state.step - 1) as CheckoutStep;
      return { ...state, step: prevStep };
    }

    case "SET_ZONE":
      return {
        ...state,
        pedido: {
          ...state.pedido,
          cp: action.payload.cp,
          envio: action.payload.envio,
          promoId: "",
          promoTipo: "NONE",
          promoValor: 0,
          descuento: 0,
        },
        envioDatos: {
          ...state.envioDatos,
          colonia: "",
        },
        promo: null,
        promoMessage: "",
      };

    case "SET_PRECIOS":
      return { ...state, precios: action.payload };

    case "SET_COLONIAS":
      return { ...state, coloniasDisponibles: action.payload };

    case "SET_PRODUCTOS_CARGADOS":
      return { ...state, productosCargados: action.payload };

    case "SET_MAX_KILOS":
      return { ...state, maxKilos: action.payload };

    case "SET_SAUCE_STOCK":
      return {
        ...state,
        saucesStock: action.payload,
        pedido: {
          ...state.pedido,
          verde: action.payload.verde ? state.pedido.verde : 0,
          roja: action.payload.roja ? state.pedido.roja : 0,
          chilePasado: action.payload.chilePasado ? state.pedido.chilePasado : 0,
        },
      };

    case "SET_KILOS": {
      const kilos = action.payload;
      return {
        ...state,
        pedido: {
          ...state.pedido,
          kilos,
          verde: clampSauce(state.pedido.verde, kilos),
          roja: clampSauce(state.pedido.roja, kilos),
          chilePasado: clampSauce(state.pedido.chilePasado, kilos),
        },
      };
    }

    case "SET_SAUCE":
      return {
        ...state,
        pedido: {
          ...state.pedido,
          [action.payload.key]: clampSauce(action.payload.value, state.pedido.kilos),
        },
      };

    case "SET_FECHA":
      return { ...state, pedido: { ...state.pedido, fecha: action.payload } };

    case "SET_NOMBRE":
      return { ...state, envioDatos: { ...state.envioDatos, nombre: action.payload } };

    case "SET_EMAIL":
      return { ...state, envioDatos: { ...state.envioDatos, email: action.payload } };

    case "SET_TELEFONO":
      return { ...state, envioDatos: { ...state.envioDatos, telefono: normalizePhone(action.payload) } };

    case "SET_CALLE":
      return { ...state, envioDatos: { ...state.envioDatos, calle: action.payload } };

    case "SET_NUMERO_EXTERIOR":
      return { ...state, envioDatos: { ...state.envioDatos, numeroExterior: action.payload } };

    case "SET_NUMERO_INTERIOR":
      return { ...state, envioDatos: { ...state.envioDatos, numeroInterior: action.payload } };

    case "SET_COLONIA":
      return { ...state, envioDatos: { ...state.envioDatos, colonia: action.payload } };

    case "SET_PROMO_LOOKUP_PHONE":
      return { ...state, promoLookupPhone: normalizePhone(action.payload) };

    case "SET_NPS_OFFER_TOKEN":
      return {
        ...state,
        pedido: {
          ...state.pedido,
          npsOfferToken: action.payload.trim(),
        },
      };

    case "SET_EXTRA_PROMOS":
      return {
        ...state,
        extraPromos: action.payload,
      };

    case "SET_NPS_PREFILL":
      return {
        ...state,
        pedido: {
          ...state.pedido,
          cp: state.pedido.cp || action.payload.cp,
        },
        envioDatos: {
          ...state.envioDatos,
          nombre: state.envioDatos.nombre || action.payload.nombre,
          email: state.envioDatos.email || action.payload.email,
          telefono: state.envioDatos.telefono || normalizePhone(action.payload.telefono),
          colonia: state.envioDatos.colonia || action.payload.colonia,
          calle: state.envioDatos.calle || action.payload.calle,
          numeroExterior: state.envioDatos.numeroExterior || action.payload.numeroExterior,
          numeroInterior: state.envioDatos.numeroInterior || action.payload.numeroInterior,
        },
      };

    case "SET_PROMO":
      return {
        ...state,
        promo: action.payload,
        envioDatos: action.payload
          ? { ...state.envioDatos, telefono: action.payload.phone }
          : state.envioDatos,
      };

    default:
      return state;
  }
}

function getValidationError(state: CheckoutState): string {
  if (state.step === 2 && state.pedido.kilos > state.maxKilos) {
    return "La cantidad seleccionada supera el inventario disponible.";
  }

  if (state.step === 4 && !isDateInRange(state.pedido.fecha)) {
    return "Selecciona una fecha valida: desde manana y hasta 7 dias.";
  }

  if (state.step === 6) {
    if (!state.envioDatos.nombre.trim()) {
      return "Ingresa el nombre de quien recibe.";
    }

    if (!isValidEmail(state.envioDatos.email)) {
      return "Ingresa un email valido para confirmaciones.";
    }

    if (state.envioDatos.telefono.length !== 10) {
      return "Ingresa un telefono celular de 10 digitos.";
    }

    if (!state.envioDatos.calle.trim() || !state.envioDatos.numeroExterior.trim() || !state.envioDatos.colonia.trim()) {
      return "Completa calle, numero exterior y colonia.";
    }
  }

  return "";
}

function computeTotals(state: CheckoutState): Totales {
  const totalBarbacoa = state.pedido.kilos * state.precios.barbacoa;
  const totalSalsas =
    state.pedido.verde * state.precios.verde +
    state.pedido.roja * state.precios.roja +
    state.pedido.chilePasado * state.precios.chilePasado;

  const subtotal = totalBarbacoa + totalSalsas;
  let descuento = 0;
  let envioFinal = state.pedido.envio;
  let percentUsed = false;
  const appliedPromos: PromoRule[] = [];

  const promoMap = new Map<string, PromoRule>();
  for (const promo of state.extraPromos) {
    promoMap.set(promo.promoId, promo);
  }
  for (const promo of state.promo?.promociones ?? []) {
    promoMap.set(promo.promoId, promo);
  }
  const promoRules = [...promoMap.values()].sort((a, b) => a.prioridad - b.prioridad);
  for (const promo of promoRules) {
    if (promo.minTotalPedido > 0 && subtotal < promo.minTotalPedido) {
      continue;
    }

    let applied = false;
    if (promo.tipo === "FREE_SHIPPING") {
      if (envioFinal > 0) {
        envioFinal = 0;
        applied = true;
      }
    } else if (promo.tipo === "PERCENT") {
      if (!percentUsed) {
        descuento += Math.round((subtotal * promo.valor) / 100);
        percentUsed = true;
        applied = true;
      }
    } else if (promo.tipo === "FIXED") {
      descuento += Math.round(promo.valor);
      applied = true;
    }

    if (!applied) {
      continue;
    }

    appliedPromos.push(promo);
    if (!promo.combinable) {
      break;
    }
  }

  if (descuento > subtotal) {
    descuento = subtotal;
  }

  return {
    totalBarbacoa,
    totalSalsas,
    subtotal,
    descuento,
    envioFinal,
    appliedPromos,
    total: subtotal - descuento + envioFinal,
  };
}

function hasAnySauceAvailable(state: CheckoutState): boolean {
  const { verde, roja, chilePasado } = state.saucesStock;
  return verde || roja || chilePasado;
}

export function useCheckout() {
  const [state, dispatch] = useReducer(checkoutReducer, initialState);

  const totals = useMemo(() => computeTotals(state), [state]);
  const dateRange = useMemo(() => getDateRange(), []);

  const validateAndLoadZone = async (cp: string): Promise<boolean> => {
    const cpLimpio = cp.replace(/\D/g, "").slice(0, 5);

    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: "" });
    dispatch({ type: "SET_ZONE_MESSAGE", payload: "" });

    try {
      const zone = await validateZone(cpLimpio);

      if (!zone.success) {
        dispatch({ type: "SET_ZONE_MESSAGE", payload: "Aun no entregamos en tu zona." });
        dispatch({ type: "SET_LOADING", payload: false });
        return false;
      }

      dispatch({ type: "SET_ZONE", payload: { cp: cpLimpio, envio: zone.envio } });
      dispatch({
        type: "SET_ZONE_MESSAGE",
        payload: zone.envio === 0 ? "Entregamos en tu zona - Envio GRATIS" : `Entregamos en tu zona - Envio $${zone.envio}`,
      });

      const [products, inventory, coloniasResponse, sauceStock] = await Promise.all([
        getProductos(),
        getMaxInventory(),
        getColonias(cpLimpio),
        getSauceStock(),
      ]);

      if (products.success) {
        dispatch({ type: "SET_PRECIOS", payload: toPrecios(products.productos) });
        dispatch({ type: "SET_PRODUCTOS_CARGADOS", payload: true });
      }

      if (inventory.success) {
        dispatch({ type: "SET_MAX_KILOS", payload: inventory.maxKilos });
        if (state.pedido.kilos > inventory.maxKilos) {
          dispatch({ type: "SET_KILOS", payload: inventory.maxKilos });
        }
      }

      if (coloniasResponse.success) {
        dispatch({ type: "SET_COLONIAS", payload: coloniasResponse.colonias });
      } else {
        dispatch({ type: "SET_COLONIAS", payload: [] });
      }

      if (sauceStock.success) {
        dispatch({
          type: "SET_SAUCE_STOCK",
          payload: {
            verde: sauceStock.verde,
            roja: sauceStock.roja,
            chilePasado: sauceStock.chilePasado,
          },
        });
      }

      dispatch({ type: "SET_STEP", payload: 2 });
      return true;
    } catch {
      dispatch({ type: "SET_ERROR", payload: "No fue posible validar tu zona en este momento." });
      return false;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const validateCustomerPromo = async (): Promise<boolean> => {
    const telefono = state.promoLookupPhone;
    if (telefono.length !== 10) {
      dispatch({ type: "SET_PROMO_MESSAGE", payload: "Ingresa un telefono de 10 digitos para consultar promociones." });
      return false;
    }

    dispatch({ type: "SET_PROMO_LOADING", payload: true });
    dispatch({ type: "SET_PROMO_MESSAGE", payload: "" });

    try {
      const response = await validatePromo(telefono);

      if (!response.success) {
        dispatch({ type: "SET_PROMO", payload: null });
        dispatch({ type: "SET_PROMO_MESSAGE", payload: response.message ?? "No se pudo validar la promocion." });
        return false;
      }

      if (!response.promociones.length) {
        dispatch({ type: "SET_PROMO", payload: null });
        dispatch({ type: "SET_PROMO_MESSAGE", payload: response.message ?? "No hay promociones vigentes para este telefono." });
        return true;
      }

      dispatch({
        type: "SET_PROMO",
        payload: {
          phone: response.telefono,
          promociones: response.promociones,
        },
      });
      dispatch({
        type: "SET_PROMO_MESSAGE",
        payload: response.promociones.map((promo) => promo.nombre).join(" + "),
      });
      return true;
    } catch {
      dispatch({ type: "SET_PROMO", payload: null });
      dispatch({ type: "SET_PROMO_MESSAGE", payload: "Error consultando promociones." });
      return false;
    } finally {
      dispatch({ type: "SET_PROMO_LOADING", payload: false });
    }
  };

  const loadNpsOffer = async (token: string): Promise<boolean> => {
    const cleanToken = token.trim();
    dispatch({ type: "SET_NPS_OFFER_TOKEN", payload: cleanToken });
    if (!cleanToken) {
      dispatch({ type: "SET_EXTRA_PROMOS", payload: [] });
      dispatch({ type: "SET_NPS_OFFER_MESSAGE", payload: "" });
      return false;
    }

    dispatch({ type: "SET_NPS_OFFER_LOADING", payload: true });
    dispatch({ type: "SET_NPS_OFFER_MESSAGE", payload: "" });

    try {
      const response = await validateNpsOffer(cleanToken);
      if (!response.success || !response.eligible) {
        dispatch({ type: "SET_EXTRA_PROMOS", payload: [] });
        dispatch({
          type: "SET_NPS_OFFER_MESSAGE",
          payload: response.message ?? "No fue posible aplicar la promocion.",
        });
        return false;
      }

      const promoNps: PromoRule = {
        promoId: "NPS20",
        titulo: "Descuento NPS 20%",
        nombre: "Descuento NPS 20%",
        descripcion: "Promocion por evaluacion de muestra",
        tipo: "PERCENT",
        valor: 20,
        minCompras: 0,
        minTotalPedido: 0,
        combinable: false,
        prioridad: 1,
      };

      dispatch({ type: "SET_EXTRA_PROMOS", payload: [promoNps] });
      dispatch({
        type: "SET_NPS_OFFER_MESSAGE",
        payload: response.message ?? "Promocion NPS activa: 20% en tu primera compra.",
      });

      if (response.profile) {
        dispatch({ type: "SET_NPS_PREFILL", payload: response.profile });
      }

      return true;
    } catch {
      dispatch({ type: "SET_EXTRA_PROMOS", payload: [] });
      dispatch({ type: "SET_NPS_OFFER_MESSAGE", payload: "No fue posible validar la promocion NPS." });
      return false;
    } finally {
      dispatch({ type: "SET_NPS_OFFER_LOADING", payload: false });
    }
  };

  const nextStep = async (): Promise<boolean> => {
    const hasSauces = hasAnySauceAvailable(state);

    if (state.step === 2 && !hasSauces) {
      const validationError = getValidationError(state);
      if (validationError) {
        dispatch({ type: "SET_ERROR", payload: validationError });
        return false;
      }

      dispatch({ type: "SET_ERROR", payload: "" });
      dispatch({ type: "SET_STEP", payload: 4 });
      return true;
    }

    if (state.step === 3) {
      try {
        const inventoryCheck = await validateInventory({
          kilos: state.pedido.kilos,
          verde: state.pedido.verde,
          roja: state.pedido.roja,
          chilePasado: state.pedido.chilePasado,
        });

        if (!inventoryCheck.success) {
          dispatch({
            type: "SET_ERROR",
            payload: inventoryCheck.message ?? "Inventario insuficiente para completar tu pedido.",
          });
          return false;
        }
      } catch {
        dispatch({
          type: "SET_ERROR",
          payload: "No fue posible validar inventario en este momento.",
        });
        return false;
      }
    }

    const validationError = getValidationError(state);
    if (validationError) {
      dispatch({ type: "SET_ERROR", payload: validationError });
      return false;
    }

    dispatch({ type: "SET_ERROR", payload: "" });
    dispatch({ type: "NEXT_STEP" });
    return true;
  };

  const backStep = () => {
    const hasSauces = hasAnySauceAvailable(state);

    dispatch({ type: "SET_ERROR", payload: "" });
    if (state.step === 4 && !hasSauces) {
      dispatch({ type: "SET_STEP", payload: 2 });
      return;
    }

    dispatch({ type: "PREV_STEP" });
  };

  const startPayment = async (): Promise<string | null> => {
    dispatch({ type: "SET_PAYING", payload: true });
    dispatch({ type: "SET_ERROR", payload: "" });

    try {
      const attribution = getCheckoutAttributionFromStorage();
      const payload: PedidoPayload = {
        ...state.pedido,
        envio: totals.envioFinal,
        promoId: totals.appliedPromos.map((promo) => promo.promoId).join(","),
        promoTipo:
          totals.appliedPromos.length > 1
            ? "MULTI"
            : (totals.appliedPromos[0]?.tipo ?? "NONE"),
        promoValor: totals.appliedPromos[0]?.valor ?? 0,
        nombre: state.envioDatos.nombre.trim(),
        email: state.envioDatos.email.trim().toLowerCase(),
        telefono: state.envioDatos.telefono,
        direccion: buildDireccion(state),
        calle: state.envioDatos.calle.trim(),
        colonia: state.envioDatos.colonia.trim(),
        numeroExterior: state.envioDatos.numeroExterior.trim(),
        numeroInterior: state.envioDatos.numeroInterior.trim(),
        descuento: totals.descuento,
        utmSource: attribution.utmSource,
        utmMedium: attribution.utmMedium,
        utmCampaign: attribution.utmCampaign,
        utmContent: attribution.utmContent,
        utmTerm: attribution.utmTerm,
        gclid: attribution.gclid,
        landingPath: attribution.landingPath,
        referrer: attribution.referrer,
        attributionModel: attribution.attributionModel,
        npsOfferToken: state.pedido.npsOfferToken,
      };

      const response = await createCheckoutSession(payload);
      if (!response.success || !response.url) {
        dispatch({ type: "SET_ERROR", payload: response.message ?? "Error creando sesion de pago." });
        return null;
      }

      return response.url;
    } catch {
      dispatch({ type: "SET_ERROR", payload: "Error conectando con Stripe." });
      return null;
    } finally {
      dispatch({ type: "SET_PAYING", payload: false });
    }
  };

  return {
    state,
    totals,
    dateRange,
    coloniasDisponibles: state.coloniasDisponibles,
    actions: {
      validateAndLoadZone,
      validateCustomerPromo,
      loadNpsOffer,
      nextStep,
      backStep,
      startPayment,
      setKilos: (kilos: number) => dispatch({ type: "SET_KILOS", payload: kilos }),
      setSauce: (key: SauceKey, value: number) => dispatch({ type: "SET_SAUCE", payload: { key, value } }),
      setFecha: (fecha: string) => dispatch({ type: "SET_FECHA", payload: fecha }),
      setNombre: (nombre: string) => dispatch({ type: "SET_NOMBRE", payload: nombre }),
      setEmail: (email: string) => dispatch({ type: "SET_EMAIL", payload: email }),
      setTelefono: (telefono: string) => dispatch({ type: "SET_TELEFONO", payload: telefono }),
      setCalle: (calle: string) => dispatch({ type: "SET_CALLE", payload: calle }),
      setNumeroExterior: (numeroExterior: string) => dispatch({ type: "SET_NUMERO_EXTERIOR", payload: numeroExterior }),
      setNumeroInterior: (numeroInterior: string) => dispatch({ type: "SET_NUMERO_INTERIOR", payload: numeroInterior }),
      setColonia: (colonia: string) => dispatch({ type: "SET_COLONIA", payload: colonia }),
      setPromoLookupPhone: (telefono: string) => dispatch({ type: "SET_PROMO_LOOKUP_PHONE", payload: telefono }),
      setNpsOfferToken: (token: string) => dispatch({ type: "SET_NPS_OFFER_TOKEN", payload: token }),
    },
  };
}
