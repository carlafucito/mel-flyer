"use client";

import React from "react";

export default function BrokerSelect({ brokers, value, onChange }: { brokers: { name: string; phone: string }[]; value: number; onChange: (i: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-melred focus:ring focus:ring-melred/30"
    >
      {brokers.map((b, i) => (
        <option key={b.name} value={i}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
