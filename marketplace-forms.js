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
      if(key==='facebook' && facebook)panel.append(facebook);
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
