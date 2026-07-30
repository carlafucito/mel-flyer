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

    const title = firstMatch(html, [/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i, /<title>([^<]+)/i]) || firstMatch(combined, [/^(.*)\n/]);
    const description = firstMatch(html, [/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i]) || '';
    const priceRaw = firstMatch(combined, [/(UF\s?[\d\.,]+)/i, /(\$\s?[\d\.,]+)/i]);
    const currency = /UF/i.test(priceRaw) ? 'UF' : (/\$/.test(priceRaw) ? 'CLP' : '');
    const price = priceRaw;

    const bedrooms = firstMatch(combined, [/([0-9]+)\s*(?:dormitorios?|habitaciones?)/i, /(?:dormitorios?|habitaciones?)[^\d]{0,20}([0-9]+)/i]);
    const bathrooms = firstMatch(combined, [/([0-9]+)\s*baños?/i, /baños?[^\d]{0,20}([0-9]+)/i]);
    const area_total = firstMatch(combined, [/([0-9\.,]+)\s*m²\s*(?:totales?|terreno|útiles?)/i, /(?:superficie total|superficie)(?:[^\d]{0,30})([0-9\.,]+)\s*m/i]);
    const area_usable = firstMatch(combined, [/superficie úti[le]s?[\s:\-]*([0-9\.,]+)\s*m/i, /m²\s*útil\s*:?\s*([0-9\.,]+)/i]);
    const commune = firstMatch(combined, [/\b(Ñuñoa|Chicureo|Colina|Las Condes|Providencia|Vitacura|Lo Barnechea|Santiago|La Reina|Peñalolén|Huechuraba|Maipú|La Florida)\b/i]) || '';
    const operation = /arriendo|alquiler/i.test(`${title} ${description} ${combined}`) ? 'ARRIENDO' : 'VENTA';

    const images = pickImages(html, jsonLd);
    const feature = inferFeature(`${title} ${description} ${plain}`);

    const result: ListingResult = {
      operation,
      commune: commune.toUpperCase(),
      price,
      currency,
      area_total: area_total ? `${area_total} m²` : '',
      area_usable: area_usable ? `${area_usable} m²` : undefined,
      bedrooms,
      bathrooms,
      title,
      description,
      images,
      feature,
      missing: []
    };

    // determine missing fields
    const required = ['operation','commune','price','currency','area_total','bedrooms','bathrooms','title','description'];
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
