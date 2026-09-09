CampusSwap.pageShell("");
const signedInUser = CampusSwap.getUser();
if (!signedInUser) location.href = "/login";

const requestedUserId = Number(new URLSearchParams(location.search).get("userId")) || signedInUser.id;
const isOwner = requestedUserId === signedInUser.id;
let profileUser = null;
let selectedPhoto = "";

function escapeHtml(value = "") {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

function renderAvatar(element, user) {
  element.innerHTML = user.photo
    ? `<img src="${user.photo}" alt="${escapeHtml(user.name)}'s profile picture" />`
    : `<span>${CampusSwap.initials(user.name)}</span>`;
}

async function loadProfile() {
  try {
    profileUser = await CampusSwap.api(`/profile?userId=${requestedUserId}`);
    document.title = `${profileUser.name} · CampusSwap`;
    renderAvatar(document.querySelector("#profileAvatar"), profileUser);
    document.querySelector("#profileName").textContent = profileUser.name;
    document.querySelector("#profileEmail").textContent = isOwner ? profileUser.email : "Verified CampusSwap student";
    document.querySelector("#studentId").textContent = isOwner ? `Student ID · ${profileUser.studentId || "Not added"}` : "Seller profile";
    document.querySelector("#rating").textContent = profileUser.reviews ? profileUser.rating.toFixed(1) : "New";
    document.querySelector("#reviews").textContent = profileUser.reviews;
    document.querySelector("#swaps").textContent = profileUser.swaps;
    document.querySelector("#editProfileButton").classList.toggle("hidden", !isOwner);
    document.querySelector("#ownerActivity").classList.toggle("hidden", !isOwner);
    document.querySelector("#profileEyebrow").textContent = isOwner ? "Your seller profile" : "Seller profile";
    document.querySelector("#impactText").textContent = profileUser.swaps
      ? `${profileUser.swaps} completed swap${profileUser.swaps === 1 ? "" : "s"}`
      : "No completed swaps yet";
    renderReviews(profileUser.reviewDetails || []);
  } catch (error) { CampusSwap.toast(error.message); }
}

function renderReviews(reviews) {
  const container = document.querySelector("#publicReviews");
  container.innerHTML = reviews.length ? reviews.map((review) => `<article class="public-review">
    <div class="review-top"><strong>${"★".repeat(review.rating)}<span>${"★".repeat(5 - review.rating)}</span></strong><small>${escapeHtml(review.item)}</small></div>
    <p>${review.comment ? escapeHtml(review.comment) : "The buyer left a rating without a written comment."}</p>
    <small>— ${escapeHtml(review.reviewerName)}</small>
  </article>`).join("") : `<div class="empty profile-review-empty"><span>☆</span><h3>No seller reviews yet</h3><p>Reviews from verified buyers will appear here.</p></div>`;
}

function openEditor() {
  selectedPhoto = profileUser.photo || "";
  document.querySelector("#editName").value = profileUser.name;
  renderAvatar(document.querySelector("#editAvatarPreview"), { ...profileUser, photo: selectedPhoto });
  document.querySelector("#profileEditDialog").classList.remove("hidden");
}

function closeEditor() {
  document.querySelector("#profileEditDialog").classList.add("hidden");
  document.querySelector("#profilePhoto").value = "";
}

document.querySelector("#profilePhoto").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    event.target.value = "";
    return CampusSwap.toast("Choose a JPG, PNG, or WebP image.");
  }
  if (file.size > 2 * 1024 * 1024) {
    event.target.value = "";
    return CampusSwap.toast("Profile picture must be 2 MB or smaller.");
  }
  const reader = new FileReader();
  reader.onload = () => {
    selectedPhoto = reader.result;
    renderAvatar(document.querySelector("#editAvatarPreview"), { ...profileUser, photo: selectedPhoto });
  };
  reader.readAsDataURL(file);
});

document.querySelector("#profileEditForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await CampusSwap.api(`/profile/${signedInUser.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: document.querySelector("#editName").value.trim(), photo: selectedPhoto }),
    });
    CampusSwap.saveUser({ ...signedInUser, ...result.user });
    closeEditor();
    CampusSwap.toast(result.message);
    await loadProfile();
    setTimeout(() => location.reload(), 500);
  } catch (error) { CampusSwap.toast(error.message); }
});

document.querySelector("#editProfileButton").addEventListener("click", openEditor);
document.querySelector("#cancelProfileEdit").addEventListener("click", closeEditor);
document.querySelector("#profileEditDialog").addEventListener("click", (event) => { if (event.target.id === "profileEditDialog") closeEditor(); });
loadProfile();