"use client";

import { useMemo, useRef, useState } from "react";
import { Bath, BedDouble, Camera, Download, Loader2, MapPin, Maximize2, Sparkles, Tag, Upload, Waves } from "lucide-react";

const brokers = [
  ["Carla Fucito Calderón", "+569 7558 2708"],
  ["Francisca Alarcón", "+569 5416 4474"],
  ["Soledad Velasco", "+569 9736 4205"],
  ["Verónica Vergara", "+569 7675 8419"],
  ["Francisco Monti", "+569 5914 4757"],
  ["Rodrigo Lama", "+569 7792 5335"],
  ["Francisca Parada", "+569 9320 7474"]
];

type Data = {
  operation: string; commune: string; price: string; area: string;
  bedrooms: string; bathrooms: string; feature: string;
  title: string; description: string; images: string[];
};

const empty: Data = { operation: "VENTA", commune: "ÑUÑOA", price: "", area: "", bedrooms: "", bathrooms: "", feature: "DESTACADO", title: "", description: "", images: [] };

export default function Home() {
  const [url, setUrl] = useState("https://www.portalinmobiliario.com/MLC-2062074019-increible-departamento-en-venta-3d2b-en-nunoa-_JM");
  const [data, setData] = useState<Data>(empty);
  const [broker, setBroker] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [mainIndex, setMainIndex] = useState(0);
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const flyerRef = useRef<HTMLDivElement>(null);

  const shownPhotos = useMemo(() => {
    const arr = photos.length ? photos : data.images;
    if (!arr.length) return ["/template-reference.png", "/template-reference.png", "/template-reference.png", "/template-reference.png"];
    const ordered = [arr[mainIndex], ...arr.filter((_, i) => i !== mainIndex)];
    while (ordered.length < 4) ordered.push(ordered[ordered.length - 1]);
    return ordered.slice(0, 4);
  }, [photos, data.images, mainIndex]);

  async function extract() {
    setLoading("Extrayendo datos del aviso…"); setMessage("");
    try {
      const res = await fetch("/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json); setPhotos(json.images || []); setMainIndex(0);
      setMessage("Datos extraídos. Puedes corregir cualquier campo antes de generar.");
    } catch (e) { setMessage(`No se pudo extraer automáticamente: ${e instanceof Error ? e.message : "error"}. Puedes completar los campos manualmente.`); }
    finally { setLoading(""); }
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const urls = await Promise.all([...files].slice(0, 8).map(file => new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
    })));
    setPhotos(urls); setMainIndex(0);
  }

  async function analyze() {
    const imgs = photos.length ? photos : data.images;
    if (!imgs.length) return setMessage("Primero carga o extrae fotografías.");
    setLoading("La IA está eligiendo portada y atributo destacado…");
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ images: imgs, description: `${data.title} ${data.description}` }) });
      const json = await res.json(); if (!res.ok) throw new Error(json.error);
      setMainIndex(Math.max(0, Math.min(Number(json.mainIndex) || 0, imgs.length - 1)));
      setData(d => ({ ...d, feature: json.feature || d.feature }));
      setMessage(`IA: ${json.reason || "portada y quinto círculo seleccionados"}`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "No se pudo analizar"); }
    finally { setLoading(""); }
  }

  async function enhanceFirstFour() {
    const imgs = photos.length ? photos : data.images;
    if (!imgs.length) return setMessage("Primero carga o extrae fotografías.");
    setLoading("Mejorando hasta 4 fotos con IA…");
    try {
      const enhanced: string[] = [];
      for (let i = 0; i < Math.min(4, imgs.length); i++) {
        setLoading(`Mejorando foto ${i + 1} de ${Math.min(4, imgs.length)}…`);
        const blob = await (await fetch(imgs[i])).blob();
        const form = new FormData(); form.append("image", new File([blob], `foto-${i + 1}.jpg`, { type: blob.type || "image/jpeg" }));
        const res = await fetch("/api/enhance", { method: "POST", body: form });
        const json = await res.json(); if (!res.ok) throw new Error(json.error);
        enhanced.push(json.image);
      }
      setPhotos([...enhanced, ...imgs.slice(enhanced.length)]); setMainIndex(0);
      setMessage("Fotografías mejoradas respetando la realidad de la propiedad.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "No se pudieron mejorar las fotos"); }
    finally { setLoading(""); }
  }

  async function downloadPdf() {
    if (!flyerRef.current) return;
    setLoading("Generando PDF…");
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(flyerRef.current, { scale: 2, useCORS: true, backgroundColor: "#fff" });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [210, 315] });
      pdf.addImage(canvas.toDataURL("image/jpeg", .94), "JPEG", 0, 0, 210, 315);
      pdf.save(`MEL-${data.operation}-${data.commune || "propiedad"}.pdf`);
    } finally { setLoading(""); }
  }

  async function sharePdf() {
    if (!flyerRef.current) return setMessage("No hay flyer para compartir.");
    if (!('canShare' in navigator) && !('share' in navigator)) return setMessage('Compartir no está disponible en este navegador.');
    setLoading('Generando PDF para compartir…');
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const canvas = await html2canvas(flyerRef.current, { scale: 2, useCORS: true, backgroundColor: '#fff' });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [210, 315] });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 315);
      const blob = pdf.output('blob');
      const file = new File([blob], `MEL-${data.operation}-${data.commune || 'propiedad'}.pdf`, { type: 'application/pdf' });
      if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
        await (navigator as any).share({ files: [file], title: 'MEL Flyer', text: `${data.title || ''}` });
      } else if ((navigator as any).share) {
        // Fallback: provide a downloadable URL
        const url = URL.createObjectURL(blob);
        await (navigator as any).share({ title: 'MEL Flyer', text: `${data.title || ''} - Descargar: ${url}` }).catch(() => {});
        URL.revokeObjectURL(url);
      } else {
        setMessage('Compartir no soportado para archivos en este dispositivo.');
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Error compartiendo PDF'); }
    finally { setLoading(''); }
  }

  const set = (key: keyof Data, value: string) => setData(d => ({ ...d, [key]: value }));

  return <main>
    <section className="panel">
      <div className="brand"><img src="/mel-logo.jpg" alt="MEL Propiedades"/><div><h1>Generador de flyer</h1><p>Portal → IA → PDF listo para compartir</p></div></div>
      <label>Corredor</label>
      <select value={broker} onChange={e => setBroker(Number(e.target.value))}>{brokers.map((b, i) => <option key={b[0]} value={i}>{b[0]}</option>)}</select>
      <label>Enlace de Portal Inmobiliario</label>
      <div className="row"><input value={url} onChange={e => setUrl(e.target.value)} /><button onClick={extract}>Extraer</button></div>
      <div className="grid">
        <Field label="Operación" value={data.operation} onChange={v => set("operation", v.toUpperCase())}/>
        <Field label="Comuna" value={data.commune} onChange={v => set("commune", v.toUpperCase())}/>
        <Field label="Superficie" value={data.area} onChange={v => set("area", v)}/>
        <Field label="Precio" value={data.price} onChange={v => set("price", v)}/>
        <Field label="Dormitorios" value={data.bedrooms} onChange={v => set("bedrooms", v)}/>
        <Field label="Baños" value={data.bathrooms} onChange={v => set("bathrooms", v)}/>
        <Field label="Quinto círculo" value={data.feature} onChange={v => set("feature", v.toUpperCase())}/>
      </div>
      <label className="upload"><Upload size={18}/> Cargar fotos del teléfono<input type="file" accept="image/*" multiple onChange={e => addFiles(e.target.files)}/></label>
      <div className="actions"><button className="secondary" onClick={analyze}><Sparkles size={17}/> Elegir portada y destacado</button><button className="secondary" onClick={enhanceFirstFour}><Camera size={17}/> Mejorar 4 fotos con IA</button></div>
      {loading && <p className="status"><Loader2 className="spin" size={18}/>{loading}</p>}
      {message && <p className="message">{message}</p>}
      <div style={{display:'flex',gap:8}}>
        <button className="download" onClick={downloadPdf}><Download size={19}/> Generar PDF</button>
        <button className="download" onClick={sharePdf}><Download size={19}/> Compartir</button>
      </div>
      <p className="hint">Toca una miniatura en la vista previa para convertirla en portada.</p>
    </section>

    <section className="preview-wrap">
      <div className="flyer" ref={flyerRef}>
        <div className="hero"><img src={shownPhotos[0]} crossOrigin="anonymous" alt="Portada"/><img className="flyer-logo" src="/mel-logo.jpg" alt="MEL"/><div className="ribbon"><strong>{data.operation || "VENTA"}</strong><strong>{data.commune || "COMUNA"}</strong></div></div>
        <div className="thumbs">{shownPhotos.slice(1,4).map((p,i)=><img key={i} src={p} crossOrigin="anonymous" alt="Propiedad" onClick={()=>setMainIndex((mainIndex+i+1)%Math.max(1,(photos.length||data.images.length)))}/>)}</div>
        <div className="facts">
          <Fact icon={<Maximize2/>} value={data.area || "—"} label="SUPERFICIE"/>
          <Fact icon={<Tag/>} value={data.price || "—"} label="PRECIO"/>
          <Fact icon={<BedDouble/>} value={data.bedrooms || "—"} label="DORMITORIOS"/>
          <Fact icon={<Bath/>} value={data.bathrooms || "—"} label="BAÑOS"/>
          <Fact icon={/PISCINA/i.test(data.feature)?<Waves/>:<MapPin/>} value={data.feature === "PISCINA" ? "SÍ" : "★"} label={data.feature || "DESTACADO"}/>
        </div>
        <div className="web">WWW.MELPROPIEDADES.CL</div>
        <div className="footer"><span>◉</span><strong>{brokers[broker][0]}</strong><i></i><strong>{brokers[broker][1]}</strong></div>
      </div>
    </section>
  </main>
}

function Field({label,value,onChange}:{label:string,value:string,onChange:(v:string)=>void}) { return <div><label>{label}</label><input value={value} onChange={e=>onChange(e.target.value)}/></div> }
function Fact({icon,value,label}:{icon:React.ReactNode,value:string,label:string}) { return <div className="fact"><div className="circle">{icon}</div><strong>{value}</strong><span>{label}</span></div> }
