import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Falta OPENAI_API_KEY en Vercel" }, { status: 500 });
    const { images, description } = await request.json();
    if (!Array.isArray(images) || images.length === 0) return NextResponse.json({ error: "No hay fotos" }, { status: 400 });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const content: any[] = [{
      type: "input_text",
      text: `Analiza estas fotografías de una propiedad y la descripción. Responde SOLO JSON válido con: {"mainIndex":0,"feature":"PISCINA","reason":"..."}. mainIndex es la mejor portada por luz, amplitud, atractivo y claridad. feature debe ser el atributo comercial más fuerte visible o mencionado, máximo 18 caracteres y en mayúsculas. No inventes. Descripción: ${description ?? ""}`
    }];
    for (const image of images.slice(0, 8)) content.push({ type: "input_image", image_url: image });
    const response = await client.responses.create({ model: "gpt-5-mini", input: [{ role: "user", content }] });
    const raw = response.output_text.trim().replace(/^```json\s*|```$/g, "");
    return NextResponse.json(JSON.parse(raw));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error de análisis" }, { status: 500 });
  }
}
