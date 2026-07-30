import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Falta OPENAI_API_KEY en Vercel" }, { status: 500 });
    const body = await request.json();
    const { title, description, text, images, newImages } = body;
    if (!description && !title) return NextResponse.json({ error: "Falta texto o descripción" }, { status: 400 });
    if (!Array.isArray(images) || images.length === 0) return NextResponse.json({ error: "No hay fotos" }, { status: 400 });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const promptLines = [
      "Analiza esta propiedad inmobiliaria y responde SOLO con JSON válido, sin texto adicional.",
      "Estructura exacta del JSON:",
      "{",
      "  \"propertyType\": \"\",",
      "  \"marketingSummary\": \"\",",
      "  \"featuredFeature\": \"\",",
      "  \"featuredFeatureCategory\": \"\",",
      "  \"mainPhotoIndex\": 0,",
      "  \"secondaryPhotoIndexes\": [],",
      "  \"analysisWarnings\": [],",
      "  \"photoAnalysis\": []",
      "}"
    ];

    const note = newImages && Array.isArray(newImages) && newImages.length > 0
      ? "Estas son las fotografías nuevas agregadas o reemplazadas. Revisa si alguna de ellas merece ser portada o secundaria. No vuelvas a analizar todo el texto si no es necesario."
      : "Analiza todas las fotografías para elegir la mejor portada, tres fotos secundarias y el atributo comercial más potente.";

    const content: any[] = [
      { type: "input_text", text: `${promptLines.join("\n")}\n\nTítulo: ${title || ""}\nDescripción: ${description || ""}\nTexto completo: ${text || ""}\n${note}` }
    ];

    const selectedImages = (newImages && Array.isArray(newImages) && newImages.length > 0) ? newImages : images.slice(0, 8);
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
      return NextResponse.json(parsed);
    } catch (error) {
      return NextResponse.json({ error: "OpenAI devolvió respuesta no válida", raw }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error de análisis" }, { status: 500 });
  }
}
