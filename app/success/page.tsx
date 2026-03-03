import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 p-6">
      <h1 className="text-3xl font-bold mb-4 text-green-600">
        ¡Pedido confirmado!
      </h1>

      <p className="text-lg text-center max-w-md">
        Gracias por tu compra en <strong>Herencia</strong>.
        <br />
        En breve recibirás la confirmación de tu pedido.
      </p>

      <Link
        href="/"
        className="mt-8 px-6 py-3 bg-black text-white rounded-xl hover:bg-neutral-800 transition"
      >
        Volver al inicio
      </Link>
    </main>
  );
}