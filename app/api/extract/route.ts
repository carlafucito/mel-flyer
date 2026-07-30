import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type PropertyData = {
  operation: string;
  commune: string;
  price: string;
  area: string;
  bedrooms: string;
  bathrooms: string;
  feature: string;
  title: string;
  description: string;
  images: string[];
};

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return "";
}

function collectJsonLd(html: string): unknown[] {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const parsed: unknown[] = [];
  for (const block of blocks) {
    try {
      const value = JSON.parse(block[1]);
      if (Array.isArray(value)) parsed.push(...value);
      else parsed.push(value);
    } catch {}
  }
  return parsed;
}

function deepFind(root: unknown, keys: string[]): unknown[] {
  const found: unknown[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (keys.includes(key)) found.push(value);
      visit(value);
    }
  };
  visit(root);
  return found;
}

function pickImages(html: string, json: unknown[]): string[] {
  const candidates = [
    ...deepFind(json, ["image", "images", "contentUrl", "url"]),
    ...[...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi)].map(m => m[1]),
    ...[...html.matchAll(/https:\/\/http2\.mlstatic\.com\/D_[A-Z]+_[^"'\\ ]+\.(?:jpg|jpeg|webp)/gi)].map(m => m[0])
  ];
  const flattened = candidates.flatMap(v => Array.isArray(v) ? v : [v]).map(clean);
  return [...new Set(flattened.filter(v => /^https?:\/\//.test(v) && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(v)))].slice(0, 12);
}

function inferFeature(text: string): string {
  const options = [
    ["PISCINA", /piscina/i], ["QUINCHO", /quincho/i], ["VISTA DESPEJADA", /vista despejada|vista panor[aá]mica/i],
    ["JARDÍN", /jard[ií]n/i], ["TERRAZA", /terraza/i], ["SEGURIDAD 24\/7", /seguridad 24|conserjer[ií]a 24/i],
    ["ESTACIONAMIENTO", /estacionamiento/i], ["BODEGA", /bodega/i]
  ] as const;
  return options.find(([, regex]) => regex.test(text))?.[0] ?? "DESTACADO";
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || !/^https?:\/\//.test(url)) return NextResponse.json({ error: "Enlace inválido" }, { status: 400 });

    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        "accept-language": "es-CL,es;q=0.9"
      },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Portal respondió ${response.status}`);
    const html = await response.text();
    const jsonLd = collectJsonLd(html);
    const allJson = JSON.stringify(jsonLd);
    const plain = clean(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
    const combined = `${plain} ${allJson}`;

    const title = firstMatch(html, [/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i, /<title>([^<]+)/i]);
    const description = firstMatch(html, [/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i]);
    const price = firstMatch(combined, [/(UF\s?[\d\.]+)/i, /(\$\s?[\d\.]+)/]);
    const bedrooms = firstMatch(combined, [/(\d+)\s*(?:dormitorios?|habitaciones?)/i, /(?:dormitorios?|habitaciones?)[^\d]{0,20}(\d+)/i]);
    const bathrooms = firstMatch(combined, [/(\d+)\s*baños?/i, /baños?[^\d]{0,20}(\d+)/i]);
    const area = firstMatch(combined, [/(\d[\d\.]*)\s*m²\s*(?:totales?|terreno|útiles?)/i, /(?:superficie total|terreno)[^\d]{0,30}(\d[\d\.]*)\s*m/i]);
    const commune = firstMatch(combined, [/(Ñuñoa|Chicureo|Colina|Las Condes|Providencia|Vitacura|Lo Barnechea|Santiago|La Reina|Peñalolén|Huechuraba|Maipú|La Florida)/i]);
    const operation = /arriendo|alquiler/i.test(`${title} ${description}`) ? "ARRIENDO" : "VENTA";

    const data: PropertyData = {
      operation,
      commune: commune.toUpperCase(),
      price,
      area: area ? `${area} m²` : "",
      bedrooms,
      bathrooms,
      feature: inferFeature(`${title} ${description} ${plain}`),
      title,
      description,
      images: pickImages(html, jsonLd)
    };
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo extraer el aviso" }, { status: 500 });
  }
}
