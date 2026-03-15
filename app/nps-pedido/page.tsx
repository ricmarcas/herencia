"use client";

import { useEffect, useState } from "react";

type Step = "loading" | "form" | "saved" | "error";

function isValidScore(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 10;
}

export default function NpsPedidoPage() {
  const [step, setStep] = useState<Step>("loading");
  const [pedidoId, setPedidoId] = useState("");
  const [npsPedido, setNpsPedido] = useState<number | null>(null);
  const [npsEntrega, setNpsEntrega] = useState<number | null>(null);
  const [npsSabor, setNpsSabor] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pedido = String(params.get("pedidoId") ?? "").trim();
    const score = Number(params.get("score") ?? NaN);

    if (!pedido || !isValidScore(score)) {
      setError("Enlace de NPS de pedido invalido.");
      setStep("error");
      return;
    }

    setPedidoId(pedido);
    setNpsPedido(score);

    const saveGeneral = async () => {
      try {
        const response = await fetch("/api/nps-pedido", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pedidoId: pedido, npsPedido: score }),
        });
        const data = (await response.json()) as { success: boolean; message?: string };
        if (!data.success) throw new Error(data.message ?? "No se pudo registrar tu evaluacion.");
        setStep("form");
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "No se pudo registrar tu evaluacion.");
        setStep("error");
      }
    };

    void saveGeneral();
  }, []);

  const saveDetail = async () => {
    if (!pedidoId || npsPedido === null) return;
    if ((npsEntrega !== null && !isValidScore(npsEntrega)) || (npsSabor !== null && !isValidScore(npsSabor))) {
      setError("Selecciona una calificacion valida (0 a 10).");
      return;
    }

    const comentarioTrimmed = comentario.trim();
    const hasOptionalData = npsEntrega !== null || npsSabor !== null || comentarioTrimmed.length > 0;
    if (!hasOptionalData) {
      setStep("saved");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/nps-pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId,
          npsEntrega,
          npsSabor,
          comentario: comentarioTrimmed,
        }),
      });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!data.success) throw new Error(data.message ?? "No se pudo guardar tu respuesta.");
      setStep("saved");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar tu respuesta.");
    } finally {
      setSaving(false);
    }
  };

  if (step === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-4 py-12">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
          <p>Registrando tu evaluacion...</p>
        </div>
      </main>
    );
  }

  if (step === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-4 py-12">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
          <h1 className="mb-3 text-2xl font-semibold">No fue posible registrar tu NPS</h1>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </main>
    );
  }

  if (step === "saved") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-4 py-12">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
          <h1 className="mb-3 text-2xl font-semibold">Gracias por tu tiempo</h1>
          <p className="text-sm text-neutral-700">Tu evaluacion fue registrada correctamente.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-semibold">Gracias por evaluar tu pedido</h1>
        <p className="mb-2 text-sm text-neutral-700">Experiencia general registrada: <strong>{npsPedido}</strong> / 10</p>
        <p className="mb-6 text-sm text-neutral-600">Entrega y sabor son opcionales. Puedes enviarlo sin responderlos.</p>

        <label className="mb-2 block text-sm font-medium">Entrega del pedido (opcional)</label>
        <select
          value={npsEntrega === null ? "" : String(npsEntrega)}
          onChange={(event) => {
            const value = event.target.value;
            setNpsEntrega(value === "" ? null : Number(value));
          }}
          className="mb-4 w-full rounded-xl border px-4 py-3"
        >
          <option value="">Selecciona una calificacion (0 a 10)</option>
          {Array.from({ length: 11 }, (_, score) => (
            <option key={`entrega-${score}`} value={score}>
              {score}
            </option>
          ))}
        </select>

        <label className="mb-2 block text-sm font-medium">Sabor de la barbacoa (opcional)</label>
        <select
          value={npsSabor === null ? "" : String(npsSabor)}
          onChange={(event) => {
            const value = event.target.value;
            setNpsSabor(value === "" ? null : Number(value));
          }}
          className="mb-4 w-full rounded-xl border px-4 py-3"
        >
          <option value="">Selecciona una calificacion (0 a 10)</option>
          {Array.from({ length: 11 }, (_, score) => (
            <option key={`sabor-${score}`} value={score}>
              {score}
            </option>
          ))}
        </select>

        <label className="mb-2 block text-sm font-medium">Comentario (opcional, max 280)</label>
        <textarea
          value={comentario}
          onChange={(event) => setComentario(event.target.value.slice(0, 280))}
          placeholder="Comparte algo que podamos mejorar"
          className="h-28 w-full rounded-xl border px-4 py-3"
        />

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        <button
          type="button"
          onClick={() => void saveDetail()}
          disabled={saving}
          className="mt-6 w-full rounded-xl bg-[#7a5c3e] py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Enviar evaluacion"}
        </button>
      </div>
    </main>
  );
}
