/**
 * Major US cities per state for Zillow rental searches.
 * Each city has a slug (for URL), coordinates (center), and bounding box (for searchQueryState).
 * 2-3 cities per state covers the major rental markets.
 */

export interface CityEntry {
  name: string;
  state: string;
  slug: string; // zillow URL slug e.g. "birmingham-al"
  lat: number;
  lng: number;
  bounds: { north: number; south: number; east: number; west: number };
}

export const US_CITIES: CityEntry[] = [
  // Alabama
  { name: "Birmingham", state: "AL", slug: "birmingham-al", lat: 33.5186, lng: -86.8104, bounds: { north: 33.68, south: 33.38, east: -86.58, west: -87.05 } },
  { name: "Huntsville", state: "AL", slug: "huntsville-al", lat: 34.7304, lng: -86.5861, bounds: { north: 34.87, south: 34.59, east: -86.37, west: -86.80 } },
  { name: "Mobile", state: "AL", slug: "mobile-al", lat: 30.6954, lng: -88.0399, bounds: { north: 30.82, south: 30.57, east: -87.82, west: -88.26 } },
  // Alaska
  { name: "Anchorage", state: "AK", slug: "anchorage-ak", lat: 61.2181, lng: -149.9003, bounds: { north: 61.43, south: 61.04, east: -149.48, west: -150.32 } },
  { name: "Fairbanks", state: "AK", slug: "fairbanks-ak", lat: 64.8378, lng: -147.7164, bounds: { north: 64.94, south: 64.73, east: -147.45, west: -147.98 } },
  // Arizona
  { name: "Phoenix", state: "AZ", slug: "phoenix-az", lat: 33.4484, lng: -112.0740, bounds: { north: 33.75, south: 33.20, east: -111.79, west: -112.39 } },
  { name: "Tucson", state: "AZ", slug: "tucson-az", lat: 32.2226, lng: -110.9747, bounds: { north: 32.44, south: 32.05, east: -110.72, west: -111.24 } },
  { name: "Scottsdale", state: "AZ", slug: "scottsdale-az", lat: 33.4942, lng: -111.9261, bounds: { north: 33.75, south: 33.35, east: -111.72, west: -112.13 } },
  // Arkansas
  { name: "Little Rock", state: "AR", slug: "little-rock-ar", lat: 34.7465, lng: -92.2896, bounds: { north: 34.89, south: 34.62, east: -92.07, west: -92.52 } },
  { name: "Fayetteville", state: "AR", slug: "fayetteville-ar", lat: 36.0822, lng: -94.1719, bounds: { north: 36.20, south: 35.95, east: -93.95, west: -94.39 } },
  // California
  { name: "Los Angeles", state: "CA", slug: "los-angeles-ca", lat: 34.0522, lng: -118.2437, bounds: { north: 34.34, south: 33.75, east: -117.90, west: -118.67 } },
  { name: "San Francisco", state: "CA", slug: "san-francisco-ca", lat: 37.7749, lng: -122.4194, bounds: { north: 37.83, south: 37.71, east: -122.35, west: -122.52 } },
  { name: "San Diego", state: "CA", slug: "san-diego-ca", lat: 32.7157, lng: -117.1611, bounds: { north: 33.01, south: 32.53, east: -116.90, west: -117.40 } },
  // Colorado
  { name: "Denver", state: "CO", slug: "denver-co", lat: 39.7392, lng: -104.9903, bounds: { north: 39.91, south: 39.61, east: -104.73, west: -105.24 } },
  { name: "Colorado Springs", state: "CO", slug: "colorado-springs-co", lat: 38.8339, lng: -104.8214, bounds: { north: 39.00, south: 38.67, east: -104.60, west: -105.04 } },
  // Connecticut
  { name: "Hartford", state: "CT", slug: "hartford-ct", lat: 41.7658, lng: -72.6734, bounds: { north: 41.85, south: 41.68, east: -72.53, west: -72.82 } },
  { name: "New Haven", state: "CT", slug: "new-haven-ct", lat: 41.3083, lng: -72.9279, bounds: { north: 41.38, south: 41.23, east: -72.79, west: -73.07 } },
  // Delaware
  { name: "Wilmington", state: "DE", slug: "wilmington-de", lat: 39.7391, lng: -75.5398, bounds: { north: 39.80, south: 39.67, east: -75.42, west: -75.66 } },
  { name: "Dover", state: "DE", slug: "dover-de", lat: 39.1582, lng: -75.5244, bounds: { north: 39.22, south: 39.10, east: -75.41, west: -75.64 } },
  // Florida
  { name: "Miami", state: "FL", slug: "miami-fl", lat: 25.7617, lng: -80.1918, bounds: { north: 25.90, south: 25.63, east: -80.04, west: -80.35 } },
  { name: "Orlando", state: "FL", slug: "orlando-fl", lat: 28.5383, lng: -81.3792, bounds: { north: 28.70, south: 28.37, east: -81.15, west: -81.60 } },
  { name: "Tampa", state: "FL", slug: "tampa-fl", lat: 27.9506, lng: -82.4572, bounds: { north: 28.10, south: 27.80, east: -82.25, west: -82.66 } },
  // Georgia
  { name: "Atlanta", state: "GA", slug: "atlanta-ga", lat: 33.7490, lng: -84.3880, bounds: { north: 33.93, south: 33.60, east: -84.17, west: -84.61 } },
  { name: "Savannah", state: "GA", slug: "savannah-ga", lat: 32.0809, lng: -81.0912, bounds: { north: 32.20, south: 31.95, east: -80.92, west: -81.26 } },
  // Hawaii
  { name: "Honolulu", state: "HI", slug: "honolulu-hi", lat: 21.3069, lng: -157.8583, bounds: { north: 21.42, south: 21.20, east: -157.69, west: -158.02 } },
  // Idaho
  { name: "Boise", state: "ID", slug: "boise-id", lat: 43.6150, lng: -116.2023, bounds: { north: 43.75, south: 43.48, east: -115.97, west: -116.43 } },
  // Illinois
  { name: "Chicago", state: "IL", slug: "chicago-il", lat: 41.8781, lng: -87.6298, bounds: { north: 42.02, south: 41.64, east: -87.42, west: -87.84 } },
  { name: "Springfield", state: "IL", slug: "springfield-il", lat: 39.7817, lng: -89.6501, bounds: { north: 39.88, south: 39.68, east: -89.49, west: -89.81 } },
  // Indiana
  { name: "Indianapolis", state: "IN", slug: "indianapolis-in", lat: 39.7684, lng: -86.1581, bounds: { north: 39.93, south: 39.60, east: -85.93, west: -86.38 } },
  { name: "Fort Wayne", state: "IN", slug: "fort-wayne-in", lat: 41.0793, lng: -85.1394, bounds: { north: 41.20, south: 40.96, east: -84.96, west: -85.32 } },
  // Iowa
  { name: "Des Moines", state: "IA", slug: "des-moines-ia", lat: 41.5868, lng: -93.6250, bounds: { north: 41.72, south: 41.45, east: -93.42, west: -93.83 } },
  { name: "Cedar Rapids", state: "IA", slug: "cedar-rapids-ia", lat: 41.9779, lng: -91.6656, bounds: { north: 42.07, south: 41.88, east: -91.49, west: -91.84 } },
  // Kansas
  { name: "Wichita", state: "KS", slug: "wichita-ks", lat: 37.6872, lng: -97.3301, bounds: { north: 37.82, south: 37.55, east: -97.12, west: -97.54 } },
  { name: "Kansas City", state: "KS", slug: "kansas-city-ks", lat: 39.1141, lng: -94.6275, bounds: { north: 39.22, south: 39.01, east: -94.47, west: -94.79 } },
  // Kentucky
  { name: "Louisville", state: "KY", slug: "louisville-ky", lat: 38.2527, lng: -85.7585, bounds: { north: 38.40, south: 38.10, east: -85.52, west: -85.99 } },
  { name: "Lexington", state: "KY", slug: "lexington-ky", lat: 38.0406, lng: -84.5037, bounds: { north: 38.17, south: 37.91, east: -84.31, west: -84.70 } },
  // Louisiana
  { name: "New Orleans", state: "LA", slug: "new-orleans-la", lat: 29.9511, lng: -90.0715, bounds: { north: 30.07, south: 29.83, east: -89.87, west: -90.27 } },
  { name: "Baton Rouge", state: "LA", slug: "baton-rouge-la", lat: 30.4515, lng: -91.1871, bounds: { north: 30.59, south: 30.31, east: -90.97, west: -91.40 } },
  // Maine
  { name: "Portland", state: "ME", slug: "portland-me", lat: 43.6591, lng: -70.2568, bounds: { north: 43.73, south: 43.59, east: -70.13, west: -70.38 } },
  // Maryland
  { name: "Baltimore", state: "MD", slug: "baltimore-md", lat: 39.2904, lng: -76.6122, bounds: { north: 39.40, south: 39.18, east: -76.43, west: -76.80 } },
  // Massachusetts
  { name: "Boston", state: "MA", slug: "boston-ma", lat: 42.3601, lng: -71.0589, bounds: { north: 42.44, south: 42.28, east: -70.90, west: -71.22 } },
  // Michigan
  { name: "Detroit", state: "MI", slug: "detroit-mi", lat: 42.3314, lng: -83.0458, bounds: { north: 42.47, south: 42.20, east: -82.84, west: -83.25 } },
  { name: "Grand Rapids", state: "MI", slug: "grand-rapids-mi", lat: 42.9634, lng: -85.6681, bounds: { north: 43.08, south: 42.85, east: -85.48, west: -85.86 } },
  // Minnesota
  { name: "Minneapolis", state: "MN", slug: "minneapolis-mn", lat: 44.9778, lng: -93.2650, bounds: { north: 45.10, south: 44.85, east: -93.05, west: -93.48 } },
  // Mississippi
  { name: "Jackson", state: "MS", slug: "jackson-ms", lat: 32.2988, lng: -90.1848, bounds: { north: 32.43, south: 32.17, east: -89.98, west: -90.39 } },
  // Missouri
  { name: "Kansas City", state: "MO", slug: "kansas-city-mo", lat: 39.0997, lng: -94.5786, bounds: { north: 39.32, south: 38.88, east: -94.35, west: -94.81 } },
  { name: "St. Louis", state: "MO", slug: "st-louis-mo", lat: 38.6270, lng: -90.1994, bounds: { north: 38.77, south: 38.48, east: -89.98, west: -90.42 } },
  // Montana
  { name: "Billings", state: "MT", slug: "billings-mt", lat: 45.7833, lng: -108.5007, bounds: { north: 45.89, south: 45.67, east: -108.30, west: -108.70 } },
  // Nebraska
  { name: "Omaha", state: "NE", slug: "omaha-ne", lat: 41.2565, lng: -95.9345, bounds: { north: 41.39, south: 41.12, east: -95.73, west: -96.14 } },
  // Nevada
  { name: "Las Vegas", state: "NV", slug: "las-vegas-nv", lat: 36.1699, lng: -115.1398, bounds: { north: 36.34, south: 36.00, east: -114.90, west: -115.38 } },
  { name: "Reno", state: "NV", slug: "reno-nv", lat: 39.5296, lng: -119.8138, bounds: { north: 39.65, south: 39.40, east: -119.61, west: -120.02 } },
  // New Hampshire
  { name: "Manchester", state: "NH", slug: "manchester-nh", lat: 42.9956, lng: -71.4548, bounds: { north: 43.07, south: 42.92, east: -71.32, west: -71.59 } },
  // New Jersey
  { name: "Newark", state: "NJ", slug: "newark-nj", lat: 40.7357, lng: -74.1724, bounds: { north: 40.80, south: 40.67, east: -74.04, west: -74.30 } },
  { name: "Jersey City", state: "NJ", slug: "jersey-city-nj", lat: 40.7178, lng: -74.0431, bounds: { north: 40.77, south: 40.66, east: -73.92, west: -74.17 } },
  // New Mexico
  { name: "Albuquerque", state: "NM", slug: "albuquerque-nm", lat: 35.0844, lng: -106.6504, bounds: { north: 35.24, south: 34.93, east: -106.42, west: -106.88 } },
  // New York
  { name: "New York", state: "NY", slug: "new-york-ny", lat: 40.7128, lng: -74.0060, bounds: { north: 40.88, south: 40.54, east: -73.72, west: -74.26 } },
  { name: "Buffalo", state: "NY", slug: "buffalo-ny", lat: 42.8864, lng: -78.8784, bounds: { north: 42.97, south: 42.80, east: -78.73, west: -79.03 } },
  // North Carolina
  { name: "Charlotte", state: "NC", slug: "charlotte-nc", lat: 35.2271, lng: -80.8431, bounds: { north: 35.40, south: 35.05, east: -80.61, west: -81.07 } },
  { name: "Raleigh", state: "NC", slug: "raleigh-nc", lat: 35.7796, lng: -78.6382, bounds: { north: 35.93, south: 35.63, east: -78.42, west: -78.85 } },
  // North Dakota
  { name: "Fargo", state: "ND", slug: "fargo-nd", lat: 46.8772, lng: -96.7898, bounds: { north: 46.97, south: 46.78, east: -96.62, west: -96.96 } },
  // Ohio
  { name: "Columbus", state: "OH", slug: "columbus-oh", lat: 39.9612, lng: -82.9988, bounds: { north: 40.13, south: 39.80, east: -82.77, west: -83.23 } },
  { name: "Cleveland", state: "OH", slug: "cleveland-oh", lat: 41.4993, lng: -81.6944, bounds: { north: 41.60, south: 41.39, east: -81.50, west: -81.89 } },
  // Oklahoma
  { name: "Oklahoma City", state: "OK", slug: "oklahoma-city-ok", lat: 35.4676, lng: -97.5164, bounds: { north: 35.67, south: 35.27, east: -97.26, west: -97.77 } },
  { name: "Tulsa", state: "OK", slug: "tulsa-ok", lat: 36.1540, lng: -95.9928, bounds: { north: 36.30, south: 36.00, east: -95.75, west: -96.23 } },
  // Oregon
  { name: "Portland", state: "OR", slug: "portland-or", lat: 45.5152, lng: -122.6784, bounds: { north: 45.65, south: 45.38, east: -122.44, west: -122.92 } },
  // Pennsylvania
  { name: "Philadelphia", state: "PA", slug: "philadelphia-pa", lat: 39.9526, lng: -75.1652, bounds: { north: 40.09, south: 39.82, east: -74.96, west: -75.37 } },
  { name: "Pittsburgh", state: "PA", slug: "pittsburgh-pa", lat: 40.4406, lng: -79.9959, bounds: { north: 40.56, south: 40.32, east: -79.80, west: -80.19 } },
  // Rhode Island
  { name: "Providence", state: "RI", slug: "providence-ri", lat: 41.8240, lng: -71.4128, bounds: { north: 41.89, south: 41.76, east: -71.28, west: -71.54 } },
  // South Carolina
  { name: "Charleston", state: "SC", slug: "charleston-sc", lat: 32.7765, lng: -79.9311, bounds: { north: 32.90, south: 32.65, east: -79.74, west: -80.12 } },
  { name: "Columbia", state: "SC", slug: "columbia-sc", lat: 34.0007, lng: -81.0348, bounds: { north: 34.12, south: 33.88, east: -80.84, west: -81.23 } },
  // South Dakota
  { name: "Sioux Falls", state: "SD", slug: "sioux-falls-sd", lat: 43.5446, lng: -96.7311, bounds: { north: 43.64, south: 43.45, east: -96.56, west: -96.90 } },
  // Tennessee
  { name: "Nashville", state: "TN", slug: "nashville-tn", lat: 36.1627, lng: -86.7816, bounds: { north: 36.37, south: 35.97, east: -86.52, west: -87.04 } },
  { name: "Memphis", state: "TN", slug: "memphis-tn", lat: 35.1495, lng: -90.0490, bounds: { north: 35.30, south: 35.00, east: -89.82, west: -90.28 } },
  // Texas
  { name: "Houston", state: "TX", slug: "houston-tx", lat: 29.7604, lng: -95.3698, bounds: { north: 30.02, south: 29.50, east: -95.05, west: -95.69 } },
  { name: "Austin", state: "TX", slug: "austin-tx", lat: 30.2672, lng: -97.7431, bounds: { north: 30.45, south: 30.09, east: -97.52, west: -97.97 } },
  { name: "Dallas", state: "TX", slug: "dallas-tx", lat: 32.7767, lng: -96.7970, bounds: { north: 32.97, south: 32.58, east: -96.56, west: -97.04 } },
  // Utah
  { name: "Salt Lake City", state: "UT", slug: "salt-lake-city-ut", lat: 40.7608, lng: -111.8910, bounds: { north: 40.88, south: 40.64, east: -111.68, west: -112.10 } },
  // Vermont
  { name: "Burlington", state: "VT", slug: "burlington-vt", lat: 44.4759, lng: -73.2121, bounds: { north: 44.54, south: 44.41, east: -73.08, west: -73.34 } },
  // Virginia
  { name: "Virginia Beach", state: "VA", slug: "virginia-beach-va", lat: 36.8529, lng: -75.9780, bounds: { north: 36.93, south: 36.74, east: -75.80, west: -76.17 } },
  { name: "Richmond", state: "VA", slug: "richmond-va", lat: 37.5407, lng: -77.4360, bounds: { north: 37.64, south: 37.44, east: -77.24, west: -77.63 } },
  // Washington
  { name: "Seattle", state: "WA", slug: "seattle-wa", lat: 47.6062, lng: -122.3321, bounds: { north: 47.73, south: 47.48, east: -122.12, west: -122.55 } },
  { name: "Spokane", state: "WA", slug: "spokane-wa", lat: 47.6588, lng: -117.4260, bounds: { north: 47.77, south: 47.55, east: -117.22, west: -117.63 } },
  // West Virginia
  { name: "Charleston", state: "WV", slug: "charleston-wv", lat: 38.3498, lng: -81.6326, bounds: { north: 38.43, south: 38.27, east: -81.47, west: -81.80 } },
  // Wisconsin
  { name: "Milwaukee", state: "WI", slug: "milwaukee-wi", lat: 43.0389, lng: -87.9065, bounds: { north: 43.16, south: 42.92, east: -87.73, west: -88.08 } },
  { name: "Madison", state: "WI", slug: "madison-wi", lat: 43.0731, lng: -89.4012, bounds: { north: 43.18, south: 42.97, east: -89.20, west: -89.60 } },
  // Wyoming
  { name: "Cheyenne", state: "WY", slug: "cheyenne-wy", lat: 41.1400, lng: -104.8202, bounds: { north: 41.22, south: 41.06, east: -104.65, west: -104.99 } },
];

/** Get cities for a given state code */
export function getCitiesForState(stateCode: string): CityEntry[] {
  return US_CITIES.filter((c) => c.state === stateCode);
}

/** Build a Zillow rental search URL for a city with proper searchQueryState */
export function buildZillowCityUrl(
  city: CityEntry,
  opts?: { minBeds?: number; maxPrice?: number; ownerOnly?: boolean },
): string {
  const filterState: Record<string, unknown> = {
    fr: { value: true },     // for rent
    fsba: { value: false },  // not for sale by agent
    fsbo: { value: false },  // not for sale by owner
    nc: { value: false },    // not new construction
    cmsn: { value: false },  // not coming soon
    auc: { value: false },   // not auction
    fore: { value: false },  // not foreclosure
  };
  if (opts?.minBeds) filterState.beds = { min: opts.minBeds };
  if (opts?.maxPrice) filterState.mp = { max: opts.maxPrice };
  if (opts?.ownerOnly) filterState.keywords = { value: "FRBO" };

  const searchQueryState = {
    mapBounds: {
      north: city.bounds.north,
      south: city.bounds.south,
      east: city.bounds.east,
      west: city.bounds.west,
    },
    isMapVisible: true,
    filterState,
    isListVisible: true,
  };

  return `https://www.zillow.com/${city.slug}/rentals/?searchQueryState=${encodeURIComponent(JSON.stringify(searchQueryState))}`;
}
