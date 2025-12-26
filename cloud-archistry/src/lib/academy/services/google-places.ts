/**
 * Google Places API Service
 * Fetches nearby businesses for dynamic challenge creation
 */

export interface GooglePlace {
  place_id: string;
  name: string;
  vicinity: string; // Address
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
  business_status?: string;
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: {
    open_now: boolean;
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  icon?: string;
  icon_background_color?: string;
}

export interface PlaceDetails extends GooglePlace {
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  url?: string; // Google Maps URL
  reviews?: Array<{
    author_name: string;
    rating: number;
    text: string;
    time: number;
  }>;
}

export interface NearbySearchResult {
  places: GooglePlace[];
  nextPageToken?: string;
}

// Map Google place types to our industry categories
export function mapPlaceTypeToIndustry(types: string[]): string {
  const typeMap: Record<string, string> = {
    // Finance
    bank: "Banking & Finance",
    atm: "Banking & Finance",
    finance: "Banking & Finance",
    accounting: "Banking & Finance",
    insurance_agency: "Banking & Finance",
    
    // Healthcare
    hospital: "Healthcare",
    doctor: "Healthcare",
    dentist: "Healthcare",
    pharmacy: "Healthcare",
    physiotherapist: "Healthcare",
    veterinary_care: "Healthcare",
    
    // Technology
    electronics_store: "Technology",
    computer_store: "Technology",
    
    // Retail
    store: "Retail",
    shopping_mall: "Retail",
    clothing_store: "Retail",
    department_store: "Retail",
    supermarket: "Retail",
    convenience_store: "Retail",
    
    // Food & Beverage
    restaurant: "Food & Beverage",
    cafe: "Food & Beverage",
    bar: "Food & Beverage",
    bakery: "Food & Beverage",
    meal_delivery: "Food & Beverage",
    meal_takeaway: "Food & Beverage",
    
    // Hospitality
    hotel: "Hospitality",
    lodging: "Hospitality",
    
    // Automotive
    car_dealer: "Automotive",
    car_rental: "Automotive",
    car_repair: "Automotive",
    car_wash: "Automotive",
    gas_station: "Automotive",
    
    // Education
    school: "Education",
    university: "Education",
    library: "Education",
    
    // Entertainment
    movie_theater: "Entertainment",
    amusement_park: "Entertainment",
    casino: "Entertainment",
    night_club: "Entertainment",
    
    // Fitness
    gym: "Fitness & Wellness",
    spa: "Fitness & Wellness",
    
    // Professional Services
    lawyer: "Professional Services",
    real_estate_agency: "Professional Services",
    travel_agency: "Professional Services",
    
    // Logistics
    airport: "Logistics & Aviation",
    train_station: "Logistics & Transport",
    bus_station: "Logistics & Transport",
    
    // Government
    local_government_office: "Government",
    post_office: "Government",
    police: "Government",
    fire_station: "Government",
  };

  for (const type of types) {
    if (typeMap[type]) {
      return typeMap[type];
    }
  }
  
  return "General Business";
}

// Estimate business complexity for difficulty
export function estimateDifficulty(place: GooglePlace): "beginner" | "intermediate" | "advanced" | "expert" {
  const types = place.types || [];
  
  // Expert: Large enterprises, financial institutions, healthcare
  const expertTypes = ["bank", "hospital", "airport", "university"];
  if (types.some(t => expertTypes.includes(t))) {
    return "expert";
  }
  
  // Advanced: Medium businesses with complex needs
  const advancedTypes = ["shopping_mall", "hotel", "car_dealer", "insurance_agency"];
  if (types.some(t => advancedTypes.includes(t))) {
    return "advanced";
  }
  
  // Intermediate: Standard businesses
  const intermediateTypes = ["restaurant", "gym", "store", "doctor", "lawyer"];
  if (types.some(t => intermediateTypes.includes(t))) {
    return "intermediate";
  }
  
  // Beginner: Small/simple businesses
  return "beginner";
}

// Get icon for business type
export function getBusinessIcon(types: string[]): string {
  const iconMap: Record<string, string> = {
    bank: "🏦",
    hospital: "🏥",
    doctor: "👨‍⚕️",
    restaurant: "🍽️",
    cafe: "☕",
    bar: "🍺",
    hotel: "🏨",
    store: "🏪",
    shopping_mall: "🛒",
    gym: "🏋️",
    school: "🏫",
    university: "🎓",
    airport: "✈️",
    car_dealer: "🚗",
    gas_station: "⛽",
    pharmacy: "💊",
    lawyer: "⚖️",
    movie_theater: "🎬",
    supermarket: "🛍️",
    bakery: "🥐",
    spa: "💆",
    dentist: "🦷",
  };

  for (const type of types) {
    if (iconMap[type]) {
      return iconMap[type];
    }
  }
  
  return "🏢";
}
