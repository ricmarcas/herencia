import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f1e8] text-neutral-900">

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-12 items-center">

        {/* Texto */}
        <div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Herencia
          </h1>

          <p className="text-xl mb-4 text-neutral-700">
            Barbacoa estilo Parral
          </p>

          <p className="text-lg mb-8 text-neutral-600">
            Tradición, sabor auténtico y calidad en cada kilogramo.
          </p>

          <div className="mb-8">
            <p className="text-3xl font-semibold">$580 / kg</p>
            <p className="text-sm text-neutral-600">
              Envío gratis en zonas participantes
            </p>
            <p className="text-sm text-neutral-600">
              Pedidos antes de las 12:00 → entrega mismo día
            </p>
          </div>

          <Link
            href="#ordenar"
            className="inline-block bg-[#7a5c3e] hover:bg-[#5f452f] text-white px-8 py-4 rounded-2xl text-lg font-medium transition"
          >
            Ordenar ahora
          </Link>
        </div>

        {/* Imagen */}
        <div className="flex justify-center">
          <Image
            src="/images/barbacoa.png"
            alt="Barbacoa Herencia"
            width={500}
            height={500}
            className="rounded-3xl shadow-xl"
          />
        </div>
      </section>

      {/* Sección Ordenar */}
      <section
        id="ordenar"
        className="bg-white py-20 px-6 text-center"
      >
        <h2 className="text-3xl font-semibold mb-6">
          Realiza tu pedido
        </h2>

        <p className="text-neutral-600 mb-8">
          Selecciona cantidad, valida tu zona y programa tu entrega.
        </p>

        <Link
          href="#"
          className="inline-block bg-[#7a5c3e] hover:bg-[#5f452f] text-white px-8 py-4 rounded-2xl text-lg font-medium transition"
        >
          Iniciar pedido
        </Link>
      </section>

      {/* Footer */}
      <footer className="text-center py-10 text-sm text-neutral-500">
        © {new Date().getFullYear()} Herencia · Barbacoa estilo Parral
      </footer>

    </main>
  );
}