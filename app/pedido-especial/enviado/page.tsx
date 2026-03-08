import Link from "next/link";

export default function PedidoEspecialEnviadoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl">
        <h1 className="mb-3 text-2xl font-semibold">Pedido Especial Enviado</h1>
        <p className="mb-8 text-neutral-600">Tu pedido especial fue enviado. Te contactaremos pronto.</p>

        <Link href="/" className="inline-block rounded-xl bg-[#7a5c3e] px-6 py-3 text-white">
          Iniciar otro pedido
        </Link>
      </div>
    </main>
  );
}
