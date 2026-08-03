import { NextRequest, NextResponse } from "next/server";
import type { PhotoWatermarkAnalysis, PropertyAnalysis } from "@/types/listing";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_MODEL = "gemini-1.5-flash";

const ROOM_TYPES = [
  "Fachada",
  "Living",
  "Comedor",
  "Cocina",
  "Dormitorio",
  "Dormitorio principal",
  "Baño",
  "Terraza",
  "Jardín",
  "Piscina",
  "Quincho",
  "Vista",
  "Estacionamiento",
  "Bodega",
  "Oficina",
  "Área común",
  "Plano",
  "Otro"
] as const;

function normalizeRole(value: unknown): "main" | "secondary" | "discard" {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "main" || normalized === "secondary" || normalized === "discard") {
      return normalized;
    }
  }
  return "discard";
}

function normalizeRoomType(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    return ROOM_TYPES.includes(trimmed as (typeof ROOM_TYPES)[number]) ? trimmed : "Otro";
  }
  return "Otro";
}

function normalizeStringArray(value: unknown, maxItems = 4): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeCommercialScore(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeAnalysis(payload: any, imageCount: number): PropertyAnalysis {
  const photoItems = Array.isArray(payload?.photoAnalysis) ? payload.photoAnalysis : [];
  const claimedMainIndex = Number.isInteger(payload?.mainPhotoIndex) && payload.mainPhotoIndex >= 0 && payload.mainPhotoIndex < imageCount
    ? payload.mainPhotoIndex
    : -1;
  const claimedSecondaries: number[] = Array.isArray(payload?.secondaryPhotoIndexes)
    ? payload.secondaryPhotoIndexes.filter((value: unknown): value is number => typeof value === "number" && Number.isInteger(value))
        .filter((value: number) => value >= 0 && value < imageCount)
    : [];

  const normalizedPhotoAnalysis: PhotoWatermarkAnalysis[] = Array.from({ length: imageCount }, (_, index) => {
    const item = photoItems[index] ?? null;
    const commercialScore = normalizeCommercialScore(item?.commercialScore ?? item?.commercialQualityScore);
    const reason = typeof item?.reason === "string" && item.reason.trim()
      ? item.reason.trim()
      : (typeof item?.description === "string" && item.description.trim()
        ? item.description.trim()
        : "");

    return {
      index,
      commercialScore,
      recommendedRole: normalizeRole(item?.recommendedRole),
      roomType: normalizeRoomType(item?.roomType),
      strengths: normalizeStringArray(item?.strengths),
      weaknesses: normalizeStringArray(item?.weaknesses),
      reason,
      commercialQualityScore: commercialScore,
      description: reason,
      hasWatermark: Boolean(item?.hasWatermark),
      watermarkConfidence: Number.isFinite(Number(item?.watermarkConfidence)) ? Number(item.watermarkConfidence) : 0,
      watermarkDescription: typeof item?.watermarkDescription === "string" ? item.watermarkDescription : null,
      warnings: normalizeStringArray(item?.warnings)
    };
  });

  let mainIndex = claimedMainIndex;
  if (mainIndex < 0 || mainIndex >= imageCount) {
    const mainCandidate = normalizedPhotoAnalysis.findIndex((item) => item.recommendedRole === "main");
    mainIndex = mainCandidate >= 0 ? mainCandidate : 0;
  }

  let secondaryIndexes = claimedSecondaries.slice(0, 3);
  const derivedSecondaries = normalizedPhotoAnalysis
    .filter((item) => item.recommendedRole === "secondary")
    .map((item) => item.index);
  if (derivedSecondaries.length >= 3) {
    secondaryIndexes = derivedSecondaries.slice(0, 3);
  } else {
    secondaryIndexes = Array.from(new Set([...secondaryIndexes, ...derivedSecondaries]));
    const remainingCandidates = normalizedPhotoAnalysis
      .filter((item) => item.index !== mainIndex && !secondaryIndexes.includes(item.index))
      .sort((a, b) => b.commercialScore - a.commercialScore)
      .map((item) => item.index);
    for (const candidate of remainingCandidates) {
      if (secondaryIndexes.length >= 3) break;
      secondaryIndexes.push(candidate);
    }
  }
  secondaryIndexes = Array.from(new Set(secondaryIndexes)).slice(0, 3);

  const photoAnalysis: PhotoWatermarkAnalysis[] = normalizedPhotoAnalysis.map((item) => ({
    ...item,
    recommendedRole: item.index === mainIndex
      ? "main"
      : secondaryIndexes.includes(item.index)
        ? "secondary"
        : "discard"
  }));

  return {
    marketingSummary: typeof payload?.marketingSummary === "string" && payload.marketingSummary.trim()
      ? payload.marketingSummary.trim()
      : "Resumen comercial no disponible.",
    featuredFeature: typeof payload?.featuredFeature === "string" && payload.featuredFeature.trim()
      ? payload.featuredFeature.trim()
      : "",
    featuredFeatureCategory: typeof payload?.featuredFeatureCategory === "string" && payload.featuredFeatureCategory.trim()
      ? payload.featuredFeatureCategory.trim()
      : "Otro",
    orientation: typeof payload?.orientation === "string" && payload.orientation.trim()
      ? payload.orientation.trim()
      : undefined,
    mainPhotoIndex: mainIndex >= 0 && mainIndex < imageCount ? mainIndex : 0,
    secondaryPhotoIndexes: secondaryIndexes.filter((index) => index >= 0 && index < imageCount),
    analysisWarnings: Array.isArray(payload?.analysisWarnings)
      ? payload.analysisWarnings.filter((warning: unknown) => typeof warning === "string")
      : [],
    photoAnalysis
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Falta GEMINI_API_KEY en Vercel" }, { status: 500 });
    }

    const body = await request.json();
    const { title, description, text, orientation, images, newImages } = body;
    if (!description && !title) {
      return NextResponse.json({ error: "Falta texto o descripción" }, { status: 400 });
    }
    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No hay fotos" }, { status: 400 });
    }

    const note = newImages && Array.isArray(newImages) && newImages.length > 0
      ? "Estas son las fotografías nuevas agregadas o reemplazadas. Revisa si alguna de ellas merece ser portada o secundaria. No vuelvas a analizar todo el texto si no es necesario."
      : "Analiza todas las fotografías para elegir la mejor portada, tres fotos secundarias y la característica comercial más potente.";

    const prompt = `Analiza esta propiedad inmobiliaria y responde SOLO con JSON válido, sin texto adicional.
Estructura exacta del JSON:
{
  "title": "",
  "description": "",
  "orientation": "",
  "mainPhotoIndex": 0,
  "secondaryPhotoIndexes": [1, 2, 3],
  "featuredFeature": "",
  "featuredFeatureCategory": "Piscina | Quincho | Vista | Jardín | Seguridad | Estacionamiento | Terraza | Bodega | Conectividad | Otro",
  "marketingSummary": "",
  "photoAnalysis": [{
    "index": 0,
    "commercialScore": 0,
    "recommendedRole": "main",
    "roomType": "Fachada",
    "strengths": [""],
    "weaknesses": [""],
    "hasWatermark": false,
    "watermarkConfidence": 0.03,
    "watermarkDescription": null,
    "reason": ""
  }],
  "analysisWarnings": []
}

Título: ${title || ""}
Descripción: ${description || ""}
Orientación: ${orientation || ""}
Texto completo: ${text || ""}
${note}
Reglas:
- Selecciona exactamente 1 portada y exactamente 3 fotografías secundarias.
- No repitas índices ni uses índices inexistentes.
- Prioriza luminosidad, amplitud, orden, atractivo comercial y evita fotos borrosas, oscuras o redundantes.
- Evita baños como portada salvo que no existan mejores alternativas.
- Prioriza fachada, living, cocina, jardín, piscina, terraza, quincho o vista cuando tengan valor comercial.
- El quinto círculo debe ser una característica verificable en el texto o en las imágenes, sin inventar atributos.
- El resumen comercial debe ser profesional, directo y útil, máximo dos líneas.
- Para cada foto asigna un commercialScore entero entre 0 y 100, un recommendedRole, un roomType, strengths, weaknesses y una reason breve, en una sola frase.
- Para cada foto detecta marcas de agua y marca si son reutilizables. No las elimines.`;

    const selectedImages = (newImages && Array.isArray(newImages) && newImages.length > 0) ? newImages : images;
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: prompt }];
    for (const image of selectedImages) {
      const match = image.match(/^data:(.+);base64,(.*)$/);
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini devolvió error ${response.status}: ${errorText}`);
    }

    const payload = await response.json();
    const raw = payload?.candidates?.[0]?.content?.parts
      ?.filter((part: any) => typeof part?.text === "string")
      .map((part: any) => part.text)
      .join("")
      .trim() ?? "";
    const jsonText = raw.replace(/^```json\s*|```$/g, "");
    try {
      const parsed = JSON.parse(jsonText);
      return NextResponse.json(normalizeAnalysis(parsed, selectedImages.length));
    } catch (error) {
      return NextResponse.json({ error: "Gemini devolvió respuesta no válida", raw }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error de análisis" }, { status: 500 });
  }
}
