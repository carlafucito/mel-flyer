export type PhotoRecommendationRole = "main" | "secondary" | "discard";

export type PhotoWatermarkAnalysis = {
  index: number;
  commercialScore: number;
  recommendedRole: PhotoRecommendationRole;
  roomType: string;
  strengths: string[];
  weaknesses: string[];
  reason: string;
  commercialQualityScore?: number;
  description?: string;
  hasWatermark: boolean;
  watermarkConfidence: number;
  watermarkDescription: string | null;
  warnings?: string[];
};

export type PropertyAnalysis = {
  propertyType?: string;
  marketingSummary: string;
  featuredFeature: string;
  featuredFeatureCategory: string;
  mainPhotoIndex: number;
  secondaryPhotoIndexes: number[];
  analysisWarnings: string[];
  photoAnalysis: PhotoWatermarkAnalysis[];
};

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
  raw_text?: string | null;
  images: string[];
  feature: string;
  propertyType: string | null;
  parking?: string | null;
  bodegas?: string | null;
  gastos_comunes?: string | null;
  orientacion?: string | null;
  analysis?: PropertyAnalysis | null;
  missing?: string[];
}
