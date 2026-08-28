export type Kundestatus = "Aktiv" | "Pause" | "Prospect" | "Avsluttet";
export type Segment = "Retainer" | "Prosjekt" | "Retainer + prosjekt" | "Prospect" | "Sovende";
export type Retainerstatus = "Aktiv" | "Pause" | "Oppsagt" | "Avsluttet";
export type Timetype = "Retainer" | "Mersalg" | "Prosjekt" | "Internt" | "Ikke fakturerbart";
export type Mersalgsstatus = "Idé" | "Sendt tilbud" | "I dialog" | "Vunnet" | "Tapt" | "Utsatt";
export type Prosjektstatus = "Planlagt" | "Pågår" | "Venter på kunde" | "Levert" | "Stoppet";
export type Tjenestestatus = "Implementert" | "Pågår" | "Blokkert" | "Ikke aktuelt" | "Mangler";

export interface Customer {
  id: string;
  owner: string;
  name: string;
  segment: Segment;
  status: Kundestatus;
  health: number;
  contact_name: string | null;
  contact_email: string | null;
  customer_since: string | null;
  logo_url: string | null;
  brand_color: string | null;
  notes: string | null;
  created_at: string;
}

export interface Retainer {
  id: string;
  customer_id: string;
  monthly_price: number;
  hour_budget: number;
  start_date: string | null;
  renewal_date: string | null;
  commitment_months: number | null;
  invoice_day: number | null;
  status: Retainerstatus;
  notes: string | null;
}

export interface TimeEntry {
  id: string;
  entry_date: string;
  customer_id: string | null;
  type: Timetype;
  task: string | null;
  hours: number;
  billable: boolean;
  source: string | null;
  comment: string | null;
}

export interface UpsellOpportunity {
  id: string;
  customer_id: string;
  title: string;
  service: string | null;
  value: number;
  deal_type: string;
  probability: number;
  status: Mersalgsstatus;
  next_step: string | null;
  deadline: string | null;
  notes: string | null;
  auto_generated: boolean;
  updated_at: string;
}

export interface Project {
  id: string;
  customer_id: string | null;
  name: string;
  type: string | null;
  budget: number;
  hour_budget: number | null;
  status: Prosjektstatus;
  start_date: string | null;
  deadline: string | null;
  notes: string | null;
  from_upsell?: boolean;
  created_at?: string;
}

export interface CustomerService {
  id: string;
  customer_id: string;
  service_name: string;
  status: Tjenestestatus;
  updated_at: string;
}

export interface ProductCatalogItem {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  default_price: number | null;
}

export const MERSALG_KOLONNER: Mersalgsstatus[] = [
  "Idé",
  "Sendt tilbud",
  "I dialog",
  "Vunnet",
  "Tapt",
  "Utsatt",
];

export const ALLE_TJENESTER = [
  "Enhanced Conversions",
  "Consent Mode v2",
  "Cookiebanner",
  "Server side (GA4+FB)",
  "FB CAPI",
  "Snap CAPI",
  "GA4",
  "BigQuery",
  "Looker Studio",
  "Google Ads",
  "Meta Ads",
  "SEO",
];
