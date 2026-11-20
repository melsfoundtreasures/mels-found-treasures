(async () => {
  const {draft}=await chrome.storage.local.get('draft');
  if(!draft)return {message:'No item prepared. Send one from Reseller first.'};
  const visible=e=>e.getClientRects().length>0 && !e.disabled && !e.readOnly;
  const labels=e=>[e.getAttribute('aria-label'),e.getAttribute('placeholder'),
    ...(e.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent),
    ...Array.from(e.labels||[]).map(label=>label.textContent),e.closest('label')?.textContent]
    .filter(Boolean).map(s=>s.trim().replace(/\s+/g,' ').toLowerCase());
  function find(name){const controls=[...document.querySelectorAll('input:not([type=file]),textarea,[contenteditable=true][role=textbox]')].filter(visible);
    const found=controls.filter(e=>labels(e).some(label=>label===name || label===name+' (required)'));return found.length===1?found[0]:null;}
  const found={title:find('title'),price:find('price'),description:find('description')};
  const missing=Object.keys(found).filter(k=>!found[k]);
  if(missing.length)return {message:'Facebook’s '+missing.join(', ')+' field(s) could not be identified safely. Wait for the form to finish loading, or copy these details from the extension manually. No fields were changed.'};
  for(const [key,e] of Object.entries(found)) {
    const existing=('value' in e?e.value:e.textContent).trim();
    const desired=key==='price'?Number(draft.price).toFixed(2):String(draft[key]);
    if(existing && existing!==desired && !(key==='price' && Number(existing)===draft.price))
      return {message:'The Facebook form already contains different details. Clear those fields or open a fresh listing first. No fields were changed.'};
  }
  for(const [key,e] of Object.entries(found)){
    const value=key==='price'?Number(draft.price).toFixed(2):draft[key];e.focus();
    if(e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement){
      const prototype=e instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(prototype,'value').set.call(e,value);
    }else e.textContent=value;
    e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));e.blur();
  }
  await new Promise(resolve=>setTimeout(resolve,350));
  for(const key of ['title','price','description']) {
    const e=find(key),value=e && ('value' in e?e.value:e.textContent).trim();
    if(!e || (key==='price'?Number(value)!==draft.price:value!==draft[key]))
      return {message:'Facebook did not keep all of the filled details. Review the form and copy missing text from the extension. Photos were not added.'};
  }
  let photoMessage='Add your photos manually.';
  if(draft.includePhotos && draft.photos.length){
    const uploads=[...document.querySelectorAll('input[type=file]')].filter(e=>!e.disabled && /image/.test(e.accept));
    if(uploads.length===1){
      const input=uploads[0];
      const marker=document.documentElement.dataset.resellerPhotoDraft;
      if(input.files?.length || marker===draft.itemId)photoMessage='Photos were already added; check them before adding more.';
      else {
        const transfer=new DataTransfer();let failed=0;
        const max=input.multiple?Math.min(draft.photos.length,10):1;
        for(let index=0;index<max;index++){
          try{
            const response=await chrome.runtime.sendMessage({type:'photo',itemId:draft.itemId,index});
            if(response.error)throw Error(response.error);
            const {base64,mime}=response.result, binary=atob(base64), bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
            transfer.items.add(new File([bytes],'reseller-'+(index+1)+'.'+({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime]),{type:mime}));
          }catch{failed++;}
        }
        if(transfer.files.length){input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));document.documentElement.dataset.resellerPhotoDraft=draft.itemId;}
        photoMessage=transfer.files.length+' photo(s) sent. '+(failed || draft.photos.length>max?'Some photos need to be added manually.':'Check that Facebook has finished uploading them.');
      }
    }
  }
  return {message:'Title, price and description filled. '+photoMessage+'\nChoose category, condition and location, review everything, then publish on Facebook. Nothing was published by the extension.'};
})();
