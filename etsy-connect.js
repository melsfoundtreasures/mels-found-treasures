(() => {
  const proofKey = "reseller_etsy_browser_proof";
  const callback = location.hash.match(/^#etsy=([A-Za-z0-9_-]{43}|failed)$/);
  if (callback) history.replaceState(history.state, "", location.pathname + location.search);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghost";
  button.textContent = "Connect Etsy";
  const status = document.createElement("span");
  status.setAttribute("role", "status");
  document.querySelector(".action-row").append(button, status);

  async function etsyRequest(body) {
    await ensureSession();
    const response = await fetch(SB_URL + "/functions/v1/etsy-oauth", {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not reach Etsy authorization.");
    return data;
  }

  button.onclick = async () => {
    if (saving || document.querySelector("dialog[open]")) {
      status.textContent = "Finish or close your open form before connecting Etsy.";
      return;
    }
    button.disabled = true;
    status.textContent = "Opening Etsy…";
    try {
      const proof = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const { authorizeUrl } = await etsyRequest({ action: "start", proof });
      const url = new URL(authorizeUrl);
      if (url.origin !== "https://www.etsy.com" || url.pathname !== "/oauth/connect") {
        throw new Error("Invalid Etsy authorization address.");
      }
      sessionStorage.setItem(proofKey, proof);
      location.assign(url.href);
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  };

  if (callback) {
    const state = callback[1];
    const proof = sessionStorage.getItem(proofKey);
    sessionStorage.removeItem(proofKey);
    if (!proof || state === "failed") {
      status.textContent = "Etsy authorization was canceled or expired. Select Connect Etsy to try again.";
      return;
    }
    button.disabled = true;
    status.textContent = "Finishing Etsy authorization…";
    etsyRequest({ action: "finish", state, proof })
      .then(() => { status.textContent = "Etsy authorized."; })
      .catch((error) => { status.textContent = error.message + " Select Connect Etsy to try again."; })
      .finally(() => { button.disabled = false; });
  }
})();
