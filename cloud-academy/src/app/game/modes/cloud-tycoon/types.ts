export interface RequiredService {
  service_id: string;
  service_name: string;
  category: string;
  reason: string;
}

export interface Business {
  id: string;
  business_name: string;
  industry: string;
  icon: string;
  use_case_title: string;
  use_case_description: string;
  required_services: RequiredService[];
  contract_value: number;
  difficulty: string;
  hints: string[];
  compliance_requirements?: string[];
}

export interface BusinessResult {
  businessId: string;
  businessName: string;
  outcome: 'success' | 'partial' | 'failed';
  earnings: number;
  timeTaken?: number;
}

export interface JourneyHistory {
  journeyId: string;
  journeyName: string;
  completedAt: string;
  businesses: BusinessResult[];
  totalEarnings: number;
  perfectMatches: number;
  totalBusinesses: number;
}

export interface GameState {
  currentBusinessIndex: number;
  completedBusinesses: Set<string>;
  totalEarnings: number;
  perfectMatches: number;
  businessResults: BusinessResult[];
}
