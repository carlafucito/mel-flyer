import { ListingResult } from "@/types/listing";

type MelFlyerPreviewProps = {
  listing: ListingResult;
  brokerName: string;
  brokerPhone: string;
};

export default function MelFlyerPreview({ listing, brokerName, brokerPhone }: MelFlyerPreviewProps) {
  const mainIndex = listing.analysis?.mainPhotoIndex ?? 0;
  const secondaryIndexes = listing.analysis?.secondaryPhotoIndexes ?? [];
  const mainPhoto = listing.images[mainIndex] || listing.images[0] || "";
  const secondaryPhotos = secondaryIndexes
    .map((index) => listing.images[index])
    .filter(Boolean)
    .slice(0, 3);

  const missingFields = [
    !mainPhoto && "portada",
    secondaryPhotos.length !== 3 && "tres fotos secundarias",
    !listing.operation && "operación",
    !listing.commune && "comuna",
    !listing.area_total && "superficie",
    !listing.price && "precio",
    !listing.bedrooms && "dormitorios",
    !listing.bathrooms && "baños",
    !(listing.feature || listing.analysis?.featuredFeature) && "característica destacada"
  ].filter(Boolean) as string[];

  if (missingFields.length > 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
        Faltan datos esenciales para generar el flyer: {missingFields.join(", ")}. Completa estos campos y vuelve a intentarlo.
      </div>
    );
  }

  return (
    <div className="w-full max-w-[900px] bg-white text-slate-900 shadow-xl border border-slate-200 overflow-hidden" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="relative overflow-hidden">
        <img src={mainPhoto} alt="Fotografía principal" className="w-full h-[320px] sm:h-[420px] object-cover" />
        <div className="absolute inset-x-0 top-4 flex justify-between items-center px-4 sm:px-6">
          <img src="/mel-logo.jpg" alt="MEL Propiedades" className="h-10 sm:h-12 w-auto" />
        </div>
        <div className="absolute left-0 top-24 w-full overflow-hidden pointer-events-none">
          <div className="absolute left-[-30%] top-0 h-12 sm:h-14 w-[160%] bg-[#c41e3a] text-white uppercase tracking-[0.3em] text-xs sm:text-sm font-bold flex items-center justify-center -rotate-12 shadow-lg">
            {listing.operation} · {listing.commune || "SIN COMUNA"}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
          {secondaryPhotos.map((src, index) => (
            <img key={`${src}-${index}`} src={src ?? ""} alt={`Foto secundaria ${index + 1}`} className="h-24 sm:h-32 w-full rounded-lg object-cover bg-slate-100" />
          ))}
        </div>

        <div className="grid grid-cols-5 gap-2 sm:gap-3 text-center mb-4 sm:mb-5">
          <div className="rounded-2xl border border-slate-200 p-2 sm:p-3 bg-slate-50">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Superficie</div>
            <div className="mt-1 text-sm sm:text-lg font-semibold">{listing.area_total || "—"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-2 sm:p-3 bg-slate-50">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Precio</div>
            <div className="mt-1 text-sm sm:text-lg font-semibold">{listing.price || "—"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-2 sm:p-3 bg-slate-50">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Dormitorios</div>
            <div className="mt-1 text-sm sm:text-lg font-semibold">{listing.bedrooms || "—"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-2 sm:p-3 bg-slate-50">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Baños</div>
            <div className="mt-1 text-sm sm:text-lg font-semibold">{listing.bathrooms || "—"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-2 sm:p-3 bg-slate-50">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Destacado</div>
            <div className="mt-1 text-sm sm:text-lg font-semibold">{listing.feature || listing.analysis?.featuredFeature || "—"}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 sm:p-5 bg-slate-50 mb-4">
          <div className="uppercase text-[10px] tracking-[0.3em] text-slate-500">Resumen</div>
          <div className="mt-2 text-sm sm:text-base leading-6 text-slate-900">
            {listing.analysis?.marketingSummary || listing.description || "Resumen no disponible."}
          </div>
        </div>

        <div className="bg-[#c41e3a] text-white py-3 sm:py-4 text-center font-semibold text-sm sm:text-base">www.melpropiedades.cl</div>
        <div className="bg-white border-t border-slate-200 p-4 text-sm text-slate-700">
          <div>{brokerName}</div>
          <div>{brokerPhone}</div>
        </div>
      </div>
    </div>
  );
}
