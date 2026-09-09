CampusSwap.pageShell("basket");
let selectedRequestId = null;
const currentUser = CampusSwap.getUser();

async function loadRequests() {
  try {
    const data = await CampusSwap.api(`/requests?userId=${currentUser.id}`);
    const active = data.filter((request) => !["Completed", "Declined"].includes(request.status));
    const container = document.querySelector("#requests");
    container.innerHTML = active.length ? active.map((request) => `
      <article class="request-card">
        <div class="request-icon">${request.emoji}</div>
        <div class="request-copy">
          <span class="pill ${request.status === "Pending" ? "pending" : ""}">${request.status}</span>
          <h3>${request.item}</h3>
          <p>${request.buyerId === currentUser.id ? `Seller: ${request.seller}` : `Buyer: ${request.buyer}`}</p>
          <small>⌖ ${request.location} · ${request.time}</small>
        </div>
        <div class="request-actions">
          <a class="primary" href="/chat?userId=${request.buyerId === currentUser.id ? request.sellerId : request.buyerId}&name=${encodeURIComponent(request.buyerId === currentUser.id ? request.seller : request.buyer)}&listingId=${request.listingId}&item=${encodeURIComponent(request.item)}">Open chat</a>
          ${request.sellerId === currentUser.id && request.status === "Pending" ? `<button class="secondary" data-request-status="${request.id}|Accepted">Accept</button><button class="text-button danger-text" data-request-status="${request.id}|Declined">Decline</button>` : ""}
          ${request.buyerId === currentUser.id && request.status === "Accepted" ? `<button class="secondary" data-collected="${request.id}">Mark collected</button>` : ""}
        </div>
      </article>`).join("") : `<div class="empty-state"><span>▱</span><h2>Your basket is clear</h2><p>Requested items will appear here.</p><a href="/marketplace" class="primary">Explore marketplace</a></div>`;

    container.querySelectorAll("[data-collected]").forEach((button) => button.onclick = () => {
      selectedRequestId = Number(button.dataset.collected);
      document.querySelector("#confirmDialog").classList.remove("hidden");
    });
    container.querySelectorAll("[data-request-status]").forEach((button) => button.addEventListener("click", async () => {
      const [requestId, status] = button.dataset.requestStatus.split("|");
      try {
        const result = await CampusSwap.api(`/requests/${requestId}`, { method: "PATCH", body: JSON.stringify({ status }) });
        CampusSwap.toast(result.message);
        loadRequests();
      } catch (error) { CampusSwap.toast(error.message); }
    }));
  } catch (error) { CampusSwap.toast(error.message); }
}

document.querySelector("#cancelCollected").onclick = () => document.querySelector("#confirmDialog").classList.add("hidden");
document.querySelector("#confirmCollected").onclick = async () => {
  try {
    const result = await CampusSwap.api(`/requests/${selectedRequestId}`, { method: "PATCH", body: JSON.stringify({ status: "Completed", time: "Collected just now" }) });
    document.querySelector("#confirmDialog").classList.add("hidden");
    CampusSwap.toast(result.message);
    loadRequests();
  } catch (error) { CampusSwap.toast(error.message); }
};

loadRequests();