# Apify Zillow Scrapers Reference

## Currently in Use

### maxcopell/zillow-zip-search — ✅ WORKING

Our primary scraper. ZIP-code-based, resilient to Zillow's anti-bot measures.

**Input Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `zipCodes` | string[] | **Required.** ZIP codes to search |
| `forSaleByAgent` | boolean | Filter for agent-listed sales (default: true) |
| `forSaleByOwner` | boolean | Filter for FSBO (default: false) |
| `forRent` | boolean | **Filter for rentals** (default: false) |
| `sold` | boolean | Filter for recently sold (default: false) |
| `priceMin` | integer | Min price/rent |
| `priceMax` | integer | Max price/rent |
| `bedsMin` | integer | Min bedrooms |
| `bedsMax` | integer | Max bedrooms |
| `bathsMin` | integer | Min bathrooms |
| `bathsMax` | integer | Max bathrooms |
| `sqftMin` | integer | Min square footage |
| `sqftMax` | integer | Max square footage |
| `daysOnZillow` | string | "1", "7", "14", "30", "90", "6m", "12m", "24m", "36m" |
| `homeType` | string[] | "Houses", "Apartments", "Condos", "Townhomes", "Multi-family", "Manufactured", "Lots" |
| `keywords` | string | Free text search (e.g. "FRBO", "pool", "garage") — **NOTE: ignored by this scraper based on testing** |

**Output Fields:**

| Field | Description |
|-------|-------------|
| `zpid` | Zillow property ID |
| `address` | Full address string |
| `addressStreet/City/State/Zipcode` | Parsed address parts |
| `unformattedPrice` | Numeric price |
| `price` | Formatted price string ("$1,500/mo") |
| `beds` | Bedrooms |
| `baths` | Bathrooms |
| `area` | Square footage |
| `latLong.latitude/longitude` | Coordinates |
| `detailUrl` | Link to full listing |
| `imgSrc` | Main photo URL |
| `statusType` | "FOR_RENT", "FOR_SALE", etc. |
| `statusText` | "House for rent", building name, etc. |
| `brokerName` | Agent/broker if available |
| `isBuilding` | true = apartment complex |
| `buildingName` | Name of apartment complex (null for houses) |
| `marketingTreatments` | Array: "paidMultifamily", "singleFamilyPaid", "zillowRentalManager", etc. |
| `units[]` | For buildings: array of `{ price, beds }` |
| `minBaseRent/maxBaseRent` | Rent range for buildings |
| `hdpData.homeInfo.*` | Nested: homeType, rentZestimate, daysOnZillow, currency |

**Pricing:** ~$1.10 per 1,000 results

**Limitations:**
- No FRBO/owner-only filter (keywords param is ignored)
- Returns buildings AND houses — need post-filtering
- Max ~500 results per ZIP code

---

## Broken / Blocked

### maxcopell/zillow-scraper — ❌ BLOCKED

URL-based scraper using `?searchQueryState=`. Was working on June 25 2026 morning, blocked by afternoon.

**Input:** `searchUrls: [{ url }]`, `extractionMethod: "PAGINATION_WITH_ZOOM_IN"`

**Why it was useful:** Could pass ANY Zillow filter via the URL's searchQueryState JSON, including `keywords: { value: "FRBO" }` for owner-only filtering.

**Status:** Returns "scraped 0 items. Failed requests: 1." on all URLs. Zillow anti-bot measures.

---

## Alternatives to Test

### igolaizola/zillow-scraper-ppe

$0.90/1000 results. URL-based. May or may not be blocked (uses different anti-detection). Worth testing.

**Input:** `urls` (array), `maxItems`, `extractDetails` (boolean for full detail scraping)

### afanasenko/zillow-property-agent-data-scraper

**Best for owner identification.** Has `includeAgentInfo` and `includeOwnerInfo` flags. Returns `listingAgent.name/phone/email/company` and `ownerName/ownerType/managementCompany`.

**Input modes:** ZIP codes, ZPID list, or Zillow URLs. 40+ filters.

**Pricing:** $8-15/1000 (visits detail pages — expensive but data-rich)

**Use case:** Enrichment step. After finding listings with the ZIP scraper, pass their ZPIDs to this actor to get owner/agent contact details.

### trakk/zillow-scraper

URL-based with Chrome TLS impersonation + US residential proxies. Returns `brokerName`, `listingAgent`. May work where maxcopell is blocked.

---

## Owner Detection Strategy

### The Problem
Zillow does NOT have a "For Rent By Owner" category for rentals. Unlike sales (which have FSBO), rentals are all lumped together.

### What We Know from Testing (50 items, Nashville area)

| Signal | Owner? | Management? |
|--------|--------|-------------|
| `buildingName` present | — | ✅ Always management |
| `marketingTreatments` has "multifamily" | — | ✅ Always management |
| `statusText` = "House for rent" | ✅ Usually owner | — |
| `statusText` = "[Building Name]" | — | ✅ Management |
| `isBuilding: true` + no buildingName | 50/50 | 50/50 |
| `singleFamilyPaid` in treatments | ✅ Owner/small investor | — |
| `zillowRentalManager` in treatments | ✅ Owner (using Zillow's tool) | — |
| `feedConnectSingleFamilyFlatFee` | ✅ Small investor (1-5 props) | — |

### Current Filter (what the code does)
```
REJECT if: buildingName OR multifamily in marketingTreatments
KEEP everything else (marked as "owner")
```

Result: ~72% of rentals pass (houses, townhomes, individual units from owners/small investors).

### Strictest Possible Filter
```
ONLY KEEP if: statusText contains "House for rent" OR "Townhouse for rent"
              AND no buildingName
              AND no multifamily treatments
```

Result: ~40% pass — highest confidence of being owner-listed.

---

## Contact Info Availability

| Source | Phone | Email | Name |
|--------|-------|-------|------|
| ZIP scraper search results | ❌ | ❌ | Sometimes (brokerName) |
| Detail page scrape (zillow-detail-scraper) | Sometimes | Rare | Yes |
| afanasenko agent scraper | ✅ | ✅ | ✅ |
| Zillow listing page (manual) | ✅ (click "Contact") | Sometimes | Yes |

**Bottom line:** To get contact info, either:
1. Use `afanasenko/zillow-property-agent-data-scraper` as enrichment ($8-15/1000)
2. Provide the `detailUrl` link for manual lookup (free, current approach)

---

## Cost Comparison

| Actor | Per 1,000 results | FRBO filter? | Contact info? | Status |
|-------|-------------------|--------------|---------------|--------|
| maxcopell/zillow-zip-search | $1.10 | ❌ | ❌ | ✅ Working |
| maxcopell/zillow-scraper | $1.30 | ✅ (via URL) | ❌ | ❌ Blocked |
| igolaizola/zillow-scraper-ppe | $0.90 | ✅ (via URL) | ❌ | ❓ Untested |
| afanasenko/agent-data-scraper | $8-15 | Via ZIP/URL | ✅ | ❓ Untested |
| malikgen/airbnb-revenue-calculator | $5.00 | N/A | N/A | ✅ (STR data) |
