"use client";

import { useEffect, useMemo, useState } from "react";

type FormState = {
  nombre: string;
  telefono: string;
  email: string;
  cp: string;
  kilos: string;
  fechaDeseada: string;
  detalles: string;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function PedidoEspecialPage() {
  const [form, setForm] = useState<FormState>({
    nombre: "",
    telefono: "",
    email: "",
    cp: "",
    kilos: "5",
    fechaDeseada: "",
    detalles: "",
  });

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const emailInvalid = useMemo(() => form.email.trim().length > 0 && !isValidEmail(form.email), [form.email]);

  const update = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cp = (params.get("cp") ?? "").replace(/\D/g, "").slice(0, 5);
    if (cp) {
      setForm((prev) => ({ ...prev, cp }));
    }
  }, []);

  const submit = async () => {
    setError("");
    setMessage("");

    if (!form.nombre.trim()) return setError("Ingresa tu nombre.");
    if (form.telefono.replace(/\D/g, "").length !== 10) return setError("Ingresa un telefono de 10 digitos.");
    if (!isValidEmail(form.email)) return setError("Ingresa un email valido.");
    if (form.cp.replace(/\D/g, "").length !== 5) return setError("Ingresa un CP valido.");
    if (Number(form.kilos) <= 4) return setError("Este formulario es solo para pedidos mayores a 4kg.");
    if (!form.detalles.trim()) return setError("Describe tus necesidades especiales.");

    setSending(true);

    try {
      const res = await fetch("/api/pedido-especial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          telefono: form.telefono,
          email: form.email,
          cp: form.cp,
          kilos: Number(form.kilos),
          fechaDeseada: form.fechaDeseada,
          detalles: form.detalles,
        }),
      });

      const data = (await res.json()) as { success: boolean; message?: string };

      if (!data.success) {
        setError(data.message ?? "No pudimos enviar tu solicitud");
        return;
      }

      setMessage("Tu pedido especial fue enviado. Te contactaremos pronto.");
      setForm((prev) => ({ ...prev, detalles: "" }));
    } catch {
      setError("Error enviando solicitud. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-semibold">Pedido Especial</h1>
        <p className="mb-6 text-sm text-neutral-600">Para pedidos mayores a 4kg, envianos tus datos y te contactamos.</p>

        <div className="space-y-4">
          <input value={form.nombre} onChange={(e) => update("nombre", e.target.value)} placeholder="Nombre" className="w-full rounded-xl border px-4 py-3" />
          <input value={form.telefono} onChange={(e) => update("telefono", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Telefono (10 digitos)" inputMode="numeric" className="w-full rounded-xl border px-4 py-3" />
          <div>
            <input value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="Email" className={`w-full rounded-xl border px-4 py-3 ${emailInvalid ? "border-red-500" : ""}`} />
            {emailInvalid ? <p className="mt-1 text-xs text-red-600">Formato de email invalido.</p> : null}
          </div>
          <input value={form.cp} onChange={(e) => update("cp", e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="Codigo postal" inputMode="numeric" className="w-full rounded-xl border px-4 py-3" />
          <input value={form.kilos} onChange={(e) => update("kilos", e.target.value)} type="number" min={5} step={0.5} placeholder="Kilos solicitados" className="w-full rounded-xl border px-4 py-3" />
          <input value={form.fechaDeseada} onChange={(e) => update("fechaDeseada", e.target.value)} type="date" className="w-full rounded-xl border px-4 py-3" />
          <textarea value={form.detalles} onChange={(e) => update("detalles", e.target.value)} placeholder="Necesidades especiales (evento, horario, observaciones)" className="h-32 w-full rounded-xl border px-4 py-3" />
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-green-700">{message}</p> : null}

        <button onClick={submit} disabled={sending} className="mt-6 w-full rounded-xl bg-[#7a5c3e] py-3 text-white disabled:cursor-not-allowed disabled:opacity-60">
          {sending ? "Enviando..." : "Enviar pedido especial"}
        </button>
      </div>
    </main>
  );
}
