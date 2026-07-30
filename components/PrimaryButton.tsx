"use client";

import React from "react";

export default function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-melred hover:brightness-95 text-white font-semibold py-3 rounded-md shadow"
    >
      {children}
    </button>
  );
}
