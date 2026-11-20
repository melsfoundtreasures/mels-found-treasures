const APP = 'https://melsfoundtreasures.github.io/mels-found-treasures/';
function appUrl(value) { try { const u=new URL(value); return u.origin==='https://melsfoundtreasures.github.io' && u.pathname.startsWith('/mels-found-treasures/'); } catch {return false;} }
function facebookItem(value) { try {const u=new URL(value); return u.protocol==='https:' && ['www.facebook.com','facebook.com'].includes(u.hostname) && /^\/marketplace\/item\/\d+\/?$/.test(u.pathname) ? 'https://www.facebook.com'+u.pathname.replace(/\/$/,'')+'/' : null;} catch {return null;} }
function allowedPhoto(value) {
  if(typeof value!=='string' || value.length>3000000)return false;
  if(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))return true;
  try {const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password &&
    ((u.hostname==='qlzbgzlfuajsxqsjlduo.supabase.co' && u.pathname.startsWith('/storage/v1/object/sign/reseller-photos/')) ||
    (u.hostname==='images.vendoo.co' && u.pathname.startsWith('/images/'))); } catch {return false;}
}
function cleanDraft(payload) {
  if(!payload || !/^[0-9a-f-]{36}$/i.test(payload.itemId || '') || typeof payload.title!=='string' || !payload.title.trim() ||
    payload.title.length>200 || typeof payload.description!=='string' || !payload.description.trim() || payload.description.length>10000 ||
    !Number.isFinite(payload.price) || payload.price<0 || payload.price>10000000 || Math.round(payload.price*100)/100!==payload.price)
    throw Error('Invalid listing details. Return to the item in Reseller.');
  const photos=(Array.isArray(payload.photos)?payload.photos:[]).slice(0,10);
  const accepted=[];let size=0;
  for(const photo of photos)if(allowedPhoto(photo) && size+photo.length<=6500000){accepted.push(photo);size+=photo.length;}
  return {draft:{itemId:payload.itemId,title:payload.title.trim(),description:payload.description.trim(),price:payload.price,
    photos:accepted,createdAt:Date.now()},skippedPhotos:photos.length-accepted.length};
}
