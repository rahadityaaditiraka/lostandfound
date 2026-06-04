// ============================================================
// FIREBASE CONFIG & STORAGE
// ============================================================
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCKxKDOWEtTx9lx0WNOSJJRBX1l3YxkAIs",
  authDomain:        "lostandfound-ac502.firebaseapp.com",
  projectId:         "lostandfound-ac502",
  storageBucket:     "lostandfound-ac502.firebasestorage.app",
  messagingSenderId: "138580852129",
  appId:             "1:138580852129:web:b1eee4e4e875c395a31fe0"
};

const ADMIN_PW = '4m@dorblackLetterf0nt';

let _db      = null;
let _items   = [];
let _claims  = [];
let _appReady = false;

function getItems()  { return [..._items];  }
function getClaims() { return [..._claims]; }

function saveItems(newItems) {
  if (!_db) return;
  // Hanya tulis item yang BERUBAH atau BARU — hemat write quota
  const prevMap = new Map(_items.map(i => [i.id, JSON.stringify(i)]));
  const newIds  = new Set(newItems.map(i => i.id));
  _items = [...newItems];

  const batch = _db.batch();
  let ops = 0;

  // Hapus item yang dihapus
  for (const [id] of prevMap) {
    if (!newIds.has(id)) {
      batch.delete(_db.collection('items').doc(id));
      ops++;
    }
  }
  // Tulis hanya yang berubah
  for (const item of newItems) {
    if (prevMap.get(item.id) !== JSON.stringify(item)) {
      batch.set(_db.collection('items').doc(item.id), item);
      ops++;
    }
  }
  if (ops > 0) batch.commit().catch(e => console.error('saveItems:', e));
}

function saveClaims(newClaims) {
  if (!_db) return;
  // Hanya tulis claim yang BERUBAH atau BARU
  const prevMap = new Map(_claims.map(c => [c.id, JSON.stringify(c)]));
  const newIds  = new Set(newClaims.map(c => c.id));
  _claims = [...newClaims];

  const batch = _db.batch();
  let ops = 0;

  for (const [id] of prevMap) {
    if (!newIds.has(id)) {
      batch.delete(_db.collection('claims').doc(id));
      ops++;
    }
  }
  for (const c of newClaims) {
    if (prevMap.get(c.id) !== JSON.stringify(c)) {
      batch.set(_db.collection('claims').doc(c.id), c);
      ops++;
    }
  }
  if (ops > 0) batch.commit().catch(e => console.error('saveClaims:', e));
}

// Kompresi foto — maks 600px, kualitas 0.55 → hasil ~50-150KB (aman untuk Firestore 1MB)
function compressPhoto(dataUrl, maxW = 600, quality = 0.55) {
  return new Promise(resolve => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) return resolve(dataUrl);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}


function refreshCurrentPage() {
  if (!_appReady) return;
  const active = document.querySelector('.page:not(.hidden)');
  if (!active) return;
  const p = active.id.replace('page-', '');
  if (p === 'lost')     renderItemPage('lost');
  if (p === 'found')    renderItemPage('found');
  if (p === 'all')      renderAll();
  if (p === 'admin')    renderAdmin();
  if (p === 'disposal') renderDisposalPage();
  if (p === 'claim')    renderPickupHistory();
}

function initFirebase() {
  firebase.initializeApp(FIREBASE_CONFIG);
  _db = firebase.firestore();

  let itemsOk = false, claimsOk = false;
  function checkReady() {
    if (!itemsOk || !claimsOk) return;
    _appReady = true;
    document.getElementById('fb-loading').style.display = 'none';
    seedDemo();
    showPage('lost');
    document.getElementById('tab-track').classList.add('active');
    document.getElementById('atab-lost').classList.add('active');
    document.getElementById('cf-all').classList.add('active');
  }

  _db.collection('items').onSnapshot(snap => {
    _items = snap.docs.map(d => d.data());
    if (!itemsOk) { itemsOk = true; checkReady(); }
    else refreshCurrentPage();
  }, err => {
    document.getElementById('fb-loading-msg').textContent = '❌ Gagal terhubung: ' + err.message;
  });

  _db.collection('claims').onSnapshot(snap => {
    _claims = snap.docs.map(d => d.data());
    if (!claimsOk) { claimsOk = true; checkReady(); }
    else refreshCurrentPage();
  }, err => console.error('claims listener:', err));
}

function uid()           { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function genTicketCode() { return 'LF-' + Math.random().toString(36).slice(2,6).toUpperCase() + '-' + Date.now().toString(36).slice(-4).toUpperCase(); }

// ============================================================
// SEED DEMO
// ============================================================
function seedDemo() {
  if (getItems().length > 0) return;
  const demos = [
    { id: uid(), type: 'lost',  name: 'Dompet Kulit Coklat',         category: 'dompet/tas',  desc: 'Dompet kulit warna coklat tua, isi KTP, SIM A, kartu ATM BCA, dan uang tunai sekitar 200 ribu. Ada foto keluarga di dalamnya.',                    location: 'Kantin Gedung B Lantai 1',          date: '2026-05-28', reporter: 'Budi Santoso',   contact: '08123456789', photo: null, status: 'open', createdAt: Date.now() - 86400000*2 },
    { id: uid(), type: 'found', name: 'Kunci Motor Honda Beat',      category: 'kunci',       desc: 'Satu kunci motor Honda Beat dengan gantungan kunci boneka beruang kecil warna biru. Ditemukan di area parkir basement.',                              location: 'Parkir Basement Gedung C',          date: '2026-05-29', reporter: 'Siti Rahayu',    contact: '08987654321', photo: null, status: 'open', createdAt: Date.now() - 86400000   },
    { id: uid(), type: 'lost',  name: 'Handphone Samsung Galaxy A54',category: 'elektronik',  desc: 'HP Samsung Galaxy A54 warna hitam dengan case transparan. Layar sedikit retak di sudut kiri atas. Ada stiker kucing di belakang.',                   location: 'Ruang Rapat Lantai 3 Gedung A',     date: '2026-05-27', reporter: 'Ahmad Fauzi',    contact: 'ahmad@email.com', photo: null, status: 'open', createdAt: Date.now() - 86400000*3 },
    { id: uid(), type: 'found', name: 'Handphone Samsung Warna Hitam',category: 'elektronik', desc: 'HP Samsung warna hitam case bening ditemukan di meja kantin. Ada stiker kucing di cover belakang. Layar ada retakan kecil di pojok.',                location: 'Kantin Gedung A Lantai 1',           date: '2026-05-27', reporter: 'Rini Agustina',  contact: '08556677889', photo: null, status: 'open', createdAt: Date.now() - 86400000*3 + 3600000 },
    { id: uid(), type: 'lost',  name: 'Tas Ransel Hitam Eiger',      category: 'dompet/tas',  desc: 'Tas ransel warna hitam merek Eiger berisi laptop, charger, dan catatan kuliah. Tertinggal di area lift.',                                            location: 'Area Lift Gedung B',                date: '2026-05-30', reporter: 'Farhan Hidayat', contact: '08998877665', photo: null, status: 'open', createdAt: Date.now() - 7200000 },
    { id: uid(), type: 'found', name: 'Tas Ransel Hitam',            category: 'dompet/tas',  desc: 'Tas ransel warna hitam merek Eiger. Di dalamnya ada laptop, charger, dan beberapa buku. Ditemukan di dekat lift lantai 2.',                          location: 'Dekat Lift Gedung B Lantai 2',      date: '2026-05-30', reporter: 'Dewi Lestari',   contact: '08765432100', photo: null, status: 'open', createdAt: Date.now()              },
    { id: uid(), type: 'lost',  name: 'KTP dan SIM',                 category: 'dokumen',     desc: 'Dompet kecil berisi KTP atas nama Rizky Pratama, SIM C, dan kartu pelajar. Warna dompet merah.',                                                     location: 'Toilet Pria Gedung A Lantai 1',     date: '2026-05-26', reporter: 'Rizky Pratama',  contact: '08234567890', photo: null, status: 'open', createdAt: Date.now() - 86400000*4 },
    { id: uid(), type: 'found', name: 'Kacamata Minus',              category: 'aksesoris',   desc: 'Kacamata dengan frame bulat warna hitam. Lensa minus. Ditemukan di meja perpustakaan lantai 4. Tanpa tempat kacamata.',                              location: 'Perpustakaan Lantai 4',             date: '2026-05-29', reporter: 'Nurul Hidayah',  contact: '08345678901', photo: null, status: 'open', createdAt: Date.now() - 3600000    },
  ];
  saveItems(demos);
}

// ============================================================
// SMART TEXT SEARCH ENGINE
// ============================================================
const STOPWORDS = new Set(['yang','dan','di','ke','dari','dengan','ada','ini','itu','atau','untuk','pada','adalah','sudah','saya','aku','kamu','anda','tidak','bisa','satu','kecil','besar']);

function tokenize(text) {
  return text.toLowerCase().replace(/[^\w\s]/g,' ').split(/\s+/).filter(t => t.length > 1 && !STOPWORDS.has(t));
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, (_,i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}

function tokenSimilarity(a, b) {
  if (a===b) return 1;
  if (b.includes(a)||a.includes(b)) return 0.85;
  const sim = 1 - levenshtein(a,b) / Math.max(a.length,b.length);
  return sim > 0.6 ? sim : 0;
}

function scoreItem(item, queryTokens) {
  if (!queryTokens.length) return { score: 1, matched: [] };
  const fields = [
    {text:item.name,weight:3},{text:item.desc,weight:2},
    {text:item.category,weight:1.5},{text:item.location,weight:1},
  ];
  let total=0, max=0;
  const matched = new Set();
  for (const {text,weight} of fields) {
    const ftoks = tokenize(text);
    for (const qt of queryTokens) {
      max += weight;
      const best = ftoks.reduce((b,ft) => Math.max(b, tokenSimilarity(qt,ft)), 0);
      if (best > 0) { total += best*weight; matched.add(qt); }
    }
  }
  return { score: max>0 ? total/max : 0, matched: [...matched] };
}

function highlightText(text, matched) {
  if (!matched||!matched.length) return escapeHtml(text);
  let r = escapeHtml(text);
  for (const t of matched) r = r.replace(new RegExp(`(${t})`,'gi'),'<span class="highlight">$1</span>');
  return r;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ============================================================
// PAGE NAVIGATION
// ============================================================
function showPage(page) {
  // Halaman yang butuh login admin
  const adminOnly = ['all', 'disposal'];
  if (adminOnly.includes(page) && !adminLoggedIn) {
    showToast('Silakan login Admin terlebih dahulu', 'bg-red-500');
    page = 'admin';
  }

  document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('page-'+page).classList.remove('hidden');
  document.getElementById('nav-'+page).classList.add('active');
  if (page==='lost')     renderItemPage('lost');
  if (page==='found')    renderItemPage('found');
  if (page==='all')      initAllPage();
  if (page==='claim')    initClaimPage();
  if (page==='admin')    renderAdmin();
  if (page==='disposal') renderDisposalPage();
}

// ============================================================
// SEMUA LAPORAN PAGE
// ============================================================
let allTypeFilter = 'all';

function initAllPage() {
  allTypeFilter = 'all';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('fall-all').classList.add('active');
  document.getElementById('all-search').value   = '';
  document.getElementById('all-category').value = '';
  document.getElementById('all-status').value   = '';
  renderAll();
}

function filterAll(type) {
  allTypeFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('fall-' + type).classList.add('active');
  renderAll();
}

function renderAll() {
  const query    = document.getElementById('all-search').value.trim();
  const category = document.getElementById('all-category').value;
  const statusF  = document.getElementById('all-status').value;

  let items = getItems();
  if (allTypeFilter !== 'all') items = items.filter(i => i.type === allTypeFilter);
  if (category) items = items.filter(i => i.category === category);
  if (statusF)  items = items.filter(i => i.status   === statusF);

  const queryTokens = tokenize(query);
  let scored;

  if (queryTokens.length > 0) {
    scored = items
      .map(item => ({ item, ...scoreItem(item, queryTokens) }))
      .filter(r => r.score > 0.08)
      .sort((a, b) => {
        // Primary: score desc, secondary: item.date desc
        if (Math.abs(b.score - a.score) > 0.05) return b.score - a.score;
        return b.item.date.localeCompare(a.item.date);
      });
  } else {
    // Sort by item.date descending (date the incident happened), then createdAt as tiebreak
    scored = items
      .sort((a, b) => {
        const dateDiff = b.date.localeCompare(a.date);
        return dateDiff !== 0 ? dateDiff : b.createdAt - a.createdAt;
      })
      .map(item => ({ item, score: 0, matched: [] }));
  }

  const hint      = document.getElementById('all-hint');
  const container = document.getElementById('all-results');
  const empty     = document.getElementById('all-empty');

  hint.textContent = queryTokens.length > 0
    ? `${scored.length} hasil untuk "${query}"`
    : `${scored.length} laporan, diurutkan dari tanggal kejadian terbaru.`;

  if (scored.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // Collect matched pair IDs to render them together (avoid duplicates)
  const renderedIds  = new Set();
  const matchedPairs = [];
  for (const r of scored) {
    const it = r.item;
    if (it.matchedWith && !renderedIds.has(it.id)) {
      const partner = scored.find(x => x.item.id === it.matchedWith);
      if (partner) {
        matchedPairs.push({ a: r, b: partner });
        renderedIds.add(it.id);
        renderedIds.add(partner.item.id);
      }
    }
  }

  // Group remaining items by date
  const grouped = {};
  for (const r of scored) {
    if (renderedIds.has(r.item.id)) continue;
    const key = r.item.date || 'Tanggal tidak diketahui';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  // Matched pairs section
  const matchedHTML = matchedPairs.length === 0 ? '' : `
    <div class="mb-8">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0"></div>
        <span class="text-sm font-bold text-green-700">🔗 Laporan yang Berhasil Dicocokkan</span>
        <div class="flex-1 h-px bg-green-100"></div>
        <span class="text-xs text-gray-400">${matchedPairs.length} pasang</span>
      </div>
      <div class="space-y-3 pl-5">
        ${matchedPairs.map(({a, b}) => {
          const lost  = a.item.type === 'lost'  ? a : b;
          const found = a.item.type === 'found' ? a : b;
          return `
            <div class="bg-white border-2 border-green-200 rounded-2xl p-4 shadow-sm">
              <div class="flex items-center gap-2 mb-3">
                <span class="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">🔗 Cocok & Selesai</span>
                <span class="text-xs text-gray-400">Diselesaikan ${formatDateTime(lost.item.matchedAt || Date.now())}</span>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="bg-red-50 border border-red-200 rounded-xl overflow-hidden cursor-pointer" onclick="openModal('${lost.item.id}')">
                  ${lost.item.photo ? `
                    <div style="position:relative;height:120px;overflow:hidden;cursor:zoom-in;" onclick="event.stopPropagation();openFullPhotoSrc(this.querySelector('img').src)">
                      <img src="${lost.item.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" />
                      <div style="position:absolute;bottom:5px;right:5px;background:rgba(0,0,0,0.5);color:#fff;font-size:10px;font-weight:600;padding:2px 7px;border-radius:8px;pointer-events:none;">🔍 Lihat Penuh</div>
                    </div>` : ''}
                  <div class="p-3">
                    <span class="badge-lost px-2 py-0.5 rounded-full text-xs font-semibold">🚨 Hilang</span>
                    <p class="font-bold text-gray-800 text-sm mt-1">${escapeHtml(lost.item.name)}</p>
                    <p class="text-xs text-gray-500 mt-0.5">${escapeHtml(lost.item.desc.slice(0,60))}…</p>
                    <p class="text-xs text-gray-400 mt-1">📍 ${escapeHtml(lost.item.location)}</p>
                    <p class="text-xs text-gray-400">👤 ${escapeHtml(lost.item.reporter)} · ${escapeHtml(lost.item.contact)}</p>
                  </div>
                </div>
                <div class="bg-green-50 border border-green-200 rounded-xl overflow-hidden cursor-pointer" onclick="openModal('${found.item.id}')">
                  ${found.item.photo ? `
                    <div style="position:relative;height:120px;overflow:hidden;cursor:zoom-in;" onclick="event.stopPropagation();openFullPhotoSrc(this.querySelector('img').src)">
                      <img src="${found.item.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" />
                      <div style="position:absolute;bottom:5px;right:5px;background:rgba(0,0,0,0.5);color:#fff;font-size:10px;font-weight:600;padding:2px 7px;border-radius:8px;pointer-events:none;">🔍 Lihat Penuh</div>
                    </div>` : ''}
                  <div class="p-3">
                    <span class="badge-found px-2 py-0.5 rounded-full text-xs font-semibold">✅ Ditemukan</span>
                    <p class="font-bold text-gray-800 text-sm mt-1">${escapeHtml(found.item.name)}</p>
                    <p class="text-xs text-gray-500 mt-0.5">${escapeHtml(found.item.desc.slice(0,60))}…</p>
                    <p class="text-xs text-gray-400 mt-1">📍 ${escapeHtml(found.item.location)}</p>
                    <p class="text-xs text-gray-400">👤 ${escapeHtml(found.item.reporter)} · ${escapeHtml(found.item.contact)}</p>
                  </div>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;

  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  container.innerHTML = matchedHTML + dateKeys.map(dateKey => `
    <div class="mb-6">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0"></div>
        <span class="text-sm font-bold text-indigo-700">${formatDate(dateKey)}</span>
        <div class="flex-1 h-px bg-indigo-100"></div>
        <span class="text-xs text-gray-400">${grouped[dateKey].length} laporan</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-5">
        ${grouped[dateKey].map(r => renderCard(r.item, r.score, r.matched, queryTokens.length > 0)).join('')}
      </div>
    </div>`).join('');
}

// ============================================================
// ITEM PAGE (LOST / FOUND) — SHARED RENDERER
// ============================================================
let searchDebounce = {};

function renderItemPage(type) {
  clearTimeout(searchDebounce[type]);
  searchDebounce[type] = setTimeout(() => _renderItemPage(type), 150);
}

function _renderItemPage(type) {
  const query    = document.getElementById(`${type}-search`).value.trim();
  const category = document.getElementById(`${type}-category`).value;
  const statusF  = document.getElementById(`${type}-status-filter`).value;

  let items = getItems().filter(i => i.type === type);
  if (category) items = items.filter(i => i.category === category);
  if (statusF)  items = items.filter(i => i.status === statusF);
  else if (statusF === '') { /* all */ }

  const queryTokens = tokenize(query);
  const hint = document.getElementById(`${type}-hint`);
  let scored;

  if (queryTokens.length > 0) {
    scored = items.map(item => ({item, ...scoreItem(item, queryTokens)}))
      .filter(r => r.score > 0.08)
      .sort((a,b) => b.score - a.score);
    hint.textContent = scored.length > 0 ? `${scored.length} hasil untuk "${query}"` : '';
  } else {
    scored = items.sort((a,b) => b.createdAt - a.createdAt).map(item => ({item, score:0, matched:[]}));
    hint.textContent = `${scored.length} laporan ditampilkan.`;
  }

  // Stat
  const all = getItems().filter(i => i.type === type);
  const open = all.filter(i => i.status === 'open').length;
  document.getElementById(`${type}-stat`).textContent =
    `${open} aktif · ${all.length - open} selesai · total ${all.length}`;

  const container = document.getElementById(`${type}-results`);
  const empty     = document.getElementById(`${type}-empty`);

  if (scored.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  container.innerHTML = scored.map(r => renderCard(r.item, r.score, r.matched, queryTokens.length>0)).join('');
}

// ============================================================
// CARD RENDERER
// ============================================================
function renderCard(item, score, matched, showScore) {
  const isLost = item.type === 'lost';

  const typeBadge = isLost
    ? '<span class="badge-lost px-2 py-0.5 rounded-full text-xs font-semibold">🚨 Hilang</span>'
    : '<span class="badge-found px-2 py-0.5 rounded-full text-xs font-semibold">✅ Ditemukan</span>';

  const claimStatus = getItemClaimStatus(item.id);
  let statusBadge = '';
  if (item.status==='disposed' && item.disposalData?.type==='destroyed')
                                      statusBadge = '<span class="badge-destroyed px-2 py-0.5 rounded-full text-xs font-semibold ml-1">🔥 Dimusnahkan</span>';
  else if (item.status==='disposed')  statusBadge = '<span class="badge-donated px-2 py-0.5 rounded-full text-xs font-semibold ml-1">💙 Didonasikan</span>';
  else if (item.status==='resolved' && item.matchedWith)
                                      statusBadge = '<span class="badge-matched px-2 py-0.5 rounded-full text-xs font-semibold ml-1">🔗 Dicocokkan</span>';
  else if (item.status==='resolved')  statusBadge = '<span class="badge-resolved px-2 py-0.5 rounded-full text-xs font-semibold ml-1">Selesai</span>';
  else if (claimStatus==='approved')  statusBadge = '<span class="badge-approved px-2 py-0.5 rounded-full text-xs font-semibold ml-1">Dijadwalkan</span>';
  else if (claimStatus==='pending')   statusBadge = '<span class="badge-pending  px-2 py-0.5 rounded-full text-xs font-semibold ml-1">Ada Klaim</span>';

  const scorePct   = Math.round(score * 100);
  const scoreColor = scorePct>=70 ? '#22c55e' : scorePct>=40 ? '#f59e0b' : '#6366f1';
  const scoreBar   = showScore ? `
    <div class="mt-3">
      <div class="flex justify-between text-xs text-gray-500 mb-1">
        <span>Kesesuaian</span><span class="font-semibold" style="color:${scoreColor}">${scorePct}%</span>
      </div>
      <div class="score-bar-bg"><div class="score-bar-fill" style="width:${scorePct}%;background:${scoreColor}"></div></div>
    </div>` : '';

  const desc     = item.desc.length>90 ? item.desc.slice(0,90)+'…' : item.desc;
  const descHtml = matched.length>0 ? highlightText(desc,matched) : escapeHtml(desc);
  const nameHtml = matched.length>0 ? highlightText(item.name,matched) : escapeHtml(item.name);
  const ringColor = isLost ? 'hover:ring-red-300' : 'hover:ring-green-300';

  return `
    <div class="item-card bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:ring-2 ${ringColor} transition"
         onclick="openModal('${item.id}',${JSON.stringify(matched)})">
      ${item.photo ? `
        <div style="height:140px;overflow:hidden;border-radius:16px 16px 0 0;">
          <img src="${item.photo}" alt="foto"
            style="width:100%;height:100%;object-fit:cover;display:block;" />
        </div>` : ''}
      <div class="p-4">
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-1 flex-wrap">${typeBadge}${statusBadge}</div>
          <span class="text-xs text-gray-400 flex-shrink-0 ml-1">${formatDate(item.date)}</span>
        </div>
        <h3 class="font-bold text-gray-800 text-sm mb-1">${nameHtml}</h3>
        <p class="text-xs text-gray-500 mb-2 leading-relaxed">${descHtml}</p>
        <div class="flex items-center gap-1 text-xs text-gray-400"><span>📍</span><span>${escapeHtml(item.location)}</span></div>
        <div class="text-xs text-gray-400 mt-0.5">🏷️ ${escapeHtml(item.category)}</div>
        ${scoreBar}
      </div>
    </div>`;
}

// ============================================================
// MATCH ENGINE
// ============================================================

// Find top candidate matches for an item from the opposite type
function findMatches(item, maxResults = 3) {
  const oppositeType = item.type === 'lost' ? 'found' : 'lost';
  const queryTokens  = tokenize(item.name + ' ' + item.desc);

  return getItems()
    .filter(i => i.type === oppositeType && i.status !== 'resolved' && i.status !== 'disposed')
    .map(candidate => {
      // Skor A→B
      const scoreAB = scoreItem(candidate, queryTokens);
      // Skor B→A (arah balik)
      const candidateTokens = tokenize(candidate.name + ' ' + candidate.desc);
      const scoreBA = scoreItem(item, candidateTokens);
      // Rata-rata kedua arah → simetris
      const symScore   = (scoreAB.score + scoreBA.score) / 2;
      const symMatched = [...new Set([...scoreAB.matched, ...scoreBA.matched])];
      return { item: candidate, score: symScore, matched: symMatched };
    })
    .filter(r => r.score > 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

function confirmMatch(lostId, foundId) {
  if (!confirm('Konfirmasi: barang hilang dan barang ditemukan ini adalah barang yang sama?\n\nKedua laporan akan ditandai Selesai dan saling terhubung.')) return;

  const items = getItems();
  const lostIdx  = items.findIndex(i => i.id === lostId);
  const foundIdx = items.findIndex(i => i.id === foundId);
  if (lostIdx === -1 || foundIdx === -1) return;

  items[lostIdx].status     = 'resolved';
  items[lostIdx].matchedWith = foundId;
  items[lostIdx].matchedAt   = Date.now();

  items[foundIdx].status     = 'resolved';
  items[foundIdx].matchedWith = lostId;
  items[foundIdx].matchedAt   = Date.now();

  saveItems(items);
  closeModal();
  showToast('✅ Cocok dikonfirmasi! Kedua laporan diselesaikan.', 'bg-green-600');
  renderItemPage('lost');
  renderItemPage('found');
  renderAll();
  if (adminLoggedIn) renderAdmin();
}

function getItemClaimStatus(itemId) {
  const claims = getClaims().filter(c => c.itemId===itemId && c.status!=='rejected');
  if (!claims.length) return null;
  if (claims.some(c => c.status==='approved'))  return 'approved';
  if (claims.some(c => c.status==='completed')) return 'completed';
  return 'pending';
}

// ============================================================
// MODAL DETAIL ITEM
// ============================================================
function openModal(id, matched) {
  const item = getItems().find(i => i.id===id);
  if (!item) return;
  matched = matched || [];

  const isLost = item.type === 'lost';
  const typeLabel = isLost
    ? '<span class="badge-lost px-3 py-1 rounded-full text-sm font-semibold">🚨 Barang Hilang</span>'
    : '<span class="badge-found px-3 py-1 rounded-full text-sm font-semibold">✅ Barang Ditemukan</span>';

  const descHtml   = matched.length>0 ? highlightText(item.desc,matched) : escapeHtml(item.desc);
  // Simpan foto di variabel global agar bisa diakses tombol tanpa embed base64 di HTML
  window._curPhoto = item.photo || null;

  const photoHtml = item.photo ? `
    <div style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
      <p style="font-size:11px;font-weight:700;color:#64748b;margin:0;padding:10px 12px 6px;text-transform:uppercase;letter-spacing:0.06em;">📷 Foto Barang</p>
      <div style="height:200px;overflow:hidden;position:relative;">
        <img src="${item.photo}" style="width:100%;height:100%;object-fit:cover;display:block;">
        <div style="position:absolute;bottom:0;left:0;right:0;height:48px;
          background:linear-gradient(transparent,rgba(0,0,0,0.35));pointer-events:none;"></div>
        <span style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);
          color:rgba(255,255,255,0.85);font-size:10px;font-weight:600;pointer-events:none;
          letter-spacing:0.04em;">Tekan "Lihat Penuh" untuk tampilan lengkap</span>
      </div>
    </div>` : '';
  const photoBtnHtml = '';

  // Claim section for found items
  const existingApproved = getClaims().find(c => c.itemId===id && c.status==='approved');
  const existingPending  = getClaims().find(c => c.itemId===id && c.status==='pending');
  let claimSection = '';
  if (!isLost && item.status !== 'resolved') {
    if (existingApproved) {
      claimSection = `
        <div class="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
          <p class="font-semibold mb-1">📅 Pengambilan Terjadwal</p>
          <p>Tanggal: <b>${formatDate(existingApproved.pickupDate)}</b> · Waktu: <b>${existingApproved.pickupTime}</b></p>
          <p>Lokasi: <b>${escapeHtml(existingApproved.pickupLocation||'-')}</b></p>
        </div>`;
    } else if (existingPending) {
      claimSection = `
        <div class="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
          ⏳ Ada klaim yang sedang menunggu verifikasi admin.
        </div>`;
    } else {
      claimSection = `
        <button onclick="openClaimFromModal('${id}'); closeModal();"
          class="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition text-sm">
          📋 Ajukan Klaim Pengambilan
        </button>`;
    }
  }

  // Match section — only for open items
  let matchSection = '';
  if (item.status === 'resolved' && item.matchedWith) {
    const partner = getItems().find(i => i.id === item.matchedWith);
    if (partner) {
      const partnerLabel = partner.type === 'lost'
        ? '<span class="badge-lost px-2 py-0.5 rounded-full text-xs font-semibold">🚨 Hilang</span>'
        : '<span class="badge-found px-2 py-0.5 rounded-full text-xs font-semibold">✅ Ditemukan</span>';
      matchSection = `
        <div class="mt-4 bg-green-50 border border-green-200 rounded-xl p-3">
          <p class="text-xs font-bold text-green-700 mb-2">🔗 Dicocokkan dengan:</p>
          <div class="flex items-center gap-2">
            ${partnerLabel}
            <span class="text-sm font-semibold text-gray-800">${escapeHtml(partner.name)}</span>
          </div>
          <p class="text-xs text-gray-500 mt-1">📍 ${escapeHtml(partner.location)} · ${formatDate(partner.date)}</p>
          <p class="text-xs text-gray-400 mt-0.5">Pelapor: ${escapeHtml(partner.reporter)} · ${escapeHtml(partner.contact)}</p>
        </div>`;
    }
  } else if (item.status !== 'resolved') {
    const candidates = findMatches(item);
    if (candidates.length > 0) {
      const oppositeLabel = item.type === 'lost' ? 'Barang Ditemukan' : 'Barang Hilang';
      const candidateCards = candidates.map(r => {
        const pct      = Math.round(r.score * 100);
        const barColor = pct >= 70 ? '#22c55e' : pct >= 45 ? '#f59e0b' : '#94a3b8';
        const pctColor = pct >= 70 ? '#16a34a' : pct >= 45 ? '#d97706' : '#6b7280';
        const lostId   = item.type === 'lost'  ? id : r.item.id;
        const foundId  = item.type === 'found' ? id : r.item.id;

        // Foto berdampingan
        const thisPhoto = item.photo
          ? `<div style="flex:1;min-width:0;">
               <p style="font-size:10px;font-weight:700;color:#64748b;margin:0 0 4px;text-align:center;">
                 ${item.type==='lost'?'🚨 Barang Hilang':'✅ Barang Ditemukan'}
               </p>
               <div style="height:100px;border-radius:8px;overflow:hidden;background:#f1f5f9;border:2px solid ${item.type==='lost'?'#fca5a5':'#86efac'};">
                 <img src="${item.photo}" style="width:100%;height:100%;object-fit:cover;cursor:zoom-in;"
                   onclick="event.stopPropagation();openFullPhotoSrc(this.src)" />
               </div>
             </div>`
          : `<div style="flex:1;min-width:0;">
               <p style="font-size:10px;font-weight:700;color:#64748b;margin:0 0 4px;text-align:center;">
                 ${item.type==='lost'?'🚨 Barang Hilang':'✅ Barang Ditemukan'}
               </p>
               <div style="height:100px;border-radius:8px;background:#f1f5f9;border:2px solid #e2e8f0;
                           display:flex;align-items:center;justify-content:center;">
                 <span style="font-size:28px;">📦</span>
               </div>
             </div>`;

        const candidatePhoto = r.item.photo
          ? `<div style="flex:1;min-width:0;">
               <p style="font-size:10px;font-weight:700;color:#64748b;margin:0 0 4px;text-align:center;">
                 ${r.item.type==='lost'?'🚨 Barang Hilang':'✅ Barang Ditemukan'}
               </p>
               <div style="height:100px;border-radius:8px;overflow:hidden;background:#f1f5f9;border:2px solid ${r.item.type==='lost'?'#fca5a5':'#86efac'};">
                 <img src="${r.item.photo}" style="width:100%;height:100%;object-fit:cover;cursor:zoom-in;"
                   onclick="event.stopPropagation();openFullPhotoSrc(this.src)" />
               </div>
             </div>`
          : `<div style="flex:1;min-width:0;">
               <p style="font-size:10px;font-weight:700;color:#64748b;margin:0 0 4px;text-align:center;">
                 ${r.item.type==='lost'?'🚨 Barang Hilang':'✅ Barang Ditemukan'}
               </p>
               <div style="height:100px;border-radius:8px;background:#f1f5f9;border:2px solid #e2e8f0;
                           display:flex;align-items:center;justify-content:center;">
                 <span style="font-size:28px;">📦</span>
               </div>
             </div>`;

        return `
          <div class="border border-gray-200 rounded-xl overflow-hidden hover:border-indigo-300 transition">
            <!-- Header skor -->
            <div style="background:#f8fafc;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e8f0;">
              <span class="font-semibold text-gray-800 text-sm">${escapeHtml(r.item.name)}</span>
              <span style="font-size:12px;font-weight:700;color:${pctColor};background:${pct>=70?'#dcfce7':pct>=45?'#fef9c3':'#f3f4f6'};
                           padding:2px 8px;border-radius:20px;">${pct}% cocok</span>
            </div>

            <!-- Foto berdampingan -->
            <div style="display:flex;gap:8px;padding:10px;background:#fff;">
              ${thisPhoto}
              <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;flex-shrink:0;">
                <div style="width:1px;flex:1;background:#e2e8f0;"></div>
                <span style="font-size:16px;">⇄</span>
                <div style="width:1px;flex:1;background:#e2e8f0;"></div>
              </div>
              ${candidatePhoto}
            </div>

            ${(!item.photo && !r.item.photo) ? '' :
              `<p style="font-size:10px;color:#94a3b8;text-align:center;padding:0 10px 6px;margin:0;">
                Klik foto untuk memperbesar · Bandingkan secara visual
              </p>`}

            <!-- Info kandidat -->
            <div style="padding:0 12px 10px;">
              <p class="text-xs text-gray-500">${escapeHtml(r.item.desc.slice(0,80))}…</p>
              <p class="text-xs text-gray-400 mt-0.5">📍 ${escapeHtml(r.item.location)} · ${formatDate(r.item.date)}</p>
              <div class="score-bar-bg mt-2">
                <div class="score-bar-fill" style="width:${pct}%;background:${barColor}"></div>
              </div>
              <button onclick="confirmMatch('${lostId}','${foundId}')"
                class="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 rounded-lg transition">
                🔗 Konfirmasi Cocok & Selesaikan
              </button>
            </div>
          </div>`;
      }).join('');
      matchSection = `
        <div class="mt-4 border-t border-gray-100 pt-4">
          <p class="text-xs font-bold text-gray-600 mb-3">🔍 ${oppositeLabel} yang Mungkin Cocok</p>
          <div class="space-y-3">${candidateCards}</div>
        </div>`;
    }
  }

  document.getElementById('modal-content').innerHTML = `
    ${photoHtml}
    <div class="p-6">
      <div class="mb-3 flex items-center gap-2">${typeLabel}</div>
      <h2 class="text-xl font-bold text-gray-800 mb-3">${escapeHtml(item.name)}</h2>
      <div class="space-y-2 text-sm">
        <div><span class="font-semibold text-gray-600">Kategori:</span> ${escapeHtml(item.category)}</div>
        <div><span class="font-semibold text-gray-600">Deskripsi:</span>
          <p class="mt-1 text-gray-700 leading-relaxed">${descHtml}</p></div>
        <div><span class="font-semibold text-gray-600">Lokasi:</span> ${escapeHtml(item.location)}</div>
        <div><span class="font-semibold text-gray-600">Tanggal:</span> ${formatDate(item.date)}</div>
        <div class="pt-2 border-t border-gray-100">
          <span class="font-semibold text-gray-600">Pelapor:</span> ${escapeHtml(item.reporter)}</div>
        <div><span class="font-semibold text-gray-600">Kontak:</span>
          <span class="text-indigo-600">${escapeHtml(item.contact)}</span></div>
      </div>
      ${claimSection}
      ${matchSection}
      ${item.status === 'resolved' && item.resolveData ? buildResolveSection(item.resolveData) : ''}
      <div class="mt-4 flex gap-2">
        ${item.photo ? `
        <button id="modal-photo-btn"
          class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold transition">
          🔍 Lihat Penuh
        </button>` : ''}
        ${item.status !== 'resolved' && adminLoggedIn ? `
        <button onclick="markResolved('${id}')"
          class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-semibold transition">
          ✅ Tandai Selesai
        </button>` : ''}
        <button onclick="closeModal()"
          class="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 py-2.5 rounded-xl text-sm font-semibold transition">
          Tutup
        </button>
      </div>
    </div>`;
  document.getElementById('modal-overlay').classList.remove('hidden');

  const photoBtn = document.getElementById('modal-photo-btn');
  if (photoBtn) photoBtn.onclick = () => openFullPhoto(window._curPhoto);
}

function openFullPhotoSrc(src) {
  if (!src) return;
  openFullPhoto(src);
}

function openFullPhoto(src) {
  src = src || window._curPhoto;
  if (!src) return;

  const old = document.getElementById('full-photo-viewer');
  if (old) old.remove();

  const ov = document.createElement('div');
  ov.id = 'full-photo-viewer';
  // Fullscreen, no scroll, flex center
  ov.style.cssText =
    'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
    'background:rgba(0,0,0,0.92);z-index:999999;overflow:hidden;' +
    'display:flex;align-items:center;justify-content:center;';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };

  // Gambar — fit dalam layar, tidak scroll
  const img = document.createElement('img');
  img.src = src;
  img.style.cssText =
    'max-width:95vw;max-height:92vh;width:auto;height:auto;' +
    'display:block;border-radius:10px;box-shadow:0 0 40px rgba(0,0,0,0.6);';

  // Tombol tutup pojok kanan atas
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText =
    'position:absolute;top:14px;right:14px;' +
    'background:rgba(255,255,255,0.15);color:#fff;border:none;cursor:pointer;' +
    'width:36px;height:36px;border-radius:50%;font-size:18px;font-weight:700;' +
    'display:flex;align-items:center;justify-content:center;z-index:1;';
  closeBtn.onclick = () => ov.remove();

  // Tekan Escape untuk tutup
  const escHandler = (e) => { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', escHandler); }};
  document.addEventListener('keydown', escHandler);

  ov.appendChild(img);
  ov.appendChild(closeBtn);
  document.body.appendChild(ov);
}


function buildResolveSection(rd) {
  return `
    <div class="mt-4 border border-green-200 bg-green-50 rounded-2xl overflow-hidden">
      <div class="bg-green-600 px-4 py-2.5 flex items-center gap-2">
        <span class="text-white font-bold text-sm">📋 Data Pengambilan Barang</span>
        <span class="text-green-200 text-xs ml-auto">${formatDateTime(rd.resolvedAt)}</span>
      </div>
      <div class="p-4 space-y-3">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="bg-white rounded-xl p-3 border border-green-100">
            <p class="text-xs font-semibold text-gray-500 mb-0.5">👤 Nama Pengambil</p>
            <p class="font-bold text-gray-800">${escapeHtml(rd.nama)}</p>
          </div>
          <div class="bg-white rounded-xl p-3 border border-green-100">
            <p class="text-xs font-semibold text-gray-500 mb-0.5">🪪 No. Identitas / Kontak</p>
            <p class="font-bold text-gray-800">${escapeHtml(rd.kontak)}</p>
          </div>
          <div class="bg-white rounded-xl p-3 border border-green-100">
            <p class="text-xs font-semibold text-gray-500 mb-0.5">🗓️ Tanggal Pengambilan</p>
            <p class="font-bold text-gray-800">${formatDate(rd.tgl)}</p>
          </div>
          <div class="bg-white rounded-xl p-3 border border-green-100">
            <p class="text-xs font-semibold text-gray-500 mb-0.5">👷 Petugas Penyerah</p>
            <p class="font-bold text-gray-800">${escapeHtml(rd.petugas)}</p>
          </div>
        </div>
        <div class="bg-white rounded-xl p-3 border border-green-100 text-sm">
          <p class="text-xs font-semibold text-gray-500 mb-0.5">📍 Lokasi Serah Terima</p>
          <p class="font-bold text-gray-800">${escapeHtml(rd.lokasi)}</p>
        </div>
        ${rd.keterangan ? `
        <div class="bg-white rounded-xl p-3 border border-green-100 text-sm">
          <p class="text-xs font-semibold text-gray-500 mb-0.5">📝 Keterangan</p>
          <p class="text-gray-700">${escapeHtml(rd.keterangan)}</p>
        </div>` : ''}
        ${rd.photo ? `
        <div>
          <p class="text-xs font-semibold text-gray-600 mb-1.5">📸 Bukti Foto Pengambilan</p>
          <img src="${rd.photo}" alt="bukti pengambilan" class="w-full max-h-56 object-contain rounded-xl border border-green-200 bg-white" />
        </div>` : ''}
      </div>
    </div>`;
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.add('hidden');
}

function markResolved(id) {
  openVerifyModal(id);
}

// ============================================================
// VERIFIKASI STATUS BARANG (sebelum Tandai Selesai)
// ============================================================
function openVerifyModal(itemId) {
  const item = getItems().find(i => i.id === itemId);
  if (!item) return;

  // Tutup modal detail dulu agar tidak bertumpuk
  document.getElementById('modal-overlay').classList.add('hidden');

  document.getElementById('verify-item-id-hidden').value = itemId;

  // Reset radio
  document.querySelectorAll('input[name="verify-status"]').forEach(r => r.checked = false);
  document.getElementById('verify-proceed-btn').disabled = true;
  document.getElementById('verify-warning').classList.add('hidden');

  // Label barang
  const typeLabel = item.type === 'lost' ? '🚨 Barang Hilang' : '✅ Barang Ditemukan';
  document.getElementById('verify-item-label').innerHTML =
    `<span class="${item.type==='lost'?'text-red-600':'text-green-600'}">${typeLabel}</span> · <span class="text-gray-800">${escapeHtml(item.name)}</span>`;

  // Cek apakah ada kandidat match
  const candidates = findMatches(item);
  const matchWrap  = document.getElementById('vopt-match-wrap');
  if (candidates.length > 0) {
    matchWrap.classList.remove('hidden');
    matchWrap.querySelector('p.text-xs').textContent =
      `Ditemukan ${candidates.length} laporan barang temuan yang mungkin cocok. Hubungkan kedua laporan.`;
  } else {
    matchWrap.classList.add('hidden');
  }

  // Jika barang ditemukan, sembunyikan opsi pemusnahan (pemusnahan hanya untuk found item)
  const disposedWrap = document.getElementById('vopt-dispose-wrap');
  if (item.type === 'lost') {
    disposedWrap.querySelector('p.font-bold').textContent = '🗑️ Barang tidak ditemukan → Tutup Laporan';
    disposedWrap.querySelector('p.text-xs').textContent   = 'Pencarian dihentikan. Laporan akan ditutup tanpa pengembalian barang.';
  } else {
    disposedWrap.querySelector('p.font-bold').textContent = '🗑️ Tidak ada pemilik → Pemusnahan / Donasi';
    disposedWrap.querySelector('p.text-xs').textContent   = 'Tidak ada pemilik yang mengklaim. Proses pemusnahan atau donasi.';
  }

  document.getElementById('verify-modal-overlay').classList.remove('hidden');
}

function closeVerifyModal(e) {
  if (e && e.target !== document.getElementById('verify-modal-overlay')) return;
  document.getElementById('verify-modal-overlay').classList.add('hidden');
}

function onVerifyChange() {
  const val = document.querySelector('input[name="verify-status"]:checked')?.value;
  const btn = document.getElementById('verify-proceed-btn');
  const warning = document.getElementById('verify-warning');
  const warningText = document.getElementById('verify-warning-text');
  btn.disabled = !val;

  if (val === 'dispose') {
    warning.classList.remove('hidden');
    warningText.textContent = '⚠️ Tindakan ini akan menutup laporan. Pastikan sudah melalui masa tunggu dan prosedur yang berlaku.';
    btn.textContent = 'Lanjut →';
  } else if (val === 'match') {
    warning.classList.remove('hidden');
    warningText.textContent = '🔗 Anda akan diarahkan ke detail laporan untuk mencocokkan dengan barang temuan yang sesuai.';
    btn.textContent = 'Lihat Kandidat Cocok →';
  } else {
    warning.classList.add('hidden');
    btn.textContent = 'Lanjut: Isi Data Pengambilan →';
  }
}

function proceedVerify() {
  const val    = document.querySelector('input[name="verify-status"]:checked')?.value;
  const itemId = document.getElementById('verify-item-id-hidden').value;
  document.getElementById('verify-modal-overlay').classList.add('hidden');

  if (val === 'found') {
    // Buka form data pengambilan + bukti foto
    openResolveModal(itemId);

  } else if (val === 'match') {
    // Tutup modal utama, scroll ke bagian match di detail item
    closeModal();
    // Buka kembali modal item agar user bisa klik konfirmasi cocok
    setTimeout(() => openModal(itemId), 150);
    showToast('Scroll ke bawah untuk melihat kandidat cocok 🔍', 'bg-indigo-600');

  } else if (val === 'dispose') {
    const item = getItems().find(i => i.id === itemId);
    if (item && item.type === 'found') {
      // Langsung buka modal pemusnahan
      openDisposalModal(itemId);
    } else {
      // Lost item — tutup laporan tanpa resolveData
      if (!confirm('Tutup laporan ini tanpa pengembalian barang?')) return;
      const items = getItems();
      const idx   = items.findIndex(i => i.id === itemId);
      if (idx !== -1) {
        items[idx].status     = 'resolved';
        items[idx].closedNote = 'Ditutup: barang tidak ditemukan';
        items[idx].closedAt   = Date.now();
        saveItems(items);
      }
      closeModal();
      showToast('Laporan ditutup.', 'bg-gray-600');
      renderItemPage('lost'); renderItemPage('found'); renderAll();
      if (adminLoggedIn) renderAdmin();
    }
  }
}

// ============================================================
// RESOLVE MODAL — Selesaikan Laporan dengan Bukti
// ============================================================
let resolvePhotoData = null;

function openResolveModal(itemId) {
  resolvePhotoData = null;
  const item = getItems().find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('resolve-item-id').value = itemId;
  document.getElementById('resolve-nama').value       = '';
  document.getElementById('resolve-kontak').value     = '';
  document.getElementById('resolve-petugas').value    = '';
  document.getElementById('resolve-lokasi').value     = '';
  document.getElementById('resolve-keterangan').value = '';
  document.getElementById('resolve-tgl').value        = new Date().toISOString().slice(0,10);
  document.getElementById('resolve-photo-input').value = '';
  document.getElementById('resolve-drop-ph').classList.remove('hidden');
  document.getElementById('resolve-preview').classList.add('hidden');
  document.getElementById('resolve-preview-img').src = '';

  const typeLabel = item.type === 'lost' ? '🚨 Barang Hilang' : '✅ Barang Ditemukan';
  document.getElementById('resolve-item-info').innerHTML = `
    <div class="flex items-center gap-2 mb-1">
      <span class="${item.type==='lost'?'badge-lost':'badge-found'} px-2 py-0.5 rounded-full text-xs font-semibold">${typeLabel}</span>
    </div>
    <p class="font-bold text-gray-800">${escapeHtml(item.name)}</p>
    <p class="text-xs text-gray-500 mt-0.5">📍 ${escapeHtml(item.location)} · 🗓️ ${formatDate(item.date)}</p>
    <p class="text-xs text-gray-500">Pelapor: ${escapeHtml(item.reporter)}</p>`;

  document.getElementById('resolve-modal-overlay').classList.remove('hidden');
}

function closeResolveModal(e) {
  if (e && e.target !== document.getElementById('resolve-modal-overlay')) return;
  document.getElementById('resolve-modal-overlay').classList.add('hidden');
}

function handleResolveFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 8 * 1024 * 1024) { showToast('Foto terlalu besar (maks 8 MB)', 'bg-red-500'); return; }
  const reader = new FileReader();
  reader.onload = async e => {
    resolvePhotoData = await compressPhoto(e.target.result);
    document.getElementById('resolve-preview-img').src = resolvePhotoData;
    document.getElementById('resolve-drop-ph').classList.add('hidden');
    document.getElementById('resolve-preview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function handleResolveDrop(e) {
  e.preventDefault();
  document.getElementById('resolve-dropzone').classList.remove('border-indigo-400','bg-indigo-50');
  const file = e.dataTransfer.files[0];
  if (file) handleResolveFile(file);
}

function removeResolvePhoto(e) {
  e.stopPropagation();
  resolvePhotoData = null;
  document.getElementById('resolve-preview-img').src = '';
  document.getElementById('resolve-preview').classList.add('hidden');
  document.getElementById('resolve-drop-ph').classList.remove('hidden');
  document.getElementById('resolve-photo-input').value = '';
}

function submitResolve() {
  const nama    = document.getElementById('resolve-nama').value.trim();
  const kontak  = document.getElementById('resolve-kontak').value.trim();
  const tgl     = document.getElementById('resolve-tgl').value;
  const petugas = document.getElementById('resolve-petugas').value.trim();
  const lokasi  = document.getElementById('resolve-lokasi').value.trim();
  const ket     = document.getElementById('resolve-keterangan').value.trim();

  if (!nama)    { showToast('Nama pengambil wajib diisi','bg-red-500'); return; }
  if (!kontak)  { showToast('No. identitas / kontak wajib diisi','bg-red-500'); return; }
  if (!tgl)     { showToast('Tanggal pengambilan wajib diisi','bg-red-500'); return; }
  if (!petugas) { showToast('Nama petugas wajib diisi','bg-red-500'); return; }
  if (!lokasi)  { showToast('Lokasi serah terima wajib diisi','bg-red-500'); return; }
  if (!resolvePhotoData) { showToast('Foto bukti pengambilan wajib diupload','bg-red-500'); return; }

  const itemId = document.getElementById('resolve-item-id').value;
  const items  = getItems();
  const idx    = items.findIndex(i => i.id === itemId);
  if (idx === -1) return;

  items[idx].status      = 'resolved';
  items[idx].resolveData = { nama, kontak, tgl, petugas, lokasi, keterangan: ket, photo: resolvePhotoData, resolvedAt: Date.now() };
  saveItems(items);

  document.getElementById('resolve-modal-overlay').classList.add('hidden');
  closeModal();
  showToast('✅ Laporan berhasil diselesaikan!', 'bg-green-600');
  renderItemPage('lost');
  renderItemPage('found');
  renderAll();
  if (adminLoggedIn) renderAdmin();
}

// ============================================================
// REPORT MODAL
// ============================================================
function openReportModal(type) {
  const isLost   = type === 'lost';
  const accent   = isLost ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700';
  document.getElementById('report-type').value        = type;
  document.getElementById('report-modal-title').textContent = isLost ? '🚨 Laporkan Barang Hilang' : '✅ Laporkan Barang Ditemukan';
  document.getElementById('report-modal-sub').textContent   = isLost
    ? 'Isi detail barang yang hilang agar mudah ditemukan.'
    : 'Isi detail barang yang kamu temukan agar pemiliknya bisa menghubungi.';
  document.getElementById('report-submit-btn').className =
    `w-full font-semibold py-3 rounded-xl transition text-sm text-white ${accent}`;
  document.getElementById('item-date').valueAsDate = new Date();
  document.getElementById('report-modal-overlay').classList.remove('hidden');
}

function closeReportModal(e) {
  if (e && e.target !== document.getElementById('report-modal-overlay')) return;
  document.getElementById('report-modal-overlay').classList.add('hidden');
  document.getElementById('report-form').reset();
  resetPhotoField();
}

function submitReport(e) {
  e.preventDefault();
  const type   = document.getElementById('report-type').value;
  const itemId = uid();
  const item = {
    id: itemId, type,
    name:     document.getElementById('item-name').value.trim(),
    category: document.getElementById('item-category').value,
    desc:     document.getElementById('item-desc').value.trim(),
    location: document.getElementById('item-location').value.trim(),
    date:     document.getElementById('item-date').value,
    reporter: document.getElementById('reporter-name').value.trim(),
    contact:  document.getElementById('reporter-contact').value.trim(),
    photo:    pendingPhotoBase64,
    status:   'open',
    createdAt: Date.now(),
  };
  const items = getItems(); items.unshift(item); saveItems(items);
  document.getElementById('report-form').reset();
  resetPhotoField();
  document.getElementById('report-modal-overlay').classList.add('hidden');
  showToast('Laporan berhasil disimpan! ✅', 'bg-green-600');
  renderItemPage(type);
}

// ============================================================
// PHOTO UPLOAD
// ============================================================
let pendingPhotoBase64 = null;
let pendingPhotoFile   = null; // file asli untuk upload ke Storage

function handlePhotoSelect(e) { const f = e.target.files[0]; if (f) loadPhoto(f); }
function handlePhotoDrop(e) {
  e.preventDefault();
  document.getElementById('photo-dropzone').classList.remove('border-indigo-400','bg-indigo-50');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) loadPhoto(f);
}
function loadPhoto(file) {
  if (file.size > 5*1024*1024) { showToast('Ukuran foto maks 5 MB.','bg-red-500'); return; }
  pendingPhotoFile = file;
  const reader = new FileReader();
  reader.onload = async ev => {
    pendingPhotoBase64 = await compressPhoto(ev.target.result);
    document.getElementById('photo-preview-img').src = pendingPhotoBase64;
    document.getElementById('photo-placeholder').classList.add('hidden');
    document.getElementById('photo-preview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}
function removePhoto(e) {
  e.stopPropagation();
  resetPhotoField();
}
function resetPhotoField() {
  pendingPhotoBase64 = null;
  pendingPhotoFile   = null;
  const inp = document.getElementById('item-photo');
  if (inp) inp.value = '';
  const img = document.getElementById('photo-preview-img');
  if (img) img.src = '';
  document.getElementById('photo-placeholder')?.classList.remove('hidden');
  document.getElementById('photo-preview')?.classList.add('hidden');
}

// ============================================================
// SIGNATURE PAD
// ============================================================
const SIG = {
  canvas: null, ctx: null, drawing: false,
  lastX: 0, lastY: 0, isEmpty: true,

  init() {
    this.canvas = document.getElementById('sig-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.strokeStyle = '#1e1b4b';
    this.ctx.lineWidth   = 2.2;
    this.ctx.lineCap     = 'round';
    this.ctx.lineJoin    = 'round';
    this.isEmpty = true;
    this._bindEvents();
  },

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / r.width;
    const scaleY = this.canvas.height / r.height;
    const src    = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left)*scaleX, y: (src.clientY - r.top)*scaleY };
  },

  _bindEvents() {
    const c = this.canvas;
    const start = e => {
      e.preventDefault();
      this.drawing = true;
      const p = this._pos(e);
      this.lastX = p.x; this.lastY = p.y;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 1.1, 0, Math.PI*2);
      this.ctx.fill();
      this.isEmpty = false;
      document.getElementById('sig-placeholder').style.opacity = '0';
      document.getElementById('sig-wrap').classList.add('signed');
    };
    const move = e => {
      if (!this.drawing) return;
      e.preventDefault();
      const p = this._pos(e);
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();
      this.lastX = p.x; this.lastY = p.y;
    };
    const end = () => { this.drawing = false; };
    c.addEventListener('mousedown',  start, {passive:false});
    c.addEventListener('mousemove',  move,  {passive:false});
    c.addEventListener('mouseup',    end);
    c.addEventListener('mouseleave', end);
    c.addEventListener('touchstart', start, {passive:false});
    c.addEventListener('touchmove',  move,  {passive:false});
    c.addEventListener('touchend',   end);
  },

  clear() {
    if (!this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.isEmpty = true;
    document.getElementById('sig-placeholder').style.opacity = '1';
    document.getElementById('sig-wrap').classList.remove('signed');
  },

  toDataURL() { return this.isEmpty ? null : this.canvas.toDataURL('image/png'); },
};

function clearSignature() { SIG.clear(); }

// ============================================================
// CLAIM PAGE
// ============================================================
let selectedItemId   = null;
let currentClaimStep = 1;

function initClaimPage() {
  claimTab('track');
  document.getElementById('track-input').value = '';
  document.getElementById('track-results').innerHTML = '';
}

function claimTab(tab) {
  document.getElementById('claim-tab-track').classList.toggle('hidden',   tab!=='track');
  document.getElementById('claim-tab-new').classList.toggle('hidden',     tab!=='new');
  document.getElementById('claim-tab-history').classList.toggle('hidden', tab!=='history');
  document.getElementById('tab-track').classList.toggle('active',   tab==='track');
  document.getElementById('tab-new').classList.toggle('active',     tab==='new');
  document.getElementById('tab-history').classList.toggle('active', tab==='history');
  if (tab==='new')     initClaimForm();
  if (tab==='history') renderPickupHistory();
}

function initClaimForm() {
  selectedItemId = null;
  currentClaimStep = 1;
  gotoClaimStep(1);
  ['claim-name','claim-contact','claim-proof','claim-note','claim-search'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('claim-date').valueAsDate = new Date();
  document.getElementById('claim-time').value = '';
  renderClaimItemList('');
  updateClaimSelectedPreview();
  setTimeout(() => SIG.init(), 50);
}

function filterClaimItems() {
  renderClaimItemList(document.getElementById('claim-search').value);
}

function renderClaimItemList(query) {
  const approvedItemIds = new Set(getClaims().filter(c=>c.status==='approved').map(c=>c.itemId));
  let items = getItems().filter(i =>
    i.type === 'found' &&
    i.status !== 'resolved' &&
    i.status !== 'disposed' &&
    !approvedItemIds.has(i.id)
  );

  if (query.trim()) {
    const toks = tokenize(query);
    items = items.map(i => ({i,...scoreItem(i,toks)})).filter(r=>r.score>0.05)
      .sort((a,b)=>b.score-a.score).map(r=>r.i);
  } else {
    items.sort((a,b) => b.createdAt - a.createdAt);
  }

  const el = document.getElementById('claim-item-list');
  if (!items.length) {
    el.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Tidak ada barang ditemukan yang tersedia.</p>';
    return;
  }
  el.innerHTML = items.map(item => {
    const hasPending = getClaims().some(c => c.itemId===item.id && c.status==='pending');
    return `
      <div class="claim-item-row rounded-xl p-3 flex items-start gap-3 ${selectedItemId===item.id?'selected':''}"
           onclick="selectClaimItem('${item.id}')">
        <div class="mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                    ${selectedItemId===item.id?'border-indigo-600 bg-indigo-600':'border-gray-400'}">
          ${selectedItemId===item.id?'<div class="w-2 h-2 rounded-full bg-white"></div>':''}
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-gray-800 text-sm">${escapeHtml(item.name)}</p>
          <p class="text-xs text-gray-500 truncate">${escapeHtml(item.desc.slice(0,70))}…</p>
          <p class="text-xs text-gray-400 mt-0.5">📍 ${escapeHtml(item.location)} · ${formatDate(item.date)}</p>
          ${hasPending ? '<span class="text-xs text-yellow-600 font-medium">⏳ Ada klaim pending</span>' : ''}
        </div>
      </div>`;
  }).join('');
}

function selectClaimItem(id) {
  selectedItemId = id;
  renderClaimItemList(document.getElementById('claim-search').value);
  updateClaimSelectedPreview();
  document.getElementById('btn-step1-next').disabled = false;
}

function updateClaimSelectedPreview() {
  const preview = document.getElementById('claim-selected-preview');
  const nameEl  = document.getElementById('claim-selected-name');
  if (selectedItemId) {
    const item = getItems().find(i => i.id===selectedItemId);
    nameEl.textContent = item ? item.name : '';
    preview.classList.remove('hidden');
  } else {
    preview.classList.add('hidden');
    document.getElementById('btn-step1-next').disabled = true;
  }
}

function gotoClaimStep(step) {
  [1,2,3].forEach(s => {
    document.getElementById(`claim-step-${s}`).classList.toggle('hidden', s!==step);
    const dot = document.getElementById(`step-dot-${s}`);
    dot.classList.toggle('active', s===step);
    dot.classList.toggle('done',   s<step);
    if (s<3) document.getElementById(`step-line-${s}`).classList.toggle('done', s<step);
  });
  currentClaimStep = step;
}

function claimNextStep(from) {
  if (from===1) {
    if (!selectedItemId) { showToast('Pilih barang terlebih dahulu.','bg-red-500'); return; }
    gotoClaimStep(2);
  } else if (from===2) {
    const name    = document.getElementById('claim-name').value.trim();
    const contact = document.getElementById('claim-contact').value.trim();
    const proof   = document.getElementById('claim-proof').value.trim();
    if (!name||!contact||!proof) { showToast('Isi semua field wajib.','bg-red-500'); return; }
    if (SIG.isEmpty) { showToast('Tanda tangan wajib diisi.','bg-red-500'); return; }
    gotoClaimStep(3);
  }
}

function claimPrevStep(from) { gotoClaimStep(from-1); }

function submitClaim() {
  const date = document.getElementById('claim-date').value;
  const time = document.getElementById('claim-time').value;
  if (!date||!time) { showToast('Pilih tanggal dan waktu.','bg-red-500'); return; }

  const claim = {
    id: uid(), itemId: selectedItemId,
    claimantName:    document.getElementById('claim-name').value.trim(),
    claimantContact: document.getElementById('claim-contact').value.trim(),
    proofDesc:       document.getElementById('claim-proof').value.trim(),
    signature:       SIG.toDataURL(),
    preferredDate: date, preferredTime: time,
    note: document.getElementById('claim-note').value.trim(),
    status: 'pending',
    pickupDate:null, pickupTime:null, pickupLocation:null, pickupOfficer:null, verificationCode:null,
    adminNote: '', createdAt: Date.now(),
  };
  const claims = getClaims(); claims.push(claim); saveClaims(claims);
  SIG.clear();
  showToast('Klaim berhasil dikirim! Tunggu konfirmasi admin.','bg-green-600');
  claimTab('track');
  document.getElementById('track-input').value = claim.claimantContact;
  trackClaim();
}

function openClaimFromModal(itemId) {
  selectedItemId = itemId;
  showPage('claim');
  claimTab('new');
  renderClaimItemList('');
  updateClaimSelectedPreview();
  gotoClaimStep(2);
  setTimeout(() => SIG.init(), 80);
}

// ============================================================
// TRACK CLAIM
// ============================================================
function trackClaim() {
  const query = document.getElementById('track-input').value.trim().toLowerCase();
  if (!query) { showToast('Masukkan nomor klaim atau kontak.','bg-red-500'); return; }

  const claims = getClaims().filter(c =>
    c.id.toLowerCase().includes(query) ||
    c.claimantContact.toLowerCase().includes(query) ||
    c.claimantName.toLowerCase().includes(query)
  );

  const el = document.getElementById('track-results');
  if (!claims.length) {
    el.innerHTML = `<div class="text-center py-10 text-gray-400">
      <div class="text-4xl mb-2">🔍</div>
      <p>Tidak ditemukan klaim untuk "<b>${escapeHtml(query)}</b>".</p></div>`;
    return;
  }
  el.innerHTML = claims.sort((a,b)=>b.createdAt-a.createdAt).map(c => {
    const item = getItems().find(i=>i.id===c.itemId);
    return renderTrackCard(c, item);
  }).join('');
}

function renderTrackCard(claim, item) {
  const statusMap = {
    pending:   {label:'⏳ Menunggu Verifikasi', cls:'badge-pending'},
    approved:  {label:'📅 Dijadwalkan',          cls:'badge-approved'},
    rejected:  {label:'❌ Ditolak',               cls:'badge-rejected'},
    completed: {label:'✅ Selesai',               cls:'badge-completed'},
  };
  const s = statusMap[claim.status] || {label:claim.status, cls:'badge-resolved'};

  const pickupInfo = claim.status==='approved' ? `
    <div class="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
      <p class="font-semibold text-blue-700 mb-1">📅 Detail Pengambilan</p>
      <div class="space-y-0.5 text-blue-600 text-xs">
        <p>Tanggal: <b>${formatDate(claim.pickupDate)}</b> · Waktu: <b>${claim.pickupTime}</b></p>
        <p>Lokasi: <b>${escapeHtml(claim.pickupLocation||'-')}</b></p>
        <p>Petugas: <b>${escapeHtml(claim.pickupOfficer||'-')}</b></p>
      </div>
      <div class="mt-2 ticket-border rounded-lg p-2 text-center">
        <p class="text-xs text-gray-500">Kode Verifikasi</p>
        <p class="text-xl font-bold text-indigo-700 tracking-widest">${claim.verificationCode}</p>
        <p class="text-xs text-gray-400">Tunjukkan ke petugas saat pengambilan</p>
      </div>
      <button onclick="showTicket('${claim.id}')"
        class="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 rounded-lg transition">
        Lihat Tiket Pengambilan
      </button>
    </div>` : '';

  const rejectedNote = claim.status==='rejected' && claim.adminNote ? `
    <div class="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
      <p class="font-semibold mb-0.5">Alasan penolakan:</p>
      <p>${escapeHtml(claim.adminNote)}</p>
    </div>` : '';

  const sigSection = claim.signature ? `
    <details class="mt-3 text-xs">
      <summary class="cursor-pointer text-gray-400 hover:text-gray-600 select-none">Lihat tanda tangan</summary>
      <div class="sig-display mt-1"><img src="${claim.signature}" alt="tanda tangan" /></div>
    </details>` : '';

  return `
    <div class="bg-white rounded-2xl shadow-md p-5 mb-4">
      <div class="flex items-start justify-between mb-2">
        <span class="${s.cls} px-2.5 py-0.5 rounded-full text-xs font-semibold">${s.label}</span>
        <span class="text-xs text-gray-400">${formatDateTime(claim.createdAt)}</span>
      </div>
      <p class="font-bold text-gray-800 mt-2">${item ? escapeHtml(item.name) : '(Barang dihapus)'}</p>
      <p class="text-xs text-gray-500">ID: <code class="bg-gray-100 px-1 rounded">${claim.id}</code></p>
      <p class="text-xs text-gray-500">${escapeHtml(claim.claimantName)} · ${escapeHtml(claim.claimantContact)}</p>
      ${pickupInfo}${rejectedNote}${sigSection}
      ${claim.status==='completed' && claim.buktiPhoto ? `
        <div class="mt-3 border border-green-200 bg-green-50 rounded-xl p-3">
          <p class="text-xs font-semibold text-green-700 mb-1.5">📸 Bukti Pengambilan</p>
          <img src="${claim.buktiPhoto}" alt="bukti" class="max-h-40 rounded-lg object-contain mx-auto block border border-green-100" />
          ${claim.buktiCatatan ? `<p class="text-xs text-green-700 mt-1.5">📝 ${escapeHtml(claim.buktiCatatan)}</p>` : ''}
          <p class="text-xs text-gray-400 mt-1">✅ Diselesaikan ${formatDateTime(claim.completedAt||Date.now())}</p>
        </div>` : ''}
      <div class="mt-4">${buildTimeline(claim)}</div>
    </div>`;
}

function buildTimeline(claim) {
  const steps = [
    {label:'Klaim Dikirim',       done: true},
    {label:'Verifikasi Admin',    done: claim.status!=='pending'},
    {label:'Jadwal Dikonfirmasi', done: claim.status==='approved'||claim.status==='completed'},
    {label:'Barang Diambil',      done: claim.status==='completed'},
  ];
  return `<div class="flex items-center gap-0">
    ${steps.map((s,i) => `
      <div class="flex items-center ${i<steps.length-1?'flex-1':''}">
        <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${s.done?'bg-indigo-600 text-white':'bg-gray-200 text-gray-400'}">
          ${s.done?'✓':i+1}
        </div>
        ${i<steps.length-1?`<div class="flex-1 h-0.5 mx-1 ${steps[i+1].done?'bg-indigo-400':'bg-gray-200'}"></div>`:''}
      </div>`).join('')}
  </div>`;
}

// ============================================================
// TICKET MODAL
// ============================================================
function showTicket(claimId) {
  const claim = getClaims().find(c=>c.id===claimId);
  if (!claim) return;
  const item = getItems().find(i=>i.id===claim.itemId);

  document.getElementById('ticket-content').innerHTML = `
    <div class="text-center mb-4">
      <div class="text-3xl mb-1">🎫</div>
      <h2 class="text-lg font-bold text-gray-800">Tiket Pengambilan Barang</h2>
      <p class="text-xs text-gray-400">Lost & Found System</p>
    </div>
    <div class="ticket-border rounded-xl p-4 space-y-2 text-sm mb-4" id="printable-ticket">
      <div class="flex justify-between"><span class="text-gray-500">Nama</span><span class="font-semibold">${escapeHtml(claim.claimantName)}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Kontak</span><span class="font-semibold">${escapeHtml(claim.claimantContact)}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Barang</span><span class="font-semibold text-right max-w-[60%]">${item?escapeHtml(item.name):'-'}</span></div>
      <div class="border-t border-dashed border-gray-300 my-1"></div>
      <div class="flex justify-between"><span class="text-gray-500">Tanggal</span><span class="font-semibold">${formatDate(claim.pickupDate)}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Waktu</span><span class="font-semibold">${claim.pickupTime}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Lokasi</span><span class="font-semibold text-right max-w-[60%]">${escapeHtml(claim.pickupLocation||'-')}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Petugas</span><span class="font-semibold">${escapeHtml(claim.pickupOfficer||'-')}</span></div>
      <div class="border-t border-dashed border-gray-300 my-1"></div>
      ${claim.signature?`
      <div class="py-1">
        <p class="text-xs text-gray-500 mb-1 text-center">Tanda Tangan Pengklaim</p>
        <div class="sig-display"><img src="${claim.signature}" alt="tanda tangan" /></div>
      </div>
      <div class="border-t border-dashed border-gray-300 my-1"></div>`:''}
      <div class="text-center py-2">
        <p class="text-xs text-gray-500 mb-1">Kode Verifikasi</p>
        <p class="text-2xl font-bold text-indigo-700 tracking-widest">${claim.verificationCode}</p>
      </div>
    </div>
    <p class="text-xs text-center text-gray-400">Tunjukkan tiket ini kepada petugas saat pengambilan barang.</p>`;
  document.getElementById('ticket-modal-overlay').classList.remove('hidden');
}

function closeTicketModal(e) {
  if (e && e.target!==document.getElementById('ticket-modal-overlay')) return;
  document.getElementById('ticket-modal-overlay').classList.add('hidden');
}

function printTicket() { window.print(); }

// ============================================================
// ADMIN
// ============================================================
let adminLoggedIn      = false;
let currentAdminTab    = 'lost';
let currentClaimFilter = 'all';

function setAdminNav(loggedIn) {
  ['nav-all', 'nav-disposal'].forEach(id => {
    document.getElementById(id).classList.toggle('hidden', !loggedIn);
  });
  // Ganti tombol Admin: tampilkan nama user jika login
  const navAdmin = document.getElementById('nav-admin');
  navAdmin.textContent = loggedIn ? '⚙️ Admin ✓' : '⚙️ Admin';
}

function adminLogin() {
  const pw = document.getElementById('admin-password').value;
  if (pw === ADMIN_PW) {
    adminLoggedIn = true;
    document.getElementById('admin-login-section').classList.add('hidden');
    document.getElementById('admin-panel-section').classList.remove('hidden');
    setAdminNav(true);
    renderAdmin();
  } else {
    showToast('Password salah!', 'bg-red-500');
  }
}

function adminLogout() {
  adminLoggedIn = false;
  document.getElementById('admin-login-section').classList.remove('hidden');
  document.getElementById('admin-panel-section').classList.add('hidden');
  document.getElementById('admin-password').value = '';
  setAdminNav(false);
  showPage('lost');
}

function adminTab(tab) {
  currentAdminTab = tab;
  ['lost','found','claims'].forEach(t => {
    document.getElementById(`admin-tab-${t}`).classList.toggle('hidden', t!==tab);
    document.getElementById(`atab-${t}`).classList.toggle('active', t===tab);
  });
  if (tab==='claims') renderAdminClaims(currentClaimFilter);
}

function renderAdmin() {
  if (!adminLoggedIn) return;
  const items  = getItems();
  const claims = getClaims();
  const pending   = claims.filter(c=>c.status==='pending').length;
  const scheduled = claims.filter(c=>c.status==='approved').length;

  document.getElementById('stat-lost').textContent      = items.filter(i=>i.type==='lost'&&i.status==='open').length;
  document.getElementById('stat-found').textContent     = items.filter(i=>i.type==='found'&&i.status==='open').length;
  document.getElementById('stat-pending').textContent   = pending;
  document.getElementById('stat-scheduled').textContent = scheduled;

  const badge = document.getElementById('claim-badge');
  pending>0 ? (badge.textContent=pending, badge.classList.remove('hidden')) : badge.classList.add('hidden');

  renderAdminItemList('lost');
  renderAdminItemList('found');
  if (currentAdminTab==='claims') renderAdminClaims(currentClaimFilter);
}

function renderAdminItemList(type) {
  const items = getItems().filter(i=>i.type===type).sort((a,b)=>b.createdAt-a.createdAt);
  const el    = document.getElementById(`admin-list-${type}`);
  if (!items.length) { el.innerHTML='<p class="text-center text-gray-400 py-4">Belum ada data.</p>'; return; }
  el.innerHTML = items.map(item => `
    <div class="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          ${item.status==='resolved'?'<span class="badge-resolved px-2 py-0.5 rounded-full text-xs">Selesai</span>':'<span class="text-xs text-green-600 font-medium">● Aktif</span>'}
          <span class="text-xs text-gray-400">${formatDate(item.date)}</span>
        </div>
        <p class="font-medium text-gray-800 text-sm mt-0.5 truncate">${escapeHtml(item.name)}</p>
        <p class="text-xs text-gray-400">${escapeHtml(item.reporter)} · ${escapeHtml(item.contact)}</p>
      </div>
      <div class="flex gap-1 shrink-0">
        ${item.status!=='resolved'?`<button onclick="markResolved('${item.id}')"
          class="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-2.5 py-1.5 rounded-lg transition">✅</button>`:''}
        <button onclick="deleteItem('${item.id}')"
          class="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-2.5 py-1.5 rounded-lg transition">🗑️</button>
      </div>
    </div>`).join('');
}

function filterClaims(f) {
  currentClaimFilter = f;
  document.querySelectorAll('.claim-filter-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('cf-'+f).classList.add('active');
  renderAdminClaims(f);
}

function renderAdminClaims(f) {
  let claims = getClaims();
  if (f!=='all') claims = claims.filter(c=>c.status===f);
  claims.sort((a,b)=>b.createdAt-a.createdAt);

  const container = document.getElementById('admin-claims-list');
  const empty     = document.getElementById('admin-claims-empty');
  if (!claims.length) { container.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  const statusMap = {
    pending:   {label:'⏳ Pending',     cls:'badge-pending'},
    approved:  {label:'📅 Dijadwalkan', cls:'badge-approved'},
    rejected:  {label:'❌ Ditolak',      cls:'badge-rejected'},
    completed: {label:'✅ Selesai',      cls:'badge-completed'},
  };

  container.innerHTML = claims.map(claim => {
    const item = getItems().find(i=>i.id===claim.itemId);
    const s    = statusMap[claim.status]||{label:claim.status,cls:'badge-resolved'};

    const actions = claim.status==='pending' ? `
      <div class="flex gap-2 mt-3">
        <button onclick="openScheduleModal('${claim.id}')"
          class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 rounded-lg transition">📅 Setujui & Jadwalkan</button>
        <button onclick="rejectClaim('${claim.id}')"
          class="flex-1 bg-red-100 hover:bg-red-200 text-red-600 text-xs font-semibold py-2 rounded-lg transition">❌ Tolak</button>
      </div>` :
    claim.status==='approved' ? `
      <div class="flex gap-2 mt-3">
        <button onclick="completeClaim('${claim.id}')"
          class="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2 rounded-lg transition">✅ Konfirmasi Sudah Diambil</button>
        <button onclick="showTicket('${claim.id}')"
          class="flex-1 border border-indigo-300 text-indigo-600 text-xs font-semibold py-2 rounded-lg transition">🎫 Tiket</button>
      </div>` : '';

    const buktiSection = claim.status==='completed' && claim.buktiPhoto ? `
      <div class="mt-2 border border-green-200 bg-green-50 rounded-xl p-3">
        <p class="text-xs font-semibold text-green-700 mb-1.5">📸 Bukti Pengambilan</p>
        <img src="${claim.buktiPhoto}" alt="bukti pengambilan" class="max-h-36 rounded-lg object-contain mx-auto block border border-green-200" />
        ${claim.buktiCatatan ? `<p class="text-xs text-green-700 mt-1.5">📝 ${escapeHtml(claim.buktiCatatan)}</p>` : ''}
        <p class="text-xs text-gray-400 mt-1">Diselesaikan: ${formatDateTime(claim.completedAt||Date.now())}</p>
      </div>` : '';

    const pickupDetail = (claim.status==='approved'||claim.status==='completed') ? `
      <div class="mt-2 bg-blue-50 rounded-lg p-2 text-xs text-blue-700 space-y-0.5">
        <p>📅 ${formatDate(claim.pickupDate)} · ${claim.pickupTime}</p>
        <p>📍 ${escapeHtml(claim.pickupLocation||'-')} · 👤 ${escapeHtml(claim.pickupOfficer||'-')}</p>
        <p>🔑 <b>${claim.verificationCode}</b></p>
      </div>` : '';

    const sigSection = claim.signature ? `
      <div class="mt-2 pt-2 border-t border-gray-100">
        <p class="text-xs font-semibold text-gray-600 mb-1">Tanda Tangan Digital:</p>
        <div class="sig-display"><img src="${claim.signature}" alt="tanda tangan" /></div>
      </div>` : '';

    return `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div class="flex items-start justify-between">
          <span class="${s.cls} px-2.5 py-0.5 rounded-full text-xs font-semibold">${s.label}</span>
          <span class="text-xs text-gray-400">${formatDateTime(claim.createdAt)}</span>
        </div>
        <p class="font-bold text-gray-800 text-sm mt-2">${item?escapeHtml(item.name):'(Barang dihapus)'}</p>
        <p class="text-xs text-gray-500">Pengklaim: <b>${escapeHtml(claim.claimantName)}</b> · ${escapeHtml(claim.claimantContact)}</p>
        <div class="mt-2 bg-gray-50 rounded-lg p-2 text-xs text-gray-600">
          <p class="font-semibold text-gray-700 mb-0.5">Bukti Kepemilikan:</p>
          <p>${escapeHtml(claim.proofDesc)}</p>
          ${sigSection}
        </div>
        <p class="text-xs text-gray-400 mt-1">Preferensi: ${formatDate(claim.preferredDate)} · ${claim.preferredTime}</p>
        ${pickupDetail}${buktiSection}${actions}
      </div>`;
  }).join('');
}

// ============================================================
// SCHEDULE MODAL
// ============================================================
function openScheduleModal(claimId) {
  document.getElementById('schedule-claim-id').value = claimId;
  const claim = getClaims().find(c=>c.id===claimId);
  if (claim) {
    document.getElementById('sch-date').value = claim.preferredDate||'';
    document.getElementById('sch-time').value = claim.preferredTime||'';
  }
  document.getElementById('sch-location').value = '';
  document.getElementById('sch-officer').value  = '';
  document.getElementById('schedule-modal-overlay').classList.remove('hidden');
}

function closeScheduleModal(e) {
  if (e && e.target!==document.getElementById('schedule-modal-overlay')) return;
  document.getElementById('schedule-modal-overlay').classList.add('hidden');
}

function confirmSchedule() {
  const claimId  = document.getElementById('schedule-claim-id').value;
  const date     = document.getElementById('sch-date').value;
  const time     = document.getElementById('sch-time').value;
  const location = document.getElementById('sch-location').value.trim();
  const officer  = document.getElementById('sch-officer').value.trim();
  if (!date||!time||!location||!officer) { showToast('Isi semua field.','bg-red-500'); return; }

  const claims = getClaims();
  const idx    = claims.findIndex(c=>c.id===claimId);
  if (idx===-1) return;
  claims[idx] = {...claims[idx], status:'approved', pickupDate:date, pickupTime:time,
    pickupLocation:location, pickupOfficer:officer, verificationCode:genTicketCode()};
  saveClaims(claims);
  closeScheduleModal();
  showToast('Jadwal dikonfirmasi! Kode tiket dibuat.','bg-green-600');
  renderAdmin();
}

function rejectClaim(claimId) {
  const reason = prompt('Alasan penolakan (opsional):') ?? '';
  const claims = getClaims();
  const idx    = claims.findIndex(c=>c.id===claimId);
  if (idx===-1) return;
  claims[idx].status    = 'rejected';
  claims[idx].adminNote = reason;
  saveClaims(claims);
  showToast('Klaim ditolak.','bg-red-500');
  renderAdmin();
  renderAdminClaims(currentClaimFilter);
}

function completeClaim(claimId) {
  // Open bukti modal instead of plain confirm
  openBuktiModal(claimId);
}

// ============================================================
// BUKTI PENGAMBILAN MODAL
// ============================================================
let buktiPhotoData = null;

function openBuktiModal(claimId) {
  buktiPhotoData = null;
  document.getElementById('bukti-claim-id').value = claimId;
  document.getElementById('bukti-catatan').value  = '';
  document.getElementById('bukti-drop-placeholder').classList.remove('hidden');
  document.getElementById('bukti-preview').classList.add('hidden');
  document.getElementById('bukti-preview-img').src = '';
  document.getElementById('bukti-photo-input').value = '';
  document.getElementById('bukti-modal-overlay').classList.remove('hidden');
}

function closeBuktiModal(e) {
  if (e && e.target !== document.getElementById('bukti-modal-overlay')) return;
  document.getElementById('bukti-modal-overlay').classList.add('hidden');
}

function handleBuktiFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 8 * 1024 * 1024) { showToast('Foto terlalu besar (maks 8 MB)','bg-red-500'); return; }
  const reader = new FileReader();
  reader.onload = async e => {
    buktiPhotoData = await compressPhoto(e.target.result);
    document.getElementById('bukti-preview-img').src = buktiPhotoData;
    document.getElementById('bukti-drop-placeholder').classList.add('hidden');
    document.getElementById('bukti-preview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function handleBuktiDrop(e) {
  e.preventDefault();
  document.getElementById('bukti-dropzone').classList.remove('border-green-400','bg-green-50');
  const file = e.dataTransfer.files[0];
  if (file) handleBuktiFile(file);
}

function removeBuktiPhoto(e) {
  e.stopPropagation();
  buktiPhotoData = null;
  document.getElementById('bukti-preview-img').src = '';
  document.getElementById('bukti-preview').classList.add('hidden');
  document.getElementById('bukti-drop-placeholder').classList.remove('hidden');
  document.getElementById('bukti-photo-input').value = '';
}

function confirmBukti() {
  if (!buktiPhotoData) { showToast('Harap upload foto bukti pengambilan terlebih dahulu','bg-red-500'); return; }
  const claimId = document.getElementById('bukti-claim-id').value;
  const catatan = document.getElementById('bukti-catatan').value.trim();
  const claims  = getClaims();
  const idx     = claims.findIndex(c => c.id === claimId);
  if (idx === -1) return;
  claims[idx].status       = 'completed';
  claims[idx].buktiPhoto   = buktiPhotoData;
  claims[idx].buktiCatatan = catatan;
  claims[idx].completedAt  = Date.now();
  saveClaims(claims);
  const items = getItems();
  const iIdx  = items.findIndex(i => i.id === claims[idx].itemId);
  if (iIdx !== -1) { items[iIdx].status = 'resolved'; saveItems(items); }
  document.getElementById('bukti-modal-overlay').classList.add('hidden');
  showToast('Pengambilan dikonfirmasi selesai! ✅','bg-green-600');
  renderAdmin();
  renderAdminClaims(currentClaimFilter);
  renderItemPage('lost'); renderItemPage('found');
}

function deleteItem(id) {
  if (!confirm('Hapus laporan ini?')) return;
  saveItems(getItems().filter(i=>i.id!==id));
  renderAdmin();
  showToast('Laporan dihapus.','bg-gray-700');
}

function clearTypeData(type) {
  if (!confirm(`Hapus semua data barang ${type==='lost'?'hilang':'ditemukan'}?`)) return;
  saveItems(getItems().filter(i=>i.type!==type));
  renderAdmin();
  showToast('Data dihapus.','bg-red-600');
}

// ============================================================
// RIWAYAT PENGAMBILAN BARANG
// ============================================================
let currentPickupFilter = 'all';

function pickupHistoryFilter(f) {
  currentPickupFilter = f;
  ['all','claim','direct'].forEach(k => {
    document.getElementById(`phf-${k}`).classList.toggle('active', k === f);
  });
  renderPickupHistory();
}

function renderPickupHistory() {
  const searchQ = (document.getElementById('phf-search')?.value || '').toLowerCase().trim();

  // Source 1: completed claims (via klaim → bukti pengambilan)
  const allClaims = getClaims().filter(c => c.status === 'completed');
  const allItems  = getItems();

  const claimRecords = allClaims.map(c => {
    const item = allItems.find(i => i.id === c.itemId);
    return {
      source:      'claim',
      id:          c.id,
      itemName:    item ? item.name : '(Barang dihapus)',
      itemCat:     item ? item.category : '-',
      itemType:    item ? item.type : '-',
      nama:        c.claimantName,
      kontak:      c.claimantContact,
      tgl:         c.pickupDate,
      petugas:     c.pickupOfficer || '-',
      lokasi:      c.pickupLocation || '-',
      photo:       c.buktiPhoto    || null,
      catatan:     c.buktiCatatan  || '',
      signature:   c.signature     || null,
      keterangan:  c.adminNote     || '',
      ts:          c.completedAt   || c.createdAt,
      verCode:     c.verificationCode || '-',
    };
  });

  // Source 2: directly resolved items with resolveData
  const directRecords = allItems
    .filter(i => i.status === 'resolved' && i.resolveData)
    .map(i => ({
      source:     'direct',
      id:         i.id,
      itemName:   i.name,
      itemCat:    i.category,
      itemType:   i.type,
      nama:       i.resolveData.nama,
      kontak:     i.resolveData.kontak,
      tgl:        i.resolveData.tgl,
      petugas:    i.resolveData.petugas,
      lokasi:     i.resolveData.lokasi,
      photo:      i.resolveData.photo    || null,
      catatan:    '',
      signature:  null,
      keterangan: i.resolveData.keterangan || '',
      ts:         i.resolveData.resolvedAt,
      verCode:    null,
    }));

  // Update stat totals (before filter)
  document.getElementById('ph-stat-total').textContent  = claimRecords.length + directRecords.length;
  document.getElementById('ph-stat-claim').textContent  = claimRecords.length;
  document.getElementById('ph-stat-direct').textContent = directRecords.length;

  // Merge & apply source filter
  let records = [...claimRecords, ...directRecords];
  if (currentPickupFilter === 'claim')  records = claimRecords;
  if (currentPickupFilter === 'direct') records = directRecords;

  // Search filter
  if (searchQ) {
    records = records.filter(r =>
      r.itemName.toLowerCase().includes(searchQ) ||
      r.nama.toLowerCase().includes(searchQ) ||
      r.kontak.toLowerCase().includes(searchQ) ||
      r.lokasi.toLowerCase().includes(searchQ)
    );
  }

  // Sort newest first
  records.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const list  = document.getElementById('pickup-history-list');
  const empty = document.getElementById('pickup-history-empty');

  if (!records.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = records.map(r => {
    const sourceBadge = r.source === 'claim'
      ? `<span class="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">🤝 Via Klaim</span>`
      : `<span class="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">✅ Langsung</span>`;

    const itemTypeBadge = r.itemType === 'lost'
      ? `<span class="badge-lost px-1.5 py-0.5 rounded-full text-xs font-semibold">🚨 Hilang</span>`
      : r.itemType === 'found'
      ? `<span class="badge-found px-1.5 py-0.5 rounded-full text-xs font-semibold">✅ Temuan</span>`
      : '';

    const photoSection = r.photo ? `
      <div>
        <p class="text-xs font-semibold text-gray-500 mb-1">📸 Foto Bukti Pengambilan</p>
        <img src="${r.photo}" alt="bukti" class="w-full max-h-52 object-contain rounded-xl border border-gray-200 bg-gray-50 cursor-pointer"
          onclick="openPhotoViewer(this.src, '${escapeHtml(r.itemName)}')" />
      </div>` : `
      <div class="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl p-2.5">
        <span>📷</span><span>Tidak ada foto bukti</span>
      </div>`;

    const sigSection = r.signature ? `
      <div>
        <p class="text-xs font-semibold text-gray-500 mb-1">✍️ Tanda Tangan</p>
        <div class="sig-display"><img src="${r.signature}" alt="ttd" /></div>
      </div>` : '';

    const verSection = r.verCode ? `
      <div class="bg-indigo-50 rounded-lg px-3 py-1.5 text-xs text-indigo-700 flex items-center gap-2">
        <span>🔑 Kode Verifikasi:</span><span class="font-bold tracking-widest">${r.verCode}</span>
      </div>` : '';

    const keteranganSection = r.keterangan ? `
      <div class="bg-gray-50 rounded-lg p-2 text-xs text-gray-600">
        <span class="font-semibold text-gray-500">📝 Keterangan: </span>${escapeHtml(r.keterangan)}
      </div>` : '';

    const catatanSection = r.catatan ? `
      <div class="bg-gray-50 rounded-lg p-2 text-xs text-gray-600">
        <span class="font-semibold text-gray-500">💬 Catatan serah terima: </span>${escapeHtml(r.catatan)}
      </div>` : '';

    return `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <!-- Header -->
        <div class="bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-2 flex-wrap">
            ${sourceBadge}
            ${itemTypeBadge}
            <span class="text-white font-bold text-sm">${escapeHtml(r.itemName)}</span>
          </div>
          <span class="text-indigo-200 text-xs flex-shrink-0">${formatDateTime(r.ts)}</span>
        </div>

        <div class="p-4 space-y-4">
          <!-- Data pengambil -->
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-xs font-semibold text-gray-500 mb-0.5">👤 Nama Pengambil</p>
              <p class="font-bold text-gray-800 text-sm">${escapeHtml(r.nama)}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-xs font-semibold text-gray-500 mb-0.5">📞 Kontak</p>
              <p class="font-bold text-gray-800 text-sm">${escapeHtml(r.kontak)}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-xs font-semibold text-gray-500 mb-0.5">🗓️ Tanggal Ambil</p>
              <p class="font-bold text-gray-800 text-sm">${formatDate(r.tgl)}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-xs font-semibold text-gray-500 mb-0.5">👷 Petugas</p>
              <p class="font-bold text-gray-800 text-sm">${escapeHtml(r.petugas)}</p>
            </div>
          </div>
          <div class="bg-gray-50 rounded-xl p-3 text-sm">
            <p class="text-xs font-semibold text-gray-500 mb-0.5">📍 Lokasi Serah Terima</p>
            <p class="font-bold text-gray-800">${escapeHtml(r.lokasi)}</p>
          </div>
          ${verSection}
          ${keteranganSection}
          ${catatanSection}
          ${photoSection}
          ${sigSection}
        </div>
      </div>`;
  }).join('');
}

// Photo viewer — lightbox fullscreen tanpa crop
function openPhotoViewer(src, title) {
  // Buat overlay jika belum ada
  let overlay = document.getElementById('photo-viewer-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'photo-viewer-overlay';
    overlay.setAttribute('style',
      'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;');
    overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display='none'; };

    overlay.innerHTML = `
      <div style="position:relative;max-width:100%;max-height:100%;display:flex;flex-direction:column;align-items:center;">
        <!-- Tombol tutup -->
        <button onclick="document.getElementById('photo-viewer-overlay').style.display='none'"
          style="position:absolute;top:-12px;right:-12px;z-index:10;
                 background:rgba(255,255,255,0.15);border:none;color:#fff;cursor:pointer;
                 width:36px;height:36px;border-radius:50%;font-size:18px;font-weight:700;
                 display:flex;align-items:center;justify-content:center;">✕</button>

        <!-- Gambar — tidak ada max-height, tidak ada object-fit -->
        <img id="pv-img" src="" alt="foto"
          style="display:block;max-width:90vw;max-height:85vh;width:auto;height:auto;
                 border-radius:12px;box-shadow:0 0 40px rgba(0,0,0,0.5);" />

        <!-- Judul & tombol download -->
        <div style="margin-top:12px;display:flex;align-items:center;gap:12px;">
          <p id="pv-title" style="color:#fff;font-size:14px;font-weight:600;"></p>
          <a id="pv-download" href="" download
            style="background:rgba(255,255,255,0.15);color:#fff;text-decoration:none;
                   padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">
            ⬇️ Unduh
          </a>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  const img = document.getElementById('pv-img');
  const dl  = document.getElementById('pv-download');
  img.src   = src;
  dl.href   = src;
  dl.download = (title || 'foto') + '.png';
  document.getElementById('pv-title').textContent = title || '';
  overlay.style.display = 'flex';
}

// ============================================================
// PEMUSNAHAN / DONASI MODULE
// ============================================================
let disposalPhotoData   = null;
let currentDisposalHF   = 'all';

function showPage_disposal() {
  renderDisposalPage();
}

function disposalTab(tab) {
  ['eligible','history'].forEach(t => {
    document.getElementById(`dsp-tab-${t}`).classList.toggle('hidden', t !== tab);
    document.getElementById(`dtab-${t}`).classList.toggle('active',   t === tab);
  });
  if (tab === 'history') renderDisposalHistory(currentDisposalHF);
  else renderDisposalPage();
}

function disposalHistoryFilter(f) {
  currentDisposalHF = f;
  ['all','destroyed','donated'].forEach(k => {
    document.getElementById(`dhf-${k}`).classList.toggle('active', k === f);
  });
  renderDisposalHistory(f);
}

function renderDisposalPage() {
  const minAge = parseInt(document.getElementById('dsp-filter-age')?.value || '14');
  const cat    = document.getElementById('dsp-filter-cat')?.value || '';
  const now    = Date.now();
  const MS_DAY = 86400000;

  const allItems = getItems();
  const claims   = getClaims();

  // Eligible: found + open + no active claim + old enough
  const eligible = allItems.filter(item => {
    if (item.type !== 'found') return false;
    if (item.status !== 'open') return false;
    if (cat && item.category !== cat) return false;
    const ageMs  = now - (item.createdAt || now);
    if (ageMs < minAge * MS_DAY) return false;
    // No pending or approved claim
    const hasActiveClaim = claims.some(c => c.itemId === item.id && (c.status === 'pending' || c.status === 'approved'));
    return !hasActiveClaim;
  });

  // Disposed items
  const destroyed = allItems.filter(i => i.status === 'disposed' && i.disposalData?.type === 'destroyed');
  const donated   = allItems.filter(i => i.status === 'disposed' && i.disposalData?.type === 'donated');

  // Update stats
  document.getElementById('dsp-stat-eligible').textContent  = eligible.length;
  document.getElementById('dsp-stat-destroyed').textContent = destroyed.length;
  document.getElementById('dsp-stat-donated').textContent   = donated.length;

  // Render eligible list
  const eligibleList  = document.getElementById('dsp-eligible-list');
  const eligibleEmpty = document.getElementById('dsp-eligible-empty');

  if (!eligible.length) {
    eligibleList.innerHTML = '';
    eligibleEmpty.classList.remove('hidden');
    return;
  }
  eligibleEmpty.classList.add('hidden');

  eligible.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); // oldest first

  eligibleList.innerHTML = eligible.map(item => {
    const ageDays = Math.floor((now - (item.createdAt || now)) / MS_DAY);
    const itemClaims = claims.filter(c => c.itemId === item.id);
    const claimInfo = itemClaims.length
      ? `<span class="text-xs text-gray-400">${itemClaims.length} klaim (ditolak/tidak aktif)</span>`
      : `<span class="text-xs text-gray-400">Tidak ada klaim</span>`;

    const urgency = ageDays >= 60 ? 'border-red-300 bg-red-50' :
                    ageDays >= 30 ? 'border-orange-300 bg-orange-50' :
                                    'border-yellow-200 bg-yellow-50';
    const ageBadge = ageDays >= 60
      ? `<span class="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">🔴 ${ageDays} hari</span>`
      : ageDays >= 30
      ? `<span class="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">🟠 ${ageDays} hari</span>`
      : `<span class="text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">🟡 ${ageDays} hari</span>`;

    const photoThumb = item.photo
      ? `<img src="${item.photo}" class="w-14 h-14 object-cover rounded-xl border border-gray-200 flex-shrink-0" />`
      : `<div class="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">📦</div>`;

    return `
      <div class="bg-white rounded-2xl shadow-sm border-2 ${urgency} p-4">
        <div class="flex gap-3">
          ${photoThumb}
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2 mb-1">
              <p class="font-bold text-gray-800 text-sm truncate">${escapeHtml(item.name)}</p>
              ${ageBadge}
            </div>
            <p class="text-xs text-gray-500 mb-0.5">📁 ${escapeHtml(item.category)} · 📍 ${escapeHtml(item.location)}</p>
            <p class="text-xs text-gray-500 mb-0.5">🗓️ Ditemukan: ${formatDate(item.date)} · Pelapor: ${escapeHtml(item.reporter)}</p>
            <p class="text-xs text-gray-600 line-clamp-2 mb-1">${escapeHtml(item.desc)}</p>
            ${claimInfo}
          </div>
        </div>
        <div class="flex gap-2 mt-3">
          <button onclick="openDisposalModal('${item.id}')"
            class="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold py-2 rounded-xl transition">
            🗑️ Proses Pemusnahan / Donasi
          </button>
          <button onclick="openModal('${item.id}')"
            class="border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold py-2 px-3 rounded-xl transition">
            Detail
          </button>
        </div>
      </div>`;
  }).join('');
}

function renderDisposalHistory(filter) {
  const allItems = getItems().filter(i => i.status === 'disposed');
  const filtered = filter === 'all' ? allItems : allItems.filter(i => i.disposalData?.type === filter);
  filtered.sort((a, b) => (b.disposalData?.disposedAt || 0) - (a.disposalData?.disposedAt || 0));

  const list  = document.getElementById('dsp-history-list');
  const empty = document.getElementById('dsp-history-empty');

  if (!filtered.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = filtered.map(item => {
    const d = item.disposalData;
    const isDestroyed = d.type === 'destroyed';
    const typeBadge = isDestroyed
      ? `<span class="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">🔥 Dimusnahkan</span>`
      : `<span class="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">💙 Didonasikan</span>`;
    const borderColor = isDestroyed ? 'border-red-200' : 'border-blue-200';
    const bgColor     = isDestroyed ? 'bg-red-50' : 'bg-blue-50';
    const headerColor = isDestroyed ? 'bg-red-500' : 'bg-blue-500';

    const donateInfo = !isDestroyed ? `
      <div class="bg-white rounded-lg p-2 border border-blue-100 text-xs">
        <p class="font-semibold text-gray-600">💙 Penerima Donasi</p>
        <p class="text-gray-800 font-bold">${escapeHtml(d.recipient||'-')}</p>
        ${d.recipientAddr ? `<p class="text-gray-500">${escapeHtml(d.recipientAddr)}</p>` : ''}
      </div>` : '';

    const photoHtml = d.photo ? `
      <div>
        <p class="text-xs font-semibold text-gray-600 mb-1">📸 Foto Bukti</p>
        <img src="${d.photo}" alt="bukti" class="w-full max-h-48 object-contain rounded-xl border border-gray-200 bg-white" />
      </div>` : '';

    return `
      <div class="bg-white rounded-2xl shadow-sm border-2 ${borderColor} overflow-hidden">
        <div class="${headerColor} px-4 py-2.5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            ${typeBadge}
            <span class="text-white font-bold text-sm">${escapeHtml(item.name)}</span>
          </div>
          <span class="text-white/70 text-xs">${formatDateTime(d.disposedAt)}</span>
        </div>
        <div class="p-4 space-y-3">
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-gray-50 rounded-lg p-2">
              <p class="text-gray-500 font-semibold">📁 Kategori</p>
              <p class="text-gray-800">${escapeHtml(item.category)}</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-2">
              <p class="text-gray-500 font-semibold">🗓️ Tanggal Tindakan</p>
              <p class="text-gray-800">${formatDate(d.date)}</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-2">
              <p class="text-gray-500 font-semibold">👷 Petugas</p>
              <p class="text-gray-800">${escapeHtml(d.officer)}</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-2">
              <p class="text-gray-500 font-semibold">📍 Lokasi Temuan Asal</p>
              <p class="text-gray-800">${escapeHtml(item.location)}</p>
            </div>
          </div>
          ${donateInfo}
          <div class="bg-gray-50 rounded-lg p-2 text-xs">
            <p class="text-gray-500 font-semibold">📝 Alasan</p>
            <p class="text-gray-700">${escapeHtml(d.reason)}</p>
          </div>
          ${d.witness ? `<div class="bg-gray-50 rounded-lg p-2 text-xs"><p class="text-gray-500 font-semibold">👁️ Saksi</p><p class="text-gray-700">${escapeHtml(d.witness)}</p></div>` : ''}
          ${photoHtml}
        </div>
      </div>`;
  }).join('');
}

// ---- Disposal Modal ----
function openDisposalModal(itemId) {
  disposalPhotoData = null;
  const item = getItems().find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('disposal-item-id').value      = itemId;
  document.getElementById('disposal-date').value         = new Date().toISOString().slice(0,10);
  document.getElementById('disposal-officer').value      = '';
  document.getElementById('disposal-reason').value       = '';
  document.getElementById('disposal-witness').value      = '';
  document.getElementById('disposal-recipient').value    = '';
  document.getElementById('disposal-recipient-addr').value = '';
  document.getElementById('disposal-confirm-check').checked = false;
  document.getElementById('disposal-photo-input').value  = '';
  document.getElementById('disposal-drop-ph').classList.remove('hidden');
  document.getElementById('disposal-preview').classList.add('hidden');
  document.getElementById('disposal-preview-img').src    = '';
  document.getElementById('disposal-donate-fields').classList.add('hidden');
  // Reset radio
  document.querySelectorAll('input[name="disposal-type"]').forEach(r => r.checked = false);

  document.getElementById('disposal-item-info').innerHTML = `
    <div class="flex items-center gap-2 mb-1">
      <span class="badge-found px-2 py-0.5 rounded-full text-xs font-semibold">✅ Barang Ditemukan</span>
    </div>
    <p class="font-bold text-gray-800">${escapeHtml(item.name)}</p>
    <p class="text-xs text-gray-500 mt-0.5">📁 ${escapeHtml(item.category)} · 📍 ${escapeHtml(item.location)}</p>
    <p class="text-xs text-gray-500">🗓️ Ditemukan: ${formatDate(item.date)} · Pelapor: ${escapeHtml(item.reporter)}</p>`;

  document.getElementById('disposal-modal-overlay').classList.remove('hidden');
}

function closeDisposalModal(e) {
  if (e && e.target !== document.getElementById('disposal-modal-overlay')) return;
  document.getElementById('disposal-modal-overlay').classList.add('hidden');
}

function onDisposalTypeChange() {
  const val = document.querySelector('input[name="disposal-type"]:checked')?.value;
  document.getElementById('disposal-donate-fields').classList.toggle('hidden', val !== 'donated');
}

function handleDisposalFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 8 * 1024 * 1024) { showToast('Foto terlalu besar (maks 8 MB)','bg-red-500'); return; }
  const reader = new FileReader();
  reader.onload = async e => {
    disposalPhotoData = await compressPhoto(e.target.result);
    document.getElementById('disposal-preview-img').src = disposalPhotoData;
    document.getElementById('disposal-drop-ph').classList.add('hidden');
    document.getElementById('disposal-preview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function handleDisposalDrop(e) {
  e.preventDefault();
  document.getElementById('disposal-dropzone').classList.remove('border-orange-400','bg-orange-50');
  handleDisposalFile(e.dataTransfer.files[0]);
}

function removeDisposalPhoto(e) {
  e.stopPropagation();
  disposalPhotoData = null;
  document.getElementById('disposal-preview-img').src = '';
  document.getElementById('disposal-preview').classList.add('hidden');
  document.getElementById('disposal-drop-ph').classList.remove('hidden');
  document.getElementById('disposal-photo-input').value = '';
}

function submitDisposal() {
  const type      = document.querySelector('input[name="disposal-type"]:checked')?.value;
  const date      = document.getElementById('disposal-date').value;
  const officer   = document.getElementById('disposal-officer').value.trim();
  const reason    = document.getElementById('disposal-reason').value.trim();
  const witness   = document.getElementById('disposal-witness').value.trim();
  const confirmed = document.getElementById('disposal-confirm-check').checked;
  const recipient = document.getElementById('disposal-recipient').value.trim();
  const recipientAddr = document.getElementById('disposal-recipient-addr').value.trim();

  if (!type)      { showToast('Pilih jenis tindakan terlebih dahulu','bg-red-500'); return; }
  if (!date)      { showToast('Tanggal tindakan wajib diisi','bg-red-500'); return; }
  if (!officer)   { showToast('Nama petugas pelaksana wajib diisi','bg-red-500'); return; }
  if (!reason)    { showToast('Alasan tindakan wajib diisi','bg-red-500'); return; }
  if (type === 'donated' && !recipient) { showToast('Nama penerima donasi wajib diisi','bg-red-500'); return; }
  if (!disposalPhotoData) { showToast('Foto bukti tindakan wajib diupload','bg-red-500'); return; }
  if (!confirmed) { showToast('Centang pernyataan konfirmasi terlebih dahulu','bg-red-500'); return; }

  const itemId = document.getElementById('disposal-item-id').value;
  const items  = getItems();
  const idx    = items.findIndex(i => i.id === itemId);
  if (idx === -1) return;

  items[idx].status = 'disposed';
  items[idx].disposalData = {
    type, date, officer, reason, witness,
    recipient:     type === 'donated' ? recipient : null,
    recipientAddr: type === 'donated' ? recipientAddr : null,
    photo: disposalPhotoData,
    disposedAt: Date.now(),
  };
  saveItems(items);

  document.getElementById('disposal-modal-overlay').classList.add('hidden');
  const label = type === 'destroyed' ? '🔥 Barang berhasil dimusnahkan!' : '💙 Barang berhasil didonasikan!';
  showToast(label, type === 'destroyed' ? 'bg-red-600' : 'bg-blue-600');
  renderDisposalPage();
  renderDisposalHistory(currentDisposalHF);
  renderItemPage('found');
  renderAll();
  if (adminLoggedIn) renderAdmin();
}

// ============================================================
// UTILS
// ============================================================
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
}
function formatDateTime(ts) {
  return new Date(ts).toLocaleDateString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}
function showToast(msg, colorClass) {
  const inner = document.getElementById('toast-inner');
  inner.className = `px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg ${colorClass}`;
  inner.textContent = msg;
  document.getElementById('toast').classList.remove('hidden');
  setTimeout(()=>document.getElementById('toast').classList.add('hidden'), 3000);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
});
