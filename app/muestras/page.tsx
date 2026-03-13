"use client";

import { useMemo, useState } from "react";
import { requestSample } from "@/services/api";

type SampleFormState = {
  nombre: string;
  email: string;
  telefono: string;
  cp: string;
  colonia: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
};

type SampleTracking = {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  gclid: string;
  landingPath: string;
  referrer: string;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidMxPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  return /^[2-9]\d{9}$/.test(digits);
}

export default function MuestrasPage() {
  const [form, setForm] = useState<SampleFormState>({
    nombre: "",
    email: "",
    telefono: "",
    cp: "",
    colonia: "",
    calle: "",
    numeroExterior: "",
    numeroInterior: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{
    alreadyRegistered: boolean;
    message: string;
  } | null>(null);

  const tracking = useMemo<SampleTracking>(() => {
    if (typeof window === "undefined") {
      return {
        utmSource: "",
        utmMedium: "",
        utmCampaign: "",
        utmContent: "",
        utmTerm: "",
        gclid: "",
        landingPath: "/muestras",
        referrer: "",
      };
    }

    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: (params.get("utm_source") ?? "").trim(),
      utmMedium: (params.get("utm_medium") ?? "").trim(),
      utmCampaign: (params.get("utm_campaign") ?? "").trim(),
      utmContent: (params.get("utm_content") ?? "").trim(),
      utmTerm: (params.get("utm_term") ?? "").trim(),
      gclid: (params.get("gclid") ?? "").trim(),
      landingPath: window.location.pathname || "/muestras",
      referrer: document.referrer || "",
    };
  }, []);

  const emailInvalid = useMemo(() => form.email.trim().length > 0 && !isValidEmail(form.email), [form.email]);

  const update = (key: keyof SampleFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    setError("");

    if (!form.nombre.trim()) {
      setError("Ingresa tu nombre.");
      return;
    }

    if (!isValidEmail(form.email)) {
      setError("Ingresa un email valido.");
      return;
    }

    if (!isValidMxPhone(form.telefono)) {
      setError("Ingresa un telefono celular valido de 10 digitos.");
      return;
    }

    if (form.cp.replace(/\D/g, "").length !== 5) {
      setError("Ingresa un codigo postal valido.");
      return;
    }

    if (!form.colonia.trim() || !form.calle.trim() || !form.numeroExterior.trim()) {
      setError("Completa colonia, calle y numero exterior.");
      return;
    }

    setLoading(true);

    try {
      const response = await requestSample({
        nombre: form.nombre.trim(),
        email: form.email.trim().toLowerCase(),
        telefono: form.telefono.replace(/\D/g, "").slice(0, 10),
        cp: form.cp.replace(/\D/g, "").slice(0, 5),
        colonia: form.colonia.trim(),
        calle: form.calle.trim(),
        numeroExterior: form.numeroExterior.trim(),
        numeroInterior: form.numeroInterior.trim(),
        fuente: "landing-muestras",
        utmSource: tracking.utmSource,
        utmMedium: tracking.utmMedium,
        utmCampaign: tracking.utmCampaign,
        utmContent: tracking.utmContent,
        utmTerm: tracking.utmTerm,
        gclid: tracking.gclid,
        landingPath: tracking.landingPath,
        referrer: tracking.referrer,
      });

      if (!response.success) {
        setError(response.message || "No pudimos registrar tu solicitud.");
        return;
      }

      setDone({
        alreadyRegistered: response.alreadyRegistered,
        message: response.message,
      });
    } catch {
      setError("No pudimos registrar tu solicitud. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-4 py-12">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
          <h1 className="mb-3 text-2xl font-semibold">Gracias por tu interes</h1>
          <p className="mb-4 text-neutral-700">{done.message}</p>
          {done.alreadyRegistered ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              Enviaremos una muestra por persona registrada.
            </p>
          ) : (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
              Registro confirmado. Te notificaremos el envio de tu muestra.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              window.close();
              setTimeout(() => {
                window.location.href = "/";
              }, 100);
            }}
            className="mt-6 w-full rounded-xl bg-[#7a5c3e] py-3 text-white"
          >
            Cerrar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-semibold">Pide una muestra gratis</h1>
        <p className="mb-6 text-sm text-neutral-600">
          Registra tus datos para enviarte una muestra. Solo se entrega una muestra por persona.
        </p>

        <div className="space-y-4">
          <input
            value={form.nombre}
            onChange={(e) => update("nombre", e.target.value)}
            placeholder="Nombre completo"
            className="w-full rounded-xl border px-4 py-3"
          />
          <div>
            <input
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="Email"
              className={`w-full rounded-xl border px-4 py-3 ${emailInvalid ? "border-red-500" : ""}`}
            />
            {emailInvalid ? <p className="mt-1 text-xs text-red-600">Formato de email invalido.</p> : null}
          </div>
          <input
            value={form.telefono}
            onChange={(e) => update("telefono", e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="Telefono (10 digitos)"
            inputMode="numeric"
            className="w-full rounded-xl border px-4 py-3"
          />
          <input
            value={form.cp}
            onChange={(e) => update("cp", e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="Codigo postal"
            inputMode="numeric"
            className="w-full rounded-xl border px-4 py-3"
          />
          <input
            value={form.colonia}
            onChange={(e) => update("colonia", e.target.value)}
            placeholder="Colonia"
            className="w-full rounded-xl border px-4 py-3"
          />
          <input
            value={form.calle}
            onChange={(e) => update("calle", e.target.value)}
            placeholder="Calle"
            className="w-full rounded-xl border px-4 py-3"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.numeroExterior}
              onChange={(e) => update("numeroExterior", e.target.value)}
              placeholder="Numero exterior"
              className="w-full rounded-xl border px-4 py-3"
            />
            <input
              value={form.numeroInterior}
              onChange={(e) => update("numeroInterior", e.target.value)}
              placeholder="Numero interior (opcional)"
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <button
          onClick={submit}
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-[#7a5c3e] py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Registrando..." : "Solicitar muestra"}
        </button>
      </div>
    </main>
  );
}
