// Keyboard-driven DOM menu.
import { BIND_LABELS } from './input.js';
import { initAudio, play } from './audio.js';

const $ = s => document.querySelector(s);
let api = null;
let toastTimer = null;

function panel(name) {
  for (const p of document.querySelectorAll('.panel')) p.hidden = p.dataset.panel !== name;
  const first = document.querySelector(`.panel[data-panel="${name}"] [data-autofocus]`) ||
    document.querySelector(`.panel[data-panel="${name}"] button, .panel[data-panel="${name}"] input`);
  if (first) first.focus();
}

function focusables() {
  const vis = document.querySelector('.panel:not([hidden])');
  return vis ? [...vis.querySelectorAll('button, input')] : [];
}

function getName() {
  const n = $('#name').value.trim();
  try { localStorage.setItem('gh_name', n); } catch {}
  return n || 'Wanderer';
}

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

export function showMenu() { $('#menu').hidden = false; panel('main'); }
export function hideMenu() { $('#menu').hidden = true; document.activeElement && document.activeElement.blur(); }

function controlsTable(key, title) {
  const L = BIND_LABELS[key];
  const rows = [['Move / aim', L.move], ['Jump (double in air)', L.jump], ['Nail (hold ↑/↓ to aim)', L.attack],
    ['Dash', L.dash], ['Spell', L.spell], ['Focus — heal', L.focus]];
  return `<div class="ctable"><h3>${title}</h3>${rows.map(([a, b]) => `<div><span>${a}</span><kbd>${b}</kbd></div>`).join('')}</div>`;
}

export function initMenu(a) {
  api = a;
  try { $('#name').value = localStorage.getItem('gh_name') || ''; } catch {}
  $('#controls-body').innerHTML =
    controlsTable('solo', 'Keyboard');

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    initAudio();
    play('ui');
    const act = b.dataset.act;
    if (act === 'quick') api.startOnline('quick', getName());
    else if (act === 'create') api.startOnline('create', getName());
    else if (act === 'join-open') panel('join');
    else if (act === 'join') {
      const code = $('#code').value.trim().toUpperCase();
      if (code.length !== 4) return toast('Room codes are 4 letters.');
      api.startOnline('join', getName(), code);
    }
    else if (act === 'local') api.startLocal(getName());
    else if (act === 'controls') panel('controls');
    else if (act === 'back') panel('main');
  });

  // Mouse hover moves focus so there's only ever one highlighted option.
  document.addEventListener('mouseover', e => {
    const b = e.target.closest('#menu button');
    if (b && document.activeElement !== b && !(document.activeElement && document.activeElement.tagName === 'INPUT')) b.focus();
  });

  $('#code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  $('#code').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('[data-act="join"]').click(); } });
  $('#name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('[data-act="quick"]').focus(); } });

  document.addEventListener('keydown', e => {
    if ($('#menu').hidden) return;
    initAudio();
    const list = focusables();
    const i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault(); list[(i + 1) % list.length]?.focus(); play('ui');
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); play('ui');
    } else if (e.key === 'Escape') {
      panel('main');
    } else if (i < 0 && e.key === 'Enter') {
      list[0]?.focus();
    }
  });

  const room = new URLSearchParams(location.search).get('room');
  if (room && /^[A-Za-z]{4}$/.test(room)) {
    $('#code').value = room.toUpperCase();
    panel('join');
    $('[data-act="join"]').focus();
  } else panel('main');
}
