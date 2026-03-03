import Link from "next/link";

export default function CancelPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 p-6">
      <h1 className="text-3xl font-bold mb-4 text-red-600">
        Pago cancelado
      </h1>

      <p className="text-lg text-center max-w-md">
        Tu pago no fue completado.
        <br />
        Puedes intentar nuevamente cuando lo desees.
      </p>

      <Link
        href="/"
        className="mt-8 px-6 py-3 bg-black text-white rounded-xl hover:bg-neutral-800 transition"
      >
        Intentar nuevamente
      </Link>
    </main>
  );
}