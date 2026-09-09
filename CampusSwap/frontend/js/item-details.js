(() => {
  CampusSwap.pageShell("marketplace");
  const listingId = Number(new URLSearchParams(location.search).get("id"));
  const detailsContainer = document.querySelector("#itemDetails");
  let currentItem = null;
  let activePhoto = 0;

  const savedIds = () => JSON.parse(localStorage.getItem("campusswap-saved") || "[]");
  const itemPhotos = () => Array.isArray(currentItem.images) && currentItem.images.length ? currentItem.images : (currentItem.image ? [currentItem.image] : []);

  function renderGallery() {
    const photos = itemPhotos();
    const gallery = document.querySelector("#detailGallery");
    if (!photos.length) {
      gallery.innerHTML = `<div class="detail-page-image detail-placeholder" style="background:${currentItem.colour}">${currentItem.emoji}</div>`;
      return;
    }
    gallery.innerHTML = `<div class="detail-main-photo"><img src="${photos[activePhoto]}" alt="${currentItem.title}, photo ${activePhoto + 1} of ${photos.length}" />${photos.length > 1 ? `<button type="button" class="gallery-arrow previous" data-gallery-step="-1" aria-label="Previous photo">‹</button><button type="button" class="gallery-arrow next" data-gallery-step="1" aria-label="Next photo">›</button><span class="gallery-count">${activePhoto + 1} / ${photos.length}</span>` : ""}</div>${photos.length > 1 ? `<div class="detail-thumbnails">${photos.map((photo, index) => `<button type="button" class="${index === activePhoto ? "active" : ""}" data-photo-index="${index}" aria-label="View photo ${index + 1}"><img src="${photo}" alt="" /></button>`).join("")}</div>` : ""}`;
    gallery.querySelectorAll("[data-photo-index]").forEach((button) => button.addEventListener("click", () => { activePhoto = Number(button.dataset.photoIndex); renderGallery(); }));
    gallery.querySelectorAll("[data-gallery-step]").forEach((button) => button.addEventListener("click", () => { activePhoto = (activePhoto + Number(button.dataset.galleryStep) + photos.length) % photos.length; renderGallery(); }));
  }

  function updateSaveButton() {
    const button = document.querySelector("#saveButton");
    const isSaved = savedIds().includes(currentItem.id);
    button.classList.toggle("saved", isSaved);
    button.textContent = isSaved ? "♥ Saved" : "♡ Save";
  }

  function toggleSave() {
    const saved = savedIds();
    const isSaved = saved.includes(currentItem.id);
    localStorage.setItem("campusswap-saved", JSON.stringify(isSaved ? saved.filter((id) => id !== currentItem.id) : [...saved, currentItem.id]));
    updateSaveButton();
    CampusSwap.toast(isSaved ? "Removed from favourites" : "Saved to favourites");
  }

  function closeReportDialog() {
    document.querySelector("#reportDialog").classList.add("hidden");
    document.querySelector("#reportForm").reset();
  }

  async function submitReport(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reason.value) return CampusSwap.toast("Please select a report reason.");
    try {
      const user = CampusSwap.getUser();
      const result = await CampusSwap.api("/reports", { method: "POST", body: JSON.stringify({ listingId: currentItem.id, listing: currentItem.title, reporterId: user?.id, reporter: user?.name, reason: form.reason.value, description: form.description.value.trim() }) });
      closeReportDialog();
      CampusSwap.toast(result.message);
    } catch (error) { CampusSwap.toast(error.message); }
  }

  async function requestItem() {
    const user = CampusSwap.getUser();
    const result = await CampusSwap.api("/requests", { method: "POST", body: JSON.stringify({ listingId: currentItem.id, buyerId: user.id, buyer: user.name }) });
    CampusSwap.toast(result.message);
    setTimeout(() => (location.href = "/requests"), 700);
  }

  async function loadItem() {
    try {
      const listings = await CampusSwap.api("/listings");
      currentItem = listings.find((item) => item.id === listingId);
      if (!currentItem) {
        detailsContainer.innerHTML = `<div class="empty"><span>📦</span><h2>Item not found</h2><p>This listing may have been removed.</p><a class="primary inline-button" href="/marketplace">Browse other items</a></div>`;
        return;
      }
      document.title = `${currentItem.title} · CampusSwap`;
      const viewer = CampusSwap.getUser();
      const isOwner = currentItem.sellerId === viewer?.id;
      const canRequest = currentItem.status === "Available";
      const actionArea = isOwner
        ? `<div class="owner-detail-panel"><span>✓</span><div><b>This is your listing</b><small>Buyer actions are hidden from item owners.</small></div><a class="secondary" href="/my-listings">My listings</a></div>`
        : `<div class="seller-card"><div><a class="seller-profile-link" href="/profile?userId=${currentItem.sellerId}"><b>${currentItem.seller} ✓</b><small>View seller profile and reviews</small></a></div><button class="secondary" id="chatButton">Chat</button></div><div class="actions"><button class="secondary" id="saveButton"></button><button class="primary" id="requestButton" ${canRequest ? "" : "disabled"}>${canRequest ? "Request to buy" : `Currently ${currentItem.status.toLowerCase()}`}</button></div><button class="text-button" id="reportButton">⚑ Report this listing</button>`;
      const reportDialog = isOwner ? "" : `<div id="reportDialog" class="dialog-backdrop hidden"><form id="reportForm" class="dialog-card report-card"><div class="dialog-icon">⚑</div><h2>Report listing</h2><p class="muted">Your report will be reviewed by the CampusSwap admin.</p><label>Reason<select id="reportReason" name="reason" required><option value="">Select a reason</option><option>Suspected scam or fraud</option><option>Misleading item information</option><option>Prohibited or unsafe item</option><option>Duplicate or spam listing</option><option>Incorrect category</option><option>Item is no longer available</option><option>Inappropriate or offensive content</option><option>Other</option></select></label><label>Short description <small>(optional)</small><textarea name="description" maxlength="250" placeholder="Briefly explain what happened"></textarea></label><div class="actions"><button type="button" class="secondary" id="cancelReport">Cancel</button><button class="primary" type="submit">Submit report</button></div></form></div>`;
      detailsContainer.innerHTML = `<div id="detailGallery" class="detail-gallery"></div><div class="detail-copy"><span class="tag">${currentItem.category} · ${currentItem.condition}</span><h1>${currentItem.title}</h1><strong class="detail-price">RM ${Number(currentItem.price).toFixed(2)}</strong><p class="muted">${currentItem.description}</p>${actionArea}</div>${reportDialog}`;
      renderGallery();
      if (!isOwner) {
        updateSaveButton();
        document.querySelector("#saveButton").addEventListener("click", toggleSave);
        document.querySelector("#requestButton").addEventListener("click", requestItem);
        document.querySelector("#reportButton").addEventListener("click", () => { document.querySelector("#reportDialog").classList.remove("hidden"); document.querySelector("#reportReason").focus(); });
        document.querySelector("#cancelReport").addEventListener("click", closeReportDialog);
        document.querySelector("#reportForm").addEventListener("submit", submitReport);
        document.querySelector("#reportDialog").addEventListener("click", (event) => { if (event.target.id === "reportDialog") closeReportDialog(); });
        document.querySelector("#chatButton").addEventListener("click", () => { location.href = `/chat?userId=${currentItem.sellerId}&name=${encodeURIComponent(currentItem.seller)}&listingId=${currentItem.id}&item=${encodeURIComponent(currentItem.title)}`; });
      }
    } catch (error) { CampusSwap.toast(error.message); }
  }
  loadItem();
})();