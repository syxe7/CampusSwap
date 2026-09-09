CampusSwap.pageShell("history");
const currentUser = CampusSwap.getUser();
if (!currentUser) location.href = "/login";

const historyList = document.querySelector("#historyList");
const reviewDialog = document.querySelector("#reviewDialog");
const reviewForm = document.querySelector("#reviewForm");
let completedSwaps = [];
let selectedSwap = null;

function reviewState(item) {
  const isBuyer = item.buyerId === currentUser.id;
  const alreadyReviewed = (item.reviewedBy || []).includes(currentUser.id);
  const deadlinePassed = item.reviewDeadline && Date.now() >= new Date(item.reviewDeadline).getTime();
  return {
    canReview: isBuyer && !alreadyReviewed && !deadlinePassed,
    completed: !isBuyer || alreadyReviewed || deadlinePassed,
  };
}

async function loadHistory() {
  try {
    const data = await CampusSwap.api(`/requests?userId=${currentUser.id}`);
    completedSwaps = data.filter((item) => item.status === "Completed");
    historyList.innerHTML = completedSwaps.length ? completedSwaps.map((item) => {
      const state = reviewState(item);
      const partner = item.buyerId === currentUser.id ? item.seller : item.buyer;
      return `<article class="history-card ${state.completed ? "completed-history" : "review-pending"}">
        <div class="request-icon">${item.emoji}</div>
        <div class="history-copy"><span class="pill">${state.completed ? "Completed" : "Review pending"}</span><h3>${item.item}</h3><p>Swapped with ${partner}</p><small>${state.completed ? "Collection completed" : "Review available for 3 days after collection"}</small></div>
        <div class="history-action">${state.canReview ? `<button class="primary" type="button" data-review="${item.id}">Leave review</button>` : `<span class="history-check" aria-label="Completed">✓</span>`}</div>
      </article>`;
    }).join("") : `<div class="empty-state"><span>↺</span><h2>No completed swaps yet</h2><p>When you complete a swap, it will appear here.</p></div>`;
    historyList.querySelectorAll("[data-review]").forEach((button) => button.addEventListener("click", () => openReview(Number(button.dataset.review))));
  } catch (error) { CampusSwap.toast(error.message); }
}

function openReview(requestId) {
  selectedSwap = completedSwaps.find((item) => item.id === requestId);
  if (!selectedSwap) return;
  document.querySelector("#reviewPartner").textContent = `How was your exchange with ${selectedSwap.seller}?`;
  reviewForm.reset();
  reviewDialog.classList.remove("hidden");
}

function closeReview() { reviewDialog.classList.add("hidden"); selectedSwap = null; }

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(reviewForm);
  try {
    const result = await CampusSwap.api("/reviews", { method: "POST", body: JSON.stringify({ requestId: selectedSwap.id, reviewerId: currentUser.id, rating: Number(formData.get("rating")), comment: formData.get("comment") }) });
    closeReview();
    CampusSwap.toast(result.message);
    await loadHistory();
  } catch (error) { CampusSwap.toast(error.message); }
});

document.querySelector("#cancelReview").addEventListener("click", closeReview);
reviewDialog.addEventListener("click", (event) => { if (event.target === reviewDialog) closeReview(); });
loadHistory();