import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ error: "Falta OPENAI_API_KEY en Vercel" }, { status: 500 });
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File)) return NextResponse.json({ error: "Foto inválida" }, { status: 400 });

    const apiForm = new FormData();
    apiForm.append("model", "gpt-image-1-mini");
    apiForm.append("image", image, image.name || "property.jpg");
    apiForm.append("size", "1024x1024");
    apiForm.append("quality", "medium");
    apiForm.append("output_format", "jpeg");
    apiForm.append("prompt", `Retoque fotográfico inmobiliario realista. Mejora exposición, iluminación, balance de blancos, nitidez moderada, verticales y perspectiva. Recupera cielo y jardín solo si existen. Retira únicamente objetos menores distractores como bolsas, escobas, artículos de aseo, desorden menor y baja tapa de WC cuando corresponda. Conserva exactamente arquitectura, dimensiones, terminaciones, distribución, defectos estructurales y elementos permanentes. No agrandes espacios, no inventes piscina, muebles, ventanas, vistas ni vegetación. Resultado natural, profesional y fiel a la propiedad.`);

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: apiForm
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message || "OpenAI no pudo mejorar la foto");
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI no devolvió una imagen");
    return NextResponse.json({ image: `data:image/jpeg;base64,${b64}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error de mejora" }, { status: 500 });
  }
}
