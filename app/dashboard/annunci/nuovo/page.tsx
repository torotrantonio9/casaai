"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PROPERTY_TYPES = [
  { value: "apartment", label: "Appartamento" },
  { value: "house", label: "Casa" },
  { value: "villa", label: "Villa" },
  { value: "commercial", label: "Commerciale" },
  { value: "land", label: "Terreno" },
  { value: "garage", label: "Garage" },
  { value: "other", label: "Altro" },
];

const ENERGY_CLASSES = ["A4", "A3", "A2", "A1", "B", "C", "D", "E", "F", "G"];

type Tone = "professional" | "elegant" | "modern";

export default function NuovoAnnuncioPage() {
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [selectedTone, setSelectedTone] = useState<Tone>("professional");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [photos, setPhotos] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function generateDescription(form: HTMLFormElement) {
    setAiLoading(true);
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_data: {
            title: fd.get("title"),
            type: fd.get("type"),
            property_type: fd.get("property_type"),
            surface_sqm: Number(fd.get("surface_sqm")),
            rooms: Number(fd.get("rooms")),
            bathrooms: Number(fd.get("bathrooms")),
            floor: fd.get("floor") ? Number(fd.get("floor")) : undefined,
            city: fd.get("city"),
            neighborhood: fd.get("neighborhood"),
            has_parking: fd.get("has_parking") === "on",
            has_garden: fd.get("has_garden") === "on",
            has_terrace: fd.get("has_terrace") === "on",
            has_elevator: fd.get("has_elevator") === "on",
            has_cellar: fd.get("has_cellar") === "on",
            energy_class: fd.get("energy_class"),
            price: Number(fd.get("price")),
          },
          tone: selectedTone,
          type: fd.get("type") as string,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiDescription(data.description);
      }
    } catch {
      // Ignore
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    // Client-side validation
    const title = (fd.get("title") as string)?.trim();
    const price = Number(fd.get("price"));
    const surfaceSqm = Number(fd.get("surface_sqm"));
    const rooms = Number(fd.get("rooms"));
    const address = (fd.get("address") as string)?.trim();
    const city = (fd.get("city") as string)?.trim();
    const province = (fd.get("province") as string)?.trim();

    if (!title || title.length < 5) {
      setFeedback({ type: "error", message: "Il titolo deve avere almeno 5 caratteri." });
      setSaving(false);
      return;
    }
    if (!price || price <= 0) {
      setFeedback({ type: "error", message: "Inserisci un prezzo valido maggiore di 0." });
      setSaving(false);
      return;
    }
    if (!surfaceSqm || surfaceSqm <= 0) {
      setFeedback({ type: "error", message: "Inserisci una superficie valida." });
      setSaving(false);
      return;
    }
    if (!rooms || rooms < 1) {
      setFeedback({ type: "error", message: "Inserisci almeno 1 locale." });
      setSaving(false);
      return;
    }
    if (!address || !city || !province) {
      setFeedback({ type: "error", message: "Indirizzo, città e provincia sono obbligatori." });
      setSaving(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setFeedback({ type: "error", message: "Sessione scaduta. Effettua nuovamente il login." });
      setSaving(false);
      return;
    }

    const listing = {
      agent_id: user.id,
      title,
      type: fd.get("type") as string,
      property_type: fd.get("property_type") as string,
      price,
      price_period: fd.get("type") === "rent" ? "month" : null,
      surface_sqm: surfaceSqm,
      rooms,
      bathrooms: Number(fd.get("bathrooms")) || 1,
      floor: fd.get("floor") ? Number(fd.get("floor")) : null,
      total_floors: fd.get("total_floors") ? Number(fd.get("total_floors")) : null,
      year_built: fd.get("year_built") ? Number(fd.get("year_built")) : null,
      energy_class: (fd.get("energy_class") as string) || null,
      address,
      city,
      province,
      zip_code: fd.get("zip_code") as string,
      neighborhood: fd.get("neighborhood") as string,
      description: fd.get("description") as string,
      ai_description: aiDescription || null,
      has_parking: fd.get("has_parking") === "on",
      has_garden: fd.get("has_garden") === "on",
      has_terrace: fd.get("has_terrace") === "on",
      has_elevator: fd.get("has_elevator") === "on",
      has_cellar: fd.get("has_cellar") === "on",
      photos,
      status: (fd.get("status") as string) || "draft",
    };

    const { error } = await supabase.from("listings").insert(listing);
    if (error) {
      console.error("[nuovo annuncio] Errore salvataggio:", error);
      setFeedback({ type: "error", message: `Errore: ${error.message}` });
      setSaving(false);
      return;
    }

    setFeedback({ type: "success", message: "Annuncio salvato con successo! Reindirizzamento..." });
    setTimeout(() => {
      window.location.href = "/dashboard/annunci";
    }, 1500);
  }

  const formRef = useState<HTMLFormElement | null>(null);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Nuovo annuncio</h1>

      <form
        ref={(el) => {
          formRef[1](el);
        }}
        onSubmit={handleSubmit}
        className="mt-6 space-y-6"
      >
        {/* Basic info */}
        <fieldset className="rounded-xl border border-gray-200 bg-white p-5">
          <legend className="text-sm font-semibold text-gray-700">
            Informazioni base
          </legend>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Titolo *
              </label>
              <input
                name="title"
                required
                placeholder="Trilocale luminoso con vista mare"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tipo *
              </label>
              <select
                name="type"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="sale">Vendita</option>
                <option value="rent">Affitto</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tipo immobile *
              </label>
              <select
                name="property_type"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Prezzo *
              </label>
              <input
                name="price"
                type="number"
                required
                min={0}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Superficie m² *
              </label>
              <input
                name="surface_sqm"
                type="number"
                required
                min={1}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Locali *
              </label>
              <input
                name="rooms"
                type="number"
                required
                min={1}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Bagni
              </label>
              <input
                name="bathrooms"
                type="number"
                min={0}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Piano
              </label>
              <input
                name="floor"
                type="number"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Piani totali
              </label>
              <input
                name="total_floors"
                type="number"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Anno costruzione
              </label>
              <input
                name="year_built"
                type="number"
                min={1800}
                max={2026}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Classe energetica
              </label>
              <select
                name="energy_class"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Non specificata</option>
                {ENERGY_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* Address */}
        <fieldset className="rounded-xl border border-gray-200 bg-white p-5">
          <legend className="text-sm font-semibold text-gray-700">
            Indirizzo
          </legend>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Indirizzo *
              </label>
              <input
                name="address"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Città *
              </label>
              <input
                name="city"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Provincia *
              </label>
              <input
                name="province"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                CAP
              </label>
              <input
                name="zip_code"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Quartiere
              </label>
              <input
                name="neighborhood"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </fieldset>

        {/* Features */}
        <fieldset className="rounded-xl border border-gray-200 bg-white p-5">
          <legend className="text-sm font-semibold text-gray-700">
            Caratteristiche
          </legend>
          <div className="mt-3 flex flex-wrap gap-4">
            {[
              { name: "has_parking", label: "Posto auto" },
              { name: "has_garden", label: "Giardino" },
              { name: "has_terrace", label: "Terrazzo" },
              { name: "has_elevator", label: "Ascensore" },
              { name: "has_cellar", label: "Cantina" },
            ].map((f) => (
              <label key={f.name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={f.name}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Photos placeholder */}
        <fieldset className="rounded-xl border border-gray-200 bg-white p-5">
          <legend className="text-sm font-semibold text-gray-700">Foto</legend>
          <div className="mt-3">
            <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-400">
              Upload foto (Uploadthing verrà integrato)
            </div>
            {photos.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                {photos.length} foto caricate
              </p>
            )}
          </div>
        </fieldset>

        {/* Description */}
        <fieldset className="rounded-xl border border-gray-200 bg-white p-5">
          <legend className="text-sm font-semibold text-gray-700">
            Descrizione
          </legend>
          <div className="mt-3 space-y-3">
            <textarea
              name="description"
              rows={5}
              placeholder="Descrivi il tuo immobile..."
              defaultValue={aiDescription}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />

            {/* AI generation */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {(["professional", "elegant", "modern"] as Tone[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTone(t)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      selectedTone === t
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {t === "professional"
                      ? "Professionale"
                      : t === "elegant"
                        ? "Elegante"
                        : "Giovane"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={aiLoading}
                onClick={() => {
                  if (formRef[0]) generateDescription(formRef[0]);
                }}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {aiLoading ? "Generazione..." : "Genera con AI"}
              </button>
            </div>
            {aiDescription && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                <p className="mb-1 text-xs font-medium text-purple-700">
                  Descrizione generata dall&apos;AI
                </p>
                <p className="text-sm text-gray-700">{aiDescription}</p>
                <button
                  type="button"
                  onClick={() => {
                    const textarea = document.querySelector(
                      'textarea[name="description"]'
                    ) as HTMLTextAreaElement;
                    if (textarea) textarea.value = aiDescription;
                  }}
                  className="mt-2 text-xs font-medium text-purple-600 hover:text-purple-700"
                >
                  Usa questa descrizione
                </button>
              </div>
            )}
          </div>
        </fieldset>

        {/* Feedback */}
        {feedback && (
          <div
            className={`rounded-lg p-4 text-sm font-medium ${
              feedback.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            name="status"
            value="draft"
            disabled={saving}
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Salva come bozza
          </button>
          <button
            type="submit"
            name="status"
            value="active"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Pubblicazione..." : "Pubblica"}
          </button>
        </div>
      </form>
    </div>
  );
}
