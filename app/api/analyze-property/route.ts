import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { PropertyAnalysis } from "@/types/listing";

export const runtime = "nodejs";
export const maxDuration = 60;

function normalizeAnalysis(payload: any, imageCount: number): PropertyAnalysis {
  const safeMainIndex = Number.isInteger(payload?.mainPhotoIndex) && payload.mainPhotoIndex >= 0 && payload.mainPhotoIndex < imageCount
    ? payload.mainPhotoIndex
    : 0;

  const secondaryIndexes: number[] = Array.isArray(payload?.secondaryPhotoIndexes)
    ? payload.secondaryPhotoIndexes.filter((value: unknown): value is number => typeof value === "number" && Number.isInteger(value))
        .filter((value: number) => value >= 0 && value < imageCount)
        .slice(0, 3)
    : [];

  const uniqueSecondaries: number[] = Array.from(new Set(secondaryIndexes));
  if (uniqueSecondaries.length < 3 && imageCount > 1) {
    for (let index = 0; index < imageCount && uniqueSecondaries.length < 3; index += 1) {
      if (index !== safeMainIndex && !uniqueSecondaries.includes(index)) {
        uniqueSecondaries.push(index);
      }
    }
  }

  const photoAnalysis = Array.from({ length: imageCount }, (_, index) => {
    const item = Array.isArray(payload?.photoAnalysis) ? payload.photoAnalysis[index] : null;
    const warnings = Array.isArray(item?.warnings)
      ? item.warnings.filter((warning: unknown) => typeof warning === "string")
      : [];

    return {
      index,
      commercialQualityScore: Number.isFinite(Number(item?.commercialQualityScore)) ? Math.max(0, Math.min(100, Number(item.commercialQualityScore))) : 0,
      description: typeof item?.description === "string" ? item.description : "",
      hasWatermark: Boolean(item?.hasWatermark),
      watermarkConfidence: Number.isFinite(Number(item?.watermarkConfidence)) ? Math.max(0, Math.min(100, Number(item.watermarkConfidence))) : 0,
      watermarkDescription: typeof item?.watermarkDescription === "string" ? item.watermarkDescription : null,
      warnings
    };
  });

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
    mainPhotoIndex: safeMainIndex,
    secondaryPhotoIndexes: uniqueSecondaries,
    analysisWarnings: Array.isArray(payload?.analysisWarnings)
      ? payload.analysisWarnings.filter((warning: unknown) => typeof warning === "string")
      : [],
    photoAnalysis
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Falta OPENAI_API_KEY en Vercel" }, { status: 500 });
    }

    const body = await request.json();
    const { title, description, text, images, newImages } = body;
    if (!description && !title) {
      return NextResponse.json({ error: "Falta texto o descripción" }, { status: 400 });
    }
    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No hay fotos" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const note = newImages && Array.isArray(newImages) && newImages.length > 0
      ? "Estas son las fotografías nuevas agregadas o reemplazadas. Revisa si alguna de ellas merece ser portada o secundaria. No vuelvas a analizar todo el texto si no es necesario."
      : "Analiza todas las fotografías para elegir la mejor portada, tres fotos secundarias y la característica comercial más potente.";

    const content: any[] = [{
      type: "input_text",
      text: `Analiza esta propiedad inmobiliaria y responde SOLO con JSON válido, sin texto adicional.
Estructura exacta del JSON:
{
  "mainPhotoIndex": 0,
  "secondaryPhotoIndexes": [1, 2, 3],
  "featuredFeature": "",
  "featuredFeatureCategory": "Piscina | Quincho | Vista | Jardín | Seguridad | Estacionamiento | Terraza | Bodega | Conectividad | Otro",
  "marketingSummary": "",
  "photoAnalysis": [{
    "index": 0,
    "commercialQualityScore": 0,
    "description": "",
    "hasWatermark": false,
    "watermarkConfidence": 0,
    "watermarkDescription": null,
    "warnings": []
  }],
  "analysisWarnings": []
}

Título: ${title || ""}
Descripción: ${description || ""}
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
- Para cada foto detecta marcas de agua y marca si son reutilizables. No las elimines.`
    }];

    const selectedImages = (newImages && Array.isArray(newImages) && newImages.length > 0) ? newImages : images;
    for (const image of selectedImages) {
      content.push({ type: "input_image", image_url: image });
    }

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [{ role: "user", content }]
    });

    const raw = (response.output_text?.trim() ??
      response.output
        ?.flatMap((item: any) => item.content ?? [])
        .map((part: any) => part.text ?? "")
        .join("")
        .trim() ??
      "");
    const jsonText = raw.replace(/^```json\s*|```$/g, "");
    try {
      const parsed = JSON.parse(jsonText);
      return NextResponse.json(normalizeAnalysis(parsed, selectedImages.length));
    } catch (error) {
      return NextResponse.json({ error: "OpenAI devolvió respuesta no válida", raw }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error de análisis" }, { status: 500 });
  }
}
