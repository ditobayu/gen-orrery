import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Keep the test command compatible with Node 18; no runtime transpiler is needed.
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const output = mkdtempSync(join(tmpdir(), 'orrery-engine-test-'));
let engine;
try {
  const compile = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'),
    'src/engine.ts', 'src/types.ts', '--target', 'ES2020', '--module', 'ES2020',
    '--moduleResolution', 'node', '--strict', '--skipLibCheck', '--outDir', output,
  ], { cwd: root, encoding: 'utf8' });
  if (compile.status !== 0) throw new Error(compile.stdout + compile.stderr);
  writeFileSync(join(output, 'package.json'), '{"type":"module"}');
  engine = await import(pathToFileURL(join(output, 'engine.js')).href);
} finally {
  rmSync(output, { recursive: true, force: true });
}

const { createDefaultState, transition, getRemainingMs, settleTimer,
  parsePersistedState, clampSettings, MINUTE } = engine;
const start = (state = createDefaultState(), at = 1_000) => transition(state, { type: 'toggle' }, at).state;

test('the wall clock remains authoritative after a long inactive interval', () => {
  const state = start();
  assert.equal(getRemainingMs(state.timer, 1_000 + 17 * MINUTE), 8 * MINUTE);
  assert.equal(getRemainingMs(state.timer, 1_000 + 40 * MINUTE), 0);
  assert.equal(state.timer.remainingMs, 25 * MINUTE);
  assert.equal(getRemainingMs(state.timer, -1_000), state.timer.durationMs);
});

test('pause freezes remaining time and resume creates a fresh deadline', () => {
  const running = start();
  const paused = transition(running, { type: 'toggle' }, 1_000 + 10 * MINUTE).state;
  assert.equal(paused.timer.status, 'paused');
  assert.equal(paused.timer.endAt, null);
  assert.equal(getRemainingMs(paused.timer, 999_999_999), 15 * MINUTE);
  const resumed = transition(paused, { type: 'toggle' }, 2_000_000).state;
  assert.equal(resumed.timer.endAt, 2_000_000 + 15 * MINUTE);
  assert.equal(resumed.timer.startedAt, 1_000);
});

test('an overdue restored focus earns one star at the actual deadline and waits for its break', () => {
  const running = start({ ...createDefaultState(), task: 'Write the observatory', note: 'Chapter one' });
  const restored = parsePersistedState(JSON.stringify(running));
  const result = settleTimer(restored, 99_000_000);
  assert.equal(result.completed, true);
  assert.equal(result.state.archive.length, 1);
  assert.deepEqual(result.state.archive[0], {
    id: `star-1000-${25 * MINUTE}`,
    completedAt: 1_000 + 25 * MINUTE,
    durationMinutes: 25,
    task: 'Write the observatory',
    note: 'Chapter one',
  });
  assert.equal(result.state.timer.status, 'idle');
  assert.equal(result.state.timer.mode, 'short');
  assert.equal(result.state.timer.focusCount, 1);
  const refreshed = settleTimer(parsePersistedState(JSON.stringify(result.state)), 100_000_000);
  assert.equal(refreshed.completed, false);
  assert.equal(refreshed.state.archive.length, 1);
});

test('each fourth completed focus yields a long break; breaks never award stars', () => {
  let state = createDefaultState();
  let clock = 1_000;
  for (let cycle = 1; cycle <= 4; cycle++) {
    state = start(state, clock);
    clock = state.timer.endAt;
    state = settleTimer(state, clock).state;
    assert.equal(state.timer.mode, cycle === 4 ? 'long' : 'short');
    assert.equal(state.timer.focusCount, cycle);
    assert.equal(state.archive.length, cycle);
    state = start(state, ++clock);
    clock = state.timer.endAt;
    const finishedBreak = settleTimer(state, clock);
    assert.equal(finishedBreak.completed, true);
    state = finishedBreak.state;
    assert.equal(state.timer.mode, 'focus');
    assert.equal(state.archive.length, cycle);
    clock++;
  }
});

test('skipping reaches the upcoming phase without adding completed focus or stars', () => {
  const initial = createDefaultState();
  initial.timer.focusCount = 3;
  const skipped = transition(start(initial), { type: 'skip' }, 2_000);
  assert.equal(skipped.completed, false);
  assert.equal(skipped.state.timer.mode, 'long');
  assert.equal(skipped.state.timer.focusCount, 3);
  assert.equal(skipped.state.archive.length, 0);
  const next = transition(skipped.state, { type: 'skip' }, 3_000).state;
  assert.equal(next.timer.mode, 'focus');
  assert.equal(next.timer.status, 'idle');
});

test('settings clamp their bounds and only change the duration of an idle timer', () => {
  assert.deepEqual(clampSettings({ focus: -10, short: 200, long: 1.6, cycles: 0, sound: true }), {
    focus: 1, short: 60, long: 2, cycles: 1, sound: true, reducedMotion: false,
  });
  const idle = transition(createDefaultState(), { type: 'settings', settings: { focus: 42 } }, 0).state;
  assert.equal(idle.timer.durationMs, 42 * MINUTE);
  const running = start(idle);
  const changed = transition(running, { type: 'settings', settings: { focus: 10 } }, 1_100).state;
  assert.equal(changed.settings.focus, 10);
  assert.equal(changed.timer.durationMs, 42 * MINUTE);
  assert.equal(changed.timer.endAt, running.timer.endAt);
  const paused = transition(changed, { type: 'toggle' }, 1_200).state;
  const changedPaused = transition(paused, { type: 'settings', settings: { focus: 5 } }, 1_300).state;
  assert.equal(changedPaused.timer.durationMs, 42 * MINUTE);
  const reset = transition(changedPaused, { type: 'reset' }, 1_400).state;
  assert.equal(reset.timer.durationMs, 5 * MINUTE);
  assert.equal(reset.timer.startedAt, null);
});

test('changing mode resets its timer while reselecting the active mode preserves progress', () => {
  const running = start();
  assert.equal(transition(running, { type: 'mode', mode: 'focus' }, 2_000).state, running);
  const changed = transition(running, { type: 'mode', mode: 'long' }, 2_000).state;
  assert.equal(changed.timer.status, 'idle');
  assert.equal(changed.timer.remainingMs, 15 * MINUTE);
  assert.equal(changed.archive.length, 0);
});

test('a control click at the deadline completes once without advancing two phases', () => {
  for (const type of ['toggle', 'skip', 'reset']) {
    const running = start();
    const result = transition(running, { type }, running.timer.endAt);
    assert.equal(result.completed, true);
    assert.equal(result.state.timer.mode, 'short');
    assert.equal(result.state.timer.status, 'idle');
    assert.equal(result.state.archive.length, 1);
  }
});

test('invalid storage versions, malformed JSON and non-object data recover safely', () => {
  for (const raw of [null, '{broken', 'null', '[]', '{"version":2}', '"hello"']) {
    assert.deepEqual(parsePersistedState(raw), createDefaultState());
  }
  const recovered = parsePersistedState(JSON.stringify({ version: 1,
    settings: { focus: 99_999, cycles: -8, sound: 'yes' },
    timer: { mode: 'unknown', status: 'running', endAt: 'bad', durationMs: -5, focusCount: -8 },
    task: { unsafe: true }, archive: [null, {}, { id: 'bad', completedAt: -1 }],
  }));
  assert.equal(recovered.settings.focus, 120);
  assert.equal(recovered.settings.cycles, 1);
  assert.equal(recovered.settings.sound, false);
  assert.equal(recovered.timer.mode, 'focus');
  assert.equal(recovered.timer.status, 'paused');
  assert.equal(recovered.timer.endAt, null);
  assert.equal(recovered.timer.durationMs, MINUTE);
  assert.equal(recovered.timer.focusCount, 0);
  assert.equal(recovered.task, '');
  assert.deepEqual(recovered.archive, []);
});

test('stored stars are validated and deduplicated without mutating their original metadata', () => {
  const state = settleTimer(start(), 2_000_000).state;
  state.archive.push({ ...state.archive[0] }, { id: 'invalid', completedAt: 0, durationMinutes: -3 });
  const parsed = parsePersistedState(JSON.stringify(state));
  assert.equal(parsed.archive.length, 1);
  assert.equal(parsed.archive[0].durationMinutes, 25);
});

test('session identity remains stable across pause / resume deadline changes', () => {
  const original = start();
  const firstCompletion = settleTimer(original, original.timer.endAt).state;
  const paused = transition(original, { type: 'toggle' }, 10_000).state;
  const resumed = transition(paused, { type: 'toggle' }, 100_000).state;
  const secondCompletion = settleTimer(resumed, resumed.timer.endAt).state;
  assert.notEqual(firstCompletion.archive[0].completedAt, secondCompletion.archive[0].completedAt);
  assert.equal(firstCompletion.archive[0].id, secondCompletion.archive[0].id);
  const alreadyRecorded = settleTimer({ ...resumed, archive: firstCompletion.archive }, resumed.timer.endAt).state;
  assert.equal(alreadyRecorded.archive.length, 1);
  assert.equal(alreadyRecorded.timer.focusCount, 1);
});

test('a pause survives a JSON round trip with task, note and all settings', () => {
  let state = transition(createDefaultState(), { type: 'settings', settings: { sound: true, reducedMotion: true } }, 0).state;
  state = transition(state, { type: 'task', value: 'Make a small cosmos' }, 0).state;
  state = transition(state, { type: 'note', value: 'Keep the timing honest.' }, 0).state;
  state = transition(start(state), { type: 'toggle' }, 5_000).state;
  assert.deepEqual(parsePersistedState(JSON.stringify(state)), state);
});
