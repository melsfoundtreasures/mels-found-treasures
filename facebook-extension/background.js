importScripts('shared.js');
chrome.runtime.onMessage.addListener((message,sender,respond) => {
  (async () => {
    const internal = sender.id===chrome.runtime.id && sender.url===chrome.runtime.getURL('popup.html');
    if(message.type==='prepare' && appUrl(sender.url)) {
      const result=cleanDraft(message.payload);
      await chrome.storage.local.set({draft:result.draft});
      await chrome.tabs.create({url:'https://www.facebook.com/marketplace/create/item'});
      return {skippedPhotos:result.skippedPhotos};
    }
    if(message.type==='listing-link' && appUrl(sender.url)) {
      const {links={}}=await chrome.storage.local.get('links');
      return {url:facebookItem(links[message.payload?.itemId])};
    }
    if(message.type==='remember-link' && internal) {
      const url=facebookItem(message.url);
      const {draft,links={}}=await chrome.storage.local.get(['draft','links']);
      if(!url || !draft || draft.itemId!==message.itemId)throw Error('Select the matching draft and its published Facebook listing.');
      links[draft.itemId]=url;
      await chrome.storage.local.set({links:Object.fromEntries(Object.entries(links).slice(-500))});
      await chrome.tabs.create({url:APP+'#item='+draft.itemId});
      return {saved:true};
    }
    // Only the injected helper on Facebook can request images from the saved draft.
    if(message.type==='photo' && sender.tab && /^https:\/\/(www\.)?facebook\.com\/marketplace\/create\/item\/?(?:\?|$)/.test(sender.url || '')) {
      const {draft}=await chrome.storage.local.get('draft');
      const url=draft?.photos?.[message.index];
      if(draft?.itemId!==message.itemId || !Number.isInteger(message.index) || !allowedPhoto(url))throw Error('Photo is unavailable. Send the item from Reseller again.');
      const response=await fetch(url,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('Photo link expired. Send the item from Reseller again.');
      const type=response.headers.get('content-type')?.split(';')[0];
      if(!['image/jpeg','image/png','image/webp'].includes(type))throw Error('Unsupported photo format. Add it manually.');
      if(Number(response.headers.get('content-length'))>10000000)throw Error('Photo is too large. Add it manually.');
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(bytes.length>10000000)throw Error('Photo is too large. Add it manually.');
      let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
      return {base64:btoa(binary),mime:type};
    }
    throw Error('This extension action is unavailable here.');
  })().then(result=>respond({result})).catch(error=>respond({error:error.message}));
  return true;
});
