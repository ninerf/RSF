export type Role = "admin" | "worker" | "client";

export type ReviewStatus =
  | "pending"
  | "approved"
  | "disapproved"
  | "ready_to_send"
  | "flagged";

export interface Profile {
  id: string;
  username: string;
  role: Role;
  can_run_searches: boolean;
  created_at: string;
}

export interface ApiCredential {
  id: string;
  provider: string;
  label: string;
  vault_secret_id: string;
  is_paid: boolean;
  monthly_result_limit: number | null;
  results_used: number;
  calls_used: number;
  last_reset: string;
  active: boolean;
  created_at: string;
}

export interface ActorConfig {
  id: string;
  name: string;
  provider: string;
  actor_id: string;
  source_label: string | null;
  country: string | null;
  input_mode: "url" | "form";
  input_template: Record<string, unknown>;
  input_fields: unknown[];
  result_mapping: Record<string, unknown>;
  active: boolean;
  created_at: string;
}

export type SearchStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "aborted";

export interface AppSettings {
  id: number;
  global_monthly_result_budget: number | null;
  hard_stop: boolean;
  pipeline_enabled: boolean;
  cost_haircut_pct: number;
  min_monthly_spread: number;
  min_revenue_to_rent_ratio: number;
  str_provider: string;
  default_search_mode: SearchMode;
  skip_states_within_days: number;
  str_cache_ttl_days: number;
  management_keywords: string[];
}

export type SearchMode = "states" | "url";

export interface Search {
  id: string;
  created_by: string | null;
  actor_config_id: string | null;
  credential_id: string | null;
  name: string | null;
  input_params: Record<string, unknown>;
  status: SearchStatus;
  search_mode: SearchMode;
  apify_run_id: string | null;
  result_count: number;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export type StateRunStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

export interface SearchStateRun {
  id: string;
  search_id: string;
  state_code: string;
  status: StateRunStatus;
  apify_run_id: string | null;
  result_count: number;
  new_result_count: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export type DealVerdict = "Good" | "Marginal" | "Poor";

export interface ResultRow {
  id: string;
  search_id: string | null;
  source: string;
  country: string | null;
  external_id: string;
  listing_type: string | null;
  price: number | null;
  currency: string | null;
  beds: number | null;
  baths: number | null;
  area_sqft: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  detail_url: string | null;
  image_url: string | null;
  rent_zestimate: number | null;
  days_on_market: number | null;
  available_date: string | null;
  owner_name: string | null;
  owner_type: "owner" | "management" | null;
  contact_phone: string | null;
  contact_email: string | null;
  broker_name: string | null;
  review_status: ReviewStatus;
  availability_status: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  flagged_by: string | null;
  flag_note: string | null;
  archived: boolean;
  raw_json: Record<string, unknown> | null;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  result_id: string | null;
  type: string;
  message: string;
  read: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ResultEnrichment {
  result_id: string;
  str_adr: number | null;
  str_occupancy: number | null;
  str_monthly_revenue: number | null;
  str_annual_revenue: number | null;
  arbitrage_spread: number | null;
  deal_verdict: DealVerdict | null;
  source: string | null;
  computed_at: string;
}

// Revenue adapter contract (Part D) ---------------------------------------
export interface RevenueInput {
  address: string | null;
  city: string | null;
  state: string | null;
  beds: number | null;
  lat: number | null;
  lng: number | null;
}

export interface RevenueResult {
  adr: number | null;
  occupancy: number | null;
  monthly_revenue: number | null;
  annual_revenue: number | null;
  comps?: unknown[];
  provider: string;
}
