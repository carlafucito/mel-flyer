import { NextRequest, NextResponse } from "next/server";
import { ListingResult } from "@/types/listing";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  return [...new Set(flattened.filter(v => /^https?:\/\//.test(v) && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(v)))].slice(0, 24);
}

function inferFeature(text: string): string {
  const options = [
    ["PISCINA", /piscina/i], ["QUINCHO", /quincho/i], ["VISTA DESPEJADA", /vista despejada|vista panor[aá]mica/i],
    ["JARDÍN", /jard[ií]n/i], ["TERRAZA", /terraza/i], ["SEGURIDAD 24/7", /seguridad 24|conserjer[ií]a 24/i],
    ["ESTACIONAMIENTO", /estacionamiento/i], ["BODEGA", /bodega/i]
  ] as const;
  return options.find(([, regex]) => regex.test(text))?.[0] ?? "DESTACADO";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = String(body?.url ?? "").trim();
    if (!url) return NextResponse.json({ error: "Falta campo url" }, { status: 400 });
    let parsed: URL;
    try { parsed = new URL(url); } catch { return NextResponse.json({ error: "URL inválida" }, { status: 400 }); }
    if (!/^https?:$/.test(parsed.protocol)) return NextResponse.json({ error: "Protocolo inválido" }, { status: 400 });
    if (!/portalinmobiliario\.com$/i.test(parsed.hostname) && !/portalinmobiliario\.com$/i.test(parsed.hostname.replace(/^www\./i, ''))) {
      return NextResponse.json({ error: "La URL debe pertenecer a portalinmobiliario.com" }, { status: 400 });
    }

    const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'es-CL,es;q=0.9' }, cache: 'no-store' });
    if (!response.ok) return NextResponse.json({ error: `Portal respondió ${response.status}` }, { status: 502 });
    const html = await response.text();

    const jsonLd = collectJsonLd(html);
    const plain = clean(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ''));
    const combined = `${plain} ${JSON.stringify(jsonLd)}`;

    const getJsonLdFirst = (keys: string[]) => {
      const found = deepFind(jsonLd, keys);
      for (const v of found) if (v) return clean(String(typeof v === 'object' ? JSON.stringify(v) : v));
      return '';
    };

    // Title and description: prefer JSON-LD, then meta tags, then fallbacks
    const title = getJsonLdFirst(['name']) || firstMatch(html, [/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i, /<title>([^<]+)/i]) || firstMatch(combined, [/^(.*)\n/]) || null;
    let description = getJsonLdFirst(['description']) || firstMatch(html, [/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i]) || null;
    if (description && title && description.includes(title)) {
      // remove title from description if accidentally duplicated
      description = description.replace(title, '').trim() || null;
    }

    // Price and currency
    const priceRaw = getJsonLdFirst(['price','offers','price']) || firstMatch(combined, [/(UF\s?[\d\.,]+)/i, /(\$\s?[\d\.,]+)/i]);
    const currency = /UF/i.test(priceRaw) ? 'UF' : (/\$/.test(priceRaw) ? 'CLP' : '');
    const price = priceRaw || null;

    // Bedrooms, bathrooms, parking: prefer ficha técnica / JSON-LD
    const bedrooms = getJsonLdFirst(['numberOfRooms','numberOfBedrooms','numBedrooms']) || firstMatch(combined, [/([0-9]+)\s*(?:dormitorios?|habitaciones?)/i, /(?:dormitorios?|habitaciones?)[^\d]{0,20}([0-9]+)/i]) || null;
    const bathrooms = getJsonLdFirst(['numberOfBathroomsTotal','numberOfBathrooms','bathroomCount']) || firstMatch(combined, [/([0-9]+)\s*baños?/i, /baños?[^\d]{0,20}([0-9]+)/i]) || null;
    const parking = getJsonLdFirst(['numberOfParkingSpaces','parking','parkingSpaces']) || firstMatch(combined, [/([0-9]+)\s*estacionamientos?/i, /estacionamiento[s]?[^\d]{0,20}([0-9]+)/i]) || null;

    // Areas: prefer JSON-LD (floorSize) then regex
    const rawFloor = getJsonLdFirst(['floorSize','area','areaTotal','surface','area_total']);
    const area_total = rawFloor ? (rawFloor.match(/[0-9\.,]+/)?.[0] ? `${rawFloor.match(/[0-9\.,]+/)![0]} m²` : `${rawFloor} m²`) : (firstMatch(combined, [/([0-9\.,]+)\s*m²\s*(?:totales?|terreno|útiles?)/i, /(?:superficie total|superficie)(?:[^\d]{0,30})([0-9\.,]+)\s*m/i]) || null);
    const rawUsable = getJsonLdFirst(['areaUsable','area_usable','usableArea']) || firstMatch(combined, [/superficie úti[le]s?[\s:\-]*([0-9\.,]+)\s*m/i, /m²\s*útil\s*:?[\s]*([0-9\.,]+)/i]);
    const area_usable = rawUsable ? (rawUsable.match(/[0-9\.,]+/)?.[0] ? `${rawUsable.match(/[0-9\.,]+/)![0]} m²` : `${rawUsable} m²`) : null;

    // Commune: prefer structured address in JSON-LD, then explicit labels
    let commune: string | null = getJsonLdFirst(['addressLocality','address.region','addressRegion','addressLocality']);
    if (!commune) {
      // try itemprop or meta
      const m = html.match(/itemprop=["']addressLocality["'][^>]*>([^<]+)/i) || html.match(/addressLocality["']?[:=]["']?([^"'\s,<>]+)/i);
      commune = m?.[1] ? clean(m[1]) : '';
    }
    commune = commune ? commune.toUpperCase() : null;

    // Operation
    const operation = /arriendo|alquiler/i.test(`${title || ''} ${description || ''} ${combined}`) ? 'ARRIENDO' : 'VENTA';

    const images = pickImages(html, jsonLd);
    const feature = inferFeature(`${title || ''} ${description || ''} ${plain}`);

    // Property type: prefer JSON-LD @type or explicit fields, then keywords
    const rawType = getJsonLdFirst(['@type','type','category','propertyType','additionalType']) || '';
    const detectFromText = (text: string) => {
      const t = String(text||'').toLowerCase();
      if (/\b(casa|casas)\b/.test(t)) return 'Casa';
      if (/\b(departamento|depto|dpto)\b/.test(t)) return 'Departamento';
      if (/\b(parcela)\b/.test(t)) return 'Parcela';
      if (/\b(oficina)\b/.test(t)) return 'Oficina';
      if (/\b(local)\b/.test(t)) return 'Local comercial';
      if (/\b(terreno)\b/.test(t)) return 'Terreno';
      if (/\b(bodega)\b/.test(t)) return 'Bodega';
      if (/\b(estacionamiento|estacionamientos|estac)\b/.test(t)) return 'Estacionamiento';
      return null;
    };
    let propertyType = null;
    if (rawType) propertyType = detectFromText(rawType) || clean(rawType) || null;
    if (!propertyType) propertyType = detectFromText(`${title || ''} ${description || ''} ${combined}`) || null;

    const result: ListingResult = {
      operation,
      commune: commune,
      price,
      currency,
      area_total: area_total || null,
      area_usable: area_usable || null,
      bedrooms: bedrooms || null,
      bathrooms: bathrooms || null,
      title,
      description,
      images,
      feature,
      propertyType: propertyType || null,
      parking: parking || null,
      missing: []
    };

    // determine missing fields
    const required = ['operation','commune','price','currency','area_total','bedrooms','bathrooms','title','description','propertyType'];
    for (const key of required) {
      // @ts-ignore
      if (!result[key]) result.missing!.push(key);
    }

    const status = result.missing && result.missing.length ? 'partial' : 'ok';

    return NextResponse.json({ status, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al extraer' }, { status: 500 });
  }
}
