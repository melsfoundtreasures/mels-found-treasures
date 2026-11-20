const LISTING_FIELD_KEYS={Title:'title',Description:'description',Price:'price',Quantity:'quantity',Category:'category',Condition:'condition',Sku:'sku',Brand:'brand',Color:'color',Type:'type',Model:'model',Material:'material',Mpn:'mpn',Upc:'upc',Tags:'tags',Country:'country',LocationDescription:'locationDescription',ShippingZip:'shippingZip',WeightLb:'weightLb',WeightOz:'weightOz',LengthIn:'lengthIn',WidthIn:'widthIn',HeightIn:'heightIn',PricingFormat:'pricingFormat',Duration:'duration',ShippingPolicy:'shippingPolicy',PaymentPolicy:'paymentPolicy',ReturnPolicy:'returnPolicy',ConditionDescription:'conditionDescription'};
function listingCanonicalItem(item){
  if(item && ('asking_price' in item || 'quantity_remaining' in item))return {...metadata(item.notes),...item,expectedPrice:item.asking_price,quantityRemaining:item.quantity_remaining};
  return item||{};
}
function listingSharedValue(item,suffix){
  item=listingCanonicalItem(item);const key=LISTING_FIELD_KEYS[suffix],shared=item.sharedListingDetails||{};
  if(suffix==='Quantity')return Math.max(1,Number(item.quantityRemaining??shared.quantity??1)||1);
  if(suffix==='Title')return item.title??shared.title??'';
  if(suffix==='Price')return item.expectedPrice??shared.price??'';
  if(suffix==='Category')return item.category??shared.category??'';
  if(suffix==='Sku')return item.sku??shared.sku??'';
  if(suffix==='LocationDescription')return shared.locationDescription||item.locationDescription||'Bettendorf, IA';
  if(suffix==='ShippingZip')return shared.shippingZip||item.shippingZip||'52722';
  const fallback=suffix==='Price'?item.expectedPrice:suffix==='Quantity'?Math.max(1,Number(item.quantityRemaining??1)):suffix==='PricingFormat'?'Fixed Price':suffix==='Country'?'United States':item[key];
  const value=shared[key]??fallback??'';
  return value;
}
function listingDraftOverrides(item){
  item=listingCanonicalItem(item);let stored=item.marketplaceDraftOverrides;
  try{if(typeof stored==='string')stored=JSON.parse(stored);}catch{stored=null;}
  if(stored && typeof stored==='object' && stored.__version===1)return {...stored};
  const flags={__version:1};
  for(const prefix of ['ebay','etsy','facebook'])for(const suffix of Object.keys(LISTING_FIELD_KEYS)){
    const value=item[prefix+suffix],fallback=listingSharedValue(item,suffix);
    if(value==null || value==='')continue;
    flags[prefix+suffix]=['Price','Quantity','WeightLb','WeightOz','LengthIn','WidthIn','HeightIn'].includes(suffix)
      ? fallback==='' || fallback==null || Number(value)!==Number(fallback):String(value)!==String(fallback);
  }
  return flags;
}
function listingDraftValue(item,prefix,suffix,flags=listingDraftOverrides(item)){
  const normalized=listingCanonicalItem(item),name=prefix+suffix;
  if(['LocationDescription','ShippingZip'].includes(suffix) && !String(normalized[name]??'').trim())return listingSharedValue(normalized,suffix);
  return flags[name]===true?(normalized[name]??''):listingSharedValue(normalized,suffix);
}
