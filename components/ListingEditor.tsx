"use client";

import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { ListingResult } from "@/types/listing";
import InputField from "./InputField";
import PrimaryButton from "./PrimaryButton";
import FlyerPreview from "./FlyerPreview";

export default function ListingEditor({ initial, onBack }: { initial: ListingResult; onBack: () => void }) {
  const [data, setData] = useState<ListingResult>(initial);
  const [mainIndex, setMainIndex] = useState(0);
  const [analysis, setAnalysis] = useState(initial.analysis ?? null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<string>("");
  const flyerRef = useRef<HTMLDivElement>(null);

  function setField<K extends keyof ListingResult>(key: K, value: ListingResult[K]) {
    setData(d => ({ ...d, [key]: value }));
  }

  function removeImage(i: number) {
    setData(d => ({ ...d, images: d.images.filter((_, idx) => idx !== i) }));
    if (mainIndex >= data.images.length - 1) setMainIndex(0);
  }

  function moveImage(i: number, dir: -1 | 1) {
    setData(d => {
      const arr = [...d.images];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return d;
      const tmp = arr[j]; arr[j] = arr[i]; arr[i] = tmp;
      return { ...d, images: arr };
    });
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const urls = await Promise.all([...files].map(file => new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
    })));
    setData(d => ({ ...d, images: [...d.images, ...urls] }));
  }

  async function analyzeWithAI() {
    setAnalyzing(true);
    setAnalysisMessage('Analizando con IA...');
    try {
      const response = await fetch('/api/analyze-property', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          text: data.raw_text,
          images: data.images,
          newImages: []
        })
      });
      const json = await response.json();
      if (!response.ok || json.error) {
        setAnalysisMessage(json.error || 'Error al analizar con IA');
        setAnalyzing(false);
        return;
      }
      setAnalysis(json);
      setAnalysisMessage('Análisis completado.');
    } catch (error) {
      setAnalysisMessage(error instanceof Error ? error.message : 'Error de IA');
    } finally {
      setAnalyzing(false);
    }
  }

  async function downloadFlyer() {
    if (!flyerRef.current) return;
    const canvas = await html2canvas(flyerRef.current, { scale: 2 });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'flyer-mel.png';
    link.click();
  }

  async function shareFlyer() {
    if (!flyerRef.current || !navigator.canShare) return;
    const canvas = await html2canvas(flyerRef.current, { scale: 2 });
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
    if (!blob) return;
    const file = new File([blob], 'flyer-mel.png', { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Flyer MEL Propiedades', text: data.title || 'Flyer MEL' });
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Editar aviso</h2>
        <button className="text-sm text-gray-600" onClick={onBack}>Volver</button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-600">Operación</label>
          <input value={data.operation} onChange={e => setField('operation', e.target.value)} className="w-full rounded-md border px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs text-gray-600">Comuna</label>
          <input value={data.commune ?? ''} onChange={e => setField('commune', e.target.value)} className="w-full rounded-md border px-3 py-2" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-600">Precio</label>
            <input value={data.price ?? ''} onChange={e => setField('price', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Moneda</label>
            <input value={data.currency} onChange={e => setField('currency', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-600">Superficie total</label>
            <input value={data.area_total ?? ''} onChange={e => setField('area_total', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Superficie útil</label>
            <input value={data.area_usable || ''} onChange={e => setField('area_usable', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-gray-600">Dormitorios</label>
            <input value={data.bedrooms ?? ''} onChange={e => setField('bedrooms', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Baños</label>
            <input value={data.bathrooms ?? ''} onChange={e => setField('bathrooms', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Bodegas</label>
            <input value={data.bodegas ?? ''} onChange={e => setField('bodegas', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-600">Gastos comunes</label>
            <input value={data.gastos_comunes ?? ''} onChange={e => setField('gastos_comunes', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Orientación</label>
            <input value={data.orientacion ?? ''} onChange={e => setField('orientacion', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Título</label>
          <input value={data.title ?? ''} onChange={e => setField('title', e.target.value)} className="w-full rounded-md border px-3 py-2" />
        </div>

        <div>
          <label className="block text-xs text-gray-600">Descripción</label>
          <textarea value={data.description ?? ''} onChange={e => setField('description', e.target.value)} className="w-full rounded-md border px-3 py-2 h-28" />
        </div>

        <div>
          <label className="block text-xs text-gray-600">Característica destacada</label>
          <input value={data.feature} onChange={e => setField('feature', e.target.value)} className="w-full rounded-md border px-3 py-2" />
        </div>

        <div>
          <label className="block text-xs text-gray-600">Galería</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {data.images.length === 0 && <div className="col-span-3 text-sm text-gray-500">No se encontraron fotos. Carga manualmente.</div>}
            {data.images.map((src, i) => (
              <div key={i} className="relative">
                <img src={src} alt={`img-${i}`} className={`w-full h-24 object-cover rounded ${i===mainIndex? 'ring-2 ring-melred':''}`} />
                <div className="flex gap-1 mt-1">
                  <button className="text-xs bg-white px-1 rounded" onClick={() => moveImage(i, -1)}>←</button>
                  <button className="text-xs bg-white px-1 rounded" onClick={() => moveImage(i, 1)}>→</button>
                  <button className="text-xs bg-white px-1 rounded" onClick={() => { setMainIndex(i); }}>Principal</button>
                  <button className="text-xs bg-white px-1 rounded" onClick={() => removeImage(i)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <label className="block text-xs text-gray-600">Agregar fotos</label>
            <input type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} />
          </div>
        </div>

        <div className="space-y-3">
          <PrimaryButton onClick={analyzeWithAI}>
            {analyzing ? 'Analizando con IA...' : 'Analizar con IA'}
          </PrimaryButton>
          {analysisMessage && <div className="text-sm text-gray-700">{analysisMessage}</div>}
          <div className="grid grid-cols-2 gap-2">
            <button className="w-full bg-white border border-gray-300 text-gray-700 font-semibold py-3 rounded-md shadow" onClick={downloadFlyer}>Descargar PNG</button>
            <button className="w-full bg-white border border-gray-300 text-gray-700 font-semibold py-3 rounded-md shadow" onClick={shareFlyer}>Compartir</button>
          </div>
        </div>
      </div>

      {analysis && (
        <div className="mt-6 bg-white rounded-xl shadow-md p-6">
          <h3 className="text-base font-semibold mb-3">Análisis IA</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <div><strong>Tipo de propiedad:</strong> {analysis.propertyType}</div>
            <div><strong>Resumen comercial:</strong> {analysis.marketingSummary}</div>
            <div><strong>Quinto círculo:</strong> {analysis.featuredFeature}</div>
            <div><strong>Categoría:</strong> {analysis.featuredFeatureCategory}</div>
            <div><strong>Portada:</strong> {analysis.mainPhotoIndex + 1}</div>
            <div><strong>Secundarias:</strong> {analysis.secondaryPhotoIndexes.join(', ')}</div>
            {analysis.analysisWarnings.length > 0 && (
              <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
                <strong>Avisos:</strong>
                <ul className="list-disc list-inside">
                  {analysis.analysisWarnings.map((warning, index) => <li key={index}>{warning}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {analysis && (
        <div className="mt-6 bg-white rounded-xl shadow-md p-6" ref={flyerRef}>
          <FlyerPreview listing={{ ...data, analysis }} brokerName="" brokerPhone="" />
        </div>
      )}
    </div>
  );
}
