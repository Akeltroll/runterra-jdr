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
      { cat:'Consommables', name:'Kéminite', sub:'Sert à appeler Taliyah', qty:1, ic:'🔮', img:'ATH/Items/keminite.webp', type:'' },
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
      { cat:'Consommables', name:'Kéminite', sub:'Appel Taliyah', qty:1, ic:'🔮', img:'ATH/Items/keminite.webp' },
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

/* --- Runes : 5 familles (chiffrage Excel, DA->AD ou AP à la moyenne). --- */
const RUNES = [
  { key:'conquerant', name:'Conquérant', color:'#c89b3c', theme:'Être en combat depuis ≥ 2 tours',
    capstone:'Agression → −2 CDR (sauf ultime) · Sustain → 40 % Omni · Tenacité → insensible aux CC',
    paths:[
      { key:'agr', name:'Agression', nodes:[
        { id:'conq_agr_1', tier:'mineure', name:'+30 AD ou AP', desc:'Bonus passif permanent (orig. 20|40 DA)', mods:{ adp:30 } },
        { id:'conq_agr_2', tier:'avancee', name:'Flux', desc:"+2 JA si l'attaque précédente touche", kind:'reminder' },
        { id:'conq_agr_3', tier:'fondamentale', name:'Frénésie', desc:'+45 AD ou AP et 10 létalité par tour en combat (max 4)', kind:'reminder' },
      ]},
      { key:'sus', name:'Sustain', nodes:[
        { id:'conq_sus_1', tier:'mineure', name:'+50 HP et 10 % Omni', desc:'Bonus passif permanent', mods:{ hp:50, omni:10 } },
        { id:'conq_sus_2', tier:'avancee', name:'Réfuter la mort', desc:"Réduit les dégâts d'une attaque de moitié (CD 5)", kind:'reminder' },
        { id:'conq_sus_3', tier:'fondamentale', name:'Soif de sang', desc:'+90 AD ou AP si soin au tour précédent', kind:'reminder' },
      ]},
      { key:'ten', name:'Tenacité', nodes:[
        { id:'conq_ten_1', tier:'mineure', name:'−1 tour aux CC reçus', desc:'Bonus passif permanent', kind:'reminder' },
        { id:'conq_ten_2', tier:'avancee', name:'Adrénaline', desc:'+60 AD ou AP si CC subi depuis au plus un tour', kind:'reminder' },
        { id:'conq_ten_3', tier:'fondamentale', name:'Détermination', desc:'Devient enragé pour 2 tours (CD 5)', kind:'reminder' },
      ]},
    ]},
  { key:'domination', name:'Domination', color:'#e0463f', theme:'Avoir éliminé une cible durant la rencontre',
    capstone:'Burst → +50 Dcrit et 10 % Crit par kill (max 3) · Mobilité → +2 MS par kill (max 3) · Sadisme → effet +50 % par kill (max 3)',
    paths:[
      { key:'bur', name:'Burst', nodes:[
        { id:'domi_bur_1', tier:'mineure', name:'+10 % Crit', desc:'Bonus passif permanent', mods:{ crit:10 } },
        { id:'domi_bur_2', tier:'avancee', name:'Opportunité', desc:'+45 AD ou AP, +1 JA et +10 % Crit par tour sans attaquer (infini)', kind:'reminder' },
        { id:'domi_bur_3', tier:'fondamentale', name:'Explosivité', desc:"Double les dégâts d'une compétence (CD 5)", kind:'reminder' },
      ]},
      { key:'mob', name:'Mobilité', nodes:[
        { id:'domi_mob_1', tier:'mineure', name:'+1 MS et +1 JA', desc:'Bonus passif permanent', kind:'reminder' },
        { id:'domi_mob_2', tier:'avancee', name:'Altération gravitationnelle', desc:'+2 MS et 50 % esquive pour 2 tours (CD 5)', kind:'reminder' },
        { id:'domi_mob_3', tier:'fondamentale', name:'Déplacement éclair', desc:'+30 AD ou AP et +5 % Crit par MS bonus', kind:'reminder' },
      ]},
      { key:'sad', name:'Sadisme', nodes:[
        { id:'domi_sad_1', tier:'mineure', name:'+15 AD ou AP et 10 létalité', desc:'AD ou AP calculé ; létalité en rappel', mods:{ adp:15 }, note:'+10 létalité' },
        { id:'domi_sad_2', tier:'avancee', name:'Écorchage', desc:"+30 létalité sur la cible (toute l'équipe si cible à 100 % HP)", kind:'reminder' },
        { id:'domi_sad_3', tier:'fondamentale', name:'Torture enivrante', desc:'Dégâts +50 % si cible ≤ 50 % HP, et 10 % Omni', kind:'reminder' },
      ]},
    ]},
  { key:'sorcellerie', name:'Sorcellerie', color:'#9d6bff', theme:'Avoir ≥ 50 % de son mana max',
    capstone:"Manifestation → contrôle du golem · Harmonie → bonus de stats liés à l'élément · Maîtrise → −1 CDR",
    paths:[
      { key:'man', name:'Manifestation', nodes:[
        { id:'sorc_man_1', tier:'mineure', name:'+100 Mana', desc:'Bonus passif permanent', mods:{ mana:100 } },
        { id:'sorc_man_2', tier:'avancee', name:'Densité arcanique/cosmique', desc:'Applique un CC de 1 tour selon la compétence (+50 mana)', kind:'reminder' },
        { id:'sorc_man_3', tier:'fondamentale', name:'Golem', desc:"Invoque un golem (HP/résistance/attaque selon l'élément, 1 fois)", kind:'reminder' },
      ]},
      { key:'har', name:'Harmonie élémentaire', nodes:[
        { id:'sorc_har_1', tier:'mineure', name:'+40 AP', desc:'Bonus passif permanent', mods:{ ap:40 } },
        { id:'sorc_har_2', tier:'avancee', name:'Compétence infuse', desc:"Change l'élément principal d'une compétence (CD 5)", kind:'reminder' },
        { id:'sorc_har_3', tier:'fondamentale', name:'Spécialité élémentaire accrue', desc:"Maîtrise de l'élément principal augmentée d'un rang", kind:'reminder' },
      ]},
      { key:'mai', name:'Maîtrise magique', nodes:[
        { id:'sorc_mai_1', tier:'mineure', name:'−1 CDR (sauf ultime)', desc:'Bonus passif permanent', kind:'reminder' },
        { id:'sorc_mai_2', tier:'avancee', name:'Aery', desc:'Compétence offensive → +10 % dégâts ; défensive → alliés affectés +10 % PV max en bouclier', kind:'reminder' },
        { id:'sorc_mai_3', tier:'fondamentale', name:'Approche versatile', desc:"Coût réduit de moitié si le sort précédent était d'un élément différent", kind:'reminder' },
      ]},
    ]},
  { key:'volonte', name:'Volonté', color:'#7bd07a', theme:'Avoir ≤ 50 % de ses PV max',
    capstone:'Durabilité → +25 % PV max · CC → +10 AR/RM et +50 HP par cible affectée · Sacrifice → coût en HP réduit de moitié',
    paths:[
      { key:'dur', name:'Durabilité', nodes:[
        { id:'vol_dur_1', tier:'mineure', name:'+10 AR et 10 RM', desc:'Bonus passif permanent', mods:{ armure:10, resmag:10 } },
        { id:'vol_dur_2', tier:'avancee', name:'Peau épineuse', desc:'+30 AR et 30 RM, renvoie 10 % des dégâts subis (renvoi en rappel)', mods:{ armure:30, resmag:30 }, note:'Renvoie 10 % des dégâts subis' },
        { id:'vol_dur_3', tier:'fondamentale', name:'Immortalité éphémère', desc:'Bouclier = 50 % des HP max pour 2 tours (CD 5)', kind:'reminder' },
      ]},
      { key:'cc', name:'CC', nodes:[
        { id:'vol_cc_1', tier:'mineure', name:'+1 tour de CC', desc:'Bonus passif permanent', kind:'reminder' },
        { id:'vol_cc_2', tier:'avancee', name:'Plaquage / Pression', desc:'Immobilise une cible pour 1 tour (CD 5)', kind:'reminder' },
        { id:'vol_cc_3', tier:'fondamentale', name:'Neutralisation affaiblissante', desc:"Les CC que vous infligez réduisent l'AR et la RM de la cible de 25 %", kind:'reminder' },
      ]},
      { key:'sac', name:'Sacrifice', nodes:[
        { id:'vol_sac_1', tier:'mineure', name:'+100 HP', desc:'Bonus passif permanent', mods:{ hp:100 } },
        { id:'vol_sac_2', tier:'avancee', name:'Compétence à risque', desc:'Coûte 10 % des PV max par compétence, dégâts +20 %', kind:'reminder' },
        { id:'vol_sac_3', tier:'fondamentale', name:'Masochisme', desc:'+10 AR, +10 RM et +15 AD ou AP par usage de « Compétence à risque »', kind:'reminder' },
      ]},
    ]},
  { key:'inspiration', name:'Inspiration', color:'#8be0ff', theme:'Avoir soigné ou prévenu des dégâts sur un allié au tour précédent',
    capstone:"Amélioration → buffs/debuffs appliquent de nouveaux effets améliorés (à confirmer) · Partage → un CC peut être réassigné · Présage → jet de dé sur n'importe quelle action",
    paths:[
      { key:'ame', name:'Amélioration / Maléfice', nodes:[
        { id:'insp_ame_1', tier:'mineure', name:'+1 tour de buff/debuff', desc:'Bonus passif permanent', kind:'reminder' },
        { id:'insp_ame_2', tier:'avancee', name:'Aléatoire maîtrisé', desc:'Au début du combat, vous accorde un buff aléatoire', kind:'reminder' },
        { id:'insp_ame_3', tier:'fondamentale', name:'Influence augmentée', desc:'Buffs/maléfices augmentés de 25 %', kind:'reminder' },
      ]},
      { key:'par', name:'Partage', nodes:[
        { id:'insp_par_1', tier:'mineure', name:'+50 HP et 50 Mana', desc:'Bonus passif permanent', mods:{ hp:50, mana:50 } },
        { id:'insp_par_2', tier:'avancee', name:'Altruisme excessif', desc:'Une compétence ciblée peut transférer au choix 10 % de vos HP ou mana max (cible à confirmer)', kind:'reminder' },
        { id:'insp_par_3', tier:'fondamentale', name:'Échange', desc:'Un buff ou debuff peut être réassigné à une nouvelle cible (CD 3)', kind:'reminder' },
      ]},
      { key:'pre', name:'Présage', nodes:[
        { id:'insp_pre_1', tier:'mineure', name:'1 inspiration par séance', desc:'Bonus passif permanent', kind:'reminder' },
        { id:'insp_pre_2', tier:'avancee', name:'Brèche stratégique', desc:'La stratégie ennemie du tour suivant est divulguée (CD 5)', kind:'reminder' },
        { id:'insp_pre_3', tier:'fondamentale', name:'Retour temporel', desc:'Accordez un nouveau jet de dé à une de vos actions (CD 3)', kind:'reminder' },
      ]},
    ]},
];

/* --- Catalogue d'items pré-enregistrés (ajout rapide par le staff) ---
   Entrées sans id/qty (générés à l'ajout). Paliers de potions = proposition
   ajustable. Pièces de bourse exclues (système coins séparé). */
const ITEM_CATALOG = [
  // Consommables — potions de soin
  { cat:'Consommables', name:'Potion soin mineur',        sub:'Rend 15 + 15% HP',  ic:'🧪', img:'ATH/Items/potion-soin-mineur.webp',        type:'' },
  { cat:'Consommables', name:'Potion soin intermédiaire', sub:'Rend 30 + 20% HP',  ic:'🧪', img:'ATH/Items/potion-soin-intermediaire.webp', type:'' },
  { cat:'Consommables', name:'Potion soin avancé',        sub:'Rend 50 + 25% HP',  ic:'🧪', img:'ATH/Items/potion-soin-avance.webp',        type:'' },
  { cat:'Consommables', name:'Potion soin ultime',        sub:'Rend 100 + 30% HP', ic:'🧪', img:'ATH/Items/potion-soin-ultime.webp',        type:'' },
  // Consommables — potions de mana
  { cat:'Consommables', name:'Potion mana mineur',        sub:'Rend 10 + 10% Mana', ic:'🔵', img:'ATH/Items/potion-mana-mineur.webp',        type:'' },
  { cat:'Consommables', name:'Potion mana intermédiaire', sub:'Rend 25 + 15% Mana', ic:'🔵', img:'ATH/Items/potion-mana-intermediaire.webp', type:'' },
  { cat:'Consommables', name:'Potion mana avancé',        sub:'Rend 40 + 20% Mana', ic:'🔵', img:'ATH/Items/potion-mana-avance.webp',        type:'' },
  { cat:'Consommables', name:'Potion mana ultime',        sub:'Rend 75 + 25% Mana', ic:'🔵', img:'ATH/Items/potion-mana-ultime.webp',        type:'' },
  // Consommables — divers
  { cat:'Consommables', name:'Potion néfaste inconnue',   sub:'Effet inconnu — à vos risques', ic:'☠', img:'ATH/Items/potion-nefaste-inconnu.webp', type:'' },
  { cat:'Consommables', name:'Kéminite',                  sub:'Sert à appeler Taliyah', ic:'🔮', img:'ATH/Items/keminite.webp',               type:'' },
  { cat:'Consommables', name:'Cristal explosif',          sub:'Explose à l\'impact',    ic:'💥', img:'ATH/Items/cristal-explosif.webp',        type:'' },
  { cat:'Consommables', name:'Cristal très explosif',     sub:'Explosion majeure',      ic:'💥', img:'ATH/Items/cristal-tres-explosif.webp',   type:'' },
  // Butin
  { cat:'Butin', name:'Relique lunaire',        sub:'Connexion astrale (lune)',   ic:'🌙', img:'ATH/Items/relique-lunaire.webp',     type:'' },
  { cat:'Butin', name:'Relique solaire',        sub:'Connexion astrale (soleil)', ic:'☀', img:'ATH/Items/relique-solaire.webp',     type:'' },
  { cat:'Butin', name:'Pierre de transmutation', sub:'Transmute la matière',      ic:'🪨', img:'ATH/Items/pierre-transmutation.webp', type:'' },
  { cat:'Butin', name:'Butin de monstre',       sub:'Dépouille à revendre',       ic:'🦴', img:'ATH/Items/loot-mob.webp',           type:'' },
  { cat:'Butin', name:'Carte',                  sub:'Indique un lieu',            ic:'🗺', img:'ATH/Items/carte.webp',              type:'' },
  { cat:'Butin', name:'Boussole',               sub:'Indique le nord',            ic:'🧭', img:'ATH/Items/boussole.webp',           type:'' },
  { cat:'Butin', name:'Parchemin',              sub:'Texte ancien',               ic:'📜', img:'ATH/Items/parchemin.webp',          type:'' },
  { cat:'Butin', name:'Gourde',                 sub:'Contient de l\'eau',         ic:'🧴', img:'ATH/Items/gourde.webp',             type:'' },
  { cat:'Butin', name:'Boîte à outils',         sub:'Outils de réparation',       ic:'🧰', img:'ATH/Items/boite-a-outils.webp',     type:'' },
  { cat:'Butin', name:'Livre : L\'Histoire de Runeterra', sub:'Lecture',          ic:'📖', img:'ATH/Items/livre-histoire.webp',     type:'' },
  { cat:'Butin', name:'Tricorne',               sub:'Couvre-chef de pirate',      ic:'🎩', img:'ATH/Items/tricorne.webp',           type:'' },
  // Équipement — armes (dague => accessory ; autres => weapon)
  { cat:'Équipement', name:'Claymore',         sub:'2H · +10 AD (fin de traversée)', ic:'⚔', img:'ATH/Armes/claymore.webp',      type:'weapon' },
  { cat:'Équipement', name:'Épée + Bouclier',  sub:'1H',                              ic:'🛡', img:'ATH/Armes/epee-bouclier.webp', type:'weapon' },
  { cat:'Équipement', name:'Épée courte',      sub:'1H',                              ic:'⚔', img:'ATH/Armes/epee-courte.webp',   type:'weapon' },
  { cat:'Équipement', name:'Épée non identifiée', sub:'Non identifiée',               ic:'⚔', img:'ATH/Armes/epee-ni.webp',       type:'weapon' },
  { cat:'Équipement', name:'Arbalète légère',  sub:'Portée',                          ic:'🎯', img:'ATH/Armes/arbalete.webp',      type:'weapon' },
  { cat:'Équipement', name:'Arc hextech',      sub:'Portée · Physique',               ic:'🏹', img:'ATH/Armes/arc-hextech.webp',   type:'weapon' },
  { cat:'Équipement', name:'Gantelet renforcé', sub:'1H',                             ic:'🥊', img:'ATH/Armes/gantelet.webp',      type:'weapon' },
  { cat:'Équipement', name:'Hachette',         sub:'Arme secondaire · brisage',       ic:'🪓', img:'ATH/Armes/hachette.webp',      type:'weapon' },
  { cat:'Équipement', name:'Dague',            sub:'1H',                              ic:'🗡', img:'ATH/Armes/dague.webp',         type:'accessory' },
];

Object.assign(window, {
  computeStats, computeAttack, CHARACTERS, BUFFS, WEAPONS,
  LEVELS, ATTRIBUTES, JOURNAL, RUNES, ITEM_CATALOG,
});
