(() => {
  const form=document.getElementById('itemForm'),content=form.querySelector('.item-page-content');
  const etsy=document.getElementById('etsyListingPanel'),facebook=document.getElementById('facebookListingPanel');
  const tabs=document.createElement('div');tabs.className='marketplace-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Item forms');
  const overview=document.createElement('section');overview.id='marketplace-overview';
  for(const node of [...content.children])if(!node.classList.contains('modal-head') && node!==etsy && node!==facebook)overview.append(node);
  content.append(tabs,overview);
  const definitions=[['overview','Inventory'],['ebay','eBay'],['etsy','Etsy'],['facebook','Facebook Marketplace']];
  const panels={overview};
  const status=document.createElement('p');status.className='marketplace-form-note';status.textContent='Photos, purchase costs and stock are shared. Each marketplace keeps its own listing details.';
  tabs.after(status);
  const sidebar=document.createElement('div');sidebar.className='marketplace-sidebar';sidebar.setAttribute('aria-label','Marketplace forms');
  const overrideInput=document.createElement('input');overrideInput.type='hidden';overrideInput.name='marketplaceDraftOverrides';form.append(overrideInput);
  let draftFlags={__version:1};
  const storeFlags=()=>{overrideInput.value=JSON.stringify(draftFlags);};
  form.addEventListener('input',event=>{
    const name=event.target.name;
    if(/^(ebay|etsy|facebook)/.test(name||'') && Object.keys(LISTING_FIELD_KEYS).some(suffix=>name.endsWith(suffix))){draftFlags[name]=true;storeFlags();}
  });
  form.addEventListener('change',event=>{
    const name=event.target.name;
    if(/^(ebay|etsy|facebook)/.test(name||'') && Object.keys(LISTING_FIELD_KEYS).some(suffix=>name.endsWith(suffix))){draftFlags[name]=true;storeFlags();}
  });
  form.querySelector('.item-page-sidebar nav').after(sidebar);
  function select(key,focus=false){
    for(const [name] of definitions){panels[name].hidden=name!==key;
      const button=tabs.querySelector('[data-market-tab="'+name+'"]');button.setAttribute('aria-selected',String(name===key));button.tabIndex=name===key?0:-1;
      sidebar.querySelector('[data-market-tab="'+name+'"]').setAttribute('aria-pressed',String(name===key));}
    if(focus)tabs.querySelector('[data-market-tab="'+key+'"]').focus();
  }
  for(const [key,label] of definitions){
    if(key!=='overview'){
      const panel=document.createElement('section');panel.id='marketplace-'+key;panel.className='marketplace-form';
      const heading=document.createElement('h3');heading.textContent=label+' listing form';panel.append(heading);
      const note=document.createElement('p');note.className='marketplace-form-note';
      note.textContent=key==='facebook'?'Save Item keeps your Facebook draft. Send to Facebook uses this form’s title, description and price. Choose category and condition again on Facebook.'
        :key==='etsy'?'Save Item keeps this Etsy draft in Reseller. The linked-listing controls below manage Etsy status and tags; they do not send these draft fields to Etsy.'
        :'Save Item keeps your eBay draft in Reseller. Publishing to eBay is currently done on eBay.';
      panel.append(note);
      const fields=document.createElement('div');fields.className='form-grid two';
      for(const [suffix,caption,type] of [['Title','Title','text'],['Price','Price ($)','number'],['Category','Category','text'],['Condition','Condition','text'],['Description','Description','textarea']]){
        if(key==='facebook' && suffix==='Description')continue;
        const labelNode=document.createElement('label');labelNode.textContent=caption;
        const input=document.createElement(type==='textarea'?'textarea':'input');input.name=key+suffix;
        if(type==='textarea'){input.rows=7;input.maxLength=10000;labelNode.style.gridColumn='1 / -1';}
        else {input.type=type;if(type==='number'){input.min='0';input.step='0.01';}else input.maxLength=suffix==='Title'?(key==='etsy'?140:200):250;}
        fields.append(labelNode);labelNode.append(input);
      }
      panel.append(fields);
      if(key==='etsy'){
        const labelNode=document.createElement('label');labelNode.textContent='Draft tags (comma separated)';
        const input=document.createElement('input');input.name='etsyDraftTags';input.maxLength=400;labelNode.append(input);panel.append(labelNode);
        if(etsy)panel.append(etsy);
      }
      if(key==='facebook' && facebook){
        fields.classList.add('facebook-listing-fields');
        // Facebook keeps its own draft fields while photos and stock stay shared.
        const title=fields.querySelector('[name="facebookTitle"]');title.maxLength=99;title.setAttribute('aria-required','true');
        const titleLabel=title.closest('label');titleLabel.firstChild.textContent='Title *';
        const counter=document.createElement('small');counter.id='facebookTitleCount';counter.textContent='0 / 99 characters';
        title.setAttribute('aria-describedby',counter.id);titleLabel.append(counter);title.addEventListener('input',()=>{counter.textContent=title.value.length+' / 99 characters';});
        const description=form.elements.facebookDescription.closest('label');description.classList.add('facebook-wide');
        titleLabel.after(description);
        function field(name,caption,type='text',options=[]){
          const labelNode=document.createElement('label');labelNode.textContent=caption;
          const input=document.createElement(type==='select'?'select':type==='textarea'?'textarea':'input');input.name='facebook'+name;
          if(type==='select')for(const value of options){const option=document.createElement('option');option.value=value;option.textContent=value||'Choose an option';input.append(option);}
          else if(type==='textarea'){input.rows=3;input.maxLength=2000;}
          else input.type=type;
          labelNode.append(input);return {label:labelNode,input};
        }
        const quantity=field('Quantity','Quantity *','number');quantity.input.min='1';quantity.input.step='1';quantity.input.setAttribute('aria-required','true');
        const stockHint=document.createElement('small');stockHint.id='facebookStockHint';quantity.input.setAttribute('aria-describedby',stockHint.id);quantity.label.append(stockHint);fields.append(quantity.label);
        const category=fields.querySelector('[name="facebookCategory"]');category.closest('label').firstChild.textContent='Category *';category.setAttribute('list','facebookCategoryChoices');category.setAttribute('aria-required','true');
        category.placeholder='Choose or type the complete category path';
        const categories=document.createElement('datalist');categories.id='facebookCategoryChoices';fields.append(categories);
        fields.append(category.closest('label'));
        const specifics=document.createElement('details');specifics.className='facebook-wide facebook-optional';
        const summary=document.createElement('summary');summary.textContent='Category specifics / optional fields';specifics.append(summary);
        for(const [name,label] of [['Brand','Brand'],['Model','Model'],['Color','Color'],['Material','Material'],['CategorySpecifics','Other category specifics']]){
          const optional=field(name,label,name==='CategorySpecifics'?'textarea':'text');specifics.append(optional.label);
        }
        fields.append(specifics);
        const oldCondition=fields.querySelector('[name="facebookCondition"]');const condition=document.createElement('select');condition.name='facebookCondition';condition.setAttribute('aria-required','true');
        for(const value of ['', 'New','Used - Like New','Used - Good','Used - Fair']){const option=document.createElement('option');option.value=value;option.textContent=value||'Choose condition';condition.append(option);}
        oldCondition.closest('label').firstChild.textContent='Condition *';oldCondition.replaceWith(condition);fields.append(condition.closest('label'));
        const location=field('Location','Location (City and State) *');location.input.placeholder='City, State or ZIP code';location.input.maxLength=150;location.input.setAttribute('list','facebookLocationChoices');location.input.setAttribute('aria-required','true');
        const locations=document.createElement('datalist');locations.id='facebookLocationChoices';
        const locationHint=document.createElement('small');locationHint.textContent='Save the city/state or ZIP here, then select Facebook’s matching location before publishing.';location.label.append(locationHint);fields.append(location.label,locations);
        const delivery=field('DeliveryMethod','Delivery method *','select',['Shipping & local pickup','Shipping only','Local pickup only']);fields.append(delivery.label);
        const price=fields.querySelector('[name="facebookPrice"]');price.closest('label').firstChild.textContent='Listing price ($) *';price.setAttribute('aria-required','true');fields.append(price.closest('label'));
        const tags=field('Tags','Tags');tags.input.placeholder='Enter tags separated by commas';tags.input.maxLength=1500;
        const tagsHint=document.createElement('small');tagsHint.textContent='Up to 20 tags people might search for.';tags.label.append(tagsHint);fields.append(tags.label);
        const sku=field('Sku','SKU');sku.input.maxLength=250;const skuHint=document.createElement('small');skuHint.textContent='Only visible to you. Kept separate from the public description.';sku.label.append(skuHint);fields.append(sku.label);
        const hide=field('HideFromFriends','Hide from friends','hidden');hide.input.value='false';
        const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='facebookHideFromFriendsToggle';checkbox.dataset.facebookHide='true';
        hide.label.prepend(checkbox);hide.label.classList.add('facebook-checkbox');checkbox.onchange=()=>{hide.input.value=String(checkbox.checked);};
        const hideHint=document.createElement('small');hideHint.textContent='Confirm this privacy setting on Facebook before publishing.';hide.label.append(hideHint);fields.append(hide.label);
        const actionsHeading=facebook.querySelector('h3');if(actionsHeading)actionsHeading.textContent='Prepare and publish';
        panel.append(facebook);
      }
      if(key==='ebay'){
        fields.classList.add('ebay-listing-fields');
        const title=fields.querySelector('[name="ebayTitle"]'),description=fields.querySelector('[name="ebayDescription"]');
        title.maxLength=80;title.setAttribute('aria-required','true');title.closest('label').firstChild.textContent='Title *';title.closest('label').classList.add('marketplace-wide');
        const titleCount=document.createElement('small');titleCount.id='ebayTitleCount';title.closest('label').append(titleCount);title.setAttribute('aria-describedby',titleCount.id);
        title.addEventListener('input',()=>{titleCount.textContent=title.value.length+' / 80 characters';});
        description.setAttribute('aria-required','true');description.closest('label').firstChild.textContent='Description *';description.closest('label').classList.add('marketplace-wide');
        const descriptionCount=document.createElement('small');descriptionCount.id='ebayDescriptionCount';description.closest('label').append(descriptionCount);
        description.addEventListener('input',()=>{descriptionCount.textContent=description.value.length+' characters';});
        const extra=[];
        for(const [name,caption,type] of [['Brand','Brand *','text'],['Color','Color','text'],['Sku','SKU','text'],['Quantity','Quantity *','number']]){
          const labelNode=document.createElement('label');labelNode.textContent=caption;
          const input=document.createElement('input');input.name='ebay'+name;input.type=type;
          if(type==='number'){input.min='1';input.step='1';input.setAttribute('aria-required','true');}
          else input.maxLength=250;
          labelNode.append(input);
          if(name==='Brand'||name==='Color'){
            input.setAttribute('list','ebay'+name+'Choices');
            const choices=document.createElement('datalist');choices.id='ebay'+name+'Choices';labelNode.append(choices);
            const hint=document.createElement('small');hint.textContent='Select or write your own';labelNode.append(hint);
            if(name==='Brand')input.setAttribute('aria-required','true');
          }
          extra.push(labelNode);
        }
        const excludedLabel=document.createElement('label');excludedLabel.className='facebook-checkbox marketplace-wide';
        excludedLabel.append(document.createTextNode('Exclude SKU from listing'));
        const excluded=document.createElement('input');excluded.type='hidden';excluded.name='ebayExcludeSku';excluded.value='false';
        const toggle=document.createElement('input');toggle.type='checkbox';toggle.dataset.ebayExcludeSku='true';toggle.onchange=()=>{excluded.value=String(toggle.checked);};
        excludedLabel.prepend(toggle);excludedLabel.append(excluded);
        const skuHint=document.createElement('small');skuHint.textContent='Saved with the eBay draft. Your inventory SKU stays unchanged.';excludedLabel.append(skuHint);
        const category=fields.querySelector('[name="ebayCategory"]');category.closest('label').firstChild.textContent='Category *';category.closest('label').classList.add('marketplace-wide');category.setAttribute('aria-required','true');category.setAttribute('list','ebayCategoryChoices');category.placeholder='Choose or type the full category path';
        const categories=document.createElement('datalist');categories.id='ebayCategoryChoices';category.closest('label').append(categories);
        // Keep the screenshot's sequence; retain existing price and condition fields below it.
        fields.prepend(title.closest('label'),description.closest('label'),...extra,excludedLabel,category.closest('label'));
        const ebayField=(name,caption,type='text',choices=[])=>{
          const labelNode=document.createElement('label');labelNode.textContent=caption;
          const input=document.createElement(type==='textarea'?'textarea':'input');input.name='ebay'+name;
          if(type==='textarea'){input.rows=5;input.maxLength=4000;labelNode.classList.add('marketplace-wide');}
          else{input.type=type;input.maxLength=250;}
          labelNode.append(input);
          if(choices.length){const list=document.createElement('datalist');list.id='ebay'+name+'Choices';input.setAttribute('list',list.id);
            for(const value of choices){const option=document.createElement('option');option.value=value;list.append(option);}labelNode.append(list);}
          return {label:labelNode,input};
        };
        const specificsHeading=document.createElement('h4');specificsHeading.textContent='Category specifics';specificsHeading.className='marketplace-wide';
        const typeField=ebayField('Type','Type *','text',['Cooler Box']);typeField.input.setAttribute('aria-required','true');
        const condition=fields.querySelector('[name="ebayCondition"]');const conditionLabel=condition.closest('label');conditionLabel.firstChild.textContent='Condition *';condition.setAttribute('aria-required','true');
        const conditionChoices=document.createElement('datalist');conditionChoices.id='ebayConditionChoices';condition.setAttribute('list',conditionChoices.id);
        for(const value of ['New','New other','Used','For parts or not working']){const option=document.createElement('option');option.value=value;conditionChoices.append(option);}conditionLabel.append(conditionChoices);
        const conditionDescription=ebayField('ConditionDescription','Condition description','textarea');conditionDescription.input.maxLength=1000;
        const conditionCount=document.createElement('small');conditionCount.id='ebayConditionDescriptionCount';conditionDescription.label.append(conditionCount);
        conditionDescription.input.addEventListener('input',()=>{conditionCount.textContent=conditionDescription.input.value.length+' / 1000 characters';});
        const optional=document.createElement('details');optional.className='facebook-optional marketplace-wide';const optionalSummary=document.createElement('summary');optionalSummary.textContent='Show optional fields';optional.append(optionalSummary);
        for(const [name,caption] of [['Model','Model'],['Material','Material'],['Mpn','Manufacturer part number (MPN)'],['Upc','UPC'],['OtherSpecifics','Other category specifics']])optional.append(ebayField(name,caption,name==='OtherSpecifics'?'textarea':'text').label);
        const priceLabel=fields.querySelector('[name="ebayPrice"]').closest('label');priceLabel.firstChild.textContent='Listing price ($)';
        fields.append(specificsHeading,typeField.label,conditionLabel,conditionDescription.label,optional);
        for(const [name,caption,example] of [['ShippingPolicy','Shipping policy *','Tier 3 - large under 15lbs'],['PaymentPolicy','Payment policy *','Shipped items'],['ReturnPolicy','Return policy *','30 day']]){
          const policy=ebayField(name,caption,'text',[example]);policy.label.classList.add('marketplace-wide');policy.input.placeholder='Choose or type your saved eBay policy name';policy.input.setAttribute('aria-required','true');
          const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='View / add policy details';details.append(summary,ebayField(name+'Details','Policy details or notes','textarea').label);
          const group=document.createElement('div');group.className='marketplace-wide';group.append(policy.label,details);fields.append(group);
        }
        const policyHint=document.createElement('p');policyHint.className='marketplace-form-note marketplace-wide';policyHint.textContent='Policy names and notes are saved with this draft. Confirm your actual account policies on eBay when listing.';fields.append(policyHint);
        for(const [name,caption,examples] of [['Country','Item location country *',['United States','Canada','United Kingdom','Australia']],['LocationDescription','Location description',[]],['ShippingZip','Shipping location (ZIP code) *',[]]]){
          const location=ebayField(name,caption,'text',examples);location.label.classList.add('marketplace-wide');
          if(name==='ShippingZip'){location.input.maxLength=20;location.input.autocomplete='postal-code';}
          if(name!=='LocationDescription')location.input.setAttribute('aria-required','true');
          fields.append(location.label);
        }
        for(const [heading,definitions,className] of [['Package weight',[['WeightLb','Pounds (lb)'],['WeightOz','Ounces (oz)']],'ebay-package-weight'],['Package dimensions',[['LengthIn','Length (in)'],['WidthIn','Width (in)'],['HeightIn','Height (in)']],'ebay-package-dimensions']]){
          const group=document.createElement('fieldset');group.className='marketplace-wide ebay-package-group';const legend=document.createElement('legend');legend.textContent=heading;group.append(legend);
          const inputs=document.createElement('div');inputs.className=className;
          for(const [name,caption] of definitions){const measure=ebayField(name,caption,'number');measure.input.min='0';measure.input.step='0.01';if(name==='WeightOz')measure.input.max='15.99';inputs.append(measure.label);}
          group.append(inputs);fields.append(group);
        }
        const pricing=ebayField('PricingFormat','Pricing format *');const pricingSelect=document.createElement('select');pricingSelect.name='ebayPricingFormat';pricingSelect.setAttribute('aria-required','true');
        for(const value of ['Fixed Price','Auction']){const option=document.createElement('option');option.value=value;option.textContent=value;pricingSelect.append(option);}pricing.input.replaceWith(pricingSelect);pricing.label.classList.add('marketplace-wide');
        const duration=ebayField('Duration','Duration *');const durationSelect=document.createElement('select');durationSelect.name='ebayDuration';durationSelect.setAttribute('aria-required','true');duration.input.replaceWith(durationSelect);duration.label.classList.add('marketplace-wide');
        const durationHint=document.createElement('small');durationHint.textContent='Confirm the listing duration and renewal terms on eBay before publishing.';duration.label.append(durationHint);
        function updateDuration(preferred){const values=pricingSelect.value==='Fixed Price'?["Good 'Til Cancelled"]:['1 day','3 days','5 days','7 days','10 days'];durationSelect.replaceChildren();
          for(const value of values){const option=document.createElement('option');option.value=value;option.textContent=value;durationSelect.append(option);}durationSelect.value=values.includes(preferred)?preferred:values[pricingSelect.value==='Fixed Price'?0:3];
          priceLabel.firstChild.textContent=pricingSelect.value==='Fixed Price'?'Buy It Now price ($) *':'Buy It Now price ($), optional';
        }
        pricingSelect.onchange=()=>updateDuration(durationSelect.value);panel.updateEbayDuration=updateDuration;
        const startingBid=ebayField('StartingBid','Starting bid ($), for auctions','number');startingBid.input.min='0';startingBid.input.step='0.01';
        const refreshAuction=()=>{startingBid.label.hidden=pricingSelect.value!=='Auction';};pricingSelect.addEventListener('change',refreshAuction);panel.refreshEbayAuction=refreshAuction;
        fields.append(pricing.label,duration.label,startingBid.label,priceLabel);
        const labelNode=document.createElement('label');labelNode.textContent='eBay listing link';
        const input=document.createElement('input');input.name='ebayDraftUrl';input.type='url';labelNode.append(input);panel.append(labelNode);
      }
      const reset=document.createElement('button');reset.type='button';reset.className='secondary';reset.textContent='Use inventory details';
      reset.onclick=()=>{if(!confirm('Replace this marketplace draft’s title, description, price and category with the inventory details?'))return;
        fill(key,{title:form.elements.title.value,expectedPrice:form.elements.expectedPrice.value,category:form.elements.category.value,
          description:data.items.find(i=>i.id===editingId)?.description||''},true);};panel.append(reset);
      content.append(panel);panels[key]=panel;
    }
    panels[key].setAttribute('role','tabpanel');panels[key].setAttribute('aria-labelledby','market-tab-'+key);
    const button=document.createElement('button');button.type='button';button.id='market-tab-'+key;button.dataset.marketTab=key;button.textContent=label;
    button.setAttribute('role','tab');button.setAttribute('aria-controls',panels[key].id);button.onclick=()=>select(key);tabs.append(button);
    const side=document.createElement('button');side.type='button';side.dataset.marketTab=key;side.textContent=label;side.onclick=()=>{select(key);tabs.scrollIntoView({behavior:'smooth'});};sidebar.append(side);
  }
  function fill(key,item,reset=false){
    for(const [suffix,fallback] of [['Title',item.title||''],['Price',item.expectedPrice??''],['Category',item.category||''],['Condition',''],['Description',item.description||'']]){
      const input=form.elements[key+suffix];if(input)input.value=reset?fallback:listingDraftValue(item,key,suffix,draftFlags);
    }
    if(reset){for(const suffix of ['Title','Description','Price','Category'])draftFlags[key+suffix]=false;storeFlags();}
    if(!reset && key==='etsy')form.elements.etsyDraftTags.value=item.etsyDraftTags||'';
    if(!reset && key==='ebay')form.elements.ebayDraftUrl.value=item.ebayDraftUrl||item.ebayListingUrl||'';
    if(key==='ebay'){
      if(!reset)for(const [name,fallback] of [['Brand',item.brand||''],['Color',item.color||''],['Sku',item.sku||''],['Quantity',Math.max(1,Number(item.quantityRemaining??1))],['ExcludeSku','false'],['Type',''],['ConditionDescription',''],['Model',''],['Material',''],['Mpn',''],['Upc',''],['OtherSpecifics',''],['ShippingPolicy',''],['PaymentPolicy',''],['ReturnPolicy',''],['ShippingPolicyDetails',''],['PaymentPolicyDetails',''],['ReturnPolicyDetails',''],['Country','United States'],['LocationDescription',''],['ShippingZip',''],['WeightLb',''],['WeightOz',''],['LengthIn',''],['WidthIn',''],['HeightIn',''],['PricingFormat','Fixed Price'],['StartingBid','']])
        form.elements['ebay'+name].value=LISTING_FIELD_KEYS[name]?listingDraftValue(item,'ebay',name,draftFlags):(item['ebay'+name]??fallback);
      const ebayPanel=document.getElementById('marketplace-ebay');ebayPanel.updateEbayDuration(reset?form.elements.ebayDuration.value:listingDraftValue(item,'ebay','Duration',draftFlags));ebayPanel.refreshEbayAuction();
      const excluded=form.elements.ebayExcludeSku.value;
      document.querySelector('[data-ebay-exclude-sku]').checked=excluded===true||excluded==='true'||excluded==='on';
      document.getElementById('ebayTitleCount').textContent=form.elements.ebayTitle.value.length+' / 80 characters';
      document.getElementById('ebayDescriptionCount').textContent=form.elements.ebayDescription.value.length+' characters';
      document.getElementById('ebayConditionDescriptionCount').textContent=form.elements.ebayConditionDescription.value.length+' / 1000 characters';
      for(const [name,defaults] of [['Brand',['Unbranded']],['Color',['Black','Blue','Brown','Clear','Gold','Gray','Green','Multicolor','Orange','Pink','Purple','Red','Silver','White','Yellow']],['Category',['Home & Garden > Yard, Garden & Outdoor Living > Outdoor Heating, Cooking & Eating > Ice Chests & Coolers']]]){
        const values=[...defaults,...data.items.map(i=>i['ebay'+name]||i[name.toLowerCase()]).filter(Boolean)];
        const list=document.getElementById('ebay'+name+'Choices');list.replaceChildren();
        for(const value of [...new Set(values)].sort()){const option=document.createElement('option');option.value=value;list.append(option);}
      }
      for(const name of ['Type','ShippingPolicy','PaymentPolicy','ReturnPolicy']){
        const list=document.getElementById('ebay'+name+'Choices');const values=new Set([...list.options].map(option=>option.value));
        for(const value of data.items.map(item=>item['ebay'+name]).filter(Boolean))values.add(value);
        list.replaceChildren();for(const value of [...values].sort()){const option=document.createElement('option');option.value=value;list.append(option);}
      }
    }
    if(key==='facebook'){
      const defaults={Quantity:Math.max(1,Number(item.quantityRemaining ?? 1)),Location:'',DeliveryMethod:'Local pickup only',Tags:'',Sku:item.sku||'',HideFromFriends:'false',Brand:'',Model:'',Color:'',Material:'',CategorySpecifics:''};
      for(const [name,fallback] of Object.entries(defaults)){
        const input=form.elements['facebook'+name];if(!reset)input.value=name==='Location'?(item.facebookLocation||'Bettendorf, IA'):LISTING_FIELD_KEYS[name]?listingDraftValue(item,'facebook',name,draftFlags):(item['facebook'+name]??fallback);
      }
      const checked=form.elements.facebookHideFromFriends.value;
      document.querySelector('[data-facebook-hide]').checked=checked===true || checked==='true' || checked==='on';
      document.getElementById('facebookTitleCount').textContent=form.elements.facebookTitle.value.length+' / 99 characters';
      const available=reset?data.items.find(i=>i.id===editingId)?.quantityRemaining:item.quantityRemaining;
      document.getElementById('facebookStockHint').textContent=Number(available ?? 0)+' unit(s) available in inventory. This field does not change stock.';
      for(const [id,keyName] of [['facebookCategoryChoices','facebookCategory'],['facebookLocationChoices','facebookLocation']]){
        const list=document.getElementById(id);list.replaceChildren();
        const values=data.items.map(i=>i[keyName]).filter(Boolean);
        if(keyName==='facebookCategory'){
          values.push(...data.items.map(i=>i.category).filter(Boolean));
          values.push('Sporting Goods > Outdoor Recreation > Camping & Hiking > Other Camping & Hiking');
        }
        for(const value of [...new Set(values)].sort()){
          const option=document.createElement('option');option.value=value;list.append(option);
        }
      }
      const condition=form.elements.facebookCondition;
      const conditionValue=listingDraftValue(item,'facebook','Condition',draftFlags);
      if(!reset && conditionValue && ![...condition.options].some(option=>option.value===conditionValue)){
        const option=document.createElement('option');option.value=conditionValue;option.textContent=conditionValue+' — confirm on Facebook';condition.append(option);condition.value=conditionValue;
      }
    }
  }
  tabs.onkeydown=event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const current=definitions.findIndex(([key])=>tabs.querySelector('[data-market-tab="'+key+'"]').getAttribute('aria-selected')==='true');
    const index=event.key==='Home'?0:event.key==='End'?definitions.length-1:(current+(event.key==='ArrowRight'?1:-1)+definitions.length)%definitions.length;
    event.preventDefault();select(definitions[index][0],true);
  };
  // Keep existing Photos / Details / Notes shortcuts useful while a marketplace is open.
  form.querySelector('.item-page-sidebar nav').addEventListener('click',event=>{
    const anchor=event.target.closest('a');if(!anchor)return;
    if(anchor.id==='itemPageEtsyNav'){event.preventDefault();event.stopImmediatePropagation();select('etsy');}
    else if(anchor.getAttribute('href')==='#facebookListingPanel'){event.preventDefault();event.stopImmediatePropagation();select('facebook');}
    else select('overview');
  },true);
  const previousOpen=openItem;
  openItem=function(id=null){const opened=previousOpen(id);const item=data.items.find(i=>i.id===id)||{};
    draftFlags=listingDraftOverrides(item);storeFlags();
    for(const key of ['ebay','etsy','facebook'])fill(key,item);
    select('overview');return opened;};
  select('overview');
})();
