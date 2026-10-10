// Simulation théorique 5 v 5 — fourchettes du §4 (rang 1).
// Unité : N[att][cible] = nb d'AA pour tuer (calibrage 2026-09-05 §5, niv 18 ; d20 + crit + mitigation inclus).
// Une action de multiplicateur m retire m / N PV (en fraction des PV max de la cible).
const CL = { E:'ADC', S:'ASN', U:'BRU', R:'TKP', J:'TKM' };
// Matrice RECALCULEE le 2026-10-10 avec le moteur actuel (MITIGATION_K 100, +5 AR/RM de socle) : spec §8.7.
// opts.oldMatrix = true reprend celle du calibrage du 2026-09-05.
const N_OLD = {
  ADC:{ADC:2.8,ASN:2.2,TKP:5.5,TKM:4.0,BRU:5.2},
  ASN:{ADC:3.1,ASN:2.3,TKP:6.0,TKM:4.4,BRU:5.7},
  TKP:{ADC:6.7,ASN:5.1,TKP:13.0,TKM:9.5,BRU:12.3},
  TKM:{ADC:4.8,ASN:4.0,TKP:10.2,TKM:12.0,BRU:8.8},
  BRU:{ADC:4.4,ASN:3.4,TKP:8.6,TKM:6.3,BRU:8.2},
};
const N_NEW = {
  ADC:{ADC:2.6,ASN:2.1,TKP:6.4,TKM:5.2,BRU:5.6},
  ASN:{ADC:2.9,ASN:2.3,TKP:7.7,TKM:6.2,BRU:6.4},
  TKP:{ADC:6.2,ASN:4.9,TKP:12.7,TKM:10.3,BRU:11.6},
  TKM:{ADC:5.1,ASN:4.3,TKP:11.1,TKM:11.8,BRU:9.5},
  BRU:{ADC:4.1,ASN:3.3,TKP:8.4,TKM:6.9,BRU:7.7},
};
// Kits : 'v1' = valeurs du §4.4 (2026-10-06) ; 'v2' = rangs 1 du §8 (2026-10-10). m est en AA de reference
// (100 % AD/AP, crit moyen de l'attaquant inclus par la matrice).
//  v2 : Tir Cible 110 % AD sans crit, +2 au jet (0,9 une fois le crit de l'AA retire) ; Attaque sournoise
//  x4,5 de l'AA a 0,6, +30 % de crit (3,3) et 1,2 marquee seule ; Pugilat gauche 1,35 (une tranche un tour
//  sur deux) ; Frappe Irritee 0,5 ; attaque du Nano-hex 0,8 (quelques CN en AD). Le reste n'est pas rechiffre.
const KITS = {
  v1:{ eC1:1.3, eC2:2.0, eC3:2.0, sPeak:4.0, sMarked:2.0, uC1:1.45, uAA:1.0, rC1:0.6, nano:null },
  v2:{ eC1:0.9, eC2:1.1, eC3:1.6, sPeak:3.3, sMarked:1.2, uC1:1.35, uAA:0.75, rC1:0.5, nano:0.8 },
};
const ORDER = ['U','S','E','J','R'];

function mkTeam(side){ return ORDER.map(id=>({id,side,cls:CL[id],hp:1,maxBonus:0,cd:{},stun:0,
  camo:false,charges:0,hitThisTurn:false,transform:0,taunt:null,nano:false,usedUlt:false})); }

function run(opts){
  const N = opts.oldMatrix ? N_OLD : N_NEW;
  const K = KITS[opts.kits || 'v2'];
  const AA = opts.aa ?? 0.6;
  const rnd = opts.rng || Math.random;
  const A = mkTeam('A'), B = mkTeam('B');
  const foes = s => s==='A'?B:A, mates = s => s==='A'?A:B;
  const alive = t => t.filter(c=>c.hp>0);
  const skill = (eff) => { // résolution d'une compétence selon le scénario
    if (opts.mode==='p50') return rnd()<0.5 ? eff : 0;
    if (opts.mode==='e50') return eff*0.5;
    return eff;
  };
  const dmg = (att, tgt, m) => { if(!tgt||tgt.hp<=0||m<=0) return;
    let mult = att.transform>0 ? 1.3 : 1;
    tgt.hp -= m*mult / N[att.cls][tgt.cls]; tgt.hitThisTurn = true;
    if (tgt.id==='R') tgt.charges = Math.min(5, tgt.charges+1); };
  const heal = (att, m) => { const al = alive(mates(att.side)).sort((a,b)=>a.hp-b.hp)[0]; if(!al||m<=0) return;
    al.hp = Math.min(1+al.maxBonus, al.hp + m / N[att.cls][al.cls]); };
  const focus = (att) => { const f = alive(foes(att.side)); if(!f.length) return null;
    if (att.taunt && att.taunt.hp>0) return att.taunt;
    return f.sort((a,b)=> a.hp*N[att.cls][a.cls] - b.hp*N[att.cls][b.cls])[0]; };
  const extra = (att, k) => alive(foes(att.side)).filter(x=>x!==focus(att)).sort((a,b)=>a.hp-b.hp).slice(0,k);
  const topDealer = (side) => alive(foes(side)).sort((a,b)=>({E:3,U:4,S:5,J:1,R:0}[b.id]-{E:3,U:4,S:5,J:1,R:0}[a.id]))[0];
  const ready = (c,k,t) => (c.cd[k]||0) <= t;

  function act(c, t){
    if (c.hp<=0) return;
    if (c.stun>0){ c.stun--; return; }
    const tg = focus(c); if(!tg) return;
    const noSkills = opts.mode==='aa';
    if (noSkills){ dmg(c,tg,AA); return; }
    switch(c.id){
      case 'E':
        if (!c.usedUlt && t>=2){ c.usedUlt=true; const e=skill(2.0); [tg,...extra(c,2)].forEach(x=>dmg(c,x,e)); return; }
        if (ready(c,'c2',t)){ c.cd.c2=t+3; dmg(c,tg,skill(K.eC2)); return; }
        if (ready(c,'c3',t)){ c.cd.c3=t+3; dmg(c,tg,skill(K.eC3)); return; }
        if (ready(c,'c1',t)){ c.cd.c1=t+1; dmg(c,tg,skill(K.eC1)); return; }
        dmg(c,tg,AA); return;
      case 'S': // la cible focus est supposée marquée (optimiste pour Smith)
        if (!c.usedUlt && t>=3){ c.usedUlt=true; dmg(c,tg,skill(3.0)); return; }
        if (c.camo){ c.camo=false; c.cd.c1=t+1; dmg(c,tg,skill(K.sPeak)); return; }
        if (ready(c,'c2',t)){ c.cd.c2=t+3; c.camo = skill(1)>0; return; }
        if (ready(c,'c3',t)){ c.cd.c3=t+4; const e=skill(1.0); [tg,...extra(c,1)].forEach(x=>dmg(c,x,e)); return; }
        if (ready(c,'c1',t)){ c.cd.c1=t+1; dmg(c,tg,skill(opts.smithMarked??K.sMarked)); return; }
        dmg(c,tg,AA); return;
      case 'U':
        if (!c.usedUlt){ c.usedUlt=true; const ok=skill(1); if(ok){ c.transform=5; c.maxBonus=0.3*ok; c.hp+=0.3*ok; }
          [tg,...extra(c,1)].forEach(x=>dmg(c,x,skill(1.0))); return; }
        if (ready(c,'c2',t)){ c.cd.c2=t+3; const e=skill(2.1); [tg,...extra(c,1)].forEach(x=>dmg(c,x,e)); return; }
        if (ready(c,'c1',t)){ c.cd.c1=t+1; dmg(c,tg,skill(K.uC1)); return; }
        dmg(c,tg,AA); return;
      case 'R': {
        if (!c.usedUlt && c.hp<0.5){ c.usedUlt=true; const ok=skill(1); c.hp+=0.5*ok; c.maxBonus=0.5*ok;
          [tg,...extra(c,1)].forEach(x=>dmg(c,x,skill(1.0))); return; }
        if (ready(c,'c2',t)){ c.cd.c2=t+3; c.charges=Math.min(5,c.charges+1);
          const d=topDealer(c.side); if(d && skill(1)>0){ d.taunt=c; d.tauntLeft=2; } return; }
        if (ready(c,'c3',t) && c.charges>=3 && c.charges<5){ c.cd.c3=t+3; const e=skill(1.0*(1+0.2*c.charges));
          c.charges=0; [tg,...extra(c,1)].forEach(x=>dmg(c,x,e)); return; }
        const m = K.rC1*(1 + Math.max(0,1-c.hp) + 0.2*c.charges);
        dmg(c,tg,skill(m)); return; }
      case 'J':
        if (!c.usedUlt && t>=2){ c.usedUlt=true; c.nano = skill(1)>0; return; }
        if (ready(c,'c2',t)){ c.cd.c2=t+3; const ok=skill(1); const d=topDealer(c.side);
          if(d&&ok) d.stun=Math.max(d.stun, opts.mode==='e50'?1:2); dmg(c,tg,ok?1.0*(opts.mode==='e50'?0.5:1):0);
          heal(c, ok?1.0*(opts.mode==='e50'?0.5:1):0); return; }
        if (ready(c,'c3',t)){ c.cd.c3=t+3; const e=skill(1.0); [tg,...extra(c,1)].forEach(x=>dmg(c,x,e)); return; }
        if (ready(c,'c1',t)){ c.cd.c1=t+1; const e=skill(0.8); if(rnd()<0.5) dmg(c,tg,e); else heal(c,e); return; }
        dmg(c,tg,AA); return;
    }
  }
  // Economie d'actions REELLE (MJ, 2026-10-10) : chaque tour, un perso peut faire son attaque de base gratuite,
  // sa C1, sa C2 OU sa C3 (jamais les deux), et sa C4. opts.multi === false garde l'ancien modele (1 action).
  // Kits = rangs 1 de la revue terminee le 2026-10-10 (spec §8), en AA de reference, niveau 18.
  // opts.skillScale = conversion uniforme des DEGATS de competence (§8.11) ; soins et attaque de base non convertis.
  // opts.smithExempt (defaut true) : l'Attaque sournoise est un multiple de l'AA, deja passee a 0,6 -> non convertie.
  let limited = false; // round de surprise limite a l'attaque de base + C1 (regle MJ du 2026-10-10)
  function actMulti(c, t){
    if (c.hp<=0) return;
    if (c.stun>0){ c.stun--; return; }
    if (!focus(c)) return;
    if (opts.mode==='aa'){ dmg(c,focus(c),AA); return; }
    const SC = opts.skillScale ?? 1;
    const sk = (m) => skill(m) * SC;
    const P = c.id==='E' ? 1 + 0.06*Math.min(9, c.ech||0) : 1;   // Instinct du Chasseur : 6 % AD par charge, 9 max
    const hit = (m) => dmg(c, focus(c), m*P);
    const zone = (m, k) => { const tg=focus(c); [tg,...extra(c,k)].forEach(x=>dmg(c,x,m*P)); };
    switch(c.id){
      case 'E':
        hit(AA);
        hit(sk(0.9));                                              // Tir Cible 110 % AD sans crit, +2 au jet
        if (!limited && ready(c,'c3',t)){ c.cd.c3=t+3; hit(sk(1.6)); }         // Frappe Duale a distance
        else if (!limited && ready(c,'c2',t)){ c.cd.c2=t+3; hit(sk(1.1)); }    // Dash Tactique
        if (!limited && !c.usedUlt && t>=2){ c.usedUlt=true; zone(sk(1.3),2); c.ech=(c.ech||0)+2; } // Salve : 130 % AD x 3 cibles
        c.ech=(c.ech||0)+1;
        return;
      case 'S': { // Fondu au noir puis Attaque sournoise dans le MEME tour ; l'attaque de base vient apres
        const sm = (m) => (opts.smithExempt===false ? sk(m) : skill(m));
        if (!limited && ready(c,'c2',t)){ c.cd.c2=t+3; c.camo = skill(1)>0; }
        else if (!limited && ready(c,'c3',t)){ c.cd.c3=t+4; hit(sk(1.7)); }    // Chaines 120 % AD + saignement moyen
        if (c.camo){ c.camo=false; hit(sm(3.3)); } else hit(sm(1.2));
        hit(AA);
        return; }
      case 'U':
        if (!limited && !c.usedUlt){ c.usedUlt=true; const ok=skill(1); if(ok){ c.transform=5; c.maxBonus=0.3*ok; c.hp+=0.3*ok; } }
        hit(0.75);                                                 // AA, une tranche un tour sur deux
        hit(sk(1.35));                                             // gauche
        if (!limited && ready(c,'c2',t)){ c.cd.c2=t+3; zone(sk(1.75),1); }     // Ecrasement, 1 tranche
        return;
      case 'R':
        if (!limited && !c.usedUlt && c.hp<0.5){ c.usedUlt=true; const ok=skill(1); c.hp+=0.5*ok; c.maxBonus=0.5*ok; }
        hit(AA);
        hit(skill(0.5*(1 + Math.max(0,1-c.hp) + 0.2*c.charges)));  // Frappe Irritee 50 % AD, NON convertie (MJ)
        if (!limited && ready(c,'c3',t) && c.charges>=3 && c.charges<5){ c.cd.c3=t+3; const e=skill(0.2*c.charges)*(SC<1?0.9:1); c.charges=0; zone(e,1); } // Eclat sans le +50, x0,9 seulement (MJ)
        else if (!limited && ready(c,'c2',t)){ c.cd.c2=t+3; c.charges=Math.min(5,c.charges+1);
          const d=topDealer(c.side); if(d && skill(1)>0){ d.taunt=c; d.tauntLeft=2; } }
        return;
      case 'J':
        if (!limited && !c.usedUlt && t>=2){ c.usedUlt=true; c.nano = skill(1)>0; }
        hit(AA);
        if (rnd()<0.5) hit(sk(0.55)); else heal(c, skill(0.45));  // Remodulation : degats ou soutien
        if (!limited && ready(c,'c2',t)){ c.cd.c2=t+3; const ok=skill(1)>0 && (opts.mode!=='e50' || rnd()<0.5); const d=topDealer(c.side);
          if(d&&ok) d.stun=Math.max(d.stun,1); hit(ok?0.3*SC:0); heal(c, ok?0.9:0); }  // 1 tour d'etourdissement
        else if (!limited && ready(c,'c3',t)){ c.cd.c3=t+3; zone(sk(0.5),1); }
        return;
    }
  }
  function endOfRound(team){
    for (const c of team){
      if (c.hp<=0) continue;
      if (c.nano){ const tg=focus(c); dmg({...c,transform:0},tg,K.nano!=null ? K.nano*(opts.multi===false?1:(opts.skillScale??1)) : 1.0*AA); }
      if (c.transform>0) c.transform--;
      if (c.tauntLeft>0 && --c.tauntLeft===0) c.taunt=null;
      if (c.id==='R'){
        if (c.charges>=5 && opts.mode!=='aa'){ // Âme fendue : régén + aura 8 % PV max (≈5,5 % après RM)
          c.hp=Math.min(1+c.maxBonus,c.hp+0.10);
          alive(foes(c.side)).slice(0,2).forEach(x=>x.hp-=0.055);
          const al=alive(mates(c.side)).filter(x=>x!==c)[0]; if(al) al.hp-=0.055;
        }
        if (!c.hitThisTurn) c.charges=Math.max(0,c.charges-3);
      }
      c.hitThisTurn=false;
    }
  }
  let firstDeath=null;
  for (let t=1;t<=80;t++){
    const surprise = opts.advantage && t===1;
    // opts.advantage : round de surprise (B ne joue pas au round 1). opts.surpriseAA : pendant ce round, A n'a que
    // ses attaques de base. opts.teamFirst : pas de surprise, mais TOUT le groupe A joue avant le groupe B.
    const turn = (c) => { if (surprise && c.side==='B') return;
      if (surprise && opts.surpriseAA){ if (c.hp>0 && focus(c)) dmg(c,focus(c),AA); return; }
      limited = !!(surprise && opts.surpriseC1);
      (opts.multi===false?act:actMulti)(c,t); limited = false; };
    if (opts.teamFirst){ for (const id of ORDER) turn(A.find(c=>c.id===id)); for (const id of ORDER) turn(B.find(c=>c.id===id)); }
    else for (const id of ORDER){
      const a=A.find(c=>c.id===id), b=B.find(c=>c.id===id);
      const pair = opts.advantage || (opts.bFirst? false : true) ? [a,b] : [b,a];
      for (const c of pair) turn(c);
    }
    endOfRound(A); endOfRound(B);
    if (opts.trace) opts.trace.push(t+": A["+A.filter(c=>c.hp>0).map(c=>c.id).join("")+"] B["+B.filter(c=>c.hp>0).map(c=>c.id).join("")+"]");
    if (firstDeath===null && (A.some(c=>c.hp<=0)||B.some(c=>c.hp<=0))) firstDeath=t;
    const la=alive(A).length, lb=alive(B).length;
    if (!la || !lb) return { rounds:t, firstDeath, winner: la? 'A' : lb? 'B':'nul', left: la||lb,
      survivors: (la?alive(A):alive(B)).map(c=>c.id+':'+Math.round(c.hp*100)+'%').join(' ') };
  }
  return { rounds:'>80' };
}
module.exports = { run };

if (require.main === module){
  const mc=(lbl,o)=>{ const R=[],F=[],W={A:0,B:0,nul:0};
    for(let i=0;i<4000;i++){ const r=run(o); if (typeof r.rounds!=="number") { R.push(81); W.nul++; continue; } R.push(r.rounds); F.push(r.firstDeath); W[r.winner]++; }
    R.sort((a,b)=>a-b); F.sort((a,b)=>a-b); const q=(a,p)=>a[Math.floor(p*(a.length-1))];
    console.log(lbl.padEnd(40),'duree p10/med/p90', q(R,.1), q(R,.5), q(R,.9), '| 1er mort med', q(F,.5), '| victoires', JSON.stringify(W)); };
  const show=(lbl,o)=>console.log(lbl.padEnd(40), JSON.stringify(run(o)));
  for (const [name,base] of [['ACTIONS REELLES, kits de la revue, SANS conversion',{}],['ACTIONS REELLES, competences x0,6 (Attaque sournoise exemptee)',{skillScale:0.6}],['ACTIONS REELLES, x0,6, round de surprise aux attaques de base seules',{skillScale:0.6,surpriseAA:true}]]){
    console.log(''); console.log('== '+name+' ==');
    show('0. AA seules, miroir', {...base,mode:'aa'});
    show('1. Avantage (surprise + A 1er)', {...base,advantage:true});
    show('1b. Avantage, AA seules', {...base,mode:'aa',advantage:true});
    show('2. Miroir', {...base});
    show('3b. Miroir, efficacite 50 %', {...base,mode:'e50'});
    show('3b+. Avantage, efficacite 50 %', {...base,mode:'e50',advantage:true});
    mc('3a. Miroir, reussite 50 %', {...base,mode:'p50'});
    mc('3a+. Avantage, reussite 50 %', {...base,mode:'p50',advantage:true});
  }
}
