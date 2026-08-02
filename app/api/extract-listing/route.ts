import { NextRequest, NextResponse } from "next/server";
import { ExtractionSource, ListingResult } from "@/types/listing";

export const runtime = "nodejs";
export const maxDuration = 60;

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeText = (value: unknown) => clean(value).replace(/\s*[-|–|\\|]\s*Portal Inmobiliario.*$/i, '').trim();

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return clean(match[1]);
    if (match?.[0]) return clean(match[0]);
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

function deepFindPath(root: unknown, path: string[]): unknown[] {
  const found: unknown[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const [head, ...rest] = path;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === head) {
        if (rest.length === 0) found.push(value);
        else found.push(...deepFindPath(value, rest));
      }
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

function sanitizeNumber(value: string): string | null {
  const cleaned = value.replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return null;
  const dotCount = (cleaned.match(/\./g) ?? []).length;
  const commaCount = (cleaned.match(/,/g) ?? []).length;

  if (dotCount && commaCount) {
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    if (lastComma > lastDot) {
      const withoutThousands = cleaned.replace(/\./g, "");
      return withoutThousands.slice(0, lastComma) + withoutThousands.slice(lastComma + 1);
    }
    const withoutThousands = cleaned.replace(/,/g, "");
    return withoutThousands.slice(0, lastDot) + withoutThousands.slice(lastDot + 1);
  }

  if (commaCount) {
    const lastComma = cleaned.lastIndexOf(",");
    if (cleaned.length - lastComma - 1 === 3) return cleaned.replace(/,/g, "");
    return cleaned.slice(0, lastComma) + cleaned.slice(lastComma + 1);
  }

  if (dotCount) {
    const lastDot = cleaned.lastIndexOf(".");
    if (cleaned.length - lastDot - 1 === 3) return cleaned.replace(/\./g, "");
    return cleaned.slice(0, lastDot) + cleaned.slice(lastDot + 1);
  }

  return cleaned;
}

function normalizeCurrency(value: string): string {
  const cleaned = value.toUpperCase();
  if (/UF\b/i.test(cleaned) || /CLF\b/i.test(cleaned)) return "UF";
  if (/(USD|US\$|U\$S)\b/i.test(cleaned)) return "USD";
  if (/\$/i.test(cleaned) || /CLP\b/i.test(cleaned)) return "CLP";
  return "";
}

function normalizePrice(raw: string): { price: string | null; currency: string } {
  const text = clean(raw);
  if (!text) return { price: null, currency: "" };
  const currency = normalizeCurrency(text);
  const digits = sanitizeNumber(text) ?? "";
  const price = digits ? digits.replace(/\.$/, "") : null;
  return { price, currency };
}

function extractPricePattern(text: string): string {
  const patterns = [/(UF\s?[0-9][0-9\.,]*)/i, /(US\$\s?[0-9][0-9\.,]*)/i, /(\$\s?[0-9][0-9\.,]*)/i];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return clean(match[1]);
    if (match?.[0]) return clean(match[0]);
  }
  return "";
}

function extractPriceFromScript(html: string): string {
  const scriptBlocks = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  for (const script of scriptBlocks) {
    if (/window\.__INITIAL_STATE__|window\.__PRELOADED__|window\.__APOLLO_STATE__|window\.__NEXT_DATA__|window\.__/i.test(script)) continue;
    const raw = extractPricePattern(script);
    if (raw && !/Gastos comunes/i.test(script)) return raw;
  }
  return "";
}

function extractPriceFromInitialState(html: string): string {
  const scriptBlocks = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  for (const script of scriptBlocks) {
    if (!/window\.__INITIAL_STATE__|window\.__PRELOADED__|window\.__APOLLO_STATE__|window\.__NEXT_DATA__|window\.__/i.test(script)) continue;
    const raw = extractPricePattern(script);
    if (raw && !/Gastos comunes/i.test(script)) return raw;
  }
  return "";
}

function extractPriceFromMeta(html: string): string {
  return firstMatch(html, [/(UF\s?[0-9][0-9\.,]*)/i, /(US\$\s?[0-9][0-9\.,]*)/i, /(\$\s?[0-9][0-9\.,]*)/i, /Precio[^\d]{0,10}([0-9\.,]+\s*(?:UF|US\$|\$|CLP)?)/i]);
}

function extractPriceFromVisibleText(text: string): string {
  return firstMatch(text, [/(UF\s?[0-9][0-9\.,]*)/i, /(US\$\s?[0-9][0-9\.,]*)/i, /(\$\s?[0-9][0-9\.,]*)/i]);
}

function normalizeOperation(value: string): string {
  const normalized = value.toUpperCase();
  if (/ARRIENDO|ALQUILER/.test(normalized)) return "ARRIENDO";
  return "VENTA";
}

function normalizePropertyType(value: string): string | null {
  const normalized = value.toLowerCase();
  if (/(casa|house|single family|single-family)/.test(normalized)) return "Casa";
  if (/(departamento|depto|dpto|apartment|apto)/.test(normalized)) return "Departamento";
  if (/(parcela|parcel)/.test(normalized)) return "Parcela";
  if (/(oficina|office)/.test(normalized)) return "Oficina";
  if (/(local comercial|local|comercial)/.test(normalized)) return "Local comercial";
  if (/(terreno|land)/.test(normalized)) return "Terreno";
  if (/(sitio)/.test(normalized)) return "Sitio";
  if (/(bodega|warehouse)/.test(normalized)) return "Bodega";
  if (/(estacionamiento|parking)/.test(normalized)) return "Estacionamiento";
  return null;
}

function cleanDescription(value: string | null, title: string | null): string | null {
  if (!value) return null;
  let description = clean(value);
  if (title) {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    description = description.replace(new RegExp(`^${escapedTitle}[\\s:\\-–]*`, "i"), "").trim();
    description = description.replace(new RegExp(escapedTitle, "gi"), "").trim();
  }
  description = description.replace(/^\s*Descripción:\s*/i, "").trim();
  return description || null;
}

const communeNoiseRegex = /\b(?:comuna|comuna de|sector|barrio|condominio|edificio|torre|av\.?|ave\.?|avenida|calle|pasaje|camino|ruta|parcela|lote|unidad|ph|urbanizaci[oó]n|urbanizacion|condominio)\b/gi;
const knownNeighborhoods = /\b(?:Lo Curro|La Dehesa|Jard[ií]n del Este|Chamisero|Chicureo|Santa Mar[ií]a de Manquehue|Los Trapenses|El Golf)\b/i;
const regionBreadcrumbRegex = /\b(?:RM|Reg[ií]on Metropolitana|Region Metropolitana|Metropolitana|Regi[oó]n)\b/i;

function stripCommuneNoise(value: string): string {
  return clean(value)
    .replace(communeNoiseRegex, '')
    .replace(/[\/|•·]/g, ' ')
    .replace(/\s+/g, ' ',)
    .trim();
}

function normalizeCommune(value: string | null): string | null {
  if (!value) return null;
  const raw = clean(value);
  const parts = raw.split(/[,\/|•·]+/).map(part => part.trim()).filter(Boolean);
  const candidates = parts.flatMap(part => part.split(/\s*[-–]\s*/).map(p => p.trim()).filter(Boolean));
  const normalized = candidates
    .map(stripCommuneNoise)
    .map(clean)
    .filter(Boolean)
    .map(v => v.toUpperCase())
    .filter(v => !/^(?:RM|REGI[OÓ]N|METROPOLITANA|CHILE|SANTIAGO)$/i.test(v))
    .filter(v => !knownNeighborhoods.test(v))
    .filter(v => !/^(?:CASAS?|DEPARTAMENTOS?|ARRIENDO|ALQUILER|VENTA|PROPIEDADES?|USADAS|NUEVAS|CONDOMINIO|BARRIO|SECTOR|DIRECCION|UBICACION)$/i.test(v));
  return normalized.length ? normalized[normalized.length - 1] : null;
}

function extractCommuneFromJsonLd(html: string, jsonLd: unknown[]): string {
  const addressCandidates = [
    ...deepFind(jsonLd, ['addressLocality']),
    ...deepFind(jsonLd, ['locality'])
  ].filter((value): value is string => typeof value === 'string');
  for (const candidate of addressCandidates) {
    const commune = normalizeCommune(candidate);
    if (commune) return commune;
  }

  const breadcrumbNames: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    const obj = node as Record<string, unknown>;
    if (obj['@type'] === 'BreadcrumbList' && Array.isArray(obj['itemListElement'])) {
      for (const item of obj['itemListElement']) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const itemObj = item as Record<string, unknown>;
        const reference = itemObj['item'] ?? itemObj;
        if (!reference || typeof reference !== 'object' || Array.isArray(reference)) continue;
        const referenceObj = reference as Record<string, unknown>;
        if (typeof referenceObj['name'] === 'string') {
          breadcrumbNames.push(clean(referenceObj['name']));
        }
      }
    }
    Object.values(obj).forEach(visit);
  };
  visit(jsonLd);

  const regionIndex = breadcrumbNames.findIndex(name => regionBreadcrumbRegex.test(name));
  if (regionIndex !== -1) {
    for (let i = regionIndex + 1; i < breadcrumbNames.length; i++) {
      const commune = normalizeCommune(breadcrumbNames[i]);
      if (commune) return commune;
    }
  }

  for (let i = breadcrumbNames.length - 1; i >= 0; i--) {
    const commune = normalizeCommune(breadcrumbNames[i]);
    if (commune) return commune;
  }

  return '';
}

function extractCommuneFromScripts(html: string, includeInitialState: boolean): string {
  const scriptBlocks = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  for (const script of scriptBlocks) {
    const isInitial = /window\.__INITIAL_STATE__|window\.__PRELOADED__|window\.__APOLLO_STATE__|window\.__NEXT_DATA__|window\.__/i.test(script);
    if (includeInitialState !== isInitial) continue;
    const rawCommune = firstMatch(script, [
      /["']addressLocality["']\s*[:=]\s*["']([^"']+)["']/i,
      /["']locality["']\s*[:=]\s*["']([^"']+)["']/i,
      /["']comuna["']\s*[:=]\s*["']([^"']+)["']/i,
      /["']commune["']\s*[:=]\s*["']([^"']+)["']/i,
      /["']city["']\s*[:=]\s*["']([^"']+)["']/i,
      /addressLocality\s*[:=]\s*["']([^"']+)["']/i,
      /locality\s*[:=]\s*["']([^"']+)["']/i
    ]);
    if (rawCommune && normalizeCommune(rawCommune)) return rawCommune;
  }
  return '';
}

function extractCommuneFromMeta(html: string): string {
  const rawCommune = firstMatch(html, [
    /Comuna\s*[:\-–]?\s*([A-ZÁÉÍÓÚÑ][^"'<>\n]{1,40})/i,
    /Ubicaci[oó]n\s*[:\-–]?\s*([A-ZÁÉÍÓÚÑ][^"'<>\n]{1,40})/i,
    /ubicaci[oó]n\s*[:\-–]?\s*([A-ZÁÉÍÓÚÑ][^"'<>\n]{1,40})/i
  ]);
  return rawCommune && normalizeCommune(rawCommune) ? rawCommune : '';
}

function extractCommuneFromVisibleText(text: string): string {
  const rawCommune = firstMatch(text, [
    /Comuna\s*[:\-–]?\s*([A-ZÁÉÍÓÚÑ][^\n]{1,40})/i,
    /Ubicaci[oó]n\s*[:\-–]?\s*([A-ZÁÉÍÓÚÑ][^\n]{1,40})/i
  ]);
  return rawCommune && normalizeCommune(rawCommune) ? rawCommune : '';
}

function normalizeArea(value: string | null): string | null {
  if (!value) return null;
  const digits = sanitizeNumber(value);
  return digits ? `${digits} m²` : null;
}

function addSource(sources: ExtractionSource[], field: string, source: string, rawValue: unknown, normalizedValue: unknown): void {
  sources.push({ field, source, rawValue: clean(rawValue), normalizedValue: clean(normalizedValue) });
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
    const combinedText = `${plain} ${JSON.stringify(jsonLd)}`;
    const listingContext = `${html} ${plain} ${JSON.stringify(jsonLd)}`;
    const priceSearchText = combinedText.replace(/Gastos comunes[\s\S]{0,80}?([0-9\.,]+\s*(?:UF|US\$|\$|CLP)?)/gi, '');

    const getMetaFirst = (patterns: RegExp[]) => firstMatch(html, patterns);
    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const getJsonLdFirst = (keys: string[]) => {
      for (const key of keys) {
        const path = key.split('.');
        const found = path.length > 1 ? deepFindPath(jsonLd, path) : deepFind(jsonLd, [key]);
        for (const v of found) if (v) return clean(String(typeof v === 'object' ? JSON.stringify(v) : v));
      }
      return '';
    };

    const sources: ExtractionSource[] = [];

    const rawTitle = getJsonLdFirst(['name']) || getMetaFirst([/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i]) || firstMatch(html, [/<title>([^<]+)/i]);
    const title = rawTitle ? normalizeText(rawTitle) : null;
    addSource(sources, 'title', 'json-ld/meta/title', rawTitle, title);

    let description = getJsonLdFirst(['description']) || getMetaFirst([/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i]) || null;
    description = cleanDescription(description, title);
    addSource(sources, 'description', 'json-ld/meta/description', description, description);

    const rawOperation = firstMatch(`${title || ''} ${description || ''} ${combinedText}`.toLowerCase(), [/arriendo|alquiler/i, /venta/i]) || 'VENTA';
    const operation = normalizeOperation(rawOperation);
    addSource(sources, 'operation', 'text-analysis', rawOperation, operation);

    let rawPrice = "";
    let rawCurrency = "";
    let priceSource = "";

    const jsonLdPrice = getJsonLdFirst(['offers.price','price','offers.priceSpecification.price','offers.priceSpecification.price']);
    const jsonLdCurrency = getJsonLdFirst(['offers.priceCurrency','priceCurrency','offers.priceSpecification.priceCurrency','offers.priceSpecification.priceCurrency']);
    if (jsonLdPrice || jsonLdCurrency) {
      rawPrice = jsonLdPrice;
      rawCurrency = jsonLdCurrency;
      priceSource = 'json-ld';
    }

    if (!rawPrice) {
      const embeddedPrice = extractPriceFromScript(html);
      if (embeddedPrice) {
        rawPrice = embeddedPrice;
        priceSource = 'embedded-script';
      }
    }

    if (!rawPrice) {
      const initialStatePrice = extractPriceFromInitialState(html);
      if (initialStatePrice) {
        rawPrice = initialStatePrice;
        priceSource = 'initial-state';
      }
    }

    if (!rawPrice) {
      const metaPrice = extractPriceFromMeta(html);
      if (metaPrice) {
        rawPrice = metaPrice;
        priceSource = 'meta';
      }
    }

    if (!rawPrice) {
      const visiblePrice = extractPriceFromVisibleText(priceSearchText);
      if (visiblePrice) {
        rawPrice = visiblePrice;
        priceSource = 'visible-text';
      }
    }

    const normalizedPrice = normalizePrice(rawPrice);
    const price = normalizedPrice.price;
    const currency = normalizeCurrency(rawCurrency || rawPrice);
    addSource(sources, 'price', priceSource || 'unknown', rawPrice, price);
    addSource(sources, 'currency', priceSource || 'unknown', rawPrice || rawCurrency, currency);

    const technicalSection = html.match(/Ficha técnica[\s\S]{0,300}?<\/(?:(?:div|section|ul|li)|p)>/i)?.[0] || '';
    const bedroomsRaw = firstMatch(technicalSection, [/Dormitorios?\s*[:\-–]?\s*([0-9]+)/i, /([0-9]+)\s*Dormitorios?/i]) || getJsonLdFirst(['numberOfRooms','numberOfBedrooms','numBedrooms']) || firstMatch(combinedText, [/([0-9]+)\s*(?:dormitorios?|habitaciones?)/i, /(?:dormitorios?|habitaciones?)[^\d]{0,20}([0-9]+)/i]) || '';
    const bathroomsRaw = getJsonLdFirst(['numberOfBathroomsTotal','numberOfBathrooms','bathroomCount']) || firstMatch(combinedText, [/([0-9]+)\s*baños?/i, /baños?[^\d]{0,20}([0-9]+)/i]) || '';
    const parkingRaw = getJsonLdFirst(['numberOfParkingSpaces','parking','parkingSpaces']) || firstMatch(combinedText, [/([0-9]+)\s*estacionamientos?/i, /estacionamiento[s]?[^\d]{0,20}([0-9]+)/i]) || '';
    const bedrooms = bedroomsRaw ? sanitizeNumber(bedroomsRaw) : null;
    const bathrooms = bathroomsRaw ? sanitizeNumber(bathroomsRaw) : null;
    const parking = parkingRaw ? sanitizeNumber(parkingRaw) : null;
    addSource(sources, 'bedrooms', 'technical/text', bedroomsRaw, bedrooms);
    addSource(sources, 'bathrooms', 'technical/text', bathroomsRaw, bathrooms);
    addSource(sources, 'parking', 'technical/text', parkingRaw, parking);

    const rawAreaTotal = getJsonLdFirst(['floorSize','area','areaTotal','surface','area_total']) || firstMatch(combinedText, [/([0-9\.,]+)\s*m²\s*(?:totales?|terreno|útiles?)/i, /(?:superficie total|superficie)(?:[^\d]{0,30})([0-9\.,]+)\s*m/i]) || '';
    const rawAreaUsable = getJsonLdFirst(['areaUsable','area_usable','usableArea']) || firstMatch(combinedText, [/superficie úti[le]s?[\s:\-]*([0-9\.,]+)\s*m/i, /m²\s*útil\s*:?[^\d]*([0-9\.,]+)/i]) || '';
    const area_total = normalizeArea(rawAreaTotal);
    const area_usable = normalizeArea(rawAreaUsable);
    addSource(sources, 'area_total', 'json-ld/text', rawAreaTotal, area_total);
    addSource(sources, 'area_usable', 'json-ld/text', rawAreaUsable, area_usable);

    const bodegasRaw = firstMatch(listingContext, [/Bodega[s]?\s*[:\-–]?\s*([0-9]+)/i, /Bodegas?.{0,20}?([0-9]+)/i]) || '';
    const bodegas = bodegasRaw ? sanitizeNumber(bodegasRaw) : null;
    addSource(sources, 'bodegas', 'html/text', bodegasRaw, bodegas);

    const gastosComunesRaw = firstMatch(listingContext, [/Gastos comunes\s*[:\-–]?\s*([0-9\.,]+\s*(?:UF|\$|CLP)?)/i, /Gastos comunes.{0,30}?([0-9\.,]+\s*(?:UF|\$|CLP)?)/i]) || '';
    const gastos_comunes = gastosComunesRaw ? clean(gastosComunesRaw) : null;
    addSource(sources, 'gastos_comunes', 'html/text', gastosComunesRaw, gastos_comunes);

    const orientacionRaw = firstMatch(listingContext, [/Orientaci[oó]n\s*[:\-–]?\s*([NSEWO]{1,5})/i, /Orientaci[oó]n\s*[:\-–]?\s*([A-Za-z ]+)/i]) || '';
    const orientacion = orientacionRaw ? clean(orientacionRaw) : null;
    addSource(sources, 'orientacion', 'html/text', orientacionRaw, orientacion);

let rawCommune = extractCommuneFromJsonLd(html, jsonLd);
    let communeSource = 'json-ld';

    if (!rawCommune) {
      rawCommune = extractCommuneFromScripts(html, false);
      communeSource = rawCommune ? 'embedded-script' : communeSource;
    }

    if (!rawCommune) {
      rawCommune = extractCommuneFromScripts(html, true);
      communeSource = rawCommune ? 'initial-state' : communeSource;
    }

    if (!rawCommune) {
      rawCommune = extractCommuneFromMeta(html);
      communeSource = rawCommune ? 'meta' : communeSource;
    }

    if (!rawCommune) {
      rawCommune = extractCommuneFromVisibleText(plain);
      communeSource = rawCommune ? 'visible-text' : communeSource;
    }

    const commune = normalizeCommune(rawCommune);
    addSource(sources, 'commune', communeSource || 'unknown', rawCommune, commune);

    const images = pickImages(html, jsonLd);
    const feature = inferFeature(`${title || ''} ${description || ''} ${plain}`);

    const rawType = getJsonLdFirst(['@type','type','category','propertyType','additionalType']) || '';
    let propertyType = normalizePropertyType(rawType) || normalizePropertyType(`${title || ''} ${description || ''} ${listingContext}`) || null;
    if (!propertyType) {
      const cleanType = clean(rawType).toLowerCase();
      if (cleanType.includes('local')) propertyType = 'Local comercial';
      else if (cleanType.includes('estacionamiento')) propertyType = 'Estacionamiento';
      else if (cleanType.includes('bodega')) propertyType = 'Bodega';
      else if (/departamento/i.test(listingContext)) propertyType = 'Departamento';
      else if (/casa/i.test(listingContext)) propertyType = 'Casa';
    }
    addSource(sources, 'propertyType', 'html/text', rawType, propertyType);

    const result: ListingResult = {
      operation,
      commune,
      price: price || null,
      currency: currency || '',
      area_total: area_total || null,
      area_usable: area_usable || null,
      bedrooms: bedrooms || null,
      bathrooms: bathrooms || null,
      title,
      description,
      raw_text: plain || null,
      images,
      feature,
      propertyType: propertyType || null,
      parking: parking || null,
      bodegas: bodegas || null,
      gastos_comunes: gastos_comunes || null,
      orientacion: orientacion || null,
      missing: []
    };

    const warnings: string[] = [];
    if (!result.currency && result.price) warnings.push('Precio detectado sin moneda explícita');
    if (result.price && result.gastos_comunes && String(result.gastos_comunes).includes(String(result.price))) warnings.push('Precio posiblemente confundido con gastos comunes');
    if (result.description && title && result.description.toLowerCase() === title.toLowerCase()) warnings.push('Descripción iguala al título');
    if (!result.commune && (title || description || plain)) warnings.push('No se pudo determinar la comuna con claridad');
    if (result.area_total && result.area_usable && result.area_total === result.area_usable) warnings.push('Áreas útil y total duplicadas');
    if (!result.title) warnings.push('Título no encontrado');
    if (!result.description) warnings.push('Descripción no encontrada');

    const required = ['operation','commune','price','currency','area_total','bedrooms','bathrooms','title','description','propertyType'];
    for (const key of required) {
      // @ts-ignore
      if (!result[key]) result.missing!.push(key);
    }

    const status = result.missing && result.missing.length ? 'partial' : 'ok';
    result.extractionWarnings = warnings;
    result.extractionSources = sources;

    return NextResponse.json({ status, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al extraer' }, { status: 500 });
  }
}
