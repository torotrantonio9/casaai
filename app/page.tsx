import { HomeChatSection } from "@/components/ai/HomeChatSection";
import { CompareDrawer } from "@/components/listings/CompareDrawer";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex min-h-[60vh] items-center justify-center bg-gradient-to-br from-blue-50 to-white px-4">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Trova la tua casa ideale
            <span className="block text-blue-600">con l&apos;AI</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            Descrivi la tua vita ideale in linguaggio naturale e la nostra
            intelligenza artificiale troverà le proprietà più compatibili per
            te.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="#chat-section"
              className="rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Inizia la ricerca
            </a>
            <a
              href="/valutazione"
              className="rounded-xl border border-gray-300 px-8 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50"
            >
              Valuta il tuo immobile
            </a>
          </div>
        </div>
      </section>

      {/* Chat Onboarding + Widget Section */}
      <div id="chat-section">
        <HomeChatSection />
      </div>

      {/* Come funziona */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Come funziona
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Descrivi",
                desc: "Racconta all'AI come vorresti vivere: quartiere, servizi, stile di vita.",
              },
              {
                step: "2",
                title: "Scopri",
                desc: "L'AI analizza centinaia di annunci e ti propone i più compatibili.",
              },
              {
                step: "3",
                title: "Contatta",
                desc: "Prenota visite direttamente con le agenzie, tutto in un click.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
                  {item.step}
                </div>
                <h3 className="mt-4 text-xl font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compare Drawer (global) */}
      <CompareDrawer />
    </div>
  );
}
