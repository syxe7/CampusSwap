CampusSwap.pageShell("");
const currentUser = CampusSwap.getUser();
if (!currentUser) location.href = "/login";

const passwordDialog = document.querySelector("#passwordDialog");
const guidelinesDialog = document.querySelector("#guidelinesDialog");
const deleteAccountDialog = document.querySelector("#deleteAccountDialog");
const passwordForm = document.querySelector("#passwordForm");
const deleteAccountForm = document.querySelector("#deleteAccountForm");

function openDialog(dialog) { dialog.classList.remove("hidden"); }
function closeDialog(dialog) { dialog.classList.add("hidden"); }

document.querySelector("#changePasswordButton").addEventListener("click", () => {
  passwordForm.reset();
  openDialog(passwordDialog);
  passwordForm.currentPassword.focus();
});
document.querySelector("#guidelinesButton").addEventListener("click", () => openDialog(guidelinesDialog));
document.querySelector("#deleteAccountButton").addEventListener("click", () => {
  deleteAccountForm.reset();
  openDialog(deleteAccountDialog);
  deleteAccountForm.password.focus();
});
document.querySelector("#cancelPassword").addEventListener("click", () => closeDialog(passwordDialog));
document.querySelector("#closeGuidelines").addEventListener("click", () => closeDialog(guidelinesDialog));
document.querySelector("#cancelDeleteAccount").addEventListener("click", () => closeDialog(deleteAccountDialog));

[passwordDialog, guidelinesDialog, deleteAccountDialog].forEach((dialog) => dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeDialog(dialog);
}));

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeDialog(passwordDialog);
  closeDialog(guidelinesDialog);
  closeDialog(deleteAccountDialog);
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(passwordForm);
  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");
  if (newPassword !== confirmPassword) return CampusSwap.toast("The new passwords do not match.");
  try {
    const result = await CampusSwap.api(`/profile/${currentUser.id}/password`, { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) });
    passwordForm.reset();
    closeDialog(passwordDialog);
    CampusSwap.toast(result.message);
  } catch (error) { CampusSwap.toast(error.message); }
});

deleteAccountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(deleteAccountForm);
  if (formData.get("confirmation") !== "DELETE")
    return CampusSwap.toast("Type DELETE exactly to confirm account deletion.");
  try {
    const result = await CampusSwap.api(`/profile/${currentUser.id}`, { method: "DELETE", body: JSON.stringify({ password: formData.get("password") }) });
    localStorage.removeItem("campusswap-user");
    sessionStorage.setItem("campusswap-account-message", result.message);
    location.href = "/register";
  } catch (error) { CampusSwap.toast(error.message); }
});