(() => {
  CampusSwap.pageShell("my-listings");
  const currentUser = CampusSwap.getUser();
  const grid = document.querySelector("#myListingGrid");
  const count = document.querySelector("#myListingCount");

  async function loadMyListings() {
    try {
      const listings = await CampusSwap.api("/listings");
      const mine = listings.filter((item) => item.sellerId === currentUser.id);
      const activeCount = mine.filter((item) => !["Sold", "Completed", "Removed"].includes(item.status)).length;
      count.textContent = `${activeCount} active listing${activeCount === 1 ? "" : "s"}`;
      grid.innerHTML = mine.length ? mine.map((item) => {
        const completed = item.status === "Sold" || item.status === "Completed";
        const statusLabel = completed ? "Completed" : item.status;
        return `<article class="listing owner-listing ${completed ? "completed-listing" : ""}"><button class="listing-image" style="background:${item.colour}" data-details="${item.id}">${item.image ? `<img src="${item.image}" alt="${item.title}" />` : `<span>${item.emoji}</span>`}<small>${item.condition}</small></button><div class="listing-info"><span class="owner-status ${completed ? "completed" : ""}">${statusLabel}</span><span class="category">${item.category}</span><h3>${item.title}</h3><strong>RM ${Number(item.price).toFixed(2)}</strong><p>Posted ${item.posted.toLowerCase()}</p><a class="secondary owner-view-button" href="/item-details?id=${item.id}">View details</a></div></article>`;
      }).join("") : `<div class="empty"><span>📦</span><h2>No listings yet</h2><p>Post your first item and it will appear here.</p><a class="primary inline-button" href="/sell">Post an item</a></div>`;
      grid.querySelectorAll("[data-details]").forEach((button) => button.addEventListener("click", () => location.href = `/item-details?id=${button.dataset.details}`));
    } catch (error) {
      CampusSwap.toast(error.message);
    }
  }
  loadMyListings();
})();