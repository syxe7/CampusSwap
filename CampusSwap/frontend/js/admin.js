const adminUser = CampusSwap.getUser();
if (!adminUser || adminUser.role !== "admin") location.href = "/login";

let adminData = { stats: {}, reports: [], listings: [], students: [] };
let activeView = "overview";

function escapeHtml(value = "") {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

function statusClass(status = "") {
  return String(status).toLowerCase().replace(/\s+/g, "-");
}

async function loadAdminData(showMessage = false) {
  try {
    adminData = await CampusSwap.api("/admin/overview");
    renderAll();
    if (showMessage) CampusSwap.toast("Dashboard refreshed");
  } catch (error) { CampusSwap.toast(error.message); }
}

function renderAll() {
  const stats = adminData.stats;
  document.querySelector("#adminPendingReports").textContent = stats.pendingReports || 0;
  document.querySelector("#adminActiveListings").textContent = stats.activeListings || 0;
  document.querySelector("#adminActiveStudents").textContent = stats.activeStudents || 0;
  document.querySelector("#adminCompletedSwaps").textContent = stats.completedSwaps || 0;
  const reportBadge = document.querySelector("#sidebarReportCount");
  reportBadge.textContent = stats.pendingReports || 0;
  reportBadge.classList.toggle("hidden", !stats.pendingReports);
  renderOverviewReports();
  renderReports();
  renderListings();
  renderStudents();
}

function reportCard(report, compact = false) {
  return `<article class="${compact ? "admin-compact-row" : "admin-card"}">
    <div class="admin-record-copy"><span class="admin-status ${statusClass(report.status)}">${escapeHtml(report.status)}</span><h3>${escapeHtml(report.listing)}</h3><p>${escapeHtml(report.reason)}</p>${report.description ? `<p class="admin-description">${escapeHtml(report.description)}</p>` : ""}<small>Reported by ${escapeHtml(report.reporter)} · Listing: ${escapeHtml(report.listingStatus || "Unknown")}</small></div>
    ${report.status === "Pending" ? `<div class="admin-record-actions"><button class="secondary" data-review="${report.id}" data-status="Dismissed">Dismiss</button><button class="danger-button" data-review="${report.id}" data-status="Removed">Remove listing</button></div>` : ""}
  </article>`;
}

function bindReportActions(container) {
  container.querySelectorAll("[data-review]").forEach((button) => button.addEventListener("click", () => reviewReport(button.dataset.review, button.dataset.status)));
}

function renderOverviewReports() {
  const container = document.querySelector("#overviewReports");
  const pending = adminData.reports.filter((report) => report.status === "Pending").slice(0, 4);
  container.innerHTML = pending.length ? pending.map((report) => reportCard(report, true)).join("") : `<div class="admin-empty"><span>✓</span><b>Moderation queue is clear</b><p>No reports currently need attention.</p></div>`;
  bindReportActions(container);
}

function renderReports() {
  const query = document.querySelector("#reportSearch").value.trim().toLowerCase();
  const status = document.querySelector("#reportStatus").value;
  const records = adminData.reports.filter((report) =>
    (status === "All statuses" || report.status === status) &&
    `${report.listing} ${report.reason} ${report.reporter} ${report.description || ""}`.toLowerCase().includes(query)
  );
  const container = document.querySelector("#reports");
  container.innerHTML = records.length ? records.map((report) => reportCard(report)).join("") : `<div class="admin-empty"><span>⚑</span><b>No matching reports</b><p>Try another search or status.</p></div>`;
  bindReportActions(container);
}

function renderListings() {
  const query = document.querySelector("#listingSearch").value.trim().toLowerCase();
  const status = document.querySelector("#listingStatus").value;
  const listings = adminData.listings.filter((listing) =>
    (status === "All statuses" || listing.status === status) &&
    `${listing.title} ${listing.seller} ${listing.category}`.toLowerCase().includes(query)
  );
  document.querySelector("#adminListingTable").innerHTML = listings.length ? `<table class="admin-table"><thead><tr><th>Listing</th><th>Seller</th><th>Category</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>${listings.map((listing) => `<tr><td><b>${escapeHtml(listing.title)}</b></td><td>${escapeHtml(listing.seller)}</td><td>${escapeHtml(listing.category)}</td><td>RM ${Number(listing.price).toFixed(2)}</td><td><span class="admin-status ${statusClass(listing.status)}">${escapeHtml(listing.status)}</span></td><td><div class="admin-row-actions"><button class="admin-table-action" data-view-listing="${listing.id}">View</button>${listing.status === "Available" ? `<button class="admin-table-action danger-text" data-remove-listing="${listing.id}">Remove</button>` : ""}${listing.status === "Removed" ? `<button class="admin-table-action restore-text" data-restore-listing="${listing.id}">Restore</button>` : ""}</div></td></tr>`).join("")}</tbody></table>` : `<div class="admin-empty"><span>▦</span><b>No matching listings</b></div>`;
  document.querySelectorAll("[data-view-listing]").forEach((button) => button.addEventListener("click", () => viewListing(button.dataset.viewListing)));
  document.querySelectorAll("[data-remove-listing]").forEach((button) => button.addEventListener("click", () => removeListing(button.dataset.removeListing)));
  document.querySelectorAll("[data-restore-listing]").forEach((button) => button.addEventListener("click", () => restoreListing(button.dataset.restoreListing)));
}

function renderStudents() {
  const query = document.querySelector("#studentSearch").value.trim().toLowerCase();
  const students = adminData.students.filter((student) => `${student.name} ${student.studentId || ""} ${student.email}`.toLowerCase().includes(query));
  document.querySelector("#adminStudentTable").innerHTML = students.length ? `<table class="admin-table"><thead><tr><th>Student</th><th>Student ID</th><th>Account</th><th>Listings</th><th>Sales</th><th>Reviews</th></tr></thead><tbody>${students.map((student) => `<tr><td><a href="/profile?userId=${student.id}"><b>${escapeHtml(student.name)}</b><small>${escapeHtml(student.email)}</small></a></td><td>${escapeHtml(student.studentId || "—")}</td><td><span class="admin-status ${student.active === false ? "removed" : "available"}">${student.active === false ? "Deleted" : "Active"}</span></td><td>${student.listingCount}</td><td>${student.completedSales}</td><td>${student.sellerReviews}</td></tr>`).join("")}</tbody></table>` : `<div class="admin-empty"><span>◎</span><b>No matching students</b></div>`;
}

async function reviewReport(id, status) {
  try {
    const result = await CampusSwap.api(`/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    CampusSwap.toast(status === "Removed" ? "Listing removed and report resolved" : result.message);
    await loadAdminData();
  } catch (error) { CampusSwap.toast(error.message); }
}

async function removeListing(id) {
  try {
    await CampusSwap.api(`/listings/${id}`, { method: "PATCH", body: JSON.stringify({ status: "Removed" }) });
    CampusSwap.toast("Listing removed from the marketplace");
    await loadAdminData();
  } catch (error) { CampusSwap.toast(error.message); }
}

async function restoreListing(id) {
  try {
    await CampusSwap.api(`/listings/${id}`, { method: "PATCH", body: JSON.stringify({ status: "Available" }) });
    CampusSwap.toast("Listing restored to the marketplace");
    await loadAdminData();
  } catch (error) { CampusSwap.toast(error.message); }
}

function viewListing(id) {
  const listing = adminData.listings.find((entry) => entry.id === Number(id));
  if (!listing) return;
  const photos = Array.isArray(listing.images) && listing.images.length ? listing.images : (listing.image ? [listing.image] : []);
  document.querySelector("#adminListingPreview").innerHTML = `<div class="admin-preview-media" style="background:${listing.colour || "#dfe9df"}">${photos.length ? `<img src="${photos[0]}" alt="${escapeHtml(listing.title)}" />` : `<span>${listing.emoji || "📦"}</span>`}</div><div class="admin-preview-copy"><span class="admin-status ${statusClass(listing.status)}">${escapeHtml(listing.status)}</span><h2>${escapeHtml(listing.title)}</h2><p>${escapeHtml(listing.description || "No description provided.")}</p><dl><div><dt>Seller</dt><dd>${escapeHtml(listing.seller)}</dd></div><div><dt>Category</dt><dd>${escapeHtml(listing.category)}</dd></div><div><dt>Condition</dt><dd>${escapeHtml(listing.condition || "Not stated")}</dd></div><div><dt>Price</dt><dd>RM ${Number(listing.price).toFixed(2)}</dd></div></dl></div>`;
  document.querySelector("#adminListingDialog").classList.remove("hidden");
}

function closeListingPreview() { document.querySelector("#adminListingDialog").classList.add("hidden"); }

function switchView(view) {
  activeView = view;
  const labels = {
    overview: ["Dashboard overview", "Monitor marketplace activity and keep the student community safe."],
    reports: ["Report queue", "Review reports submitted by students and resolve unsafe listings."],
    listings: ["Listing management", "Inspect the current marketplace and remove inappropriate items."],
    students: ["Student accounts", "View verified, deleted, and returning CampusSwap students."],
  };
  document.querySelector("#adminPageTitle").textContent = labels[view][0];
  document.querySelector("#adminPageDescription").textContent = labels[view][1];
  document.querySelectorAll(".admin-view").forEach((section) => section.classList.add("hidden"));
  document.querySelector(`#admin${view[0].toUpperCase() + view.slice(1)}`).classList.remove("hidden");
  document.querySelectorAll("[data-admin-view]").forEach((button) => button.classList.toggle("active", button.dataset.adminView === view));
}

document.querySelectorAll("[data-admin-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.adminView)));
document.querySelectorAll("[data-go-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.goView)));
["reportSearch", "reportStatus"].forEach((id) => document.querySelector(`#${id}`).addEventListener(id.includes("Search") ? "input" : "change", renderReports));
["listingSearch", "listingStatus"].forEach((id) => document.querySelector(`#${id}`).addEventListener(id.includes("Search") ? "input" : "change", renderListings));
document.querySelector("#studentSearch").addEventListener("input", renderStudents);
document.querySelector("#refreshAdmin").addEventListener("click", () => loadAdminData(true));
document.querySelector("#adminLogout").addEventListener("click", CampusSwap.logout);
document.querySelector("#closeAdminListing").addEventListener("click", closeListingPreview);
document.querySelector("#adminListingDialog").addEventListener("click", (event) => { if (event.target.id === "adminListingDialog") closeListingPreview(); });
loadAdminData();