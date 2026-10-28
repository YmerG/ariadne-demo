// Appli du restaurateur (DÉMO) : code d'accès, réservations du jour, compteurs et quota par service, fermeture d'un jour en ligne.
// Les réservations payées sur le site (même navigateur) arrivent ici en direct : événement « storage », ou retour sur l'onglet.
// Rien n'est envoyé : tout vient de demo-store.js (localStorage de ce navigateur).
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const D = AriadneDemo;
const CODE = '1234'; // shortcut: code de démo écrit en clair ; le vrai service passera par de vrais comptes (Firebase Auth…)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const WISHES = { bkW1: 'Anniversaire', bkW2: 'Face à la mer', bkW3: 'Chaise bébé', bkW4: 'Allergie ou régime' };
const SERVICES = { midi: ['Midi', '12 h – 14 h'], soir: ['Soir', '19 h – 22 h'] };
const lock = $('#lock');
const app = $('#app');
const toast = $('#toast');
let day = D.firstDay();
// gardés pour la session : un onglet rechargé (l'iPhone le fait souvent) ne perd ni l'alerte ni les pastilles « Nouveau »
const saved = (() => { try { return JSON.parse(sessionStorage.getItem('ariadne-app-seen')); } catch { return null; } })();
const seen = new Set(saved?.seen ?? D.read().bookings.map(b => b.id)); // déjà là à la 1re ouverture : pas d'alerte
const fresh = new Set(saved?.fresh); // arrivées pendant la session : pastille « Nouveau »
const keep = () => { try { sessionStorage.setItem('ariadne-app-seen', JSON.stringify({ seen: [...seen], fresh: [...fresh] })); } catch { /* stockage indisponible */ } };

const fmt = (ms, o) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...o }).format(ms);
const cap = s => s[0].toUpperCase() + s.slice(1);
const eur = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const hour = hm => { const [h, m] = hm.split(':'); return m === '00' ? `${+h} h` : `${+h} h ${m}`; };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

// ---------- Code d'accès (clavier à l'écran ou clavier physique) ----------
let code = '';
const dots = () => $$('.dots i').forEach((d, i) => d.classList.toggle('on', i < code.length));
const unlock = () => {
  try { sessionStorage.setItem('ariadne-app', 'ok'); } catch { /* stockage indisponible */ }
  lock.hidden = true;
  app.hidden = false;
  check(); // affiche le jour et signale ce qui est arrivé pendant le verrouillage
};
const press = k => {
  if (lock.hidden || code.length === 4) return;
  code = k === 'del' ? code.slice(0, -1) : code + k;
  dots();
  $('#lock-msg').textContent = '';
  if (code.length < 4) return;
  if (code === CODE) {
    sound();
    lock.classList.add('is-open');
    setTimeout(() => { unlock(); $('#day-pick').focus(); }, reduce ? 0 : 520); // le focus quitte le clavier du code, masqué
  } else {
    lock.classList.add('shake');
    $('#lock-msg').textContent = 'Code incorrect, réessayez.';
    setTimeout(() => { lock.classList.remove('shake'); code = ''; dots(); }, 520);
  }
};
$$('[data-key]').forEach(b => b.addEventListener('click', () => press(b.dataset.key)));
addEventListener('keydown', e => {
  if (/^\d$/.test(e.key)) press(e.key);
  else if (e.key === 'Backspace') press('del');
});
$('#lock-btn').addEventListener('click', () => {
  try { sessionStorage.removeItem('ariadne-app'); } catch { /* stockage indisponible */ }
  code = '';
  dots();
  lock.classList.remove('is-open');
  app.hidden = true;
  toast.hidden = true;
  lock.hidden = false;
  $('[data-key="1"]').focus();
});

// ---------- Petit carillon à l'arrivée d'une réservation (le son n'est permis qu'après un geste) ----------
let audio;
const sound = () => { try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch { /* pas de son */ } };
addEventListener('pointerdown', sound, { once: true });
const chime = () => {
  if (!audio || audio.state !== 'running') return;
  const t0 = audio.currentTime;
  [880, 1318.5].forEach((f, i) => {
    const o = audio.createOscillator();
    const g = audio.createGain();
    const at = t0 + i * 0.16;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
    o.connect(g).connect(audio.destination);
    o.start(at);
    o.stop(at + 1);
  });
};

// ---------- Affichage du jour ----------
const renderServices = s => {
  const box = $('#services');
  box.textContent = '';
  const closed = D.isClosed(day);
  Object.entries(SERVICES).forEach(([k, [label, hours]]) => {
    const n = D.booked(day, k);
    const full = closed || n >= s.quota;
    const card = el('div', 'svc' + (full ? ' is-full' : ''));
    card.style.setProperty('--p', s.quota ? Math.min(1, n / s.quota) : 1);
    const ring = el('div', 'ring');
    ring.append(el('strong', '', n), el('span', '', '/ ' + s.quota));
    const txt = el('div', 'svc-text');
    txt.append(el('p', 'svc-name', label), el('p', 'svc-hours', hours),
      el('p', 'svc-state', closed ? 'Fermé en ligne' : full ? 'Complet en ligne' : plural(s.quota - n, 'place libre', 'places libres')));
    card.append(ring, txt);
    card.setAttribute('aria-label', `${label} : ${n} places réservées en ligne sur ${s.quota}. ${txt.lastChild.textContent}.`);
    box.append(card);
  });
};

const renderRow = b => {
  const art = el('article', `resa is-${b.status}` + (fresh.has(b.id) ? ' is-new' : ''));
  art.dataset.id = b.id;
  art.tabIndex = -1;
  art.append(el('p', 'resa-time', hour(b.time)));
  const main = el('div', 'resa-main');
  const name = el('p', 'resa-name');
  name.append(el('span', '', b.name));
  if (b.demo) name.append(el('span', 'badge', 'Exemple fictif'));
  if (fresh.has(b.id)) name.append(el('span', 'badge badge-new', 'Nouveau'));
  if (b.lang && b.lang !== 'fr') name.append(el('span', 'badge badge-lang', b.lang.toUpperCase()));
  const meta = el('p', 'resa-meta');
  meta.append(el('span', 'guests', plural(b.guests, 'pers.', 'pers.')), el('span', 'paid', eur(b.paid) + ' prépayés'));
  main.append(name, meta);
  if (b.wishes?.length) {
    const w = el('p', 'resa-wishes');
    b.wishes.forEach(k => w.append(el('span', 'chip', WISHES[k] || k)));
    main.append(w);
  }
  if (b.note) main.append(el('p', 'resa-note', '« ' + b.note + ' »'));
  const tel = el('a', 'resa-tel', b.phone);
  tel.href = 'tel:' + b.phone.replace(/[^\d+]/g, '');
  tel.setAttribute('aria-label', `Appeler ${b.name}, ${b.phone}`);
  main.append(tel);
  const act = el('div', 'resa-actions');
  [['arrive', 'Arrivé'], ['absent', 'Absent']].forEach(([st, txt]) => {
    const btn = el('button', 'act act-' + st, txt);
    btn.type = 'button';
    btn.dataset.status = st;
    btn.setAttribute('aria-pressed', String(b.status === st));
    btn.setAttribute('aria-label', `${txt} : ${b.name}, ${hour(b.time)}`);
    act.append(btn);
  });
  art.append(main, act);
  if (b.status === 'absent') art.append(el('p', 'resa-kept', `Absent · acompte conservé : ${eur(b.paid)}`));
  return art;
};

let firstRender = true; // les anneaux ne se remplissent en animation qu'à l'ouverture
const render = () => {
  if (app.hidden) return;
  $('#services').classList.toggle('intro', firstRender);
  firstRender = false;
  const s = D.read();
  const today = D.parisNow().today;
  $('#day-name').textContent = cap(fmt(day, { weekday: 'long' })) + (day === today ? ' · aujourd’hui' : '');
  $('#day-date').textContent = fmt(day, { day: 'numeric', month: 'long', year: 'numeric' }).replace(/^1 /, '1er ');
  $('#day-input').value = new Date(day).toISOString().slice(0, 10);
  renderServices(s);

  const closed = D.isClosed(day);
  $('#online').setAttribute('aria-checked', String(!closed));
  $('#online-sub').textContent = closed ? 'Fermées : le site affiche « Complet en ligne, appelez-nous ».' : 'Ouvertes : les clients réservent et paient l’acompte sur le site.';
  $('#quota').textContent = s.quota;

  const rows = s.bookings.filter(b => b.date === day).sort((a, b) => a.time.localeCompare(b.time) || a.created - b.created);
  const kept = rows.filter(b => b.status === 'absent').reduce((n, b) => n + b.paid, 0);
  $('#totals').textContent = rows.length
    ? `${plural(rows.length, 'réservation', 'réservations')} · ${plural(rows.reduce((n, b) => n + b.guests, 0), 'couvert', 'couverts')} · ${eur(rows.reduce((n, b) => n + b.paid, 0))} d’acomptes` + (kept ? ` · dont ${eur(kept)} conservés` : '')
    : 'Aucune réservation en ligne ce jour.';

  const list = $('#list');
  list.textContent = '';
  if (day < D.SEASON.open || day > D.SEASON.close) list.append(el('p', 'season', 'Hors saison : L’Ariadne est fermée ce jour-là (saison du 1er avril au 31 octobre 2027, à confirmer).'));
  Object.entries(SERVICES).forEach(([k, [label]]) => {
    const group = rows.filter(b => b.service === k);
    const sec = el('section', 'group');
    const h = el('h3', 'group-head');
    h.append(el('span', '', label), el('small', '', group.length ? `${plural(group.length, 'table', 'tables')} · ${plural(group.reduce((n, b) => n + b.guests, 0), 'couvert', 'couverts')}` : ''));
    sec.append(h);
    if (!group.length) sec.append(el('p', 'empty', 'Aucune réservation en ligne pour ce service.'));
    group.forEach(b => sec.append(renderRow(b)));
    list.append(sec);
  });
  document.title = (fresh.size ? `(${fresh.size}) ` : '') + 'Réservations · L’Ariadne Plage (démo)';
};

// ---------- Actions ----------
$('#list').addEventListener('click', e => {
  const btn = e.target.closest('[data-status]');
  if (!btn) return;
  const s = D.read();
  const b = s.bookings.find(x => x.id === btn.closest('.resa').dataset.id);
  b.status = b.status === btn.dataset.status ? 'attendu' : btn.dataset.status; // second appui : on annule
  D.write(s);
  render();
  $(`.resa[data-id="${CSS.escape(b.id)}"] [data-status="${btn.dataset.status}"]`)?.focus();
});
$('#online').addEventListener('click', () => {
  const s = D.read();
  s.closed = s.closed.includes(day) ? s.closed.filter(d => d !== day) : [...s.closed, day];
  D.write(s);
  render();
});
$$('[data-quota]').forEach(b => b.addEventListener('click', () => {
  const s = D.read();
  s.quota = Math.min(200, Math.max(0, s.quota + +b.dataset.quota));
  D.write(s);
  render();
}));
$('#reset').addEventListener('click', () => {
  if (!confirm('Remettre la démo à zéro ? Les réservations faites sur le site et les réglages seront effacés, les exemples fictifs reviennent.')) return;
  D.reset();
  fresh.clear();
  D.read().bookings.forEach(b => seen.add(b.id));
  keep();
  day = D.firstDay();
  render();
});
const moveDay = ms => { day = ms; render(); };
$$('[data-day]').forEach(b => b.addEventListener('click', () => moveDay(day + b.dataset.day * D.DAY)));
$('#day-pick').addEventListener('click', () => {
  const input = $('#day-input');
  try { input.showPicker(); } catch { input.focus(); }
});
$('#day-input').addEventListener('change', e => { if (e.target.value) moveDay(Date.parse(e.target.value)); }); // « 2027-04-01 » = minuit UTC

// ---------- Nouvelle réservation venue du site ----------
let toastTimer = 0;
const hideToast = () => {
  if (toast.contains(document.activeElement)) return void (toastTimer = setTimeout(hideToast, 4000));
  toast.classList.add('out');
  setTimeout(() => { toast.hidden = true; toast.classList.remove('out'); }, reduce ? 0 : 350);
};
const notify = (b, n) => {
  $('#toast-detail').textContent = `${b.name} · ${b.guests} pers. · ${fmt(b.date, { weekday: 'short', day: 'numeric', month: 'short' })} à ${hour(b.time)} · ${eur(b.paid)} prépayés`
    + (n > 1 ? ` (et ${plural(n - 1, 'autre', 'autres')})` : '');
  $('#toast-see').onclick = () => {
    moveDay(b.date);
    const row = $(`.resa[data-id="${CSS.escape(b.id)}"]`);
    row?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    row?.focus({ preventScroll: true });
    hideToast();
  };
  toast.hidden = false;
  chime();
  navigator.vibrate?.([90, 60, 90]);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 10000);
};
const check = () => {
  if (app.hidden) return; // verrouillée : on préviendra au déverrouillage
  const all = D.read().bookings;
  const news = all.filter(b => !seen.has(b.id));
  news.forEach(b => { seen.add(b.id); fresh.add(b.id); });
  keep();
  if (news.length) notify(news.at(-1), news.length);
  render();
};
D.onChange(check);
document.addEventListener('visibilitychange', () => document.hidden || check()); // téléphone : l'onglet en arrière-plan dormait
addEventListener('focus', check);

// les titres « Midi » / « Soir » restent collés sous l'en-tête fixe, quelle que soit sa hauteur
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--top-h', e.target.offsetHeight + 'px')).observe($('.top'));

// ---------- Démarrage ----------
let unlocked = false;
try { unlocked = sessionStorage.getItem('ariadne-app') === 'ok'; } catch { /* stockage indisponible */ }
if (unlocked) unlock(); // sinon le code se tape au clavier à l'écran, ou au clavier physique sans rien sélectionner

// Installation sur l'écran d'accueil : seulement une fois en ligne (https), pas en ouvrant le fichier
if (location.protocol === 'https:' || location.hostname === 'localhost') {
  document.head.append(Object.assign(document.createElement('link'), { rel: 'manifest', href: 'manifest.webmanifest' }));
  navigator.serviceWorker?.register('sw.js').catch(() => {});
}
