"use client";

import { useMemo, useReducer } from "react";
import { createCheckoutSession, getColonias, getMaxInventory, getProductos, validateZone } from "@/services/api";
import type { CheckoutStep, PedidoPayload, SauceKey, Totales } from "@/types/pedido";
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
  coloniasDisponibles: [],
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
  | { type: "SET_COLONIAS"; payload: string[] }
  | { type: "SET_PRODUCTOS_CARGADOS"; payload: boolean }
  | { type: "SET_MAX_KILOS"; payload: number }
  | { type: "SET_KILOS"; payload: number }
  | { type: "SET_SAUCE"; payload: { key: SauceKey; value: number } }
  | { type: "SET_FECHA"; payload: string }
  | { type: "SET_NOMBRE"; payload: string }
  | { type: "SET_EMAIL"; payload: string }
  | { type: "SET_TELEFONO"; payload: string }
  | { type: "SET_CALLE"; payload: string }
  | { type: "SET_NUMERO_EXTERIOR"; payload: string }
  | { type: "SET_NUMERO_INTERIOR"; payload: string }
  | { type: "SET_COLONIA"; payload: string };

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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
        envioDatos: {
          ...state.envioDatos,
          colonia: "",
        },
      };

    case "SET_PRECIOS":
      return { ...state, precios: action.payload };

    case "SET_COLONIAS":
      return { ...state, coloniasDisponibles: action.payload };

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

    case "SET_NOMBRE":
      return { ...state, envioDatos: { ...state.envioDatos, nombre: action.payload } };

    case "SET_EMAIL":
      return { ...state, envioDatos: { ...state.envioDatos, email: action.payload.trim() } };

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

  return {
    totalBarbacoa,
    totalSalsas,
    total: totalBarbacoa + totalSalsas + state.pedido.envio,
  };
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

      const [products, inventory, coloniasResponse] = await Promise.all([
        getProductos(),
        getMaxInventory(),
        getColonias(cpLimpio),
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
      const payload: PedidoPayload = {
        ...state.pedido,
        nombre: state.envioDatos.nombre.trim(),
        email: state.envioDatos.email.trim().toLowerCase(),
        telefono: state.envioDatos.telefono,
        direccion: buildDireccion(state),
        calle: state.envioDatos.calle.trim(),
        colonia: state.envioDatos.colonia.trim(),
        numeroExterior: state.envioDatos.numeroExterior.trim(),
        numeroInterior: state.envioDatos.numeroInterior.trim(),
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
    },
  };
}
