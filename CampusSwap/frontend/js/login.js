const loginForm = document.querySelector("#loginForm");
const feedback = document.querySelector("#feedback");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  feedback.classList.add("hidden");
  try {
    const result = await CampusSwap.api("/login", {
      method: "POST",
      body: JSON.stringify({
        email: loginForm.email.value.trim(),
        password: loginForm.password.value,
      }),
    });
    CampusSwap.saveUser(result.user);
    location.href = result.user.role === "admin" ? "/admin" : "/marketplace";
  } catch (error) {
    feedback.textContent = error.message;
    feedback.classList.remove("hidden");
  }
});