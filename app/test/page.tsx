"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import InputField from "@/components/InputField";
import PrimaryButton from "@/components/PrimaryButton";
import { ListingResult } from "@/types/listing";

const ListingEditor = dynamic(() => import("@/components/ListingEditor"), { ssr: false });

export default function TestPage() {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "extracting" | "ready" | "failed">("idle");
  const [rawJson, setRawJson] = useState<any | null>(null);
  const [extracted, setExtracted] = useState<ListingResult | null>(null);
  const [edited, setEdited] = useState<ListingResult | null>(null);

  const extract = async () => {
    setMessage("");
    setStatus("extracting");
    setRawJson(null);
    setExtracted(null);
    setEdited(null);

    if (!url.trim()) {
      setMessage("Ingresa una URL válida de Portal Inmobiliario.");
      setStatus("failed");
      return;
    }

    try {
      const response = await fetch("/api/extract-listing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url })
      });
      const json = await response.json();
      setRawJson(json);
      if (!response.ok || json.error) {
        setMessage(json.error || "No fue posible extraer el aviso.");
        setStatus("failed");
        return;
      }
      if (!json.result) {
        setMessage("La respuesta no contiene resultado de extracción.");
        setStatus("failed");
        return;
      }
      setExtracted(json.result);
      setEdited(json.result);
      setStatus("ready");
      setMessage("Extracción completada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al ejecutar el extractor.");
      setStatus("failed");
    }
  };

  const setField = <K extends keyof ListingResult>(key: K, value: ListingResult[K]) => {
    setEdited((current) => current ? { ...current, [key]: value } : current);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-start justify-center p-4">
      <div className="w-full max-w-5xl space-y-6">
        <section className="bg-white rounded-xl shadow-md p-6">
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-2xl font-bold">Test extractor</h1>
              <p className="text-sm text-gray-600">Depuración del extractor de Portal Inmobiliario sin modificar la app principal.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <InputField placeholder="https://www.portalinmobiliario.com/..." value={url} onChange={setUrl} />
              <div className="flex flex-col gap-2">
                <PrimaryButton onClick={extract}>Extraer información</PrimaryButton>
                <PrimaryButton onClick={extract}>Volver a extraer</PrimaryButton>
              </div>
            </div>

            {status === "extracting" && <div className="text-sm text-gray-700">Extrayendo…</div>}
            {message && <div className={`text-sm ${status === "failed" ? "text-red-600" : "text-gray-700"}`}>{message}</div>}
          </div>
        </section>

        {rawJson && (
          <section className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold mb-3">JSON completo obtenido</h2>
            <pre className="whitespace-pre-wrap break-words bg-slate-100 p-4 rounded-md text-sm text-slate-800">{JSON.stringify(rawJson, null, 2)}</pre>
          </section>
        )}

        {edited && (
          <section className="bg-white rounded-xl shadow-md p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Editor manual</h2>
                  <p className="text-sm text-gray-600">Modifica cualquier campo del resultado extraído.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs text-gray-600">Operación</span>
                    <input value={edited.operation} onChange={(e) => setField("operation", e.target.value)} className="w-full rounded-md border px-3 py-2" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-600">Comuna</span>
                    <input value={edited.commune ?? ""} onChange={(e) => setField("commune", e.target.value)} className="w-full rounded-md border px-3 py-2" />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs text-gray-600">Precio</span>
                    <input value={edited.price ?? ""} onChange={(e) => setField("price", e.target.value)} className="w-full rounded-md border px-3 py-2" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-600">Moneda</span>
                    <input value={edited.currency} onChange={(e) => setField("currency", e.target.value)} className="w-full rounded-md border px-3 py-2" />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs text-gray-600">Superficie total</span>
                    <input value={edited.area_total ?? ""} onChange={(e) => setField("area_total", e.target.value)} className="w-full rounded-md border px-3 py-2" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-600">Superficie útil</span>
                    <input value={edited.area_usable ?? ""} onChange={(e) => setField("area_usable", e.target.value)} className="w-full rounded-md border px-3 py-2" />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs text-gray-600">Dormitorios</span>
                    <input value={edited.bedrooms ?? ""} onChange={(e) => setField("bedrooms", e.target.value)} className="w-full rounded-md border px-3 py-2" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-600">Baños</span>
                    <input value={edited.bathrooms ?? ""} onChange={(e) => setField("bathrooms", e.target.value)} className="w-full rounded-md border px-3 py-2" />
                  </label>
                </div>

                <div>
                  <label className="block">
                    <span className="text-xs text-gray-600">Tipo de propiedad</span>
                    <input value={edited.propertyType ?? ""} onChange={(e) => setField("propertyType", e.target.value)} className="w-full rounded-md border px-3 py-2" />
                  </label>
                </div>

                <div>
                  <label className="block">
                    <span className="text-xs text-gray-600">Título</span>
                    <input value={edited.title ?? ""} onChange={(e) => setField("title", e.target.value)} className="w-full rounded-md border px-3 py-2" />
                  </label>
                </div>

                <div>
                  <label className="block">
                    <span className="text-xs text-gray-600">Descripción</span>
                    <textarea value={edited.description ?? ""} onChange={(e) => setField("description", e.target.value)} className="w-full rounded-md border px-3 py-2 h-32" />
                  </label>
                </div>

                <div>
                  <label className="block">
                    <span className="text-xs text-gray-600">Característica destacada</span>
                    <input value={edited.feature} onChange={(e) => setField("feature", e.target.value)} className="w-full rounded-md border px-3 py-2" />
                  </label>
                </div>

                <div>
                  <label className="block text-xs text-gray-600">Parking</label>
                  <input value={edited.parking ?? ""} onChange={(e) => setField("parking", e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Fotos extraídas</h2>
                  <p className="text-sm text-gray-600">Todas las imágenes detectadas por el extractor.</p>
                </div>
                {edited.images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {edited.images.map((src, index) => (
                      <img key={index} src={src} alt={`extraida-${index}`} className="h-40 w-full rounded-md object-cover" />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600">No se encontraron fotos.</div>
                )}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold">JSON del resultado</h3>
                  <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">{JSON.stringify(edited, null, 2)}</pre>
                </div>
              </div>
            </div>
          </section>
        )}

        {extracted && (
          <section className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold mb-3">Editor de componente (vista real)</h2>
            <p className="text-sm text-gray-600 mb-4">Esta sección usa el componente de edición existente.</p>
            <ListingEditor initial={extracted} onBack={() => setExtracted(null)} />
          </section>
        )}
      </div>
    </main>
  );
}
