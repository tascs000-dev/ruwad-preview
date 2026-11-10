/* Ruwad visual layer: course card (week explorer), 60-second Lesson 1 taster, scroll-in drawing.
   No dependencies. Motion itself is CSS and only runs under prefers-reduced-motion: no-preference. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const AR = document.documentElement.lang === "ar";
  const x = (a, e) => (AR ? a : e);
  const track = (e) => { try { window.RUWAD && window.RUWAD.track && window.RUWAD.track(e); } catch {} };
  document.documentElement.classList.add("vjs");

  /* ---------- draw-on-scroll (journey path, course cover) ---------- */
  const reveal = $$("[data-reveal]");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); } }), { threshold: 0.35 });
    reveal.forEach((el) => io.observe(el));
  } else reveal.forEach((el) => el.classList.add("in-view"));

  /* ---------- course card: accessible tabs (WAI-ARIA tabs pattern) ---------- */
  $$("[data-cc]").forEach((card) => {
    const tabs = $$('[role="tab"]', card);
    const panels = $$('[role="tabpanel"]', card);
    const dot = $(".cc-dot", card);
    const nodes = $$(".cc-node", card);
    const select = (i, focus) => {
      tabs.forEach((t, k) => { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
      panels.forEach((p, k) => { p.hidden = k !== i; });
      nodes.forEach((n, k) => n.classList.toggle("past", k <= i));
      if (dot && nodes[i]) { dot.removeAttribute("transform"); dot.style.transform = `translate(${nodes[i].getAttribute("cx")}px, ${nodes[i].getAttribute("cy")}px)`; }
      card.dataset.week = String(i);
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i));
      t.addEventListener("keydown", (e) => {
        // Arrow keys follow reading direction: in RTL, ArrowLeft moves to the next week.
        const next = AR ? "ArrowLeft" : "ArrowRight", prev = AR ? "ArrowRight" : "ArrowLeft";
        let k = null;
        if (e.key === next) k = (i + 1) % tabs.length;
        else if (e.key === prev) k = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") k = 0;
        else if (e.key === "End") k = tabs.length - 1;
        if (k !== null) { e.preventDefault(); select(k, true); }
      });
    });
    select(0);
  });

  /* ---------- 60-second taster ---------- */
  const T = $("[data-taster]");
  if (!T) return;
  const clock = $("[data-taster-clock]", T);
  const ring = $(".taster-timer .val", T);
  const gapEl = $("[data-taster-gap]", T);
  const playBtn = $("[data-play]", T);
  const answers = $("[data-answers]", T);
  const script = $("[data-script]", T);
  const LINE = $("[data-script] p", T).textContent;
  let started = 0, timer = 0, plays = 0, step = 1, predictRight = false;

  const show = (n) => {
    step = n;
    $$("[data-step]", T).forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
    $$("[data-step-dot]", T).forEach((d) => d.classList.toggle("on", Number(d.dataset.stepDot) <= n));
  };
  const tick = () => {
    const s = Math.min(60, Math.floor((Date.now() - started) / 1000));
    clock.textContent = String(Math.max(0, 60 - s));
    ring.style.strokeDashoffset = String(100 - (s / 60) * 100);
  };
  const start = () => {
    if (started) return;
    started = Date.now(); T.classList.add("running"); track("taster_start");
    timer = setInterval(tick, 250);
  };
  const fb = (n, html, cls) => { const p = $(`[data-fb="${n}"]`, T); p.innerHTML = html; p.className = `taster-fb ${cls || ""}`; };

  // Step 1: predict the type of word
  $$("[data-type]", T).forEach((b) => b.addEventListener("click", () => {
    if (step !== 1) return;
    start();
    $$("[data-type]", T).forEach((o) => { o.setAttribute("aria-pressed", String(o === b)); o.disabled = true; });
    predictRight = b.dataset.type === "number";
    fb(1, predictRight
      ? x("صحيح: قبل كلمة March يأتي رقم (تاريخ). الآن تعرف ما تنتظره.", "Right: before “March” you need a number (a date). Now you know what to listen for.")
      : x("قريب، لكن قبل كلمة March يأتي رقم (تاريخ). التوقع يخبرك بما تنتظره.", "Close, but before “March” you need a number (a date). Predicting tells you what to listen for."),
      predictRight ? "ok" : "warn");
    setTimeout(() => { show(2); playBtn.focus(); }, 1400);
  }));

  // Step 2: listen once
  const audioSrc = (() => {
    const raw = T.dataset.audio;
    if (!raw) return "";
    const base = (document.querySelector('link[href$="css/site.css"]')?.getAttribute("href") || "assets/css/site.css").replace("css/site.css", "");
    return raw.replace("{asset}", base);
  })();
  const speak = () => new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") return resolve(false);
    const voices = synth.getVoices().filter((v) => /^en/i.test(v.lang));
    if (!voices.length) return resolve(false);
    const u = new SpeechSynthesisUtterance(LINE);
    u.lang = T.dataset.voice || "en-GB"; u.rate = 0.97;
    u.voice = voices.find((v) => /en[-_]GB/i.test(v.lang)) || voices[0];
    const guard = setTimeout(() => resolve(true), LINE.length * 110 + 3000);
    u.onend = u.onerror = () => { clearTimeout(guard); resolve(true); };
    synth.cancel(); synth.speak(u);
  });
  const playFile = () => new Promise((resolve) => {
    if (!audioSrc) return resolve(false);
    const a = new Audio(audioSrc);
    a.onended = () => resolve(true);
    a.onerror = () => resolve(false);
    a.play().catch(() => resolve(false));
  });
  playBtn.addEventListener("click", async () => {
    start();
    if (plays >= 1) return; // once, as in the test
    plays++;
    playBtn.disabled = true; T.classList.add("playing");
    $("span", playBtn).textContent = x("يُشغَّل الآن…", "Playing…");
    const ok = (await playFile()) || (await speak());
    T.classList.remove("playing");
    $("span", playBtn).textContent = x("سُمع مرة واحدة", "Played once");
    if (!ok) { script.open = true; $("span", playBtn).textContent = x("لا يوجد صوت في هذا المتصفح: اقرأ النص", "No audio in this browser: read the script"); }
    answers.hidden = false;
    $("button", answers).focus();
  });
  $$("[data-answer]", T).forEach((b) => b.addEventListener("click", () => {
    if (step !== 2) return;
    $$("[data-answer]", T).forEach((o) => { o.setAttribute("aria-pressed", String(o === b)); o.disabled = true; });
    const right = b.dataset.answer === "12";
    T.classList.add("answered");
    gapEl.textContent = "12th"; gapEl.classList.add(right ? "ok" : "fixed");
    fb(2, right
      ? x("التقطتها! «Oh, sorry» ألغت الخامس، والإجابة 12th.", "You caught it! “Oh, sorry” cancelled the 5th, so the answer is 12th.")
      : x("هذا هو الفخ: قيل الخامس أولًا، ثم صحّحته عبارة «Oh, sorry» إلى 12th.", "That’s the trap: the 5th came first, then “Oh, sorry” corrected it to 12th."),
      right ? "ok" : "warn");
    script.open = true;
    setTimeout(() => finish(right), 1600);
  }));

  function finish(right) {
    clearInterval(timer);
    const secs = Math.max(1, Math.round((Date.now() - started) / 1000));
    tick();
    T.classList.remove("running"); T.classList.add("done");
    const score = (predictRight ? 1 : 0) + (right ? 1 : 0);
    $("[data-result]", T).innerHTML = x(
      `<b>${score} من 2</b> في <bdi>${secs}</bdi> ثانية. ${score === 2 ? "هذا بالضبط ما يدرّبك عليه الدرس 1، مع ستة فراغات كاملة." : "لهذا يبدأ الدرس 1 بالتوقع وفخ التصحيح: أكثر ما يخسر فيه الطلاب درجات في القسم الأول."}`,
      `<b>${score} of 2</b> in <bdi>${secs}</bdi> seconds. ${score === 2 ? "That is exactly what Lesson 1 trains, across a full six-gap form." : "That is why Lesson 1 starts with prediction and the correction trap: they are where Part 1 marks are most often lost."}`);
    show(3);
    track("taster_complete");
    try { localStorage.setItem("ruwad.taster", JSON.stringify({ score, secs, at: new Date().toISOString().slice(0, 10) })); } catch {}
  }

  $("[data-restart]", T).addEventListener("click", () => {
    clearInterval(timer); started = 0; plays = 0; predictRight = false;
    T.classList.remove("running", "done", "answered", "playing");
    $$("[data-type],[data-answer]", T).forEach((o) => { o.disabled = false; o.setAttribute("aria-pressed", "false"); });
    gapEl.textContent = "____"; gapEl.className = "tf-gap";
    fb(1, ""); fb(2, "");
    answers.hidden = true; script.open = false; playBtn.disabled = false;
    $("span", playBtn).textContent = x("شغّل التسجيل", "Play the recording");
    clock.textContent = "60"; ring.style.strokeDashoffset = "100";
    show(1); $("[data-type]", T).focus();
  });
})();
