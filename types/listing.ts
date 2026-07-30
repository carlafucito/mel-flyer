export type ListingResult = {
  operation: string; // VENTA | ARRIENDO
  commune: string;
  price: string;
  currency: string; // UF | CLP | empty
  area_total: string;
  area_usable?: string;
  bedrooms: string;
  bathrooms: string;
  title: string;
  description: string;
  images: string[];
  feature: string;
  missing?: string[];
}
