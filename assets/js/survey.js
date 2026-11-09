/* Customer survey, rendered from ruwad/validation/survey.json (embedded at build time).
   Answers: single = code, multi = codes joined by ";", number/scale = number, text = text,
   F2 (contact) = "first name | contact", only when something in F1 is ticked. */
(() => {
  "use strict";
  const root = document.querySelector("[data-survey]");
  const src = document.getElementById("survey-data");
  if (!root || !src || !window.RUWAD) return;
  const { store, t, esc } = window.RUWAD;
  const S = JSON.parse(src.textContent);
  const L = (o, ar, en) => t(o[ar], o[en]);
  const ENDPOINT = (window.RUWAD_CONFIG || {}).formEndpoint;
  const source = (new URLSearchParams(location.search).get("src") || "direct").replace(/[^\w-]/g, "").slice(0, 40);
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  // Price test: one arm per respondent, kept for this browser so a reload shows the same price.
  const arms = store.get("surveyArms", {});
  S.questions.filter((q) => Array.isArray(q.price_arms) && q.price_arms.length).forEach((q) => {
    if (!q.price_arms.includes(arms[q.id])) arms[q.id] = q.price_arms[Math.floor(Math.random() * q.price_arms.length)];
    const shown = arms[q.id].toLocaleString("en");
    q.ar = q.ar.replaceAll("{price}", shown); q.en = q.en.replaceAll("{price}", shown);
  });
  store.set("surveyArms", arms);
  const KSA_MOBILE = /^(?:\+?966|0)5\d{8}$/;

  const field = (q, i) => {
    const label = L(q, "ar", "en");
    const req = q.required ? ` <span class="req" aria-hidden="true">*</span>` : "";
    const err = `<div class="err">${t("هذا السؤال مطلوب.", "This question is required.")}</div>`;
    switch (q.type) {
      case "info":
        return `<div class="note survey-info" data-q="${q.id}"><p>${esc(label)}</p></div>`;
      case "single":
      case "multi": {
        const type = q.type === "single" ? "radio" : "checkbox";
        const hint = q.max ? `<div class="hint">${t(`اختر حتى ${q.max}`, `Choose up to ${q.max}`)}</div>` : "";
        return `<fieldset class="field sq" data-q="${q.id}" data-type="${q.type}"${q.required ? " data-required" : ""}${q.max ? ` data-max="${q.max}"` : ""}>
          <legend>${esc(label)}${req}</legend>${hint}
          <div class="options">${q.options.map(([code, ar, en]) => `<label class="opt"><input type="${type}" name="${q.id}" value="${esc(code)}"><span>${esc(t(ar, en))}</span></label>`).join("")}</div>${err}
          ${q.max ? `<div class="err max">${t(`اختر ${q.max} كحد أقصى.`, `Choose at most ${q.max}.`)}</div>` : ""}</fieldset>`;
      }
      case "scale":
        return `<fieldset class="field sq" data-q="${q.id}" data-type="scale"${q.required ? " data-required" : ""}>
          <legend>${esc(label)}${req}</legend>
          <div class="scale">${Array.from({ length: q.max - q.min + 1 }, (_, k) => q.min + k).map((v, k) => `<label class="opt"><input type="radio" name="${q.id}" value="${v}"><span>${v}${q.labels && q.labels[k] ? `<small>${esc(q.labels[k].split(" / ")[t(0, 1)] || q.labels[k])}</small>` : ""}</span></label>`).join("")}</div>${err}</fieldset>`;
      case "number":
        return `<div class="field sq" data-q="${q.id}" data-type="number"${q.required ? " data-required" : ""}>
          <label for="${q.id}">${esc(label)}${req}</label>
          <div class="num"><input id="${q.id}" name="${q.id}" type="number" inputmode="numeric" min="0" max="100000" step="1" dir="ltr"><span>${q.unit === "SAR" ? t("ريال", "SAR") : esc(q.unit || "")}</span></div>${err}</div>`;
      case "contact":
        return `<fieldset class="field sq" data-q="${q.id}" data-type="contact" hidden>
          <legend>${esc(label)}</legend>
          <label for="${q.id}-name" class="small">${t("الاسم الأول", "First name")}</label><input id="${q.id}-name" autocomplete="given-name">
          <label for="${q.id}-contact" class="small" style="margin-top:.5rem">${t("الجوال أو البريد", "Mobile or email")}</label><input id="${q.id}-contact" dir="ltr" autocomplete="email">
          <div class="err">${t("اكتب اسمك الأول ورقم جوال سعودي أو بريدًا صحيحًا.", "Enter your first name and a Saudi mobile or valid email.")}</div></fieldset>`;
      default:
        return `<div class="field sq" data-q="${q.id}" data-type="text"><label for="${q.id}">${esc(label)}</label><textarea id="${q.id}" name="${q.id}" rows="3" maxlength="1000"></textarea></div>`;
    }
  };

  root.innerHTML = `
    <form class="panel survey" novalidate>
      <p>${esc(L(S, "intro_ar", "intro_en"))}</p>
      ${S.questions.map(field).join("")}
      <div class="field sq" data-q="consent"><label class="check"><input type="checkbox" name="consent"> <span>${esc(L(S, "consent_ar", "consent_en"))} <a href="privacy.html">${t("إشعار الخصوصية", "Privacy notice")}</a></span></label>
        <div class="err">${t("الموافقة مطلوبة لإرسال إجاباتك.", "Consent is needed to send your answers.")}</div></div>
      <div class="hp" aria-hidden="true"><label for="sv-web">Website</label><input id="sv-web" name="website" tabindex="-1" autocomplete="off"></div>
      <p class="form-msg" role="status" aria-live="polite"></p>
      <button class="btn" type="submit">${t("أرسل إجاباتي", "Send my answers")}</button>
    </form>`;
  const form = root.querySelector("form");
  const contactBox = form.querySelector('[data-type="contact"]');
  const f1 = () => [...form.querySelectorAll('input[name="F1"]:checked')].map((i) => i.value);
  form.addEventListener("change", (e) => {
    if (e.target.name === "F1" && contactBox) contactBox.hidden = f1().length === 0;
  });

  function collect() {
    const ans = {}; let first = null;
    const fail = (el) => { el.classList.add("invalid"); if (!first) first = el; };
    form.querySelectorAll(".sq").forEach((el) => el.classList.remove("invalid"));
    for (const q of S.questions) {
      const el = form.querySelector(`[data-q="${q.id}"]`);
      if (q.type === "info") continue;
      if (q.type === "single" || q.type === "scale") {
        const v = form.querySelector(`input[name="${q.id}"]:checked`);
        if (v) ans[q.id] = v.value; else if (q.required) fail(el);
      } else if (q.type === "multi") {
        const v = [...form.querySelectorAll(`input[name="${q.id}"]:checked`)].map((i) => i.value);
        if (q.max && v.length > q.max) { el.classList.add("over"); fail(el); } else el.classList.remove("over");
        if (v.length) ans[q.id] = v.join(";"); else if (q.required) fail(el);
      } else if (q.type === "number") {
        const raw = el.querySelector("input").value.trim();
        const n = Number(raw);
        if (raw === "" ? q.required : !(Number.isFinite(n) && n >= 0 && n <= 100000)) fail(el);
        else if (raw !== "") ans[q.id] = String(Math.round(n));
      } else if (q.type === "contact") {
        if (f1().length) {
          const name = el.querySelector(`#${q.id}-name`).value.trim().slice(0, 60);
          const c = el.querySelector(`#${q.id}-contact`).value.replace(/[\s-]/g, "").toLowerCase();
          if (!name || !(EMAIL.test(c) || KSA_MOBILE.test(c))) fail(el); else ans[q.id] = `${name} | ${c}`;
        }
      } else {
        const v = el.querySelector("textarea").value.trim().slice(0, 1000);
        if (v) ans[q.id] = v;
      }
    }
    Object.entries(arms).forEach(([id, price]) => { if (id in ans) ans[`${id}_price`] = String(price); });
    const consent = form.querySelector('input[name="consent"]');
    if (!consent.checked) fail(form.querySelector('[data-q="consent"]'));
    return [ans, first];
  }

  const msg = form.querySelector(".form-msg");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (form.website.value) return;
    const [answers, first] = collect();
    if (first) {
      msg.className = "form-msg show bad";
      msg.textContent = t("أكمل الأسئلة المطلوبة المعلّمة باللون الأحمر.", "Complete the required questions marked in red.");
      (first.querySelector("input, textarea") || first).focus();
      return;
    }
    const record = { type: "survey", survey: S.id, version: S.version, id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), submitted_at: new Date().toISOString(), source, lang: t("ar", "en"), consent: true, answers };
    const btn = form.querySelector("button[type=submit]");
    if (ENDPOINT) {
      btn.disabled = true;
      try {
        const r = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(record) });
        if (!r.ok) throw new Error(String(r.status));
      } catch {
        btn.disabled = false;
        msg.className = "form-msg show bad";
        msg.textContent = t("تعذر الإرسال الآن. تحقق من اتصالك وحاول مرة أخرى.", "Couldn't send right now. Check your connection and try again.");
        return;
      }
    } else {
      const all = store.get("surveys", []); all.push(record); store.set("surveys", all);
    }
    root.innerHTML = `<div class="panel"><h2>${t("شكرًا لك", "Thank you")}</h2><p>${t("وصلتنا إجاباتك. ستساعدنا في بناء دورة تناسب الخريجين فعلًا.", "We've got your answers. They help us build a course that really fits graduates.")}</p>${answers.F1 && answers.F1.includes("placement") ? `<p><a class="btn" href="start.html">${t("ابدأ اختبار تحديد المستوى", "Start the placement test")}</a></p>` : ""}${ENDPOINT ? "" : `<p class="small muted">${t("نسخة تجريبية: حُفظت في متصفحك فقط.", "Prototype: saved in your browser only.")}</p>`}</div>`;
  });
})();
