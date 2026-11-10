/* Ruwad prototype behaviour. Prototype only: all data stays in this browser's localStorage. */
(() => {
  "use strict";
  const AR = document.documentElement.lang === "ar";
  const t = (ar, en) => (AR ? ar : en);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get: (k, d = null) => { try { const v = localStorage.getItem("ruwad." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem("ruwad." + k, JSON.stringify(v)); } catch {} },
    del: (k) => { try { localStorage.removeItem("ruwad." + k); } catch {} },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const KSA_MOBILE = /^(?:\+?966|0)5\d{8}$/;

  // Week 1 lesson index, shared with learn.js and the dashboard.
  const LESSONS = [
    { id: "test-map", ar: "خريطة الاختبار", en: "The test map" },
    { id: "band6", ar: "كيف تبدو الدرجة 6؟", en: "What Band 6 looks like" },
    { id: "task2-types", ar: "أنواع أسئلة المهمة الثانية", en: "Task 2 question types" },
    { id: "thesis", ar: "الأطروحة وخطة الخمس دقائق", en: "Thesis and the five-minute plan" },
    { id: "listening", ar: "الاستماع: التوقع والفخاخ", en: "Listening: prediction and traps" },
    { id: "speaking1", ar: "المحادثة: الجزء الأول", en: "Speaking Part 1" },
    { id: "w1", ar: "المهمة المصححة W1: مقال", en: "Graded task W1: essay" },
  ];
  window.RUWAD = { store, t, esc, LESSONS, AR };

  /* ---------- header ---------- */
  const menu = $(".menu-btn");
  if (menu) menu.addEventListener("click", () => {
    const open = $("#nav").classList.toggle("open");
    menu.setAttribute("aria-expanded", String(open));
  });
  const session = store.get("session");
  $$("[data-auth]").forEach((el) => { el.hidden = (el.dataset.auth === "in") !== Boolean(session); });

  /* ---------- home route widget ---------- */
  const route = $("[data-route]");
  if (route) {
    const msg = {
      gdp: t('في الإعلانات الرسمية التي راجعناها كان <b>IELTS</b> مقبولًا في كل مرة يُذكر فيها اختبار، بدرجات من 5.5 إلى 6.5. <a href="gdp-requirements.html">الجدول ومصادره</a>', 'In the official postings we checked, <b>IELTS</b> was accepted every time a test was named, at 5.5 to 6.5. <a href="gdp-requirements.html">See the table and sources</a>'),
      job: t("يعتمد على جهة العمل: بعضها يطلب IELTS أو STEP، وكثير من الشركات الكبرى تختبر الإنجليزية بنفسها في المقابلة. <b>نحدده معك.</b>", "It depends on the employer: some ask for IELTS or STEP, and many large firms test English themselves at interview. <b>We pin it down with you.</b>"),
      study: t("IELTS الأكاديمي أو TOEFL iBT غالبًا، حسب الجامعة وبلد الدراسة. <b>نتحقق من شروط القبول.</b>", "Usually IELTS Academic or TOEFL iBT, depending on the university and country. <b>We check the admission rules.</b>"),
    };
    $$("[data-goal]", route).forEach((b) => b.addEventListener("click", () => {
      $$("[data-goal]", route).forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      $("[data-route-test]", route).innerHTML = msg[b.dataset.goal];
      $('[data-stop="1"]', route).classList.add("done");
      $('[data-stop="2"]', route).classList.add("done");
      $("[data-route-go]", route).href = "start.html?goal=" + b.dataset.goal;
    }));
  }

  /* ---------- form helpers ---------- */
  function validate(form) {
    let ok = true;
    $$("input, select, textarea", form).forEach((el) => {
      const f = el.closest(".field");
      if (!f) return;
      let bad = false;
      if (el.required) bad = el.type === "checkbox" ? !el.checked : !el.value.trim();
      if (!bad && el.type === "email" && el.value) bad = !EMAIL.test(el.value.trim());
      if (!bad && "contact" in el.dataset && el.value) { const v = el.value.replace(/[\s-]/g, ""); bad = !(EMAIL.test(v) || KSA_MOBILE.test(v)); }
      if (!bad && el.minLength > 0 && el.value && el.value.length < el.minLength) bad = true;
      f.classList.toggle("invalid", bad);
      el.setAttribute("aria-invalid", String(bad));
      if (bad && ok) { el.focus(); ok = false; }
    });
    return ok;
  }
  function say(form, kind, text) {
    const m = $(".form-msg", form);
    m.className = "form-msg show " + kind;
    m.textContent = text;
  }
  const data = (form) => Object.fromEntries(new FormData(form).entries());

  const ENDPOINT = (window.RUWAD_CONFIG || {}).formEndpoint;

  /* ---------- funnel events (first-party, no cookies, no identifiers) ----------
     Each event carries only: event name, page, language and mobile/desktop. Counts also
     stay in this browser (ruwad.events) so the prototype can show them. */
  const DEVICE = window.matchMedia && matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop";
  const EVENTS = ["page_view", "cta_level_check", "cta_waitlist", "placement_start", "placement_complete", "waitlist_submit", "register", "lesson_complete", "taster_start", "taster_complete"];
  function track(event) {
    if (!EVENTS.includes(event)) return;
    const page = document.body.dataset.page || "";
    const counts = store.get("events", {});
    const k = `${event}|${page}|${DEVICE}`;
    counts[k] = (counts[k] || 0) + 1;
    store.set("events", counts);
    if (ENDPOINT) {
      try { fetch(ENDPOINT, { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "event", event, page, lang: AR ? "ar" : "en", device: DEVICE }) }).catch(() => {}); } catch {}
    }
  }
  window.RUWAD.track = track;
  track("page_view");
  $$("[data-track]").forEach((a) => a.addEventListener("click", () => track(a.dataset.track)));

  /* ---------- lead forms (waitlist, contact) ---------- */
  $$('[data-form="waitlist"], [data-form="contact"]').forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!validate(form)) return;
      const d = data(form);
      if (d.website) return; // honeypot: bots fill hidden fields
      if (form.dataset.form === "waitlist") track("waitlist_submit");
      const contact = (d.contact || d.email || "").replace(/[\s-]/g, "").toLowerCase();
      const leads = store.get("leads", []);
      leads.push({
        type: form.dataset.form, name: d.name.trim(), contact,
        programme: d.programme || "", test: d.test || "", testDate: d.testDate || "", plan: d.plan || "", topic: d.topic || "", placement_id: (store.get("plan") || {}).id || "",
        consent: true, source: location.pathname, lang: AR ? "ar" : "en", at: new Date().toISOString(),
      });
      if (ENDPOINT) {
        const btn = $("button[type=submit]", form); btn.disabled = true;
        try {
          const r = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...leads[leads.length - 1], message: d.message || "" }) });
          if (!r.ok) throw new Error(String(r.status));
        } catch {
          btn.disabled = false;
          say(form, "bad", t("تعذر الإرسال الآن. تحقق من اتصالك وحاول مرة أخرى.", "Couldn't send right now. Check your connection and try again."));
          return;
        }
        btn.disabled = false;
        form.reset();
        say(form, "ok", form.dataset.form === "waitlist" ? t("أنت الآن في قائمة الانتظار. سنتواصل معك قبل فتح التسجيل.", "You're on the waiting list. We'll be in touch before enrolment opens.") : t("وصلتنا رسالتك، وسنرد خلال يومي عمل.", "Message received. We'll reply within two working days."));
        return;
      }
      store.set("leads", leads);
      form.reset();
      say(form, "ok", form.dataset.form === "waitlist"
        ? t("أنت الآن في قائمة الانتظار. سنتواصل معك قبل فتح التسجيل. (نسخة تجريبية: حُفظ في متصفحك فقط)", "You're on the waiting list. We'll be in touch before enrolment opens. (Prototype: saved in your browser only)")
        : t("وصلتنا رسالتك. (نسخة تجريبية: حُفظت في متصفحك فقط)", "Message received. (Prototype: saved in your browser only)"));
    });
  });
  $$("[data-plan]").forEach((a) => a.addEventListener("click", () => { const s = $("#w-plan"); if (s) s.value = a.dataset.plan; }));
  if ($("#w-test")) {
    const q = new URLSearchParams(location.search);
    if (q.get("course")) $("#w-test").value = q.get("course");
    const plan = store.get("plan");
    if (plan && plan.org && $("#w-prog")) $("#w-prog").value = plan.org;
  }
  $$("a[data-course]").forEach((a) => { a.href = "pricing.html?course=" + a.dataset.course + "#waitlist"; });

  /* ---------- register / login ---------- */
  const reg = $('[data-form="register"]');
  if (reg) reg.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate(reg)) return;
    const d = data(reg);
    const email = d.email.trim().toLowerCase();
    const users = store.get("users", {});
    if (users[email]) { say(reg, "bad", t("هذا البريد مسجل مسبقًا. سجّل الدخول بدلًا من ذلك.", "This email is already registered. Log in instead.")); return; }
    users[email] = { name: d.name.trim(), email, status: d.status, created: new Date().toISOString() };
    store.set("users", users);
    store.set("session", { email });
    track("register");
    location.href = "dashboard.html";
  });
  const login = $('[data-form="login"]');
  if (login) login.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate(login)) return;
    const email = data(login).email.trim().toLowerCase();
    if (!store.get("users", {})[email]) { say(login, "bad", t("لا يوجد حساب بهذا البريد في هذا المتصفح. أنشئ حسابًا أولًا.", "No account with this email in this browser. Create an account first.")); return; }
    store.set("session", { email });
    location.href = "dashboard.html";
  });

  /* ---------- placement check + plan ---------- */
  // Items from ruwad/academic/03-placement-test.md v1 (original, uncalibrated). Parts A and B only;
  // listening (needs a recording) and writing (teacher-marked) are done before enrolment.
  const TARGETS = {
    ielts: ["5.5", "6.0", "6.5", "7.0+"],
    step: ["70–79", "80–89", "90+"],
    toefl: [t("حسب مقياس ETS الحالي", "On the current ETS scale")],
    unsure: [t("لا أعرف بعد", "Not sure yet")],
  };
  const PASSAGE = `<h3>Learning on the move</h3>
<p>Over the past decade, mobile phones have become one of the most common tools for learning a language. Surveys in several countries suggest that a large share of adult learners now use a language app at least once a week, often during short breaks such as a commute or a wait at a clinic. Supporters argue that this "micro-learning" fits modern life: lessons last only a few minutes, progress is shown with points and streaks, and learners can study without paying for a classroom.</p>
<p>However, researchers have raised questions about how much these apps actually achieve. One common criticism is that many apps focus on recognising single words rather than producing longer sentences. A learner may remember that a word means "library" but still be unable to ask for directions to one. Speaking and writing, which require learners to build their own sentences, are also difficult to practise without feedback from another person.</p>
<p>There is also the question of motivation. Points and streaks can encourage learners to open an app every day, but some studies indicate that learners begin to care more about keeping a streak than about learning. When the streak is broken, a number of users stop using the app altogether.</p>
<p>Not all experts are critical. Several language teachers argue that apps work best as a supplement to, rather than a replacement for, structured courses. In this "blended" approach, learners use short app sessions to review vocabulary and grammar, while class time is saved for speaking, writing and receiving feedback. Teachers who use this model report that students arrive at lessons better prepared and spend less class time on basic revision.</p>
<p>The future of mobile learning may therefore depend less on the technology itself than on how it is combined with human teaching. As one teacher put it, "An app can remind you to practise, but it cannot tell you why your essay is unclear."</p>`;
  const TFNG = ["TRUE", "FALSE", "NOT GIVEN"];
  const QUIZ = [
    { q: "She has worked at the bank ___ 2022.", o: ["for", "since", "from", "in"], a: 1 },
    { q: "If I ___ more time, I would take an evening course.", o: ["have", "had", "will have", "would have"], a: 1 },
    { q: "The report ___ by the manager yesterday.", o: ["was approved", "approved", "has approved", "is approving"], a: 0 },
    { q: "There has been a sharp ___ in the number of online applicants.", o: ["rise", "raise", "rising", "arise"], a: 0 },
    { q: "Neither the students nor the teacher ___ aware of the change.", o: ["were", "was", "are", "be"], a: 1 },
    { q: "Despite ___ hard, he did not pass the interview.", o: ["he studied", "studying", "to study", "studied"], a: 1 },
    { q: "The company is looking for graduates ___ can work in a team.", o: ["which", "whose", "who", "whom"], a: 2 },
    { q: "Unemployment fell ___ 8% to 6% over the period.", o: ["between", "from", "by", "at"], a: 1 },
    { q: "Choose the most formal word: \"We need to ___ the problem.\"", o: ["sort out", "fix up", "address", "deal"], a: 2 },
    { q: "By the time we arrived, the presentation ___.", o: ["already started", "has already started", "had already started", "was already start"], a: 2 },
    { q: "___ the cost is high, many families still choose private schools.", o: ["Because", "Although", "Unless", "Therefore"], a: 1 },
    { q: "Which sentence is correct?", o: ["The informations are useful.", "The information is useful.", "An information is useful.", "The informations is useful."], a: 1 },
    { q: "Online learning gives students more ___ to study at their own pace.", o: ["flexibility", "flexible", "flexibly", "flex"], a: 0 },
    { q: "The new policy will have a significant ___ on small businesses.", o: ["affect", "effect", "effective", "affection"], a: 1 },
    { q: "Hardly ___ the meeting started when the power went out.", o: ["had", "has", "did", "was"], a: 0 },
    { p: true, q: "True, False or Not Given: Many adult learners use language apps during short gaps in their day.", o: TFNG, a: 0 },
    { p: true, q: "True, False or Not Given: Most language apps are more expensive than classroom courses.", o: TFNG, a: 2 },
    { p: true, q: "True, False or Not Given: Apps generally help learners produce long sentences better than they help them recognise single words.", o: TFNG, a: 1 },
    { p: true, q: "True, False or Not Given: Some learners stop using an app when they lose their streak.", o: TFNG, a: 0 },
    { p: true, q: "True, False or Not Given: Language apps are more popular with women than with men.", o: TFNG, a: 2 },
    { p: true, q: "According to the passage, why is it hard to practise speaking and writing with apps?", o: ["Apps do not include these skills.", "Learners need feedback from another person.", "These skills take too long.", "Apps are designed only for beginners."], a: 1 },
    { p: true, q: "What do teachers who use the blended approach report?", o: ["Students need more revision in class.", "Students prefer apps to classes.", "Students come to class better prepared.", "Students stop using apps."], a: 2 },
    { p: true, q: "What is the writer's main point in the final paragraph?", o: ["Technology will replace teachers.", "The way apps are combined with teaching matters most.", "Apps cannot help with essays at all.", "Mobile learning has no future."], a: 1 },
    { p: true, gap: true, q: "Complete with NO MORE THAN TWO WORDS from the passage: Short lessons that fit into modern life are sometimes called ______.", a: ["micro-learning", "microlearning", "micro learning"] },
    { p: true, gap: true, q: "Complete with NO MORE THAN TWO WORDS from the passage: In the blended approach, class time is kept for speaking, writing and receiving ______.", a: ["feedback"] },
  ];
  const norm = (s) => String(s || "").trim().toLowerCase().replace(/[.\s]+$/, "").replace(/\s+/g, " ");
  const isRight = (q, ans) => (q.gap ? q.a.includes(norm(ans)) : ans === q.a);

  // Placement groups come from place() in scoring.mjs, the single implementation owned by Academic
  // (ruwad/academic/placement/scoring.mjs, copied by the build). Online = parts A + B only, so the
  // result is always provisional. Uncalibrated, for grouping only: never shown as a band or a score.
  const scoringUrl = () => new URL("scoring.mjs", ($('script[src$="js/app.js"]') || {}).src || location.href).href;
  const WRITING_PROMPT = "Some people say that the best way to improve your English is to live in an English-speaking country. Do you agree or disagree? Give reasons for your answer.";
  const WRITING_MIN = 60;
  const words = (s) => (String(s || "").trim().match(/\S+/g) || []).length;
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  const post = (body) => { if (!ENDPOINT) return; try { fetch(ENDPOINT, { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => {}); } catch {} };
  const CAT = {
    F: [t("المجموعة <bdi>F</bdi> (تأسيس)", "Group F (foundation)"), t("الأفضل أن تبدأ بمسار تأسيسي قبل السبرنت. سنقترح عليك خطة أطول بعد مراجعة معلم لكتابتك واستماعك.", "A foundation route before the Sprint is the better start. We'll suggest a longer plan after a teacher reviews your writing and listening.")],
    B: [t("المجموعة <bdi>B</bdi> (على الحد)", "Group B (borderline)"), t("قد تناسبك الدورة مع خطة دعم، أو مسار أطول قليلًا. يقرر المعلم ذلك معك بعد جزأي الكتابة والاستماع.", "The course may suit you with a support plan, or a slightly longer route. A teacher decides this with you after the writing and listening parts.")],
    S: [t("المجموعة <bdi>S</bdi> (السبرنت)", "Group S (Sprint)"), t("نتيجتك في النطاق الذي صُممت له الدورة.", "Your result is in the range the course is designed for.")],
    "S+": [t("المجموعة <bdi>S+</bdi> (متقدم)", "Group S+ (stretch)"), t("قد تحتاج تدريبًا على الأسلوب والوقت فقط. السبرنت مع مهام إضافية أو الباقة الذاتية قد تناسبك.", "You may only need technique and timing practice. The Sprint with stretch tasks, or the self-paced option, may suit you.")],
  };
  const DISCLAIMER = t("هذه نتيجة اختبار تحديد مستوى داخلي جديد لا يزال قيد المعايرة. هي لترتيب المجموعات فقط، وليست درجة IELTS ولا توقعًا موثوقًا لدرجتك.", "This is an internal placement result from a new test that is still being calibrated. It is for grouping only. It is not an IELTS band and not a reliable prediction of your score.");
  const SKILL = { grammar_vocabulary: t("القواعد والمفردات", "Grammar and vocabulary"), reading: t("القراءة", "Reading"), listening: t("الاستماع", "Listening"), writing: t("الكتابة", "Writing") };
  function notes(p) {
    if (p.partA == null) return "";
    const n = p.note || { strengths: [], workOn: [] };
    const wrote = p.writing && p.writing.text;
    const notYet = [t("الاستماع (قريبًا)", "listening (coming soon)"), wrote ? t("الكتابة (بانتظار قراءة المعلم)", "writing (waiting for a teacher to read it)") : t("الكتابة", "writing"), t("المحادثة", "speaking")];
    return `<ul class="prose small">
      ${n.strengths.length ? `<li><b>${t("نقاط قوة:", "Strengths:")}</b> ${n.strengths.map((k) => SKILL[k]).join(t("، ", ", "))}</li>` : ""}
      ${n.workOn.length ? `<li><b>${t("تحتاج عملًا:", "Work on:")}</b> ${n.workOn.map((k) => SKILL[k]).join(t("، ", ", "))}</li>` : ""}
      <li><b>${t("لم يُقيّم بعد:", "Not checked yet:")}</b> ${notYet.join(t("، ", ", "))}</li>
    </ul>`;
  }
  function provisionalNote(p) {
    const wrote = p.writing && p.writing.text;
    return `<div class="note" data-provisional><p><b>${t("نتيجة مبدئية.", "Provisional result.")}</b> ${wrote
      ? t("وصلتنا كتابتك. تبقى النتيجة مبدئية حتى يقرأها معلم وتُضاف مهمة الاستماع، ولا يُتخذ قرار تسجيل قبل ذلك.", "We have your writing. The result stays provisional until a teacher reads it and the listening part is added. No enrolment decision is made before then.")
      : t("لم تكتب المهمة القصيرة بعد. يحتاج المعلم إليها قبل أي قرار تسجيل، ويمكنك كتابتها لاحقًا بإعادة الاختبار.", "You skipped the short writing task. A teacher needs it before any enrolment decision; you can add it later by taking the check again.")}</p></div>`;
  }
  const SPRINT_WEEKS = [
    t("اعرف الاختبار وابنِ المقال", "Know the test, build the essay"),
    t("المهمة الأولى والقراءة والمحادثة", "Task 1, reading and speaking"),
    t("الترابط والقراءة والنقاش", "Cohesion, reading and discussion"),
    t("تدريب بالوقت واختبار تجريبي وخطة", "Timed practice, mock and plan"),
  ];
  const testLabel = (k) => ({ step: "STEP", ielts: "IELTS", toefl: "TOEFL iBT", unsure: t("لم يُحدد بعد", "Not decided yet") }[k]);

  function buildPlan(goal, score, parts, res, writing) {
    const cat = res.group;
    let routeName = "sprint";
    if (goal.test === "step" || goal.test === "toefl") routeName = "other-test";
    else if (cat === "F") routeName = "longer";
    else if (cat === "B") routeName = "sprint-support";
    else if (goal.targetLabel === "7.0+") routeName = "sprint-high";
    return { ...goal, ...parts, score, total: QUIZ.length, category: cat, route: routeName, provisional: true, note: res.note, writing, id: newId(), created: new Date().toISOString() };
  }

  function planSteps(p) {
    const wk = (a, b) => (a === b ? t(`الأسبوع ${a}`, `Week ${a}`) : t(`الأسابيع ${a}–${b}`, `Weeks ${a}–${b}`));
    const sprint = (from) => SPRINT_WEEKS.map((w, i) => [wk(from + i, from + i), t("السبرنت: ", "Sprint: ") + w]);
    switch (p.route) {
      case "sprint":
      case "sprint-high":
        return [...sprint(1), [t("بعدها", "After"), t("احجز اختبارك الرسمي خلال أسابيع قليلة من انتهاء الدورة.", "Book your official test within a few weeks of finishing.")]];
      case "sprint-support":
        return [[wk(1, 4), t("تأسيس ذاتي: القواعد الأكثر ورودًا ومفردات أكاديمية وتمارين قراءة قصيرة.", "Self-paced foundation: most-tested grammar, academic vocabulary and short reading practice.")], ...sprint(5)];
      case "longer":
        return [[t("أولًا", "First"), t("مراجعة معلم لجزأي الكتابة والاستماع لتحديد نقطة البداية بدقة.", "A teacher reviews your writing and listening to pin down your starting point.")], [t("ثم", "Then"), t("مسار تأسيسي يحدد طوله المعلم بحسب وقتك.", "A foundation route, its length set by the teacher around your time.")], [t("بعدها", "After"), t("السبرنت عندما تصبح جاهزًا.", "The Sprint when you're ready.")]];
      default:
        return [[t("ملاحظة", "Note"), t(`دورتنا الأولى لـ IELTS. إذا كان برنامجك يقبل IELTS (أغلب البرامج تقبله) فقد يكون خيارًا مناسبًا، وإلا سجّل اهتمامك بدورة ${testLabel(p.test)} الذاتية.`, `Our first course is for IELTS. If your programme accepts IELTS (most do), it may suit you; otherwise register interest in the ${testLabel(p.test)} self-paced course.`)]];
    }
  }

  function planHtml(p, forDash) {
    const [label, why] = CAT[p.category] || CAT.B;
    return `
      <p class="muted">${t("مجموعة التسكين", "Placement group")}</p>
      <p class="result-level">${label}</p>
      <p>${why}</p>
      ${notes(p)}
      ${provisionalNote(p)}
      <div class="note"><p>${DISCLAIMER}</p></div>
      <p class="small muted">${t(`هدفك: ${esc(testLabel(p.test))} ${esc(p.targetLabel)}${p.orgName ? `، ${esc(p.orgName)}` : ""}.`, `Your target: ${esc(testLabel(p.test))} ${esc(p.targetLabel)}${p.orgName ? `, ${esc(p.orgName)}` : ""}.`)}</p>
      ${p.route === "sprint-high" ? `<div class="note"><p>${t("السبرنت يستهدف 6 إلى 6.5. لهدف 7 فأعلى سيقترح المعلم خطة إضافية بعد المراجعة.", "The Sprint aims at 6 to 6.5. For a target of 7 or higher, the teacher will suggest extra work after review.")}</p></div>` : ""}
      <h3>${t("خطتك المقترحة", "Your suggested plan")}</h3>
      <ol class="plan-weeks">${planSteps(p).map(([w, d]) => `<li><b>${w}</b><div>${d}</div></li>`).join("")}</ol>
      <p class="small muted">${t(`بمعدل ${p.hours} ساعات أسبوعيًا. يراجع معلم مؤهل جزأي الكتابة والاستماع قبل أي تسجيل.`, `At ${p.hours} hours a week. A qualified teacher reviews a writing and listening task before anyone enrols.`)}</p>
      ${forDash ? "" : `<p style="margin-top:1.5rem"><a class="btn primary" href="start.html#roadmap" data-go-roadmap>${t("التالي: هدفك وخريطة رحلتك", "Next: your goal and roadmap")}</a></p>
      <div class="flow-nav" style="margin-top:1rem">
        <a class="btn ghost" href="start.html">${t("أعد المحاولة", "Start again")}</a>
        <span style="display:flex;gap:.75rem;flex-wrap:wrap">
          <a class="btn ghost" href="${p.route === "other-test" ? "courses.html" : "pricing.html?course=IELTS#waitlist"}">${t("انضم إلى قائمة الانتظار", "Join the waiting list")}</a>
          <a class="btn" href="${store.get("session") ? "dashboard.html" : "register.html"}">${store.get("session") ? t("اذهب إلى لوحتي", "Go to my dashboard") : t("أنشئ حسابًا لحفظ خطتك", "Create an account to save your plan")}</a>
        </span></div>
      <form class="box calib" data-calib novalidate style="margin-top:1.5rem">
        <h3>${t("ساعدنا في تحسين الاختبار (اختياري)", "Help us improve the test (optional)")}</h3>
        <fieldset><legend>${t("هل لديك نتيجة IELTS رسمية من آخر 6 أشهر؟", "Do you have an official IELTS result from the last 6 months?")}</legend>
          <div class="options"><label class="opt"><input type="radio" name="has" value="no"><span>${t("لا", "No")}</span></label><label class="opt"><input type="radio" name="has" value="yes"><span>${t("نعم", "Yes")}</span></label></div></fieldset>
        <div data-calib-more hidden>
          <div class="field"><label for="c-band">${t("النتيجة الكلية", "Overall result")}</label><select id="c-band" name="band"><option value="">${t("اختر", "Choose")}</option>${[4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map((b) => `<option value="${b.toFixed(1)}">${b.toFixed(1)}</option>`).join("")}</select></div>
          <div class="field"><label for="c-month">${t("شهر الاختبار", "Month of the test")}</label><input id="c-month" name="month" type="month" dir="ltr"></div>
        </div>
        <p class="small muted">${t("نستخدم هذه الإجابة داخليًا فقط لمعايرة الاختبار، ولا تُعرض عليك ولا تغيّر مجموعتك.", "We use this only internally to calibrate the test. It is not shown to you and does not change your group.")}</p>
        <div class="form-msg" role="status" aria-live="polite"></div>
        <button class="btn ghost sm" type="submit">${t("أرسل", "Send")}</button>
      </form>`}`;
  }

  const flow = $("[data-flow]");
  if (flow) {
    const goalForm = $('[data-panel="goal"]', flow);
    const quizEl = $('[data-panel="quiz"]', flow);
    const planEl = $('[data-panel="plan"]', flow);
    const writeEl = $('[data-panel="write"]', flow);
    const scoring = import(scoringUrl());
    const testSel = $("#g-test"), targetSel = $("#g-target"), orgSel = $("#g-org");
    const fillTargets = (pick) => {
      const list = TARGETS[testSel.value];
      targetSel.innerHTML = list.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
      targetSel.value = pick && list.includes(pick) ? pick : list[Math.min(1, list.length - 1)];
    };
    testSel.addEventListener("change", () => fillTargets());
    orgSel.addEventListener("change", () => {
      const o = orgSel.selectedOptions[0];
      const hint = $("[data-org-req]");
      if (o.dataset.test) {
        testSel.value = o.dataset.test; fillTargets(o.dataset.target);
        hint.innerHTML = t(`المتطلب كما ورد: <b>${esc(o.dataset.req)}</b>. <a href="gdp-requirements.html">المصدر</a>`, `Requirement as written: <b>${esc(o.dataset.req)}</b>. <a href="gdp-requirements.html">Source</a>`);
      }
    });
    fillTargets();
    const qGoal = new URLSearchParams(location.search).get("goal");
    if (qGoal) { const r = $(`input[name="goal"][value="${CSS.escape(qGoal)}"]`, goalForm); if (r) r.checked = true; }

    const show = (name) => {
      [goalForm, quizEl, writeEl, planEl, $('[data-panel="roadmap"]', flow)].forEach((p) => { if (p) p.hidden = p.dataset.panel !== name; });
      const order = ["goal", "quiz", "write", "plan", "roadmap"];
      $$("[data-prog]", flow).forEach((li) => li.classList.toggle("on", order.indexOf(li.dataset.prog) <= order.indexOf(name)));
      const h = $(`[data-panel="${name}"] h2`, flow); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
      flow.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    window.RUWAD.flow = { show }; // journey.js adds the goal + roadmap step after the plan

    let goal = null, answers = [], idx = 0;
    goalForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const d = data(goalForm);
      if (!d.goal) { say(goalForm, "bad", t("اختر هدفك للمتابعة.", "Choose your goal to continue.")); return; }
      $(".form-msg", goalForm).className = "form-msg bad";
      goal = { goal: d.goal, org: d.org, orgName: d.org ? orgSel.selectedOptions[0].textContent : "", test: d.test, targetLabel: d.target, hours: Number(d.hours) };
      answers = new Array(QUIZ.length).fill(null); idx = 0;
      renderQ(); show("quiz"); track("placement_start");
    });

    function renderQ() {
      const q = QUIZ[idx];
      const part = q.p ? t("الجزء ب: القراءة", "Part B: Reading") : t("الجزء أ: القواعد والمفردات", "Part A: Grammar and vocabulary");
      const answered = q.gap ? norm(answers[idx]) !== "" : answers[idx] !== null;
      quizEl.innerHTML = `
        <h2>${t("تحديد المستوى", "Level check")}</h2>
        <p class="q-count">${part}. ${t(`السؤال ${idx + 1} من ${QUIZ.length}`, `Question ${idx + 1} of ${QUIZ.length}`)}</p>
        <div class="meter" aria-hidden="true"><i style="width:${(idx / QUIZ.length) * 100}%"></i></div>
        ${q.p ? `<details class="q-passage" lang="en" dir="ltr" open><summary>Passage</summary>${PASSAGE}</details>` : ""}
        ${q.gap
          ? `<div class="field" dir="ltr" lang="en"><label class="q-text" for="gap">${esc(q.q)}</label><input id="gap" autocomplete="off" value="${esc(answers[idx] || "")}"></div>`
          : `<fieldset><legend class="q-text" lang="en">${esc(q.q)}</legend>
        <div class="options q-options">${q.o.map((o, i) => `<label class="opt" lang="en"><input type="radio" name="ans" value="${i}"${answers[idx] === i ? " checked" : ""}><span>${esc(o)}</span></label>`).join("")}</div></fieldset>`}
        <div class="flow-nav">
          <button class="btn ghost" type="button" data-back>${t("السابق", "Back")}</button>
          <button class="btn" type="button" data-next ${answered ? "" : "disabled"}>${idx === QUIZ.length - 1 ? t("اعرض نتيجتي", "Show my result") : t("التالي", "Next")}</button>
        </div>`;
      const next = $("[data-next]", quizEl);
      if (q.gap) {
        const inp = $("#gap", quizEl);
        inp.addEventListener("input", () => { answers[idx] = inp.value; next.disabled = norm(inp.value) === ""; });
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !next.disabled) next.click(); });
      } else {
        $$('input[name="ans"]', quizEl).forEach((r) => r.addEventListener("change", () => { answers[idx] = Number(r.value); next.disabled = false; }));
      }
      $("[data-back]", quizEl).addEventListener("click", () => { if (idx === 0) show("goal"); else { idx--; renderQ(); } });
      next.addEventListener("click", () => {
        if (idx < QUIZ.length - 1) { idx++; renderQ(); return; }
        const right = answers.map((a, i) => (isRight(QUIZ[i], a) ? 1 : 0));
        const score = right.reduce((s, v) => s + v, 0);
        const partA = right.slice(0, 15).reduce((s, v) => s + v, 0);
        renderWrite(score, partA);
      });
    }

    // Optional Part D: saved for a teacher to mark with the rubric; never scored in the browser.
    let timer = null;
    function renderWrite(score, partA) {
      writeEl.innerHTML = `
        <h2>${t("مهمة كتابة قصيرة (اختيارية)", "A short writing task (optional)")}</h2>
        <p class="muted">${t("يقرأ معلم كتابتك قبل أي قرار تسجيل. اكتب 120 إلى 150 كلمة في نحو 12 دقيقة. يمكنك التخطي الآن وستبقى نتيجتك مبدئية.", "A teacher reads your writing before any enrolment decision. Write 120 to 150 words in about 12 minutes. You can skip for now; your result will stay provisional.")}</p>
        <form data-write novalidate>
          <div class="field" dir="ltr" lang="en"><label class="q-text" for="w-text">${esc(WRITING_PROMPT)}</label>
            <textarea id="w-text" name="text" rows="10" maxlength="2000"></textarea>
            <div class="hint" aria-live="polite"><span data-wc>0</span> ${t("كلمة", "words")} · <span data-timer>12:00</span></div></div>
          <div class="form-msg bad" role="alert"></div>
          <div class="flow-nav">
            <button class="btn ghost" type="button" data-skip>${t("تخطَّ الآن", "Skip for now")}</button>
            <button class="btn" type="submit">${t("أرسل كتابتي واعرض نتيجتي", "Send my writing and show my result")}</button>
          </div>
        </form>`;
      const form = $("[data-write]", writeEl), ta = $("#w-text", writeEl), wc = $("[data-wc]", writeEl), tm = $("[data-timer]", writeEl);
      let left = 12 * 60; clearInterval(timer);
      timer = setInterval(() => { left = Math.max(0, left - 1); tm.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`; if (!left) clearInterval(timer); }, 1000);
      ta.addEventListener("input", () => { wc.textContent = words(ta.value); });
      const finish = async (writing) => {
        clearInterval(timer);
        const { place } = await scoring;
        const res = place({ A: partA, B: score - partA });
        const plan = buildPlan(goal, score, { partA, partB: score - partA }, res, writing);
        store.set("plan", plan);
        track("placement_complete");
        post({ type: "placement", placement_id: plan.id, partA, partB: score - partA, writing: writing ? writing.text : "", lang: AR ? "ar" : "en" });
        planEl.innerHTML = `<h2>${t("نتيجتك وخطتك", "Your result and plan")}</h2>` + planHtml(plan, false);
        wireCalib(plan);
        show("plan");
      };
      $("[data-skip]", writeEl).addEventListener("click", () => finish(null));
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const n = words(ta.value);
        if (n < WRITING_MIN) { say(form, "bad", t(`كتابتك قصيرة جدًا (${n} كلمة). اكتب ${WRITING_MIN} كلمة على الأقل، والأفضل 120 إلى 150، أو تخطَّ الآن.`, `Your writing is too short (${n} words). Write at least ${WRITING_MIN} words, ideally 120 to 150, or skip for now.`)); return; }
        finish({ text: ta.value.trim(), words: n, status: "awaiting_teacher", at: new Date().toISOString() });
      });
      show("write");
    }

    // Calibration answer: stored with the placement record, never echoed on screen.
    function wireCalib(plan) {
      const f = $("[data-calib]", planEl); if (!f) return;
      const more = $("[data-calib-more]", f);
      $$('input[name="has"]', f).forEach((r) => r.addEventListener("change", () => { more.hidden = r.value !== "yes" || !r.checked; }));
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const d = data(f);
        if (!d.has) { say(f, "bad", t("اختر نعم أو لا.", "Choose yes or no.")); return; }
        if (d.has === "yes" && (!d.band || !/^\d{4}-\d{2}$/.test(d.month || ""))) { say(f, "bad", t("اختر النتيجة وشهر الاختبار.", "Choose the result and the month of the test.")); return; }
        const calibration = d.has === "yes" ? { band: Number(d.band), month: d.month } : { none: true };
        store.set("plan", { ...store.get("plan", plan), calibration });
        if (d.has === "yes") post({ type: "calibration", placement_id: plan.id, band: Number(d.band), month: d.month });
        f.reset(); more.hidden = true;
        say(f, "ok", t("شكرًا، حُفظت إجابتك.", "Thank you, your answer is saved."));
      });
    }
  }

  /* ---------- dashboard ---------- */
  const dash = $("[data-dash]");
  if (dash) {
    const users = store.get("users", {});
    const user = session && users[session.email];
    if (!user) {
      dash.innerHTML = `<div class="box empty"><h2>${t("سجّل الدخول لرؤية لوحتك", "Log in to see your dashboard")}</h2>
        <p class="muted">${t("لوحتك تعرض خطتك ودروسك وتقدمك.", "Your dashboard shows your plan, lessons and progress.")}</p>
        <p style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap"><a class="btn" href="login.html">${t("دخول", "Log in")}</a><a class="btn ghost" href="register.html">${t("أنشئ حسابًا", "Create an account")}</a></p></div>`;
    } else {
      const plan = store.get("plan");
      const prog = store.get("learn", {});
      const done = LESSONS.filter((l) => prog[l.id] && prog[l.id].done).length;
      const next = LESSONS.find((l) => !(prog[l.id] && prog[l.id].done));
      const w1 = prog.w1 && prog.w1.text;
      $("[data-dash-hello]").textContent = t(`أهلًا ${user.name}`, `Hello, ${user.name}`);
      $("[data-dash-sub]").textContent = plan ? t("هذه خطتك ودروس الأسبوع الأول.", "Here is your plan and the week 1 lessons.") : t("ابدأ بتحديد مستواك لنبني خطتك.", "Start with the level check so we can build your plan.");
      const pct = Math.round((done / LESSONS.length) * 100);
      const C = 2 * Math.PI * 52;
      const ringHtml = `<div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="52"/><circle class="val" cx="60" cy="60" r="52" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}"/></svg><div class="ring-label"><b>${pct}%</b><small>${t("الأسبوع 1", "Week 1")}</small></div></div>`;
      // Recommended focus: from the placement parts (grammar/vocabulary = part A, reading = part B).
      const focus = [];
      if (plan && plan.partA != null) {
        if (plan.partA / 15 < 0.7) focus.push([t("القواعد والمفردات", "Grammar and vocabulary"), t("ابدأ بدرس «الأطروحة وخطة الخمس دقائق»، وراجع الأخطاء في ملاحظات كل تمرين.", "Start with \"Thesis and the five-minute plan\" and review the notes on each exercise you miss."), "thesis"]);
        if (plan.partB / 10 < 0.7) focus.push([t("القراءة", "Reading"), t("15 دقيقة يوميًا من أسئلة صح/خطأ/غير مذكور. تأتي في الأسبوع الثاني من الدورة.", "15 minutes a day of True/False/Not Given. It comes in week 2 of the course."), ""]);
      }
      focus.push([t("الاستماع والكتابة والمحادثة", "Listening, writing and speaking"), t("لم تُقيَّم بعد. سلّم المقال W1 ليراجعه معلم.", "Not checked yet. Submit essay W1 for a teacher to review."), "w1"]);
      dash.innerHTML = `
        <div class="dash">
          <div class="dash-hero" style="grid-column:1/-1">
            ${ringHtml}
            <div>
              <h2>${next ? t("خطوتك التالية", "Your next step") : t("أكملت الأسبوع الأول", "Week 1 complete")}</h2>
              <p>${next ? t(next.ar, next.en) : t("أحسنت. الأسبوع الثاني يُفتح مع بداية الدورة.", "Well done. Week 2 opens when the course starts.")}</p>
            </div>
            ${next ? `<a class="btn primary" href="learn.html#${next.id}">${done ? t("أكمل الدرس", "Continue") : t("ابدأ الدرس", "Start lesson")}</a>` : `<a class="btn primary" href="pricing.html#waitlist">${t("انضم إلى قائمة الانتظار", "Join the waiting list")}</a>`}
          </div>
          <div class="box wide">
            <h2>${t("خطتي", "My plan")}</h2>
            ${plan && plan.category ? planHtml(plan, true) : `<div class="empty" style="padding:1.5rem 0"><p>${t("لا توجد خطة بعد.", "No plan yet.")}</p><a class="btn primary" href="start.html">${t("اختبر مستواك", "Check your level")}</a></div>`}
          </div>
          <div style="display:grid;gap:1rem;align-content:start">
            <div class="box reco">
              <h2>${t("ركّز على", "Focus on")}</h2>
              <ul class="lesson-list">${focus.map(([name, why, id]) => `<li style="display:block"><b>${name}</b><br><span class="small">${why}</span>${id ? ` <a class="small" href="learn.html#${id}">${t("افتح الدرس", "Open lesson")}</a>` : ""}</li>`).join("")}</ul>
            </div>
            <div class="box">
              <h2>${t("تقدمي في الأسبوع الأول", "My week 1 progress")}</h2>
              <div class="meter"><i style="width:${pct}%"></i></div>
              <p class="small muted" data-progress>${t(`${done} من ${LESSONS.length} دروس مكتملة`, `${done} of ${LESSONS.length} lessons done`)}</p>
            </div>
            <div class="box">
              <h2>${t("المهام المصححة", "Graded tasks")}</h2>
              <p class="small">${w1 ? t(`W1 سُلّم (${prog.w1.words} كلمة). بانتظار ملاحظات المعلم.`, `W1 submitted (${prog.w1.words} words). Waiting for teacher feedback.`) : t("W1 لم يُسلّم بعد.", "W1 not submitted yet.")}</p>
              <p class="small muted">${t("نسخة تجريبية: المهام لا تُرسل لأي معلم بعد.", "Prototype: tasks are not sent to a teacher yet.")}</p>
            </div>
          </div>
          <div class="box wide"><h2>${t("دروس الأسبوع الأول", "Week 1 lessons")}</h2>
            <ul class="lesson-list">${LESSONS.map((l) => { const p = prog[l.id] || {}; return `<li><a href="learn.html#${l.id}" class="${p.done ? "is-done" : ""}">${t(l.ar, l.en)}</a><span class="pill${p.done ? " done" : ""}">${p.done ? (p.score != null ? t(`مكتمل: ${p.score}`, `Done: ${p.score}`) : t("مكتمل", "Done")) : t("لم يبدأ", "Not started")}</span></li>`; }).join("")}</ul></div>
          <div style="display:grid;gap:1rem;align-content:start">
            <div class="box">
              <h2>${t("الجلسات المباشرة القادمة", "Upcoming live sessions")}</h2>
              <p class="muted small">${t("تظهر هنا مواعيد مجموعتك ورابط الانضمام ومعلمك بعد فتح التسجيل.", "Your group's times, join link and teacher appear here once enrolment opens.")}</p>
            </div>
            <div class="box">
              <h2>${t("حسابي", "My account")}</h2>
              <p class="small">${esc(user.email)}</p>
              <p><a href="course-ielts-band6.html">${t("دورتي: سبرنت IELTS", "My course: IELTS Sprint")}</a></p>
              <button class="btn ghost sm" type="button" data-logout>${t("تسجيل الخروج", "Log out")}</button>
            </div>
          </div>
        </div>`;
      $("[data-logout]", dash).addEventListener("click", () => { store.del("session"); location.href = "index.html"; });
    }
  }
})();
