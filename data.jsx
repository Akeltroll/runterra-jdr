/* ============================================================
   DONNÉES DE JEU — Chroniques de Runeterra
   Moteur de formules fidèle au fichier Excel source.
   Stats dérivées des 4 attributs : Force, Habileté, Mental, Magie/Cosmique.
   ============================================================ */

const ceil = Math.ceil;
const mn = Math.min, mx = Math.max;

/* --- Moteur de stats (formules Excel exactes) ---
   F=Force, H=Habileté, M=Mental, C=Magie/Cosmique
   "normal" = part linéaire (attribut plafonné à 16)
   "transcendant" = part quadratique au-delà de 16
*/
function computeStats(F, H, M, C) {
  const hp     = 10 + ceil(mn(F,16)*75 + mn(C,16)*5 + mn(M,16)*45) + ceil(mx(F-16,0)**2*300 + mx(C-16,0)**2*25 + mx(M-16,0)**2*175);
  const mana   = 10 + ceil(mn(H,16)*20 + mn(C,16)*75 + mn(M,16)*30) + ceil(mx(C-16,0)**2*300 + mx(H-16,0)**2*80 + mx(M-16,0)**2*120);
  const ad     = ceil(mn(F,16)*20 + mn(H,16)*10 + mn(M,16)*5) + ceil(mx(F-16,0)**2*172.5 + mx(H-16,0)**2*86.25 + mx(M-16,0)**2*28.75);
  const ap     = ceil(mn(H,16)*10 + mn(C,16)*20 + mn(M,16)*5) + ceil(mx(C-16,0)**2*172.5 + mx(H-16,0)**2*86.25 + mx(M-16,0)**2*28.75);
  const armure = ceil(mn(F,16)*4.5 + mn(H,16)*1 + mn(M,16)*6) + ceil(mx(F-16,0)**2*14 + mx(C-16,0)**2*20 + mx(H-16,0)**2*2);
  const resmag = ceil(mn(H,16)*1 + mn(C,16)*4.5 + mn(M,16)*6) + ceil(mx(C-16,0)**2*14 + mx(M-16,0)**2*20 + mx(H-16,0)**2*2);
  const crit   = 5 + ceil(mn(H,20)*5);
  const dcrit  = 150 + ceil(mn(F,16)*2 + mn(C,16)*2 + mn(H,16)*5) + ceil(mx(F-16,0)**2*(10/3) + mx(C-16,0)**2*(10/3) + mx(H-16,0)**2*(25/3));
  const sapience = ceil(mn(H,16)*2.5);
  return { hp, mana, ad, ap, armure, resmag, crit, dcrit, sapience };
}

/* --- Table de progression (niveaux 1 → 18) --- */
const LEVELS = [
  { lvl:1,  gain:'10 (départ)', total:10, limit:5  },
  { lvl:2,  gain:1, total:11, limit:6  },
  { lvl:3,  gain:1, total:12, limit:7  },
  { lvl:4,  gain:2, total:14, limit:8  },
  { lvl:5,  gain:1, total:15, limit:9  },
  { lvl:6,  gain:2, total:17, limit:10 },
  { lvl:7,  gain:1, total:18, limit:11 },
  { lvl:8,  gain:1, total:19, limit:12 },
  { lvl:9,  gain:2, total:21, limit:13 },
  { lvl:10, gain:1, total:22, limit:14 },
  { lvl:11, gain:1, total:23, limit:15 },
  { lvl:12, gain:2, total:25, limit:16 },
  { lvl:13, gain:1, total:26, limit:16 },
  { lvl:14, gain:1, total:27, limit:16 },
  { lvl:15, gain:2, total:29, limit:16 },
  { lvl:16, gain:1, total:30, limit:16 },
  { lvl:17, gain:1, total:31, limit:16 },
  { lvl:18, gain:2, total:33, limit:16 },
];

/* --- Attributs principaux et sous-stats dérivées (page Progression) --- */
const ATTRIBUTES = [
  { key:'force', name:'Force',          color:'var(--hp)',     sub:['+20 AD / pt', '+75 HP / pt', '+4-5 Armure / pt', '+2% D. Crit / pt'] },
  { key:'hab',   name:'Habileté',       color:'var(--gold)',   sub:['+10 AD / pt', '+10 AP / pt', '+5% Crit / pt', '+2.5 Sapience / pt', '+1 Armure / pt'] },
  { key:'mental',name:'Mental',         color:'var(--buff)',   sub:['+45 HP / pt', '+30 Mana / pt', '+5 AD/AP / pt', '+6 Armure / pt', '+6 Rés. Mag / pt'] },
  { key:'magie', name:'Magie/Cosmique', color:'var(--silver)', sub:['+20 AP / pt', '+75 Mana / pt', '+5 HP / pt', '+2% D. Crit / pt', '+4-5 Rés. Mag / pt'] },
];

/* --- Les 16 buffs / débuffs réels --- */
const BUFFS = [
  { id:'miracule',  type:'buff',   name:'Miraculé',       effet:'+50% Soins / Bouclier' },
  { id:'peaufer',   type:'buff',   name:'Peau de fer',    effet:'+50% Armure' },
  { id:'esprit',    type:'buff',   name:"Esprit d'acier", effet:'+50% Rés. Magique' },
  { id:'inflex',    type:'buff',   name:'Inflexible',     effet:'+50% Armure & Rés. Mag.' },
  { id:'bravoure',  type:'buff',   name:'Bravoure',       effet:'+50% AD' },
  { id:'foi',       type:'buff',   name:'Foi',            effet:'+50% AP' },
  { id:'heroisme',  type:'buff',   name:'Héroïsme',       effet:'+50% AD & AP' },
  { id:'aiguisage', type:'buff',   name:'Aiguisage',      effet:'% Crit doublé' },
  { id:'hemorragie',type:'debuff', name:'Hémorragie',     effet:'-50% Soins / Bouclier' },
  { id:'brise',     type:'debuff', name:'Brisé',          effet:'-50% Armure' },
  { id:'chocmag',   type:'debuff', name:'Choc magique',   effet:'-50% Rés. Magique' },
  { id:'aneanti',   type:'debuff', name:'Anéanti',        effet:'-50% Armure & Rés. Mag.' },
  { id:'affaibli',  type:'debuff', name:'Affaiblissement',effet:'-50% AD' },
  { id:'erosion',   type:'debuff', name:'Érosion magique',effet:'-50% AP' },
  { id:'epuise',    type:'debuff', name:'Épuisement',     effet:'-50% AD & AP' },
  { id:'fletri',    type:'debuff', name:'Flétrissement',  effet:'Marques cumulatives' },
];

/* --- Armes (réelles, issues des grilles joueurs) --- */
const WEAPONS = [
  { id:'claymore',     name:'Claymore',              cat:'Physique', type:'2H',     stat:'ad', ic:'⚔' },
  { id:'gantelet',     name:'Gantelet renforcé',     cat:'Physique', type:'1H',     stat:'ad', ic:'🥊' },
  { id:'dague',        name:'Dague',                 cat:'Physique', type:'1H',     stat:'ad', ic:'🗡' },
  { id:'epeecourte',   name:'Épée courte',           cat:'Physique', type:'Poly',   stat:'ad', ic:'⚔' },
  { id:'relique',      name:'Relique lunaire/solaire',cat:'Magique', type:'2H',     stat:'ap', ic:'🌙' },
  { id:'archextech',   name:'Arc hextech',           cat:'Physique', type:'Portée', stat:'ad', ic:'🏹' },
  { id:'arbalete',     name:'Arbalète légère',       cat:'Physique', type:'Portée', stat:'ad', ic:'🎯' },
  { id:'epeebouclier', name:'Épée + Bouclier',       cat:'Physique', type:'1H',     stat:'ad', ic:'🛡' },
  { id:'epeeni',       name:'Épée* (NI)',           cat:'Physique', type:'1H',     stat:'ad', ic:'⚔' },
  { id:'hachette',     name:'Hachette',              cat:'Physique', type:'1H',     stat:'ad', ic:'🪓' },
];

/* --- Calcul d'une attaque (dégâts pleins ; le système de mode de combat a été retiré) --- */
function computeAttack({ weapon, stats, lethality, isCrit }) {
  const power = weapon.stat === 'ap' ? stats.ap : stats.ad;
  const base = power; // dégâts pleins
  const dmg = isCrit ? Math.round(base * (stats.dcrit / 100)) : base;
  const pen = lethality * 10; // léthalité = pénétration d'armure forfaitaire
  return { power, base, dmg, crit: isCrit, pen };
}

/* --- 5 personnages (renommés depuis Erwan/Baptiste/JB/Steph/Fab) --- */
function mkChar(o) {
  const stats = computeStats(o.F, o.H, o.M, o.C);
  const modifiers = (window.DEFAULT_MODIFIERS && window.DEFAULT_MODIFIERS[o.id]) || {};
  return { ...o, attrs:{ force:o.F, hab:o.H, mental:o.M, magie:o.C }, stats, modifiers };
}

/* Données fidèles aux feuilles : JB→Rathäel, Baptiste→Urskaar, Erwan→Smith,
   Fab→Elias Crowe (id interne 'lunick'), Steph→Jett. Niveau 2 (total 11 + 1 point
   bonus de création = 12, limite 6).
   HP/Mana max = formules Excel (validées : 495/265, 685/180, 290/310, 520/180, 150/460). */
const CHARACTERS = [
  mkChar({ id:'rathael', name:'Rathäel', player:'JB', title:'Le Serment Brisé', cls:'Chevalier déchu',
    F:4, H:3, M:4, C:1, level:2, color:'var(--hp)', initial:'R', img:'players/rathael.jpg',
    weaponId:'claymore', weaponIds:['claymore','epeebouclier'], lethality:0, fatigue:1, eau:3,
    hpCur:1.0, manaCur:205/265, shieldCur:99, shieldMax:200,
    rune:'Sadisme',
    buffs:[],
    inv:[
      { cat:'Équipement', name:'Claymore', sub:'2H · +10 AD (fin de traversée)', qty:1, ic:'⚔', img:'ATH/Armes/claymore.webp' },
      { cat:'Équipement', name:'Épée + Bouclier', sub:'1H', qty:1, ic:'🛡', img:'ATH/Armes/epee-bouclier.webp' },
      { cat:'Consommables', name:'Potion soin mineur', sub:'Rend 15 + 15% HP', qty:0, ic:'🧪', img:'ATH/Items/potion-soin-mineur.webp' },
      { cat:'Consommables', name:'Potion mana mineur', sub:'Rend 10 + 10% Mana', qty:1, ic:'🔵', img:'ATH/Items/potion-mana-mineur.webp' },
      { cat:'Butin', name:'Kéminite', sub:'Sert à appeler Taliyah', qty:1, ic:'🔮', img:'ATH/Items/keminite.webp' },
    ],
    coins:{ plat:0, or:10, arg:10, cuiv:10 },
  }),
  mkChar({ id:'urskaar', name:'Urskaar', player:'Baptiste', title:'Le Poing de Fer', cls:'Pugiliste',
    F:6, H:1, M:5, C:0, level:2, color:'var(--gold)', initial:'U', img:'players/urskaar.jpg',
    weaponId:'gantelet', weaponIds:['gantelet','dague','epeeni'], lethality:0, fatigue:1, eau:2,
    hpCur:312/685, manaCur:30/180, shieldCur:0, shieldMax:200,
    rune:null,
    buffs:['bravoure'],
    inv:[
      { cat:'Équipement', name:'Gantelet renforcé', sub:'1H', qty:1, ic:'🥊', img:'ATH/Armes/gantelet.webp' },
      { cat:'Consommables', name:'Potion soin mineur', sub:'Rend 15 + 15% HP', qty:1, ic:'🧪', img:'ATH/Items/potion-soin-mineur.webp' },
      { cat:'Consommables', name:'Potion mana mineur', sub:'Rend 10 + 10% Mana', qty:1, ic:'🔵', img:'ATH/Items/potion-mana-mineur.webp' },
      { cat:'Butin', name:'Kéminite', sub:'Appel Taliyah', qty:1, ic:'🔮', img:'ATH/Items/keminite.webp' },
    ],
    coins:{ plat:0, or:10, arg:10, cuiv:10 },
  }),
  mkChar({ id:'smith', name:'Smith', player:'Erwan', title:'La Lame Silencieuse', cls:'Duelliste',
    F:3, H:6, M:1, C:2, level:2, color:'var(--buff)', initial:'S', img:'players/smith.jpg',
    weaponId:'dague', weaponIds:['dague','epeeni'], lethality:0, fatigue:0, eau:3,
    hpCur:1.0, manaCur:1.0, shieldCur:0, shieldMax:200,
    rune:null,
    buffs:['peaufer'],
    inv:[
      { cat:'Équipement', name:'Dague (Loyauté)', sub:'1H', qty:2, ic:'🗡', img:'ATH/Armes/dague.webp' },
      { cat:'Équipement', name:'Épée* (NI)', sub:'Non identifiée', qty:1, ic:'⚔', img:'ATH/Armes/epee-ni.webp' },
      { cat:'Consommables', name:'Potion soin mineur', sub:'Rend 15 + 15% HP', qty:1, ic:'🧪', img:'ATH/Items/potion-soin-mineur.webp' },
      { cat:'Consommables', name:'Potion mana mineur', sub:'Rend 10 + 10% Mana', qty:1, ic:'🔵', img:'ATH/Items/potion-mana-mineur.webp' },
      { cat:'Consommables', name:'Parchemins (NI)', sub:'Non identifiés', qty:2, ic:'📜', img:'ATH/Items/parchemin.webp' },
      { cat:'Consommables', name:'Cristal explosif', sub:'Réactif instable', qty:1, ic:'💎', img:'ATH/Items/cristal-explosif.webp' },
      { cat:'Consommables', name:'Cristal très explosif', sub:'Très instable', qty:1, ic:'💥', img:'ATH/Items/cristal-tres-explosif.webp' },
      { cat:'Butin', name:'Butin de monstre', sub:'Tutoriel', qty:1, ic:'🦴', img:'ATH/Items/loot-mob.webp' },
    ],
    coins:{ plat:0, or:10, arg:10, cuiv:10 },
  }),
  // id interne 'lunick' conservé (clé Firebase/Admin) ; affiché « Elias Crowe » — pas de migration.
  mkChar({ id:'lunick', name:'Elias Crowe', player:'Fab', title:'Capitaine corsaire', cls:'Navigateur arcanique',
    F:5, H:4, M:3, C:0, level:2, color:'var(--mana)', initial:'E', img:'players/Elias.png',
    weaponId:'relique', weaponIds:['relique','arbalete','dague','hachette'], lethality:0, fatigue:0, eau:1,
    hpCur:1.0, manaCur:150/180, shieldCur:0, shieldMax:200,
    rune:null,
    buffs:['foi'],
    inv:[
      { cat:'Équipement', name:'Arbalète légère', sub:'Portée · 25 pa', qty:1, ic:'🎯', img:'ATH/Armes/arbalete.webp' },
      { cat:'Équipement', name:'Dague (dans sa botte)', sub:'1H · 1 pa', qty:1, ic:'🗡', img:'ATH/Armes/dague.webp' },
      { cat:'Équipement', name:'Hachette', sub:'Arme secondaire · brisage · 1 pa', qty:1, ic:'🪓', img:'ATH/Armes/hachette.webp' },
      { cat:'Consommables', name:'Potion soin mineur', sub:'Rend 15 + 15% HP', qty:1, ic:'🧪', img:'ATH/Items/potion-soin-mineur.webp' },
      { cat:'Consommables', name:'Potion mana mineur', sub:'Rend 10 + 10% Mana', qty:1, ic:'🔵', img:'ATH/Items/potion-mana-mineur.webp' },
      { cat:'Butin', name:'Tricorne', sub:"Valeur d'1 pièce d'or (sentimental)", qty:1, ic:'🎩', img:'ATH/Items/tricorne.webp' },
      { cat:'Butin', name:'Boussole', sub:'1 pa', qty:1, ic:'🧭', img:'ATH/Items/boussole.webp' },
      { cat:'Butin', name:'Carte', sub:'N/A', qty:1, ic:'🗺', img:'ATH/Items/carte.webp' },
      { cat:'Butin', name:'Gourde', sub:'10 pc', qty:1, ic:'🧴', img:'ATH/Items/gourde.webp' },
    ],
    coins:{ plat:0, or:10, arg:10, cuiv:10 },
  }),
  mkChar({ id:'jett', name:'Jett', player:'Steph', title:'La Flèche Hextech', cls:'Artificier',
    F:1, H:6, M:1, C:4, level:2, color:'var(--silver)', initial:'J', img:'players/jett.jpg',
    weaponId:'epeecourte', weaponIds:['archextech','epeecourte','dague'], lethality:0, fatigue:0, eau:2,
    hpCur:1.0, manaCur:90/460, shieldCur:35, shieldMax:200,
    rune:null,
    buffs:['aiguisage'],
    inv:[
      { cat:'Équipement', name:'Arc hextech', sub:'Portée · Physique', qty:1, ic:'🏹', img:'ATH/Armes/arc-hextech.webp' },
      { cat:'Équipement', name:'Dague', sub:'1H', qty:1, ic:'🗡', img:'ATH/Armes/dague.webp' },
      { cat:'Équipement', name:"Livre : L'Histoire de Runeterra", sub:'Lecture', qty:1, ic:'📖', img:'ATH/Items/livre-histoire.webp' },
      { cat:'Équipement', name:'Boîte à outils', sub:'', qty:1, ic:'🧰', img:'ATH/Items/boite-a-outils.webp' },
      { cat:'Consommables', name:'Potion soin mineur', sub:'Rend 15 + 15% HP', qty:0, ic:'🧪', img:'ATH/Items/potion-soin-mineur.webp' },
      { cat:'Consommables', name:'Potion mana mineur', sub:'Rend 10 + 10% Mana', qty:1, ic:'🔵', img:'ATH/Items/potion-mana-mineur.webp' },
      { cat:'Consommables', name:'Potion néfaste inconnue', sub:'Inconnue', qty:2, ic:'🧫', img:'ATH/Items/potion-nefaste-inconnu.webp' },
      { cat:'Consommables', name:'Pierre magique de transmutation', sub:'', qty:1, ic:'🪨', img:'ATH/Items/pierre-transmutation.webp' },
    ],
    coins:{ plat:0, or:10, arg:10, cuiv:10 },
  }),
];

/* --- Journal de combat (extrait réel du fichier source) --- */
const JOURNAL = [
  { t:'14:32', arme:'Lance',    type:'Physique', crit:false, dmg:131 },
  { t:'14:33', arme:'Lance',    type:'Physique', crit:false, dmg:0   },
  { t:'15:18', arme:'Lance',    type:'Physique', crit:false, dmg:43  },
  { t:'15:18', arme:'Lance',    type:'Physique', crit:false, dmg:0   },
  { t:'15:19', arme:'Lance',    type:'Physique', crit:false, dmg:43  },
  { t:'15:19', arme:'Lance',    type:'Physique', crit:false, dmg:43  },
  { t:'15:43', arme:'Dague',    type:'Physique', crit:false, dmg:131 },
  { t:'15:44', arme:'Lance',    type:'Physique', crit:true,  dmg:318 },
  { t:'15:45', arme:'Dague',    type:'Physique', crit:false, dmg:105 },
  { t:'15:45', arme:'Dague',    type:'Physique', crit:false, dmg:0   },
  { t:'16:02', arme:'Dague',    type:'Physique', crit:false, dmg:131 },
  { t:'16:02', arme:'Dague',    type:'Physique', crit:false, dmg:131 },
  { t:'16:21', arme:'Grimoire', type:'Magique',  crit:false, dmg:135 },
  { t:'16:21', arme:'Grimoire', type:'Magique',  crit:false, dmg:135 },
  { t:'16:22', arme:'Grimoire', type:'Magique',  crit:true,  dmg:357 },
  { t:'16:23', arme:'Grimoire', type:'Magique',  crit:false, dmg:135 },
  { t:'16:41', arme:'Grimoire', type:'Magique',  crit:false, dmg:135 },
  { t:'16:42', arme:'Grimoire', type:'Magique',  crit:true,  dmg:357 },
];

/* --- Rune Domination : 3 voies --- */
const RUNE = {
  name:'Domination',
  paths:[
    { name:'Burst', color:'var(--hp)',
      perks:[
        { t:'+10 % Crit', d:'Bonus passif permanent' },
        { t:'Opportunité (passif)', d:'+30/40 DA, +1 IA et +10 % Crit par tour sans attaquer (infini)' },
        { t:'Explosivité (actif)', d:"Double les dégâts d'une compétence (CD 5)" },
        { t:'Domination', d:'+30 DA et 10 % Crit par kill (permanent, max 3)' },
      ] },
    { name:'Mobilité', color:'var(--mana-bright)',
      perks:[
        { t:'+1 MS et +1 IA', d:'Bonus passif permanent' },
        { t:'Altération gravitationnelle (actif)', d:'+2 MS et 30 % esquive pour 2 tours (CD 3)' },
        { t:'Déplacement éclair (passif)', d:'+20/40 DA et +3 % Crit par MS bonus' },
        { t:'Domination', d:'+2 MS par kill (permanent, max 3)' },
      ] },
    { name:'Sadisme', color:'var(--gold)',
      perks:[
        { t:'+10/20 DA et 10 léthalité', d:'Bonus passif permanent' },
        { t:'Écorchage (actif)', d:'+30 léthalité sur cible — toute l\u2019équipe si HP cible = 100 %' },
        { t:'Torture enivrante (passif)', d:'Dégâts +50 % si HP cible ≤ 30 % et +10 % Omnivamp' },
        { t:'Domination', d:'Effet augmenté de 30 % par kill (permanent, max 3)' },
      ] },
  ],
};

Object.assign(window, {
  computeStats, computeAttack, CHARACTERS, BUFFS, WEAPONS,
  LEVELS, ATTRIBUTES, JOURNAL, RUNE,
});
