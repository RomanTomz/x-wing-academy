import { applyAudioSettings, audio, store } from '../core/services';
import { stageParams, TIER_TOPICS } from '../education/stages';
import { ALL_TOPICS, TIER_NAMES, TOPIC_NAMES, type Tier, type TopicId } from '../education/types';
import { MISSION_LENGTHS, type MissionLength } from '../progression/mission';
import { rankForXp } from '../progression/xp';
import { ALL_PLANETS, LEVEL_NAMES } from '../progression/campaign';

/**
 * Parent settings: a plain HTML overlay (easier to make accessible than canvas UI).
 * A simple grown-up maths gate keeps small fingers out.
 */
export function openParentPanel(onClose: () => void): void {
  const root = document.createElement('div');
  root.className = 'parent-overlay';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Parent settings');
  document.body.appendChild(root);

  const close = (): void => {
    root.remove();
    document.removeEventListener('keydown', onKey, true);
    onClose();
  };
  const onKey = (e: KeyboardEvent): void => {
    e.stopPropagation();
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey, true);

  showGate(root, () => showSettings(root, close), close);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

function showGate(root: HTMLElement, onPass: () => void, onCancel: () => void): void {
  const a = 6 + Math.floor(Math.random() * 7);
  const b = 12 + Math.floor(Math.random() * 8);
  root.innerHTML = '';
  const card = el('div', { class: 'parent-card gate' });
  card.append(
    el('h2', {}, 'Grown-ups only'),
    el('p', {}, `To open parent settings, please answer: what is ${a} × ${b}?`),
  );
  const form = el('form');
  const input = el('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'Answer' }) as HTMLInputElement;
  const msg = el('p', { class: 'gate-msg', 'aria-live': 'polite' });
  const row = el('div', { class: 'row' });
  const ok = el('button', { type: 'submit', class: 'primary' }, 'Open');
  const cancel = el('button', { type: 'button' }, 'Back to game');
  cancel.addEventListener('click', onCancel);
  row.append(ok, cancel);
  form.append(input, msg, row);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (Number(input.value.trim()) === a * b) onPass();
    else {
      msg.textContent = 'Not quite — try again.';
      input.select();
    }
  });
  card.append(form);
  root.append(card);
  input.focus();
}

function pct(n: number, d: number): string {
  return d === 0 ? '—' : `${Math.round((n / d) * 100)}%`;
}

function showSettings(root: HTMLElement, close: () => void): void {
  root.innerHTML = '';
  const s = store.settings;
  const data = store.data;
  const card = el('div', { class: 'parent-card' });

  const header = el('div', { class: 'header' });
  header.append(el('h2', {}, 'Parent settings'));
  const done = el('button', { class: 'primary' }, 'Done');
  done.addEventListener('click', close);
  header.append(done);
  card.append(header);
  card.append(el('p', { class: 'note' }, 'Everything is stored only in this browser. Nothing is sent anywhere.'));

  // --- Pilot.
  const pilot = section(card, 'Pilot');
  const nameInput = el('input', { type: 'text', maxlength: '16', value: s.pilotName, 'aria-label': 'Pilot name' }) as HTMLInputElement;
  nameInput.addEventListener('change', () => {
    store.updateSettings({ pilotName: nameInput.value });
    nameInput.value = store.settings.pilotName;
  });
  pilot.append(labelled('Pilot name', nameInput));

  // --- Difficulty.
  const diff = section(card, 'Difficulty');
  const adaptive = checkbox('Adaptive difficulty (adjusts gently to performance)', s.adaptive, (v) => {
    store.updateSettings({ adaptive: v });
    refreshLevel();
  });
  diff.append(adaptive);
  const tierRow = el('div', { class: 'radio-row', role: 'radiogroup', 'aria-label': 'Level' });
  ([1, 2, 3] as Tier[]).forEach((t) => {
    tierRow.append(
      radio('tier', `${TIER_NAMES[t]}`, s.tier === t, () => {
        store.updateSettings({ tier: t });
        refreshLevel();
      }),
    );
  });
  diff.append(labelled('Level', tierRow));
  const levelNote = el('p', { class: 'note' });
  diff.append(levelNote);
  const refreshLevel = (): void => {
    const p = stageParams(store.data.profile.stage);
    levelNote.textContent = store.settings.adaptive
      ? `Currently: ${TIER_NAMES[p.tier]} (step ${(p.stage % 3) + 1} of 3, numbers up to ${p.max}). Choosing a level sets the starting point.`
      : `Locked to ${TIER_NAMES[store.settings.tier]}. Numbers still adjust slightly within this level (now up to ${p.max}).`;
  };
  refreshLevel();

  // --- Galaxy map.
  const galaxy = section(card, 'Galaxy map');
  galaxy.append(
    el(
      'p',
      { class: 'note' },
      'There are two careers. Rebels: number bonds, adding and taking away, missing numbers and counting patterns. Empire (flying a TIE): comparing with < = >, tens and ones, odd and even, and halves and quarters. Each planet practises one skill and has Cadet, Pilot and Ace levels, and planets unlock one by one when any level of the previous planet is won. Boss battles open along the way, and each career ends with a final boss that mixes everything at the top of the chosen level. If adaptive difficulty is off, only the level chosen above can be played.',
    ),
    checkbox('Open all planets now (skip unlocking)', s.unlockAllPlanets, (v) => store.updateSettings({ unlockAllPlanets: v })),
  );
  const planetList = el('ul', { class: 'stats' });
  for (const p of ALL_PLANETS) {
    const side = p.faction === 'rebel' ? 'Rebels' : 'Empire';
    const cleared = data.profile.campaign[p.id].cleared;
    const won = ([1, 2, 3] as const).filter((l) => cleared[l - 1]).map((l) => LEVEL_NAMES[l]);
    const li = el('li');
    li.append(el('span', {}, `${side}: ${p.name} (${p.focus})`), el('strong', {}, won.length ? `★ ${won.join(', ')}` : store.isPlanetUnlocked(p.id) ? 'Open' : 'Locked'));
    planetList.append(li);
  }
  galaxy.append(planetList);

  // --- Topics.
  const topics = section(card, 'Quick Mission topics');
  const grid = el('div', { class: 'topic-grid' });
  for (const t of ALL_TOPICS) {
    const tiers = ([1, 2, 3] as Tier[]).filter((tier) => TIER_TOPICS[tier].includes(t)).map((tier) => TIER_NAMES[tier]);
    if (tiers.length === 0) continue; // Empire and boss topics aren't part of Quick Missions.
    grid.append(
      checkbox(`${TOPIC_NAMES[t]} — ${tiers.join(', ')}`, s.topics[t], (v) => {
        store.updateSettings({ topics: { ...store.settings.topics, [t]: v } });
      }),
    );
  }
  topics.append(grid);
  topics.append(el('p', { class: 'note' }, 'These apply to Quick Missions (mixed practice). Planets always practise their own skill. If every topic for the current level is switched off, all of that level’s topics are used.'));

  // --- Mission length.
  const len = section(card, 'Mission length');
  const lenRow = el('div', { class: 'radio-row', role: 'radiogroup', 'aria-label': 'Mission length' });
  for (const n of MISSION_LENGTHS) {
    lenRow.append(radio('len', `${n} questions`, s.missionLength === n, () => store.updateSettings({ missionLength: n as MissionLength })));
  }
  len.append(lenRow);

  // --- Sound.
  const sound = section(card, 'Sound & speech');
  sound.append(
    slider('Music volume', s.musicVolume, (v) => {
      store.updateSettings({ musicVolume: v });
      applyAudioSettings();
    }),
    slider('Sound effects volume', s.sfxVolume, (v) => {
      store.updateSettings({ sfxVolume: v });
      applyAudioSettings();
      audio.play('laser');
    }),
    checkbox('Mute everything', s.muted, (v) => {
      store.updateSettings({ muted: v });
      applyAudioSettings();
    }),
    checkbox('Read questions aloud (speech)', s.speech, (v) => {
      store.updateSettings({ speech: v });
      applyAudioSettings();
    }),
  );

  // --- Progress.
  const prog = section(card, 'Progress');
  const st = data.stats;
  const rank = rankForXp(data.profile.totalXp);
  const summary = el('ul', { class: 'stats' });
  const items: [string, string][] = [
    ['Rank', `${rank.rank.name} (${data.profile.totalXp} XP)`],
    ['Missions completed', String(data.profile.missionsCompleted)],
    ['Questions answered', String(st.questionsAttempted)],
    ['Correct first time', `${st.firstTryCorrect} (${pct(st.firstTryCorrect, st.questionsAttempted)})`],
    ['Shots per question', st.questionsAttempted ? (st.totalShotsAtAnswers / st.questionsAttempted).toFixed(1) : '—'],
  ];
  for (const [k, v] of items) {
    const li = el('li');
    li.append(el('span', {}, k), el('strong', {}, v));
    summary.append(li);
  }
  prog.append(summary);

  const table = el('table', { class: 'topic-table' });
  const thead = el('tr');
  thead.append(el('th', {}, 'Topic'), el('th', {}, 'Answered'), el('th', {}, 'First-time accuracy'));
  table.append(thead);
  for (const t of ALL_TOPICS) {
    const ts = st.byTopic[t as TopicId];
    if (ts.attempted === 0) continue;
    const tr = el('tr');
    const bar = el('div', { class: 'bar' });
    const fill = el('div', { class: 'fill' });
    fill.style.width = `${ts.attempted ? (ts.firstTryCorrect / ts.attempted) * 100 : 0}%`;
    bar.append(fill);
    const acc = el('td');
    acc.append(bar, el('span', {}, pct(ts.firstTryCorrect, ts.attempted)));
    tr.append(el('td', {}, TOPIC_NAMES[t]), el('td', {}, String(ts.attempted)), acc);
    table.append(tr);
  }
  if (table.children.length > 1) prog.append(table);
  else prog.append(el('p', { class: 'note' }, 'No questions answered yet.'));

  if (st.recent.length > 0) {
    prog.append(el('h4', {}, `Recent answers (last ${st.recent.length})`));
    const dots = el('div', { class: 'dots', 'aria-label': 'Recent first-attempt results' });
    for (const r of st.recent) {
      dots.append(el('span', { class: r.firstTry ? 'dot good' : 'dot retry', title: `${TOPIC_NAMES[r.topic]} — ${r.firstTry ? 'first try' : 'needed another go'}` }));
    }
    prog.append(dots);
    prog.append(el('p', { class: 'note' }, 'Green = correct first time, amber = got there after another go.'));
  }
  if (st.stageHistory.length > 0) {
    prog.append(el('h4', {}, 'Difficulty over time'));
    prog.append(stageChart(st.stageHistory.map((h) => h.stage)));
  }

  // --- Reset.
  const danger = section(card, 'Reset');
  const reset = el('button', { class: 'danger' }, 'Reset all progress…');
  let armed = false;
  reset.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      reset.textContent = 'Tap again to confirm: this erases XP, rewards and stats';
      window.setTimeout(() => {
        armed = false;
        reset.textContent = 'Reset all progress…';
      }, 5000);
      return;
    }
    store.resetProgress();
    showSettings(root, close);
  });
  danger.append(reset, el('p', { class: 'note' }, 'Settings are kept. This cannot be undone.'));

  root.append(card);
  done.focus();
}

function stageChart(stages: number[]): SVGSVGElement {
  const w = 480;
  const h = 90;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Difficulty level history');
  ([1, 2, 3] as Tier[]).forEach((t, i) => {
    const y = h - 10 - ((i * 3 + 1) / 8) * (h - 20);
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', '0');
    label.setAttribute('y', String(y + 4));
    label.textContent = TIER_NAMES[t].split(' ')[0];
    svg.append(label);
  });
  const pts = stages.map((s, i) => {
    const x = 70 + (stages.length === 1 ? 0 : (i / (stages.length - 1)) * (w - 80));
    const y = h - 10 - (s / 8) * (h - 20);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = document.createElementNS(ns, 'polyline');
  line.setAttribute('points', pts.join(' '));
  svg.append(line);
  return svg;
}

function section(parent: HTMLElement, title: string): HTMLElement {
  const sec = el('section');
  sec.append(el('h3', {}, title));
  parent.append(sec);
  return sec;
}

function labelled(text: string, control: HTMLElement): HTMLElement {
  const wrap = el('label', { class: 'labelled' });
  wrap.append(el('span', {}, text), control);
  return wrap;
}

function checkbox(text: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const wrap = el('label', { class: 'check' });
  const input = el('input', { type: 'checkbox' }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  wrap.append(input, el('span', {}, text));
  return wrap;
}

function radio(name: string, text: string, checked: boolean, onSelect: () => void): HTMLElement {
  const wrap = el('label', { class: 'radio' });
  const input = el('input', { type: 'radio', name }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener('change', () => input.checked && onSelect());
  wrap.append(input, el('span', {}, text));
  return wrap;
}

function slider(text: string, value: number, onChange: (v: number) => void): HTMLElement {
  const input = el('input', { type: 'range', min: '0', max: '100', step: '5' }) as HTMLInputElement;
  input.value = String(Math.round(value * 100));
  input.addEventListener('input', () => onChange(Number(input.value) / 100));
  return labelled(text, input);
}
