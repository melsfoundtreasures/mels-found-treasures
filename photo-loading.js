const thumbnailUrls = new Map();
const fullPhotoUrls = new Map();
let inventoryPageObserver;
let salesThumbnailObserver;

function storedPhotoSource(item) {
  const stored = item.storagePhotos?.find(photo => photo.is_primary) || item.storagePhotos?.[0];
  return stored?.storage_path || item.photo || item.photos?.[0] || "";
}

async function thumbnailPath(item) {
  const source = storedPhotoSource(item);
  if (!source) return null;
  const hash = await hashBytes(new TextEncoder().encode(source));
  return TARGET_USER + "/" + item.id + "/thumbnails/" + hash + ".jpg";
}

function signedPhotoUrl(path) {
  return path.startsWith("https://") ? path : SB_URL + (path.startsWith("/storage/v1/") ? "" : "/storage/v1") + path;
}

async function loadThumbnailCells(cells) {
  const jobs = await Promise.all(cells.map(async cell => {
    const item = data.items.find(item => item.id === (cell.dataset.thumbnailId || cell.dataset.salesThumbnailId));
    if (!item) return null;
    const path = await thumbnailPath(item);
    return { cell, item, path };
  }));
  const missing = [...new Set(jobs.filter(job => job?.path &&
    (!thumbnailUrls.has(job.path) || thumbnailUrls.get(job.path).expires < Date.now())).map(job => job.path))];
  if (missing.length) {
    try {
      const signed = await request("/storage/v1/object/sign/" + PHOTO_BUCKET, {
        method: "POST", body: JSON.stringify({ paths: missing, expiresIn: 3600 }),
      });
      for (const entry of signed) {
        const path = entry.signedURL || entry.signedUrl;
        if (path) thumbnailUrls.set(entry.path, { url: signedPhotoUrl(path), expires: Date.now() + 3500000 });
      }
    } catch {
      // A missing thumbnail must not prevent inventory from opening.
    }
  }
  for (const job of jobs.filter(Boolean)) {
    if (!job.cell.isConnected) continue;
    const cached = thumbnailUrls.get(job.path);
    const inline = job.item.photo?.startsWith("data:image/") ? job.item.photo : null;
    const url = cached?.url || inline;
    if (!url) { job.cell.textContent = job.path ? "Open for photo" : "No photo"; continue; }
    const image = document.createElement("img");
    image.alt = "";
    image.width = 64;
    image.height = 64;
    image.loading = "lazy";
    image.decoding = "async";
    image.onerror = () => { job.cell.textContent = "Open for photo"; };
    image.src = url;
    job.cell.replaceChildren(image);
  }
}

function loadInventoryThumbnails() {
  void loadThumbnailCells([...document.querySelectorAll("#inventoryList [data-thumbnail-id]")]);
}

function observeSalesThumbnails() {
  salesThumbnailObserver?.disconnect();
  const cells = [...document.querySelectorAll("[data-sales-thumbnail-id]")];
  if (!("IntersectionObserver" in window)) {
    void loadThumbnailCells(cells.slice(0, 30));
    return;
  }
  salesThumbnailObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).map(entry => entry.target);
    for (const cell of visible) salesThumbnailObserver.unobserve(cell);
    if (visible.length) void loadThumbnailCells(visible);
  }, { rootMargin: "100px" });
  for (const cell of cells) salesThumbnailObserver.observe(cell);
}

function observeInventoryPage(button) {
  inventoryPageObserver?.disconnect();
  if (!("IntersectionObserver" in window)) return;
  inventoryPageObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && button.isConnected) {
      inventoryPageObserver.disconnect();
      button.click();
    }
  }, { rootMargin: "200px" });
  inventoryPageObserver.observe(button);
}

async function cacheOpenedItemThumbnail(item) {
  const path = await thumbnailPath(item);
  if (!path || thumbnailUrls.has(path)) return;
  const primary = item.storagePhotos?.find(photo => photo.is_primary) || item.storagePhotos?.[0];
  const source = primary?.url || item.photo || item.photos?.[0];
  if (!source) return;
  try {
    const response = await fetch(source, { credentials: "omit", signal: AbortSignal.timeout(15000) });
    if (!response.ok) return;
    const bitmap = await createImageBitmap(await response.blob());
    const scale = Math.min(160 / bitmap.width, 160 / bitmap.height, 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.75));
    if (!blob) return;
    await request("/storage/v1/object/" + PHOTO_BUCKET + "/" + path, {
      method: "POST", headers: { "Content-Type": "image/jpeg", "x-upsert": "true" }, body: blob,
    });
  } catch {
    // Photos remain usable if their host prevents thumbnail caching.
  }
}

const openItemBeforeLazyPhotos = openItem;
openItem = async function (id = null) {
  await openItemBeforeLazyPhotos(id);
  if (!id) return;
  const item = data.items.find(item => item.id === id);
  if (!item) return;
  try {
    await Promise.all((item.storagePhotos || []).map(async photo => {
      let cached = fullPhotoUrls.get(photo.storage_path);
      if (!cached || cached.expires < Date.now()) {
        const signed = await request("/storage/v1/object/sign/" + PHOTO_BUCKET + "/" + photo.storage_path, {
          method: "POST", body: JSON.stringify({ expiresIn: 3600 }),
        });
        const path = signed.signedURL || signed.signedUrl;
        if (!path) throw Error("Could not open this photo");
        cached = { url: signedPhotoUrl(path), expires: Date.now() + 3500000 };
        fullPhotoUrls.set(photo.storage_path, cached);
      }
      photo.url = cached.url;
    }));
    if (editingId === id && document.getElementById("itemDialog").open) renderPhotoPreview();
    void cacheOpenedItemThumbnail(item);
  } catch {
    if (editingId === id) toast("Some photos could not load. Close and reopen the item to retry.");
  }
};
