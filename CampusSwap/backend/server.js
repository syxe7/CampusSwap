const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleApi } = require("./routes/api");

const FRONTEND = path.join(__dirname, "..", "frontend");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

const pages = {
  "/": "pages/login.html",
  "/login": "pages/login.html",
  "/register": "pages/register.html",
  "/marketplace": "pages/marketplace.html",
  "/item-details": "pages/item-details.html",
  "/favourites": "pages/favourites.html",
  "/my-listings": "pages/my-listings.html",
  "/sell": "pages/sell.html",
  "/requests": "pages/requests.html",
  "/chat": "pages/chat.html",
  "/notifications": "pages/notifications.html",
  "/profile": "pages/profile.html",
  "/settings": "pages/settings.html",
  "/history": "pages/history.html",
  "/admin": "pages/admin.html",
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      return await handleApi(request, response, url);
    }

    const relativePath = pages[url.pathname] || url.pathname.replace(/^\//, "");
    const filePath = path.normalize(path.join(FRONTEND, relativePath));

    if (!filePath.startsWith(FRONTEND)) {
      response.writeHead(403, { "Content-Type": "text/plain" });
      return response.end("Forbidden");
    }

    fs.readFile(filePath, (error, fileContent) => {
      if (error) {
        response.writeHead(404, { "Content-Type": "text/plain" });
        return response.end("Page not found");
      }

      response.writeHead(200, {
        "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      });
      response.end(fileContent);
    });
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ message: "The server could not complete this request." }));
  }
});

server.listen(3000, () => {
  console.log("CampusSwap is running at http://localhost:3000");
});