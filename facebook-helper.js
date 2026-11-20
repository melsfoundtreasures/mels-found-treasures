(() => {
  const form = document.getElementById('itemForm');
  const panel = document.createElement('section');
  panel.id = 'facebookListingPanel';
  panel.innerHTML = `<h3>Facebook Marketplace</h3>
    <p>Send this item to the Reseller Chrome extension, then review it on Facebook before publishing. Category, condition and location are selected on Facebook.</p>
    <label>Listing description<textarea name="facebookDescription" rows="6" maxlength="10000" placeholder="Describe the item, its condition and any flaws"></textarea></label>
    <label>Published Facebook listing link<input name="facebookListingUrl" type="url" placeholder="https://www.facebook.com/marketplace/item/…" pattern="https://(www\\.)?facebook\\.com/marketplace/item/[0-9]+/?"></label>
    <p>Use Save Item to keep the description and listing link.</p>
    <button type="button" class="secondary" data-facebook-send>Send to Facebook</button>
    <p data-facebook-status role="status"></p>
    <a href="./reseller-facebook-extension.zip" download>Download the Chrome extension</a> · <a href="./facebook-extension-setup.html" target="_blank" rel="noopener">Installation instructions</a>`;
  form.elements.notes.closest('label').before(panel);
  const nav = document.createElement('a');
  nav.href = '#facebookListingPanel'; nav.textContent = 'Facebook listing';
  nav.onclick = event => { event.preventDefault(); panel.scrollIntoView({behavior:'smooth'}); };
  form.querySelector('nav').append(nav);
  const status = panel.querySelector('[data-facebook-status]');
  const send = panel.querySelector('[data-facebook-send]');
  function bridge(type, payload) {
    return new Promise((resolve,reject) => {
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => { window.removeEventListener('message', listener); reject(Error('Install or reload the Reseller Chrome extension, then refresh this page.')); }, 6000);
      function listener(event) {
        if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'reseller-facebook-response-v1' || event.data.requestId !== requestId) return;
        clearTimeout(timer); window.removeEventListener('message', listener);
        event.data.error ? reject(Error(event.data.error)) : resolve(event.data.result);
      }
      window.addEventListener('message',listener);
      window.postMessage({channel:'reseller-facebook-request-v1',requestId,type,payload},location.origin);
    });
  }
  const previousOpen = openItem;
  openItem = async function(id) {
    send.disabled = true;
    await previousOpen(id);
    if (editingId !== id) return;
    const item = data.items.find(i => i.id === id);
    status.textContent = '';
    form.elements.facebookDescription.value = item?.facebookDescription || item?.description || '';
    form.elements.facebookListingUrl.value = item?.facebookListingUrl || '';
    send.disabled = !item || item.status === 'sold';
    if (!item) return;
    try {
      const result = await bridge('listing-link', {itemId:id});
      if (editingId === id && result?.url && !form.elements.facebookListingUrl.value) {
        form.elements.facebookListingUrl.value = result.url;
        status.textContent = 'Facebook link received. Click Save Item to keep it.';
      }
    } catch {} // The editor remains usable without the companion extension.
  };
  send.onclick = async () => {
    if (!ready || saving || !editingId) return toast('Save the item and wait for the current sync first.');
    const item = data.items.find(i => i.id === editingId);
    if (!item || item.status === 'sold' || !(item.quantityRemaining > 0)) return toast('This item has no available stock.');
    send.disabled = true;
    try {
      const title = form.elements.title.value.trim();
      const price = Number(form.elements.expectedPrice.value);
      const description = form.elements.facebookDescription.value.trim();
      if (!title || title.length > 200 || !Number.isFinite(price) || price < 0 || Math.round(price*100)/100 !== price || !description)
        throw Error('Enter a title (up to 200 characters), a price in cents and a Facebook description.');
      // Share listing content only. Costs, sales, notes and account credentials stay in Reseller.
      const originals = [...(item.storagePhotos || []).map(p => p.url), ...workingPhotos.map(photoSrc), ...(item.photos || [])].filter(Boolean);
      const photos = [...new Set(originals.length ? originals : [item.photo].filter(Boolean))].slice(0,10);
      const result = await bridge('prepare', {itemId:item.id,title,price,description,photos});
      status.textContent = 'Item sent. On Facebook, open the Reseller extension and click Fill listing. ' +
        (result.skippedPhotos ? result.skippedPhotos + ' photo(s) need to be added manually.' : '');
    } catch (error) { status.textContent = error.message; }
    finally { send.disabled = false; }
  };
})();
