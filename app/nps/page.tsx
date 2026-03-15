"use client";

import { useEffect, useMemo, useState } from "react";

type Step = "loading" | "ready" | "saved" | "error";
const CANONICAL_CHECKOUT_BASE_URL = "https://www.deherencia.com";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function NpsPage() {
  const [step, setStep] = useState<Step>("loading");
  const [email, setEmail] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [offerToken, setOfferToken] = useState("");
  const [offerExpiresAt, setOfferExpiresAt] = useState("");

  const remainingChars = useMemo(() => 280 - comment.length, [comment.length]);
  const checkoutOfferUrl = `${CANONICAL_CHECKOUT_BASE_URL}/pedido`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = String(params.get("email") ?? "").trim().toLowerCase();
    const scoreParam = Number(params.get("score") ?? NaN);

    if (!isValidEmail(emailParam) || !Number.isInteger(scoreParam) || scoreParam < 0 || scoreParam > 10) {
      setError("Enlace de NPS invalido.");
      setStep("error");
      return;
    }

    setEmail(emailParam);
    setScore(scoreParam);

    const saveScore = async () => {
      try {
        const response = await fetch("/api/nps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailParam, score: scoreParam }),
        });

        const data = (await response.json()) as {
          success: boolean;
          message?: string;
          offerToken?: string;
          offerExpiresAt?: string;
        };
        if (!data.success) {
          throw new Error(data.message ?? "No se pudo guardar tu calificacion.");
        }

        setOfferToken(String(data.offerToken ?? ""));
        setOfferExpiresAt(String(data.offerExpiresAt ?? ""));

        setStep("ready");
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "No se pudo guardar tu calificacion.");
        setStep("error");
      }
    };

    void saveScore();
  }, []);

  const saveComment = async () => {
    if (!email) return;
    if (comment.length > 280) {
      setError("El comentario no puede exceder 280 caracteres.");
      return;
    }

    setSavingComment(true);
    setError("");
    try {
      const response = await fetch("/api/nps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, comment }),
      });

      const data = (await response.json()) as { success: boolean; message?: string };
      if (!data.success) {
        throw new Error(data.message ?? "No se pudo guardar tu comentario.");
      }

      setStep("saved");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar tu comentario.");
    } finally {
      setSavingComment(false);
    }
  };

  if (step === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-4 py-12">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
          <p>Guardando tu calificacion...</p>
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
          <h1 className="mb-3 text-2xl font-semibold">Gracias por tu respuesta</h1>
          <p className="text-sm text-neutral-700">Tu comentario fue registrado correctamente.</p>
          {offerToken ? (
            <div className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-900">Por tu evaluacion, tienes 20% de descuento en tu primera compra.</p>
              <p className="mt-1 text-xs text-emerald-800">Vigencia de 7 dias. Uso unico.</p>
              <a
                href={checkoutOfferUrl}
                className="mt-3 inline-block rounded-xl bg-emerald-700 px-4 py-2 text-sm text-white"
              >
                Comprar ahora y aprovechar promocion
              </a>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-semibold">Gracias por evaluar tu experiencia</h1>
        <p className="mb-2 text-sm text-neutral-700">Calificacion registrada: <strong>{score}</strong> / 10</p>
        <p className="mb-6 text-sm text-neutral-600">Si deseas, deja un comentario adicional (opcional).</p>

        {offerToken ? (
          <div className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-900">Gracias por tu evaluacion. Tienes 20% de descuento en tu primera compra.</p>
            <p className="mt-1 text-xs text-emerald-800">
              Vigencia: {offerExpiresAt ? new Date(offerExpiresAt).toLocaleDateString("es-MX") : "7 dias"}.
            </p>
            <a
              href={checkoutOfferUrl}
              className="mt-3 inline-block rounded-xl bg-emerald-700 px-4 py-2 text-sm text-white"
            >
              Comprar ahora y aprovechar promocion
            </a>
          </div>
        ) : null}

        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value.slice(0, 280))}
          placeholder="Escribe tu comentario (opcional)"
          className="h-32 w-full rounded-xl border px-4 py-3"
        />
        <p className="mt-1 text-xs text-neutral-500">{remainingChars} caracteres disponibles</p>

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => setStep("saved")}
            className="w-full rounded-xl border border-neutral-300 py-3"
          >
            Omitir
          </button>
          <button
            type="button"
            onClick={() => void saveComment()}
            disabled={savingComment}
            className="w-full rounded-xl bg-[#7a5c3e] py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingComment ? "Guardando..." : "Enviar comentario"}
          </button>
        </div>
      </div>
    </main>
  );
}
