const store = require("../data/store");

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/listings")
    return sendJson(response, 200, store.listings);
  if (request.method === "GET" && url.pathname === "/api/requests") {
    const userId = Number(url.searchParams.get("userId"));
    const records = userId
      ? store.requests.filter((entry) => entry.buyerId === userId || entry.sellerId === userId)
      : store.requests;
    return sendJson(response, 200, records);
  }
  if (request.method === "GET" && url.pathname === "/api/notifications") {
    const userId = Number(url.searchParams.get("userId"));
    if (!userId) return sendJson(response, 400, { message: "A user ID is required." });
    return sendJson(response, 200, store.notifications.filter((entry) => entry.userId === userId).slice(0, 10));
  }
  if (request.method === "GET" && url.pathname === "/api/messages") {
    const userId = Number(url.searchParams.get("userId"));
    const otherUserId = Number(url.searchParams.get("otherUserId"));
    const listingId = Number(url.searchParams.get("listingId"));
    const records = store.messages.filter((entry) => {
      const belongsToPair =
        (entry.senderId === userId && entry.receiverId === otherUserId) ||
        (entry.senderId === otherUserId && entry.receiverId === userId);
      return belongsToPair && (!listingId || entry.listingId === listingId);
    });
    return sendJson(response, 200, records);
  }
  if (request.method === "GET" && url.pathname === "/api/conversations") {
    const userId = Number(url.searchParams.get("userId"));
    if (!userId) return sendJson(response, 400, { message: "A user ID is required." });
    const conversations = new Map();
    store.messages.filter((message) => message.senderId === userId || message.receiverId === userId).forEach((message) => {
      const otherUserId = message.senderId === userId ? message.receiverId : message.senderId;
      const key = `${otherUserId}:${message.listingId || 0}`;
      const previous = conversations.get(key);
      const createdAt = message.createdAt || new Date(message.id).toISOString();
      if (!previous || createdAt >= previous.lastCreatedAt) {
        const otherUser = store.users.find((user) => user.id === otherUserId);
        const listing = store.listings.find((item) => item.id === message.listingId);
        const completed = listing?.status === "Sold" || store.requests.some((entry) =>
          entry.listingId === message.listingId && entry.status === "Completed" &&
          (entry.buyerId === userId || entry.sellerId === userId),
        );
        conversations.set(key, { key, otherUserId, otherUserName: otherUser?.name || "Student", listingId: message.listingId || 0, itemName: listing?.title || "CampusSwap conversation", itemEmoji: listing?.emoji || "💬", completed, lastMessage: message.text, lastTime: message.time, lastCreatedAt: createdAt });
      }
    });
    const result = [...conversations.values()].map((conversation) => ({
      ...conversation,
      unreadCount: store.messages.filter((message) => message.senderId === conversation.otherUserId && message.receiverId === userId && (message.listingId || 0) === conversation.listingId && !message.readAt).length,
    })).sort((a, b) => b.lastCreatedAt.localeCompare(a.lastCreatedAt));
    return sendJson(response, 200, result);
  }
  if (request.method === "GET" && url.pathname === "/api/profile") {
    const userId = Number(url.searchParams.get("userId"));
    const user = store.users.find((entry) => entry.id === userId);
    if (!user || user.active === false) return sendJson(response, 404, { message: "This student profile is not currently active." });
    const swaps = store.requests.filter(
      (entry) => (entry.buyerId === userId || entry.sellerId === userId) && entry.status === "Completed",
    ).length;
    const listings = store.listings.filter((entry) => entry.sellerId === userId).length;
    const sellerReviews = (store.reviews || []).filter((entry) => entry.revieweeId === userId);
    const rating = sellerReviews.length
      ? Number((sellerReviews.reduce((total, entry) => total + Number(entry.rating), 0) / sellerReviews.length).toFixed(1))
      : 0;
    const reviewDetails = sellerReviews.map((entry) => {
      const reviewer = store.users.find((candidate) => candidate.id === entry.reviewerId);
      const listing = store.listings.find((candidate) => candidate.id === entry.listingId);
      return { ...entry, reviewerName: reviewer?.name || "Verified buyer", item: listing?.title || "CampusSwap item" };
    });
    const { password, ...safeUser } = user;
    return sendJson(response, 200, { ...safeUser, rating, reviews: sellerReviews.length, reviewDetails, swaps, listings });
  }
  if (request.method === "GET" && url.pathname === "/api/reports")
    return sendJson(response, 200, store.reports);
  if (request.method === "GET" && url.pathname === "/api/admin/overview") {
    const students = store.users.filter((entry) => entry.role === "student");
    const activeListings = store.listings.filter((entry) => entry.status === "Available");
    const completedSwaps = store.requests.filter((entry) => entry.status === "Completed");
    const reports = store.reports.map((entry) => ({
      ...entry,
      listingStatus: store.listings.find((listing) => listing.id === entry.listingId)?.status || "Unavailable",
    }));
    const safeStudents = students.map(({ password, ...student }) => ({
      ...student,
      listingCount: store.listings.filter((entry) => entry.sellerId === student.id).length,
      completedSales: completedSwaps.filter((entry) => entry.sellerId === student.id).length,
      sellerReviews: (store.reviews || []).filter((entry) => entry.revieweeId === student.id).length,
    }));
    return sendJson(response, 200, {
      stats: {
        pendingReports: reports.filter((entry) => entry.status === "Pending").length,
        activeListings: activeListings.length,
        activeStudents: students.filter((entry) => entry.active !== false).length,
        completedSwaps: completedSwaps.length,
      },
      reports,
      listings: store.listings,
      students: safeStudents,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/login") {
    const data = await readBody(request);
    const user = store.users.find(
      (entry) => entry.email.toLowerCase() === String(data.email).toLowerCase() && entry.password === data.password,
    );
    if (!user) return sendJson(response, 401, { message: "Email or password is incorrect." });
    if (user.active === false)
      return sendJson(response, 403, { message: "This account was deleted. Register again with the same Student ID and email to restore it." });
    const { password, ...safeUser } = user;
    return sendJson(response, 200, { message: "Welcome back!", user: safeUser });
  }

  if (request.method === "POST" && url.pathname === "/api/register") {
    const data = await readBody(request);
    const email = String(data.email || "").trim().toLowerCase();
    const studentId = String(data.studentId || "").trim();
    if (!email.endsWith("@alfateh.upnm.edu.my"))
      return sendJson(response, 400, { message: "Use your @alfateh.upnm.edu.my university email." });
    if (!/^\d+@alfateh\.upnm\.edu\.my$/.test(email))
      return sendJson(response, 400, { message: "Your university email must begin with your numeric Student ID." });
    if (email.split("@")[0] !== studentId)
      return sendJson(response, 400, { message: "Your university email and Student ID must match." });
    if (!studentId)
      return sendJson(response, 400, { message: "Enter your student ID." });
    if (!/^\d+$/.test(studentId))
      return sendJson(response, 400, { message: "Student ID must contain numbers only." });
    const emailOwner = store.users.find((entry) => entry.email.toLowerCase() === email);
    const studentIdOwner = store.users.find((entry) => entry.studentId === studentId);
    if (emailOwner && emailOwner.active !== false)
      return sendJson(response, 409, { message: "An account already uses this email." });
    if (studentIdOwner && studentIdOwner.active !== false)
      return sendJson(response, 409, { message: "An account already uses this student ID." });
    if (emailOwner && studentIdOwner && emailOwner.id !== studentIdOwner.id)
      return sendJson(response, 409, { message: "The Student ID and email belong to different archived accounts." });

    const archivedUser = emailOwner || studentIdOwner;
    if (archivedUser) {
      archivedUser.name = String(data.name || archivedUser.name).trim();
      archivedUser.email = email;
      archivedUser.studentId = studentId;
      archivedUser.password = String(data.password || "");
      archivedUser.active = true;
      archivedUser.reactivatedAt = new Date().toISOString();
      delete archivedUser.deactivatedAt;
      const { password, ...safeUser } = archivedUser;
      return sendJson(response, 200, { message: "Welcome back! Your previous CampusSwap account and history have been restored.", user: safeUser, restored: true });
    }

    const user = { id: Date.now(), ...data, email, studentId, role: "student", rating: 0, reviews: 0, active: true };
    store.users.push(user);
    const { password, ...safeUser } = user;
    return sendJson(response, 201, { message: "Account created successfully!", user: safeUser });
  }

  if (request.method === "POST" && url.pathname === "/api/listings") {
    const data = await readBody(request);
    const listing = {
      id: Date.now(), ...data, sellerId: Number(data.sellerId), seller: data.seller || "Student",
      images: Array.isArray(data.images) ? data.images.slice(0, 3) : [],
      image: Array.isArray(data.images) && data.images.length ? data.images[0] : (data.image || ""),
      emoji: data.emoji || "📦",
      colour: data.colour || "#dcebdc", status: "Available", posted: "Just now",
    };
    store.listings.unshift(listing);
    return sendJson(response, 201, { message: "Your listing is live!", listing });
  }

  if (request.method === "POST" && url.pathname === "/api/requests") {
    const data = await readBody(request);
    const listing = store.listings.find((entry) => entry.id === Number(data.listingId));
    if (!listing) return sendJson(response, 404, { message: "Listing not found." });
    if (listing.status !== "Available")
      return sendJson(response, 409, { message: `This item is currently ${listing.status.toLowerCase()}.` });
    const buyerId = Number(data.buyerId);
    if (buyerId === listing.sellerId)
      return sendJson(response, 400, { message: "You cannot request to buy your own listing." });
    if (store.requests.some((entry) => entry.listingId === listing.id && entry.buyerId === buyerId && entry.status !== "Completed"))
      return sendJson(response, 409, { message: "You already requested this item." });
    const purchaseRequest = {
      id: Date.now(), listingId: listing.id, item: listing.title, emoji: listing.emoji,
      buyerId, buyer: data.buyer || "Student",
      sellerId: listing.sellerId, seller: listing.seller, status: "Pending",
      location: listing.location, time: "Just now",
    };
    store.requests.unshift(purchaseRequest);
    store.notifications.unshift({
      id: Date.now() + 1, userId: listing.sellerId, icon: "🛍️",
      title: "New purchase request", message: `${purchaseRequest.buyer} requested ${listing.title}.`,
      time: "Just now", read: false, link: "/requests",
    });
    return sendJson(response, 201, { message: "Purchase request sent!", request: purchaseRequest });
  }

  if (request.method === "POST" && url.pathname === "/api/messages") {
    const data = await readBody(request);
    const relatedListing = store.listings.find((entry) => entry.id === Number(data.listingId));
    if (relatedListing?.status === "Sold")
      return sendJson(response, 409, { message: "This exchange is completed, so the conversation is now read-only." });
    const message = {
      id: Date.now(), listingId: Number(data.listingId), senderId: Number(data.senderId),
      receiverId: Number(data.receiverId), text: String(data.text || "").trim(),
      time: new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(), readAt: null,
    };
    if (!message.text || !message.senderId || !message.receiverId)
      return sendJson(response, 400, { message: "Message details are incomplete." });
    store.messages.push(message);
    const sender = store.users.find((entry) => entry.id === message.senderId);
    const listing = store.listings.find((entry) => entry.id === message.listingId);
    store.notifications.unshift({
      id: Date.now() + 1, userId: message.receiverId, icon: "💬",
      title: `New message from ${sender?.name || "a student"}`,
      message: message.text.length > 90 ? `${message.text.slice(0, 87)}…` : message.text,
      time: "Just now", read: false,
      link: `/chat?userId=${message.senderId}&name=${encodeURIComponent(sender?.name || "Student")}&listingId=${message.listingId || 0}&item=${encodeURIComponent(listing?.title || "CampusSwap conversation")}`,
    });
    return sendJson(response, 201, { message: "Message sent.", record: message });
  }
  if (request.method === "PATCH" && url.pathname === "/api/messages/read") {
    const data = await readBody(request);
    const userId = Number(data.userId);
    const otherUserId = Number(data.otherUserId);
    const listingId = Number(data.listingId || 0);
    const readAt = new Date().toISOString();
    let updated = 0;
    store.messages.forEach((message) => {
      if (message.receiverId === userId && message.senderId === otherUserId && (message.listingId || 0) === listingId && !message.readAt) {
        message.readAt = readAt;
        updated += 1;
      }
    });
    return sendJson(response, 200, { message: "Conversation marked as read.", updated });
  }

  const notificationMatch = url.pathname.match(/^\/api\/notifications\/(\d+)$/);
  if (request.method === "PATCH" && notificationMatch) {
    const notification = store.notifications.find((entry) => entry.id === Number(notificationMatch[1]));
    if (!notification) return sendJson(response, 404, { message: "Notification not found." });
    Object.assign(notification, await readBody(request));
    return sendJson(response, 200, { message: "Notification updated.", notification });
  }

  if (request.method === "PATCH" && url.pathname === "/api/notifications/read-all") {
    const data = await readBody(request);
    const userId = Number(data.userId);
    store.notifications.forEach((entry) => { if (entry.userId === userId) entry.read = true; });
    return sendJson(response, 200, { message: "All notifications marked as read." });
  }

  const profileMatch = url.pathname.match(/^\/api\/profile\/(\d+)$/);
  if (request.method === "PATCH" && profileMatch) {
    const user = store.users.find((entry) => entry.id === Number(profileMatch[1]));
    if (!user) return sendJson(response, 404, { message: "Student not found." });
    const data = await readBody(request);
    const name = String(data.name || "").trim();
    if (name.length < 2 || name.length > 60)
      return sendJson(response, 400, { message: "Name must contain between 2 and 60 characters." });
    if (data.photo && !String(data.photo).startsWith("data:image/"))
      return sendJson(response, 400, { message: "Choose a valid profile picture." });
    user.name = name;
    user.photo = String(data.photo || user.photo || "");
    store.listings.forEach((entry) => { if (entry.sellerId === user.id) entry.seller = name; });
    store.requests.forEach((entry) => {
      if (entry.sellerId === user.id) entry.seller = name;
      if (entry.buyerId === user.id) entry.buyer = name;
    });
    const { password, ...safeUser } = user;
    return sendJson(response, 200, { message: "Profile updated successfully.", user: safeUser });
  }

  const passwordMatch = url.pathname.match(/^\/api\/profile\/(\d+)\/password$/);
  if (request.method === "PATCH" && passwordMatch) {
    const user = store.users.find((entry) => entry.id === Number(passwordMatch[1]));
    if (!user) return sendJson(response, 404, { message: "Student not found." });
    const data = await readBody(request);
    const currentPassword = String(data.currentPassword || "");
    const newPassword = String(data.newPassword || "");
    if (currentPassword !== user.password)
      return sendJson(response, 401, { message: "Your current password is incorrect." });
    if (newPassword.length < 8)
      return sendJson(response, 400, { message: "Your new password must contain at least 8 characters." });
    if (newPassword === currentPassword)
      return sendJson(response, 400, { message: "Choose a new password that is different from your current password." });
    user.password = newPassword;
    return sendJson(response, 200, { message: "Password changed successfully." });
  }

  if (request.method === "DELETE" && profileMatch) {
    const user = store.users.find((entry) => entry.id === Number(profileMatch[1]));
    if (!user || user.active === false)
      return sendJson(response, 404, { message: "Active student account not found." });
    const data = await readBody(request);
    if (String(data.password || "") !== user.password)
      return sendJson(response, 401, { message: "Your password is incorrect." });

    user.active = false;
    user.deactivatedAt = new Date().toISOString();
    store.listings.forEach((entry) => {
      if (entry.sellerId === user.id && ["Available", "Reserved"].includes(entry.status)) {
        entry.statusBeforeDeactivation = entry.status;
        entry.status = "Removed";
      }
    });
    store.requests.forEach((entry) => {
      if ((entry.buyerId === user.id || entry.sellerId === user.id) && ["Pending", "Accepted"].includes(entry.status)) {
        entry.statusBeforeDeactivation = entry.status;
        entry.status = "Declined";
      }
    });
    return sendJson(response, 200, { message: "Your CampusSwap account has been deleted. Register again with the same Student ID and email whenever you want to return." });
  }

  if (request.method === "POST" && url.pathname === "/api/reports") {
    const data = await readBody(request);
    if (!String(data.reason || "").trim())
      return sendJson(response, 400, { message: "Select a reason for the report." });
    const report = {
      id: Date.now(), listingId: Number(data.listingId), listing: data.listing,
      reporterId: Number(data.reporterId), reporter: data.reporter || "Student",
      reason: String(data.reason).trim(), description: String(data.description || "").trim().slice(0, 250),
      status: "Pending",
    };
    store.reports.unshift(report);
    return sendJson(response, 201, { message: "Report sent for admin review.", report });
  }

  if (request.method === "POST" && url.pathname === "/api/reviews") {
    const data = await readBody(request);
    const requestRecord = store.requests.find((entry) => entry.id === Number(data.requestId));
    const reviewerId = Number(data.reviewerId);
    const rating = Number(data.rating);
    if (!requestRecord || requestRecord.status !== "Completed")
      return sendJson(response, 404, { message: "Completed exchange not found." });
    if (reviewerId !== requestRecord.buyerId)
      return sendJson(response, 403, { message: "Only the buyer can review the seller." });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return sendJson(response, 400, { message: "Choose a rating from 1 to 5 stars." });
    if (requestRecord.reviewDeadline && Date.now() > new Date(requestRecord.reviewDeadline).getTime())
      return sendJson(response, 409, { message: "The review period has ended." });
    const reviews = store.reviews || (store.reviews = []);
    if (reviews.some((entry) => entry.requestId === requestRecord.id && entry.reviewerId === reviewerId))
      return sendJson(response, 409, { message: "You already reviewed this exchange." });

    const revieweeId = requestRecord.sellerId;
    const review = {
      id: Date.now(), requestId: requestRecord.id, listingId: requestRecord.listingId,
      reviewerId, revieweeId, rating,
      comment: String(data.comment || "").trim().slice(0, 250),
      createdAt: new Date().toISOString(),
    };
    reviews.unshift(review);
    requestRecord.reviewedBy = [...new Set([...(requestRecord.reviewedBy || []), reviewerId])];

    const reviewee = store.users.find((entry) => entry.id === revieweeId);
    if (reviewee) {
      const previousReviews = Number(reviewee.reviews || 0);
      const previousRating = Number(reviewee.rating || 0);
      reviewee.rating = Number(((previousRating * previousReviews + rating) / (previousReviews + 1)).toFixed(1));
      reviewee.reviews = previousReviews + 1;
    }
    return sendJson(response, 201, { message: "Thank you! Your review has been submitted.", review });
  }

  const statusMatch = url.pathname.match(/^\/api\/(listings|reports|requests)\/(\d+)$/);
  if (request.method === "PATCH" && statusMatch) {
    const collection = statusMatch[1] === "listings" ? store.listings : statusMatch[1] === "requests" ? store.requests : store.reports;
    const record = collection.find((entry) => entry.id === Number(statusMatch[2]));
    if (!record) return sendJson(response, 404, { message: "Record not found." });
    const changes = await readBody(request);
    if (statusMatch[1] === "listings" && changes.status === "Available") {
      const seller = store.users.find((entry) => entry.id === record.sellerId);
      if (!seller || seller.active === false)
        return sendJson(response, 409, { message: "This listing cannot be restored while the seller account is deleted." });
      store.reports.forEach((entry) => {
        if (entry.listingId === record.id && entry.status === "Removed") entry.status = "Dismissed";
      });
    }
    Object.assign(record, changes);
    if (statusMatch[1] === "reports" && changes.status === "Removed") {
      const reportedListing = store.listings.find((entry) => entry.id === record.listingId);
      if (reportedListing) reportedListing.status = "Removed";
    }
    if (statusMatch[1] === "requests" && changes.status) {
      const listing = store.listings.find((entry) => entry.id === record.listingId);
      if (listing && changes.status === "Accepted") listing.status = "Reserved";
      if (listing && changes.status === "Declined") listing.status = "Available";
      if (listing && changes.status === "Completed") {
        listing.status = "Sold";
        record.completedAt = new Date().toISOString();
        record.reviewDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        record.reviewedBy = [];
      }
      const recipientId = changes.status === "Completed" ? record.sellerId : record.buyerId;
      const messages = {
        Accepted: `${record.seller} accepted your request for ${record.item}.`,
        Declined: `${record.seller} declined your request for ${record.item}.`,
        Completed: `${record.buyer} marked ${record.item} as collected.`,
      };
      store.notifications.unshift({
        id: Date.now() + 1, userId: recipientId, icon: changes.status === "Declined" ? "×" : "✓",
        title: `Request ${changes.status.toLowerCase()}`, message: messages[changes.status] || `${record.item} was updated.`,
        time: "Just now", read: false, link: changes.status === "Completed" ? "/history" : "/requests",
      });
    }
    const requestMessages = { Accepted: "Request accepted.", Declined: "Request declined.", Completed: "Swap moved to your history." };
    return sendJson(response, 200, { message: statusMatch[1] === "requests" ? (requestMessages[changes.status] || "Request updated.") : "Status updated.", record });
  }

  return sendJson(response, 404, { message: "API route not found." });
}

module.exports = { handleApi };