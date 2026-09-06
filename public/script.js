const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const sidebar = $('#sidebar');
const menuBtn = $('#menuBtn');
const toast = $('#toast');

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function setPairingResult(element, code, message = 'Code generated successfully') {
  if (!element) return;

  element.innerHTML = `
    <span class="result-label">PAIRING CODE</span>
    <strong>${code || 'ERROR'}</strong>
    <small>${message}</small>
  `;
}

async function generatePairing(numberInput, resultElement, button) {
  const number = numberInput?.value.replace(/\D/g, '');

  if (!number || number.length < 8 || number.length > 15) {
    showToast('Entre un numéro WhatsApp valide.');
    numberInput?.focus();
    return;
  }

  if (button) {
    button.disabled = true;
    button.style.opacity = '.65';
  }

  setPairingResult(resultElement, '...', 'Connexion au serveur de pairing...');

  // Vercel rewrites /api/* to the Bot-Hosting backend.
  // KOREXIA_API_URL can still be set when using a direct HTTPS backend.
  const apiBase = (window.KOREXIA_API_URL || '').replace(/\/$/, '');
  const pairUrl = `${apiBase}/api/pair`;
  const statusUrl = (n) => `${apiBase}/api/pair/status/${encodeURIComponent(n)}`;

  try {
    const response = await fetch(pairUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ number })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.success === false) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }

    if (data?.pairingCode) {
      setPairingResult(
        resultElement,
        data.pairingCode,
        'Utilise ce code dans WhatsApp > Appareils connectés'
      );
      showToast('Code de pairing généré avec succès.');
    } else {
      setPairingResult(
        resultElement,
        'ERROR',
        data?.error || 'Le serveur n’a pas retourné de code.'
      );
      showToast('Le serveur n’a pas retourné de code.');
    }

    // Poll only when a session was actually created.
    if (data?.success) {
      pollStatus(number, statusUrl);
    }
  } catch (error) {
    console.error('[PAIRING]', error);
    setPairingResult(resultElement, 'ERROR', error.message || 'Serveur inaccessible');
    showToast('Erreur du serveur de pairing.');
  } finally {
    if (button) {
      button.disabled = false;
      button.style.opacity = '';
    }
  }
}

async function pollStatus(number, statusUrl) {
  try {
    const response = await fetch(statusUrl(number), {
      headers: { 'Accept': 'application/json' }
    });
    const data = await response.json().catch(() => ({}));

    const resultElement = document.querySelector('#result') || document.querySelector('#result2');

    if (data.status === 'connected') {
      setPairingResult(resultElement, data.pairingCode || 'CONNECTED', 'WhatsApp connecté.');
      return;
    }

    if (data.pairingCode && resultElement) {
      setPairingResult(resultElement, data.pairingCode, 'Utilise ce code dans WhatsApp > Appareils connectés');
    }
  } catch (_) {}

  setTimeout(() => pollStatus(number, statusUrl), 2500);
}

/* =========================
   PAIRING
========================= */

const generateBtn = $('#generateBtn');

if (generateBtn) {
  generateBtn.addEventListener('click', () => {
    generatePairing(
      $('#number'),
      $('#result'),
      generateBtn
    );
  });
}

const generateBtn2 = $('#generateBtn2');

if (generateBtn2) {
  generateBtn2.addEventListener('click', () => {
    generatePairing(
      $('#number2'),
      $('#result2'),
      generateBtn2
    );
  });
}

/* Enter = generate */

$('#number')?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    generateBtn?.click();
  }
});

$('#number2')?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    generateBtn2?.click();
  }
});

/* =========================
   NAVIGATION
========================= */

const labels = {
  dashboard: 'Dashboard',
  whatsapp: 'WhatsApp',
  groups: 'Groups',
  commands: 'Commands',
  security: 'Security',
  monitoring: 'Monitoring',
  logs: 'Logs',
  settings: 'Settings'
};

$$('.nav-item').forEach((button) => {
  button.addEventListener('click', () => {
    const sectionName = button.dataset.section;

    $$('.nav-item').forEach((item) => {
      item.classList.remove('active');
    });

    button.classList.add('active');

    $$('.section').forEach((section) => {
      section.classList.remove('active');
    });

    const target = document.getElementById(sectionName);

    if (target) {
      target.classList.add('active');
    }

    const label = $('#sectionLabel');

    if (label) {
      label.textContent = labels[sectionName] || sectionName;
    }

    sidebar?.classList.remove('open');

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
});

/* =========================
   MOBILE MENU
========================= */

menuBtn?.addEventListener('click', () => {
  sidebar?.classList.toggle('open');
});

/* =========================
   COMMAND SEARCH
========================= */

const commandSearch = $('#commandSearch');

commandSearch?.addEventListener('input', () => {
  const query = commandSearch.value.toLowerCase().trim();

  $$('#commandGrid .command-card').forEach((card) => {
    const text = card.textContent.toLowerCase();

    card.style.display =
      !query || text.includes(query)
        ? ''
        : 'none';
  });
});

/* =========================
   SETTINGS
========================= */

$('#animations')?.addEventListener('change', (event) => {
  document.body.style.setProperty(
    '--transition-speed',
    event.target.checked ? '.2s' : '0s'
  );

  showToast(
    event.target.checked
      ? 'Animations activées.'
      : 'Animations désactivées.'
  );
});

$('#darkMode')?.addEventListener('change', (event) => {
  if (!event.target.checked) {
    showToast('Le thème clair sera disponible dans une prochaine version.');
    event.target.checked = true;
    return;
  }

  showToast('Mode Enterprise actif.');
});

/* =========================
   INITIALIZATION
========================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('╔════════════════════════════════════╗');
  console.log('║       KOREXIA-MD V10 ENTERPRISE   ║');
  console.log('║          CONTROL CENTER            ║');
  console.log('╚════════════════════════════════════╝');
});
