"use client";

import { useMemo, useState } from "react";
import InputField from "@/components/InputField";
import PrimaryButton from "@/components/PrimaryButton";
import { ListingResult } from "@/types/listing";

type FieldDefinition = {
  label: string;
  key: string;
};

const fieldDefinitions: FieldDefinition[] = [
  { label: "Operation", key: "operation" },
  { label: "Property type", key: "propertyType" },
  { label: "Commune", key: "commune" },
  { label: "Price", key: "price" },
  { label: "Currency", key: "currency" },
  { label: "Area total", key: "area_total" },
  { label: "Area usable", key: "area_usable" },
  { label: "Bedrooms", key: "bedrooms" },
  { label: "Bathrooms", key: "bathrooms" },
  { label: "Parking", key: "parking" },
  { label: "Storage", key: "storage" },
  { label: "Common expenses", key: "commonExpenses" },
  { label: "Orientation", key: "orientation" },
  { label: "Title", key: "title" },
  { label: "Description", key: "description" },
  { label: "Photos", key: "photos" }
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "[]";
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function getFieldValue(result: ListingResult, key: string): unknown {
  switch (key) {
    case "storage":
      return result.bodegas ?? null;
    case "commonExpenses":
      return result.gastos_comunes ?? null;
    case "orientation":
      return result.orientacion ?? null;
    case "photos":
      return result.images ?? [];
    default:
      return result[key as keyof ListingResult] ?? null;
  }
}

export default function TestPage() {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "extracting" | "ready" | "failed">("idle");
  const [rawJson, setRawJson] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState<ListingResult | null>(null);
  const [geminiDebug, setGeminiDebug] = useState<Record<string, unknown> | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [analyzingGemini, setAnalyzingGemini] = useState(false);

  const rows = useMemo(() => {
    if (!result) return [];
    return fieldDefinitions.map((field) => ({
      ...field,
      value: getFieldValue(result, field.key)
    }));
  }, [result]);

  const extract = async () => {
    setMessage("");
    setStatus("extracting");
    setRawJson(null);
    setResult(null);

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

      setResult(json.result as ListingResult);
      setStatus("ready");
      setMessage("Extracción completada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al ejecutar el extractor.");
      setStatus("failed");
    }
  };

  const analyzeGemini = async () => {
    if (!result) return;
    setGeminiError(null);
    setGeminiDebug(null);
    setAnalyzingGemini(true);

    try {
      const response = await fetch('/api/analyze-property', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: result.title,
          description: result.description,
          orientation: result.orientacion,
          text: result.raw_text,
          images: result.images,
          newImages: [],
          debug: true
        })
      });
      const json = await response.json();
      if (!response.ok || json.error) {
        setGeminiError(json.error || 'Error al analizar con Gemini');
        setGeminiDebug(json.debug ? json.debug : { response: json });
        return;
      }

      setGeminiDebug(json.debug ?? {
        prompt: null,
        responseJson: null,
        rawText: null,
        jsonText: null,
        tokens: null,
        durationMs: null,
        error: null
      });
      setGeminiError(null);
    } catch (error) {
      setGeminiError(error instanceof Error ? error.message : 'Error al analizar con Gemini');
    } finally {
      setAnalyzingGemini(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Extractor validation</h1>
              <p className="text-sm text-slate-600">Herramienta interna para probar el endpoint de extracción sin modificar la lógica de la app principal.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <InputField placeholder="https://www.portalinmobiliario.com/..." value={url} onChange={setUrl} />
              <PrimaryButton onClick={extract}>Ejecutar extract-listing</PrimaryButton>
            </div>

            {status === "extracting" && <p className="text-sm text-slate-700">Extrayendo información…</p>}
            {message && <p className={`text-sm ${status === "failed" ? "text-red-600" : "text-slate-700"}`}>{message}</p>}
          </div>
        </section>

        {result && (
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Campos extraídos</h2>
                <p className="text-sm text-slate-600">Vista tabular de los valores devueltos por el extractor.</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Campo</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {rows.map((row) => (
                    <tr key={row.key} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{row.label}</td>
                      <td className="px-4 py-3 text-slate-800">
                        {row.key === "photos" && Array.isArray(row.value) && row.value.length > 0 ? (
                          <div className="space-y-2">
                            <p>{row.value.length} foto(s)</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {row.value.map((photo, index) => (
                                <img key={`${photo}-${index}`} src={photo as string} alt={`photo-${index}`} className="h-32 w-full rounded-md object-cover" />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap break-words text-xs text-slate-700">{formatValue(row.value)}</pre>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {result && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Extraction warnings</h2>
              <p className="mt-1 text-sm text-slate-600">Advertencias generadas durante la extracción.</p>
              {result.extractionWarnings && result.extractionWarnings.length > 0 ? (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
                  {result.extractionWarnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-600">No se registraron advertencias.</p>
              )}
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Extraction sources</h2>
              <p className="mt-1 text-sm text-slate-600">Fuentes utilizadas para cada campo.</p>
              {result.extractionSources && result.extractionSources.length > 0 ? (
                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Field</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {result.extractionSources.map((source, index) => (
                        <tr key={`${source.field}-${index}`}>
                          <td className="px-3 py-2 text-slate-700">{source.field}</td>
                          <td className="px-3 py-2 text-slate-700">{source.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">No se registraron fuentes.</p>
              )}
            </section>
          </div>
        )}

        {result && (
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Missing</h2>
            <p className="mt-1 text-sm text-slate-600">Campos que el extractor no pudo completar.</p>
            {result.missing && result.missing.length > 0 ? (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
                {result.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-600">No hay campos faltantes.</p>
            )}
          </section>
        )}

        {rawJson && (
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">JSON completo recibido</h2>
            <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-100 p-4 text-sm text-slate-800">{JSON.stringify(rawJson, null, 2)}</pre>
          </section>
        )}
      </div>
    </main>
  );
}
