const API = "/api";

function getUser() {
  try { return JSON.parse(localStorage.getItem("campusswap-user")); }
  catch { return null; }
}

function saveUser(user) {
  localStorage.setItem("campusswap-user", JSON.stringify(user));
}

function logout() {
  localStorage.removeItem("campusswap-user");
  sessionStorage.removeItem("campusswap-ora-greeted");
  location.href = "/login";
}

function initials(name = "Student") {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function toast(message) {
  document.querySelector(".toast")?.remove();
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

function pageShell(active = "") {
  const user = getUser() || { name: "Qis Sofea" };
  const avatarContent = user.photo ? `<img src="${user.photo}" alt="" />` : initials(user.name);
  const nav = [
    ["marketplace", "Market", "/marketplace", "⌂"],
    ["my-listings", "My Listings", "/my-listings", "▦", true],
    ["chat", "Chat", "/chat", "◌"],
    ["basket", "Basket", "/requests", "▱"],
    ["history", "History", "/history", "↺"],
  ];

  document.body.insertAdjacentHTML("afterbegin", `
    <header class="topbar">
      <a class="brand" href="/marketplace">
        <img class="brand-logo" src="/assets/campusswap-logo.png" alt="" />
        <span>CampusSwap</span>
      </a>
      <nav class="desktop-nav" aria-label="Main navigation">
        ${nav.map(([id, label, url]) => `<a class="nav-link ${active === id ? "active" : ""}" href="${url}"><span>${label}</span>${id === "chat" ? `<b class="nav-badge hidden" data-chat-badge>0</b>` : ""}${id === "basket" ? `<b class="nav-badge hidden" data-basket-badge>0</b>` : ""}</a>`).join("")}
      </nav>
      <div class="header-actions">
        <a class="notification-button ${active === "notifications" ? "active" : ""}" href="/notifications" aria-label="Open notifications">
          <span aria-hidden="true">🔔</span>
          <b class="notification-badge hidden" data-notification-badge>0</b>
        </a>
        <div class="account-wrap">
          <button id="avatarButton" class="avatar" aria-label="Open account menu" aria-expanded="false">${avatarContent}</button>
          <div id="accountMenu" class="account-menu hidden">
            <div class="account-summary"><b>${user.name}</b><small>${user.email || "Verified student"}</small></div>
            <a href="/profile">My profile</a>
            <a href="/favourites">Favourites</a>
            <a href="/settings">Settings</a>
            <button type="button" id="logoutButton">Log out</button>
          </div>
        </div>
      </div>
    </header>`);

  const sellButton = location.pathname === "/marketplace"
    ? `<a class="floating-sell" href="/sell" aria-label="Post an item">＋</a>`
    : "";

  document.body.insertAdjacentHTML("beforeend", `
    ${sellButton}
    <nav class="mobile-nav" aria-label="Mobile navigation">
      ${nav.filter((entry) => !entry[4]).map(([id, label, url, icon]) => `<a class="${active === id ? "active" : ""}" href="${url}"><b>${icon}</b><span>${label}</span>${id === "chat" ? `<i class="nav-badge mobile-badge hidden" data-chat-badge>0</i>` : ""}${id === "basket" ? `<i class="nav-badge mobile-badge hidden" data-basket-badge>0</i>` : ""}</a>`).join("")}
    </nav>`);

  const avatarButton = document.querySelector("#avatarButton");
  const accountMenu = document.querySelector("#accountMenu");
  avatarButton.onclick = (event) => {
    event.stopPropagation();
    accountMenu.classList.toggle("hidden");
    avatarButton.setAttribute("aria-expanded", String(!accountMenu.classList.contains("hidden")));
  };
  document.querySelector("#logoutButton").onclick = logout;
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".account-wrap")) accountMenu.classList.add("hidden");
  });

  function showBadge(selector, count) {
    document.querySelectorAll(selector).forEach((badge) => {
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.classList.toggle("hidden", count < 1);
    });
  }

  async function refreshHeaderBadges() {
    if (!user.id || user.role === "admin") return;
    try {
      const conversations = await api(`/conversations?userId=${user.id}`);
      const unreadMessages = conversations.reduce((total, conversation) => total + Number(conversation.unreadCount || 0), 0);
      showBadge("[data-chat-badge]", unreadMessages);
    } catch {
      showBadge("[data-chat-badge]", 0);
    }

    try {
      const requests = await api(`/requests?userId=${user.id}`);
      const actionableRequests = requests.filter((request) =>
        (request.sellerId === user.id && request.status === "Pending") ||
        (request.buyerId === user.id && request.status === "Accepted")
      ).length;
      showBadge("[data-basket-badge]", actionableRequests);
    } catch {
      showBadge("[data-basket-badge]", 0);
    }

    try {
      const notifications = await api(`/notifications?userId=${user.id}`);
      showBadge("[data-notification-badge]", notifications.filter((notification) => !notification.read).length);
    } catch {
      showBadge("[data-notification-badge]", 0);
    }
  }

  refreshHeaderBadges();
  const badgeTimer = setInterval(refreshHeaderBadges, 2500);
  window.addEventListener("pagehide", () => clearInterval(badgeTimer), { once: true });
  window.addEventListener("campusswap-notifications-changed", refreshHeaderBadges);
}

window.CampusSwap = { api, getUser, saveUser, logout, toast, pageShell, initials };