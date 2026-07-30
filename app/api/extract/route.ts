import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type PropertyData = {
  operation: string;
  commune: string | null;
  price: string | null;
  area: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  feature: string;
  title: string | null;
  description: string | null;
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

    const getJsonLdFirst = (keys: string[]) => {
      const found = deepFind(jsonLd, keys);
      for (const v of found) if (v) return clean(String(typeof v === 'object' ? JSON.stringify(v) : v));
      return '';
    };

    const title = getJsonLdFirst(['name']) || firstMatch(html, [/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i, /<title>([^<]+)/i]) || null;
    let description = getJsonLdFirst(['description']) || firstMatch(html, [/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i]) || null;
    if (description && title && description.includes(title)) description = description.replace(title, '').trim() || null;

    const priceRaw = getJsonLdFirst(['price','offers','price']) || firstMatch(combined, [/(UF\s?[\d\.,]+)/i, /(\$\s?[\d\.,]+)/i]);
    const price = priceRaw || null;

    const bedrooms = getJsonLdFirst(['numberOfRooms','numberOfBedrooms','numBedrooms']) || firstMatch(combined, [/([0-9]+)\s*(?:dormitorios?|habitaciones?)/i, /(?:dormitorios?|habitaciones?)[^\d]{0,20}([0-9]+)/i]) || null;
    const bathrooms = getJsonLdFirst(['numberOfBathroomsTotal','numberOfBathrooms','bathroomCount']) || firstMatch(combined, [/([0-9]+)\s*baños?/i, /baños?[^\d]{0,20}([0-9]+)/i]) || null;

    const areaRaw = getJsonLdFirst(['floorSize','area','areaTotal','surface','area_total']);
    const area = areaRaw ? (areaRaw.match(/[0-9\.,]+/)?.[0] ? `${areaRaw.match(/[0-9\.,]+/)![0]} m²` : `${areaRaw} m²`) : (firstMatch(combined, [/([0-9\.,]+)\s*m²\s*(?:totales?|terreno|útiles?)/i, /(?:superficie total|terreno)[^\d]{0,30}([0-9\.,]+)\s*m/i]) || null);

    let commune: string | null = getJsonLdFirst(['addressLocality','address.region','addressRegion','addressLocality']);
    if (!commune) {
      const m = html.match(/itemprop=["']addressLocality["'][^>]*>([^<]+)/i) || html.match(/addressLocality["']?[:=]["']?([^"'\s,<>]+)/i);
      commune = m?.[1] ? clean(m[1]) : '';
    }
    commune = commune ? commune.toUpperCase() : null;

    const operation = /arriendo|alquiler/i.test(`${title || ''} ${description || ''} ${combined}`) ? "ARRIENDO" : "VENTA";

    const data: PropertyData = {
      operation,
      commune,
      price,
      area,
      bedrooms,
      bathrooms,
      feature: inferFeature(`${title || ''} ${description || ''} ${plain}`),
      title,
      description,
      images: pickImages(html, jsonLd)
    };
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo extraer el aviso" }, { status: 500 });
  }
}
