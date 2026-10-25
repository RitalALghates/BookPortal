/* BookPortal – shared behaviour: layout, toast, reveal, storage layer and the home page. */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Layout ---------- */
  const NAV = [
    ["index.html", "Home"],
    ["exchange.html", "Book Exchange"],
    ["about.html", "About Us"],
    ["contact.html", "Contact Us"],
  ];

  function mountLayout() {
    const page = location.pathname.split("/").pop() || "index.html";
    const header = $("#site-header");
    if (header) {
      header.className = "site-header";
      header.innerHTML = `
        <div class="container nav">
          <a class="brand" href="index.html" aria-label="BookPortal home">
            <img src="assets/img/logo.png" alt="" /><span>Book<b>Portal</b></span>
          </a>
          <ul id="nav-list">${NAV.map(([href, label]) => `<li><a href="${href}" class="${href === page ? "active" : ""}">${label}</a></li>`).join("")}</ul>
          <a class="btn sm dark" href="exchange.html?list=1">+ List a book</a>
          <button class="menu-btn" aria-label="Menu" aria-expanded="false">☰</button>
        </div>`;
      $(".menu-btn", header).addEventListener("click", (e) => {
        const open = $("#nav-list").classList.toggle("open");
        e.currentTarget.setAttribute("aria-expanded", open);
      });
    }
    const footer = $("#site-footer");
    if (footer) {
      footer.className = "site-footer";
      footer.innerHTML = `
        <div class="container footer-grid">
          <div>
            <div class="footer-brand"><img src="assets/img/logo.png" alt="" /><span>BookPortal</span></div>
            <p>We're dedicated to making education more accessible by facilitating textbook sharing among students and educators.</p>
          </div>
          <div><h4>Quick links</h4><ul>${NAV.map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join("")}</ul></div>
          <div><h4>Contact</h4>
            <p>📍 University of Jeddah, Faisaliyah Campus</p>
            <p>✉️ book999@bookportal.com</p>
          </div>
        </div>
        <div class="container footer-bottom">© 2025 BookPortal. All rights reserved.</div>`;
    }
    const bar = document.createElement("div");
    bar.className = "progress";
    document.body.prepend(bar);
    const top = document.createElement("button");
    top.className = "to-top";
    top.setAttribute("aria-label", "Back to top");
    top.textContent = "↑";
    top.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
    document.body.appendChild(top);
    const onScroll = () => {
      const h = document.documentElement;
      bar.style.transform = `scaleX(${h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)})`;
      header && header.classList.toggle("scrolled", h.scrollTop > 8);
      top.classList.toggle("show", h.scrollTop > 700);
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Toast ---------- */
  function toast(message, type = "ok") {
    let el = $(".toast");
    if (!el) {
      el = document.createElement("div");
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.className = "toast" + (type === "error" ? " error" : "");
    el.textContent = message;
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("show"), 3400);
  }

  /* ---------- Reveal on scroll ---------- */
  let io;
  function reveal() {
    const els = $$(".reveal:not(.in)");
    if (!("IntersectionObserver" in window)) return els.forEach((e) => e.classList.add("in"));
    io = io || new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }), { threshold: 0.12 });
    els.forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 90}ms`; io.observe(el); });
  }

  /* ---------- Storage layer: Express API when available, localStorage otherwise ---------- */
  const LS = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
  };
  let serverMode = null;
  async function hasServer() {
    if (serverMode !== null) return serverMode;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 1500);
      const r = await fetch("api/health", { signal: ctl.signal });
      clearTimeout(t);
      serverMode = r.ok && (r.headers.get("content-type") || "").includes("json");
    } catch { serverMode = false; }
    return serverMode;
  }
  async function call(method, path, body) {
    const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error("Request failed"), { errors: data.errors });
    return data;
  }
  const uid = () => "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const store = {
    async mode() { return (await hasServer()) ? "server" : "browser"; },
    async books() {
      const mine = (await hasServer()) ? (await call("GET", "api/books")).books : LS.get("bp.books", []);
      return [...mine.map((b) => ({ ...b, mine: true })), ...window.BP_SEED];
    },
    async addBook(book) {
      if (await hasServer()) return (await call("POST", "api/books", book)).book;
      const saved = { ...book, id: uid(), createdAt: Date.now() };
      LS.set("bp.books", [saved, ...LS.get("bp.books", [])]);
      return saved;
    },
    async removeBook(id) {
      if (await hasServer()) return call("DELETE", "api/books/" + encodeURIComponent(id));
      LS.set("bp.books", LS.get("bp.books", []).filter((b) => b.id !== id));
    },
    async sendContact(data) {
      if (await hasServer()) return call("POST", "api/contact", data);
      LS.set("bp.contacts", [{ Fname: data.Fname, email: data.email, at: Date.now() }, ...LS.get("bp.contacts", [])].slice(0, 20));
      return { message: "Success" };
    },
    async contacts() {
      if (await hasServer()) return (await call("GET", "api/contact")).messages;
      return LS.get("bp.contacts", []);
    },
    async sendRequest(data) {
      if (await hasServer()) return call("POST", "api/requests", data);
      LS.set("bp.requests", [{ ...data, at: Date.now() }, ...LS.get("bp.requests", [])]);
      return { message: "Success" };
    },
  };

  /* ---------- Generated cover for books without an image ---------- */
  const PALETTE = {
    Science: ["#2f6f73", "#1d4448"], Technology: ["#3b5ba5", "#22335f"], Mathematics: ["#8a4f7d", "#4d2745"],
    Literature: ["#9a5b3a", "#552f1c"], History: ["#6d4c3d", "#34231b"], Business: ["#3f7d6b", "#1f4237"], Art: ["#c25b4a", "#6d2a20"],
  };
  function coverHtml(b) {
    if (b.img) return `<div class="cover"><img src="${esc(b.img)}" alt="Cover of ${esc(b.title)}" loading="lazy" /></div>`;
    const [a, c] = PALETTE[b.category] || ["#6d4c3d", "#34231b"];
    return `<div class="cover gen" style="background:linear-gradient(150deg,${a},${c})"><small>${esc(b.category)}</small><strong>${esc(b.title)}</strong><em>${esc(b.author)}</em></div>`;
  }

  /* ---------- Home page ---------- */
  async function initHome() {
    if (document.body.dataset.page !== "home") return;

    const form = $("#hero-search");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = $("input", form).value.trim();
      location.href = "exchange.html" + (q ? "?q=" + encodeURIComponent(q) : "");
    });

    const stack = $(".book-stack");
    if (stack && matchMedia("(pointer:fine)").matches) {
      $(".hero").addEventListener("mousemove", (e) => {
        const x = (e.clientX / innerWidth - 0.5) * 2, y = (e.clientY / innerHeight - 0.5) * 2;
        $$(".bk", stack).forEach((b, i) => { b.style.translate = `${x * (10 + i * 6)}px ${y * (8 + i * 4)}px`; });
      });
    }

    const books = await store.books();
    const counts = { books: books.length, cats: new Set(books.map((b) => b.category)).size, types: 3 };
    $$("[data-count]").forEach((el) => {
      const target = counts[el.dataset.count];
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = target; return; }
      const start = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - start) / 1100);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    $("#featured").innerHTML = books.filter((b) => b.img || b.id === "seed-orgchem" || b.id === "seed-cleancode").slice(0, 4).map(cardMini).join("");
    reveal();
  }
  const TYPE_LABEL = { Lend: "For lending", Borrow: "Wants to borrow", Request: "Requested" };
  function cardMini(b) {
    return `<article class="book-card reveal">
      <div style="position:relative">${coverHtml(b)}<span class="tag ${esc(b.type)}">${TYPE_LABEL[b.type]}</span></div>
      <div class="book-body"><h3>${esc(b.title)}</h3><p class="author">${esc(b.author)}</p>
        <div class="meta"><span class="pill">${esc(b.category)}</span><span class="cond ${esc(b.condition)}">${esc(b.condition)}</span></div>
        <div class="book-foot"><a class="btn sm dark" href="exchange.html?q=${encodeURIComponent(b.title)}">View</a></div></div></article>`;
  }

  window.BP = { $, $$, esc, toast, store, coverHtml, reveal, TYPE_LABEL };
  document.addEventListener("DOMContentLoaded", () => { mountLayout(); initHome(); reveal(); });
})();
