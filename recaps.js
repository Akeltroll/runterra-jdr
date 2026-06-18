/* ============================================================
   DONNÉES — RÉCAPS DE SÉANCE
   Chaque entrée = une séance (la plus récente EN PREMIER).
   Images = planches déjà finies, dans recaps/seance-XX/.
   Ajouter une séance : déposer les .webp + ajouter une entrée ici.
   ============================================================ */
const RECAPS = [
  {
    id:    'seance-01',
    date:  '2026-06-14',
    titre: 'La dernière session',
    resume: "Après avoir sauvé Elias, les cinq compagnons reprennent la route à travers Shurima. " +
            "Ils traversent les sables, croisent des nomades méfiants, longent un cimetière de monstres, " +
            "et atteignent un ermite reclus qui leur propose une eau prétendue miraculeuse contre 25 pièces d'argent.",
    pages: [
      'recaps/seance-01/page1.webp',
      'recaps/seance-01/page2.webp',
    ],
  },
];

Object.assign(window, { RECAPS });
