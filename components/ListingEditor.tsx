"use client";

import React, { useEffect, useRef, useState } from "react";
import { ListingResult, PropertyAnalysis } from "@/types/listing";
import PrimaryButton from "./PrimaryButton";
import MelFlyerPreview from "./MelFlyerPreview";

export default function ListingEditor({ initial, onBack }: { initial: ListingResult; onBack: () => void }) {
  const [data, setData] = useState<ListingResult>(initial);
  const [mainIndex, setMainIndex] = useState(0);
  const [analysis, setAnalysis] = useState(initial.analysis ?? null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<string>("");
  const [pendingReplaceIndex, setPendingReplaceIndex] = useState<number | null>(null);
  const [showFlyerPreview, setShowFlyerPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (analysis?.mainPhotoIndex !== undefined && analysis.mainPhotoIndex !== mainIndex) {
      setMainIndex(analysis.mainPhotoIndex);
    }
  }, [analysis?.mainPhotoIndex, mainIndex]);

  function updateAnalysisField<K extends keyof PropertyAnalysis>(key: K, value: PropertyAnalysis[K]) {
    setAnalysis(prev => prev ? { ...prev, [key]: value } : prev);
  }

  function setMainPhoto(index: number) {
    setMainIndex(index);
    updateAnalysisField("mainPhotoIndex", index);
  }

  function toggleSecondaryPhoto(index: number) {
    setAnalysis(prev => {
      if (!prev) return prev;
      const current = prev.secondaryPhotoIndexes.includes(index);
      const next = current
        ? prev.secondaryPhotoIndexes.filter(item => item !== index)
        : [...prev.secondaryPhotoIndexes.filter(item => item !== index), index].slice(0, 3);
      return { ...prev, secondaryPhotoIndexes: next };
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

      const mergeManualValues = Boolean(analysis);
      const mergedAnalysis = mergeManualValues
        ? {
            ...json,
            featuredFeature: analysis?.featuredFeature || json.featuredFeature,
            marketingSummary: analysis?.marketingSummary || json.marketingSummary,
            mainPhotoIndex: analysis?.mainPhotoIndex ?? json.mainPhotoIndex,
            secondaryPhotoIndexes: analysis?.secondaryPhotoIndexes?.length ? analysis.secondaryPhotoIndexes : json.secondaryPhotoIndexes,
            photoAnalysis: json.photoAnalysis?.map((item: any, index: number) => ({
              ...item,
              recommendedRole: index === (analysis?.mainPhotoIndex ?? json.mainPhotoIndex)
                ? 'main'
                : (analysis?.secondaryPhotoIndexes?.includes(index) ? 'secondary' : item.recommendedRole || 'discard')
            })) || []
          }
        : json;

      setAnalysis(mergedAnalysis);
      setMainIndex(mergedAnalysis.mainPhotoIndex ?? 0);
      setField('feature', mergedAnalysis.featuredFeature || data.feature);
      setAnalysisMessage(mergeManualValues ? 'Se conservaron los cambios manuales actuales. Revisa el nuevo análisis.' : 'Análisis completado.');
    } catch (error) {
      setAnalysisMessage(error instanceof Error ? error.message : 'Error de IA');
    } finally {
      setAnalyzing(false);
    }
  }

  async function replaceImageAtIndex(index: number, file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setData(d => {
        const nextImages = [...d.images];
        nextImages[index] = url;
        return { ...d, images: nextImages };
      });
    };
    reader.readAsDataURL(file);
  }

  function openReplaceImage(index: number) {
    setPendingReplaceIndex(index);
    fileInputRef.current?.click();
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
            {data.images.map((src, i) => {
              const isMainSelected = (analysis?.mainPhotoIndex ?? mainIndex) === i;
              const isSecondarySelected = analysis?.secondaryPhotoIndexes.includes(i) ?? false;
              return (
                <div key={i} className="relative">
                  <img src={src} alt={`img-${i}`} className={`w-full h-24 object-cover rounded ${isMainSelected ? 'ring-2 ring-melred' : isSecondarySelected ? 'ring-2 ring-amber-400' : ''}`} />
                  <div className="mt-1 flex flex-wrap gap-1">
                    {isMainSelected && <span className="text-[10px] bg-melred text-white px-1 rounded">Portada</span>}
                    {isSecondarySelected && <span className="text-[10px] bg-amber-500 text-white px-1 rounded">Secundaria</span>}
                  </div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <button className="text-xs bg-white px-1 rounded" onClick={() => moveImage(i, -1)}>←</button>
                    <button className="text-xs bg-white px-1 rounded" onClick={() => moveImage(i, 1)}>→</button>
                    <button className="text-xs bg-white px-1 rounded" onClick={() => setMainPhoto(i)}>Portada</button>
                    <button className="text-xs bg-white px-1 rounded" onClick={() => toggleSecondaryPhoto(i)}>{isSecondarySelected ? 'Quitar' : 'Secundaria'}</button>
                    <button className="text-xs bg-white px-1 rounded" onClick={() => openReplaceImage(i)}>Reemplazar</button>
                    <button className="text-xs bg-white px-1 rounded" onClick={() => removeImage(i)}>Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2">
            <label className="block text-xs text-gray-600">Agregar fotos</label>
            <input type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (pendingReplaceIndex !== null) {
                replaceImageAtIndex(pendingReplaceIndex, file);
              }
              setPendingReplaceIndex(null);
              e.target.value = '';
            }} />
          </div>
        </div>

        <div className="space-y-3">
          <PrimaryButton onClick={analyzeWithAI}>
            {analyzing ? 'Analizando con IA...' : 'Analizar con IA'}
          </PrimaryButton>
          <button className="w-full rounded-md border border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-700 shadow-sm" onClick={() => setShowFlyerPreview(true)}>
            Generar flyer
          </button>
          {analysisMessage && <div className="text-sm text-gray-700">{analysisMessage}</div>}
        </div>
      </div>

      {analysis && (
        <div className="mt-6 bg-white rounded-xl shadow-md p-6">
          <h3 className="text-base font-semibold mb-3">Análisis IA</h3>
          <div className="space-y-4 text-sm text-gray-700">
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="font-semibold mb-2">Portada recomendada</div>
              <div className="flex items-center gap-3">
                <img src={data.images[analysis.mainPhotoIndex] || data.images[0] || ""} alt="Portada recomendada" className="w-24 h-24 rounded-md object-cover" />
                <div className="flex-1">
                  <div className="text-xs uppercase text-gray-500">Foto #{analysis.mainPhotoIndex + 1}</div>
                  <div className="mt-1 text-sm">{analysis.photoAnalysis[analysis.mainPhotoIndex]?.reason || analysis.photoAnalysis[analysis.mainPhotoIndex]?.description || "Portada recomendada por calidad comercial."}</div>
                  <div className="mt-1 text-xs text-gray-500">Puntaje comercial: {analysis.photoAnalysis[analysis.mainPhotoIndex]?.commercialScore ?? analysis.photoAnalysis[analysis.mainPhotoIndex]?.commercialQualityScore ?? 0}</div>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button className="text-xs rounded border border-gray-300 px-2 py-1" onClick={() => setMainPhoto(analysis.mainPhotoIndex)}>Mantener recomendación</button>
                <button className="text-xs rounded border border-gray-300 px-2 py-1" onClick={() => setMainPhoto(mainIndex)}>Usar portada actual</button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <div className="font-semibold mb-2">Fotografías secundarias</div>
              <div className="grid grid-cols-3 gap-2">
                {analysis.secondaryPhotoIndexes.map((index) => (
                  <div key={index} className="space-y-1">
                    <img src={data.images[index] || ""} alt={`Secundaria ${index + 1}`} className="w-full h-20 rounded-md object-cover" />
                    <button className="w-full text-xs rounded border border-gray-300 px-2 py-1" onClick={() => toggleSecondaryPhoto(index)}>
                      {analysis.secondaryPhotoIndexes.includes(index) ? "Mantener" : "Agregar"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <div className="font-semibold mb-2">Detalle por fotografía</div>
              <div className="space-y-2">
                {analysis.photoAnalysis.map((photo) => (
                  <details key={photo.index} className="rounded-md border border-gray-200 p-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      Foto #{photo.index + 1} · {photo.roomType || 'Otro'} · {photo.recommendedRole === 'main' ? 'Portada' : photo.recommendedRole === 'secondary' ? 'Secundaria' : 'Descartar'}
                    </summary>
                    <div className="mt-2 space-y-2 text-xs text-gray-600">
                      <div>Puntaje comercial: {photo.commercialScore}</div>
                      <div>Razón: {photo.reason || 'Sin detalle disponible.'}</div>
                      {photo.hasWatermark && (
                        <div className="rounded bg-amber-50 px-2 py-1 text-amber-700">
                          Marca de agua detectada · {photo.watermarkConfidence > 0 ? `${photo.watermarkConfidence}` : 'confianza baja'}
                        </div>
                      )}
                      {photo.strengths.length > 0 && (
                        <div>
                          <div className="font-semibold text-gray-700">Fortalezas</div>
                          <ul className="list-disc list-inside">
                            {photo.strengths.map((strength, index) => <li key={`${photo.index}-${index}`}>{strength}</li>)}
                          </ul>
                        </div>
                      )}
                      {photo.weaknesses.length > 0 && (
                        <div>
                          <div className="font-semibold text-gray-700">Debilidades</div>
                          <ul className="list-disc list-inside">
                            {photo.weaknesses.map((weakness, index) => <li key={`${photo.index}-${index}`}>{weakness}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <label className="block font-semibold mb-2">Característica destacada</label>
              <input value={analysis.featuredFeature} onChange={(e) => updateAnalysisField("featuredFeature", e.target.value)} className="w-full rounded-md border px-3 py-2" />
              <div className="mt-2 text-xs text-gray-500">Categoría: {analysis.featuredFeatureCategory || "Otro"}</div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <label className="block font-semibold mb-2">Resumen comercial</label>
              <textarea value={analysis.marketingSummary} onChange={(e) => updateAnalysisField("marketingSummary", e.target.value)} className="w-full rounded-md border px-3 py-2 h-24" />
            </div>

            {analysis.photoAnalysis.some((item) => item.hasWatermark) && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-800">
                Se detectaron fotografías con marca de agua. Puedes continuar o reemplazarlas por imágenes originales para obtener un resultado más profesional.
              </div>
            )}

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

      {showFlyerPreview && (
        <div className="mt-6 bg-white rounded-xl shadow-md p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Vista previa del flyer</h3>
            <button className="text-sm text-gray-600" onClick={() => setShowFlyerPreview(false)}>Volver a editar</button>
          </div>
          <MelFlyerPreview listing={{ ...data, analysis }} brokerName="" brokerPhone="" />
        </div>
      )}
    </div>
  );
}
