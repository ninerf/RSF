import type { ActorConfig, ResultRow } from "@/lib/types";

// Safe dotted-path getter.
function get(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

// Parse "38 days on Zillow" -> 38.
function parseDaysOnMarket(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const m = String(v).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

// Columns we treat as numeric when mapping.
const NUMERIC_FIELDS = new Set([
  "price",
  "beds",
  "baths",
  "area_sqft",
  "latitude",
  "longitude",
  "rent_zestimate",
]);

// Keywords that indicate a management company rather than an individual owner.
const MANAGEMENT_KEYWORDS = [
  "llc", "inc", "corp", "realty", "properties", "management",
  "group", "capital", "investments", "partners", "homes", "rentals",
  "property", "real estate", "holdings", "ventures", "agency",
];

/** Classify owner type based on broker/owner name. */
function classifyOwnerType(name: string | null): "owner" | "management" | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const kw of MANAGEMENT_KEYWORDS) {
    if (lower.includes(kw)) return "management";
  }
  return "owner";
}

// Generic mapper driven by config.result_mapping: { columnName: "source.path" }.
// `days_on_market` and string fields are coerced appropriately. The full item
// is always preserved in raw_json. Returns null if no external_id resolves.
export function mapResult(
  item: Record<string, unknown>,
  config: ActorConfig,
): Partial<ResultRow> | null {
  const mapping = (config.result_mapping ?? {}) as Record<string, string>;
  const row: Partial<ResultRow> = {
    source: config.source_label ?? config.provider,
    country: config.country ?? "US",
    raw_json: item,
  };

  for (const [column, path] of Object.entries(mapping)) {
    const raw = get(item, path);
    if (column === "days_on_market") {
      row.days_on_market = parseDaysOnMarket(raw);
    } else if (column === "external_id") {
      row.external_id = toStr(raw) ?? undefined;
    } else if (NUMERIC_FIELDS.has(column)) {
      (row as Record<string, unknown>)[column] = toNum(raw);
    } else {
      (row as Record<string, unknown>)[column] = toStr(raw);
    }
  }

  if (!row.external_id) return null;

  // Extract owner/contact info from Zillow data.
  const brokerName = toStr(get(item, "brokerName"));
  const brokerPhone = toStr(get(item, "hdpData.homeInfo.brokerPhone"));
  const attributionName = toStr(get(item, "attributionInfo.agentName"));
  const attributionPhone = toStr(get(item, "attributionInfo.agentPhoneNumber"));

  row.owner_name = brokerName || attributionName || null;
  row.broker_name = brokerName || null;
  row.contact_phone = brokerPhone || attributionPhone || null;
  row.contact_email = toStr(get(item, "attributionInfo.agentEmail")) || null;
  row.owner_type = classifyOwnerType(row.owner_name);

  return row;
}
