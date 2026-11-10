(() => {
  const form = document.getElementById("itemForm");
  const panel = document.createElement("section");
  panel.id = "etsyListingPanel";
  panel.tabIndex = -1;
  panel.hidden = true;
  panel.innerHTML = `
    <h3>Etsy listing</h3>
    <p role="status" data-etsy="status"></p>
    <div data-etsy="link">
      <label>Etsy listing ID <input data-etsy="id" type="text" inputmode="numeric" maxlength="18"></label>
      <button class="secondary" type="button" data-etsy="attach">Link Etsy listing</button>
      <a href="https://www.etsy.com/your/shops/me/tools/listings" target="_blank" rel="noopener noreferrer">Open Etsy Shop Manager to create a draft</a>
    </div>
    <div data-etsy="manage" hidden>
      <p data-etsy="tags"></p>
      <label>Add Etsy tags <input data-etsy="new-tags" type="text" maxlength="400" placeholder="vintage decor, ceramic vase"></label>
      <small>Separate tags with commas. Etsy allows up to 13 tags, 20 characters each.</small>
      <div class="action-row">
        <button class="secondary" type="button" data-etsy="save-tags">Add tags</button>
        <button class="secondary" type="button" data-etsy="publish">List on Etsy</button>
        <button class="secondary" type="button" data-etsy="delist">Delist from Etsy</button>
      </div>
    </div>
    <button class="ghost" type="button" data-etsy="refresh">Refresh Etsy status</button>
  `;
  form.elements.notes.closest("label").before(panel);

  const field = name => panel.querySelector('[data-etsy="' + name + '"]');
  const status = field("status");
  let itemId, version = 0, listing;
  const labels = { active: "Listed", draft: "Draft", inactive: "Delisted", edit: "Delisted", sold_out: "Sold out", expired: "Expired" };

  async function requestEtsyListing(payload) {
    await ensureSession();
    const response = await fetch(SB_URL + "/functions/v1/etsy-oauth", {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.message || "Could not reach Etsy.");
    return result;
  }

  function show(current) {
    listing = current;
    field("link").hidden = Boolean(current);
    field("manage").hidden = !current;
    if (!current) {
      status.textContent = "No Etsy listing linked. Link an existing listing or draft.";
      if (typeof setInventoryEtsyStatus === "function") setInventoryEtsyStatus(itemId, "Unlinked");
      return;
    }
    if (typeof setInventoryEtsyStatus === "function") setInventoryEtsyStatus(itemId, labels[current.state] || "Review in Etsy");
    status.textContent = (labels[current.state] || "Review in Etsy") + " · " + current.title + " (#" + current.id + ")";
    field("tags").textContent = current.tags.length ? "Tags · " + current.tags.join(", ") : "No Etsy tags";
    field("publish").hidden = !["draft", "inactive", "edit"].includes(current.state);
    field("delist").hidden = current.state !== "active";
  }

  async function run(action, payload = {}) {
    const currentVersion = version;
    const inventoryId = itemId;
    const controls = [...panel.querySelectorAll("button, input")];
    for (const control of controls) control.disabled = true;
    status.textContent = "Checking Etsy…";
    try {
      const result = await requestEtsyListing({ action, inventoryId, ...payload });
      if (currentVersion !== version) return;
      show(result.listing);
      if (action === "listing-tags") field("new-tags").value = "";
    } catch (error) {
      if (currentVersion === version) status.textContent = error.message;
    } finally {
      if (currentVersion === version) for (const control of controls) control.disabled = false;
    }
  }

  field("refresh").onclick = () => run("listing-view");
  field("attach").onclick = () => run("listing-link", { listingId: field("id").value.trim() });
  field("save-tags").onclick = () => run("listing-tags", { tags: field("new-tags").value });
  field("publish").onclick = () => {
    if (listing && confirm("Publish “" + listing.title + "” on Etsy? Etsy listing fees may apply.")) run("listing-publish");
  };
  field("delist").onclick = () => {
    if (listing && confirm("Deactivate “" + listing.title + "” on Etsy? You can relist it later.")) run("listing-delist");
  };
  panel.addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target.tagName === "INPUT") event.preventDefault();
  });

  const openInventoryItem = openItem;
  openItem = async function (id = null) {
    const opened = ++version;
    itemId = id;
    panel.hidden = true;
    field("link").hidden = true;
    field("manage").hidden = true;
    field("id").value = "";
    field("new-tags").value = "";
    listing = null;
    await openInventoryItem(id);
    if (opened !== version || !id || !data.items.some(item => item.id === id)) return;
    panel.hidden = false;
    void run("listing-view");
  };

  const find = document.createElement("button");
  find.type = "button";
  find.className = "secondary";
  find.textContent = "Find Etsy matches";
  document.getElementById("sortSelect").after(find);
  const review = document.createElement("dialog");
  review.innerHTML = `
    <div class="modal">
      <h2>Match Etsy listings</h2>
      <p>Review the unique title matches below. Uncheck any pair you don’t want to link.</p>
      <p role="status" data-match-status></p>
      <div data-match-rows style="display:grid;gap:10px;max-height:50vh;overflow:auto"></div>
      <div class="modal-actions">
        <button class="secondary" type="button" data-match-close>Close</button>
        <button class="primary" type="button" data-match-save disabled>Link selected</button>
      </div>
    </div>`;
  document.body.append(review);
  const message = review.querySelector("[data-match-status]");
  const rows = review.querySelector("[data-match-rows]");
  const save = review.querySelector("[data-match-save]");
  const close = review.querySelector("[data-match-close]");
  close.onclick = () => review.close();
  review.addEventListener("cancel", event => { if (close.disabled) event.preventDefault(); });
  rows.addEventListener("change", () => { save.disabled = !rows.querySelector("input:checked"); });

  find.onclick = async () => {
    if (saving) return toast("Wait for the current save.");
    rows.replaceChildren();
    save.disabled = true;
    close.disabled = true;
    message.textContent = "Checking your Etsy shop and inventory…";
    review.showModal();
    try {
      const result = await requestEtsyListing({ action: "listing-match-preview" });
      for (const match of result.matches) {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.value = match.inventoryId + ":" + match.listingId;
        const summary = document.createElement("span");
        summary.textContent = match.itemTitle + " → " + match.etsyTitle + " (" + (labels[match.state] || match.state) + ", #" + match.listingId + ")";
        label.style.cssText = "display:flex;align-items:start;gap:8px";
        checkbox.style.width = "auto";
        label.append(checkbox, summary);
        rows.append(label);
      }
      message.textContent = "Found " + result.matches.length + " new matches across " + result.scanned + " Etsy listings. Already linked and ambiguous titles were skipped.";
      save.disabled = result.matches.length === 0;
    } catch (error) {
      message.textContent = error.message;
    } finally {
      close.disabled = false;
    }
  };

  save.onclick = async () => {
    const matches = [...rows.querySelectorAll("input:checked")].map(input => input.value);
    save.disabled = true;
    close.disabled = true;
    for (const input of rows.querySelectorAll("input")) input.disabled = true;
    message.textContent = "Saving the selected links…";
    try {
      const result = await requestEtsyListing({ action: "listing-match-save", matches });
      for (const match of result.matches) setInventoryEtsyStatus(match.inventoryId, labels[match.state] || "Review in Etsy");
      rows.replaceChildren();
      message.textContent = "Linked " + result.linked + " Etsy listings.";
    } catch (error) {
      message.textContent = error.message;
      for (const input of rows.querySelectorAll("input")) input.disabled = false;
      save.disabled = false;
    } finally {
      close.disabled = false;
    }
  };
})();
