import { ListingResult } from "@/types/listing";

type FlyerPreviewProps = {
  listing: ListingResult;
  brokerName: string;
  brokerPhone: string;
};

export default function FlyerPreview({ listing, brokerName, brokerPhone }: FlyerPreviewProps) {
  const mainIndex = listing.analysis?.mainPhotoIndex ?? 0;
  const secondaries = listing.analysis?.secondaryPhotoIndexes ?? [];
  const mainPhoto = listing.images[mainIndex] || listing.images[0] || "";
  const secondaryPhotos = secondaries.length > 0
    ? secondaries.map(i => listing.images[i]).filter(Boolean)
    : listing.images.filter((_, i) => i !== mainIndex).slice(0, 3);

  return (
    <div className="w-[800px] max-w-full bg-white text-slate-900 shadow-xl border border-slate-200" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="relative overflow-hidden">
        <img src={mainPhoto} alt="Portada" className="w-full h-[420px] object-cover" />
        <div className="absolute inset-x-0 top-4 flex justify-between items-center px-6">
          <img src="/mel-logo.jpg" alt="MEL Propiedades" className="h-12 w-auto" />
        </div>
        <div className="absolute left-0 top-24 w-full overflow-hidden pointer-events-none">
          <div className="absolute left-[-40%] top-0 h-14 w-[180%] bg-melred text-white uppercase tracking-[0.3em] text-sm font-bold flex items-center justify-center -rotate-12 shadow-lg">
            {listing.operation} · {listing.commune || 'SIN COMUNA'}
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="grid grid-cols-3 gap-3 mb-5">
          {secondaryPhotos.map((src, index) => (
            <img key={index} src={src ?? ''} alt={`Foto secundaria ${index + 1}`} className="h-32 w-full rounded-lg object-cover bg-slate-100" />
          ))}
          {Array.from({ length: Math.max(0, 3 - secondaryPhotos.length) }).map((_, index) => (
            <div key={index} className="h-32 w-full rounded-lg bg-slate-100" />
          ))}
        </div>

        <div className="grid grid-cols-5 gap-3 text-center mb-5">
          <div className="rounded-3xl border border-slate-200 p-4">
            <div className="text-xs uppercase text-slate-500">Superficie</div>
            <div className="mt-2 text-lg font-semibold">{listing.area_total || '—'}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 p-4">
            <div className="text-xs uppercase text-slate-500">Precio</div>
            <div className="mt-2 text-lg font-semibold">{listing.price || '—'}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 p-4">
            <div className="text-xs uppercase text-slate-500">Dormitorios</div>
            <div className="mt-2 text-lg font-semibold">{listing.bedrooms || '—'}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 p-4">
            <div className="text-xs uppercase text-slate-500">Baños</div>
            <div className="mt-2 text-lg font-semibold">{listing.bathrooms || '—'}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 p-4">
            <div className="text-xs uppercase text-slate-500">Top</div>
            <div className="mt-2 text-lg font-semibold">{listing.feature || 'DESTACADO'}</div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 p-5 bg-slate-50 mb-5">
          <div className="uppercase text-xs tracking-[0.3em] text-slate-500">Resumen</div>
          <div className="mt-3 text-base leading-6 text-slate-900">{listing.analysis?.marketingSummary || listing.description || 'Resumen no disponible.'}</div>
        </div>

        <div className="bg-melred text-white py-4 rounded-t-3xl text-center font-semibold text-base">www.melpropiedades.cl</div>
        <div className="bg-white border-t border-slate-200 p-5 text-sm text-slate-700">
          <div>{brokerName}</div>
          <div>{brokerPhone}</div>
        </div>
      </div>
    </div>
  );
}
