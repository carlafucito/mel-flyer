import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MEL Flyer",
  description: "Generador de flyers de MEL Propiedades",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MEL Flyer", statusBarStyle: "default" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
