const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const sidebar = $('#sidebar');
const menuBtn = $('#menuBtn');
const toast = $('#toast');
const state = { number: '', dashboard: null, groups: [], commands: [] };

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

async function api(path, options = {}) {
  const apiBase = (window.KOREXIA_API_URL || '').replace(/\/$/, '');
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
}

function formatUptime(seconds) {
  seconds = Number(seconds) || 0;
  const d = Math.floor(seconds / 86400); seconds %= 86400;
  const h = Math.floor(seconds / 3600); seconds %= 3600;
  const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60);
  return d ? `${d}j ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s}s`;
}

function setPairingResult(element, code, message = 'Code generated successfully') {
  if (!element) return;
  element.innerHTML = `<span class="result-label">PAIRING CODE</span><strong>${escapeHtml(code || 'ERROR')}</strong><small>${escapeHtml(message)}</small>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

async function generatePairing(numberInput, resultElement, button) {
  const number = numberInput?.value.replace(/\D/g, '');
  if (!number || number.length < 8 || number.length > 15) {
    showToast('Entre un numéro WhatsApp valide.');
    numberInput?.focus();
    return;
  }
  state.number = number;
  if (button) { button.disabled = true; button.style.opacity = '.65'; }
  setPairingResult(resultElement, '...', 'Connexion au serveur de pairing...');
  try {
    const data = await api('/api/pair', { method: 'POST', body: JSON.stringify({ number }) });
    setPairingResult(resultElement, data.pairingCode || 'WAITING', data.pairingCode ? 'Entre ce code dans WhatsApp > Appareils connectés.' : 'Session créée, attente du code...');
    showToast(data.pairingCode ? 'Code de pairing généré.' : 'Session WhatsApp créée.');
    pollPairStatus(number, resultElement, button);
    await refreshAll();
  } catch (error) {
    console.error('[PAIRING]', error);
    setPairingResult(resultElement, 'ERROR', error.message || 'Serveur inaccessible');
    showToast(error.message || 'Erreur du serveur de pairing.');
  } finally {
    if (button) { button.disabled = false; button.style.opacity = ''; }
  }
}

async function pollPairStatus(number, resultElement, button) {
  try {
    const data = await api(`/api/pair/status/${encodeURIComponent(number)}`);
    if (data.status === 'connected') {
      state.number = number;
      setPairingResult(resultElement, 'CONNECTED', 'WhatsApp connecté. Le panneau est maintenant en temps réel.');
      if (button) button.innerHTML = '<span>CONNECTED</span><b>✓</b>';
      await refreshAll();
      return;
    }
    if (data.pairingCode) setPairingResult(resultElement, data.pairingCode, 'Entre ce code dans WhatsApp > Appareils connectés.');
  } catch (_) {}
  setTimeout(() => pollPairStatus(number, resultElement, button), 2500);
}

$('#generateBtn')?.addEventListener('click', () => generatePairing($('#number'), $('#result'), $('#generateBtn')));
$('#generateBtn2')?.addEventListener('click', () => generatePairing($('#number2'), $('#result2'), $('#generateBtn2')));
$('#number')?.addEventListener('keydown', e => { if (e.key === 'Enter') $('#generateBtn')?.click(); });
$('#number2')?.addEventListener('keydown', e => { if (e.key === 'Enter') $('#generateBtn2')?.click(); });

const labels = { dashboard: 'Dashboard', whatsapp: 'WhatsApp', groups: 'Groups', commands: 'Commands', security: 'Security', monitoring: 'Monitoring', logs: 'Logs', settings: 'Settings' };
$$('.nav-item').forEach(button => button.addEventListener('click', () => {
  const sectionName = button.dataset.section;
  $$('.nav-item').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  $$('.section').forEach(section => section.classList.remove('active'));
  document.getElementById(sectionName)?.classList.add('active');
  const label = $('#sectionLabel'); if (label) label.textContent = labels[sectionName] || sectionName;
  sidebar?.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (sectionName === 'groups') loadGroups();
  if (sectionName === 'commands') loadCommands();
  if (sectionName === 'security') loadSecurity();
  if (sectionName === 'logs') loadLogs();
}));
menuBtn?.addEventListener('click', () => sidebar?.classList.toggle('open'));

async function refreshDashboard() {
  const data = await api(`/api/dashboard${state.number ? `?number=${encodeURIComponent(state.number)}` : ''}`);
  state.dashboard = data;
  const session = data.session || {};
  if (!state.number && session.number) state.number = session.number;
  $('#groupCount') && ($('#groupCount').textContent = data.groups ?? '0');
  $('#userCount') && ($('#userCount').textContent = data.users ?? '0');
  $('#commandCount') && ($('#commandCount').textContent = data.commands ?? '0');
  $('#messageCount') && ($('#messageCount').textContent = data.messagesToday ?? '0');
  $('#waNumber') && ($('#waNumber').textContent = session.number || '—');
  const connected = session.status === 'connected';
  if ($('#waBadge')) $('#waBadge').textContent = connected ? '● Connecté' : `● ${session.status || 'Offline'}`;
  if ($('#waStatusSmall')) $('#waStatusSmall').textContent = connected ? 'Connecté' : 'Offline';
  if ($('#pairingStatus')) $('#pairingStatus').textContent = session.status === 'waiting_pairing' ? 'Waiting' : connected ? 'Connected' : 'Ready';
  if ($('#uptimeValue')) $('#uptimeValue').textContent = formatUptime(data.uptime);
  if ($('#cpuValue')) $('#cpuValue').textContent = `${data.cpu}%`;
  if ($('#ramValue')) $('#ramValue').textContent = `${data.memory?.usedMb || 0}MB`;
  if ($('#monitorCpu')) $('#monitorCpu').textContent = `${data.cpu}%`;
  if ($('#monitorRam')) $('#monitorRam').textContent = `${data.memory?.usedMb || 0} MB`;
  if ($('#monitorUptime')) $('#monitorUptime').textContent = formatUptime(data.uptime);
  if ($('#monitorEngine')) $('#monitorEngine').textContent = connected ? 'CONNECTED' : 'WAITING';
  if ($('#serverStatus')) $('#serverStatus').textContent = 'Online';
  if ($('#apiStatus')) $('#apiStatus').textContent = 'Online';
  if ($('#waUptime')) $('#waUptime').textContent = session.connectedAt ? formatUptime(Math.max(0, Date.now() - new Date(session.connectedAt).getTime()) / 1000) : '—';
  renderDashboardGroups();
}

function renderDashboardGroups() {
  const box = $('#dashboardGroups'); if (!box) return;
  if (!state.groups.length) {
    box.innerHTML = '<div><span class="avatar">K</span><div><strong>Aucun groupe chargé</strong><small>Le bot doit être connecté et membre des groupes.</small></div><b class="tag muted-tag">0</b></div>';
    return;
  }
  box.innerHTML = state.groups.slice(0, 4).map(g => `<div><span class="avatar">${escapeHtml((g.subject || 'G').charAt(0).toUpperCase())}</span><div><strong>${escapeHtml(g.subject)}</strong><small>${g.size} participants${g.isAdmin ? ' • Admin' : ''}</small></div><b class="tag ${g.isAdmin ? '' : 'muted-tag'}">${g.isAdmin ? 'ADMIN' : 'MEMBER'}</b></div>`).join('');
}

async function loadGroups() {
  const box = $('#groupCards'); if (!box) return;
  try {
    const data = await api(`/api/groups${state.number ? `?number=${encodeURIComponent(state.number)}` : ''}`);
    state.groups = data.groups || [];
    const status = $('#groupStatusText'); if (status) status.textContent = data.connected ? `${state.groups.length} groupe(s) récupéré(s) depuis WhatsApp.` : 'Le bot doit être connecté pour récupérer les groupes.';
    renderGroups(); renderDashboardGroups();
    if (state.dashboard) $('#groupCount').textContent = state.groups.length;
  } catch (error) {
    box.innerHTML = `<div class="panel"><p class="muted">${escapeHtml(error.message)}</p></div>`;
  }
}

function renderGroups() {
  const box = $('#groupCards'); if (!box) return;
  const query = ($('#groupSearch')?.value || '').toLowerCase().trim();
  const groups = state.groups.filter(g => !query || g.subject.toLowerCase().includes(query));
  if (!groups.length) {
    box.innerHTML = '<div class="panel"><p class="muted">Aucun groupe correspondant.</p></div>'; return;
  }
  box.innerHTML = groups.map(g => `<div class="group-card"><span class="avatar">${escapeHtml((g.subject || 'G').charAt(0).toUpperCase())}</span><div><strong>${escapeHtml(g.subject)}</strong><small>${g.size} participants • ${g.isAdmin ? 'Administrateur' : 'Membre'} • ${g.id}</small></div><button class="secondary-btn manage-group" data-id="${escapeHtml(g.id)}">Gérer</button></div>`).join('');
  $$('.manage-group').forEach(btn => btn.addEventListener('click', () => {
    const g = state.groups.find(x => x.id === btn.dataset.id); if (!g) return;
    showToast(`${g.subject} • ${g.size} participants • ${g.isAdmin ? 'admin' : 'membre'}`);
  }));
}
$('#refreshGroupsBtn')?.addEventListener('click', loadGroups);
$('#groupSearch')?.addEventListener('input', renderGroups);

async function loadCommands() {
  const grid = $('#commandGrid'); if (!grid) return;
  try {
    const data = await api('/api/commands'); state.commands = data.commands || [];
    if (!state.commands.length) {
      grid.innerHTML = '<div class="panel"><p class="muted">Aucune commande enregistrée par le moteur. Vérifie que le dossier <b>plugins/</b> est présent sur le backend.</p></div>'; return;
    }
    renderCommands();
  } catch (error) { grid.innerHTML = `<div class="panel"><p class="muted">${escapeHtml(error.message)}</p></div>`; }
}

function renderCommands() {
  const grid = $('#commandGrid'); if (!grid) return;
  const query = ($('#commandSearch')?.value || '').toLowerCase().trim();
  const commands = state.commands.filter(c => `${c.name} ${c.category} ${c.description}`.toLowerCase().includes(query));
  grid.innerHTML = commands.map(c => `<div class="command-card"><span>⚡</span><strong>.${escapeHtml(c.name)}</strong><small>${escapeHtml(c.description || c.category)}${c.aliases?.length ? ` • ${escapeHtml(c.aliases.join(', '))}` : ''}</small><b class="toggle ${c.status === 'ON' ? 'on' : ''}" role="button" tabindex="0" data-command="${escapeHtml(c.name)}" title="${c.status === 'ON' ? 'Désactiver' : 'Activer'}"></b></div>`).join('');
  $$('.toggle[data-command]').forEach(toggle => toggle.addEventListener('click', async () => {
    const name = toggle.dataset.command;
    try { const data = await api(`/api/commands/${encodeURIComponent(name)}/toggle`, { method: 'POST' }); const cmd = state.commands.find(c => c.name === name); if (cmd) cmd.status = data.status; renderCommands(); showToast(`.${name} ${data.status === 'ON' ? 'activée' : 'désactivée'}.`); } catch (error) { showToast(error.message); }
  }));
}
$('#commandSearch')?.addEventListener('input', renderCommands);

async function loadSecurity() {
  const grid = $('#securityGrid'); if (!grid) return;
  try {
    const data = await api('/api/security');
    grid.innerHTML = (data.protections || []).map(p => `<div class="security-card"><span>${p.icon}</span><strong>${escapeHtml(p.name)}</strong><small>${p.configured} configuration(s) active</small><b>${p.configured > 0 ? 'ACTIVE' : 'READY'}</b></div>`).join('');
  } catch (error) { grid.innerHTML = `<div class="panel"><p class="muted">${escapeHtml(error.message)}</p></div>`; }
}

async function loadLogs() {
  try {
    const data = await api('/api/logs?limit=100');
    const html = (data.logs || []).map(l => `<p><i>[${escapeHtml(l.level)}]</i> ${escapeHtml(new Date(l.timestamp).toLocaleTimeString())} — ${escapeHtml(l.message)}</p>`).join('') || '<p><i>[INFO]</i> Aucun événement récent.</p>';
    if ($('#logsBody')) $('#logsBody').innerHTML = html;
    if ($('#dashboardLogs')) $('#dashboardLogs').innerHTML = (data.logs || []).slice(-6).map(l => `<p><i>●</i> ${escapeHtml(l.message)}</p>`).join('') || '<p><i>●</i> Aucun événement.</p>';
  } catch (error) { console.error(error); }
}

async function refreshAll() {
  try { await refreshDashboard(); } catch (error) { if ($('#apiStatus')) $('#apiStatus').textContent = 'Offline'; }
  await Promise.allSettled([loadGroups(), loadCommands(), loadSecurity(), loadLogs()]);
}

async function sessionAction(endpoint) {
  if (!state.number) { await refreshDashboard().catch(() => {}); }
  if (!state.number) return showToast('Aucune session WhatsApp active.');
  try {
    await api(endpoint, { method: 'POST', body: JSON.stringify({ number: state.number }) });
    showToast(endpoint.includes('disconnect') ? 'WhatsApp déconnecté.' : 'Reconnexion demandée.');
    setTimeout(refreshAll, 1200);
  } catch (error) { showToast(error.message); }
}
$('#disconnectBtn')?.addEventListener('click', () => sessionAction('/api/session/disconnect'));
$('#reloadBtn')?.addEventListener('click', () => sessionAction('/api/session/reload'));

$('#animations')?.addEventListener('change', event => document.body.style.setProperty('--transition-speed', event.target.checked ? '.2s' : '0s'));
$('#darkMode')?.addEventListener('change', event => { if (!event.target.checked) { event.target.checked = true; showToast('Le Control Center utilise le thème Enterprise.'); } });

window.addEventListener('load', () => {
  refreshAll();
  setInterval(refreshDashboard, 10000);
  setInterval(loadLogs, 5000);
  setInterval(loadGroups, 15000);
});
