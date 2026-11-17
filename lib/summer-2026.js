/* Nouvelles variantes Summer Waifus — novembre 2026.
 * Injection en mémoire pour préserver les anciennes cartes, les comptes et les ID.
 * Les illustrations personnalisées sont prioritaires dans public/art/.
 */
'use strict';

const ENTRIES = [
  { name:'Rem',              anime:'Re:Zero',                 rarity:'legendaire', code:'REM' },
  { name:'Violet Evergarden',anime:'Violet Evergarden',       rarity:'legendaire', code:'VIOLET' },
  { name:'Ino Yamanaka',     anime:'Naruto / Boruto',        rarity:'legendaire', code:'INO', adult:true },
  { name:'Mei Terumi',       anime:'Naruto Shippuden',       rarity:'legendaire', code:'MEI' },
  { name:'Saber',            anime:'Fate/stay night',        rarity:'mythique',   code:'SABER' },
  { name:'Mirajane Strauss', anime:'Fairy Tail',            rarity:'mythique',   code:'MIRAJANE' },
  { name:'Juvia Lockser',    anime:'Fairy Tail',            rarity:'mythique',   code:'JUVIA' },
  { name:'Bulma',            anime:'Dragon Ball',           rarity:'mythique',   code:'BULMA',adult:true },
  { name:'Mikasa Ackerman',  anime:'Attack on Titan',       rarity:'secrete',    code:'MIKASA',adult:true },
  { name:'Mai Sakurajima',   anime:'Rascal Does Not Dream',  rarity:'secrete',    code:'MAI' },
  { name:'Zero Two',         anime:'Darling in the Franxx', rarity:'secrete',    code:'ZERO-TWO' },
  { name:'Lucy Heartfilia',  anime:'Fairy Tail',            rarity:'secrete',    code:'LUCY' },
];
const norm = x => String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const aliases = {
  'Ino Yamanaka':['Ino'], 'Mirajane Strauss':['Mirajane'], 'Juvia Lockser':['Juvia'],
  'Mikasa Ackerman':['Mikasa'], 'Lucy Heartfilia':['Lucy'], 'Mei Terumi':['Mei Terumi','Mei'],
  'Zero Two':['Zero Two','002','02'], 'Saber':['Artoria Pendragon','Artoria','Saber'],
};
function install(data) {
  const summer = data.series.find(s=>s.special && /summer|waifu/i.test(s.name+' '+(s.title||'')+' '+s.id));
  if (!summer) { console.warn('[Summer Waifus] Édition non trouvée : aucune carte ajoutée.'); return 0; }
  const existing = new Set(data.cards.map(c=>c.id));
  let added = 0;
  for (const e of ENTRIES) {
    const id = 'SUM-N26-'+e.code;
    if(existing.has(id)) continue;
    // Réutiliser une illustration du personnage présent dans le catalogue lorsqu'elle existe.
    // Dans Summer Waifus, préférer la variante estivale déjà présente.
    const targets = [e.name,...(aliases[e.name]||[])].map(norm);
    const matching = data.cards.filter(c=>targets.includes(norm(c.name)));
    const summerMatch = matching.find(c=>c.serie===summer.id);
    const previous = summerMatch || matching[0];
    const img = previous?.art || previous?.img || summer.cover || '';
    const card = {
      id,num:id,serie:summer.id,name:e.name,rarity:e.rarity,
      img, art:img, fav:6000-added*17, anime:e.anime,
      title:e.anime, edition:'Summer Waifus 2026', variant:'Summer Beach',
      summer:true, adult:!!e.adult, source:'Collection Summer Waifus'
    };
    data.cards.push(card);
    existing.add(id);
    added++;
  }
  // Maintenir le compteur public et les statistiques de complétion.
  summer.count = data.cards.filter(c=>c.serie===summer.id).length;
  summer.desc = (summer.desc ? summer.desc+' ' : '') + '12 nouvelles variantes collector : 4 Légendaires, 4 Mythiques et 4 Secrètes.';
  return added;
}
module.exports={install,ENTRIES};
