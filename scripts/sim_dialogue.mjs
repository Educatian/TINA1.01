/* TINA dialogue simulation — E2E check of the uptake + bridging guardrails
   against the LIVE deployed pipeline (real /api/ai-proxy -> Gemini).

   Reproduces ChatInterface's exact per-turn logic in node:
     engine (classify -> select -> ground) -> directive injection -> proxy ->
     verifyRender, with the same phase/shallow bookkeeping.

   Run:  TINA_SIM_EMAIL=... TINA_SIM_PASSWORD=... node scripts/sim_dialogue.mjs
   (uses a throwaway learner account; no instructor/admin access needed) */

import { readFileSync } from 'node:fs';
import {
  runCoachingTurn,
  verifyRender,
} from '../src/services/coachingEngine.ts';

const BASE = 'https://tina-adie.pages.dev';
const SUPABASE = 'https://qjopomljrjjhukhjiwwm.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqb3BvbWxqcmpqaHVraGppd3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjQ1MzcsImV4cCI6MjA4MTUwMDUzN30.tkokgQK8Jn1PN1NREJJYIjfJOABZaGsT8WepTf1Fg3s';
const MAX_TURNS = 12;

// The real persona prompt, extracted from ChatInterface.tsx so the render
// matches production exactly.
function loadSystemInstruction() {
  const src = readFileSync(new URL('../src/components/ChatInterface.tsx', import.meta.url), 'utf-8');
  const start = src.indexOf('const SYSTEM_INSTRUCTION = `');
  const open = src.indexOf('`', start) + 1;
  const close = src.indexOf('`;', open);
  if (start < 0 || close < 0) throw new Error('SYSTEM_INSTRUCTION not found');
  return src.slice(open, close);
}

async function login() {
  const email = process.env.TINA_SIM_EMAIL;
  const password = process.env.TINA_SIM_PASSWORD;
  if (!email || !password) throw new Error('Set TINA_SIM_EMAIL / TINA_SIM_PASSWORD');
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  return (await res.json()).access_token;
}

async function tinaReply(token, systemInstruction, contents) {
  const res = await fetch(`${BASE}/api/ai-proxy`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'gemini-chat', model: 'gemini-2.5-flash', contents, systemInstruction }),
  });
  if (!res.ok) throw new Error(`proxy ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.text()).trim();
}

const GREETING =
  "Hello! I'm TINA, your reflective learning companion. I'm here to support you in exploring " +
  'your teacher identity and how AI is shaping your practice. Shall we start with what has been ' +
  'on your mind lately regarding AI in your class?';

// ---- the scripted learner -------------------------------------------------
const SCENARIO = [
  {
    label: 'T1 on-track opener',
    text: "Lately I've been using ChatGPT to grade my students' essays and give feedback, but honestly I feel a bit guilty about it.",
    expect: { digression: false },
  },
  {
    label: 'T2 OFF-TRACK (sports trip)',
    text: 'Oh by the way, did you hear the news about the World Cup schedule? My brother got tickets and we are planning a trip in July.',
    expect: { digression: true, reason: 'digression_bridge' },
  },
  {
    label: 'T3 returns on-track',
    text: 'Haha fair enough, back to the grading - I worry the AI feedback misses what my students actually struggle with in their writing.',
    expect: { digression: false },
  },
];

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, pass: Boolean(cond), detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const token = await login();
const systemInstruction = loadSystemInstruction();

let history = [{ role: 'model', text: GREETING }];
let phase = 'action';
let consecutiveShallow = 0;
const coveredTags = new Set();
const startMs = Date.now();

for (let i = 0; i < SCENARIO.length; i++) {
  const turn = SCENARIO[i];
  const turnIndex = i + 1;
  console.log(`\n=== ${turn.label} ===\nLEARNER: ${turn.text}`);

  // engine — exactly as ChatInterface calls it (on PRIOR history)
  const plan = runCoachingTurn({
    text: turn.text,
    history,
    phase,
    turnIndex,
    maxTurns: MAX_TURNS,
    elapsedMs: Date.now() - startMs,
    consecutiveShallow,
    coveredTags: Array.from(coveredTags),
  });
  consecutiveShallow = plan.classified.cues.shallow ? consecutiveShallow + 1 : 0;
  plan.classified.contentTags.forEach((t) => coveredTags.add(t));

  console.log(`ENGINE: move=${plan.move} reason=${plan.reason} phase ${phase} -> ${plan.nextPhase}`);
  console.log(`        anchor="${plan.classified.uptake.anchor}" digression=${plan.classified.uptake.digression}`);

  // engine expectations
  check(`${turn.label}: digression detection`, plan.classified.uptake.digression === turn.expect.digression);
  if (turn.expect.reason) {
    check(`${turn.label}: bridge selected`, plan.reason === turn.expect.reason, plan.reason);
    check(`${turn.label}: phase HELD on bridge`, plan.nextPhase === phase, `${phase} -> ${plan.nextPhase}`);
    check(`${turn.label}: directive scripts the pivot`, /speaking of/i.test(plan.directive));
  } else {
    check(`${turn.label}: uptake anchor in directive`,
      plan.classified.uptake.anchor !== null && plan.directive.includes(plan.classified.uptake.anchor));
  }

  // render via the LIVE proxy, with the production injection format
  const messageToSend =
    `${turn.text}\n\n[COACHING DIRECTIVE — follow this for your reply, keep your TINA persona and the one-question rule: ${plan.directive}]`;
  const contents = [...history, { role: 'user', text: messageToSend }];
  const reply = await tinaReply(token, systemInstruction, contents);
  console.log(`TINA: ${reply}`);

  // render-quality checks (same guard the app runs + uptake-specific probes)
  const verdict = verifyRender(plan.move, reply, turn.text);
  check(`${turn.label}: verifyRender ok`, verdict.ok, verdict.violations.join(','));
  if (turn.expect.digression) {
    const low = reply.toLowerCase();
    check(`${turn.label}: reply takes up the off-track thread`,
      /world cup|trip|ticket|brother|july/.test(low));
    check(`${turn.label}: reply pivots back to the reflection focus`,
      /grade|grading|essay|feedback|guilt|classroom|teach|ai/.test(low));
  }

  history = [...history, { role: 'user', text: turn.text }, { role: 'model', text: reply }];
  phase = plan.nextPhase;
}

const failed = results.filter((r) => !r.pass);
console.log(`\n========== ${results.length - failed.length}/${results.length} checks passed ==========`);
if (failed.length) process.exit(1);
