import type { Metadata } from "next";
import "./globals.css";
import RegisterSW from "./register-sw";

export const metadata: Metadata = {
  title: "MEL Flyer",
  description: "Generador de flyers de MEL Propiedades",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MEL Flyer", statusBarStyle: "default" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><RegisterSW />{children}</body></html>;
}
