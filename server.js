/* BookPortal server
 *  - serves the static site
 *  - JSON API for listings, contact messages and book requests
 *  - data is kept in data/store.json, so no database setup is needed
 *
 *  Run:  npm start   →   http://localhost:3000
 */
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

/* ---------- tiny JSON store ---------- */
function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  } catch {
    return { books: [], contacts: [], requests: [] };
  }
}
function writeStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}
const uid = () => "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- validation ---------- */
const EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const CATEGORIES = ["Science", "Technology", "Mathematics", "Literature", "History", "Business", "Art"];
const CONDITIONS = ["New", "Good", "Used", "Damaged"];
const TYPES = ["Lend", "Borrow", "Request"];
const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);

function validateBook(b) {
  const errors = {};
  if (clean(b.name).length < 2) errors.name = "Please enter your name.";
  if (!EMAIL.test(clean(b.email))) errors.email = "Please enter a valid email.";
  if (clean(b.title).length < 2) errors.title = "Please enter the book title.";
  if (clean(b.author).length < 2) errors.author = "Please enter the author's name.";
  if (!CATEGORIES.includes(b.category)) errors.category = "Please select a category.";
  if (!CONDITIONS.includes(b.condition)) errors.condition = "Please select the book condition.";
  if (!TYPES.includes(b.type)) errors.type = "Please choose the exchange type.";
  if (b.year && !(Number(b.year) >= 1900 && Number(b.year) <= new Date().getFullYear())) errors.year = "Invalid year.";
  if (b.img && (typeof b.img !== "string" || !b.img.startsWith("data:image/") || b.img.length > 600000)) errors.img = "Cover image is too large.";
  return errors;
}

function validateContact(c) {
  const errors = {};
  if (!/^[a-zA-Z]{2,12}$/.test(clean(c.Fname))) errors.Fname = "First name must be 2-12 letters only.";
  if (!/^[a-zA-Z]{2,12}$/.test(clean(c.Lname))) errors.Lname = "Last name must be 2-12 letters only.";
  if (!["Male", "Female"].includes(c.gender)) errors.gender = "Gender must be selected.";
  if (!/^[0-9]{10}$/.test(clean(c.mobile))) errors.mobile = "Mobile must be exactly 10 digits.";
  if (!c.DB || isNaN(Date.parse(c.DB)) || new Date(c.DB) >= new Date()) errors.DB = "Date of birth must be a valid past date.";
  if (!EMAIL.test(clean(c.email))) errors.email = "Invalid email format.";
  if (!["Arabic", "English", "French"].includes(c.language)) errors.language = "Please select a valid language.";
  return errors;
}

/* ---------- middleware ---------- */
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname, { extensions: ["html"], index: "index.html", dotfiles: "ignore" }));

/* ---------- API ---------- */
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/books", (_req, res) => res.json({ books: readStore().books }));

app.post("/api/books", (req, res) => {
  const errors = validateBook(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ errors });
  const b = req.body;
  const book = {
    id: uid(),
    title: clean(b.title),
    author: clean(b.author),
    category: b.category,
    condition: b.condition,
    type: b.type,
    year: b.year ? Number(b.year) : undefined,
    description: clean(b.description, 300),
    img: b.img || undefined,
    owner: clean(b.name, 60),
    ownerEmail: clean(b.email, 80),
    createdAt: Date.now(),
  };
  const store = readStore();
  store.books.unshift(book);
  writeStore(store);
  res.status(201).json({ message: "Success", book });
});

app.delete("/api/books/:id", (req, res) => {
  const store = readStore();
  const before = store.books.length;
  store.books = store.books.filter((b) => b.id !== req.params.id);
  if (store.books.length === before) return res.status(404).json({ errors: "Not found" });
  writeStore(store);
  res.json({ message: "Success" });
});

app.post("/api/contact", (req, res) => {
  const errors = validateContact(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ errors });
  const c = req.body;
  const store = readStore();
  store.contacts.unshift({
    Fname: clean(c.Fname, 12), Lname: clean(c.Lname, 12), gender: c.gender, mobile: clean(c.mobile, 10),
    DB: c.DB, email: clean(c.email, 50), language: c.language, message: clean(c.message, 500), at: Date.now(),
  });
  writeStore(store);
  res.json({ message: "Success", Fname: clean(c.Fname), email: clean(c.email) });
});

// Only first name, email and time are returned (no phone number or date of birth).
app.get("/api/contact", (_req, res) =>
  res.json({ messages: readStore().contacts.slice(0, 20).map(({ Fname, email, at }) => ({ Fname, email, at })) })
);

app.post("/api/requests", (req, res) => {
  const r = req.body || {};
  const errors = {};
  if (clean(r.name).length < 2) errors.name = "Please enter your name.";
  if (!EMAIL.test(clean(r.email))) errors.email = "Please enter a valid email.";
  if (clean(r.message).length < 5) errors.message = "Write a short message.";
  if (Object.keys(errors).length) return res.status(400).json({ errors });
  const store = readStore();
  store.requests.unshift({ bookId: clean(r.bookId, 60), title: clean(r.title), action: clean(r.action, 40), name: clean(r.name, 60), email: clean(r.email, 80), message: clean(r.message, 500), at: Date.now() });
  writeStore(store);
  res.json({ message: "Success" });
});

app.use("/api", (_req, res) => res.status(404).json({ errors: "Not found" }));

// Never leak stack traces: malformed JSON and other errors get a short JSON answer.
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status >= 400 && status < 600 ? status : 500).json({ errors: status === 413 ? "Request too large." : "Invalid request." });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`BookPortal running on http://localhost:${PORT}`));
}
module.exports = app;
