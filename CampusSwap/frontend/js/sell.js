(() => {
const { api, getUser, toast } = window.CampusSwap;
const form = document.querySelector("#sellForm");
const photoInput = document.querySelector("#photoInput");
const choosePhoto = document.querySelector("#choosePhoto");
const photoStatus = document.querySelector("#photoStatus");
const photoGallery = document.querySelector("#photoGallery");
const nextButton = document.querySelector("#nextButton");
const backButton = document.querySelector("#backButton");
const timerDisplay = document.querySelector("#timerDisplay");
const timerPanel = document.querySelector("#postingTimer");
const expiredDialog = document.querySelector("#timerExpiredDialog");
const restartTimerButton = document.querySelector("#restartTimer");
const cancelListing = document.querySelector("#cancelListing");
const expiredMarketplace = document.querySelector("#expiredMarketplace");
const TIMER_KEY = "campusswap-sell-deadline";
const TIMER_LENGTH = 2 * 60 * 1000;
let step = 1;
let photos = [];
let timerInterval = null;
let hasExpired = false;

function getDeadline() {
  const storedDeadline = Number(sessionStorage.getItem(TIMER_KEY));
  if (storedDeadline) return storedDeadline;
  const newDeadline = Date.now() + TIMER_LENGTH;
  sessionStorage.setItem(TIMER_KEY, String(newDeadline));
  return newDeadline;
}

function clearPostingTimer() {
  clearInterval(timerInterval);
  sessionStorage.removeItem(TIMER_KEY);
}

function setFormLocked(locked) {
  form.querySelectorAll("input, select, textarea, button").forEach((control) => {
    control.disabled = locked;
  });
}

function expireTimer() {
  if (hasExpired) return;
  hasExpired = true;
  clearInterval(timerInterval);
  timerDisplay.textContent = "00:00";
  timerPanel.classList.add("expired");
  setFormLocked(true);
  expiredDialog.classList.remove("hidden");
  restartTimerButton.focus();
}

function updateTimer() {
  const remaining = Math.max(0, getDeadline() - Date.now());
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  timerPanel.classList.toggle("urgent", remaining > 0 && remaining <= 30 * 1000);
  if (remaining <= 0) expireTimer();
}

function startPostingTimer() {
  clearInterval(timerInterval);
  hasExpired = false;
  timerPanel.classList.remove("urgent", "expired");
  expiredDialog.classList.add("hidden");
  setFormLocked(false);
  updateTimer();
  timerInterval = setInterval(updateTimer, 250);
}

function restartPostingTimer() {
  sessionStorage.setItem(TIMER_KEY, String(Date.now() + TIMER_LENGTH));
  form.reset();
  photos = [];
  step = 1;
  renderPhotoGallery();
  drawStep();
  startPostingTimer();
  form.title.focus();
  CampusSwap.toast("A fresh two-minute timer has started.");
}

function validateStep() {
  const fields = [...document.querySelector(`#step${step}`).querySelectorAll("input[required], textarea[required], select[required]")];
  const invalidField = fields.find((field) => !field.checkValidity());

  if (invalidField) {
    invalidField.reportValidity();
    invalidField.focus();
    toast("Please complete the highlighted field before continuing.");
    return false;
  }

  return true;
}

function drawStep() {
  document.querySelectorAll(".steps b").forEach((dot, index) => dot.classList.toggle("active", index < step));
  document.querySelectorAll(".steps div").forEach((item, index) => item.classList.toggle("current", index === step - 1));
  [1, 2, 3].forEach((number) => document.querySelector(`#step${number}`).classList.toggle("hidden", number !== step));
  backButton.classList.toggle("hidden", step === 1);
  nextButton.textContent = step === 3 ? "Publish listing" : "Continue";
  if (step === 3) renderPreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPreview() {
  const emoji = ({ Books: "📚", "Lab Equipment": "🧪", Tech: "⌨️", Home: "🏠", Fashion: "🧥", Sports: "🏸", Other: "📦" })[form.category.value] || "📦";
  const previewPhotos = photos.length
    ? `<div class="preview-photo-stack">
        <img src="${photos[0].data}" alt="Main listing photo" />
        ${photos.length > 1 ? `<span>+${photos.length - 1} more</span>` : ""}
      </div>`
    : `<span>${emoji}</span>`;
  document.querySelector("#listingPreview").innerHTML = `
    <div class="preview-media">${previewPhotos}</div>
    <div><small>${form.category.value} · ${form.condition.value}</small><h3>${form.title.value}</h3><strong>RM ${Number(form.price.value || 0).toFixed(2)}</strong><p>${form.description.value}</p><span>💬 Meetup arranged through Chat</span></div>`;
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, data: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderPhotoGallery() {
  photoStatus.textContent = `${photos.length} of 3 photos selected · optional`;
  choosePhoto.querySelector("b").textContent = photos.length ? "＋ Add more photos" : "＋ Add photos";
  photoInput.disabled = photos.length >= 3;
  document.querySelector("#uploadBox").classList.toggle("upload-disabled", photos.length >= 3);
  photoGallery.innerHTML = photos.map((photo, index) => `
    <article class="upload-thumbnail">
      <img src="${photo.data}" alt="Selected item photo ${index + 1}" />
      ${index === 0 ? `<span>Cover</span>` : ""}
      <button type="button" data-remove-photo="${index}" aria-label="Remove photo ${index + 1}">×</button>
    </article>
  `).join("");

  photoGallery.querySelectorAll("[data-remove-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      photos.splice(Number(button.dataset.removePhoto), 1);
      renderPhotoGallery();
      toast("Photo removed.");
    });
  });
}

photoInput.addEventListener("change", async () => {
  const selectedFiles = [...(photoInput.files || [])];
  photoInput.value = "";
  if (!selectedFiles.length) return;

  const availableSlots = 3 - photos.length;
  const acceptedFiles = selectedFiles.slice(0, availableSlots);
  const validFiles = acceptedFiles.filter((file) => {
    if (!file.type.startsWith("image/")) {
      toast(`${file.name} is not a supported image.`);
      return false;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast(`${file.name} is larger than 2 MB.`);
      return false;
    }
    return true;
  });

  try {
    const newPhotos = await Promise.all(validFiles.map(readPhoto));
    photos.push(...newPhotos);
    renderPhotoGallery();
    if (selectedFiles.length > availableSlots) toast("Only the first 3 photos were added.");
    else if (newPhotos.length) toast(`${newPhotos.length} photo${newPhotos.length === 1 ? "" : "s"} added successfully.`);
  } catch {
    toast("One of the selected images could not be read.");
  }
});

async function continueFlow() {
  if (hasExpired || getDeadline() <= Date.now()) {
    expireTimer();
    return;
  }
  if (!validateStep()) return;

  if (step < 3) {
    step += 1;
    drawStep();
    return;
  }

  const emoji = ({ Books: "📚", "Lab Equipment": "🧪", Tech: "⌨️", Home: "🏠", Fashion: "🧥", Sports: "🏸", Other: "📦" })[form.category.value] || "📦";
  try {
    const result = await api("/listings", {
      method: "POST",
      body: JSON.stringify({
        title: form.title.value.trim(), category: form.category.value,
        price: Number(form.price.value), condition: form.condition.value,
        description: form.description.value.trim(), location: "Arrange through Chat",
        emoji, images: photos.map((photo) => photo.data), image: photos[0]?.data || "",
        sellerId: getUser()?.id, seller: getUser()?.name || "Student",
      }),
    });
    clearPostingTimer();
    toast(result.message);
    setTimeout(() => location.href = "/marketplace", 700);
  } catch (error) {
    toast(error.message);
  }
}

nextButton.addEventListener("click", continueFlow);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  continueFlow();
});

backButton.addEventListener("click", () => {
  if (step > 1) {
    step -= 1;
    drawStep();
  }
});
restartTimerButton.addEventListener("click", restartPostingTimer);
cancelListing.addEventListener("click", clearPostingTimer);
expiredMarketplace.addEventListener("click", clearPostingTimer);
window.addEventListener("beforeunload", () => clearInterval(timerInterval));
renderPhotoGallery();
drawStep();
startPostingTimer();
})();