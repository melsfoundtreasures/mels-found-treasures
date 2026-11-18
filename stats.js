function buildResellerStats(items, sales, options, profitForSale) {
  const byId = new Map(items.map(item => [item.id, item]));
  const today = options.today;
  const end = Date.parse(today + "T00:00:00Z");
  const start = options.days === null ? -Infinity : end - (options.days - 1) * 86400000;
  const products = new Map();
  const categories = new Map();
  const marketplaces = new Map();
  const months = new Map();
  const totals = {
    sales: 0, units: 0, revenue: 0, profit: 0, cost: 0, completeSales: 0,
    completeUnits: 0, completeRevenue: 0, speedUnits: 0, speedDays: 0, invalidDates: 0,
  };

  function group(map, key, name) {
    if (!map.has(key)) map.set(key, {
      name, units: 0, revenue: 0, profit: 0, completeSales: 0, completeUnits: 0,
      sales: 0, speedUnits: 0, speedDays: 0,
    });
    return map.get(key);
  }
  function calendarDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const time = Date.parse(value + "T00:00:00Z");
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
  }
  for (const sale of sales) {
    const marketplace = sale.marketplace || "Unspecified";
    if (options.marketplace !== "all" && options.marketplace !== marketplace) continue;
    const sold = calendarDate(sale.saleDate);
    if (sold === null || sold > end) { totals.invalidDates++; continue; }
    if (sold < start) continue;
    const item = byId.get(sale.itemId);
    const quantity = Number(sale.quantity);
    const revenue = Number(sale.salePrice);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || !Number.isFinite(revenue)) continue;
    const title = String(item?.title || "Unknown item").trim();
    const category = String(item?.category || "Uncategorized").trim() || "Uncategorized";
    const titleKey = title.normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
    const profit = profitForSale(sale, item);
    const complete = profit !== null && Number.isFinite(profit);
    const listed = calendarDate(item?.listingDate);
    const days = listed !== null && listed <= sold ? (sold - listed) / 86400000 : null;
    const groups = [
      group(products, titleKey, title), group(categories, category.toLowerCase(), category),
      group(marketplaces, marketplace, marketplace), group(months, sale.saleDate.slice(0, 7), sale.saleDate.slice(0, 7)),
    ];
    totals.sales++;
    totals.units += quantity;
    totals.revenue += revenue;
    if (complete) {
      totals.profit += profit;
      totals.cost += Number(sale.purchaseCostAllocated);
      totals.completeRevenue += revenue + Number(sale.shippingCharged || 0);
      totals.completeSales++;
      totals.completeUnits += quantity;
    }
    if (days !== null) {
      totals.speedDays += days * quantity;
      totals.speedUnits += quantity;
    }
    for (const entry of groups) {
      entry.sales++;
      entry.units += quantity;
      entry.revenue += revenue;
      if (complete) {
        entry.profit += profit;
        entry.completeSales++;
        entry.completeUnits += quantity;
      }
      if (days !== null) {
        entry.speedDays += days * quantity;
        entry.speedUnits += quantity;
      }
    }
  }
  return { totals, products: [...products.values()], categories: [...categories.values()],
    marketplaces: [...marketplaces.values()], months: [...months.values()] };
}

(() => {
  const page = document.getElementById("statsPage");
  const home = document.getElementById("homePage");
  const period = document.getElementById("statsPeriod");
  const marketplace = document.getElementById("statsMarketplace");
  const summary = document.getElementById("statsSummary");
  const reports = document.getElementById("statsReports");
  const coverage = document.getElementById("statsCoverage");
  const escape = escapeHtml;
  const number = value => new Intl.NumberFormat().format(value);
  const days = entry => entry.speedUnits ? (entry.speedDays / entry.speedUnits).toFixed(1) + " days" : "—";
  const profit = entry => entry.completeSales ? money(entry.profit) : "Pending costs";

  function table(title, description, columns, rows) {
    return '<article class="stats-report"><h2>' + escape(title) + '</h2><p>' + escape(description) +
      '</p><div class="stats-table-scroll"><table><thead><tr>' +
      columns.map(label => '<th scope="col">' + escape(label) + '</th>').join("") +
      '</tr></thead><tbody>' + (rows.length ? rows.map(cells => '<tr>' +
        cells.map((cell, index) => index === 0 ? '<th scope="row">' + escape(cell) + '</th>' : '<td>' + escape(cell) + '</td>').join("") +
      '</tr>').join("") : '<tr><td colspan="' + columns.length + '">No qualifying sales in this period.</td></tr>') +
      '</tbody></table></div></article>';
  }
  function renderStats() {
    const oldPlatform = marketplace.value;
    const platforms = [...new Set(data.sales.map(sale => sale.marketplace || "Unspecified"))].sort();
    marketplace.innerHTML = '<option value="all">All marketplaces</option>' +
      platforms.map(name => '<option value="' + escape(name) + '">' + escape(name) + '</option>').join("");
    marketplace.value = platforms.includes(oldPlatform) ? oldPlatform : "all";
    if (!ready) {
      summary.replaceChildren();
      reports.replaceChildren();
      coverage.textContent = session ? "Loading your sales…" : "Sign in to see your sales stats.";
      return;
    }
    const localToday = new Date();
    const today = localToday.getFullYear() + "-" + String(localToday.getMonth() + 1).padStart(2, "0") +
      "-" + String(localToday.getDate()).padStart(2, "0");
    const stats = buildResellerStats(data.items, data.sales, {
      today, days: period.value === "all" ? null : Number(period.value), marketplace: marketplace.value,
    }, saleProfit);
    const total = stats.totals;
    const unsold = data.items.filter(item => item.status !== "sold");
    const inventoryCost = unsold.reduce((sum, item) => sum + availableStockCost(item), 0);
    const expectedRevenue = unsold.reduce((sum, item) => sum + Number(item.expectedPrice || 0), 0);
    const periodStats = buildResellerStats(data.items, data.sales, {
      today, days: period.value === "all" ? null : Number(period.value), marketplace: "all",
    }, saleProfit);
    const platformTotal = name => periodStats.marketplaces.find(entry => entry.name.toLowerCase() === name.toLowerCase()) ||
      { units: 0, revenue: 0, sales: 0 };
    coverage.textContent = total.sales
      ? number(total.sales) + " recorded sales · Profit available for " + number(total.completeSales) +
        " sales · Listing dates available for " + number(total.speedUnits) + " of " + number(total.units) + " sold units."
      : "Your recorded sales will appear here for the selected period and marketplace.";
    if (total.invalidDates) coverage.textContent += " " + number(total.invalidDates) + " sale(s) have missing or future dates.";
    const cards = [
      ...["eBay", "Etsy", "Facebook Marketplace"].map(name => {
        const platform = platformTotal(name);
        return [name + " total sales", money(platform.revenue),
          number(platform.units) + " units · " + number(platform.sales) + " sale records · Selected date range, item revenue"];
      }),
      ["Units sold", number(total.units), number(total.sales) + " sale records"],
      ["Product revenue", money(total.revenue), "Item sale prices, excluding shipping and tax"],
      ["Known net profit", total.completeSales ? money(total.profit) : "Pending costs", "After purchase cost, shipping, and recorded fees"],
      ["Average time to sell", days(total), "From listing date to sale, weighted by units"],
      ["Profit per unit", total.completeUnits ? money(total.profit / total.completeUnits) : "—", "Across sales with complete costs"],
      ["Return on cost", total.cost > 0 ? (100 * total.profit / total.cost).toFixed(1) + "%" : "—", "Known net profit ÷ allocated purchase cost"],
      ["Inventory cost", money(inventoryCost), "Current unsold inventory across all dates"],
      ["Expected sales", money(expectedRevenue), "Current unsold items at their asking price"],
    ];
    summary.innerHTML = cards.map(([label, value, note]) => '<article><span>' + escape(label) +
      '</span><strong>' + escape(value) + '</strong><small>' + escape(note) + '</small></article>').join("");

    const best = stats.products.sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 10);
    const quickest = stats.products.filter(entry => entry.speedUnits)
      .sort((a, b) => a.speedDays / a.speedUnits - b.speedDays / b.speedUnits || b.speedUnits - a.speedUnits).slice(0, 10);
    const profitable = stats.products.filter(entry => entry.completeSales)
      .sort((a, b) => b.profit - a.profit).slice(0, 10);
    const categories = stats.categories.sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 10);
    reports.innerHTML =
      table("Best sellers", "Items ranked by total units sold. Matching item titles are grouped together.",
        ["Item", "Units", "Revenue"], best.map(entry => [entry.name, number(entry.units), money(entry.revenue)])) +
      table("Quickest sellers", "Average days from listing to sale. The unit count shows how much history supports each result.",
        ["Item", "Avg. days", "Dated units"], quickest.map(entry => [entry.name, days(entry), number(entry.speedUnits)])) +
      table("Most profit", "Total net profit from sales with complete recorded costs and expenses.",
        ["Item", "Net profit", "Complete units"], profitable.map(entry => [entry.name, profit(entry), number(entry.completeUnits)])) +
      table("Categories", "Compare the types of items that sell. Add a category to an item to improve this breakdown.",
        ["Category", "Units", "Revenue", "Known profit"], categories.map(entry => [entry.name, number(entry.units), money(entry.revenue), profit(entry)])) +
      table("Marketplaces", "Based on the marketplace recorded on each sale.",
        ["Marketplace", "Units", "Revenue", "Known profit"], stats.marketplaces.sort((a, b) => b.revenue - a.revenue)
          .map(entry => [entry.name, number(entry.units), money(entry.revenue), profit(entry)])) +
      table("Monthly sales", "Recent months within your selected period, grouped by sale date.",
        ["Month", "Units", "Revenue", "Known profit"], stats.months.sort((a, b) => b.name.localeCompare(a.name)).slice(0, 12)
          .map(entry => [new Date(entry.name + "-01T12:00:00").toLocaleDateString(undefined, { month: "short", year: "numeric" }),
            number(entry.units), money(entry.revenue), profit(entry)]));
  }
  function showStatsRoute() {
    const visible = location.hash === "#stats";
    page.classList.toggle("hidden", !visible);
    home.classList.toggle("hidden", visible);
    document.getElementById("statsLink").setAttribute("aria-current", visible ? "page" : "false");
    if (visible) {
      renderStats();
      document.getElementById("statsTitle").focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }
  const renderApp = render;
  render = function () {
    renderApp();
    if (location.hash === "#stats") renderStats();
  };
  period.addEventListener("change", renderStats);
  marketplace.addEventListener("change", renderStats);
  window.addEventListener("hashchange", showStatsRoute);
  showStatsRoute();
})();
