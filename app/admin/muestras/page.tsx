"use client";

import { useEffect, useMemo, useState } from "react";

type AdminSampleRow = {
  rowNumber: number;
  fechaRegistro: string;
  email: string;
  nombre: string;
  telefono: string;
  cp: string;
  colonia: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  estatus: string;
  fechaProgramada: string;
  fechaEntrega: string;
  nps: string;
  comentario: string;
  ultimoEmail: string;
};

type RowsResponse = {
  success: boolean;
  rows?: AdminSampleRow[];
  message?: string;
};

const STORAGE_KEY = "herencia_admin_muestras_password";

function formatDate(value: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-MX");
}

function toDatetimeLocalValue(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function printRow(row: AdminSampleRow) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=700,height=900");
  if (!win) return;

  const interior = row.numeroInterior ? ` Int ${row.numeroInterior}` : "";
  const html = `
    <html>
      <head>
        <title>Muestra - ${row.nombre}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1 { margin: 0 0 12px; }
          p { margin: 6px 0; font-size: 16px; }
          .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; }
        </style>
      </head>
      <body>
        <h1>Entrega de muestra</h1>
        <div class="card">
          <p><strong>Nombre:</strong> ${row.nombre}</p>
          <p><strong>Direccion:</strong> ${row.calle} ${row.numeroExterior}${interior}, Col. ${row.colonia}, CP ${row.cp}</p>
          <p><strong>Telefono:</strong> ${row.telefono}</p>
          <p><strong>Email:</strong> ${row.email}</p>
          <p><strong>Fecha solicitud:</strong> ${formatDate(row.fechaRegistro)}</p>
        </div>
      </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();

  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      // Ignore print errors; user can print manually from the opened window.
    }
  };

  // Prefer printing after full load; keep a timeout fallback for browsers that
  // do not reliably fire onload on document.write windows.
  win.onload = () => {
    window.setTimeout(triggerPrint, 150);
  };
  window.setTimeout(triggerPrint, 700);
}

export default function AdminMuestrasPage() {
  const [passwordInput, setPasswordInput] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [solicitudes, setSolicitudes] = useState<AdminSampleRow[]>([]);
  const [programadas, setProgramadas] = useState<AdminSampleRow[]>([]);
  const [draftProgramacion, setDraftProgramacion] = useState<Record<number, string>>({});
  const [activeView, setActiveView] = useState<"solicitud" | "programada">("solicitud");

  const isAuthed = useMemo(() => password.length > 0, [password]);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(STORAGE_KEY) ?? "";
    if (saved) {
      setPassword(saved);
    }
  }, []);

  const loadRows = async (estatus: "solicitud" | "programada") => {
    if (!password) return;

    const response = await fetch(`/api/admin/muestras?estatus=${estatus}`, {
      headers: {
        "x-admin-password": password,
      },
      cache: "no-store",
    });

    const data = (await response.json()) as RowsResponse;
    if (!data.success) {
      throw new Error(data.message ?? "No fue posible cargar registros");
    }

    return data.rows ?? [];
  };

  const reload = async () => {
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const [rowsSolicitud, rowsProgramada] = await Promise.all([
        loadRows("solicitud"),
        loadRows("programada"),
      ]);

      setSolicitudes(rowsSolicitud ?? []);
      setProgramadas(rowsProgramada ?? []);
      setDraftProgramacion((prev) => {
        const next = { ...prev };
        for (const row of rowsSolicitud ?? []) {
          if (!next[row.rowNumber]) {
            next[row.rowNumber] = toDatetimeLocalValue(row.fechaProgramada);
          }
        }
        return next;
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Error cargando datos";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!password) return;
    void reload();
  }, [password]);

  const submitPassword = async () => {
    if (!passwordInput.trim()) {
      setError("Ingresa la contraseña.");
      return;
    }

    setPassword(passwordInput);
    window.sessionStorage.setItem(STORAGE_KEY, passwordInput);
    setPasswordInput("");
  };

  const programar = async (row: AdminSampleRow) => {
    const fechaProgramada = (draftProgramacion[row.rowNumber] ?? "").trim();
    if (!fechaProgramada) {
      setError(`Ingresa fecha programada para ${row.nombre}.`);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/muestras", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          action: "programar",
          rowNumber: row.rowNumber,
          fechaProgramada,
        }),
      });

      const data = (await response.json()) as { success: boolean; message?: string };
      if (!data.success) {
        throw new Error(data.message ?? "No se pudo programar entrega.");
      }

      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo programar entrega.");
    } finally {
      setLoading(false);
    }
  };

  const entregar = async (row: AdminSampleRow) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/muestras", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          action: "entregar",
          rowNumber: row.rowNumber,
        }),
      });

      const data = (await response.json()) as { success: boolean; message?: string };
      if (!data.success) {
        throw new Error(data.message ?? "No se pudo marcar como entregada.");
      }

      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo marcar como entregada.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-4 py-12">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
          <h1 className="mb-2 text-2xl font-semibold">Admin Muestras</h1>
          <p className="mb-4 text-sm text-neutral-600">Acceso restringido. Ingresa contraseña.</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            placeholder="Contraseña"
            className="w-full rounded-xl border px-4 py-3"
          />
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            onClick={() => void submitPassword()}
            className="mt-4 w-full rounded-xl bg-[#7a5c3e] py-3 text-white"
          >
            Entrar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f1e8] px-4 py-8">
      <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 shadow-xl md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">CRM Muestras</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveView("solicitud")}
              className={`rounded-xl px-4 py-2 text-sm ${activeView === "solicitud" ? "bg-[#7a5c3e] text-white" : "bg-neutral-100"}`}
            >
              Solicitudes ({solicitudes.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveView("programada")}
              className={`rounded-xl px-4 py-2 text-sm ${activeView === "programada" ? "bg-[#7a5c3e] text-white" : "bg-neutral-100"}`}
            >
              Programadas ({programadas.length})
            </button>
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-xl bg-neutral-200 px-4 py-2 text-sm"
            >
              Recargar
            </button>
          </div>
        </div>

        {error ? <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {loading ? <p className="mb-4 text-sm text-neutral-600">Actualizando...</p> : null}

        {activeView === "solicitud" ? (
          <div className="space-y-4">
            {solicitudes.length === 0 ? <p className="text-sm text-neutral-600">No hay solicitudes pendientes.</p> : null}
            {solicitudes.map((row) => (
              <div key={row.rowNumber} className="rounded-2xl border p-4">
                <div className="mb-3 grid gap-2 text-sm md:grid-cols-2">
                  <p><strong>Nombre:</strong> {row.nombre}</p>
                  <p><strong>Email:</strong> {row.email}</p>
                  <p><strong>Telefono:</strong> {row.telefono}</p>
                  <p><strong>CP:</strong> {row.cp}</p>
                  <p className="md:col-span-2">
                    <strong>Direccion:</strong> {row.calle} {row.numeroExterior}
                    {row.numeroInterior ? ` Int ${row.numeroInterior}` : ""}, Col. {row.colonia}
                  </p>
                  <p><strong>Registro:</strong> {formatDate(row.fechaRegistro)}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <input
                    type="datetime-local"
                    value={draftProgramacion[row.rowNumber] ?? ""}
                    onChange={(event) =>
                      setDraftProgramacion((prev) => ({
                        ...prev,
                        [row.rowNumber]: event.target.value,
                      }))
                    }
                    className="rounded-xl border px-4 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => printRow(row)}
                    className="rounded-xl bg-neutral-200 px-4 py-2 text-sm"
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => void programar(row)}
                    className="rounded-xl bg-[#7a5c3e] px-4 py-2 text-sm text-white"
                  >
                    Programar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {programadas.length === 0 ? <p className="text-sm text-neutral-600">No hay entregas programadas.</p> : null}
            {programadas.map((row) => (
              <div key={row.rowNumber} className="rounded-2xl border p-4">
                <div className="mb-3 grid gap-2 text-sm md:grid-cols-2">
                  <p><strong>Nombre:</strong> {row.nombre}</p>
                  <p><strong>Telefono:</strong> {row.telefono}</p>
                  <p><strong>Email:</strong> {row.email}</p>
                  <p><strong>Programada:</strong> {formatDate(row.fechaProgramada)}</p>
                  <p className="md:col-span-2">
                    <strong>Direccion:</strong> {row.calle} {row.numeroExterior}
                    {row.numeroInterior ? ` Int ${row.numeroInterior}` : ""}, Col. {row.colonia}, CP {row.cp}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void entregar(row)}
                  className="rounded-xl bg-[#7a5c3e] px-4 py-2 text-sm text-white"
                >
                  Marcar entregada
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
