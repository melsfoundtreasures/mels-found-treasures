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

  let statusCheckAt = 0;
  let syncingOrders = false;
  const syncStatus = document.createElement("span");
  syncStatus.setAttribute("role", "status");
  document.getElementById("sortSelect").after(syncStatus);
  async function syncEtsySales() {
    if (syncingOrders || saving || !session || !ready) return;
    syncingOrders = true;
    syncStatus.textContent = "Checking Etsy sales…";
    try {
      const result = await requestEtsyListing({ action: "etsy-sales-sync" });
      syncStatus.textContent = result.imported ? result.imported + " Etsy sale(s) imported." : "";
      if (result.review) syncStatus.textContent += " " + result.review + " Etsy order(s) need review.";
      if (result.imported) await syncFromDrive();
      await processDelisting();
    } catch (error) {
      syncStatus.textContent = "Etsy sales sync needs attention. " + error.message;
    } finally {
      syncingOrders = false;
    }
  }
  let delisting = false;
  const delistStatus = document.createElement("span");
  delistStatus.setAttribute("role", "status");
  const retryDelist = document.createElement("button");
  retryDelist.type = "button";
  retryDelist.className = "secondary";
  retryDelist.textContent = "Retry Etsy delisting";
  retryDelist.hidden = true;
  document.getElementById("sortSelect").after(delistStatus, retryDelist);
  async function processDelisting() {
    if (delisting || !session) return;
    delisting = true;
    retryDelist.disabled = true;
    try {
      const result = await requestEtsyListing({ action: "listing-process-delist-jobs" });
      delistStatus.textContent = result.pending ? result.pending + " Etsy delisting(s) pending." : result.done ? "Etsy listings deactivated." : "";
      retryDelist.hidden = result.pending === 0;
    } catch (error) {
      delistStatus.textContent = "Etsy delisting needs attention. " + error.message;
      retryDelist.hidden = false;
    } finally {
      delisting = false;
      retryDelist.disabled = false;
    }
  }
  retryDelist.onclick = processDelisting;
  const previousCompleteImport = completeSavedImport;
  completeSavedImport = async function (...args) {
    await previousCompleteImport(...args);
    await processDelisting();
  };
  const originalRender = renderInventory;
  renderInventory = function () {
    originalRender();
    if (!session || !data.items.length || Date.now() - statusCheckAt < 60_000) return;
    statusCheckAt = Date.now();
    void syncEtsySales();
    void processDelisting();
    requestEtsyListing({ action: "listing-statuses" }).then(result => {
      const states = new Map(result.statuses.map(row => [row.inventoryId, row.listed]));
      for (const item of data.items) setInventoryEtsyStatus(item.id, states.get(item.id) ? "Listed" : "Not listed");
    }).catch(() => {
      // Leave the last known status visible when the marketplace cannot be reached.
    });
  };
  renderInventory();

  function show(current) {
    listing = current;
    field("link").hidden = Boolean(current);
    field("manage").hidden = !current;
    if (!current) {
      status.textContent = "No Etsy listing linked. Link an existing listing or draft.";
      if (typeof setInventoryEtsyStatus === "function") setInventoryEtsyStatus(itemId, "Not listed");
      return;
    }
    if (typeof setInventoryEtsyStatus === "function") setInventoryEtsyStatus(itemId, current.state === "active" ? "Listed" : "Not listed");
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
      for (const match of result.matches) setInventoryEtsyStatus(match.inventoryId, match.state === "active" ? "Listed" : "Not listed");
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

  const ordersButton = document.createElement("button");
  ordersButton.type = "button";
  ordersButton.className = "secondary";
  ordersButton.textContent = "Import Etsy sales";
  find.after(ordersButton);
  const orders = document.createElement("dialog");
  orders.className = "modal";
  orders.innerHTML = '<div style="padding:24px"><h2>Review Etsy sales</h2><p>Choose the matching inventory item. You can add missing expenses and purchase costs in Sales after importing.</p><p data-orders-status role="status"></p><div data-orders-rows style="display:grid;gap:20px;max-height:65vh;overflow:auto"></div><button data-orders-close class="secondary" type="button">Close</button></div>';
  document.body.append(orders);
  const ordersStatus = orders.querySelector("[data-orders-status]");
  const ordersRows = orders.querySelector("[data-orders-rows]");
  const ordersClose = orders.querySelector("[data-orders-close]");
  let importingOrder = false;
  ordersClose.onclick = () => { if (!importingOrder) orders.close(); };
  orders.addEventListener("cancel", event => { if (importingOrder) event.preventDefault(); });

  function renderOrder(order, items) {
    const card = document.createElement("form");
    card.style.cssText = "padding:16px;border:1px solid #536171;border-radius:8px";
    const title = document.createElement("h3");
    title.textContent = order.blocked ? "Order #" + order.receiptId : order.title;
    card.append(title);
    if (order.blocked) {
      const explanation = document.createElement("p");
      explanation.textContent = order.blocked;
      card.append(explanation);
      return card;
    }
    const detail = document.createElement("p");
    detail.textContent = order.saleDate + " · " + order.quantity + " unit(s) · Product revenue " + money(order.salePrice) + " · Buyer shipping " + money(order.shippingCharged);
    const selectLabel = document.createElement("label");
    selectLabel.textContent = "Inventory item";
    const select = document.createElement("select");
    select.required = true;
    select.append(new Option("Choose existing item", ""));
    for (const item of items) {
      if (item.status === "Sold" || item.quantity_remaining < order.quantity) continue;
      select.append(new Option(item.title, item.id));
    }
    select.value = order.inventoryId ?? "";
    selectLabel.append(select);
    card.append(detail, selectLabel);
    const inputs = {};
    for (const [key, label] of [
      ["shippingCost", "Actual postage ($)"], ["fees", "Etsy fees ($)"],
      ["otherCosts", "Other costs ($)"], ["costOfGoods", "Purchase cost for units sold ($)"],
    ]) {
      const fieldLabel = document.createElement("label");
      fieldLabel.textContent = label;
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "0.01";
      input.placeholder = "Optional";
      fieldLabel.append(input);
      card.append(fieldLabel);
      inputs[key] = input;
    }
    const message = document.createElement("p");
    message.setAttribute("role", "status");
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "primary";
    submit.textContent = "Import sale & update stock";
    if (select.options.length === 1) {
      message.textContent = "No inventory item has enough available stock for this order.";
      submit.disabled = true;
    }
    card.append(message, submit);
    card.onsubmit = async event => {
      event.preventDefault();
      if (importingOrder || saving) {
        message.textContent = "Another sale is saving. Try again when it finishes.";
        return;
      }
      importingOrder = true;
      ordersClose.disabled = true;
      submit.disabled = true;
      message.textContent = "Recording the Etsy sale…";
      try {
        const inventoryId = select.value;
        const result = await requestEtsyListing({
          action: "etsy-sales-save", receiptId: order.receiptId, transactionId: order.transactionId,
          inventoryId, expectedInventory: rawItems.get(inventoryId),
          ...Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value === "" ? null : Number(input.value)])),
        });
        message.textContent = result.imported ? "Sale imported." : "This Etsy order was already imported.";
        for (const input of card.querySelectorAll("input, select")) input.disabled = true;
        await syncFromDrive();
        await processDelisting();
      } catch (error) {
        message.textContent = error.message;
        submit.disabled = false;
      } finally {
        importingOrder = false;
        ordersClose.disabled = false;
      }
    };
    return card;
  }
  ordersButton.onclick = async () => {
    if (saving) return toast("Wait for the current save.");
    ordersRows.replaceChildren();
    ordersStatus.textContent = "Loading paid Etsy orders…";
    orders.showModal();
    try {
      const result = await requestEtsyListing({ action: "etsy-sales-preview" });
      for (const order of result.rows) ordersRows.append(renderOrder(order, result.items));
      ordersStatus.textContent = result.rows.length ? "Showing orders from the latest 100 paid orders." : "No new eligible Etsy sales found in the latest 100 paid orders.";
      if (result.hasMore) ordersStatus.textContent += " Older orders are outside this review.";
    } catch (error) {
      ordersStatus.textContent = error.message;
    }
  };
})();
