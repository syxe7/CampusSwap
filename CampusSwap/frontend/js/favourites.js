(() => {
  CampusSwap.pageShell("");
  const grid = document.querySelector("#favouriteGrid");
  const count = document.querySelector("#favouriteCount");
  const savedIds = () => JSON.parse(localStorage.getItem("campusswap-saved") || "[]");

  async function renderFavourites() {
    try {
      const listings = await CampusSwap.api("/listings");
      const items = listings.filter((item) => savedIds().includes(item.id));
      count.textContent = `${items.length} saved item${items.length === 1 ? "" : "s"}`;
      grid.innerHTML = items.length ? items.map((item) => `<article class="listing"><button class="listing-image" style="background:${item.colour}" data-details="${item.id}">${item.image ? `<img src="${item.image}" alt="${item.title}" />` : `<span>${item.emoji}</span>`}<small>${item.condition}</small></button><div class="listing-info"><button class="heart saved" data-remove-favourite="${item.id}" aria-label="Remove ${item.title} from favourites">♥</button><span class="category">${item.category}</span><h3>${item.title}</h3><strong>RM ${Number(item.price).toFixed(2)}</strong><p>${item.seller} ✓ · ${item.posted}</p></div></article>`).join("") : `<div class="empty"><span>♡</span><h3>No favourites yet</h3><p>Tap the heart on a listing to keep it here.</p><a class="primary inline-button" href="/marketplace">Browse marketplace</a></div>`;
      grid.querySelectorAll("[data-details]").forEach((button) => button.addEventListener("click", () => location.href = `/item-details?id=${button.dataset.details}`));
      grid.querySelectorAll("[data-remove-favourite]").forEach((button) => button.addEventListener("click", () => { localStorage.setItem("campusswap-saved", JSON.stringify(savedIds().filter((id) => id !== Number(button.dataset.removeFavourite)))); CampusSwap.toast("Removed from favourites"); renderFavourites(); }));
    } catch (error) { CampusSwap.toast(error.message); }
  }
  renderFavourites();
})();