export type ListingResult = {
  operation: string; // VENTA | ARRIENDO
  commune: string | null;
  price: string | null;
  currency: string; // UF | CLP | empty
  area_total: string | null;
  area_usable?: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  title: string | null;
  description: string | null;
  images: string[];
  feature: string;
  propertyType?: string | null;
  parking?: string | null;
  missing?: string[];
}
