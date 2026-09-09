(() => {
  CampusSwap.pageShell("notifications");
  const currentUser = CampusSwap.getUser();
  const container = document.querySelector("#notificationList");
  const markAllButton = document.querySelector("#markAllButton");
  let notifications = [];

  async function loadNotifications() {
    try {
      notifications = (await CampusSwap.api(`/notifications?userId=${currentUser.id}`)).slice(0, 10);
      renderNotifications();
    } catch (error) {
      CampusSwap.toast(error.message);
    }
  }

  function renderNotifications() {
    markAllButton.disabled = !notifications.some((notification) => !notification.read);
    container.innerHTML = notifications.length
      ? notifications.map((notification) => `<article class="notification ${notification.read ? "" : "unread"}" data-id="${notification.id}"><span class="notification-icon">${notification.icon}</span><button class="notification-copy" data-open="${notification.link}"><strong>${notification.title}</strong><p>${notification.message}</p><small>${notification.time}</small></button><button class="text-button" data-read="${notification.id}">${notification.read ? "Read" : "Mark read"}</button></article>`).join("")
      : `<div class="empty"><span>🔔</span><h2>No notifications</h2><p>Purchase requests and new messages will appear here.</p></div>`;

    container.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", async () => {
      await markRead(Number(button.closest("[data-id]").dataset.id), false);
      location.href = button.dataset.open;
    }));
    container.querySelectorAll("[data-read]").forEach((button) => button.addEventListener("click", () => markRead(Number(button.dataset.read))));
  }

  async function markRead(id, reload = true) {
    const notification = notifications.find((entry) => entry.id === id);
    if (!notification || notification.read) return;
    await CampusSwap.api(`/notifications/${id}`, { method: "PATCH", body: JSON.stringify({ read: true }) });
    notification.read = true;
    window.dispatchEvent(new Event("campusswap-notifications-changed"));
    if (reload) renderNotifications();
  }

  markAllButton.addEventListener("click", async () => {
    try {
      await CampusSwap.api("/notifications/read-all", { method: "PATCH", body: JSON.stringify({ userId: currentUser.id }) });
      notifications.forEach((notification) => { notification.read = true; });
      renderNotifications();
      window.dispatchEvent(new Event("campusswap-notifications-changed"));
      CampusSwap.toast("All notifications marked as read");
    } catch (error) {
      CampusSwap.toast(error.message);
    }
  });

  loadNotifications();
  const refreshTimer = setInterval(loadNotifications, 3000);
  window.addEventListener("pagehide", () => clearInterval(refreshTimer), { once: true });
})();