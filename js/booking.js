// Réservation de DÉMONSTRATION (module repris du Lamparo), en français, anglais et italien.
// Minimum 20 €/pers. réglé par un faux paiement façon Stripe : aucun paiement réel, aucune requête réseau, aucun cookie.
// Seule la réservation confirmée est gardée dans CE navigateur (demo-store.js), pour que l'appli du restaurateur (app/) la reçoive ;
// la carte de test n'est jamais enregistrée et tout ce qui est saisi est effacé à la fermeture.
// Utilise $, $$, reduce, t, fill, lang, FR, checkI18n, nav et setMenu (main.js) et AriadneDemo (demo-store.js).

Object.assign(FR, {
  bkContinue: 'Continuer',
  bkToPay: 'Passer à l’acompte',
  bkPay: 'Payer {amount} (démo)',
  bkPaying: 'Paiement en cours…',
  bkBack: 'Retour',
  bkFinish: 'Fermer',
  bkErrDate: 'Choisissez une date dans le calendrier.',
  bkErrSlot: 'Choisissez une heure.',
  bkNoSlot: 'Plus aucun créneau pour ce service aujourd’hui : choisissez un autre service ou une autre date.',
  bkErrName: 'Indiquez votre nom (2 lettres au moins).',
  bkErrPhone: 'Indiquez un numéro de téléphone valide, par exemple 06 12 34 56 78.',
  bkErrEmail: 'Indiquez une adresse e-mail valide, par exemple nom@exemple.fr.',
  bkErrCard: 'Numéro de carte incomplet ou invalide (carte de test : 4242 4242 4242 4242).',
  bkErrExp: 'Date d’expiration invalide ou passée, au format MM / AA.',
  bkErrCvc: 'Code de sécurité : 3 ou 4 chiffres.',
  bkErrTerms: 'Cochez la case pour accepter les conditions.',
  bkGuest1: '1 personne',
  bkGuestN: '{n} personnes',
  bkTotalLine: 'Acompte : {amount}',
  bkLeft: 'Places en ligne encore libres pour ce service : {n}.',
  bkFull: '<strong>Complet en ligne pour ce service.</strong> Appelez-nous au <a href="tel:+33495520963">04&nbsp;95&nbsp;52&nbsp;09&nbsp;63</a> ou venez directement : des tables sont gardées pour les clients sans réservation.',
  bkFew: '<strong>Places en ligne encore libres pour ce service : {n}.</strong> Réduisez le nombre de personnes, appelez-nous au <a href="tel:+33495520963">04&nbsp;95&nbsp;52&nbsp;09&nbsp;63</a> ou venez directement.',
  bkPayDetail: '{guests} × {unit}, déduit de l’addition',
  bkRecapWhen: 'Votre table',
  bkRecapWho: 'Vos coordonnées',
  bkRecapPay: 'Votre acompte',
  bkEdit: 'Modifier',
  bkLDate: 'Date',
  bkLService: 'Service',
  bkLTime: 'Heure',
  bkLGuests: 'Personnes',
  bkLName: 'Nom',
  bkLPhone: 'Téléphone',
  bkLEmail: 'E-mail',
  bkLWishes: 'Demande',
  bkLMin: 'Minimum',
  bkLMinV: '{unit} par personne, déduit de l’addition',
  bkLTotal: 'À régler',
  bkNone: 'Aucune',
  bkDoneText: '{name}, table pour {guests}, le {date} à {time}. Acompte de {amount} réglé, déduit de l’addition.'
});
checkI18n();

const { DAY, SEASON, DEPOSIT, parisNow } = AriadneDemo;
const DONE = 5; // 4 étapes, puis la confirmation
const bk = $('.booking');
const form = $('.bk', bk);
const grid = $('#bk-cal');
const slotsBox = $('#bk-slots');
const guests = $('#bk-guests');
const avail = $('#bk-avail');
const backBtn = $('[data-bk-back]', bk);
const nextBtn = $('[data-bk-next]', bk);
const SLOTS = { // créneaux d'exemple, à confirmer avec l'établissement
  midi: ['12:00', '12:30', '13:00', '13:30', '14:00'],
  soir: ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00']
};
const state = { step: 1, date: null, view: 0, focus: null };
let payTimer = 0;

// jours réservables : de la réouverture (ou d'aujourd'hui si la saison a commencé) jusqu'à la fermeture
const range = () => ({ first: Math.max(parisNow().today, SEASON.open), last: SEASON.close });
const monthOf = ms => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
const addMonths = (ms, n) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1); };
const loc = () => ({ fr: 'fr-FR', en: 'en-GB', it: 'it-IT' })[lang];
const fmtDate = (ms, o) => new Intl.DateTimeFormat(loc(), { timeZone: 'UTC', ...o }).format(ms);
const longDate = ms => {
  const s = fmtDate(ms, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return lang === 'fr' ? s.replace(/^(\S+) 1 /, '$1 1er ') : s; // « jeudi 1er avril »
};
const fmtTime = hm => {
  const [h, m] = hm.split(':').map(Number);
  if (lang === 'en') return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true }).format(Date.UTC(2000, 0, 1, h, m));
  if (lang === 'it') return hm;
  return m ? `${h} h ${m}` : `${h} h`;
};
const eur = n => new Intl.NumberFormat(loc(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const guestsText = n => (n === 1 ? t('bkGuest1') : t('bkGuestN').replace('{n}', n));
const total = () => +guests.value * DEPOSIT;
const cap = s => s[0].toUpperCase() + s.slice(1);

// ---------- Calendrier (flèches : jour suivant / précédent, haut et bas : semaine) ----------
const renderCal = () => {
  const { today } = parisNow();
  const { first, last } = range();
  $('#bk-month').textContent = fmtDate(state.view, { month: 'long', year: 'numeric' });
  $('[data-cal="-1"]', bk).disabled = state.view <= monthOf(first);
  $('[data-cal="1"]', bk).disabled = addMonths(state.view, 1) > last;
  const end = addMonths(state.view, 1);
  const inView = ms => ms >= state.view && ms < end && ms >= first && ms <= last;
  const target = [state.focus, state.date].find(ms => ms && inView(ms)) ?? Math.max(state.view, first);
  grid.textContent = '';
  for (let i = 0; i < 7; i++) { // 1er janvier 2024 = un lundi
    const wd = document.createElement('span');
    wd.className = 'cal-wd';
    wd.setAttribute('aria-hidden', 'true');
    wd.textContent = fmtDate(Date.UTC(2024, 0, 1 + i), { weekday: 'narrow' });
    grid.append(wd);
  }
  const pad = (new Date(state.view).getUTCDay() + 6) % 7;
  for (let i = 0; i < pad; i++) grid.append(document.createElement('span'));
  for (let ms = state.view; ms < end; ms += DAY) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cal-day';
    b.dataset.ms = ms;
    b.textContent = new Date(ms).getUTCDate();
    b.setAttribute('aria-label', fmtDate(ms, { weekday: 'long', day: 'numeric', month: 'long' }));
    b.setAttribute('aria-pressed', ms === state.date);
    b.disabled = ms < first || ms > last;
    b.tabIndex = ms === target ? 0 : -1;
    if (ms === today) b.setAttribute('aria-current', 'date');
    grid.append(b);
  }
};
const focusDay = ms => $(`[data-ms="${ms}"]`, grid)?.focus();
const pickDate = ms => {
  state.date = state.focus = ms;
  renderCal();
  focusDay(ms);
  setErr('bk-err-date');
  renderSlots();
  renderAvail();
  // petit écran : les créneaux sont sous le calendrier, on les amène à l'écran
  if (matchMedia('(max-width: 719px)').matches) $('.bk-side', bk).scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
};
grid.addEventListener('click', e => {
  const b = e.target.closest('.cal-day');
  if (b && !b.disabled) pickDate(+b.dataset.ms);
});
grid.addEventListener('keydown', e => {
  const b = e.target.closest('.cal-day');
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
  if (!b || !step) return;
  e.preventDefault();
  const { first, last } = range();
  const ms = +b.dataset.ms + step * DAY;
  if (ms < first || ms > last) return;
  state.focus = ms;
  state.view = monthOf(ms);
  renderCal();
  focusDay(ms);
});
$$('.cal-nav', bk).forEach(navBtn => navBtn.addEventListener('click', () => {
  state.view = addMonths(state.view, +navBtn.dataset.cal);
  state.focus = null;
  renderCal();
  if (!reduce) grid.animate([{ opacity: 0, translate: `${navBtn.dataset.cal * 24}px 0` }, { opacity: 1, translate: '0 0' }], { duration: 320, easing: 'ease-out' });
  if (navBtn.disabled) $('.cal-nav:not(:disabled)', bk)?.focus(); // le bouton cliqué vient de se désactiver
}));

// ---------- Créneaux (les heures déjà passées aujourd'hui sont grisées, avec 30 min de marge) ----------
const renderSlots = () => {
  const { today, now } = parisNow();
  const kept = form.elements.slot?.value;
  slotsBox.textContent = '';
  let free = 0;
  SLOTS[form.elements.service.value].forEach(hm => {
    const [h, m] = hm.split(':').map(Number);
    const past = state.date === today && h * 60 + m < now + 30;
    const label = document.createElement('label');
    label.className = 'pill';
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'slot', value: hm, disabled: past, checked: hm === kept && !past });
    input.setAttribute('aria-describedby', 'bk-err-slot');
    const span = document.createElement('span');
    span.textContent = fmtTime(hm);
    label.append(input, span);
    slotsBox.append(label);
    if (!past) free++;
  });
  if (!free) setErr('bk-err-slot', 'bkNoSlot');
  else if ($('#bk-err-slot').dataset.key === 'bkNoSlot') setErr('bk-err-slot');
};
form.addEventListener('change', e => {
  if (e.target.name === 'service') { renderSlots(); renderAvail(); }
  if (e.target.name === 'slot') setErr('bk-err-slot');
});

// ---------- Places en ligne : quota par service réglé dans l'appli, le reste est gardé pour les clients sans réservation ----------
const fits = () => !state.date || AriadneDemo.left(state.date, form.elements.service.value) >= +guests.value;
const renderAvail = () => {
  $('#bk-total').textContent = fill(t('bkTotalLine'), { amount: eur(total()) });
  const left = state.date ? AriadneDemo.left(state.date, form.elements.service.value) : Infinity;
  // on n'affiche les places restantes que lorsqu'elles se font rares (12 = la plus grande table en ligne)
  const key = !left ? 'bkFull' : left < +guests.value ? 'bkFew' : left <= 12 ? 'bkLeft' : '';
  avail.classList.toggle('is-full', !fits());
  avail.hidden = !key;
  avail.innerHTML = key ? fill(t(key), { n: left }) : ''; // textes fixes du site, aucune saisie du visiteur
};
AriadneDemo.onChange(renderAvail); // l'appli a changé le quota, fermé un jour ou reçu une réservation

// ---------- Nombre de personnes ----------
const setGuests = n => { guests.value = Math.min(12, Math.max(1, Math.round(n) || 1)); renderAvail(); };
$$('[data-guests]', bk).forEach(b => b.addEventListener('click', () => setGuests(+guests.value + +b.dataset.guests)));
guests.addEventListener('change', () => setGuests(+guests.value));

// ---------- Validation (message sous le champ, relié par aria-describedby ; focus sur la première erreur) ----------
const setErr = (id, key) => {
  const p = $('#' + id);
  p.hidden = !key;
  p.dataset.key = key || '';
  p.textContent = key ? t(key) : '';
  const field = document.getElementById(id.replace('err-', '')); // bk-err-name → #bk-name
  if (field?.matches('input')) key ? field.setAttribute('aria-invalid', 'true') : field.removeAttribute('aria-invalid');
};
const val = name => form.elements[name].value.trim();
const digits = s => s.replace(/\D/g, '');
const luhn = s => /^\d{13,19}$/.test(s) && [...s].reverse().reduce((sum, c, i) => sum + (i % 2 ? [0, 2, 4, 6, 8, 1, 3, 5, 7, 9][c] : +c), 0) % 10 === 0;
const expOk = s => {
  const m = s.match(/^(\d{1,2})\s*\/?\s*(\d{2})$/);
  if (!m || m[1] < 1 || m[1] > 12) return false;
  const now = new Date();
  return Date.UTC(2000 + +m[2], +m[1]) > Date.UTC(now.getFullYear(), now.getMonth()); // valable jusqu'à la fin du mois indiqué
};
const checks = {
  1: () => [
    ['bk-err-date', !state.date && 'bkErrDate', () => $('.cal-day[tabindex="0"]', grid)],
    ['bk-err-slot', !form.elements.slot?.value && ($('#bk-slots input:not(:disabled)') ? 'bkErrSlot' : 'bkNoSlot'), () => $('#bk-slots input:not(:disabled)') || $('[name="service"]:checked', bk)]
  ],
  2: () => [
    ['bk-err-name', !/\p{L}.*\p{L}/u.test(val('name')) && 'bkErrName', () => $('#bk-name')],
    ['bk-err-phone', !/^\+?\d{9,15}$/.test(val('phone').replace(/[\s.\-()]/g, '')) && 'bkErrPhone', () => $('#bk-phone')],
    ['bk-err-email', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email')) && 'bkErrEmail', () => $('#bk-email')]
  ],
  4: () => [
    ['bk-err-card', !luhn(digits(val('demo-card'))) && 'bkErrCard', () => $('#bk-card')],
    ['bk-err-exp', !expOk(val('demo-exp')) && 'bkErrExp', () => $('#bk-exp')],
    ['bk-err-cvc', !/^\d{3,4}$/.test(val('demo-cvc')) && 'bkErrCvc', () => $('#bk-cvc')],
    ['bk-err-terms', !form.elements.terms.checked && 'bkErrTerms', () => form.elements.terms]
  ]
};
// seul « Continuer » déplace le focus (sur la première erreur)
const validate = step => {
  const list = checks[step]?.() || [];
  list.forEach(([id, key]) => setErr(id, key));
  const bad = list.find(([, key]) => key);
  if (bad) bad[2]()?.focus();
  else if (step === 1 && !fits()) avail.focus(); // complet en ligne : le message avec le téléphone est déjà affiché
  return !bad && (step !== 1 || fits());
};
// pendant la saisie : on ne revérifie que ce champ, SANS déplacer le focus (bug du curseur qui sautait au Lamparo)
[['name', 2], ['phone', 2], ['email', 2], ['demo-card', 4], ['demo-exp', 4], ['demo-cvc', 4]].forEach(([n, step]) => form.elements[n].addEventListener('input', () => {
  const id = 'bk-err-' + n.replace('demo-', '');
  if (!$('#' + id).hidden) setErr(id, checks[step]().find(c => c[0] === id)[1]);
}));
form.elements.terms.addEventListener('change', () => form.elements.terms.checked && setErr('bk-err-terms'));
// la carte est remise en forme quand on quitte le champ (jamais pendant la frappe : le curseur ne saute pas)
form.elements['demo-card'].addEventListener('blur', e => { e.target.value = digits(e.target.value).replace(/(\d{4})(?=\d)/g, '$1 '); });
form.elements['demo-exp'].addEventListener('blur', e => {
  const m = val('demo-exp').match(/^(\d{1,2})\s*\/?\s*(\d{2})$/);
  if (m) e.target.value = `${m[1].padStart(2, '0')} / ${m[2]}`;
});
$('[data-test-card]', bk).addEventListener('click', () => {
  form.elements['demo-card'].value = '4242 4242 4242 4242';
  form.elements['demo-exp'].value = '12 / 30';
  form.elements['demo-cvc'].value = '123';
  ['card', 'exp', 'cvc'].forEach(k => setErr('bk-err-' + k));
});

// ---------- Récapitulatif (textes saisis insérés en textContent, jamais en HTML) ----------
const wishes = () => {
  const list = $$('[name="wish"]:checked', bk).map(c => t(c.value));
  if (val('note')) list.push(val('note'));
  return list.join(' · ') || t('bkNone');
};
const renderRecap = () => {
  const box = $('#bk-recap');
  box.textContent = '';
  [
    ['bkRecapWhen', 1, [['bkLDate', cap(longDate(state.date))], ['bkLService', t(form.elements.service.value === 'midi' ? 'bkLunch' : 'bkDinner')], ['bkLTime', fmtTime(form.elements.slot.value)], ['bkLGuests', guestsText(+guests.value)]]],
    ['bkRecapWho', 2, [['bkLName', val('name')], ['bkLPhone', val('phone')], ['bkLEmail', val('email')], ['bkLWishes', wishes()]]],
    ['bkRecapPay', 0, [['bkLMin', fill(t('bkLMinV'), { unit: eur(DEPOSIT) })], ['bkLTotal', eur(total())]]]
  ].forEach(([title, step, rows]) => {
    const group = document.createElement('div');
    group.className = 'recap-group' + (step ? '' : ' recap-pay');
    const head = document.createElement('div');
    head.className = 'recap-head';
    const h = document.createElement('h4');
    h.textContent = t(title);
    head.append(h);
    if (step) {
      const edit = Object.assign(document.createElement('button'), { type: 'button', className: 'recap-edit', textContent: t('bkEdit') });
      edit.setAttribute('aria-label', `${t('bkEdit')} : ${t(title)}`);
      edit.addEventListener('click', () => go(step));
      head.append(edit);
    }
    const dl = document.createElement('dl');
    rows.forEach(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = t(k);
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    });
    group.append(head, dl);
    box.append(group);
  });
};
const renderPay = () => {
  $('#bk-pay-detail').textContent = fill(t('bkPayDetail'), { guests: guestsText(+guests.value), unit: eur(DEPOSIT) });
  $('#bk-pay-total').textContent = eur(total());
};
const renderDone = () => {
  $('#bk-done-text').textContent = fill(t('bkDoneText'), { name: val('name'), guests: guestsText(+guests.value), date: longDate(state.date), time: fmtTime(form.elements.slot.value), amount: eur(total()) });
};
// la réservation payée part dans l'appli du restaurateur (même navigateur) ; ni l'e-mail ni la carte ne sont gardés
const save = () => AriadneDemo.add({
  id: 'r' + Date.now(), created: Date.now(), date: state.date, service: form.elements.service.value, time: form.elements.slot.value,
  name: val('name'), phone: val('phone'), guests: +guests.value, wishes: $$('[name="wish"]:checked', bk).map(c => c.value),
  note: val('note'), paid: total(), status: 'attendu', lang
});

// ---------- Étapes ----------
const renderButtons = () => {
  backBtn.hidden = state.step === 1 || state.step === DONE;
  backBtn.textContent = t('bkBack');
  nextBtn.textContent = state.step === 4 ? fill(t('bkPay'), { amount: eur(total()) }) : t({ 1: 'bkContinue', 2: 'bkContinue', 3: 'bkToPay', 5: 'bkFinish' }[state.step]);
  $$('.bk-steps li', bk).forEach((li, i) => {
    li.classList.toggle('done', i + 1 < state.step);
    if (i + 1 === state.step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
};
const go = step => {
  state.step = step;
  $$('.bk-step', bk).forEach(s => { s.hidden = +s.dataset.step !== step; });
  bk.classList.toggle('is-done', step === DONE);
  if (step === 3) renderRecap();
  if (step === 4) renderPay();
  if (step === DONE) renderDone();
  renderButtons();
  $('.bk-body', bk).scrollTop = 0;
  $(`#bk-h${step}`).focus();
};
const setBusy = on => {
  nextBtn.disabled = backBtn.disabled = on;
  nextBtn.classList.toggle('is-busy', on);
  if (on) nextBtn.textContent = t('bkPaying');
};
form.addEventListener('submit', e => {
  e.preventDefault(); // aucun envoi : on passe seulement à l'étape suivante
  if (state.step === DONE) return bk.close();
  if (nextBtn.disabled || !validate(state.step)) return;
  if (state.step < 4) return go(state.step + 1);
  // entre-temps, l'appli a pu fermer le service ou il a pu se remplir : retour au choix de la date
  if (!fits()) { go(1); renderAvail(); return avail.focus(); }
  setBusy(true);
  payTimer = setTimeout(() => {
    setBusy(false);
    if (!fits()) { go(1); renderAvail(); return avail.focus(); } // rempli pendant le « paiement »
    save();
    go(DONE);
  }, reduce ? 400 : 1600);
});
backBtn.addEventListener('click', () => go(state.step - 1));
$('[data-bk-close]', bk).addEventListener('click', () => bk.close());

// ---------- Ouverture / fermeture ----------
const reset = () => {
  clearTimeout(payTimer); // fermé pendant le « paiement » : rien n'est gardé
  setBusy(false);
  form.reset();
  $('#bk-recap').textContent = ''; // efface aussi les copies affichées des données saisies
  $('#bk-done-text').textContent = '';
  Object.assign(state, { date: null, focus: null, view: monthOf(range().first) });
  $$('.bk-err', bk).forEach(p => setErr(p.id));
  renderCal();
  renderSlots();
  renderAvail();
  go(1);
};
bk.addEventListener('close', reset); // les données saisies sont effacées dès la fermeture
$$('[data-book]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault(); // sans JavaScript, le lien reste un appel téléphonique
  if (nav.classList.contains('open')) setMenu(false);
  renderAvail(); // quota relu à chaque ouverture
  bk.showModal();
  $('#bk-h1').focus();
}));
document.addEventListener('langchange', () => {
  renderCal();
  renderSlots();
  renderAvail();
  renderButtons();
  if (state.step === 3) renderRecap();
  if (state.step === 4) renderPay();
  if (state.step === DONE) renderDone();
  $$('.bk-err', bk).forEach(p => { if (p.dataset.key) p.textContent = t(p.dataset.key); });
});
reset();
