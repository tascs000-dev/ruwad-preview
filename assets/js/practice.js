/* Practice hub (learning journey v2): daily challenge, vocabulary and drag-and-drop activities,
   revision from your own mistakes, and a browser-only speaking recorder.
   Content: src/content/practice-v2.json (draft, needs a qualified teacher's review).
   Demo storage only (localStorage). Recordings never leave the page and are not saved. */
(() => {
  "use strict";
  const root = document.querySelector("[data-practice]");
  if (!root || !window.RUWAD || !window.RUWAD.journey) return;
  const { store, t, esc, AR } = window.RUWAD;
  const J = window.RUWAD.journey;
  const DATA = JSON.parse(document.getElementById("practice-data").textContent);
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const dir = AR ? "rtl" : "ltr";
  const norm = (s) => String(s || "").trim().toLowerCase().replace(/[.\s]+$/, "").replace(/\s+/g, " ");
  const P = () => J.practice();
  const setP = (k, v) => { const p = P(); p[k] = { ...(p[k] || {}), ...v }; store.set("practice", p); };

  // Seeded shuffle so a day's challenge (and a round's order) is the same on reload.
  const seedOf = (s) => { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; };
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const shuffle = (arr, seed) => { const a = [...arr]; const r = rng(seedOf(seed)); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const announce = (text) => { const live = $("[data-live]"); if (live) { live.textContent = ""; setTimeout(() => { live.textContent = text; }, 30); } };

  /* ---------- header: optional streak ---------- */
  function streakBar() {
    const on = J.J().streak;
    return `<div class="game-bar practice-bar" data-streakbar>
      <div class="game-stats">
        ${on ? `<p class="game-stat"><b data-streak>${J.streak()}</b> <span>${t("أيام متتالية", "day streak")}</span></p>` : ""}
        <p class="game-stat"><b data-due-count>${J.due().length}</b> <span>${t("للمراجعة", "to revise")}</span></p>
      </div>
      <label class="check small"><input type="checkbox" data-streak-toggle${on ? " checked" : ""}> <span>${t("أظهر عدّاد الأيام المتتالية", "Show my daily streak")}</span></label>
    </div>`;
  }
  function refreshBar() { const b = $("[data-streakbar]"); if (b) { b.outerHTML = streakBar(); wireBar(); } }
  function wireBar() {
    const c = $("[data-streak-toggle]");
    c.addEventListener("change", () => { J.setJ({ streak: c.checked }); refreshBar(); $("[data-streak-toggle]").focus(); announce(c.checked ? t("عدّاد الأيام ظاهر.", "Streak shown.") : t("عدّاد الأيام مخفي. تقدمك محفوظ كما هو.", "Streak hidden. Your progress is kept.")); });
  }
  const practised = () => { J.logDay(); refreshBar(); };

  /* ---------- question items (daily + revision share them) ---------- */
  // item: {id, tag, kind:"mcq"|"type", q, o?, a (index | accepted[]), show?, why?}
  const itemHtml = (it, i, name) => it.kind === "type"
    ? `<div class="item field" data-i="${i}" dir="ltr" lang="en"><label for="${name}-${i}">${i + 1}. ${esc(it.q)}</label>
        <span class="type-row"><input id="${name}-${i}" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn sm ghost" type="button" data-type-check>${t("تحقق", "Check")}</button></span>
        <p class="feedback" aria-live="polite" dir="${dir}"></p>${it.why ? `<p class="why" hidden>${esc(it.why)}</p>` : ""}</div>`
    : `<fieldset class="item" data-i="${i}"><legend class="q-text" lang="en" dir="ltr">${i + 1}. ${esc(it.q)}</legend>
        <div class="options q-options">${it.o.map((o, j) => `<label class="opt" lang="en"><input type="radio" name="${name}-${i}" value="${j}"><span>${esc(o)}</span></label>`).join("")}</div>
        <p class="feedback" aria-live="polite" dir="${dir}"></p>${it.why ? `<p class="why" hidden lang="en" dir="ltr">${esc(it.why)}</p>` : ""}</fieldset>`;
  const answerText = (it) => (it.kind === "type" ? it.show || it.a[0] : it.o[it.a]);
  // Wires instant marking (first answer counts, then locks). onAnswer(i, ok) is called once per item.
  function wireItems(box, items, onAnswer) {
    $$(".item", box).forEach((el) => {
      const i = Number(el.dataset.i); const it = items[i]; let done = false;
      const finish = (ok, given) => {
        if (done) return; done = true;
        el.classList.add(ok ? "right" : "wrong", ok ? "pop" : "shake");
        const fb = $(".feedback", el);
        fb.innerHTML = ok ? t("صحيح.", "Correct.") : t(`غير صحيح. الإجابة: <bdi lang="en">${esc(answerText(it))}</bdi>`, `Not quite. Answer: <bdi lang="en">${esc(answerText(it))}</bdi>`);
        const why = $(".why", el); if (why) why.hidden = false;
        $$("input, button", el).forEach((x) => { x.disabled = true; });
        onAnswer(i, ok, given);
      };
      if (it.kind === "type") {
        const inp = $("input", el);
        const go = () => { if (!norm(inp.value)) { $(".feedback", el).textContent = t("اكتب إجابتك أولًا.", "Type your answer first."); return; } finish(it.a.map(norm).includes(norm(inp.value)), inp.value); };
        $("[data-type-check]", el).addEventListener("click", go);
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
      } else {
        el.addEventListener("change", (e) => finish(Number(e.target.value) === Number(it.a), e.target.value));
      }
    });
  }
  const toMistake = (it, src) => J.mistake({ id: `${src}:${it.id}`, src, tag: it.tag, kind: it.kind || "mcq", q: it.q, o: it.o, a: it.a, show: it.show, why: it.why });

  /* ---------- 1. daily challenge ---------- */
  function dailyItems() { return shuffle(DATA.daily_pool, "daily:" + J.today()).slice(0, 5).map((x) => ({ kind: "mcq", ...x })); }
  function renderDaily(again) {
    const box = $("[data-daily]");
    const rec = J.daily()[J.today()];
    const items = again ? shuffle(DATA.daily_pool, "again:" + Date.now()).slice(0, 5).map((x) => ({ kind: "mcq", ...x })) : dailyItems();
    if (rec && !again) {
      box.innerHTML = `<div class="daily-done" data-daily-done><p class="daily-score"><b>${rec.r}</b> / ${rec.n}</p>
        <p>${t("أكملت تحدي اليوم. تحدٍّ جديد غدًا.", "You finished today's challenge. A new one comes tomorrow.")}${rec.r < rec.n ? " " + t("أخطاؤك أُضيفت إلى المراجعة.", "Your mistakes were added to revision.") : ""}</p>
        <button class="btn ghost sm" type="button" data-daily-again>${t("تدرّب بأسئلة أخرى (لا تُحسب)", "Practise with other questions (not counted)")}</button></div>`;
      $("[data-daily-again]", box).addEventListener("click", () => renderDaily(true));
      return;
    }
    box.innerHTML = `<p class="small muted">${again ? t("تدريب إضافي: لا يغيّر نتيجة اليوم، لكن أخطاءه تُضاف للمراجعة.", "Extra practice: it doesn't change today's result, but mistakes still go to revision.") : t(`تحدي ${J.today()}: خمسة أسئلة. أول إجابة هي التي تُحسب.`, `Challenge for ${J.today()}: five questions. Your first answer counts.`)}</p>
      <div class="daily-items">${items.map((it, i) => itemHtml(it, i, again ? "da" : "dq")).join("")}</div>
      <p class="form-msg" role="status" aria-live="polite" data-daily-msg></p>`;
    const res = new Array(items.length).fill(null);
    wireItems(box, items, (i, ok) => {
      res[i] = ok;
      if (!ok) toMistake(items[i], "daily");
      if (res.every((x) => x !== null)) {
        const r = res.filter(Boolean).length;
        if (!again) {
          const d = J.daily(); d[J.today()] = { r, n: items.length, at: new Date().toISOString() }; store.set("daily", d);
        }
        practised(); renderRevise();
        const msg = $("[data-daily-msg]", box);
        msg.className = "form-msg show ok";
        msg.textContent = t(`نتيجتك ${r} من ${items.length}.`, `You got ${r} of ${items.length}.`) + (r < items.length ? " " + t("أخطاؤك في قسم المراجعة الآن.", "Your mistakes are now in revision.") : " " + t("علامة كاملة!", "Perfect!"));
      }
    });
  }

  /* ---------- drag-and-drop engine ----------
     Mouse: drag a chip onto a box. Touch and keyboard: tap/press a chip to pick it, then
     tap/press "Place here" on a box. Tap a placed chip to send it back. */
  function dnd(box, cfg) {
    // cfg: {id, chips:[{v,label}], zones:[{id,label,accept:[v], cap}], seed, onCheck(results)}
    const chips = shuffle(cfg.chips, cfg.seed);
    box.classList.remove("checked", "picking");
    box.innerHTML = `
      <div class="dnd" data-dnd="${cfg.id}">
        <div class="chip-bank" data-bank aria-label="${t("الكلمات", "Items")}" role="group">${chips.map((c) => `<button type="button" class="chip" draggable="true" data-v="${esc(c.v)}" lang="en" dir="ltr" aria-pressed="false">${esc(c.label)}</button>`).join("")}</div>
        <div class="zones ${cfg.layout || ""}">${cfg.zones.map((z) => `
          <div class="zone" data-zone="${esc(z.id)}" data-accept="${esc(JSON.stringify(z.accept))}" data-cap="${z.cap || 1}">
            <div class="zone-label"${z.en ? ' lang="en" dir="ltr"' : ""}>${z.label}</div>
            <div class="zone-items" data-items></div>
            <button type="button" class="zone-drop" data-drop>${t("ضع هنا", "Place here")}<span class="visually-hidden">: ${esc(z.plain || z.label.replace(/<[^>]+>/g, ""))}</span></button>
            <p class="zone-fb small" aria-live="polite"></p>
          </div>`).join("")}</div>
        <p class="form-msg" role="status" aria-live="polite" data-dnd-msg></p>
        <div class="dnd-actions"><button type="button" class="btn" data-dnd-check>${t("تحقق", "Check")}</button> <button type="button" class="btn ghost" data-dnd-reset>${t("أعد المحاولة", "Try again")}</button></div>
      </div>`;
    const bank = $("[data-bank]", box);
    let picked = null; let checked = false;
    const pick = (chip) => {
      if (checked) return;
      if (picked === chip) { chip.setAttribute("aria-pressed", "false"); picked = null; box.classList.remove("picking"); return; }
      if (picked) picked.setAttribute("aria-pressed", "false");
      picked = chip; chip.setAttribute("aria-pressed", "true"); box.classList.add("picking");
      announce(t(`اخترت «${chip.textContent}». اختر «ضع هنا» في المكان المناسب.`, `Picked "${chip.textContent}". Now choose "Place here" on the right box.`));
    };
    const place = (chip, zone) => {
      if (checked || !chip || !zone) return;
      const items = $("[data-items]", zone); const cap = Number(zone.dataset.cap);
      if (items.children.length >= cap) bank.appendChild(items.children[0]); // single-slot boxes swap
      items.appendChild(chip); chip.setAttribute("aria-pressed", "false"); picked = null; box.classList.remove("picking");
      announce(t(`وُضعت «${chip.textContent}».`, `Placed "${chip.textContent}".`));
    };
    box.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip"); const drop = e.target.closest("[data-drop]");
      if (chip) { if (chip.closest("[data-items]") && !picked) { if (!checked) { bank.appendChild(chip); announce(t("أُعيدت إلى القائمة.", "Sent back to the list.")); chip.focus(); } return; } if (chip.closest("[data-items]") && picked) { place(picked, chip.closest(".zone")); return; } pick(chip); return; }
      if (drop) { if (picked) place(picked, drop.closest(".zone")); else announce(t("اختر كلمة أولًا.", "Pick an item first.")); }
    });
    // HTML5 drag and drop for mouse users.
    box.addEventListener("dragstart", (e) => { const c = e.target.closest(".chip"); if (!c || checked) { e.preventDefault(); return; } picked = c; e.dataTransfer.setData("text/plain", c.dataset.v); e.dataTransfer.effectAllowed = "move"; c.classList.add("dragging"); });
    box.addEventListener("dragend", (e) => { const c = e.target.closest(".chip"); if (c) c.classList.remove("dragging"); $$(".zone.over", box).forEach((z) => z.classList.remove("over")); });
    box.addEventListener("dragover", (e) => { const z = e.target.closest(".zone, [data-bank]"); if (z) { e.preventDefault(); z.classList.add("over"); } });
    box.addEventListener("dragleave", (e) => { const z = e.target.closest(".zone"); if (z && !z.contains(e.relatedTarget)) z.classList.remove("over"); });
    box.addEventListener("drop", (e) => {
      e.preventDefault(); const z = e.target.closest(".zone"); $$(".zone.over", box).forEach((x) => x.classList.remove("over"));
      const c = picked || $(`.chip[data-v="${CSS.escape(e.dataTransfer.getData("text/plain"))}"]`, box);
      if (z) place(c, z); else if (e.target.closest("[data-bank]") && c) { bank.appendChild(c); picked = null; }
    });
    $("[data-dnd-check]", box).addEventListener("click", () => {
      const msg = $("[data-dnd-msg]", box);
      const unfilled = cfg.allowLeftover ? $$(".zone", box).some((z) => !$(".chip", z)) : bank.children.length > 0;
      if (unfilled) { msg.className = "form-msg show bad"; msg.textContent = cfg.allowLeftover ? t("املأ كل الفراغات أولًا.", "Fill every gap first.") : t("ضع كل العناصر أولًا.", "Place every item first."); return; }
      checked = true; box.classList.add("checked");
      const results = $$(".zone", box).map((z) => {
        const accept = JSON.parse(z.dataset.accept);
        const got = $$(".chip", z).map((c) => c.dataset.v);
        $$(".chip", z).forEach((c) => c.classList.add(accept.includes(c.dataset.v) ? "right" : "wrong"));
        const ok = got.every((v) => accept.includes(v));
        z.classList.add(ok ? "right" : "wrong");
        return { zone: z.dataset.zone, ok, got, accept };
      });
      $$(".chip", box).forEach((c) => { c.draggable = false; c.setAttribute("aria-disabled", "true"); });
      const right = $$(".zone .chip.right", box).length; const total = cfg.allowLeftover ? $$(".zone", box).length : $$(".chip", box).length;
      msg.className = `form-msg show ${right === total ? "ok" : "bad"}`;
      msg.textContent = t(`${right} من ${total} في مكانها الصحيح.`, `${right} of ${total} in the right place.`) + (right < total ? " " + t("الأخطاء أُضيفت إلى المراجعة.", "Mistakes were added to revision.") : "");
      cfg.onCheck(results, right, total, box);
      practised(); renderRevise();
    });
    $("[data-dnd-reset]", box).addEventListener("click", () => dnd(box, { ...cfg, seed: cfg.seed + "+" }));
  }
  const best = (k, right, total) => { const prev = P()[k]; if (!prev || right > (prev.best || 0)) setP(k, { best: right, of: total }); setP(k, { at: new Date().toISOString(), tries: ((P()[k] || {}).tries || 0) + 1 }); };

  /* ---------- 2. vocabulary ---------- */
  const WORDS = DATA.words;
  const defOptions = (w) => { const others = shuffle(WORDS.filter((x) => x.w !== w.w), "o:" + w.w).slice(0, 2).map((x) => x.def); const o = shuffle([w.def, ...others], "s:" + w.w); return { o, a: o.indexOf(w.def) }; };
  function renderMatch(round) {
    const set = shuffle(WORDS, "round:" + round).slice(0, 6);
    dnd($("[data-match]"), {
      id: "match", seed: "m" + round, layout: "list",
      chips: set.map((w) => ({ v: w.w, label: w.w })),
      zones: set.map((w) => ({ id: w.w, label: `<span lang="en" dir="ltr">${esc(w.def)}</span> <small class="muted">${esc(w.ar)}</small>`, plain: w.def, accept: [w.w] })),
      onCheck: (res, r, n) => {
        best("match", r, n);
        res.filter((x) => !x.ok).forEach((x) => { const w = WORDS.find((y) => y.w === x.zone); const { o, a } = defOptions(w); J.mistake({ id: `vocab:${w.w}`, src: "vocab", tag: "vocab", kind: "mcq", q: `What does "${w.w}" mean? (${w.ex})`, o, a }); });
      },
    });
  }
  function renderGap() {
    const items = DATA.gapfill;
    const extra = ["decline", "obtain"];
    dnd($("[data-gap]"), {
      id: "gap", seed: "gap", layout: "list",
      chips: [...items.map((g) => ({ v: g.a, label: g.a })), ...extra.map((w) => ({ v: w, label: w }))],
      zones: items.map((g, i) => ({ id: "g" + i, label: `<span lang="en" dir="ltr">${esc(g.s).replace("___", '<span class="blank">_____</span>')}</span>`, plain: g.s, accept: [g.a] })),
      onCheck: (res, r, n) => {
        // Bank has 2 extra words that stay unplaced: count only the 5 sentences.
        best("gap", res.filter((x) => x.ok).length, items.length);
        res.forEach((x, i) => { if (!x.ok) { const g = items[i]; J.mistake({ id: `gap:${i}`, src: "vocab", tag: "vocab", kind: "type", q: `Type the missing word: ${g.s}`, a: g.accept || [g.a], show: g.show || g.a }); } });
      },
      allowLeftover: true,
    });
  }

  /* ---------- 3. build: paragraph order + linker sort ---------- */
  function renderOrder() {
    const P4 = DATA.paragraph;
    dnd($("[data-order]"), {
      id: "order", seed: "order", layout: "list numbered",
      chips: P4.parts.map((p) => ({ v: p.id, label: p.text })),
      zones: P4.parts.map((p, i) => ({ id: p.id, label: `<b>${i + 1}</b>`, plain: t(`الجملة ${i + 1}`, `Sentence ${i + 1}`), accept: [p.id] })),
      onCheck: (res, r, n, box) => {
        best("order", r, n);
        $$(".zone", box).forEach((z, i) => { $(".zone-fb", z).textContent = t(P4.parts[i].role.ar, P4.parts[i].role.en); });
        const why = document.createElement("p"); why.className = "note"; why.textContent = t(P4.why.ar, P4.why.en); box.querySelector(".dnd").appendChild(why);
        if (r < n) { const o = P4.parts.map((p) => p.text); J.mistake({ id: "paragraph:first", src: "build", tag: "paragraph", kind: "mcq", q: "Which sentence should open this body paragraph?", o, a: 0, why: P4.why.en }); J.mistake({ id: "paragraph:example", src: "build", tag: "paragraph", kind: "mcq", q: "Which sentence is the specific example?", o, a: 2, why: P4.why.en }); }
      },
    });
  }
  function renderSort() {
    const S = DATA.sort;
    dnd($("[data-sort]"), {
      id: "sort", seed: "sort", layout: "grid",
      chips: S.items.map((x) => ({ v: x.w, label: x.w })),
      zones: S.groups.map((g) => ({ id: g.id, label: `<b>${t(g.ar, g.en)}</b>`, plain: t(g.ar, g.en), accept: S.items.filter((x) => x.g === g.id).map((x) => x.w), cap: 4 })),
      onCheck: (res, r, n, box) => {
        best("sort", r, n);
        const groupsEn = S.groups.map((g) => g.en);
        $$(".chip.wrong", box).forEach((c) => { const it = S.items.find((x) => x.w === c.dataset.v); J.mistake({ id: `linker:${it.w}`, src: "build", tag: "linkers", kind: "mcq", q: `What kind of linking word is "${it.w}"?`, o: groupsEn, a: S.groups.findIndex((g) => g.id === it.g) }); });
      },
    });
  }

  /* ---------- 4. revision from mistakes ---------- */
  // Listening Lesson 1 mistakes: read-only from the lesson's own demo storage (owned by lesson.js).
  function syncLesson() {
    const L = store.get("lesson.ielts-listening-01", null); const gaps = DATA.lesson1_gaps || [];
    if (!L || !L.result || !Array.isArray(L.result.items)) return;
    const j = J.J(); if (j.lessonSynced === L.result.at) return;
    L.result.items.filter((x) => x.result && x.result !== "right").forEach((x) => {
      const g = gaps.find((y) => y.n === x.n); if (!g) return;
      const error_type = { distractor: "trap", spelling: "spelling", limit: "word_limit", missed: "blank" }[x.result] || "other";
      J.mistake({ id: `lesson1:gap${g.n}`, src: "lesson1", tag: "listening", kind: "type", error_type, q: `Listening Lesson 1, question ${g.n}: ${g.before} ___ ${g.after}`.replace(/\s+/g, " ").trim(), a: g.accept, show: g.display, why: g.why ? g.why.en : "" });
    });
    J.setJ({ lessonSynced: L.result.at });
  }
  function renderRevise() {
    const box = $("[data-revise]"); if (!box) return;
    const due = J.due(); const open = J.open(); const weak = J.weak();
    $("[data-due-count]") && ($("[data-due-count]").textContent = due.length);
    const summary = weak.length ? `<div class="weak"><h3 class="small-h">${t("نقاط تحتاج عملًا", "Areas that need work")}</h3><ul class="weak-list">${weak.map(([k, c]) => `<li><span>${J.tagName(k)}</span><span class="pill">${c}</span></li>`).join("")}</ul></div>` : "";
    if (!due.length) {
      const learned = Object.values(J.bank()).filter((m) => m.learned).length;
      box.innerHTML = `${summary}<p data-revise-empty>${open.length ? t(`لا شيء مستحق اليوم. ${open.length} ستعود في أيام قادمة.`, `Nothing due today. ${open.length} will come back in the next few days.`) : learned ? t(`أتقنت ${learned} من أخطائك السابقة. أحسنت.`, `You've mastered ${learned} of your past mistakes. Well done.`) : t("لا أخطاء بعد. كل خطأ في التمارين يظهر هنا لتراجعه لاحقًا.", "No mistakes yet. Anything you get wrong in practice appears here to revise later.")}</p>`;
      return;
    }
    const items = due.slice(0, 8);
    box.innerHTML = `${summary}<p class="small muted">${t("كل إجابة صحيحة تؤجل السؤال أيامًا أكثر. بعد ثلاث إجابات صحيحة متباعدة يُعدّ متقنًا.", "Each right answer pushes the question further away. After three right answers on different days it counts as mastered.")}</p>
      <div class="revise-items">${items.map((m, i) => `<div class="rev" data-rev="${esc(m.id)}"><p class="rev-src small muted">${J.tagName(m.tag)}${m.wrong > 1 ? " · " + t(`أخطأت ${m.wrong} مرات`, `missed ${m.wrong} times`) : ""}</p>${itemHtml(m, i, "rv")}</div>`).join("")}</div>
      <p class="form-msg" role="status" aria-live="polite" data-rev-msg></p>`;
    const res = [];
    wireItems(box, items, (i, ok) => {
      J.review(items[i].id, ok); res.push(ok);
      if (res.length === items.length) {
        practised();
        const r = res.filter(Boolean).length; const msg = $("[data-rev-msg]", box);
        msg.className = "form-msg show ok";
        msg.innerHTML = t(`راجعت ${items.length}: ${r} صحيحة.`, `Revised ${items.length}: ${r} right.`) + ` <button class="btn sm ghost" type="button" data-rev-more>${t("حدّث القائمة", "Refresh the list")}</button>`;
        $("[data-rev-more]", box).addEventListener("click", () => { renderRevise(); const h = document.getElementById("revise-title"); if (h) h.focus(); });
      }
    });
  }

  /* ---------- 5. speaking recorder (browser only, nothing uploaded or saved) ---------- */
  function renderSpeak() {
    const S = DATA.speaking; const box = $("[data-speak]");
    let qi = 0, rec = null, chunks = [], url = null, stream = null, timer = null, secs = 0;
    const MAX = 45;
    const can = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    box.innerHTML = `
      <div class="privacy-chip" data-speak-privacy><span aria-hidden="true">🔒</span> ${t("تسجيلك يبقى في هذه الصفحة على جهازك فقط. لا يُرفع ولا يُحفظ، ويُحذف عند مغادرة الصفحة.", "Your recording stays in this page on your device. It is not uploaded or saved, and it's gone when you leave the page.")}</div>
      <p class="small muted">${t(S.note.ar, S.note.en)}</p>
      <div class="speak-card">
        <p class="speak-q" lang="en" dir="ltr" data-speak-q>${esc(S.prompts[0].q)}</p>
        <button class="btn ghost sm" type="button" data-speak-next>${t("سؤال آخر", "Another question")}</button>
      </div>
      ${can ? `<div class="rec-row">
        <button class="btn primary" type="button" data-rec>${t("ابدأ التسجيل", "Start recording")}</button>
        <button class="btn" type="button" data-stop hidden>${t("أوقف", "Stop")}</button>
        <span class="rec-time" data-rec-time aria-live="off">0:00 / 0:${MAX}</span>
      </div>
      <p class="form-msg" role="status" aria-live="polite" data-rec-msg></p>
      <div data-playback hidden>
        <audio controls data-audio></audio>
        <p><button class="btn ghost sm" type="button" data-rec-again>${t("سجّل مرة أخرى", "Record again")}</button> <button class="btn ghost sm" type="button" data-rec-del>${t("احذف التسجيل", "Delete recording")}</button></p>
        <fieldset class="selfcheck"><legend>${t("استمع لنفسك وقيّم إجابتك", "Listen back and check your answer")}</legend>
          ${S.checklist.map((c, i) => `<label class="check"><input type="checkbox" data-sc="${i}"> <span>${t(c.ar, c.en)}</span></label>`).join("")}
        </fieldset>
        <p class="small muted">${t("هذا تدريب ذاتي. التقييم الرسمي للمحادثة في الدورة يقوم به معلم مؤهل.", "This is self-practice. In the course, speaking is assessed by a qualified teacher.")}</p>
      </div>` : `<p class="note" data-rec-unsupported>${t("متصفحك لا يدعم التسجيل. جرّب متصفح Chrome أو Safari حديثًا. تستطيع مع ذلك التدرّب: اقرأ السؤال وأجب بصوت عالٍ لمدة 30 ثانية.", "Your browser can't record here. Try a recent Chrome or Safari. You can still practise: read the question and answer aloud for 30 seconds.")}</p>`}`;
    // Model answer + shadowing: read the model, or hear it in the browser's own voice (speechSynthesis runs on the device).
    const modelBox = document.createElement("details"); modelBox.className = "model-answer"; modelBox.setAttribute("data-model", "");
    const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
    const fillModel = () => { modelBox.innerHTML = `<summary>${t("إجابة نموذجية وتدريب الترديد", "Model answer and shadowing")}</summary><p lang="en" dir="ltr" data-model-text>${esc(S.prompts[qi].model)}</p>${synth ? `<p><button class="btn ghost sm" type="button" data-model-say>${t("استمع للإجابة (صوت المتصفح)", "Hear it (browser voice)")}</button></p>` : ""}<p class="small muted">${t("الترديد: استمع جملة جملة وكررها بالسرعة نفسها، ثم سجّل إجابتك أنت.", "Shadowing: listen one sentence at a time and repeat it at the same speed, then record your own answer.")} ${t(S.model_note.ar, S.model_note.en)}</p>`; const say = $("[data-model-say]", modelBox); if (say) say.addEventListener("click", () => { synth.cancel(); const u = new SpeechSynthesisUtterance(S.prompts[qi].model); u.lang = "en-GB"; u.rate = 0.9; synth.speak(u); }); };
    fillModel(); $(".speak-card", box).after(modelBox);
    $("[data-speak-next]", box).addEventListener("click", () => { qi = (qi + 1) % S.prompts.length; $("[data-speak-q]", box).textContent = S.prompts[qi].q; fillModel(); announce(S.prompts[qi].q); });
    if (!can) return;
    const msg = $("[data-rec-msg]", box); const time = $("[data-rec-time]", box);
    const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    const say = (kind, text) => { msg.className = `form-msg show ${kind}`; msg.textContent = text; };
    const release = () => { if (stream) { stream.getTracks().forEach((tr) => tr.stop()); stream = null; } clearInterval(timer); };
    const clear = () => { if (url) { URL.revokeObjectURL(url); url = null; } const a = $("[data-audio]", box); a.removeAttribute("src"); a.load(); $("[data-playback]", box).hidden = true; $$("[data-sc]", box).forEach((c) => { c.checked = false; }); };
    async function start() {
      clear(); msg.className = "form-msg";
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) { say("bad", e && e.name === "NotAllowedError" ? t("لم يُسمح باستخدام الميكروفون. اسمح به من إعدادات المتصفح ثم حاول مجددًا.", "Microphone access was blocked. Allow it in your browser settings and try again.") : t("لم نجد ميكروفونًا يعمل.", "We couldn't find a working microphone.")); return; }
      chunks = []; rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        release();
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" }); chunks = [];
        url = URL.createObjectURL(blob); // in-memory only; never sent or stored
        $("[data-audio]", box).src = url; $("[data-playback]", box).hidden = false;
        $("[data-rec]", box).hidden = false; $("[data-stop]", box).hidden = true; $("[data-rec]", box).textContent = t("ابدأ التسجيل", "Start recording");
        const c = ((P().speak || {}).count || 0) + 1; setP("speak", { count: c, at: new Date().toISOString() }); // a count only, no audio
        say("ok", t(`سُجّلت ${fmt(secs)}. استمع ثم قيّم نفسك.`, `Recorded ${fmt(secs)}. Listen back, then check yourself.`));
        practised();
        $("[data-audio]", box).focus();
      };
      rec.start(); secs = 0; time.textContent = `${fmt(0)} / ${fmt(MAX)}`;
      $("[data-rec]", box).hidden = true; $("[data-stop]", box).hidden = false; $("[data-stop]", box).focus();
      say("ok", t("يسجّل الآن… أجب عن السؤال.", "Recording… answer the question."));
      timer = setInterval(() => { secs++; time.textContent = `${fmt(secs)} / ${fmt(MAX)}`; if (secs >= MAX && rec && rec.state === "recording") rec.stop(); }, 1000);
    }
    $("[data-rec]", box).addEventListener("click", start);
    $("[data-stop]", box).addEventListener("click", () => { if (rec && rec.state === "recording") rec.stop(); });
    $("[data-rec-again]", box).addEventListener("click", start);
    $("[data-rec-del]", box).addEventListener("click", () => { clear(); say("ok", t("حُذف التسجيل.", "Recording deleted.")); $("[data-rec]", box).focus(); });
    window.addEventListener("pagehide", () => { if (rec && rec.state === "recording") rec.stop(); release(); if (url) URL.revokeObjectURL(url); });
  }

  /* ---------- 6. writing practice (browser only; draft kept in demo storage) ---------- */
  function renderWrite() {
    const W = DATA.writing; const box = $("[data-write]");
    const saved = store.get("writing", {}) || {};
    let pi = Number.isInteger(saved.p) ? saved.p : 0, timer = null, left = W.minutes * 60;
    const words = (s) => (String(s || "").trim().match(/\S+/g) || []).length;
    const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    const total = W.checklist.reduce((a, g) => a + g.items.length, 0);
    box.innerHTML = `
      <div class="privacy-chip" data-write-privacy><span aria-hidden="true">🔒</span> ${t(W.note.ar, W.note.en)}</div>
      <div class="speak-card"><p class="speak-q" lang="en" dir="ltr" data-write-q>${esc(W.prompts[pi])}</p><button class="btn ghost sm" type="button" data-write-next>${t("سؤال آخر", "Another question")}</button></div>
      <p class="small muted">${t(`اكتب ${W.min_words} كلمة على الأقل في نحو ${W.minutes} دقيقة.`, `Write at least ${W.min_words} words in about ${W.minutes} minutes.`)}</p>
      <div class="rec-row"><button class="btn ghost sm" type="button" data-write-timer>${t(`ابدأ مؤقت ${W.minutes} دقيقة (اختياري)`, `Start a ${W.minutes}-minute timer (optional)`)}</button><span class="rec-time" data-write-clock role="timer" aria-live="off">${fmt(left)}</span></div>
      <div class="field"><label for="w-essay">${t("مقالك (بالإنجليزية)", "Your essay (in English)")}</label>
        <textarea id="w-essay" rows="14" dir="ltr" lang="en" spellcheck="false" data-write-text>${esc(saved.text || "")}</textarea>
        <p class="small" data-write-count aria-live="polite"></p></div>
      <fieldset class="selfcheck" data-write-check><legend>${t("راجع مقالك بنفسك", "Review your own essay")}</legend>
        ${W.checklist.map((g, gi) => `<p class="small-h">${t(g.c.ar, g.c.en)}</p>${g.items.map((it, ii) => `<label class="check"><input type="checkbox" data-wc="${gi}-${ii}"${(saved.checks || []).includes(`${gi}-${ii}`) ? " checked" : ""}> <span>${t(it.ar, it.en)}</span></label>`).join("")}`).join("")}
      </fieldset>
      <p class="form-msg" role="status" aria-live="polite" data-write-msg></p>
      <p><button class="btn primary" type="button" data-write-done>${t("انتهيت من المراجعة", "I've finished reviewing")}</button></p>
      <p class="small muted">${t("ملاحظات الكتابة بمساعدة الذكاء الاصطناعي ويعتمدها معلم: قريبًا. لا نعطي درجة IELTS لهذا التمرين.", "AI-assisted feedback confirmed by a teacher: coming soon. This exercise does not give an IELTS score.")}</p>`;
    const ta = $("[data-write-text]", box); const count = $("[data-write-count]", box); const msg = $("[data-write-msg]", box);
    const checks = () => $$("[data-wc]", box).filter((c) => c.checked).map((c) => c.dataset.wc);
    const persist = () => store.set("writing", { p: pi, text: ta.value, checks: checks(), words: words(ta.value), updated: new Date().toISOString(), reviews: (store.get("writing", {}) || {}).reviews || 0 });
    const upd = () => { const n = words(ta.value); count.textContent = n >= W.min_words ? t(`${n} كلمة. وصلت إلى الحد الأدنى.`, `${n} words. You've reached the minimum.`) : t(`${n} كلمة من ${W.min_words} على الأقل.`, `${n} of at least ${W.min_words} words.`); count.classList.toggle("ok-text", n >= W.min_words); };
    let saveT = null;
    ta.addEventListener("input", () => { upd(); clearTimeout(saveT); saveT = setTimeout(persist, 400); });
    $$("[data-wc]", box).forEach((c) => c.addEventListener("change", persist));
    upd();
    $("[data-write-next]", box).addEventListener("click", () => {
      if (ta.value.trim() && !confirm(t("ستُحذف مسودتك الحالية. هل تريد المتابعة؟", "Your current draft will be cleared. Continue?"))) return;
      pi = (pi + 1) % W.prompts.length; $("[data-write-q]", box).textContent = W.prompts[pi]; ta.value = ""; $$("[data-wc]", box).forEach((c) => { c.checked = false; }); upd(); persist(); announce(W.prompts[pi]);
    });
    $("[data-write-timer]", box).addEventListener("click", (e) => {
      const clock = $("[data-write-clock]", box);
      if (timer) { clearInterval(timer); timer = null; e.target.textContent = t("تابع المؤقت", "Resume timer"); return; }
      e.target.textContent = t("أوقف المؤقت مؤقتًا", "Pause timer");
      timer = setInterval(() => { left--; clock.textContent = fmt(Math.max(0, left)); if (left <= 0) { clearInterval(timer); timer = null; clock.textContent = t("انتهى الوقت", "Time's up"); e.target.disabled = true; announce(t("انتهى الوقت.", "Time's up.")); } }, 1000);
    });
    $("[data-write-done]", box).addEventListener("click", () => {
      const n = words(ta.value);
      if (n < 50) { msg.className = "form-msg show bad"; msg.textContent = t("اكتب مقالك أولًا (50 كلمة على الأقل لبدء المراجعة).", "Write your essay first (at least 50 words to start reviewing)."); ta.focus(); return; }
      persist(); const s = store.get("writing", {}); s.reviews = (s.reviews || 0) + 1; store.set("writing", s);
      const c = checks().length; const missing = W.checklist.flatMap((g, gi) => g.items.map((it, ii) => [`${gi}-${ii}`, it])).filter(([k]) => !checks().includes(k)).slice(0, 3);
      msg.className = "form-msg show ok";
      msg.innerHTML = t(`راجعت ${c} من ${total} نقاط.`, `You checked ${c} of ${total} points.`) + (n < W.min_words ? " " + t(`مقالك ${n} كلمة، أقل من ${W.min_words}: في الاختبار الحقيقي يخسر ذلك نقاطًا.`, `Your essay has ${n} words, under ${W.min_words}: in the real test that loses marks.`) : "") + (missing.length ? `<br>${t("ابدأ تحسين مقالك بهذه:", "Start improving with these:")} ${missing.map(([, it]) => esc(t(it.ar, it.en))).join(" · ")}` : " " + t("أحسنت. أعد قراءته غدًا بعين جديدة.", "Well done. Read it again tomorrow with fresh eyes."));
      practised();
    });
  }

  /* ---------- page ---------- */
  const sec = (id, title, intro, inner) => `<section class="pr-sec box" id="${id}" aria-labelledby="${id}-title"><h2 id="${id}-title" tabindex="-1">${title}</h2>${intro ? `<p>${intro}</p>` : ""}${inner}</section>`;
  root.innerHTML = `
    ${streakBar()}
    <nav class="pr-nav" aria-label="${t("أقسام التدريب", "Practice sections")}"><a href="#daily">${t("التحدي اليومي", "Daily challenge")}</a><a href="#words">${t("المفردات", "Vocabulary")}</a><a href="#build">${t("بناء الفقرة", "Build a paragraph")}</a><a href="#revise">${t("المراجعة", "Revision")}</a><a href="#speak">${t("المحادثة", "Speaking")}</a><a href="#write">${t("الكتابة", "Writing")}</a></nav>
    <div class="visually-hidden" aria-live="polite" data-live></div>
    ${sec("daily", t("التحدي اليومي", "Daily challenge"), t("خمسة أسئلة قصيرة، تتغير كل يوم. نحو 3 دقائق.", "Five short questions that change every day. About 3 minutes."), `<div data-daily></div>`)}
    ${sec("words", t("المفردات الأكاديمية", "Academic vocabulary"), t("اسحب كل كلمة إلى معناها، أو اضغط الكلمة ثم «ضع هنا».", "Drag each word to its meaning, or tap the word and then \"Place here\"."), `<div data-match></div><p><button class="btn ghost sm" type="button" data-new-round>${t("كلمات أخرى", "Other words")}</button></p><h3>${t("أكمل الجملة", "Complete the sentence")}</h3><p class="small muted">${t("كلمتان زائدتان لا تحتاجهما.", "Two words are extra and not needed.")}</p><div data-gap></div>`)}
    ${sec("build", t(DATA.paragraph.title.ar, DATA.paragraph.title.en), t("رتّب الجمل الأربع لتصبح فقرة جيدة تجيب عن السؤال.", "Put the four sentences in order to make a good paragraph that answers the question."), `<p class="q-passage" lang="en" dir="ltr"><b>Question:</b> ${esc(DATA.paragraph.question)}</p><div data-order></div><h3>${t(DATA.sort.title.ar, DATA.sort.title.en)}</h3><div data-sort></div>`)}
    ${sec("revise", t("راجع أخطاءك", "Revise your mistakes"), t("كل خطأ في التمارين والتحدي اليومي ودروس الأسبوع الأول ودرس الاستماع يعود هنا في الوقت المناسب.", "Every mistake from practice, the daily challenge, the week 1 lessons and the listening lesson comes back here at the right time."), `<div data-revise></div>`)}
    ${sec("speak", t("تدرّب على المحادثة", "Practise speaking"), t("اقرأ السؤال، سجّل إجابتك، ثم استمع لنفسك.", "Read the question, record your answer, then listen back."), `<div data-speak></div>`)}
    ${sec("write", t("تدرّب على الكتابة: المهمة الثانية", "Practise writing: Task 2"), t("اكتب مقالًا، ثم راجعه بنفسك بقائمة مبنية على معايير الكتابة الأربعة.", "Write an essay, then review it yourself with a checklist built on the four writing criteria."), `<div data-write></div>`)}
    <p class="small muted">${t("المحتوى مسودة يراجعها معلم مؤهل. التقدم محفوظ في متصفحك فقط (نسخة تجريبية).", "Content is a draft for review by a qualified teacher. Progress is kept in your browser only (prototype).")}</p>`;
  wireBar();
  let round = 0;
  syncLesson();
  renderDaily(false); renderMatch(round); renderGap(); renderOrder(); renderSort(); renderRevise(); renderSpeak(); renderWrite();
  $("[data-new-round]").addEventListener("click", () => { round++; renderMatch(round); });
})();
