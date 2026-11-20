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
      const input=form.elements[key+suffix];if(input)input.value=reset?fallback:(item[key+suffix]??fallback);
    }
    if(!reset && key==='etsy')form.elements.etsyDraftTags.value=item.etsyDraftTags||'';
    if(!reset && key==='ebay')form.elements.ebayDraftUrl.value=item.ebayDraftUrl||item.ebayListingUrl||'';
    if(key==='facebook'){
      const defaults={Quantity:Math.max(1,Number(item.quantityRemaining ?? 1)),Location:'',DeliveryMethod:'Local pickup only',Tags:'',Sku:item.sku||'',HideFromFriends:'false',Brand:'',Model:'',Color:'',Material:'',CategorySpecifics:''};
      for(const [name,fallback] of Object.entries(defaults)){
        const input=form.elements['facebook'+name];if(!reset)input.value=item['facebook'+name]??fallback;
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
      if(!reset && item.facebookCondition && ![...condition.options].some(option=>option.value===item.facebookCondition)){
        const option=document.createElement('option');option.value=item.facebookCondition;option.textContent=item.facebookCondition;condition.append(option);condition.value=item.facebookCondition;
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
    for(const key of ['ebay','etsy','facebook'])fill(key,item);
    select('overview');return opened;};
  select('overview');
})();
