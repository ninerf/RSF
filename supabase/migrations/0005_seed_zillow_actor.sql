-- Seed one Zillow actor_config (provider 'apify', input_mode 'url', US).
-- Field names locked from the live maxcopell/zillow-scraper build schema:
--   input: { searchUrls: [{ url }], extractionMethod }
--   (no in-input item limit field — the runner caps via Apify's maxItems run option)
-- result_mapping uses dotted source paths into each dataset item.

insert into public.actor_configs (
  name, provider, actor_id, source_label, country, input_mode,
  input_template, input_fields, result_mapping, active
)
select
  'Zillow For Rent (US)',
  'apify',
  'maxcopell/zillow-scraper',
  'zillow',
  'US',
  'url',
  jsonb_build_object(
    'searchUrls', jsonb_build_array(jsonb_build_object('url', '{{url}}')),
    'extractionMethod', 'PAGINATION_WITH_ZOOM_IN'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'key', 'url',
      'label', 'Zillow for_rent search URL (must contain ?searchQueryState=)',
      'type', 'url',
      'required', true
    )
  ),
  jsonb_build_object(
    'external_id', 'zpid',
    'price', 'unformattedPrice',
    'currency', 'hdpData.homeInfo.currency',
    'beds', 'beds',
    'baths', 'baths',
    'area_sqft', 'area',
    'address', 'address',
    'city', 'addressCity',
    'state', 'addressState',
    'zip', 'addressZipcode',
    'latitude', 'latLong.latitude',
    'longitude', 'latLong.longitude',
    'detail_url', 'detailUrl',
    'image_url', 'imgSrc',
    'listing_type', 'statusType',
    'rent_zestimate', 'hdpData.homeInfo.rentZestimate',
    'days_on_market', 'variableData.text'
  ),
  true
where not exists (
  select 1 from public.actor_configs
  where actor_id = 'maxcopell/zillow-scraper' and source_label = 'zillow'
);
