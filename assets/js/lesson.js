// Ruwad interactive lesson player (schema ruwad.lesson/1).
// Renders a lesson from the JSON embedded in the page: narrated motion film with embedded
// questions, a prediction step, an exam-style listening task with marking and feedback,
// a spelling clinic and a completion screen. Progress is saved in this browser only
// (labelled "demo mode") until a real backend is approved.
//
// Audio: if lesson.media has a pre-rendered file for a segment it is played; otherwise the
// device's built-in speech voice reads the script. With no speech support the captions run
// on a timer so the lesson still works (and tests run headless). ?speed=fast shortens timers.
(() => {
  const root = document.querySelector("[data-lesson]");
  const dataEl = document.getElementById("lesson-data");
  if (!root || !dataEl) return;
  const L = JSON.parse(dataEl.textContent);
  const lang = document.documentElement.lang === "ar" ? "ar" : "en";
  const t = (o) => (o && typeof o === "object" ? o[lang] ?? o.en : o);
  const x = (ar, en) => (lang === "ar" ? ar : en);
  const fast = /[?&]speed=fast\b/.test(location.search);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const KEY = `ruwad.lesson.${L.id}`;
  const rich = (s) => esc(s).replace(/&quot;(.+?)&quot;/g, '“<bdi dir="ltr">$1</bdi>”');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- progress (demo mode: localStorage) ---------- */
  const blank = () => ({ v: 1, stop: "intro", done: [], film: {}, predict: {}, answers: {}, result: null, spelling: {}, attempts: 0, started: null, finished: null, best: null });
  let S;
  try { S = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { S = blank(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
  const markDone = (id) => { if (!S.done.includes(id)) S.done.push(id); save(); };

  /* ---------- speech ---------- */
  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  let voices = [];
  const loadVoices = () => { voices = synth ? synth.getVoices().filter((v) => /^en/i.test(v.lang)) : []; };
  if (synth) { loadVoices(); synth.addEventListener?.("voiceschanged", loadVoices); }
  const pickVoice = (role) => {
    const cfg = L.voices[role] || L.voices.narrator;
    if (!voices.length) return null;
    for (const name of cfg.prefer) { const v = voices.find((v) => v.name.includes(name)); if (v) return v; }
    const gb = voices.filter((v) => /en[-_]GB/i.test(v.lang));
    const pool = gb.length ? gb : voices;
    return pool[role === "C" ? Math.min(1, pool.length - 1) : 0];
  };
  const canSpeak = () => !!synth && voices.length > 0 && !fast;
  let speechToken = 0;
  const stopSpeech = () => { speechToken++; if (synth) synth.cancel(); };
  // Speak one line; resolves when finished (or skipped). Never rejects.
  function sayLine(text, role, token) {
    return new Promise((resolve) => {
      if (token !== speechToken) return resolve(false);
      const est = Math.max(fast ? 30 : 1300, text.length * (fast ? 2 : 62));
      if (!canSpeak()) return setTimeout(() => resolve(token === speechToken), est);
      const u = new SpeechSynthesisUtterance(text);
      const cfg = L.voices[role] || L.voices.narrator;
      const v = pickVoice(role); if (v) u.voice = v;
      u.lang = cfg.lang; u.rate = cfg.rate; u.pitch = cfg.pitch;
      let settled = false;
      const end = () => { if (!settled) { settled = true; clearTimeout(guard); resolve(token === speechToken); } };
      const guard = setTimeout(end, est * 2.2 + 3000); // some browsers drop onend
      u.onend = end; u.onerror = end;
      synth.speak(u);
    });
  }
  // Play a list of {speaker, en} lines. onLine(i) fires as each line starts.
  async function playLines(lines, onLine, mediaId) {
    stopSpeech();
    const token = speechToken;
    const src = mediaId && L.media && L.media[mediaId];
    if (src) {
      const audio = new Audio(src);
      const total = lines.reduce((n, l) => n + l.en.length, 0);
      let ok = true;
      await new Promise((res) => {
        audio.onended = res; audio.onerror = () => { ok = false; res(); };
        audio.ontimeupdate = () => {
          if (!audio.duration) return;
          let acc = 0; const pos = (audio.currentTime / audio.duration) * total;
          for (let i = 0; i < lines.length; i++) { acc += lines[i].en.length; if (pos < acc) { onLine?.(i); break; } }
        };
        audio.play().catch(() => { ok = false; res(); });
        const stopper = setInterval(() => { if (token !== speechToken) { audio.pause(); clearInterval(stopper); res(); } }, 200);
        audio.addEventListener("ended", () => clearInterval(stopper));
      });
      if (ok) return token === speechToken;
    }
    for (let i = 0; i < lines.length; i++) {
      onLine?.(i);
      const ok = await sayLine(lines[i].en, lines[i].speaker || "narrator", token);
      if (!ok) return false;
      await new Promise((r) => setTimeout(r, fast ? 5 : 260));
    }
    return token === speechToken;
  }
  const voiceNote = () => {
    if (Object.keys(L.media || {}).length) return "";
    return `<p class="ls-voice-note">${x("صوت تجريبي: يستخدم الدرس صوت جهازك المدمج حتى يُسجَّل الصوت الاحترافي. جودة النطق تختلف من جهاز لآخر.", "Demo voice: this lesson uses your device's built-in voice until the studio recording is added. Quality varies by device.")}</p>`;
  };

  /* ---------- illustrations (original, brand palette) ---------- */
  const art = {
    map: `<svg viewBox="0 0 640 360" class="ls-art" aria-hidden="true">
      <defs><linearGradient id="lsg" x1="0" x2="1"><stop offset="0" stop-color="#eb473d"/><stop offset="1" stop-color="#f0965b"/></linearGradient></defs>
      <path class="ls-draw" d="M60 280 C160 280 160 200 250 200 S360 120 440 120 S560 70 590 60" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="3" stroke-dasharray="6 9"/>
      <g class="ls-pop" style="--d:.2s"><circle cx="60" cy="280" r="26" fill="url(#lsg)"/><text x="60" y="288" text-anchor="middle" class="ls-n dark">1</text></g>
      <g class="ls-pop" style="--d:.5s"><circle cx="250" cy="200" r="20" fill="#2a2e52" stroke="rgba(255,255,255,.35)"/><text x="250" y="207" text-anchor="middle" class="ls-n">2</text></g>
      <g class="ls-pop" style="--d:.7s"><circle cx="440" cy="120" r="20" fill="#2a2e52" stroke="rgba(255,255,255,.35)"/><text x="440" y="127" text-anchor="middle" class="ls-n">3</text></g>
      <g class="ls-pop" style="--d:.9s"><circle cx="590" cy="60" r="20" fill="#2a2e52" stroke="rgba(255,255,255,.35)"/><text x="590" y="67" text-anchor="middle" class="ls-n">4</text></g>
      <g class="ls-rise" style="--d:1.2s">
        <rect x="96" y="40" width="250" height="132" rx="14" fill="#fff"/>
        <rect x="116" y="60" width="130" height="10" rx="5" fill="#1c1f3a"/>
        <rect x="116" y="88" width="70" height="8" rx="4" fill="#cfc9c5"/><rect x="196" y="98" width="128" height="2" fill="#eb473d"/>
        <rect x="116" y="116" width="90" height="8" rx="4" fill="#cfc9c5"/><rect x="216" y="126" width="108" height="2" fill="#eb473d"/>
        <rect x="116" y="144" width="60" height="8" rx="4" fill="#cfc9c5"/><rect x="186" y="154" width="138" height="2" fill="#eb473d"/>
      </g>
      <g class="ls-pop" style="--d:1.6s"><rect x="372" y="236" width="196" height="44" rx="22" fill="none" stroke="url(#lsg)" stroke-width="2"/><text x="470" y="264" text-anchor="middle" class="ls-t">ONE PLAY ONLY</text></g>
    </svg>`,
    predict: `<svg viewBox="0 0 640 360" class="ls-art" aria-hidden="true">
      <rect x="70" y="50" width="500" height="260" rx="18" fill="#fff"/>
      <text x="100" y="98" class="ls-f">Name: Faisal</text><rect x="250" y="104" width="190" height="2" fill="#cfc9c5"/>
      <text x="100" y="168" class="ls-f">Day preferred:</text><rect x="290" y="174" width="190" height="2" fill="#cfc9c5"/>
      <text x="100" y="238" class="ls-f">Fee (riyals):</text><rect x="270" y="244" width="190" height="2" fill="#cfc9c5"/>
      <g class="ls-pop" style="--d:.8s"><rect x="262" y="66" width="104" height="34" rx="17" fill="#eb473d"/><text x="314" y="89" text-anchor="middle" class="ls-chip">NAME</text></g>
      <g class="ls-pop" style="--d:1.6s"><rect x="302" y="136" width="90" height="34" rx="17" fill="#ef7a4b"/><text x="347" y="159" text-anchor="middle" class="ls-chip">DAY</text></g>
      <g class="ls-pop" style="--d:2.4s"><rect x="282" y="206" width="124" height="34" rx="17" fill="#f0965b"/><text x="344" y="229" text-anchor="middle" class="ls-chip">NUMBER</text></g>
      <g class="ls-rise" style="--d:.2s"><circle cx="540" cy="60" r="34" fill="#1c1f3a" stroke="#f0965b" stroke-width="3"/><text x="540" y="72" text-anchor="middle" class="ls-q">?</text></g>
    </svg>`,
    trap: `<svg viewBox="0 0 640 360" class="ls-art" aria-hidden="true">
      <g class="ls-rise" style="--d:.2s"><path d="M70 70 h300 a18 18 0 0 1 18 18 v74 a18 18 0 0 1 -18 18 h-250 l-34 30 v-30 h-16 a18 18 0 0 1 -18 -18 v-74 a18 18 0 0 1 18 -18z" fill="#fff"/>
      <text x="96" y="122" class="ls-f">The meeting's on</text><text x="96" y="158" class="ls-big">Tuesday</text>
      <rect class="ls-strike" x="92" y="146" width="140" height="5" rx="2" fill="#eb473d"/></g>
      <g class="ls-rise" style="--d:1.6s"><path d="M270 196 h300 a18 18 0 0 1 18 18 v74 a18 18 0 0 1 -18 18 h-16 v30 l-34 -30 h-250 a18 18 0 0 1 -18 -18 v-74 a18 18 0 0 1 18 -18z" fill="url(#lsg2)"/>
      <defs><linearGradient id="lsg2" x1="0" x2="1"><stop offset="0" stop-color="#eb473d"/><stop offset="1" stop-color="#f0965b"/></linearGradient></defs>
      <text x="296" y="244" class="ls-f dark">sorry, no. It's on</text><text x="296" y="282" class="ls-big dark">Thursday</text></g>
      <g class="ls-pop" style="--d:2.4s"><text x="440" y="96" class="ls-sig">actually</text><text x="470" y="130" class="ls-sig">sorry</text><text x="430" y="164" class="ls-sig">no, wait</text></g>
    </svg>`,
    check: `<svg viewBox="0 0 640 360" class="ls-art" aria-hidden="true">
      ${["H", "A", "R", "B", "I"].map((c, i) => `<g class="ls-pop" style="--d:${0.3 + i * 0.35}s"><rect x="${120 + i * 84}" y="54" width="68" height="78" rx="12" fill="#fff"/><text x="${154 + i * 84}" y="108" text-anchor="middle" class="ls-letter">${c}</text></g>`).join("")}
      <g class="ls-rise" style="--d:2.2s"><rect x="120" y="170" width="400" height="56" rx="12" fill="#2a2e52"/><text x="146" y="206" class="ls-f light">Wednesday</text><circle cx="486" cy="198" r="15" fill="#1f7a55"/><path d="M479 198 l5 5 l9 -10" stroke="#fff" stroke-width="3" fill="none"/></g>
      <g class="ls-rise" style="--d:2.7s"><rect x="120" y="240" width="400" height="56" rx="12" fill="#2a2e52"/><text x="146" y="276" class="ls-f light">Wensday</text><circle cx="486" cy="268" r="15" fill="#b42318"/><path d="M480 262 l12 12 M492 262 l-12 12" stroke="#fff" stroke-width="3"/></g>
    </svg>`,
  };
  const heroArt = `<svg viewBox="0 0 420 300" class="ls-hero-art" aria-hidden="true">
    <defs><linearGradient id="lsh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eb473d"/><stop offset="1" stop-color="#f0965b"/></linearGradient></defs>
    <circle cx="210" cy="150" r="118" fill="url(#lsh)" opacity=".14"/>
    <g class="ls-wave">${Array.from({ length: 23 }, (_, i) => { const h = 18 + Math.round(70 * Math.abs(Math.sin(i * 0.72) * Math.cos(i * 0.21))); return `<rect x="${44 + i * 15}" y="${150 - h / 2}" width="8" height="${h}" rx="4" fill="url(#lsh)" style="--i:${i}"/>`; }).join("")}</g>
    <path d="M140 118 a70 70 0 0 1 140 0" fill="none" stroke="#1c1f3a" stroke-width="12" stroke-linecap="round"/>
    <rect x="122" y="112" width="34" height="58" rx="14" fill="#1c1f3a"/><rect x="264" y="112" width="34" height="58" rx="14" fill="#1c1f3a"/>
  </svg>`;

  /* ---------- shell ---------- */
  const stopIdx = (id) => L.stops.findIndex((s) => s.id === id);
  function journey(current) {
    const cur = stopIdx(current);
    return `<ol class="ls-journey" aria-label="${x("مسار الدرس", "Lesson route")}">${L.stops.map((s, i) => {
      const done = S.done.includes(s.id);
      const state = done ? "done" : i === cur ? "now" : "todo";
      return `<li class="${state}"${i === cur ? ' aria-current="step"' : ""}><span class="dot" aria-hidden="true">${done ? "✓" : i + 1}</span><span class="lbl">${t(s)}</span><span class="sr">${done ? x("مكتمل", "done") : i === cur ? x("الحالية", "current") : ""}</span></li>`;
    }).join("")}</ol>`;
  }
  const demoBadge = `<p class="ls-demo"><span aria-hidden="true">●</span> ${x("وضع تجريبي: يُحفظ تقدمك في هذا المتصفح فقط، ولا يُرسل شيء.", "Demo mode: progress is saved in this browser only. Nothing is sent.")}</p>`;
  function show(stop, html) {
    stopSpeech();
    S.stop = stop; save();
    root.innerHTML = `${stop === "intro" ? "" : journey(stop)}<div class="ls-panel" data-stop="${stop}">${html}</div>`;
    const h = root.querySelector("h2");
    if (h && stop !== "intro") { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); root.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); }
  }
  const go = { intro, film, predict, listen, spell, done: finish };

  /* ---------- intro ---------- */
  function intro() {
    const resume = S.done.length && S.stop !== "intro";
    show("intro", `
      <div class="ls-hero">
        <div class="ls-hero-copy">
          <p class="ls-kicker">${x("IELTS الأكاديمي · الاستماع · الدرس 1", "IELTS Academic · Listening · Lesson 1")}</p>
          <p class="ls-lead">${x("في القسم الأول من اختبار الاستماع، تخسر أغلب الدرجات لثلاثة أسباب: لم تتوقع الإجابة، أو كتبت أول ما سمعته، أو أخطأت في التهجئة. في 12 دقيقة تتدرب على الثلاثة.", "In Part 1 of Listening, most marks are lost for three reasons: not predicting the answer, writing the first thing you hear, or misspelling it. In 12 minutes you practise all three.")}</p>
          <ul class="ls-goals">${L.goals.map((g) => `<li>${t(g)}</li>`).join("")}</ul>
          <div class="ls-actions">
            <button class="btn primary" data-go="${resume ? S.stop : "film"}">${resume ? x("تابع من حيث توقفت", "Continue where you left off") : x("ابدأ الدرس", "Start the lesson")}</button>
            ${resume ? `<button class="btn ghost" data-reset>${x("ابدأ من جديد", "Start again")}</button>` : ""}
          </div>
          <p class="ls-meta">${x("12 دقيقة · سماعات مستحسنة · 4 مشاهد قصيرة و6 أسئلة استماع", "12 minutes · headphones recommended · 4 short scenes and 6 listening questions")}</p>
        </div>
        <div class="ls-hero-visual">${heroArt}</div>
      </div>
      ${demoBadge}
      <p class="ls-review-note">${x("محتوى تجريبي يراجعه معلم مؤهل. نتيجتك هنا تدريبية وليست درجة IELTS.", "Draft content for review by a qualified teacher. Your result here is practice, not an IELTS band.")}</p>`);
  }

  /* ---------- film: narrated motion lesson with embedded questions ---------- */
  function film() {
    if (!S.started) { S.started = new Date().toISOString(); save(); }
    const scenes = L.film.scenes;
    let si = 0, playing = false, waitingQ = false, cc = true;
    show("film", `
      <h2>${x("شاهد: كيف يعمل القسم الأول", "Watch: how Part 1 works")}</h2>
      <div class="ls-player" data-player>
        <div class="ls-screen" data-screen>
          <div class="ls-scene" data-scene></div>
          <div class="ls-caption" data-caption aria-hidden="true"></div>
          <div class="ls-overlay" data-overlay hidden></div>
          <button class="ls-bigplay" data-bigplay aria-label="${x("تشغيل", "Play")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button>
        </div>
        <div class="ls-controls">
          <button class="ls-ctl" data-toggle aria-label="${x("تشغيل", "Play")}">▶</button>
          <div class="ls-chapters" role="group" aria-label="${x("المشاهد", "Scenes")}">${scenes.map((s, i) => `<button class="ls-chap" data-chap="${i}" aria-label="${x("المشهد", "Scene")} ${i + 1}: ${esc(t(s.title))}"><span></span></button>`).join("")}</div>
          <button class="ls-ctl ls-cc on" data-cc aria-pressed="true">CC</button>
        </div>
      </div>
      ${voiceNote()}
      <details class="ls-transcript"><summary>${x("نص الفيلم", "Film transcript")}</summary>${scenes.map((s) => `<h3>${t(s.title)}</h3>${s.lines.map((l) => `<p>${esc(l.en)}${lang === "ar" ? `<br><span lang="ar">${esc(l.ar)}</span>` : ""}</p>`).join("")}`).join("")}</details>
      <div class="ls-actions"><button class="btn primary" data-next disabled>${x("التالي: توقّع الإجابات", "Next: predict the answers")}</button></div>`);
    const $ = (s) => root.querySelector(s);
    const sceneEl = $("[data-scene]"), cap = $("[data-caption]"), ov = $("[data-overlay]"), big = $("[data-bigplay]"), tog = $("[data-toggle]"), next = $("[data-next]");
    const setPlaying = (p) => { playing = p; tog.textContent = p ? "❚❚" : "▶"; tog.setAttribute("aria-label", p ? x("إيقاف مؤقت", "Pause") : x("تشغيل", "Play")); big.hidden = p || waitingQ || !ov.hidden; };
    const renderScene = (i) => {
      si = i;
      sceneEl.innerHTML = `<div class="ls-scene-title">${esc(t(scenes[i].title))}</div>${art[scenes[i].visual] || ""}`;
      sceneEl.classList.remove("on"); void sceneEl.offsetWidth; sceneEl.classList.add("on");
      root.querySelectorAll("[data-chap]").forEach((b, j) => { b.classList.toggle("seen", j < i || S.film[scenes[j].id]); b.classList.toggle("now", j === i); });
    };
    const caption = (l) => { cap.innerHTML = cc ? `<span>${esc(l.en)}</span>${lang === "ar" ? `<span lang="ar" class="ar">${esc(l.ar)}</span>` : ""}` : ""; };
    const allSeen = () => scenes.every((s) => S.film[s.id]);
    const unlock = () => { if (allSeen()) { next.disabled = false; markDone("film"); } };
    async function runFrom(i) {
      setPlaying(true);
      for (let k = i; k < scenes.length; k++) {
        renderScene(k);
        const sc = scenes[k];
        const ok = await playLines(sc.lines.map((l) => ({ speaker: "narrator", en: l.en })), (n) => caption(sc.lines[n]), `film-${sc.id}`);
        if (!ok) return;
        if (sc.question) {
          const passed = await askQuestion(sc.question);
          if (!passed) return;
        }
        S.film[sc.id] = true; save();
        renderScene(k);
      }
      cap.innerHTML = ""; setPlaying(false); unlock();
      if (allSeen()) { ov.hidden = false; ov.innerHTML = `<div class="ls-q-card ls-end"><p class="ls-end-mark" aria-hidden="true">✓</p><p>${x("انتهى الفيلم. حان دورك.", "Film complete. Your turn.")}</p><button class="btn primary" data-ov-next>${x("توقّع الإجابات", "Predict the answers")}</button></div>`; ov.querySelector("[data-ov-next]").onclick = () => go.predict(); big.hidden = true; }
    }
    function askQuestion(q) {
      return new Promise((resolve) => {
        waitingQ = true; setPlaying(false); big.hidden = true;
        const listenBtn = q.listen ? `<button class="btn ghost sm" data-listen>🔊 ${x("استمع", "Listen")}</button>` : "";
        ov.hidden = false;
        ov.innerHTML = `<div class="ls-q-card" role="dialog" aria-modal="false" aria-labelledby="q-${q.id}">
          <p class="ls-q-tag">${x("سؤال داخل الفيلم", "Quick question")}</p>
          <p id="q-${q.id}" class="ls-q-prompt">${rich(t(q.prompt))}</p>
          ${listenBtn}
          <div class="ls-opts" role="group">${q.options.map((o, i) => `<button class="ls-opt" data-opt="${i}">${esc(t(o))}</button>`).join("")}</div>
          <div class="ls-fb" aria-live="polite"></div></div>`;
        const fb = ov.querySelector(".ls-fb");
        const listen = () => playLines(q.listen, null, `q-${q.id}`);
        if (q.listen) { ov.querySelector("[data-listen]").onclick = listen; listen(); }
        ov.querySelector(".ls-opt").focus({ preventScroll: true });
        ov.querySelectorAll("[data-opt]").forEach((b) => b.onclick = () => {
          const pick = +b.dataset.opt, right = pick === q.answer;
          S.film[q.id] = S.film[q.id] || { first: pick, right };
          save();
          b.classList.add(right ? "right" : "wrong");
          if (right) {
            ov.querySelectorAll("[data-opt]").forEach((o) => (o.disabled = true));
            fb.innerHTML = `<p class="ok">${rich(t(q.right))}</p><button class="btn primary sm" data-cont>${x("تابع المشاهدة", "Keep watching")}</button>`;
            fb.querySelector("[data-cont]").onclick = () => { ov.hidden = true; waitingQ = false; stopSpeech(); resolve(true); };
            fb.querySelector("[data-cont]").focus();
          } else {
            b.disabled = true;
            fb.innerHTML = `<p class="bad">${rich(t(q.wrong))}</p>`;
            if (q.retry && q.listen) setTimeout(listen, fast ? 10 : 600); // branch: replay the cue, then try again
          }
        });
      });
    }
    const toggle = () => {
      if (waitingQ) return;
      if (playing) { stopSpeech(); setPlaying(false); return; }
      ov.hidden = true;
      runFrom(allSeen() ? 0 : si);
    };
    tog.onclick = toggle; big.onclick = toggle;
    root.querySelectorAll("[data-chap]").forEach((b) => b.onclick = () => {
      const i = +b.dataset.chap;
      if (waitingQ) return;
      if (i > 0 && !S.film[scenes[i - 1].id] && !allSeen()) return; // no skipping ahead on first watch
      stopSpeech(); ov.hidden = true; runFrom(i);
    });
    $("[data-cc]").onclick = (e) => { cc = !cc; e.currentTarget.classList.toggle("on", cc); e.currentTarget.setAttribute("aria-pressed", cc); if (!cc) cap.innerHTML = ""; };
    next.onclick = () => go.predict();
    renderScene(0); unlock();
  }

  /* ---------- predict ---------- */
  function predict() {
    const T = L.task;
    show("predict", `
      <h2>${x("توقّع: ما نوع كل إجابة؟", "Predict: what kind of answer is each gap?")}</h2>
      <p class="ls-sub">${x("في الاختبار لديك نحو 30 ثانية لقراءة الأسئلة قبل التسجيل. اختر نوع الكلمة لكل فراغ.", "In the test you get about 30 seconds to read before the audio. Choose the kind of word for each gap.")}</p>
      <div class="ls-form" lang="en" dir="ltr">
        <p class="ls-form-head">${esc(T.form_heading)}</p>
        ${T.gaps.map((g) => `<div class="ls-prow" data-gap="${g.n}">
          <div class="ls-pline"><b>${g.n}</b> ${esc(g.before)} <span class="ls-blank">______</span> ${esc(g.after)}</div>
          <div class="ls-types" role="radiogroup" aria-label="${x("نوع الإجابة", "Answer type")} ${g.n}" dir="${lang === "ar" ? "rtl" : "ltr"}">${T.types.map((ty) => `<button role="radio" aria-checked="false" class="ls-type" data-type="${ty.id}">${t(ty)}</button>`).join("")}</div>
          <p class="ls-pfb" aria-live="polite" dir="${lang === "ar" ? "rtl" : "ltr"}"></p></div>`).join("")}
      </div>
      <div class="ls-actions"><button class="btn primary" data-next disabled>${x("التالي: استمع وأجب", "Next: listen and answer")}</button></div>`);
    const next = root.querySelector("[data-next]");
    const check = () => { if (T.gaps.every((g) => S.predict[g.n])) { next.disabled = false; markDone("predict"); } };
    root.querySelectorAll("[data-gap]").forEach((row) => {
      const g = T.gaps.find((g) => g.n === +row.dataset.gap);
      const fb = row.querySelector(".ls-pfb");
      const paint = (pick) => {
        row.querySelectorAll(".ls-type").forEach((b) => { const on = b.dataset.type === pick; b.setAttribute("aria-checked", on); b.classList.toggle("picked", on); b.classList.toggle("right", on && pick === g.type); b.classList.toggle("wrong", on && pick !== g.type); });
        const ty = T.types.find((ty) => ty.id === g.type);
        fb.innerHTML = pick === g.type ? `<span class="ok">✓ ${x("صحيح", "Good prediction")}</span>` : `<span class="bad">${x("الأقرب:", "More likely:")} ${t(ty)}</span>`;
      };
      if (S.predict[g.n]) paint(S.predict[g.n].pick);
      row.querySelectorAll(".ls-type").forEach((b) => b.onclick = () => {
        S.predict[g.n] = S.predict[g.n] ? { ...S.predict[g.n], pick: b.dataset.type } : { pick: b.dataset.type, first: b.dataset.type === g.type };
        save(); paint(b.dataset.type); check();
      });
    });
    next.onclick = () => go.listen();
    check();
  }

  /* ---------- listen: exam-style task ---------- */
  const norm = (s) => String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/[.,!]+$/g, "").replace(/\s+/g, " ").trim();
  const lev = (a, b) => { const m = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) m[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return m[a.length][b.length]; };
  const wordCount = (s) => norm(s).split(" ").filter(Boolean).length;
  function mark(g, raw) {
    const v = norm(raw);
    if (!v) return "missed";
    if (wordCount(v) > (L.task.word_limit || 2)) return "limit"; // over the limit is wrong in the real test
    if (g.accept.includes(v)) return "right";
    if (g.distractors.includes(v)) return "distractor";
    const near = [...g.accept, g.spellcheck].some((a) => a.length > 3 && lev(v, a) <= (a.length > 7 ? 2 : 1));
    if (near) return "spelling";
    return "other";
  }
  function listen() {
    const T = L.task;
    const played = !!S.answers.__played;
    show("listen", `
      <h2>${x("استمع وأكمل النموذج", "Listen and complete the form")}</h2>
      <p class="ls-sub">${x("كما في الاختبار: تسمع التسجيل مرة واحدة. اكتب أثناء الاستماع، ثم راجع التهجئة قبل التسليم.", "Like the test: you hear the recording once. Write as you listen, then check your spelling before you submit.")}</p>
      <div class="ls-audio" data-audio>
        <button class="ls-playbar" data-play ${played ? "disabled" : ""}>
          <span class="ls-pi" aria-hidden="true">▶</span>
          <span class="ls-pl">${played ? x("تم التشغيل (مرة واحدة كما في الاختبار)", "Played (once, like the test)") : x("شغّل التسجيل (مرة واحدة)", "Play the recording (once)")}</span>
          <span class="ls-meter" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</span>
        </button>
        <p class="ls-now" data-now aria-live="off"></p>
      </div>
      ${voiceNote()}
      <form class="ls-form ls-task" lang="en" dir="ltr" novalidate>
        <p class="ls-form-head">${esc(T.form_heading)}</p>
        <p class="ls-instr">${esc(T.instruction.en)}</p>
        ${T.gaps.map((g) => `<div class="ls-row"><label for="gap-${g.n}"><b>${g.n}</b> ${esc(g.before)}</label>
          <input id="gap-${g.n}" name="g${g.n}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(S.answers[g.n] || "")}" inputmode="${g.type === "number" ? "text" : "text"}" placeholder="${S.predict[g.n] ? esc(t(T.types.find((ty) => ty.id === S.predict[g.n].pick))) : ""}">
          ${g.after ? `<span class="ls-after">${esc(g.after)}</span>` : ""}<span class="ls-warn" data-warn="${g.n}" hidden>${x("تجاوزت الحد: كلمتان كحد أقصى", "Over the limit: two words maximum")}</span></div>`).join("")}
        <div class="ls-actions"><button class="btn primary" type="submit">${x("سلّم الإجابات", "Submit answers")}</button></div>
      </form>`);
    const form = root.querySelector("form");
    const nowEl = root.querySelector("[data-now]");
    const playBtn = root.querySelector("[data-play]");
    form.addEventListener("input", (e) => {
      const n = +e.target.id.split("-")[1];
      S.answers[n] = e.target.value; save();
      const g = T.gaps.find((g) => g.n === n);
      root.querySelector(`[data-warn="${n}"]`).hidden = wordCount(e.target.value) <= (T.word_limit || 2);
    });
    playBtn.onclick = async () => {
      playBtn.disabled = true; playBtn.classList.add("playing");
      S.answers.__played = true; save();
      root.querySelector(".ls-pl").textContent = x("يُشغَّل الآن…", "Playing…");
      await playLines(T.script, (i) => { if (nowEl.isConnected) nowEl.textContent = `${t(T.speakers[T.script[i].speaker])}…`; }, "task-script");
      if (!playBtn.isConnected) return; // learner submitted or left while it played
      playBtn.classList.remove("playing"); nowEl.textContent = "";
      root.querySelector(".ls-pl").textContent = x("انتهى التسجيل. راجع إجاباتك ثم سلّم.", "Recording finished. Check your answers, then submit.");
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      const blanks = T.gaps.filter((g) => !norm(S.answers[g.n])).length;
      if (blanks && !form.dataset.confirm) {
        form.dataset.confirm = "1";
        const p = document.createElement("p"); p.className = "ls-confirm"; p.setAttribute("role", "status");
        p.textContent = x(`تركت ${blanks} فراغ/فراغات. في الاختبار، التخمين أفضل من الترك. اضغط «سلّم» مرة أخرى للمتابعة.`, `You left ${blanks} blank. In the test a guess beats a blank. Press Submit again to continue.`);
        form.querySelector(".ls-actions").before(p);
        return;
      }
      const items = T.gaps.map((g) => ({ n: g.n, given: S.answers[g.n] || "", result: mark(g, S.answers[g.n]) }));
      const score = items.filter((i) => i.result === "right").length;
      S.attempts++; S.result = { score, of: T.gaps.length, items, at: new Date().toISOString() };
      S.best = Math.max(S.best ?? 0, score);
      markDone("listen"); save();
      feedback();
    };
  }

  /* ---------- feedback ---------- */
  const errLabel = { distractor: ["وقعت في الفخ", "Caught by the trap"], spelling: ["خطأ في التهجئة", "Spelling"], missed: ["فارغ", "Left blank"], other: ["إجابة مختلفة", "Different answer"], limit: ["تجاوز عدد الكلمات", "Over the word limit"], right: ["صحيح", "Correct"] };
  function feedback() {
    const T = L.task, R = S.result;
    show("listen", `
      <h2>${x("نتيجتك والتفسير", "Your answers, explained")}</h2>
      <div class="ls-scoreline"><span class="ls-score"><b>${R.score}</b>/${R.of}</span><span>${x("نتيجة تدريبية، وليست درجة IELTS.", "Practice score, not an IELTS band.")}</span></div>
      <ol class="ls-fblist">${R.items.map((it) => {
        const g = T.gaps.find((g) => g.n === it.n);
        const ok = it.result === "right";
        const lines = g.lines.map((li) => T.script[li - 1]);
        const rx = (w) => new RegExp(`(${w.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "i");
        const hl = (l) => { let out = esc(l.show || l.en);
          if (g.hl.distractor) out = out.replace(rx(g.hl.distractor), "<s class='dis'>$1</s>");
          return out.replace(rx(g.hl.answer), "<mark>$1</mark>"); };
        return `<li class="${ok ? "is-ok" : "is-bad"}">
          <div class="ls-fbhead"><b>${g.n}</b> <span class="ls-given">${it.given ? esc(it.given) : "—"}</span>
            <span class="ls-tag ${it.result}">${x(...errLabel[it.result])}</span>${ok ? "" : `<span class="ls-correct">${x("الإجابة:", "Answer:")} <b>${esc(g.display)}</b></span>`}</div>
          <p class="ls-why">${rich(t(g.why))}</p>
          <blockquote lang="en" dir="ltr">${lines.map((l) => `<p><span class="spk">${esc(T.speakers[l.speaker].en)}:</span> ${hl(l)}</p>`).join("")}</blockquote>
          <button class="btn ghost sm" data-replay="${g.n}">🔊 ${x("استمع لهذا الجزء", "Hear this part again")}</button>
        </li>`;
      }).join("")}</ol>
      <details class="ls-transcript"><summary>${x("النص الكامل", "Full transcript")}</summary>${T.script.map((l) => `<p lang="en" dir="ltr"><span class="spk">${esc(T.speakers[l.speaker].en)}:</span> ${esc(l.show || l.en)}</p>`).join("")}</details>
      <div class="ls-actions"><button class="btn primary" data-next>${x("التالي: عيادة التهجئة", "Next: spelling clinic")}</button><button class="btn ghost" data-again>${x("أعد المحاولة", "Try the task again")}</button></div>`);
    root.querySelectorAll("[data-replay]").forEach((b) => b.onclick = () => { const g = T.gaps.find((g) => g.n === +b.dataset.replay); playLines(g.lines.map((li) => T.script[li - 1]), null, null); });
    root.querySelector("[data-next]").onclick = () => go.spell();
    root.querySelector("[data-again]").onclick = () => { S.answers = {}; save(); listen(); };
  }

  /* ---------- spelling clinic ---------- */
  function spell() {
    const P = L.spelling;
    show("spell", `
      <h2>${t(P.title)}</h2>
      <p class="ls-sub">${t(P.intro)}</p>
      <div class="ls-spell">${P.items.map((it, i) => `<div class="ls-sitem" data-si="${i}"><div class="ls-sopts" role="group" aria-label="${x("الكلمة", "Word")} ${i + 1}" lang="en" dir="ltr">${it.options.map((o, j) => `<button class="ls-sopt" data-so="${j}">${esc(o)}</button>`).join("")}</div><p class="ls-stip" aria-live="polite"></p></div>`).join("")}</div>
      <div class="ls-actions"><button class="btn primary" data-next disabled>${x("أنهِ الدرس", "Finish the lesson")}</button></div>`);
    const next = root.querySelector("[data-next]");
    const check = () => { if (P.items.every((_, i) => S.spelling[i] !== undefined)) next.disabled = false; };
    root.querySelectorAll("[data-si]").forEach((row) => {
      const i = +row.dataset.si, it = P.items[i];
      const paint = (pick) => {
        row.querySelectorAll(".ls-sopt").forEach((b) => { const j = +b.dataset.so; b.disabled = true; b.classList.toggle("right", j === it.answer); b.classList.toggle("wrong", j === pick && j !== it.answer); });
        row.querySelector(".ls-stip").innerHTML = `<span class="${pick === it.answer ? "ok" : "bad"}">${pick === it.answer ? "✓" : "✗"}</span> ${esc(t(it.tip))}`;
      };
      if (S.spelling[i] !== undefined) paint(S.spelling[i]);
      row.querySelectorAll(".ls-sopt").forEach((b) => b.onclick = () => { S.spelling[i] = +b.dataset.so; save(); paint(+b.dataset.so); check(); });
    });
    next.onclick = () => { markDone("spell"); go.done(); };
    check();
  }

  /* ---------- completion ---------- */
  function finish() {
    const R = S.result || { score: 0, of: L.task.gaps.length, items: [] };
    if (!S.finished) S.finished = new Date().toISOString();
    markDone("done");
    const counts = R.items.reduce((m, it) => ((m[it.result] = (m[it.result] || 0) + 1), m), {});
    const worst = ["distractor", "spelling", "missed", "limit"].sort((a, b) => (counts[b] || 0) - (counts[a] || 0))[0];
    const drill = counts[worst] ? worst : "clean";
    const trapItems = R.items.filter((it) => L.task.gaps.find((g) => g.n === it.n).distractors.length);
    const badges = [
      { id: "trap", on: trapItems.length && trapItems.every((it) => it.result === "right"), en: "Trap spotter", ar: "صائد الفخاخ", d: { en: "Beat every correction trap", ar: "تجاوزت كل فخاخ التصحيح" } },
      { id: "spell", on: !counts.spelling && Object.entries(S.spelling).every(([i, v]) => v === L.spelling.items[i].answer), en: "Clean speller", ar: "تهجئة نظيفة", d: { en: "No spelling losses", ar: "لا أخطاء تهجئة" } },
      { id: "predict", on: L.task.gaps.every((g) => S.predict[g.n]?.first), en: "Sharp predictor", ar: "توقّع دقيق", d: { en: "All six predictions right first time", ar: "التوقعات الستة صحيحة من أول مرة" } },
      { id: "finish", on: true, en: "Lesson 1 complete", ar: "أنهيت الدرس 1", d: { en: "Finished the full route", ar: "أكملت المسار كاملًا" } },
    ];
    const c = 2 * Math.PI * 52, pct = R.of ? R.score / R.of : 0;
    show("done", `
      <div class="ls-done">
        <div class="ls-burst" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="--a:${i * 25.7}deg;--d:${(i % 5) * 0.05}s"></i>`).join("")}</div>
        <div class="ring big"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="52"/><circle class="val ls-ringval" cx="60" cy="60" r="52" stroke-dasharray="${c.toFixed(1)}" style="--off:${(c * (1 - pct)).toFixed(1)};stroke-dashoffset:${(c * (1 - pct)).toFixed(1)}"/></svg><div class="ring-label"><b>${R.score}/${R.of}</b><small>${x("تدريب", "practice")}</small></div></div>
        <h2>${x("أنهيت الدرس 1", "Lesson 1 complete")}</h2>
        <p class="ls-sub">${x("هذه نتيجة تدريبية على تمرين واحد، وليست درجة IELTS ولا توقعًا لها.", "This is a practice result on one task. It is not an IELTS band or a prediction of one.")}</p>
      </div>
      <ul class="ls-badges">${badges.map((b) => `<li class="${b.on ? "on" : ""}"><span class="ls-medal" aria-hidden="true">${b.on ? "★" : "☆"}</span><b>${t(b)}</b><small>${t(b.d)}</small><span class="sr">${b.on ? x("حصلت عليها", "earned") : x("لم تحصل عليها بعد", "not yet earned")}</span></li>`).join("")}</ul>
      <div class="ls-summary">
        <h3>${x("ما تعلّمته", "What you practised")}</h3>
        <ul>${L.goals.map((g) => `<li>${t(g)}</li>`).join("")}</ul>
        <h3>${x("خطوتك التالية", "Your next step")}</h3>
        <div class="ls-nextcard"><span class="ls-lock" aria-hidden="true">→</span><div><b>${t(L.next.title)}</b><p>${t(L.next.drills[drill])}</p><small>${x("قريبًا في النسخة التجريبية", "Coming next in the pilot")}</small></div></div>
      </div>
      ${demoBadge}
      <div class="ls-actions"><button class="btn ghost" data-again>${x("أعد مهمة الاستماع", "Retry the listening task")}</button><button class="btn ghost" data-reset>${x("ابدأ الدرس من جديد", "Restart the lesson")}</button><a class="btn primary" href="learn.html">${x("عودة إلى دروس الأسبوع 1", "Back to week 1 lessons")}</a></div>`);
    root.querySelector("[data-again]").onclick = () => { S.answers = {}; save(); listen(); };
  }

  /* ---------- wiring ---------- */
  root.addEventListener("click", (e) => {
    const g = e.target.closest("[data-go]"); if (g) { const f = go[g.dataset.go] || go.film; if (g.dataset.go === "listen" && S.result) feedback(); else f(); }
    if (e.target.closest("[data-reset]")) { stopSpeech(); S = blank(); save(); intro(); }
  });
  addEventListener("pagehide", stopSpeech);
  intro();
})();
