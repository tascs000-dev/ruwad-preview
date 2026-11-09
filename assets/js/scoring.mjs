// Ruwad placement scoring: the single implementation of academic/03-placement-test.md (v1.1, uncalibrated).
// Contract: the website build copies this file into dist/ and server/. Keep it dependency-free and keep the exports
// (PARTS, CUTOFFS, WRITING_GATE, ADMISSION, KEYS, scoreListening, skillNote, place, DESIGN_BAND, bandToGroup) stable.
// No dependencies. Used by the website (online part) and by teachers (full result after Part D is marked).
// Students only ever see the group and the strengths/work-on note: never a total, a percentage or a band.

export const PARTS = { A: 15, B: 10, C: 6, D: 8 };           // max points per part (total 39)
export const CUTOFFS = { B: 18, S: 24, "S+": 32 };            // minimum total for each group out of 39
export const WRITING_GATE = 3;                               // Part D below this keeps a student out of S/S+
export const ADMISSION = {                                   // D-009 (9 Nov 2026)
  F: "not_admitted",      // free self-study plan + foundation waitlist
  B: "consent_required",  // admit only with a written warning that 4 weeks may not be enough
  S: "admitted",
  "S+": "admitted",
};
export const KEYS = {                                        // Part C answer key (ONE WORD AND/OR A NUMBER)
  C: [["14", "14th"], ["8:45", "8.45", "845"], ["c"], ["id"], ["5", "five"], ["sunday"]],
};

const groupFor = (total, max) => {
  const scale = max / 39;
  if (total >= CUTOFFS["S+"] * scale) return "S+";
  if (total >= CUTOFFS.S * scale) return "S";
  if (total >= CUTOFFS.B * scale) return "B";
  return "F";
};

function check(parts) {
  for (const [k, v] of Object.entries(parts)) {
    if (!(k in PARTS)) throw new Error(`unknown part ${k}`);
    if (v === null || v === undefined) continue;
    if (!Number.isFinite(v) || v < 0 || v > PARTS[k]) throw new Error(`part ${k} must be 0–${PARTS[k]}, got ${v}`);
  }
}

const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/[.\s]+$/, "").replace(/\s+/g, " ");
export function scoreListening(answers) {
  return KEYS.C.reduce((n, ok, i) => n + (ok.includes(norm(answers[i])) ? 1 : 0), 0);
}

// Strengths / work-on note per skill (shown to students as words, not numbers).
export function skillNote(parts) {
  const names = { A: "grammar_vocabulary", B: "reading", C: "listening", D: "writing" };
  const strengths = [], workOn = [];
  for (const [k, v] of Object.entries(parts)) {
    if (v === null || v === undefined) continue;
    const p = v / PARTS[k];
    if (p >= 0.7) strengths.push(names[k]);
    else if (p < 0.5) workOn.push(names[k]);
  }
  return { strengths, workOn };
}

// parts: { A, B, C, D } with null/undefined for parts not yet taken or marked.
export function place(parts) {
  check(parts);
  const taken = Object.keys(PARTS).filter((k) => parts[k] !== null && parts[k] !== undefined);
  if (!taken.includes("A") || !taken.includes("B")) throw new Error("parts A and B are required");
  const total = taken.reduce((s, k) => s + parts[k], 0);
  const max = taken.reduce((s, k) => s + PARTS[k], 0);
  let group = groupFor(total, max);
  let gated = false;
  if (taken.includes("D") && parts.D < WRITING_GATE && (group === "S" || group === "S+")) { group = "B"; gated = true; }
  const complete = taken.length === 4;
  return {
    group,
    provisional: !complete,           // true until listening and the teacher-marked writing are in
    gated,                            // true if the writing gate moved the student down to B
    admission: ADMISSION[group],
    missing: Object.keys(PARTS).filter((k) => !taken.includes(k)),
    note: skillNote(parts),
    internal: { total, max },         // staff only: never show to students
  };
}

// Internal design intent only (for calibration). Never shown to students or used in public material.
export const DESIGN_BAND = { F: [0, 4.5], B: [5, 5], S: [5.5, 6], "S+": [6.5, 9] };
export function bandToGroup(band) {
  if (band >= 6.5) return "S+";
  if (band >= 5.5) return "S";
  if (band >= 5) return "B";
  return "F";
}
