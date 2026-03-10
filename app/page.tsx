import Image from "next/image";
import Link from "next/link";
import HomeHeroVideo from "@/components/HomeHeroVideo";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f1e8] text-neutral-900">
      <section className="mx-auto max-w-6xl px-6 pt-6 md:pt-10">
        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-black shadow-xl">
          <HomeHeroVideo />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">

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

          <div className="mb-8 space-y-2">
            <p className="text-3xl font-semibold">$580 / kg</p>
            <p className="text-sm text-neutral-600">
              Envío gratis en zonas participantes
            </p>
            <p className="text-sm text-neutral-600">
              Pedidos antes de las 12:00 → entrega mismo día
            </p>
          </div>

          <Link
            href="/pedido"
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
            priority
          />
        </div>

      </section>

      <footer className="text-center py-10 text-sm text-neutral-500">
        © {new Date().getFullYear()} Herencia · Barbacoa estilo Parral
      </footer>

    </main>
  );
}
