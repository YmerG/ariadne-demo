// L'Ariadne Plage : maquette. Aucune donnée envoyée ni enregistrée (pas de cookie, pas de stockage, même pour la langue).
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const header = $('.header');
const burger = $('.burger');
const nav = $('#nav');

// Écran d'arrivée : se retire de lui-même, ou au clic
const loader = $('.loader');
loader.addEventListener('animationend', e => e.target === loader && loader.remove());
loader.addEventListener('click', () => loader.remove());

// ---------- Langues FR / EN / IT (le français est le texte de la page) ----------
const FR = {
  title: document.title,
  desc: $('meta[name="description"]').content,
  menuOpen: 'Ouvrir le menu', menuClose: 'Fermer le menu',
  videoPause: 'Mettre la vidéo de fond en pause', videoPlay: 'Lire la vidéo de fond',
  filterCount: '{n} plats correspondent', filterCount1: '1 plat correspond',
  noMatch: 'Aucun plat de cette rubrique ne correspond à ce filtre. Le chiffre à côté de chaque rubrique indique où chercher.',
  tag_mer: 'Poisson &amp; fruits de mer', tag_viande: 'Viande', tag_vege: 'Végétarien', tag_sg: 'Sans gluten*'
};
$$('[data-i18n]').forEach(el => { FR[el.dataset.i18n] ??= el.innerHTML; });
$$('[data-i18n-label]').forEach(el => { FR[el.dataset.i18nLabel] ??= el.getAttribute('aria-label'); });
$$('[data-i18n-alt]').forEach(el => { FR[el.dataset.i18nAlt] ??= el.alt; });
let lang = 'fr';
const t = k => (lang === 'fr' ? FR : I18N[lang])[k] ?? FR[k];
const fill = (tpl, o) => tpl.replace(/\{(\w+)\}/g, (_, k) => o[k]);

const setLang = l => {
  lang = l;
  document.documentElement.lang = l;
  document.title = t('title');
  $('meta[name="description"]').content = t('desc');
  $$('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  $$('[data-i18n-label]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nLabel)));
  $$('[data-i18n-alt]').forEach(el => { el.alt = t(el.dataset.i18nAlt); });
  $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
  burger.setAttribute('aria-label', t(nav.classList.contains('open') ? 'menuClose' : 'menuOpen'));
  document.dispatchEvent(new Event('langchange'));
  if (!reduce) $('main').animate([{ opacity: .4 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' });
};
$$('[data-lang]').forEach(b => b.addEventListener('click', () => b.dataset.lang !== lang && setLang(b.dataset.lang)));

// En-tête réduit et flouté dès qu'on quitte le haut de la page
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Menu téléphone
const setMenu = (open) => {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', t(open ? 'menuClose' : 'menuOpen'));
  nav.classList.toggle('open', open);
};
burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
// Toucher la page à côté du menu le referme
document.addEventListener('click', (e) => {
  if (nav.classList.contains('open') && !e.target.closest('#nav, .burger')) setMenu(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); burger.focus(); }
});
// Au clavier, sortir du menu le referme (sinon le focus suivant serait caché dessous)
nav.addEventListener('focusout', (e) => {
  if (nav.classList.contains('open') && !nav.contains(e.relatedTarget) && e.relatedTarget !== burger) setMenu(false);
});

// ---------- Vidéo de fond : seulement si les animations sont permises et la connexion correcte, sinon la photo reste ----------
const hero = $('.hero');
const video = $('.hero-video');
const vBtn = $('.video-toggle');
const conn = navigator.connection;
let userPaused = false;
const setVideoLabel = () => {
  vBtn.setAttribute('aria-label', t(userPaused ? 'videoPlay' : 'videoPause'));
  vBtn.classList.toggle('is-paused', userPaused);
};
if (!reduce && !(conn && (conn.saveData || /2g/.test(conn.effectiveType)))) {
  video.src = matchMedia('(max-width: 768px), (orientation: portrait)').matches ? 'video/hero-mobile.mp4' : 'video/hero.mp4';
  video.addEventListener('playing', () => { hero.classList.add('has-video'); vBtn.hidden = false; setVideoLabel(); }, { once: true });
  video.addEventListener('error', () => { video.remove(); vBtn.remove(); }); // fichier absent ou illisible : la photo reste
  vBtn.addEventListener('click', () => {
    userPaused = !userPaused;
    userPaused ? video.pause() : video.play();
    setVideoLabel();
  });
  // en pause quand l'accueil n'est plus à l'écran (batterie du téléphone)
  new IntersectionObserver(([en]) => {
    if (userPaused) return;
    en.isIntersecting ? video.play().catch(() => {}) : video.pause();
  }).observe(hero);
  document.addEventListener('langchange', () => vBtn.hidden || setVideoLabel());
} else {
  video.remove();
  vBtn.remove();
}

// ---------- Apparitions douces au défilement (les listes .stagger arrivent élément par élément) ----------
$$('.stagger').forEach(list => [...list.children].forEach((el, i) => el.style.setProperty('--i', i)));
const counters = $$('[data-count]');
const fmtNum = (n, dec) => new Intl.NumberFormat(lang, { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
const showCount = el => { el.textContent = fmtNum(+el.dataset.count, +el.dataset.dec || 0); };
const countUp = el => {
  const end = +el.dataset.count, dec = +el.dataset.dec || 0, start = performance.now();
  const step = now => {
    const p = Math.min(1, (now - start) / 1400);
    el.textContent = fmtNum(end * (1 - (1 - p) ** 3), dec);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
document.addEventListener('langchange', () => counters.forEach(showCount));
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    if (!reduce) $$('[data-count]:not(.counted)', en.target).forEach(el => { el.classList.add('counted'); countUp(el); });
    io.unobserve(en.target);
  });
}, { rootMargin: '0px 0px -8% 0px' });
$$('.reveal, .stagger').forEach((el) => io.observe(el));

// ---------- Carte : onglets (motif ARIA « tabs » : flèches, Début, Fin) ----------
const tabs = $$('[role="tab"]');
const select = (tab) => {
  tabs.forEach((tb) => {
    const on = tb === tab;
    tb.setAttribute('aria-selected', String(on));
    tb.tabIndex = on ? 0 : -1;
    document.getElementById(tb.getAttribute('aria-controls')).hidden = !on;
  });
};
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => select(tab));
  tab.addEventListener('keydown', (e) => {
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const tb = tabs[(next + tabs.length) % tabs.length];
    select(tb);
    tb.focus();
  });
});

// ---------- Carte : étiquettes et filtres (poisson, viande, végétarien, sans gluten) ----------
const dishes = $$('.dishes li');
const panelOf = tab => document.getElementById(tab.getAttribute('aria-controls'));
tabs.forEach(tab => $('.dishes', panelOf(tab)).after(Object.assign(document.createElement('p'), { className: 'no-match', hidden: true })));
let filter = 'all';
const renderMenu = () => {
  dishes.forEach(li => {
    $('.tags', li)?.remove();
    const tags = (li.dataset.tags || '').split(' ').filter(Boolean);
    if (!tags.length) return;
    const box = document.createElement('span');
    box.className = 'tags';
    tags.forEach(tg => box.insertAdjacentHTML('beforeend', `<span class="tag tag-${tg}">${t('tag_' + tg)}</span>`));
    li.append(box);
  });
  $$('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
  let total = 0;
  const counts = tabs.map(tab => {
    const panel = panelOf(tab);
    let n = 0;
    $$('.dishes li', panel).forEach(li => {
      const ok = filter === 'all' || (li.dataset.tags || '').split(' ').includes(filter);
      li.hidden = !ok;
      n += ok;
    });
    total += n;
    $('.count', tab).textContent = filter === 'all' ? '' : ` (${n})`;
    const empty = $('.no-match', panel);
    empty.hidden = n > 0;
    empty.textContent = t('noMatch');
    return n;
  });
  // si la rubrique ouverte est vide avec ce filtre, on ouvre la première qui a des plats (sans déplacer le focus)
  const current = tabs.findIndex(tb => tb.getAttribute('aria-selected') === 'true');
  if (filter !== 'all' && !counts[current] && total) select(tabs[counts.findIndex(n => n > 0)]);
  $('#filter-count').textContent = filter === 'all' ? '' : total === 1 ? t('filterCount1') : fill(t('filterCount'), { n: total });
};
$$('[data-filter]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.filter; renderMenu(); }));
document.addEventListener('langchange', renderMenu);
renderMenu();

// contrôle : chaque texte français a sa traduction anglaise et italienne (booking.js ajoute les siens puis relance ce contrôle)
const checkI18n = () => Object.keys(FR).forEach(k => ['en', 'it'].forEach(l => k in I18N[l] || console.warn(`Traduction ${l} manquante :`, k)));
