/* BookPortal – Book Exchange page: catalogue, search / filters, detail + request dialog, listing form. */
(function () {
  "use strict";
  const { $, $$, esc, toast, store, coverHtml, reveal, TYPE_LABEL } = window.BP;

  const CATEGORIES = ["Science", "Technology", "Mathematics", "Literature", "History", "Business", "Art"];
  const ACTION = { Lend: "Borrow this book", Borrow: "I can lend it", Request: "I have this book" };
  const COND_ORDER = { New: 0, Good: 1, Used: 2, Damaged: 3 };
  const EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const state = { books: [], q: "", cat: "All", type: "All", sort: "newest", mode: "browser" };

  /* ---------- Catalogue ---------- */
  function visible() {
    const q = state.q.trim().toLowerCase();
    let list = state.books.filter((b) =>
      (state.cat === "All" || b.category === state.cat) &&
      (state.type === "All" || b.type === state.type) &&
      (!q || `${b.title} ${b.author} ${b.category} ${b.description || ""}`.toLowerCase().includes(q)));
    if (state.sort === "title") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (state.sort === "condition") list = [...list].sort((a, b) => COND_ORDER[a.condition] - COND_ORDER[b.condition]);
    return list;
  }

  function card(b, i) {
    return `<article class="book-card" style="animation-delay:${Math.min(i, 10) * 45}ms" data-id="${esc(b.id)}">
      <div style="position:relative">${coverHtml(b)}
        <span class="tag ${esc(b.type)}">${TYPE_LABEL[b.type]}</span>${b.mine ? '<span class="mine">Yours</span>' : ""}</div>
      <div class="book-body">
        <h3>${esc(b.title)}</h3>
        <p class="author">${esc(b.author)}</p>
        <div class="meta"><span class="pill">${esc(b.category)}</span>${b.year ? `<span class="pill">${esc(b.year)}</span>` : ""}<span class="cond ${esc(b.condition)}">${esc(b.condition)}</span></div>
        <div class="book-foot">
          <button class="btn sm dark" data-open="${esc(b.id)}">${ACTION[b.type]}</button>
          ${b.mine ? `<button class="btn sm ghost" data-del="${esc(b.id)}" aria-label="Remove my listing">🗑</button>` : ""}
        </div>
      </div></article>`;
  }

  function render() {
    const list = visible();
    $("#books-grid").innerHTML = list.map(card).join("");
    $("#empty").classList.toggle("show", list.length === 0);
    $("#count").textContent = `${list.length} book${list.length === 1 ? "" : "s"}`;
    $("#count-sub").textContent = state.cat === "All" ? "in the exchange" : `in ${state.cat}`;
  }

  async function load() {
    state.books = await store.books();
    render();
  }

  /* ---------- Modal helpers ---------- */
  function openModal(html, narrow) {
    const m = $("#modal");
    $(".modal-card", m).className = "modal-card" + (narrow ? " narrow" : "");
    $("#modal-body").innerHTML = html;
    m.classList.add("open");
    document.body.style.overflow = "hidden";
    return m;
  }
  function closeModal() {
    $("#modal").classList.remove("open");
    document.body.style.overflow = "";
  }

  /* ---------- Field validation ---------- */
  const RULES = {
    name: (v) => (v.trim().length >= 2 ? "" : "Please enter your name."),
    email: (v) => (EMAIL.test(v.trim()) ? "" : "Please enter a valid email."),
    title: (v) => (v.trim().length >= 2 ? "" : "Please enter the book title."),
    author: (v) => (v.trim().length >= 2 ? "" : "Please enter the author's name."),
    category: (v) => (v ? "" : "Please select a category."),
    year: (v) => (!v || (+v >= 1900 && +v <= new Date().getFullYear()) ? "" : `Enter a year between 1900 and ${new Date().getFullYear()}.`),
    condition: (v) => (v ? "" : "Please select the book condition."),
    type: (v) => (v ? "" : "Please choose the exchange type."),
    message: (v) => (v.trim().length >= 5 ? "" : "Write a short message (5+ characters)."),
  };
  function check(input) {
    const group = input.closest(".fg");
    const msg = RULES[input.name] ? RULES[input.name](input.value) : "";
    group.classList.toggle("bad", !!msg);
    group.classList.toggle("ok", !msg && !!input.value);
    const err = $(".err", group);
    if (err) err.textContent = msg;
    return !msg;
  }
  function wire(form) {
    $$("input[name],select[name],textarea[name]", form).forEach((el) => {
      if (el.type === "file") return;
      el.addEventListener("blur", () => check(el));
      el.addEventListener("input", () => el.closest(".fg").classList.contains("bad") && check(el));
    });
  }
  const fg = (label, control) => `<div class="fg">${`<label>${label}</label>`}${control}<div class="err"></div></div>`;

  /* ---------- Listing form ---------- */
  function openListing() {
    const m = openModal(`
      <h2>List a book</h2>
      <p class="sub">Lend a book, ask to borrow one, or request a title you need.</p>
      <form id="list-form" novalidate>
        <div class="form-grid">
          ${fg("Your name", '<input name="name" autocomplete="name" placeholder="e.g. Rital" />')}
          ${fg("Email", '<input name="email" type="email" autocomplete="email" placeholder="name@domain.com" />')}
          ${fg("Book title", '<input name="title" placeholder="e.g. Clean Code" />')}
          ${fg("Author", '<input name="author" placeholder="e.g. Robert C. Martin" />')}
          ${fg("Category", `<select name="category"><option value="">Select category</option>${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select>`)}
          ${fg("Publication year (optional)", '<input name="year" type="number" min="1900" max="2100" placeholder="2020" />')}
          ${fg("Condition", '<select name="condition"><option value="">Select condition</option><option>New</option><option>Good</option><option>Used</option><option>Damaged</option></select>')}
          ${fg("Exchange type", '<select name="type"><option value="">Select type</option><option value="Lend">Lend – I have this book</option><option value="Borrow">Borrow – I want to borrow it</option><option value="Request">Request – I am looking for it</option></select>')}
          <div class="fg wide"><label>Book cover (optional)</label>
            <label class="upload"><img id="preview" alt="" src="assets/img/book.png" /><div><b>Choose an image</b><span>JPG or PNG – resized automatically</span></div><input type="file" name="cover" accept="image/*" /></label></div>
          <div class="fg wide"><label>Description (optional)</label><textarea name="description" maxlength="300" placeholder="Condition notes, edition, exchange terms…"></textarea><div class="counter"><span id="chars">0</span>/300</div></div>
        </div>
        <button class="btn full" style="margin-top:20px" type="submit">Submit listing</button>
      </form>`);
    const form = $("#list-form", m);
    wire(form);
    let cover = "";
    $("textarea", form).addEventListener("input", (e) => ($("#chars").textContent = e.target.value.length));
    $("input[type=file]", form).addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      cover = await shrink(file);
      $("#preview").src = cover;
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fields = $$("input[name],select[name],textarea[name]", form).filter((x) => x.type !== "file");
      const results = fields.map(check);
      if (results.includes(false)) { $(".bad input, .bad select", form)?.focus(); return toast("Please fix the highlighted fields", "error"); }
      const data = Object.fromEntries(fields.map((x) => [x.name, x.value.trim()]));
      if (!data.year) delete data.year; else data.year = +data.year;
      if (cover) data.img = cover;
      try {
        await store.addBook(data);
        closeModal();
        await load();
        toast("Your book is now listed!");
        $("#books-grid").scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        toast("Could not save the listing. Please try again.", "error");
      }
    });
    $("input[name=name]", form).focus();
  }

  /* Downscale an uploaded image so it stays small enough for storage. */
  function shrink(file, max = 420) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const s = Math.min(1, max / img.width);
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.8));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Detail + request ---------- */
  function openDetail(id) {
    const b = state.books.find((x) => x.id === id);
    if (!b) return;
    const m = openModal(`
      <div class="detail">
        <div style="position:relative">${coverHtml(b)}<span class="tag ${esc(b.type)}">${TYPE_LABEL[b.type]}</span></div>
        <div>
          <h2>${esc(b.title)}</h2>
          <p class="sub" style="margin:0">${esc(b.author)}</p>
          <dl><dt>Category</dt><dd>${esc(b.category)}</dd>${b.year ? `<dt>Year</dt><dd>${esc(b.year)}</dd>` : ""}
            <dt>Condition</dt><dd><span class="cond ${esc(b.condition)}">${esc(b.condition)}</span></dd><dt>Status</dt><dd>${TYPE_LABEL[b.type]}</dd></dl>
          ${b.description ? `<p style="color:var(--muted);margin:14px 0 0">${esc(b.description)}</p>` : ""}
        </div>
      </div>
      <form id="req-form" novalidate>
        <div class="form-grid">
          ${fg("Your name", '<input name="name" autocomplete="name" />')}
          ${fg("Email", '<input name="email" type="email" autocomplete="email" />')}
          <div class="fg wide"><label>Message</label><textarea name="message" placeholder="Hi! I'd like to arrange the exchange…"></textarea><div class="err"></div></div>
        </div>
        <button class="btn full" style="margin-top:18px" type="submit">${ACTION[b.type]}</button>
      </form>`);
    const form = $("#req-form", m);
    wire(form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fields = $$("input[name],textarea[name]", form);
      if (fields.map(check).includes(false)) return toast("Please fix the highlighted fields", "error");
      await store.sendRequest({ bookId: b.id, title: b.title, action: ACTION[b.type], ...Object.fromEntries(fields.map((x) => [x.name, x.value.trim()])) });
      closeModal();
      toast("Request sent! The owner will get back to you.");
    });
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    $("#cat-chips").innerHTML = ["All", ...CATEGORIES].map((c) => `<button class="chip${c === "All" ? " on" : ""}" data-cat="${c}">${c}</button>`).join("");

    const params = new URLSearchParams(location.search);
    if (params.get("q")) { state.q = params.get("q"); $("#q").value = state.q; }
    if (CATEGORIES.includes(params.get("cat"))) { state.cat = params.get("cat"); }
    $$(".chip").forEach((c) => c.classList.toggle("on", c.dataset.cat === state.cat));

    $("#q").addEventListener("input", (e) => { state.q = e.target.value; render(); });
    $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
    $("#cat-chips").addEventListener("click", (e) => {
      const c = e.target.closest(".chip"); if (!c) return;
      state.cat = c.dataset.cat;
      $$(".chip").forEach((x) => x.classList.toggle("on", x === c));
      render();
    });
    $("#type-seg").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      state.type = b.dataset.type;
      $$("#type-seg button").forEach((x) => x.classList.toggle("on", x === b));
      render();
    });
    $("#reset").addEventListener("click", () => {
      Object.assign(state, { q: "", cat: "All", type: "All" });
      $("#q").value = "";
      $$(".chip").forEach((x) => x.classList.toggle("on", x.dataset.cat === "All"));
      $$("#type-seg button").forEach((x) => x.classList.toggle("on", x.dataset.type === "All"));
      render();
    });

    document.addEventListener("click", async (e) => {
      if (e.target.closest("[data-list]")) return openListing();
      const open = e.target.closest("[data-open]"); if (open) return openDetail(open.dataset.open);
      const del = e.target.closest("[data-del]");
      if (del) { await store.removeBook(del.dataset.del); await load(); return toast("Listing removed."); }
      if (e.target === $("#modal") || e.target.closest(".x")) closeModal();
    });
    document.addEventListener("keydown", (e) => e.key === "Escape" && closeModal());

    await load();
    $("#mode-note").textContent = (await store.mode()) === "server"
      ? "Connected to the BookPortal server – listings are saved on the server."
      : "Demo mode – listings are saved in this browser only.";
    if (params.get("list")) openListing();
    const book = params.get("book"); if (book) openDetail(book);
  });
})();
