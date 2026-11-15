const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACTION = process.argv[2];
let PAYLOAD = {};
try { PAYLOAD = JSON.parse(fs.readFileSync('/tmp/payload.json', 'utf8')); } catch(e) {}

function setOutput(name, value) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) fs.appendFileSync(out, `${name}=${value}\n`);
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function validateToken(token) { return /^[a-f0-9]{64}$/.test(token || ''); }

function generateToken() {
  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.ADMIN_PASS;
  const ts = Math.floor(Date.now() / 1000);
  const token = crypto.createHash('sha256').update(`${ADMIN_USER}:${ts}:${ADMIN_PASS}:modulos-secret`).digest('hex');
  return { token, expires: ts + 3600 };
}

function readDb() {
  const dbPath = 'datas/businesses.json';
  if (!fs.existsSync(dbPath)) return { businesses: [] };
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDb(db) { fs.writeFileSync('datas/businesses.json', JSON.stringify(db, null, 2)); }

function renderPage(record) {
  const template = fs.readFileSync('templates/business-template.html', 'utf8');
  const social = (url, iconClass, label) => url ? `<a href="${escapeHtml(url)}" class="social-icon" target="_blank" rel="noopener" title="${label}"><i class="${iconClass}"></i></a>` : '';

  return template
    .replace(/\{\{BUSINESS_NAME\}\}/g, escapeHtml(record.businessName))
    .replace(/\{\{DESCRIPTION\}\}/g, escapeHtml(record.description))
    .replace(/\{\{LOGO\}\}/g, escapeHtml(record.logo))
    .replace(/\{\{PHONE\}\}/g, escapeHtml(record.phone))
    .replace(/\{\{WHATSAPP\}\}/g, escapeHtml(record.whatsapp))
    .replace(/\{\{MAPS\}\}/g, escapeHtml(record.mapsLink))
    .replace(/\{\{REVIEW\}\}/g, escapeHtml(record.reviewLink))
    .replace(/\{\{ID\}\}/g, escapeHtml(record.businessId))
    .replace(/\{\{ADDRESS_HTML\}\}/g, record.address ? `<div class="address"><i class="fas fa-map-pin" style="color:var(--primary)"></i> ${escapeHtml(record.address)}</div>` : '')
    .replace(/\{\{WEBSITE_HTML\}\}/g, social(record.website, 'fas fa-globe', 'Website'))
    .replace(/\{\{INSTAGRAM_HTML\}\}/g, social(record.instagram, 'fab fa-instagram', 'Instagram'))
    .replace(/\{\{FACEBOOK_HTML\}\}/g, social(record.facebook, 'fab fa-facebook-f', 'Facebook'))
    .replace(/\{\{YOUTUBE_HTML\}\}/g, social(record.youtube, 'fab fa-youtube', 'YouTube'));
}

function handleLogin() {
  if (PAYLOAD.username === process.env.ADMIN_USER && PAYLOAD.password === process.env.ADMIN_PASS) {
    const { token, expires } = generateToken();
    setOutput('success', 'true'); setOutput('message', 'Login successful');
    setOutput('token', token); setOutput('expires', String(expires)); setOutput('changed', 'false');
  } else {
    setOutput('success', 'false'); setOutput('message', 'Invalid credentials'); setOutput('changed', 'false');
  }
}

function handleAdd() {
  if (!validateToken(PAYLOAD.auth_token)) { setOutput('success', 'false'); setOutput('message', 'Unauthorized'); setOutput('changed', 'false'); return; }
  const b = PAYLOAD.business || {};
  const id = String(b.businessId || '').trim();
  
  if (!/^[A-Za-z0-9_-]{3,50}$/.test(id)) { setOutput('success', 'false'); setOutput('message', 'Invalid ID'); setOutput('changed', 'false'); return; }
  
  const db = readDb();
  if (db.businesses.some(x => x.businessId === id)) { setOutput('success', 'false'); setOutput('message', 'ID already exists'); setOutput('changed', 'false'); return; }

  const bizDir = path.join('nfcbusinesscp', id);
  fs.mkdirSync(bizDir, { recursive: true });

  const record = { ...b, businessId: id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(bizDir, 'data.json'), JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(bizDir, 'index.html'), renderPage(record));

  db.businesses.push(record);
  writeDb(db);
  setOutput('success', 'true'); setOutput('message', 'Business added'); setOutput('changed', 'true');
}

function handleEdit() {
  if (!validateToken(PAYLOAD.auth_token)) { setOutput('success', 'false'); setOutput('changed', 'false'); return; }
  const b = PAYLOAD.business || {};
  const id = String(b.businessId || '').trim();
  
  const db = readDb();
  const idx = db.businesses.findIndex(x => x.businessId === id);
  if (idx === -1) { setOutput('success', 'false'); setOutput('message', 'Not found'); setOutput('changed', 'false'); return; }

  const record = { ...db.businesses[idx], ...b, updatedAt: new Date().toISOString() };
  const bizDir = path.join('nfcbusinesscp', id);
  fs.mkdirSync(bizDir, { recursive: true });
  fs.writeFileSync(path.join(bizDir, 'data.json'), JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(bizDir, 'index.html'), renderPage(record));

  db.businesses[idx] = record;
  writeDb(db);
  setOutput('success', 'true'); setOutput('message', 'Business updated'); setOutput('changed', 'true');
}

function handleDelete() {
  if (!validateToken(PAYLOAD.auth_token)) { setOutput('success', 'false'); setOutput('changed', 'false'); return; }
  const id = String(PAYLOAD.businessId || '').trim();
  const db = readDb();
  const idx = db.businesses.findIndex(x => x.businessId === id);
  if (idx === -1) { setOutput('success', 'false'); setOutput('message', 'Not found'); setOutput('changed', 'false'); return; }

  db.businesses.splice(idx, 1);
  writeDb(db);
  
  const bizDir = path.join('nfcbusinesscp', id);
  if (fs.existsSync(bizDir)) fs.rmSync(bizDir, { recursive: true, force: true });
  
  setOutput('success', 'true'); setOutput('message', 'Deleted'); setOutput('changed', 'true');
}

try {
  switch (ACTION) {
    case 'login': handleLogin(); break;
    case 'add': handleAdd(); break;
    case 'edit': handleEdit(); break;
    case 'delete': handleDelete(); break;
    default: setOutput('success', 'false'); setOutput('changed', 'false');
  }
} catch (err) {
  setOutput('success', 'false'); setOutput('message', `Error: ${err.message}`); setOutput('changed', 'false');
    }
