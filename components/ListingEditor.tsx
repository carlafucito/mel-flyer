"use client";

import React, { useState } from "react";
import { ListingResult } from "@/types/listing";
import InputField from "./InputField";
import PrimaryButton from "./PrimaryButton";

export default function ListingEditor({ initial, onBack }: { initial: ListingResult; onBack: () => void }) {
  const [data, setData] = useState<ListingResult>(initial);
  const [mainIndex, setMainIndex] = useState(0);

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
          <input value={data.commune} onChange={e => setField('commune', e.target.value)} className="w-full rounded-md border px-3 py-2" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-600">Precio</label>
            <input value={data.price} onChange={e => setField('price', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Moneda</label>
            <input value={data.currency} onChange={e => setField('currency', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-600">Superficie total</label>
            <input value={data.area_total} onChange={e => setField('area_total', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Superficie útil</label>
            <input value={data.area_usable || ''} onChange={e => setField('area_usable', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-600">Dormitorios</label>
            <input value={data.bedrooms} onChange={e => setField('bedrooms', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Baños</label>
            <input value={data.bathrooms} onChange={e => setField('bathrooms', e.target.value)} className="w-full rounded-md border px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Título</label>
          <input value={data.title} onChange={e => setField('title', e.target.value)} className="w-full rounded-md border px-3 py-2" />
        </div>

        <div>
          <label className="block text-xs text-gray-600">Descripción</label>
          <textarea value={data.description} onChange={e => setField('description', e.target.value)} className="w-full rounded-md border px-3 py-2 h-28" />
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

        <div className="mt-4">
          <PrimaryButton onClick={() => alert('Datos guardados temporalmente en estado de la app')}>Guardar temporal</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
