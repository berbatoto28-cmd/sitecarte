'use strict';
/* Tests d'intégrité du tirage, exécutés aussi lors du build Railway.
 * Aucun compte, solde, ni base de données des joueurs n'est modifié.
 */
const assert = require('node:assert/strict');
const G = require('../lib/game');
const specialIds = G.SPECIALS.map(s => s.id);
// Vérifier le contenu réellement éligible aux collectors :
const regularLegendary = G.CARDS.find(c => G.RANK[c.rarity] >= G.RANK.legendaire
  && !G.SERIE[c.serie].special);
assert(regularLegendary, 'Le catalogue doit avoir des Légendaires ordinaires');
for (const id of ['legends', 'villains', 'summer']) {
  const pools = G.EDITION_COLLECTORS[id];
  assert(pools && pools.legendaire.length > 0, 'Absence de collectors pour ' + id);
  for (const rank of G.RARITIES.filter(r => G.RANK[r.id] >= G.RANK.legendaire)) {
    for (const card of pools[rank.id]) {
      assert.equal(card.serie, id, 'Collecteur étranger dans ' + id);
      assert(G.isEditionCollector(card, id), 'Carte collector non reconnue');
      assert(!G.isEditionCollector(card, id === 'legends' ? 'villains' : 'legends'),
        'Un collector ne doit pas être partagé entre deux éditions');
    }
  }
  assert(!G.isEditionCollector(regularLegendary, id),
    'Une carte standard est autorisée dans une édition collector');
}
for (const id of ['lol-runeterra', 'summer', 'legends', 'villains']) {
  assert(specialIds.includes(id), 'Edition manquante : ' + id);
}
let packsTested = 0;
for (const edition of G.SPECIALS) {
  for (const pity of [false, true]) {
    for (let i = 0; i < 600; i++) {
      const cards = G.drawPack('special', edition.id, pity);
      assert.equal(cards.length, 5, 'Un pack doit contenir cinq cartes');
      for (const card of cards) {
        assert(card && G.CARD[card.id], 'La carte tiree doit exister');
        if (edition.id === 'lol-runeterra') {
          assert.equal(card.serie, edition.id, 'Carte hors LoL dans un booster LoL');
        } else if (G.RANK[card.rarity] >= G.RANK.legendaire) {
          assert.equal(card.serie, edition.id,
            'Carte ' + card.rarity + ' (' + card.serie + ') hors edition ' + edition.id);
          assert(G.isEditionCollector(card, edition.id),
            'Légendaire+ ordinaire trouvé dans un pack collector ' + edition.id);
          assert.notEqual(card.id, regularLegendary.id,
            'Une carte normale est apparue dans une édition collector');
        } else {
          assert(!G.SERIE[card.serie].special,
            'Les raretes de base doivent provenir du catalogue ordinaire');
        }
      }
      if (pity) {
        assert(cards.some(card => card.serie === edition.id && card.rarity === 'legendaire'),
          'La garantie Legendaire est incorrecte dans ' + edition.id);
      }
      packsTested++;
    }
  }
}
assert.throws(() => G.drawPack('special', 'not-an-edition', false), /édition spéciale valide/);
for (const id of ['standard','celeste','royal']) {
  for (let i = 0; i < 100; i++) {
    assert(G.drawPack(id, null, false).every(c=>!G.SERIE[c.serie].special),
      'Une edition speciale est apparue dans ' + id);
  }
}
console.log('PASS: ' + packsTested + ' packs éditions vérifiés ; Légendaire+ exclusif aux cartes collector de chaque édition ; garantie intacte.');
