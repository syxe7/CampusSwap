CampusSwap.pageShell("chat");
const currentUser = CampusSwap.getUser();
if (!currentUser) location.href = "/login";

const params = new URLSearchParams(location.search);
let activeConversation = params.get("userId") ? {
  otherUserId: Number(params.get("userId")),
  otherUserName: params.get("name") || "Student",
  listingId: Number(params.get("listingId") || 0),
  itemName: params.get("item") || "CampusSwap conversation",
} : null;
let refreshTimer;

function escapeHtml(value = "") {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

function conversationKey(conversation) {
  return `${conversation.otherUserId}:${conversation.listingId || 0}`;
}

async function loadConversations(selectFirst = false) {
  const conversations = await CampusSwap.api(`/conversations?userId=${currentUser.id}`);
  const matchedConversation = activeConversation && conversations.find((entry) => conversationKey(entry) === conversationKey(activeConversation));
  if (matchedConversation) activeConversation = matchedConversation;
  if (activeConversation && !matchedConversation) {
    conversations.unshift({ ...activeConversation, itemEmoji: "💬", lastMessage: "Start a new conversation", lastTime: "", unreadCount: 0 });
  }
  if (!activeConversation && selectFirst && conversations.length) activeConversation = conversations[0];

  const list = document.querySelector("#conversationList");
  list.innerHTML = conversations.length ? conversations.map((conversation) => {
    const selected = activeConversation && conversationKey(conversation) === conversationKey(activeConversation);
    return `<button class="conversation-row ${selected ? "active" : ""} ${conversation.completed ? "completed" : ""}" type="button" data-user-id="${conversation.otherUserId}" data-user-name="${escapeHtml(conversation.otherUserName)}" data-listing-id="${conversation.listingId || 0}" data-item-name="${escapeHtml(conversation.itemName)}" data-completed="${conversation.completed ? "true" : "false"}">
      <span class="conversation-avatar">${CampusSwap.initials(conversation.otherUserName)}</span>
      <span class="conversation-copy"><b>${escapeHtml(conversation.otherUserName)}</b><small>${escapeHtml(conversation.itemName)}${conversation.completed ? ` <em class="completed-label">Completed</em>` : ""}</small><p>${escapeHtml(conversation.lastMessage)}</p></span>
      <span class="conversation-meta"><time>${escapeHtml(conversation.lastTime || "")}</time>${conversation.unreadCount ? `<b class="unread-badge">${conversation.unreadCount}</b>` : ""}</span>
    </button>`;
  }).join("") : `<div class="empty-inbox"><span>💌</span><b>No chats yet</b><p>Open a marketplace item and message its seller.</p></div>`;

  const totalUnread = conversations.reduce((total, entry) => total + entry.unreadCount, 0);
  const unreadElement = document.querySelector("#totalUnread");
  unreadElement.textContent = totalUnread;
  unreadElement.classList.toggle("hidden", totalUnread === 0);

  list.querySelectorAll(".conversation-row").forEach((button) => {
    button.addEventListener("click", async () => {
      activeConversation = { otherUserId: Number(button.dataset.userId), otherUserName: button.dataset.userName, listingId: Number(button.dataset.listingId), itemName: button.dataset.itemName, completed: button.dataset.completed === "true" };
      history.replaceState({}, "", `/chat?userId=${activeConversation.otherUserId}&listingId=${activeConversation.listingId}&name=${encodeURIComponent(activeConversation.otherUserName)}&item=${encodeURIComponent(activeConversation.itemName)}`);
      document.body.classList.add("chat-open");
      await renderMessages();
      await loadConversations();
    });
  });
}

async function renderMessages() {
  const list = document.querySelector("#messageList");
  const form = document.querySelector("#messageForm");
  if (!activeConversation) { form.classList.add("hidden"); return; }
  form.classList.remove("hidden");
  document.querySelector("#sellerName").textContent = activeConversation.otherUserName;
  document.querySelector("#sellerProfileLink").href = `/profile?userId=${activeConversation.otherUserId}`;
  document.querySelector("#sellerInitials").textContent = CampusSwap.initials(activeConversation.otherUserName);
  document.querySelector("#itemName").textContent = activeConversation.itemName;
  document.querySelector("#chatStatus").classList.toggle("hidden", !activeConversation.completed);
  form.classList.toggle("completed", Boolean(activeConversation.completed));
  const input = document.querySelector("#messageInput");
  const sendButton = form.querySelector("button[type='submit']");
  input.disabled = Boolean(activeConversation.completed);
  sendButton.disabled = Boolean(activeConversation.completed);
  input.placeholder = activeConversation.completed ? "This exchange has been completed" : "Type a message…";
  const messages = await CampusSwap.api(`/messages?userId=${currentUser.id}&otherUserId=${activeConversation.otherUserId}&listingId=${activeConversation.listingId || ""}`);
  list.innerHTML = messages.length ? messages.map((message) => `<div class="message ${message.senderId === currentUser.id ? "mine" : "theirs"}"><p>${escapeHtml(message.text)}</p><small>${escapeHtml(message.time)}</small></div>`).join("") : `<div class="chat-empty"><span>👋</span><p>Say hello to ${escapeHtml(activeConversation.otherUserName)}.</p></div>`;
  await CampusSwap.api("/messages/read", { method: "PATCH", body: JSON.stringify({ userId: currentUser.id, otherUserId: activeConversation.otherUserId, listingId: activeConversation.listingId }) });
  list.scrollTop = list.scrollHeight;
}

document.querySelector("#messageForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#messageInput");
  const text = input.value.trim();
  if (!text || !activeConversation) return;
  try {
    await CampusSwap.api("/messages", { method: "POST", body: JSON.stringify({ listingId: activeConversation.listingId, senderId: currentUser.id, receiverId: activeConversation.otherUserId, text }) });
    input.value = "";
    await renderMessages();
    await loadConversations();
  } catch (error) { CampusSwap.toast(error.message); }
});

document.querySelector("#backToInbox").addEventListener("click", () => document.body.classList.remove("chat-open"));

async function refreshChat() {
  try {
    if (activeConversation) await renderMessages();
    await loadConversations();
  } catch (error) { console.error(error); }
}

(async () => {
  try {
    await loadConversations(true);
    if (activeConversation) { document.body.classList.add("chat-open"); await renderMessages(); }
    refreshTimer = setInterval(refreshChat, 2000);
  } catch (error) { CampusSwap.toast(error.message); }
})();

window.addEventListener("beforeunload", () => clearInterval(refreshTimer));