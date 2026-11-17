#!/usr/bin/env node
/* Audit V20 : aucun personnage ni portrait identique sur les cartes
   Astral, Primordiale et Secrète. Lecture seule : ne modifie ni la
   collection ni les identifiants de cartes. */
import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2] || path.resolve('data/cards.json');
if (!fs.existsSync(target)) {
  console.error('[Elite V20] Catalogue manquant : ' + target);
  console.error('Ajoutez le fichier data/cards.json avant de valider les personnages.');
  process.exit(2);
}
let data;
try { data = JSON.parse(fs.readFileSync(target, 'utf8')); }
catch (e) { console.error('[Elite V20] JSON illisible : ' + e.message); process.exit(2); }
if (!Array.isArray(data.cards)) {
  console.error('[Elite V20] Format inattendu : .cards doit être un tableau.');
  process.exit(2);
}
const eliteRarities = ['astral', 'primordiale', 'secrete'];
const elite = data.cards.filter(c => eliteRarities.includes(c.rarity));
const clean = v => String(v || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g, ' ').trim();
const origin = c => clean(c.from || c.serie);
const identity = c => {
  const explicit = c.characterId ?? c.character_id ?? c.anilistCharacterId;
  return explicit != null && String(explicit).trim() !== ''
    ? 'id:' + explicit
    : 'name:' + origin(c) + ':' + clean(c.name);
};
const portrait = c => {
  const source = c.art || c.img || '';
  return String(source).trim().split(/[?#]/)[0].toLowerCase();
};
const seenNames = new Map(), seenImages = new Map();
const nameDuplicates = [], imageDuplicates = [];
const info = c => ({ id:c.id, num:c.num, rarity:c.rarity, serie:c.serie, name:c.name, img:c.art || c.img });
for (const card of elite) {
  const key = identity(card);
  if (seenNames.has(key)) {
    nameDuplicates.push({ first: info(seenNames.get(key)), second: info(card) });
  } else seenNames.set(key, card);
  const image = portrait(card);
  if (image) {
    if (seenImages.has(image)) {
      imageDuplicates.push({ first: info(seenImages.get(image)), second: info(card) });
    } else seenImages.set(image, card);
  }
}
const used = new Set([...seenNames.keys()]);
const choices = new Map();
for (const c of data.cards) {
  if (eliteRarities.includes(c.rarity) || !c.name || !c.img) continue;
  const sid = c.serie;
  if (!choices.has(sid)) choices.set(sid, []);
  choices.get(sid).push(c);
}
for (const arr of choices.values()) arr.sort((a,b) => (b.fav || 0) - (a.fav || 0));
const proposals = nameDuplicates.map(({second}) => {
  const alternatives = (choices.get(second.serie) || []).filter(c =>
    !used.has(identity(c)) && !seenImages.has(portrait(c))
  ).slice(0,5).map(info);
  return { duplicate:second, proposedAlternatives:alternatives };
});
const counts = Object.fromEntries(eliteRarities.map(r => [r, elite.filter(c=>c.rarity===r).length]));
const report = { totalElite:elite.length, counts, duplicateCharacters:nameDuplicates,
  duplicatePortraits:imageDuplicates, replacementSuggestions:proposals };
console.log(JSON.stringify(report, null, 2));
if (nameDuplicates.length || imageDuplicates.length) {
  console.error('[Elite V20] ÉCHEC : ' + nameDuplicates.length + ' doublons de personnage, ' +
    imageDuplicates.length + ' doublons de portrait. Corriger le catalogue avant publication.');
  process.exit(1);
}
console.error('[Elite V20] OK : aucun personnage ni portrait identique sur les trois raretés.');
