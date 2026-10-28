// Réservations de DÉMONSTRATION partagées entre le site et l'appli du restaurateur (app/).
// Tout reste dans CE navigateur (localStorage) : rien n'est envoyé, aucun serveur, aucun paiement réel.
// shortcut: localStorage = un seul appareil ; pour le vrai service, une base en ligne (Firebase…) remplacera ce fichier.
(() => {
  const KEY = 'ariadne-demo-resa-v1';
  const DAY = 864e5;
  // shortcut: saison 2027 écrite en dur (avril → octobre, à confirmer avec l'établissement) ; à mettre à jour chaque hiver
  const SEASON = { open: Date.UTC(2027, 3, 1), close: Date.UTC(2027, 9, 31) };
  const DEPOSIT = 20; // minimum par personne, déduit de l'addition
  const QUOTA = 40; // places en ligne par service, réglable dans l'appli ; le reste est gardé pour les clients sans réservation

  // Dates en UTC « pures » (minuit) ; « aujourd'hui » = date de la Corse
  const parisNow = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date()).map(x => [x.type, +x.value]));
    return { today: Date.UTC(p.year, p.month - 1, p.day), now: p.hour * 60 + p.minute };
  };
  const firstDay = () => Math.max(parisNow().today, SEASON.open);

  // Réservations d'exemple, CLAIREMENT FICTIVES (noms « Exemple », « Test »… et numéros 06 39 98, réservés à la fiction par l'Arcep)
  const seed = () => {
    const d = firstDay();
    const r = (date, service, time, name, guests, wishes = []) => ({
      id: 'ex-' + date + time + name, demo: true, created: Date.now(), date, service, time, name,
      phone: '06 39 98 ' + String(10 + guests * 7).slice(-2) + ' ' + String(name.length * 3).padStart(2, '0'),
      guests, wishes, note: '', paid: guests * DEPOSIT, status: 'attendu'
    });
    return { quota: QUOTA, closed: [], bookings: [
      r(d, 'midi', '12:00', 'Jean Exemple', 2),
      r(d, 'midi', '12:30', 'Famille Fictif', 5, ['bkW3']),
      r(d, 'midi', '13:00', 'Sofia Test', 4, ['bkW2']),
      r(d, 'midi', '13:30', 'Paul Démo', 3),
      r(d, 'soir', '19:00', 'Claire Exemple', 2),
      r(d, 'soir', '19:30', 'Marco Test', 4, ['bkW2']),
      r(d, 'soir', '20:00', 'Famille Démo', 6, ['bkW1']),
      r(d, 'soir', '20:30', 'Léa Fictive', 2),
      r(d, 'soir', '21:00', 'Tom Example', 4),
      r(d, 'soir', '21:00', 'Anna Prova', 2, ['bkW4']),
      r(d, 'soir', '21:30', 'Luc Exemple', 6),
      r(d + DAY, 'soir', '20:00', 'Nina Test', 4),
      r(d + DAY, 'soir', '20:30', 'Hugo Exemple', 2)
    ] };
  };

  let memory = null; // si le navigateur refuse le stockage (navigation privée…), la démo marche quand même, sans partage
  const read = () => {
    try { memory = JSON.parse(localStorage.getItem(KEY)) || memory; } catch { /* stockage indisponible */ }
    if (!memory) write(seed());
    return memory;
  };
  const write = data => {
    memory = data;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* stockage indisponible */ }
  };

  const isClosed = date => read().closed.includes(date);
  // places en ligne déjà prises pour un service (les absents comptent : leur table était bloquée)
  const booked = (date, service) => read().bookings.filter(b => b.date === date && b.service === service).reduce((n, b) => n + b.guests, 0);
  const left = (date, service) => (isClosed(date) ? 0 : Math.max(0, read().quota - booked(date, service)));

  window.AriadneDemo = {
    KEY, DAY, SEASON, DEPOSIT, parisNow, firstDay, read, write, isClosed, booked, left,
    add: b => { const s = read(); s.bookings.push(b); write(s); },
    reset: () => { localStorage.removeItem(KEY); memory = null; return read(); },
    // un autre onglet (le site ou l'appli) a modifié les réservations
    onChange: fn => addEventListener('storage', e => { if (e.key === KEY || e.key === null) { memory = null; fn(); } })
  };
})();
