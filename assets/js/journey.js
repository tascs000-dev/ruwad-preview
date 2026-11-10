/* Learning journey v2: shared core (goal + roadmap, optional streak, mistake bank, daily key).
   Demo storage only: everything lives in this browser's localStorage under "ruwad.*". Nothing is sent.
   Loaded after app.js on start, learn, practice and dashboard pages. */
(() => {
  "use strict";
  if (!window.RUWAD) return;
  const { store, t, esc, LESSONS, AR } = window.RUWAD;
  const $ = (s, r = document) => r.querySelector(s);

  /* ---------- dates ---------- */
  // ?today=YYYY-MM-DD lets tests pin the day. Real students never see it.
  const pinned = (new URLSearchParams(location.search).get("today") || "").match(/^\d{4}-\d{2}-\d{2}$/);
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => (pinned ? pinned[0] : dayKey());
  const addDays = (key, n) => { const [y, m, d] = key.split("-").map(Number); const x = new Date(y, m - 1, d); x.setDate(x.getDate() + n); return dayKey(x); };

  /* ---------- settings + goal ---------- */
  const J = () => ({ streak: true, ...(store.get("journey", {}) || {}) });
  const setJ = (patch) => { const j = { ...J(), ...patch }; store.set("journey", j); return j; };

  /* ---------- optional streak (shares ruwad.game.days with learn.js) ---------- */
  const game = () => { const g = store.get("game", { best: {}, days: [] }) || {}; g.best = g.best || {}; g.days = g.days || []; return g; };
  const logDay = () => { const g = game(); const k = today(); if (!g.days.includes(k)) { g.days.push(k); g.days = g.days.slice(-60); store.set("game", g); } };
  const streak = () => {
    const set = new Set(game().days); let k = today();
    if (!set.has(k)) k = addDays(k, -1); // a streak stays alive until the end of today
    let n = 0; while (set.has(k)) { n++; k = addDays(k, -1); }
    return n;
  };

  /* ---------- mistake bank (Leitner boxes 0-3; box 3 = learned) ---------- */
  const GAP = [1, 2, 4]; // days until the next review after a right answer in box 0, 1, 2
  const bank = () => store.get("mistakes", {}) || {};
  function mistake(item) {
    if (!item || !item.id) return;
    const b = bank(); const old = b[item.id];
    // error_type uses the database's names (db/README.md): trap, spelling, word_limit, blank, meaning, grammar, other.
    const error_type = item.error_type || { spelling: "spelling", grammar: "grammar", vocab: "meaning", linkers: "meaning", collocations: "meaning", paragraph: "other" }[item.tag] || "other";
    b[item.id] = { ...(old || {}), ...item, error_type, box: 0, due: today(), learned: false, wrong: ((old && old.wrong) || 0) + 1, last: today(), added: (old && old.added) || today() };
    store.set("mistakes", b);
  }
  function review(id, ok) {
    const b = bank(); const m = b[id]; if (!m) return null;
    if (ok) { m.box = Math.min(3, (m.box || 0) + 1); m.learned = m.box >= 3; m.due = m.learned ? null : addDays(today(), GAP[m.box - 1] || 4); }
    else { m.box = 0; m.wrong = (m.wrong || 0) + 1; m.due = today(); m.learned = false; }
    m.reviewed = today();
    b[id] = m; store.set("mistakes", b);
    return m;
  }
  const open = () => Object.values(bank()).filter((m) => !m.learned);
  const due = () => open().filter((m) => !m.due || m.due <= today()).sort((a, b) => (b.wrong || 0) - (a.wrong || 0) || String(a.last).localeCompare(String(b.last)));
  const TAGS = {
    vocab: ["المفردات", "Vocabulary"], linkers: ["أدوات الربط", "Linking words"], collocations: ["المتلازمات اللفظية", "Word partners"],
    spelling: ["الإملاء", "Spelling"], grammar: ["القواعد", "Grammar"], paragraph: ["بناء الفقرة", "Paragraph structure"],
    listening: ["الاستماع", "Listening"], week1: ["دروس الأسبوع 1", "Week 1 lessons"],
  };
  const tagName = (k) => { const v = TAGS[k] || [k, k]; return t(v[0], v[1]); };
  const weak = () => { const c = {}; open().forEach((m) => { c[m.tag] = (c[m.tag] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]); };

  /* ---------- progress readers (read-only; other modules own these keys) ---------- */
  const lesson1 = () => store.get("lesson.ielts-listening-01", null);
  const daily = () => store.get("daily", {}) || {};
  const practice = () => store.get("practice", {}) || {};

  /* ---------- roadmap ---------- */
  const ROUTE_WEEKS = { sprint: 4, "sprint-high": 4, "sprint-support": 8, longer: 12, "other-test": 4 };
  function weeksUntil(month) {
    if (!/^\d{4}-\d{2}$/.test(month || "")) return null;
    const [y, m] = month.split("-").map(Number);
    const [ty, tm, td] = today().split("-").map(Number);
    if (y * 12 + m < ty * 12 + tm) return -1; // a past month
    // Count to the 1st of the test month (the cautious reading); this month counts as 0 weeks, not "past".
    return Math.max(0, Math.floor((new Date(y, m - 1, 1) - new Date(ty, tm - 1, td)) / (7 * 864e5)));
  }
  function timing(plan, goal) {
    const w = weeksUntil(goal.examMonth);
    if (w == null) return { kind: "none", text: t("لم تحدد موعد الاختبار بعد. لا بأس: حدده عندما تقترب من نهاية خطتك.", "No test date yet. That's fine: pick one when you near the end of your plan.") };
    const need = ROUTE_WEEKS[plan && plan.route] || 4;
    if (w < 0) return { kind: "bad", text: t("هذا الشهر مضى. اختر شهرًا قادمًا.", "That month has passed. Pick a future month.") };
    if (w < need) return { kind: "tight", text: t(`بقي نحو ${w} أسابيع، وخطتك تحتاج نحو ${need}. فكّر في موعد لاحق أو وقت دراسة أطول يوميًا. يقرر المعلم معك.`, `About ${w} weeks left, and your plan needs about ${need}. Consider a later date or more study time each day. A teacher will decide with you.`) };
    return { kind: "ok", text: t(`بقي نحو ${w} أسابيع، وخطتك تحتاج نحو ${need}. لديك وقت كافٍ إن التزمت بوقتك اليومي.`, `About ${w} weeks left, and your plan needs about ${need}. That is enough time if you keep to your daily time.`) };
  }
  function stops() {
    const plan = store.get("plan"); const goal = J().goal; const prog = store.get("learn", {}) || {};
    const l1 = lesson1(); const d = daily(); const p = practice();
    const wk = LESSONS.filter((l) => prog[l.id] && prog[l.id].done).length;
    const days = Object.keys(d).length; const openN = open().length;
    const reviewed = Object.values(bank()).filter((m) => m.reviewed).length;
    return [
      { id: "assess", n: t("حدّد مستواك", "Check your level"), d: plan ? t("تم: لديك مجموعة تسكين مبدئية.", "Done: you have a provisional placement group.") : t("25 سؤالًا، نحو 10 دقائق.", "25 questions, about 10 minutes."), done: Boolean(plan && plan.category), href: "start.html" },
      { id: "goal", n: t("هدفك وموعدك", "Your goal and date"), d: goal ? t(`${goal.minutes} دقيقة يوميًا${goal.examMonth ? `، الاختبار ${goal.examMonth}` : ""}.`, `${goal.minutes} minutes a day${goal.examMonth ? `, test in ${goal.examMonth}` : ""}.`) : t("حدد وقتك اليومي وموعد اختبارك.", "Set your daily time and test date."), done: Boolean(goal), href: "start.html#roadmap" },
      { id: "week1", n: t("دروس الأسبوع الأول", "Week 1 lessons"), d: t(`${wk} من ${LESSONS.length} مكتملة.`, `${wk} of ${LESSONS.length} done.`), done: wk === LESSONS.length, href: "learn.html" },
      { id: "listen", n: t("درس الاستماع 1", "Listening Lesson 1"), d: l1 && l1.finished ? t("تم.", "Done.") : t("فيلم قصير وتمرين استماع، 12 دقيقة.", "A short film and a listening task, 12 minutes."), done: Boolean(l1 && l1.finished), href: "lesson-listening-1.html" },
      { id: "daily", n: t("التحدي اليومي", "Daily challenge"), d: t(`5 أسئلة يوميًا. أكملت ${days} ${days === 1 ? "يومًا" : "أيام"}.`, `5 questions a day. ${days} ${days === 1 ? "day" : "days"} done.`), done: days >= 5, href: "practice.html#daily" },
      { id: "revise", n: t("راجع أخطاءك", "Revise your mistakes"), d: openN ? t(`${openN} للمراجعة.`, `${openN} to revise.`) : reviewed ? t("لا شيء الآن. أحسنت.", "Nothing right now. Well done.") : t("تُبنى من أخطائك في التمارين.", "Built from your mistakes in practice."), done: reviewed > 0 && openN === 0, href: "practice.html#revise" },
      { id: "speak", n: t("تدرّب على المحادثة", "Practise speaking"), d: t("سجّل إجابتك واستمع لها. لا يُرفع أي تسجيل.", "Record an answer and listen back. Nothing is uploaded."), done: (p.speak && p.speak.count) > 0, href: "practice.html#speak" },
      { id: "enrol", n: t("السبرنت مع معلم", "The Sprint with a teacher"), d: t("8 جلسات مباشرة. سجّل في قائمة الانتظار.", "8 live sessions. Join the waiting list."), done: false, href: "pricing.html#waitlist", planned: true },
    ];
  }
  function roadmapHtml(compact) {
    const s = stops(); const now = s.findIndex((x) => !x.done);
    const doneN = s.filter((x) => x.done).length;
    return `<ol class="roadmap${compact ? " compact" : ""}" aria-label="${t("خريطة رحلتك", "Your roadmap")}">${s.map((x, i) => `
      <li class="rm-stop ${x.done ? "done" : i === now ? "now" : "next"}" data-stop="${x.id}">
        <span class="rm-dot" aria-hidden="true">${x.done ? "✓" : i + 1}</span>
        <div><a href="${x.href}"><b>${x.n}</b></a><span class="visually-hidden"> (${x.done ? t("تم", "done") : i === now ? t("خطوتك الحالية", "your current step") : t("لاحقًا", "later")})</span>${compact ? "" : `<small>${x.d}</small>`}</div>
      </li>`).join("")}</ol>
      <p class="small muted" data-rm-count>${t(`${doneN} من ${s.length} محطات مكتملة.`, `${doneN} of ${s.length} stops done.`)}</p>`;
  }

  /* ---------- goal + roadmap step in the level check (start.html) ---------- */
  const panel = $('[data-panel="roadmap"]');
  function renderRoadmapPanel() {
    const plan = store.get("plan"); const j = J(); const g = j.goal || {};
    if (!plan) { panel.innerHTML = `<h2>${t("هدفك وخريطة رحلتك", "Your goal and roadmap")}</h2><p>${t("ابدأ بتحديد مستواك أولًا.", "Start with the level check first.")}</p><a class="btn" href="start.html">${t("ابدأ", "Start")}</a>`; return; }
    const minutes = [10, 20, 30, 45];
    panel.innerHTML = `
      <h2>${t("هدفك وخريطة رحلتك", "Your goal and roadmap")}</h2>
      <p>${t("خطوة أخيرة: متى اختبارك، وكم دقيقة يوميًا تستطيع؟ نبني منها خريطة رحلتك. تستطيع تغييرها في أي وقت.", "One last step: when is your test, and how many minutes a day can you give? We turn this into your roadmap. You can change it any time.")}</p>
      <form class="goal-form" data-goal-form novalidate>
        <div class="field"><label for="j-month">${t("شهر الاختبار (اختياري)", "Test month (optional)")}</label>
          <input id="j-month" name="examMonth" type="month" dir="ltr" value="${esc(g.examMonth || "")}" min="${today().slice(0, 7)}">
          <div class="hint">${t("اتركه فارغًا إن لم تحجز بعد.", "Leave it empty if you haven't booked yet.")}</div></div>
        <fieldset class="field"><legend>${t("كم دقيقة يوميًا؟", "How many minutes a day?")}</legend>
          <div class="options seg">${minutes.map((m) => `<label class="opt"><input type="radio" name="minutes" value="${m}"${(g.minutes || 20) === m ? " checked" : ""}><span><b>${m}</b> ${t("دقيقة", "min")}</span></label>`).join("")}</div></fieldset>
        <label class="check"><input type="checkbox" name="streak"${j.streak ? " checked" : ""}> <span>${t("أظهر عدّاد الأيام المتتالية (اختياري، تستطيع إيقافه لاحقًا)", "Show a daily streak counter (optional, you can turn it off later)")}</span></label>
        <div class="form-msg" role="status" aria-live="polite"></div>
        <button class="btn primary" type="submit">${t("احفظ وأظهر خريطتي", "Save and show my roadmap")}</button>
      </form>
      <div data-rm-out>${j.goal ? roadmapBlock(plan, j.goal) : ""}</div>`;
    const f = $("[data-goal-form]", panel);
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const month = String(fd.get("examMonth") || "");
      const msg = $(".form-msg", f);
      if (month && weeksUntil(month) < 0) { msg.className = "form-msg show bad"; msg.textContent = t("هذا الشهر مضى. اختر شهرًا قادمًا.", "That month has passed. Pick a future month."); return; }
      const goal = { examMonth: month, minutes: Number(fd.get("minutes") || 20), set: today() };
      setJ({ goal, streak: fd.get("streak") === "on" });
      msg.className = "form-msg show ok"; msg.textContent = t("حُفظ هدفك.", "Your goal is saved.");
      $("[data-rm-out]", panel).innerHTML = roadmapBlock(plan, goal);
      const h = $("[data-rm-out] h3", panel); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: false }); }
    });
  }
  function roadmapBlock(plan, goal) {
    const tm = timing(plan, goal);
    return `<h3>${t("خريطة رحلتك", "Your roadmap")}</h3>
      <p class="rm-timing ${tm.kind}" data-timing="${tm.kind}">${tm.text}</p>
      <p class="small muted">${t(`${goal.minutes} دقيقة يوميًا تساوي نحو ${Math.round((goal.minutes * 6) / 60 * 10) / 10} ساعات أسبوعيًا (6 أيام). هذه خطة تدريب، وليست توقعًا لدرجتك.`, `${goal.minutes} minutes a day is about ${Math.round((goal.minutes * 6) / 60 * 10) / 10} hours a week (6 days). This is a practice plan, not a prediction of your score.`)}</p>
      ${roadmapHtml(false)}
      <p class="rm-go"><a class="btn primary" href="${stops().find((x) => !x.done)?.href || "practice.html"}">${t("ابدأ خطوتك التالية", "Start your next step")}</a> <a class="btn ghost" href="practice.html">${t("التدريب اليومي", "Daily practice")}</a></p>`;
  }
  if (panel) {
    document.addEventListener("click", (e) => {
      const go = e.target.closest("[data-go-roadmap]"); if (!go) return;
      e.preventDefault(); renderRoadmapPanel();
      if (window.RUWAD.flow) window.RUWAD.flow.show("roadmap");
    });
    // Coming back from the dashboard (start.html#roadmap) with a saved plan opens the step directly.
    if (location.hash === "#roadmap" && store.get("plan") && window.RUWAD.flow) { renderRoadmapPanel(); window.RUWAD.flow.show("roadmap"); }
  }

  /* ---------- dashboard: today + roadmap ---------- */
  const dash = $("[data-dash] .dash");
  if (dash) {
    const j = J(); const d = daily()[today()]; const n = due().length; const w = weak()[0];
    const box = document.createElement("div");
    box.className = "box wide today-box"; box.setAttribute("data-today", "");
    box.innerHTML = `<h2>${t("اليوم", "Today")}</h2>
      <ul class="today-list">
        <li><b>${t("التحدي اليومي", "Daily challenge")}</b> <span class="pill${d ? " done" : ""}" data-today-daily>${d ? t(`تم: ${d.r} من ${d.n}`, `Done: ${d.r} of ${d.n}`) : t("لم يبدأ", "Not started")}</span> <a class="small" href="practice.html#daily">${d ? t("تدرّب مجددًا", "Practise again") : t("ابدأ", "Start")}</a></li>
        <li><b>${t("مراجعة الأخطاء", "Mistake revision")}</b> <span class="pill${n ? "" : " done"}" data-today-due>${n ? t(`${n} للمراجعة`, `${n} to revise`) : t("لا شيء الآن", "Nothing due")}</span>${n ? ` <a class="small" href="practice.html#revise">${t("راجع", "Revise")}</a>` : ""}</li>
        ${w ? `<li><b>${t("أضعف نقطة الآن", "Weakest area now")}</b> <span>${tagName(w[0])}</span></li>` : ""}
        ${j.streak ? `<li><b>${t("الأيام المتتالية", "Streak")}</b> <span data-today-streak>${streak()}</span></li>` : ""}
      </ul>
      <h3 class="small-h">${t("خريطة رحلتك", "Your roadmap")}</h3>
      ${roadmapHtml(true)}
      <p class="small"><a href="start.html#roadmap">${j.goal ? t("عدّل هدفك", "Edit your goal") : t("حدد هدفك وموعدك", "Set your goal and date")}</a></p>`;
    dash.insertBefore(box, dash.children[1] || null);
  }

  window.RUWAD.journey = { today, addDays, J, setJ, logDay, streak, mistake, review, due, open, weak, tagName, bank, daily, practice, stops, roadmapHtml, timing, weeksUntil };
})();
