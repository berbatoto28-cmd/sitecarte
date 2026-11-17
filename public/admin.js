'use strict';
const $ = (id) => document.getElementById(id);
async function request(url) {
  const response = await fetch(url, {credentials:'same-origin',headers:{Accept:'application/json'}});
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
      tbody.appendChild(tr);
    }
    $('player-note').textContent = data.players.length
      ? 'Affichage de ' + data.players.length + ' compte(s), maximum 40.'
      : 'Aucun compte correspondant.';
  } catch (error) { $('player-note').textContent = error.message; }
}
async function start() {
  try {
    const me = await request('/api/me');
    if (!me.me?.user?.isAdmin) {
      alertMessage('Accès refusé. Seul le compte AdminLucifer préalablement autorisé peut ouvrir ce panel.');
      return;
    }
    const data = await request('/api/admin/overview');
    $('welcome').textContent = 'Connecté en tant que ' + data.operator + ' · Consultation uniquement';
    const labels = [
      ['Comptes enregistrés',data.stats.users],
      ['Actifs sur 24 h',data.stats.active24h],
      ['Cartes en collection',data.stats.ownedCards],
      ['Annonces du marché',data.stats.activeListings],
      ['Échanges en attente',data.stats.pendingTrades]
    ];
    $('stats').replaceChildren();
    for (const [name,value] of labels) {
      const box=document.createElement('div');box.className='card';
      const label=document.createElement('span');label.textContent=name;
      const b=document.createElement('b');b.textContent=number(value);
      box.append(label,b);$('stats').appendChild(box);
    }
    $('notice').hidden=true;
    $('dashboard').hidden=false;
    $('search-form').addEventListener('submit',(event)=>{event.preventDefault();searchPlayers();});
    await searchPlayers();
  } catch (error) {
    alertMessage(error.message + ' Connectez-vous sur le site puis réessayez.');
  }
}
start();