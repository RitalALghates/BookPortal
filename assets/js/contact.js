/* BookPortal – Contact page: live validation, submission and recent messages. */
(function () {
  "use strict";
  const { $, $$, esc, toast, store } = window.BP;

  const RULES = {
    Fname: (v) => (/^[a-zA-Z]{2,12}$/.test(v.trim()) ? "" : "First name must be 2–12 letters only."),
    Lname: (v) => (/^[a-zA-Z]{2,12}$/.test(v.trim()) ? "" : "Last name must be 2–12 letters only."),
    gender: (v) => (v ? "" : "Please select a gender."),
    mobile: (v) => (/^[0-9]{10}$/.test(v.trim()) ? "" : "Mobile must be exactly 10 digits."),
    DB: (v) => (!v ? "Please select your date of birth." : new Date(v) >= new Date() ? "Date of birth must be in the past." : ""),
    email: (v) => (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim()) ? "" : "Please enter a valid email address."),
    language: (v) => (v ? "" : "Please select a language."),
  };

  function check(el) {
    const g = el.closest(".fg");
    const msg = RULES[el.name] ? RULES[el.name](el.value) : "";
    g.classList.toggle("bad", !!msg);
    g.classList.toggle("ok", !msg && !!el.value);
    const err = $(".err", g);
    if (err) err.textContent = msg;
    return !msg;
  }

  async function renderMessages() {
    const list = await store.contacts();
    $("#messages").innerHTML = list.length
      ? `<h3>Recent messages</h3>` + list.slice(0, 5).map((m) => `<div class="msg"><i>${esc((m.Fname || "?")[0].toUpperCase())}</i><span><b>${esc(m.Fname)}</b> · ${esc(m.email)}</span></div>`).join("")
      : "";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = $("#contact-form");
    const fields = $$("input[name],select[name],textarea[name]", form);
    fields.forEach((el) => {
      el.addEventListener("blur", () => RULES[el.name] && check(el));
      el.addEventListener("input", () => el.closest(".fg").classList.contains("bad") && check(el));
    });
    $("textarea", form).addEventListener("input", (e) => ($("#chars").textContent = e.target.value.length));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const results = fields.filter((f) => RULES[f.name]).map(check);
      if (results.includes(false)) { $(".bad input, .bad select", form)?.focus(); return toast("Please fix the highlighted fields", "error"); }
      const data = Object.fromEntries(fields.map((f) => [f.name, f.value.trim()]));
      const btn = $("button[type=submit]", form);
      btn.disabled = true; btn.textContent = "Sending…";
      try {
        await store.sendContact(data);
        toast(`Thanks ${data.Fname}! We'll reply to ${data.email}.`);
        form.reset();
        $$(".fg", form).forEach((g) => g.classList.remove("ok", "bad"));
        $("#chars").textContent = "0";
        renderMessages();
      } catch (err) {
        const first = err.errors && typeof err.errors === "object" ? Object.values(err.errors)[0] : "";
        toast(first || "Could not send your message. Please try again.", "error");
      } finally { btn.disabled = false; btn.textContent = "Send message"; }
    });
    renderMessages();
  });
})();
