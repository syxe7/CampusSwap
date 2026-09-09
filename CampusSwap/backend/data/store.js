const users = [
  { id: 1, studentId: "2250001", name: "Qis Sofea", email: "2250001@alfateh.upnm.edu.my", password: "QisSwap!2026", role: "student", rating: 0, reviews: 0 },
  { id: 2, studentId: "2250002", name: "Aina Syafiqa", email: "2250002@alfateh.upnm.edu.my", password: "AinaSwap!2026", role: "student", rating: 0, reviews: 0 },
  { id: 3, studentId: "2250003", name: "Kai Rahman", email: "2250003@alfateh.upnm.edu.my", password: "KaiSwap!2026", role: "student", rating: 0, reviews: 0 },
  { id: 4, name: "Campus Admin", email: "admin@alfateh.upnm.edu.my", password: "AdminSwap!2026", role: "admin", rating: 5 },
];

const listings = [];

const requests = [];

const messages = [];

const reports = [];

const notifications = [];

const reviews = [];

module.exports = { users, listings, requests, messages, reports, notifications, reviews };