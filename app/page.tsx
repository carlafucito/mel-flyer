"use client";

import { useState } from "react";
import BrokerSelect from "../components/BrokerSelect";
import InputField from "../components/InputField";
import PrimaryButton from "../components/PrimaryButton";

const BROKERS = [
  { name: "Carla Fucito", phone: "+56 9 7558 2708" },
  { name: "Francisca Alarcón", phone: "+56 9 5416 4474" },
  { name: "Soledad Velasco", phone: "+56 9 9736 4205" },
  { name: "Verónica Vergara", phone: "+56 9 7675 8419" },
  { name: "Francisco Monti", phone: "+56 9 5914 4757" },
  { name: "Rodrigo Lama", phone: "+56 9 7792 5335" },
  { name: "Francisca Parada", phone: "+56 9 9320 7474" }
];

export default function Home() {
  const [brokerIndex, setBrokerIndex] = useState<number>(0);
  const [url, setUrl] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  function validateUrl(value: string) {
    try { new URL(value); return true; } catch { return false; }
  }

  function onExtract() {
    setMessage("");
    if (!validateUrl(url)) {
      setMessage("Por favor ingresa una URL válida.");
      return;
    }
    const selected = BROKERS[brokerIndex];
    const payload = { broker: selected.name, phone: selected.phone, url };
    // kept in memory (state). Ready for next phases.
    console.log("Saved payload:", payload);
    setMessage("URL válida. Datos guardados localmente.");
  }

  const selectedBroker = BROKERS[brokerIndex];

  return (
    <main className="min-h-screen bg-gray-50 flex items-start justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col items-center gap-2 mb-4">
          <img src="/mel-logo.jpg" alt="MEL Propiedades" className="w-28 h-16 object-contain" />
          <h1 className="text-2xl font-bold">Generador de Flyers</h1>
          <p className="text-sm text-gray-600">MEL Propiedades</p>
        </div>

        <label className="block text-xs font-semibold text-gray-700 mt-4">Corredor</label>
        <BrokerSelect brokers={BROKERS} value={brokerIndex} onChange={setBrokerIndex} />

        <div className="mt-2 text-sm text-gray-600">Teléfono: <span className="font-medium">{selectedBroker.phone}</span></div>

        <div className="mt-4">
          <InputField placeholder="https://www.portalinmobiliario.com/..." value={url} onChange={setUrl} />
        </div>

        <div className="mt-6">
          <PrimaryButton onClick={onExtract}>Extraer información</PrimaryButton>
        </div>

        {message && <div className="mt-4 text-sm text-center text-gray-700">{message}</div>}
      </div>
    </main>
  );
}
