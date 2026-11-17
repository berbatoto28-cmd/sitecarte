'use strict';
const $ = (id) => document.getElementById(id);
let selected = null;
let busy = false;
async function request(url, payload) {
  const options = { credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (payload !== undefined) {
    options.method = 'POST';
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(payload);
  }
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erreur de connexion.');
  return data;
}
const number = (n) => Number(n || 0).toLocaleString('fr-FR');
const date = (n) => n ? new Date(n).toLocaleString('fr-FR') : 'Jamais';
function alertMessage(message) {
  $('notice').textContent = message;
  $('notice').hidden = false;
  $('dashboard').hidden = true;
}
function addCell(row, value) {
  const td = document.createElement('td');
  td.textContent = String(value);
  row.appendChild(td);
  return td;
}
function selectPlayer(player) {
  if (busy) return;
  selected = { id: player.id, name: player.name, coins: player.coins };
  $('selected-name').textContent = player.name;
  $('selected-balance').textContent = number(player.coins);
  $('coin-amount').value = '';
  $('coin-reason').value = '';
  $('coin-message').textContent = '';
  $('coin-message').className = '';
  $('coin-panel').hidden = false;
  $('coin-panel').scrollIntoView({behavior: 'smooth', block: 'nearest'});
  $('coin-amount').focus({preventScroll: true});
}
function setBusy(value) {
  busy = value;
  for (const id of ['give-coins','remove-coins','cancel-coins']) $(id).disabled = value;
}
async function searchPlayers() {
  const tbody = $('players');
  tbody.replaceChildren();
  $('player-note').textContent = 'Recherche en cours…';
  try {
    const data = await request('/api/admin/players?q=' + encodeURIComponent($('search').value));
    for (const user of data.players) {
      const tr = document.createElement('tr');
      addCell(tr, user.name);
      addCell(tr, number(user.coins));
      addCell(tr, date(user.created_at));
      addCell(tr, date(user.last_seen));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'action';
      button.textContent = 'Gérer Coins';
      button.addEventListener('click', () => selectPlayer(user));
      const td = document.createElement('td');
      td.appendChild(button);
      tr.appendChild(td);
      tbody.appendChild(tr);
      if (selected && selected.id === user.id) {
        selected.coins = user.coins;
        $('selected-balance').textContent = number(user.coins);
      }
    }
    $('player-note').textContent = data.players.length
      ? 'Affichage de ' + data.players.length + ' compte(s), maximum 40.'
      : 'Aucun compte correspondant.';
  } catch (error) { $('player-note').textContent = error.message; }
}
async function loadHistory() {
  const tbody = $('history');
  tbody.replaceChildren();
  try {
    const data = await request('/api/admin/coins/history');
    for (const item of data.operations) {
      const tr = document.createElement('tr');
      addCell(tr, date(item.at));
      addCell(tr, item.target_name);
      const delta = addCell(tr, (item.delta > 0 ? '+' : '−') + number(Math.abs(item.delta)));
      delta.className = item.delta > 0 ? 'positive' : 'negative';
      addCell(tr, number(item.balance_after));
      addCell(tr, item.reason);
      addCell(tr, item.operator_name);
      tbody.appendChild(tr);
    }
    $('history-note').textContent = data.operations.length ? '' : 'Aucune modification enregistrée.';
  } catch (error) { $('history-note').textContent = error.message; }
}
async function adjustCoins(action) {
  if (busy || !selected) return;
  const amount = Number($('coin-amount').value);
  const reason = $('coin-reason').value.trim();
  const message = $('coin-message');
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000000) {
    message.className = 'error';
    message.textContent = 'Saisis un nombre entier de Coins compris entre 1 et 100 000 000.';
    return;
  }
  const next = selected.coins + (action === 'give' ? amount : -amount);
  if (next < 0 || next > 2000000000) {
    message.className = 'error';
    message.textContent = next < 0 ? 'Impossible de retirer plus de Coins que le solde disponible.' : 'Solde maximal : 2 milliards de Coins.';
    return;
  }
  const verb = action === 'give' ? 'DONNER' : 'RETIRER';
  const direction = action === 'give' ? 'à' : 'à';
  if (!window.confirm(
    verb + ' ' + number(amount) + ' Coins ' + direction + ' ' + selected.name +
    ' ?\n\nSolde actuel : ' + number(selected.coins) +
    '\nNouveau solde : ' + number(next) +
    '\n\nCette action sera enregistrée dans l’historique.'
  )) return;
  setBusy(true);
  message.className = '';
  message.textContent = 'Enregistrement…';
  try {
    const result = await request('/api/admin/coins/adjust', {
      playerId: selected.id,
      amount,
      action,
      expectedBalance: selected.coins,
      reason
    });
    selected.coins = result.player.coins;
    $('selected-balance').textContent = number(result.player.coins);
    $('coin-amount').value = '';
    message.className = 'success';
    message.textContent = 'Opération enregistrée : ' +
      (result.delta > 0 ? '+' : '') + number(result.delta) +
      ' Coins pour ' + result.player.name + '. Nouveau solde : ' + number(result.player.coins) + '.';
    await Promise.all([searchPlayers(),loadHistory()]);
  } catch (error) {
    message.className = 'error';
    message.textContent = error.message;
  } finally {
    setBusy(false);
  }
}
async function start() {
  try {
    const me = await request('/api/me');
    if (!me.me?.user?.isAdmin) {
      alertMessage('Accès refusé. Seul le compte AdminLucifer préalablement autorisé peut ouvrir ce panel.');
      return;
    }
    const data = await request('/api/admin/overview');
    $('welcome').textContent = 'Connecté en tant que ' + data.operator + ' · Gestion des Coins activée';
    const labels = [
      ['Comptes enregistrés',data.stats.users],
      ['Actifs sur 24 h',data.stats.active24h],
      ['Cartes en collection',data.stats.ownedCards],
      ['Annonces du marché',data.stats.activeListings],
      ['Échanges en attente',data.stats.pendingTrades]
    ];
    $('stats').replaceChildren();
    for (const [name,value] of labels) {
      const box = document.createElement('div');
      box.className = 'card';
      const label = document.createElement('span');
      label.textContent = name;
      const b = document.createElement('b');
      b.textContent = number(value);
      box.append(label,b);
      $('stats').appendChild(box);
    }
    $('notice').hidden = true;
    $('dashboard').hidden = false;
    $('search-form').addEventListener('submit', (event) => {event.preventDefault(); searchPlayers();});
    $('give-coins').addEventListener('click', () => adjustCoins('give'));
    $('remove-coins').addEventListener('click', () => adjustCoins('remove'));
    $('cancel-coins').addEventListener('click', () => {
      selected = null;
      $('coin-panel').hidden = true;
    });
    await Promise.all([searchPlayers(),loadHistory()]);
  } catch (error) {
    alertMessage(error.message + ' Connectez-vous sur le site puis réessayez.');
  }
}
start();