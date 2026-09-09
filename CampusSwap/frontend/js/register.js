const registerForm = document.querySelector("#registerForm");
const feedback = document.querySelector("#feedback");
const accountMessage = sessionStorage.getItem("campusswap-account-message");
if (accountMessage) {
  feedback.textContent = accountMessage;
  feedback.classList.remove("hidden");
  sessionStorage.removeItem("campusswap-account-message");
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  feedback.classList.add("hidden");
  try {
    const formData = new FormData(registerForm);
    const result = await CampusSwap.api("/register", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    CampusSwap.saveUser(result.user);
    location.href = "/marketplace";
  } catch (error) {
    feedback.textContent = error.message;
    feedback.classList.remove("hidden");
  }
});