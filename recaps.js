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
    resume: "Après avoir sauvé Elias, les cinq compagnons reprennent la route à travers Shurima : ils " +
            "traversent les sables, croisent des nomades méfiants et atteignent un ermite qui leur vend une " +
            "eau prétendue miraculeuse contre 25 pièces d'argent. Mais le voyage tourne au cauchemar quand " +
            "surgit Renekton. Le combat tourne mal : la bête engloutit Rathäel, Elias, Smith et Urskaar dans " +
            "les sables, laissant Jett seul face à une silhouette mystérieuse apparue dans un cercle de runes " +
            "incandescent… à suivre au prochain chapitre.",
    pages: [
      'recaps/seance-01/page1.webp',
      'recaps/seance-01/page2.webp',
      'recaps/seance-01/page3.webp',
      'recaps/seance-01/page4.webp',
      'recaps/seance-01/page5.webp',
      'recaps/seance-01/page6.webp',
      'recaps/seance-01/page7.webp',
      'recaps/seance-01/page8.webp',
    ],
  },
];

Object.assign(window, { RECAPS });
