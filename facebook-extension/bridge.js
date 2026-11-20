window.addEventListener('message', async event => {
  if(event.source!==window || event.origin!=='https://melsfoundtreasures.github.io' ||
    !location.pathname.startsWith('/mels-found-treasures/') || event.data?.channel!=='reseller-facebook-request-v1')return;
  const {requestId,type,payload}=event.data;
  if(typeof requestId!=='string' || requestId.length>50 || !['prepare','listing-link'].includes(type))return;
  let response;
  try {response=await chrome.runtime.sendMessage({type,payload});}
  catch {response={error:'The extension was updated. Refresh Reseller and try again.'};}
  window.postMessage({channel:'reseller-facebook-response-v1',requestId,...response},event.origin);
});
