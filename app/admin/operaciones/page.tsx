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
};

type AdminPedidoRow = {
  rowNumber: number;
  id: string;
  fecha: string;
  telefono: string;
  kilos: number;
  verde: number;
  roja: number;
  chilePasado: number;
  cp: string;
  total: number;
  fechaEntregaCliente: string;
  horarioEntrega: string;
  clienteId: string;
  direccionId: string;
  nombre: string;
  email: string;
  calle: string;
  colonia: string;
  numeroExterior: string;
  numeroInterior: string;
  estatus: string;
};

type RowsResponse<T> = {
  success: boolean;
  rows?: T[];
  message?: string;
};

type LabelPayload = {
  tipo: "muestra" | "pedido";
  nombre: string;
  telefono: string;
  cp: string;
  colonia: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  lineas: string[];
};

const STORAGE_KEY = "herencia_admin_operaciones_password";

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

function buildPedidoLines(row: AdminPedidoRow): string[] {
  const lines = [`Barbacoa: ${row.kilos} kg`];
  if (row.verde > 0) lines.push(`Salsa verde x${row.verde}`);
  if (row.roja > 0) lines.push(`Salsa roja x${row.roja}`);
  if (row.chilePasado > 0) lines.push(`Salsa chile pasado x${row.chilePasado}`);
  return lines;
}

function openLabel(payload: LabelPayload) {
  const key = `operaciones_print_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  window.localStorage.setItem(key, JSON.stringify(payload));
  window.open(`/admin/operaciones/print?key=${encodeURIComponent(key)}`, "_blank", "width=900,height=600");
}

export default function AdminOperacionesPage() {
  const [passwordInput, setPasswordInput] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [crmMessage, setCrmMessage] = useState("");

  const [tipo, setTipo] = useState<"muestras" | "pedidos">("muestras");
  const [muestrasView, setMuestrasView] = useState<"solicitud" | "programada">("solicitud");
  const [pedidosView, setPedidosView] = useState<"solicitud" | "programada">("solicitud");

  const [muestrasSolicitud, setMuestrasSolicitud] = useState<AdminSampleRow[]>([]);
  const [muestrasProgramada, setMuestrasProgramada] = useState<AdminSampleRow[]>([]);
  const [pedidosSolicitud, setPedidosSolicitud] = useState<AdminPedidoRow[]>([]);
  const [pedidosProgramada, setPedidosProgramada] = useState<AdminPedidoRow[]>([]);

  const [draftMuestras, setDraftMuestras] = useState<Record<number, string>>({});
  const [draftPedidosHorario, setDraftPedidosHorario] = useState<Record<number, string>>({});

  const isAuthed = useMemo(() => password.length > 0, [password]);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(STORAGE_KEY) ?? "";
    if (saved) setPassword(saved);
  }, []);

  const loadMuestras = async (estatus: "solicitud" | "programada"): Promise<AdminSampleRow[]> => {
    const response = await fetch(`/api/admin/muestras?estatus=${estatus}`, {
      headers: { "x-admin-password": password },
      cache: "no-store",
    });
    const data = (await response.json()) as RowsResponse<AdminSampleRow>;
    if (!data.success) throw new Error(data.message ?? "No se pudo cargar muestras.");
    return data.rows ?? [];
  };

  const loadPedidos = async (estatus: "solicitud" | "programada"): Promise<AdminPedidoRow[]> => {
    const response = await fetch(`/api/admin/pedidos?estatus=${estatus}`, {
      headers: { "x-admin-password": password },
      cache: "no-store",
    });
    const data = (await response.json()) as RowsResponse<AdminPedidoRow>;
    if (!data.success) throw new Error(data.message ?? "No se pudo cargar pedidos.");
    return data.rows ?? [];
  };

  const reload = async () => {
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const [ms, mp, ps, pp] = await Promise.all([
        loadMuestras("solicitud"),
        loadMuestras("programada"),
        loadPedidos("solicitud"),
        loadPedidos("programada"),
      ]);
      setMuestrasSolicitud(ms);
      setMuestrasProgramada(mp);
      setPedidosSolicitud(ps);
      setPedidosProgramada(pp);

      setDraftMuestras((prev) => {
        const next = { ...prev };
        for (const row of ms) {
          if (!next[row.rowNumber]) next[row.rowNumber] = toDatetimeLocalValue(row.fechaProgramada);
        }
        return next;
      });
      setDraftPedidosHorario((prev) => {
        const next = { ...prev };
        for (const row of ps) {
          if (!next[row.rowNumber]) next[row.rowNumber] = row.horarioEntrega || "";
        }
        return next;
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error cargando operaciones.");
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

  const programarMuestra = async (row: AdminSampleRow) => {
    const fechaProgramada = (draftMuestras[row.rowNumber] ?? "").trim();
    if (!fechaProgramada) {
      setError(`Ingresa fecha programada para ${row.nombre}.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/muestras", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ action: "programar", rowNumber: row.rowNumber, fechaProgramada }),
      });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!data.success) throw new Error(data.message ?? "No se pudo programar muestra.");
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo programar muestra.");
    } finally {
      setLoading(false);
    }
  };

  const entregarMuestra = async (row: AdminSampleRow) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/muestras", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ action: "entregar", rowNumber: row.rowNumber }),
      });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!data.success) throw new Error(data.message ?? "No se pudo marcar muestra como entregada.");
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo marcar muestra como entregada.");
    } finally {
      setLoading(false);
    }
  };

  const programarPedido = async (row: AdminPedidoRow) => {
    const horarioEntrega = (draftPedidosHorario[row.rowNumber] ?? "").trim();
    if (!horarioEntrega) {
      setError(`Define horario para pedido ${row.id || row.rowNumber}.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ action: "programar", rowNumber: row.rowNumber, horarioEntrega }),
      });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!data.success) throw new Error(data.message ?? "No se pudo programar pedido.");
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo programar pedido.");
    } finally {
      setLoading(false);
    }
  };

  const entregarPedido = async (row: AdminPedidoRow) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ action: "entregar", rowNumber: row.rowNumber }),
      });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!data.success) throw new Error(data.message ?? "No se pudo marcar pedido como entregado.");
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo marcar pedido como entregado.");
    } finally {
      setLoading(false);
    }
  };

  const sendNpsMuestrasPending = async () => {
    setLoading(true);
    setError("");
    setCrmMessage("");
    try {
      const response = await fetch("/api/cron/nps", {
        method: "POST",
        headers: { "x-admin-password": password },
      });
      const data = (await response.json()) as { success: boolean; sent?: number; skipped?: number; message?: string };
      if (!data.success) throw new Error(data.message ?? "No se pudo ejecutar NPS de muestras.");
      setCrmMessage(`NPS muestras ejecutado. Enviados: ${data.sent ?? 0}. Omitidos: ${data.skipped ?? 0}.`);
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo ejecutar NPS de muestras.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-4 py-12">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
          <h1 className="mb-2 text-2xl font-semibold">Admin Operaciones</h1>
          <p className="mb-4 text-sm text-neutral-600">Acceso restringido. Ingresa contraseña.</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            placeholder="Contraseña"
            className="w-full rounded-xl border px-4 py-3"
          />
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <button type="button" onClick={() => void submitPassword()} className="mt-4 w-full rounded-xl bg-[#7a5c3e] py-3 text-white">
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
          <h1 className="text-2xl font-semibold">Admin Operaciones</h1>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setTipo("muestras")} className={`rounded-xl px-4 py-2 text-sm ${tipo === "muestras" ? "bg-[#7a5c3e] text-white" : "bg-neutral-100"}`}>
              Muestras
            </button>
            <button type="button" onClick={() => setTipo("pedidos")} className={`rounded-xl px-4 py-2 text-sm ${tipo === "pedidos" ? "bg-[#7a5c3e] text-white" : "bg-neutral-100"}`}>
              Pedidos
            </button>
            <button type="button" onClick={() => void sendNpsMuestrasPending()} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm text-white">
              Ejecutar NPS muestras
            </button>
            <button type="button" onClick={() => void reload()} className="rounded-xl bg-neutral-200 px-4 py-2 text-sm">
              Recargar
            </button>
          </div>
        </div>

        {error ? <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {crmMessage ? <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{crmMessage}</p> : null}
        {loading ? <p className="mb-4 text-sm text-neutral-600">Actualizando...</p> : null}

        {tipo === "muestras" ? (
          <>
            <div className="mb-4 flex gap-2">
              <button type="button" onClick={() => setMuestrasView("solicitud")} className={`rounded-xl px-4 py-2 text-sm ${muestrasView === "solicitud" ? "bg-[#7a5c3e] text-white" : "bg-neutral-100"}`}>
                Solicitudes ({muestrasSolicitud.length})
              </button>
              <button type="button" onClick={() => setMuestrasView("programada")} className={`rounded-xl px-4 py-2 text-sm ${muestrasView === "programada" ? "bg-[#7a5c3e] text-white" : "bg-neutral-100"}`}>
                Programadas ({muestrasProgramada.length})
              </button>
            </div>

            {muestrasView === "solicitud" ? (
              <div className="space-y-4">
                {muestrasSolicitud.length === 0 ? <p className="text-sm text-neutral-600">No hay solicitudes pendientes.</p> : null}
                {muestrasSolicitud.map((row) => (
                  <div key={row.rowNumber} className="rounded-2xl border p-4">
                    <div className="mb-3 grid gap-2 text-sm md:grid-cols-2">
                      <p><strong>Tipo:</strong> Muestra</p>
                      <p><strong>Nombre:</strong> {row.nombre}</p>
                      <p><strong>Telefono:</strong> {row.telefono}</p>
                      <p><strong>CP:</strong> {row.cp}</p>
                      <p className="md:col-span-2"><strong>Direccion:</strong> {row.calle} {row.numeroExterior}{row.numeroInterior ? ` Int ${row.numeroInterior}` : ""}, Col. {row.colonia}</p>
                      <p><strong>Registro:</strong> {formatDate(row.fechaRegistro)}</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                      <input
                        type="datetime-local"
                        value={draftMuestras[row.rowNumber] ?? ""}
                        onChange={(event) => setDraftMuestras((prev) => ({ ...prev, [row.rowNumber]: event.target.value }))}
                        className="rounded-xl border px-4 py-2"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          openLabel({
                            tipo: "muestra",
                            nombre: row.nombre,
                            telefono: row.telefono,
                            cp: row.cp,
                            colonia: row.colonia,
                            calle: row.calle,
                            numeroExterior: row.numeroExterior,
                            numeroInterior: row.numeroInterior,
                            lineas: ["MUESTRA"],
                          })
                        }
                        className="rounded-xl bg-neutral-200 px-4 py-2 text-sm"
                      >
                        Imprimir etiqueta
                      </button>
                      <button type="button" onClick={() => void programarMuestra(row)} className="rounded-xl bg-[#7a5c3e] px-4 py-2 text-sm text-white">
                        Programar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {muestrasProgramada.length === 0 ? <p className="text-sm text-neutral-600">No hay entregas programadas.</p> : null}
                {muestrasProgramada.map((row) => (
                  <div key={row.rowNumber} className="rounded-2xl border p-4">
                    <div className="mb-3 grid gap-2 text-sm md:grid-cols-2">
                      <p><strong>Tipo:</strong> Muestra</p>
                      <p><strong>Nombre:</strong> {row.nombre}</p>
                      <p><strong>Telefono:</strong> {row.telefono}</p>
                      <p><strong>Programada:</strong> {formatDate(row.fechaProgramada)}</p>
                      <p className="md:col-span-2"><strong>Direccion:</strong> {row.calle} {row.numeroExterior}{row.numeroInterior ? ` Int ${row.numeroInterior}` : ""}, Col. {row.colonia}, CP {row.cp}</p>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          openLabel({
                            tipo: "muestra",
                            nombre: row.nombre,
                            telefono: row.telefono,
                            cp: row.cp,
                            colonia: row.colonia,
                            calle: row.calle,
                            numeroExterior: row.numeroExterior,
                            numeroInterior: row.numeroInterior,
                            lineas: ["MUESTRA"],
                          })
                        }
                        className="rounded-xl bg-neutral-200 px-4 py-2 text-sm"
                      >
                        Imprimir etiqueta
                      </button>
                      <button type="button" onClick={() => void entregarMuestra(row)} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm text-white">
                        Marcar entregada
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-4 flex gap-2">
              <button type="button" onClick={() => setPedidosView("solicitud")} className={`rounded-xl px-4 py-2 text-sm ${pedidosView === "solicitud" ? "bg-[#7a5c3e] text-white" : "bg-neutral-100"}`}>
                Pendientes horario ({pedidosSolicitud.length})
              </button>
              <button type="button" onClick={() => setPedidosView("programada")} className={`rounded-xl px-4 py-2 text-sm ${pedidosView === "programada" ? "bg-[#7a5c3e] text-white" : "bg-neutral-100"}`}>
                Programados ({pedidosProgramada.length})
              </button>
            </div>

            {pedidosView === "solicitud" ? (
              <div className="space-y-4">
                {pedidosSolicitud.length === 0 ? <p className="text-sm text-neutral-600">No hay pedidos pendientes de horario.</p> : null}
                {pedidosSolicitud.map((row) => (
                  <div key={row.rowNumber} className="rounded-2xl border p-4">
                    <div className="mb-3 grid gap-2 text-sm md:grid-cols-2">
                      <p><strong>Tipo:</strong> Pedido</p>
                      <p><strong>ID:</strong> {row.id || row.rowNumber}</p>
                      <p><strong>Nombre:</strong> {row.nombre || "-"}</p>
                      <p><strong>Telefono:</strong> {row.telefono}</p>
                      <p><strong>Fecha entrega cliente:</strong> {formatDate(row.fechaEntregaCliente)}</p>
                      <p><strong>Total:</strong> ${row.total}</p>
                      <p className="md:col-span-2"><strong>Direccion:</strong> {row.calle} {row.numeroExterior}{row.numeroInterior ? ` Int ${row.numeroInterior}` : ""}, Col. {row.colonia}, CP {row.cp}</p>
                      <p className="md:col-span-2"><strong>Contenido:</strong> {buildPedidoLines(row).join(" | ")}</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                      <input
                        type="text"
                        value={draftPedidosHorario[row.rowNumber] ?? ""}
                        onChange={(event) => setDraftPedidosHorario((prev) => ({ ...prev, [row.rowNumber]: event.target.value }))}
                        placeholder="Horario aprox. ej. 12:30 - 14:00"
                        className="rounded-xl border px-4 py-2"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          openLabel({
                            tipo: "pedido",
                            nombre: row.nombre || "Cliente",
                            telefono: row.telefono,
                            cp: row.cp,
                            colonia: row.colonia,
                            calle: row.calle,
                            numeroExterior: row.numeroExterior,
                            numeroInterior: row.numeroInterior,
                            lineas: buildPedidoLines(row),
                          })
                        }
                        className="rounded-xl bg-neutral-200 px-4 py-2 text-sm"
                      >
                        Imprimir etiqueta
                      </button>
                      <button type="button" onClick={() => void programarPedido(row)} className="rounded-xl bg-[#7a5c3e] px-4 py-2 text-sm text-white">
                        Programar horario
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {pedidosProgramada.length === 0 ? <p className="text-sm text-neutral-600">No hay pedidos programados.</p> : null}
                {pedidosProgramada.map((row) => (
                  <div key={row.rowNumber} className="rounded-2xl border p-4">
                    <div className="mb-3 grid gap-2 text-sm md:grid-cols-2">
                      <p><strong>Tipo:</strong> Pedido</p>
                      <p><strong>ID:</strong> {row.id || row.rowNumber}</p>
                      <p><strong>Nombre:</strong> {row.nombre || "-"}</p>
                      <p><strong>Telefono:</strong> {row.telefono}</p>
                      <p><strong>Fecha cliente:</strong> {formatDate(row.fechaEntregaCliente)}</p>
                      <p><strong>Horario:</strong> {row.horarioEntrega || "-"}</p>
                      <p className="md:col-span-2"><strong>Direccion:</strong> {row.calle} {row.numeroExterior}{row.numeroInterior ? ` Int ${row.numeroInterior}` : ""}, Col. {row.colonia}, CP {row.cp}</p>
                      <p className="md:col-span-2"><strong>Contenido:</strong> {buildPedidoLines(row).join(" | ")}</p>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          openLabel({
                            tipo: "pedido",
                            nombre: row.nombre || "Cliente",
                            telefono: row.telefono,
                            cp: row.cp,
                            colonia: row.colonia,
                            calle: row.calle,
                            numeroExterior: row.numeroExterior,
                            numeroInterior: row.numeroInterior,
                            lineas: buildPedidoLines(row),
                          })
                        }
                        className="rounded-xl bg-neutral-200 px-4 py-2 text-sm"
                      >
                        Imprimir etiqueta
                      </button>
                      <button type="button" onClick={() => void entregarPedido(row)} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm text-white">
                        Marcar entregado
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
