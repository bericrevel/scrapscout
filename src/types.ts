export type LegalStatus = 'green' | 'yellow' | 'red';

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  city: string;
  county: string;
  category: string;
  legal_status: LegalStatus;
  start_date?: string;
  items_expected?: string[];
  estimated_total_value?: number;
  is_founder_exclusive?: boolean;
}

export interface ScannedItem {
  id: string;
  image_url: string;
  item_name: string;
  material: string;
  condition: string;
  repair_needs?: string;
  extracted_text?: string;
  estimated_value_low: number;
  estimated_value_high: number;
  resale_value: number;
  scrap_value: number;
  bounding_box?: [number, number, number, number];
  status: 'found' | 'saved' | 'sold';
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  createdAt: string;
}

export interface SavedLocation {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  name: string;
}

export interface ScrapYard {
  name: string;
  address: string;
  rating?: number;
  user_ratings_total?: number;
  latitude: number;
  longitude: number;
  place_id: string;
  payout_estimate?: string;
}
