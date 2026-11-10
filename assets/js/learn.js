/* Week 1 self-paced lessons for the IELTS Academic Band 6 Sprint.
   Content from ruwad/academic/02-week1-lessons.md (original, draft for instructor review). */
(() => {
  "use strict";
  const root = document.querySelector("[data-learn]");
  if (!root || !window.RUWAD) return;
  const { store, t, esc, LESSONS } = window.RUWAD;
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const prog = store.get("learn", {});
  const save = (id, v) => { const was = prog[id] && prog[id].done; prog[id] = { ...(prog[id] || {}), ...v, at: new Date().toISOString() }; store.set("learn", prog); if (v.done && !was && window.RUWAD.track) window.RUWAD.track("lesson_complete"); };
  const norm = (s) => String(s || "").trim().toLowerCase().replace(/[.\s]+$/, "").replace(/\s+/g, " ");

  // Light gamification (XP, daily streak, badges). Stored separately in "ruwad.game" so the
  // dashboard's "ruwad.learn" shape is untouched. XP is derived from best scores, so re-checking can't farm it.
  const game = store.get("game", { best: {}, days: [] });
  game.best = game.best || {}; game.days = game.days || [];
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const logDay = () => { const k = dayKey(); if (!game.days.includes(k)) { game.days.push(k); game.days = game.days.slice(-60); } };
  const streak = () => {
    const set = new Set(game.days); const d = new Date();
    if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1); // a streak stays alive until the end of today
    let n = 0; while (set.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };
  const xp = () => Object.values(game.best).reduce((a, b) => a + (b.r || 0) * 10, 0) + LESSONS.filter((l) => prog[l.id] && prog[l.id].done).length * 20;
  const BADGES = [
    { id: "first", icon: "★", ar: "الخطوة الأولى", en: "First step", desc: ["أكملت أول درس", "Finished your first lesson"], ok: () => LESSONS.some((l) => prog[l.id] && prog[l.id].done) },
    { id: "perfect", icon: "◆", ar: "علامة كاملة", en: "Perfect round", desc: ["كل الإجابات صحيحة في درس", "Every answer right in one lesson"], ok: () => Object.values(game.best).some((b) => b.n > 1 && b.r === b.n) },
    { id: "linker", icon: "⛓", ar: "سيد الروابط", en: "Linker master", desc: ["كل روابط المختبر صحيحة", "All linker lab items right"], ok: () => Boolean(game.linker) },
    { id: "streak3", icon: "▲", ar: "3 أيام متتالية", en: "3-day streak", desc: ["تدربت 3 أيام متتالية", "Practised 3 days in a row"], ok: () => streak() >= 3 },
    { id: "week1", icon: "⚑", ar: "أنهيت الأسبوع 1", en: "Week 1 done", desc: ["أكملت كل دروس الأسبوع", "Finished every week 1 lesson"], ok: () => LESSONS.every((l) => prog[l.id] && prog[l.id].done) },
  ];
  // The streak is optional (journey v2): students can hide it on the practice page or in the goal step.
  const streakOn = () => (store.get("journey", {}) || {}).streak !== false;
  const earned = () => BADGES.filter((b) => b.ok() && (b.id !== "streak3" || streakOn())).map((b) => b.id);
  // Wrong answers go to the shared mistake bank so they come back in revision (practice.html).
  const logMistake = (el) => {
    const J = window.RUWAD.journey; if (!J) return;
    const lab = el.classList.contains("lab-item");
    const q = lab ? `Choose the linker: ${$(".lab-sentence", el).textContent.replace(/\s+/g, " ").trim().replace("?", "___")}` : ($(".q-text", el) || el).textContent.replace(/^\s*\d+\.\s*/, "").trim();
    const why = $(".why", el);
    J.mistake({ id: `week1:${location.hash.slice(1) || LESSONS[0].id}:${el.dataset.item}`, src: "week1", tag: lab ? "linkers" : "week1", kind: "mcq", q, o: $$(".opt span", el).map((s) => s.textContent), a: Number(el.dataset.answer), why: why ? why.textContent : "" });
  };
  if (!game.seen) game.seen = earned(); // don't announce badges for progress made before this feature existed
  const gameBar = () => {
    const have = earned();
    return `<div class="game-bar" data-game>
      <div class="game-stats">
        <p class="game-stat"><b data-xp>${xp()}</b> <span>${t("نقطة", "XP")}</span></p>
        ${streakOn() ? `<p class="game-stat"><b data-streak>${streak()}</b> <span>${t("أيام متتالية", "day streak")}</span></p>` : ""}
      </div>
      <ul class="badges" aria-label="${t("الشارات", "Badges")}">${BADGES.map((b) => `<li class="badge${have.includes(b.id) ? " on" : ""}" title="${esc(t(b.desc[0], b.desc[1]))}"><span aria-hidden="true">${b.icon}</span><span class="visually-hidden">${esc(t(b.ar, b.en))}: ${have.includes(b.id) ? t("مكتسبة", "earned") : t("لم تُكتسب بعد", "not yet earned")}</span></li>`).join("")}</ul>
    </div>`;
  };

  // Multiple-choice block: items [{q, o:[...], a, why?}]
  const mcq = (items, name) => items.map((it, i) => `
    <fieldset class="item" data-item="${i}" data-answer="${it.a}">
      <legend class="q-text" lang="en">${i + 1}. ${esc(it.q)}</legend>
      <div class="options q-options">${it.o.map((o, j) => `<label class="opt" lang="en"><input type="radio" name="${name}-${i}" value="${j}"><span>${esc(o)}</span></label>`).join("")}</div>
      <p class="feedback" aria-live="polite" dir="${window.RUWAD.AR ? "rtl" : "ltr"}"></p>
      ${it.why ? `<p class="why" hidden lang="en">${esc(it.why)}</p>` : ""}
    </fieldset>`).join("");

  // Gap/typing block: items [{q, a:[accepted...], show}]
  const gaps = (items) => items.map((it, i) => `
    <div class="item field" data-item="${i}" data-accept="${esc(JSON.stringify(it.a))}" data-show="${esc(it.show || it.a[0])}" dir="ltr" lang="en">
      <label for="g-${i}">${i + 1}. ${esc(it.q)}</label>
      <input id="g-${i}" autocomplete="off" spellcheck="false">
      <p class="feedback" aria-live="polite" dir="${window.RUWAD.AR ? "rtl" : "ltr"}"></p>
    </div>`).join("");

  function checkItem(el) {
    const fb = $(".feedback", el);
    let ok;
    if (el.dataset.answer !== undefined) {
      const picked = $("input:checked", el);
      ok = picked && Number(picked.value) === Number(el.dataset.answer);
      const why = $(".why", el); if (why) why.hidden = false;
      const ans = `<bdi lang="en">${esc(el.querySelectorAll(".opt span")[el.dataset.answer].textContent)}</bdi>`;
      fb.innerHTML = !picked ? t("لم تُجب.", "Not answered.") : ok ? t("صحيح.", "Correct.") : t(`غير صحيح. الإجابة: ${ans}`, `Not quite. Answer: ${ans}`);
    } else if (el.dataset.accept) {
      const v = norm($("input, select", el).value);
      ok = JSON.parse(el.dataset.accept).map(norm).includes(v);
      const ans = `<bdi lang="en">${esc(el.dataset.show)}</bdi>`;
      fb.innerHTML = ok ? t("صحيح.", "Correct.") : t(`الإجابة: ${ans}`, `Answer: ${ans}`);
    }
    el.classList.toggle("right", Boolean(ok)); el.classList.toggle("wrong", !ok);
    return Boolean(ok);
  }
  function checkAll() {
    let right = 0, total = 0;
    $$(".item").forEach((el) => { total++; if (checkItem(el)) right++; }); // wrong choices were already logged when picked
    return [right, total];
  }

  // Visual grammar explainer: linking words. Draft for instructor review; examples reuse the
  // Band 6 paragraph's own linkers (For example, However, which, as/because).
  const LINK_TYPES = [
    { k: "contrast", icon: "⇄", ar: "تضاد", en: "Contrast", words: "However, … / Although …" },
    { k: "example", icon: "→", ar: "مثال", en: "Example", words: "For example, …" },
    { k: "reason", icon: "←", ar: "سبب", en: "Reason", words: "because … / as …" },
    { k: "extra", icon: "+", ar: "معلومة إضافية", en: "Extra detail", words: ", which …" },
  ];
  const LAB = [
    { a: "Many graduates now apply online.", b: "this can feel impersonal.", o: ["However,", "Because", "For example,"], c: 0, k: "contrast", why: "The second idea goes against the first, so we need contrast. \"However,\" starts a new sentence and takes a comma." },
    { a: "Internships build practical skills.", b: "engineering students learn safety procedures on site.", o: ["Although", "For example,", "Which"], c: 1, k: "example", why: "The second sentence is a specific case of the first, so it is an example." },
    { a: "Students can compare several offers online,", b: "saves time.", o: ["who", "which", "what"], c: 1, k: "extra", why: "\", which\" adds a comment about the whole first idea. \"who\" is only for people." },
    { a: "Applicants feel nervous", b: "they rarely speak to a real person.", o: ["because", "however", "for example"], c: 0, k: "reason", why: "The second part explains why, so it is a reason. \"because\" joins the two parts with no comma." },
    { a: "", b: "online applications save time, they can feel impersonal.", o: ["Although", "Because", "For example,"], c: 0, k: "contrast", why: "\"Although\" shows contrast inside one sentence: Although X, Y. Don't add \"but\" as well." },
  ];
  const linkerLab = () => `
    <section class="linker-lab" aria-labelledby="lab-title">
      <h3 id="lab-title">${t("مختبر الروابط: القواعد بالصور", "Linker lab: grammar you can see")}</h3>
      <p>${t("الروابط تخبر القارئ بالعلاقة بين فكرتين. هذه أكثر أربع علاقات تحتاجها في الدرجة 6:", "Linkers tell the reader how two ideas connect. These four relationships matter most for Band 6 writing:")}</p>
      <ul class="link-map">${LINK_TYPES.map((x) => `<li class="link-card" data-kind="${x.k}"><span class="link-icon" aria-hidden="true">${x.icon}</span><b>${t(x.ar, x.en)}</b><span lang="en" dir="ltr">${x.words}</span></li>`).join("")}</ul>
      <p>${t("اختر الرابط المناسب. أول إجابة هي التي تُحسب، وترى الجملة تكتمل أمامك.", "Pick the right linker. Your first answer counts, and you'll see the sentence snap together.")}</p>
      ${LAB.map((it, i) => `
      <fieldset class="item lab-item" data-item="lab${i}" data-answer="${it.c}" data-kind="${it.k}">
        <legend class="visually-hidden">${t(`جملة ${i + 1}`, `Sentence ${i + 1}`)}</legend>
        <p class="lab-sentence" dir="ltr" lang="en">${it.a ? `<span class="clause">${esc(it.a)}</span> ` : ""}<span class="slot" aria-hidden="true">?</span> <span class="clause">${esc(it.b)}</span></p>
        <div class="options q-options">${it.o.map((o, j) => `<label class="opt" lang="en"><input type="radio" name="lab-${i}" value="${j}"><span>${esc(o)}</span></label>`).join("")}</div>
        <p class="feedback" aria-live="polite" dir="${window.RUWAD.AR ? "rtl" : "ltr"}"></p>
        <p class="why" hidden lang="en">${esc(it.why)}</p>
      </fieldset>`).join("")}
    </section>`;

  const L = {
    "test-map": {
      body: () => `
        <p>${t("اختبار IELTS الأكاديمي من أربعة أجزاء. احفظ هذه الخريطة، ثم أجب عن الأسئلة الخمسة.", "IELTS Academic has four parts. Learn this map, then answer the five questions.")}</p>
        <div class="table-wrap" dir="ltr" lang="en"><table class="data">
          <thead><tr><th>Part</th><th>Time</th><th>What's in it</th></tr></thead>
          <tbody>
            <tr><td>Listening</td><td>about 30 min (+ transfer time on paper)</td><td>4 sections, 40 questions; everyday conversations and monologues, then academic ones</td></tr>
            <tr><td>Reading</td><td>60 min</td><td>3 long passages, 40 questions; T/F/NG, headings, matching, completion</td></tr>
            <tr><td>Writing</td><td>60 min</td><td>Task 1: describe visual data (150+ words, about 20 min). Task 2: essay (250+ words, about 40 min; counts for more)</td></tr>
            <tr><td>Speaking</td><td>11–14 min</td><td>Part 1 everyday questions; Part 2 a 1–2 min talk after 1 min of preparation; Part 3 discussion</td></tr>
          </tbody></table></div>
        <p class="small muted">${t("راجع التفاصيل على صفحة صيغة الاختبار في الموقع الرسمي ielts.org، فالصيغة قد تتغير.", "Check the details on the official ielts.org test-format page, as formats can change.")}</p>
        <h3>${t("اختبر نفسك", "Check yourself")}</h3>
        ${mcq([
          { q: "Which writing task counts for more?", o: ["Task 1", "Task 2", "They count the same"], a: 1 },
          { q: "How long do you get to prepare in Speaking Part 2?", o: ["30 seconds", "1 minute", "2 minutes"], a: 1 },
          { q: "How many reading passages are there?", o: ["2", "3", "4"], a: 1 },
          { q: "What is the minimum number of words for Task 1?", o: ["100", "150", "250"], a: 1 },
          { q: "True or false: you get extra time to transfer reading answers.", o: ["True", "False"], a: 1, why: "False. The extra transfer time is for listening on paper only." },
        ], "tm")}`,
      check: true,
    },
    band6: {
      body: () => `
        <p>${t("اقرأ الفقرتين. أيهما أقرب إلى مستوى الدرجة 6؟", "Read both paragraphs. Which is closer to Band 6?")}</p>
        <div class="q-passage" dir="ltr" lang="en"><p><b>Paragraph A:</b> Nowadays technology is very important. Many people use technology. Technology is good and bad. In my opinion technology is good because people use it every day and it is important for everyone in the world.</p>
        <p><b>Paragraph B:</b> Technology has changed how young people look for jobs. For example, many graduates in Saudi Arabia now apply for training programmes online, which saves time and allows them to compare several offers. However, this can also make the process feel impersonal, as applicants rarely speak to a real person until the interview stage.</p></div>
        ${mcq([{ q: "Which paragraph is closer to Band 6?", o: ["Paragraph A", "Paragraph B"], a: 1, why: "B develops one clear idea, gives a specific example, links ideas (For example, However, which, as) and repeats words less. A repeats \"technology\" and \"important\" and says nothing specific. B is closer to Band 6–6.5 (our teaching estimate, not an official band)." }], "b6")}
        ${linkerLab()}
        <h3>${t("معايير الكتابة الأربعة بكلمات بسيطة", "The four writing criteria in plain words")}</h3>
        <ul class="prose">
          <li>${t("الإجابة عن المهمة: هل أجبت عن كل أجزاء السؤال برأي واضح؟", "Task response: did you answer every part of the question with a clear position?")}</li>
          <li>${t("الترابط والتماسك: هل الأفكار مرتبة ومترابطة؟", "Coherence and cohesion: are your ideas organised and linked?")}</li>
          <li>${t("المفردات: هل كلماتك دقيقة ومتنوعة؟", "Vocabulary: are your words precise and varied?")}</li>
          <li>${t("القواعد: هل جملك متنوعة وأخطاؤها قليلة؟", "Grammar: are your sentences varied, with few errors?")}</li>
        </ul>`,
      check: true,
    },
    "task2-types": {
      body: () => {
        const types = ["Opinion", "Discussion", "Advantages/Disadvantages", "Problem/Solution", "Two-part"];
        const items = [
          ["Some people believe that students should be required to complete an internship before graduating. To what extent do you agree or disagree?", 0],
          ["Some people think young graduates should take the first job they are offered, while others believe they should wait for a job that matches their skills. Discuss both views and give your opinion.", 1],
          ["More companies now allow employees to work from home. What are the advantages and disadvantages of this trend?", 2],
          ["Many cities suffer from heavy traffic. What problems does this cause, and what can be done to reduce it?", 3],
          ["Many people now learn new skills through online videos rather than formal courses. Why is this happening? Is it a positive or negative development?", 4],
          ["Governments should spend more money on public sports facilities than on professional sports teams. Do you agree or disagree?", 0],
          ["Some say that online shopping will eventually replace traditional shops. Discuss both views and give your opinion.", 1],
          ["Young people today are spending less time reading books. What are the causes, and what are the solutions?", 3],
          ["The number of people choosing to live alone is increasing. Do the advantages of this outweigh the disadvantages?", 2],
          ["Some employers value work experience more than university qualifications. Why might this be? Do you think this is fair?", 4],
        ];
        return `<p>${t("صنّف كل سؤال من أسئلة المهمة الثانية في نوعه. معرفة النوع تحدد شكل مقالك.", "Sort each Task 2 prompt into its type. Knowing the type decides the shape of your essay.")}</p>
          ${items.map(([q, a], i) => `<div class="item field sort" data-item="${i}" data-accept="${esc(JSON.stringify([String(a)]))}" data-show="${types[a]}" dir="ltr" lang="en">
            <label for="s-${i}">${i + 1}. ${esc(q)}</label>
            <select id="s-${i}"><option value="">Choose a type</option>${types.map((ty, j) => `<option value="${j}">${ty}</option>`).join("")}</select>
            <p class="feedback" aria-live="polite" dir="${window.RUWAD.AR ? "rtl" : "ltr"}"></p></div>`).join("")}
          <p class="small muted">${t("ملاحظة للمعلم: في السؤال 9 كلمة «outweigh» تعني أن عليك إبداء رأي. في السؤال 10 يجب الإجابة عن السؤالين.", "Teaching note: in prompt 9, \"outweigh\" means you must give an opinion. In prompt 10, answer both questions or Task Response drops.")}</p>`;
      },
      check: true,
    },
    thesis: {
      body: () => `
        <p lang="en" dir="ltr" class="q-passage"><b>Prompt:</b> Some people believe that students should be required to complete an internship before graduating. To what extent do you agree or disagree?</p>
        ${mcq([{ q: "Which thesis statement is best?", o: ["Internships are a very important topic nowadays.", "I agree that internships are good.", "I strongly agree that internships should be compulsory, since they give students practical skills and make it easier for employers to judge graduates."], a: 2, why: "The first has no position. The second has a position but is vague, with no reasons. The third gives a clear position with two reasons that become the two body paragraphs." }], "th")}
        <h3>${t("خطة الخمس دقائق (نموذج)", "The five-minute plan (model)")}</h3>
        <pre class="plan-model" dir="ltr" lang="en">Type: Opinion (strongly agree)
Thesis: compulsory internships → practical skills + easier hiring
BP1: practical skills → classroom ≠ workplace; e.g. engineering student learns safety procedures on site
BP2: employers → internship = evidence; e.g. many GDPs ask about work experience in interviews
Conclusion: restate + recommendation (universities partner with companies)</pre>
        <h3>${t("قائمة التحقق", "Checklist")}</h3>
        <ul class="prose" lang="en" dir="ltr"><li>Did I answer every part?</li><li>Is my position clear in the introduction?</li><li>Does each body paragraph have one main idea with an example?</li><li>Will my conclusion match my introduction?</li></ul>`,
      check: true,
    },
    listening: {
      body: () => `
        <p>${t("التسجيل الصوتي قيد الإعداد. حتى ذلك الحين تدرّب على النص المكتوب: اقرأ المكالمة وأكمل النموذج. انتبه للمتحدث عندما يصحح نفسه.", "The audio is being recorded. Until then, practise with the transcript: read the call and complete the form. Watch for the speaker correcting themselves.")}</p>
        <details class="q-passage" dir="ltr" lang="en"><summary>Transcript: Riyadh Community Skills Centre</summary>
        <p><b>Receptionist:</b> Good morning, Riyadh Community Skills Centre. How can I help?<br><b>Caller:</b> Hi, I'd like to register for one of your evening courses.<br><b>R:</b> Of course. Can I take your name, please?<br><b>C:</b> Yes, it's Faisal Al-Harbi. That's H-A-R-B-I.<br><b>R:</b> Thank you. And which course are you interested in?<br><b>C:</b> I was thinking about the photography course, but actually I've changed my mind. I'd like to do the graphic design course for beginners.<br><b>R:</b> Good choice. We run that on Mondays and Wednesdays. Which day suits you?<br><b>C:</b> Mondays are difficult because of work, so Wednesday, please.<br><b>R:</b> No problem. The next group starts on the 5th of March. Oh, sorry, I'm looking at last year's dates. It's the 12th of March.<br><b>C:</b> That's fine.<br><b>R:</b> The fee is three hundred and fifty riyals… no, wait, for beginners it's four hundred and twenty.<br><b>C:</b> OK. Do I pay now?<br><b>R:</b> You can pay on the first day. One last question: how did you hear about us?<br><b>C:</b> A friend told me… well, actually I saw your post on Instagram first, and then my friend recommended you.</p></details>
        <h3 lang="en" dir="ltr">Registration form</h3>
        ${gaps([
          { q: "Name: Faisal ______", a: ["al-harbi", "alharbi", "al harbi"], show: "Al-Harbi" },
          { q: "Course chosen: ______ for beginners", a: ["graphic design"] },
          { q: "Day preferred: ______", a: ["wednesday"], show: "Wednesday" },
          { q: "Start date: ______ March", a: ["12", "12th"], show: "12th" },
          { q: "Fee: SAR ______", a: ["420"] },
          { q: "How did you hear about us? ______", a: ["instagram"], show: "Instagram" },
        ])}
        <h3>${t("فخاخ الإملاء: صحّح الكلمة", "Spelling traps: fix the word")}</h3>
        <div data-group="spell">${gaps([
          { q: "wensday", a: ["wednesday"], show: "Wednesday" },
          { q: "libary", a: ["library"] },
          { q: "accomodation", a: ["accommodation"] },
          { q: "fourty", a: ["forty"] },
          { q: "goverment", a: ["government"] },
        ]).replace(/id="g-(\d)"/g, 'id="sp-$1"').replace(/for="g-(\d)"/g, 'for="sp-$1"')}</div>`,
      check: true,
    },
    speaking1: {
      body: () => `
        <p>${t("أجب عن كل سؤال بصوت عالٍ في 2 إلى 4 جمل: الإجابة + السبب + مثال. سجّل إجاباتك بهاتفك واستمع إليها. لا تقرأ من نص مكتوب.", "Answer each question aloud in 2–4 sentences: answer + reason + example. Record yourself on your phone and listen back. Don't read from a script.")}</p>
        <ol class="prose" lang="en" dir="ltr">
          <li>Do you work or are you a student?</li><li>What do you enjoy most about your studies or job?</li><li>How do you usually spend your weekends?</li>
          <li>Do you prefer to study alone or with other people? Why?</li><li>How often do you use English in your daily life?</li><li>Is there a skill you would like to learn in the future?</li>
        </ol>
        <fieldset class="selfcheck"><legend>${t("قيّم نفسك بعد الاستماع", "Check yourself after listening")}</legend>
          ${[t("أعطيت سببًا في كل إجابة", "I gave a reason in every answer"), t("أعطيت مثالًا واحدًا على الأقل", "I gave at least one example"), t("لم أتوقف طويلًا", "I didn't pause for long"), t("لم أقرأ من ورقة", "I didn't read from notes")].map((c, i) => `<label class="check"><input type="checkbox" data-self="${i}"> <span>${c}</span></label>`).join("")}
        </fieldset>
        <p class="small muted">${t("في الدورة ترفع تسجيلك ويعطيك المعلم ملاحظات.", "In the course you upload your recording and your teacher gives feedback.")}</p>`,
      done: t("سجّلت إجاباتي", "I've recorded my answers"),
    },
    w1: {
      body: () => `
        <div class="q-passage" dir="ltr" lang="en"><p><b>Graded task W1 (Task 2)</b></p><p>Some people think young graduates should take the first job they are offered, while others believe they should wait for a job that matches their skills. Discuss both views and give your opinion.</p><p>Write at least 250 words. Time yourself: 40 minutes.</p></div>
        <div class="w-tools"><button class="btn ghost sm" type="button" data-timer>${t("ابدأ مؤقت 40 دقيقة", "Start a 40-minute timer")}</button><span data-clock aria-live="off"></span></div>
        <div class="field" dir="ltr" lang="en"><label for="essay" class="visually-hidden">Your essay</label><textarea id="essay" rows="14" spellcheck="false">${esc((prog.w1 && prog.w1.text) || "")}</textarea>
        <div class="hint"><span data-words>0</span> words</div></div>
        <p class="small muted">${t("التدقيق الإملائي مغلق كما في الاختبار. تصلك ملاحظات وفق المعايير الأربعة: يجهز الذكاء الاصطناعي مسودتها ويعتمدها معلم مؤهل. (نسخة تجريبية: يُحفظ في متصفحك فقط ولا يُرسل.)", "Spellcheck is off, as in the test. You get feedback on the four criteria: AI drafts it and a qualified teacher approves it. (Prototype: saved in your browser only, not sent.)")}</p>`,
      submit: true,
    },
  };

  function render() {
    const id = (location.hash.slice(1) && L[location.hash.slice(1)]) ? location.hash.slice(1) : LESSONS[0].id;
    const i = LESSONS.findIndex((l) => l.id === id);
    const lesson = L[id];
    const doneCount = LESSONS.filter((l) => prog[l.id] && prog[l.id].done).length;
    root.innerHTML = `
      <nav class="learn-nav" aria-label="${t("دروس الأسبوع الأول", "Week 1 lessons")}">
        <p class="small muted">${t(`${doneCount} من ${LESSONS.length} مكتملة`, `${doneCount} of ${LESSONS.length} done`)}</p>
        <div class="meter"><i style="width:${(doneCount / LESSONS.length) * 100}%"></i></div>
        ${gameBar()}
        <ol>${LESSONS.map((l) => `<li><a href="#${l.id}"${l.id === id ? ' aria-current="step"' : ""} class="${prog[l.id] && prog[l.id].done ? "done" : ""}">${t(l.ar, l.en)}</a></li>`).join("")}</ol>
      </nav>
      <article class="lesson panel" aria-labelledby="lesson-title">
        <p class="q-count">${t(`الدرس ${i + 1} من ${LESSONS.length}`, `Lesson ${i + 1} of ${LESSONS.length}`)}</p>
        <h2 id="lesson-title" tabindex="-1">${t(LESSONS[i].ar, LESSONS[i].en)}</h2>
        ${lesson.body()}
        <p class="form-msg" role="status" aria-live="polite"></p>
        <div class="flow-nav">
          ${i > 0 ? `<a class="btn ghost" href="#${LESSONS[i - 1].id}">${t("الدرس السابق", "Previous lesson")}</a>` : "<span></span>"}
          <span style="display:flex;gap:.75rem;flex-wrap:wrap">
            ${lesson.check ? `<button class="btn" type="button" data-check>${t("تحقق من إجاباتي", "Check my answers")}</button>` : ""}
            ${lesson.done ? `<button class="btn" type="button" data-mark>${lesson.done}</button>` : ""}
            ${lesson.submit ? `<button class="btn" type="button" data-submit>${t("سلّم المقال", "Submit essay")}</button>` : ""}
            ${i < LESSONS.length - 1 ? `<a class="btn ghost" href="#${LESSONS[i + 1].id}" data-nextlesson>${t("الدرس التالي", "Next lesson")}</a>` : `<a class="btn ghost" href="dashboard.html">${t("إلى لوحتي", "To my dashboard")}</a>`}
          </span>
        </div>
      </article>
      <div class="game-toast" role="status" aria-live="polite" data-toast></div>`;
    const msg = $(".form-msg");
    const ok = (text) => { msg.className = "form-msg show ok"; msg.textContent = text; };
    const bad = (text) => { msg.className = "form-msg show bad"; msg.textContent = text; };
    // Instant feedback: picking an option marks it at once and locks the question.
    $$("fieldset.item[data-answer]").forEach((el) => el.addEventListener("change", () => {
      const right = checkItem(el);
      if (!right) logMistake(el);
      $$("input", el).forEach((r) => { r.disabled = true; });
      const slot = $(".slot", el);
      if (slot) { slot.textContent = el.querySelectorAll(".opt span")[el.dataset.answer].textContent; el.classList.add("snapped"); }
      if (el.classList.contains("lab-item") && $$(".lab-item").every((x) => x.classList.contains("snapped"))) {
        if ($$(".lab-item").every((x) => x.classList.contains("right"))) { game.linker = true; award(); }
      }
      el.classList.add(right ? "pop" : "shake");
    }));
    const chk = $("[data-check]");
    if (chk) chk.addEventListener("click", () => {
      const [r, n] = checkAll();
      $$("fieldset.item[data-answer] input").forEach((x) => { x.disabled = true; });
      save(id, { done: true, score: `${r}/${n}` });
      const prev = game.best[id];
      if (!prev || r > prev.r) game.best[id] = { r, n };
      ok(t(`نتيجتك ${r} من ${n}. حُفظ تقدمك.`, `You got ${r} of ${n}. Progress saved.`) + (r === n && n > 1 ? " " + t("علامة كاملة!", "Perfect round!") : ""));
      if (r === n && n > 1) celebrate();
      award();
      updateNav();
    });
    const mark = $("[data-mark]");
    if (mark) mark.addEventListener("click", () => {
      const ticks = $$("[data-self]").filter((c) => c.checked).length;
      save(id, { done: true, score: `${ticks}/4` });
      ok(t("أحسنت. حُفظ تقدمك.", "Well done. Progress saved."));
      award();
      updateNav();
    });
    const essay = $("#essay");
    if (essay) {
      const wc = () => { const n = (essay.value.trim().match(/\S+/g) || []).length; $("[data-words]").textContent = n; return n; };
      essay.addEventListener("input", wc); wc();
      let timer = null;
      $("[data-timer]").addEventListener("click", (e) => {
        if (timer) return;
        let left = 40 * 60; e.target.disabled = true;
        const clock = $("[data-clock]");
        const tick = () => { const m = Math.floor(left / 60), s = left % 60; clock.textContent = `${m}:${String(s).padStart(2, "0")}`; if (left-- <= 0) { clearInterval(timer); clock.textContent = t("انتهى الوقت", "Time's up"); } };
        tick(); timer = setInterval(tick, 1000);
      });
      $("[data-submit]").addEventListener("click", () => {
        const n = wc();
        if (n < 250) { bad(t(`مقالك ${n} كلمة. المطلوب 250 كلمة على الأقل.`, `Your essay has ${n} words. At least 250 are required.`)); essay.focus(); return; }
        save(id, { done: true, text: essay.value, words: n, status: "submitted" });
        award();
        ok(t("سُلّم المقال. سيظهر تصحيح المعلم في لوحتك. (نسخة تجريبية: لم يُرسل)", "Essay submitted. Teacher feedback will appear on your dashboard. (Prototype: not sent)"));
        updateNav();
      });
    }
  }
  // Save game state, refresh the bar, and announce any badge earned just now.
  function award() {
    const before = new Set(game.seen || []);
    logDay();
    const now = earned();
    game.seen = now;
    store.set("game", game);
    const bar = root.querySelector("[data-game]");
    if (bar) bar.outerHTML = gameBar();
    const fresh = BADGES.filter((b) => now.includes(b.id) && !before.has(b.id));
    const toast = root.querySelector("[data-toast]");
    if (fresh.length && toast) {
      toast.textContent = t(`شارة جديدة: ${fresh.map((b) => b.ar).join("، ")}`, `New badge: ${fresh.map((b) => b.en).join(", ")}`);
      toast.classList.remove("show"); void toast.offsetWidth; toast.classList.add("show");
      clearTimeout(award.timer); award.timer = setTimeout(() => toast.classList.remove("show"), 3500);
    }
  }
  function celebrate() {
    const art = root.querySelector(".lesson");
    if (!art || art.querySelector(".burst")) return;
    const b = document.createElement("div"); b.className = "burst"; b.setAttribute("aria-hidden", "true");
    b.innerHTML = Array.from({ length: 14 }, (_, k) => `<i style="--a:${k * 26}deg;--d:${60 + (k % 4) * 18}px"></i>`).join("");
    art.appendChild(b); setTimeout(() => b.remove(), 1400);
  }
  function updateNav() {
    const doneCount = LESSONS.filter((l) => prog[l.id] && prog[l.id].done).length;
    $(".learn-nav .small").textContent = t(`${doneCount} من ${LESSONS.length} مكتملة`, `${doneCount} of ${LESSONS.length} done`);
    $(".learn-nav .meter i").style.width = `${(doneCount / LESSONS.length) * 100}%`;
    $$(".learn-nav a").forEach((a) => a.classList.toggle("done", Boolean(prog[a.hash.slice(1)] && prog[a.hash.slice(1)].done)));
  }
  window.addEventListener("hashchange", () => { render(); $("#lesson-title").focus({ preventScroll: true }); root.scrollIntoView({ block: "start" }); });
  render();
})();
