"use client";

import { useMemo, useReducer } from "react";
import { createCheckoutSession, getMaxInventory, getProductos, validateZone } from "@/services/api";
import type { CheckoutStep, PedidoPayload, SauceKey, Totales } from "@/types/pedido";
import type { CheckoutState } from "@/types/pedido";
import type { PreciosCatalogo, Producto } from "@/types/producto";

const initialState: CheckoutState = {
  step: 1,
  pedido: {
    cp: "",
    envio: 0,
    kilos: 1,
    verde: 0,
    roja: 0,
    chilePasado: 0,
    fecha: "",
    ventana: "",
  },
  envioDatos: {
    telefono: "",
    direccion: "",
  },
  precios: {
    barbacoa: 0,
    verde: 0,
    roja: 0,
    chilePasado: 0,
  },
  maxKilos: 4,
  productosCargados: false,
  zoneMessage: "",
  error: "",
  isLoading: false,
  isPaying: false,
};

type CheckoutAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_PAYING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string }
  | { type: "SET_ZONE_MESSAGE"; payload: string }
  | { type: "SET_STEP"; payload: CheckoutStep }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_ZONE"; payload: { cp: string; envio: number } }
  | { type: "SET_PRECIOS"; payload: PreciosCatalogo }
  | { type: "SET_PRODUCTOS_CARGADOS"; payload: boolean }
  | { type: "SET_MAX_KILOS"; payload: number }
  | { type: "SET_KILOS"; payload: number }
  | { type: "SET_SAUCE"; payload: { key: SauceKey; value: number } }
  | { type: "SET_FECHA"; payload: string }
  | { type: "SET_VENTANA"; payload: string }
  | { type: "SET_TELEFONO"; payload: string }
  | { type: "SET_DIRECCION"; payload: string };

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

function checkoutReducer(state: CheckoutState, action: CheckoutAction): CheckoutState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_PAYING":
      return { ...state, isPaying: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "SET_ZONE_MESSAGE":
      return { ...state, zoneMessage: action.payload };

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
        },
      };

    case "SET_PRECIOS":
      return { ...state, precios: action.payload };

    case "SET_PRODUCTOS_CARGADOS":
      return { ...state, productosCargados: action.payload };

    case "SET_MAX_KILOS":
      return { ...state, maxKilos: action.payload };

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

    case "SET_VENTANA":
      return { ...state, pedido: { ...state.pedido, ventana: action.payload } };

    case "SET_TELEFONO":
      return { ...state, envioDatos: { ...state.envioDatos, telefono: action.payload } };

    case "SET_DIRECCION":
      return { ...state, envioDatos: { ...state.envioDatos, direccion: action.payload } };

    default:
      return state;
  }
}

function getValidationError(state: CheckoutState): string {
  if (state.step === 2 && state.pedido.kilos > state.maxKilos) {
    return "La cantidad seleccionada supera el inventario disponible.";
  }

  if (state.step === 4 && (!state.pedido.fecha || !state.pedido.ventana)) {
    return "Selecciona fecha y horario de entrega.";
  }

  if (state.step === 6 && (!state.envioDatos.telefono.trim() || !state.envioDatos.direccion.trim())) {
    return "Completa telefono y direccion para continuar.";
  }

  return "";
}

function computeTotals(state: CheckoutState): Totales {
  const totalBarbacoa = state.pedido.kilos * state.precios.barbacoa;
  const totalSalsas =
    state.pedido.verde * state.precios.verde +
    state.pedido.roja * state.precios.roja +
    state.pedido.chilePasado * state.precios.chilePasado;

  return {
    totalBarbacoa,
    totalSalsas,
    total: totalBarbacoa + totalSalsas + state.pedido.envio,
  };
}

export function useCheckout() {
  const [state, dispatch] = useReducer(checkoutReducer, initialState);

  const totals = useMemo(() => computeTotals(state), [state]);

  const validateAndLoadZone = async (cp: string): Promise<boolean> => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: "" });
    dispatch({ type: "SET_ZONE_MESSAGE", payload: "" });

    try {
      const zone = await validateZone(cp);

      if (!zone.success) {
        dispatch({ type: "SET_ZONE_MESSAGE", payload: "Aun no entregamos en tu zona." });
        dispatch({ type: "SET_LOADING", payload: false });
        return false;
      }

      dispatch({ type: "SET_ZONE", payload: { cp, envio: zone.envio } });
      dispatch({
        type: "SET_ZONE_MESSAGE",
        payload: zone.envio === 0 ? "Entregamos en tu zona - Envio GRATIS" : `Entregamos en tu zona - Envio $${zone.envio}`,
      });

      const [products, inventory] = await Promise.all([getProductos(), getMaxInventory()]);

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

      dispatch({ type: "SET_STEP", payload: 2 });
      return true;
    } catch {
      dispatch({ type: "SET_ERROR", payload: "No fue posible validar tu zona en este momento." });
      return false;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const nextStep = (): boolean => {
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
    dispatch({ type: "SET_ERROR", payload: "" });
    dispatch({ type: "PREV_STEP" });
  };

  const startPayment = async (): Promise<string | null> => {
    dispatch({ type: "SET_PAYING", payload: true });
    dispatch({ type: "SET_ERROR", payload: "" });

    try {
      const response = await createCheckoutSession(state.pedido as PedidoPayload);
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
    actions: {
      validateAndLoadZone,
      nextStep,
      backStep,
      startPayment,
      setKilos: (kilos: number) => dispatch({ type: "SET_KILOS", payload: kilos }),
      setSauce: (key: SauceKey, value: number) => dispatch({ type: "SET_SAUCE", payload: { key, value } }),
      setFecha: (fecha: string) => dispatch({ type: "SET_FECHA", payload: fecha }),
      setVentana: (ventana: string) => dispatch({ type: "SET_VENTANA", payload: ventana }),
      setTelefono: (telefono: string) => dispatch({ type: "SET_TELEFONO", payload: telefono }),
      setDireccion: (direccion: string) => dispatch({ type: "SET_DIRECCION", payload: direccion }),
    },
  };
}
