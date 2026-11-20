const $=id=>document.getElementById(id);
let draft;
const active=async()=> (await chrome.tabs.query({active:true,currentWindow:true}))[0];
async function init(){
  ({draft}=await chrome.storage.local.get('draft'));
  $('fill').disabled=!draft; $('remember').disabled=!draft;
  if(draft){$('title').value=draft.title;$('price').value=draft.price.toFixed(2);$('description').value=draft.description;
    $('photoCount').textContent=draft.photos.length+' photo(s) prepared. Photo links may expire after an hour.';}
  else $('status').textContent='Open an item in Reseller and click Send to Facebook first.';
  const tab=await active();if(facebookItem(tab?.url))$('listingUrl').value=facebookItem(tab.url);
}
$('open').onclick=()=>chrome.tabs.create({url:'https://www.facebook.com/marketplace/create/item'});
$('draftForm').onsubmit=async event=>{
  event.preventDefault();$('fill').disabled=true;
  try{
    const tab=await active();const u=new URL(tab?.url || '');
    if(!['www.facebook.com','facebook.com'].includes(u.hostname) || u.protocol!=='https:' || !/^\/marketplace\/create\/item\/?$/.test(u.pathname))throw Error('Open Facebook’s Item for sale form, then click this extension again.');
    const cleaned=cleanDraft({...draft,title:$('title').value,price:Number($('price').value),description:$('description').value});
    draft={...cleaned.draft,includePhotos:$('photos').checked};
    await chrome.storage.local.set({draft});
    $('status').textContent='Filling available fields and photos…';
    const results=await chrome.scripting.executeScript({target:{tabId:tab.id},files:['facebook.js']});
    $('status').textContent=results[0]?.result?.message || 'No result. Check the Facebook form before trying again.';
  }catch(error){$('status').textContent=error.message;}
  finally{$('fill').disabled=!draft;}
};
$('remember').onclick=async()=>{
  $('remember').disabled=true;
  try{const response=await chrome.runtime.sendMessage({type:'remember-link',itemId:draft?.itemId,url:$('listingUrl').value});
    if(response.error)throw Error(response.error);$('status').textContent='Link sent. In Reseller, click Save Item to keep it.';
  }catch(error){$('status').textContent=error.message;}finally{$('remember').disabled=!draft;}
};
$('clear').onclick=async()=>{await chrome.storage.local.remove(['draft','links']);draft=null;$('draftForm').reset();$('listingUrl').value='';$('photoCount').textContent='';$('fill').disabled=true;$('remember').disabled=true;$('status').textContent='Draft and remembered links cleared.';};
init().catch(error=>$('status').textContent=error.message);
