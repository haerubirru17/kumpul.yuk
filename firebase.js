// ════════════════════════════════════════════════════════════
//  firebase.js — Koneksi & semua operasi Firestore
//  Ekspor global: window.db, window.loadAllFromFirestore,
//                 window.showLoadingOverlay
// ════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc,
  getDocs, addDoc, updateDoc, deleteDoc,
  setDoc, getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Konfigurasi Firebase ──────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyD2PH8Iaj7RGx3mhp1RNuqG03dy75iyINo",
  authDomain: "kumpul-in.firebaseapp.com",
  projectId: "kumpul-in",
  messagingSenderId: "502619204737",
  appId: "1:502619204737:web:5f269bd56d647c33a2f180"
};

const firebaseApp = initializeApp(firebaseConfig);
const fdb = getFirestore(firebaseApp);

// ── Cache in-memory ───────────────────────────────────────
let _cache = { nasabah: [], setoran: [], pencairan: [] };
let _cacheSetting = {};

// ── Firestore helpers ─────────────────────────────────────
async function fsGetAll(colName) {
  const snap = await getDocs(collection(fdb, colName));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fsAdd(colName, data) {
  const docRef = await addDoc(collection(fdb, colName), {
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return docRef.id;
}

async function fsUpdate(colName, id, data) {
  await updateDoc(doc(fdb, colName, id), {
    ...data,
    updated_at: new Date().toISOString(),
  });
}

async function fsDelete(colName, id) {
  await deleteDoc(doc(fdb, colName, id));
}

// ── Setting helpers — Firestore doc ID = "main" ───────────
async function fsGetSetting() {
  const snap = await getDoc(doc(fdb, 'setting', 'main'));
  return snap.exists() ? snap.data() : {};
}

async function fsSaveSetting(data) {
  // Bersihkan undefined/null sebelum kirim ke Firestore
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null)
  );
  await setDoc(doc(fdb, 'setting', 'main'), clean);
  _cacheSetting = { ...clean };
}

// ── Loading overlay ───────────────────────────────────────
window.showLoadingOverlay = function(show) {
  let el = document.getElementById('loading-overlay');
  if (show) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'loading-overlay';
      el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:var(--font)';
      el.innerHTML = `
        <div style="width:48px;height:48px;border-radius:14px;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:22px">K</div>
        <div style="font-size:15px;font-weight:600;color:var(--text-muted)">Memuat data...</div>
        <div style="width:40px;height:3px;border-radius:99px;background:var(--border);overflow:hidden">
          <div style="width:100%;height:100%;background:var(--primary);animation:prog-anim 1s ease-in-out infinite alternate;border-radius:99px"></div>
        </div>`;
      document.body.appendChild(el);
    }
  } else {
    if (el) el.remove();
  }
};

// ── Load semua data dari Firestore ke cache ───────────────
window.loadAllFromFirestore = async function() {
  try {
    showLoadingOverlay(true);
    const [nasabah, setoran, pencairan, setting] = await Promise.all([
      fsGetAll('nasabah'),
      fsGetAll('setoran'),
      fsGetAll('pencairan'),
      fsGetSetting(),
    ]);
    _cache.nasabah   = nasabah;
    _cache.setoran   = setoran;
    _cache.pencairan = pencairan;
    _cacheSetting    = setting;
  } catch (err) {
    if (window.showToast) showToast('Gagal memuat data: ' + err.message, 'error');
    console.error('Firestore load error:', err);
  } finally {
    showLoadingOverlay(false);
  }
};

// ── Database object (window.db) ───────────────────────────
window.db = {

  // READ — dari cache (sinkron)
  getNasabahList()      { return [..._cache.nasabah]; },
  getNasabah(id)        { return _cache.nasabah.find(n => n.id === id); },
  getSetoranList(nId)   { return nId ? _cache.setoran.filter(s => s.nasabah_id === nId) : [..._cache.setoran]; },
  getPencairanList(nId) { return nId ? _cache.pencairan.filter(p => p.nasabah_id === nId) : [..._cache.pencairan]; },
  getSetting()          { return { ..._cacheSetting }; },

  // WRITE — Firestore + update cache
  async saveSetting(data) {
    await fsSaveSetting(data);
    if (window.renderAll) renderAll();
  },

  async createNasabah(data) {
    const id = await fsAdd('nasabah', data);
    const item = { ...data, id };
    _cache.nasabah.push(item);
    if (window.renderAll) renderAll();
    return item;
  },

  async updateNasabah(id, data) {
    await fsUpdate('nasabah', id, data);
    _cache.nasabah = _cache.nasabah.map(n => n.id === id ? { ...n, ...data } : n);
    if (window.renderAll) renderAll();
  },

  async deleteNasabah(id) {
    const setoranMilik = _cache.setoran.filter(s => s.nasabah_id === id);
    for (const s of setoranMilik) await fsDelete('setoran', s.id);
    const pencairanMilik = _cache.pencairan.filter(p => p.nasabah_id === id);
    for (const p of pencairanMilik) await fsDelete('pencairan', p.id);
    await fsDelete('nasabah', id);
    _cache.nasabah   = _cache.nasabah.filter(n => n.id !== id);
    _cache.setoran   = _cache.setoran.filter(s => s.nasabah_id !== id);
    _cache.pencairan = _cache.pencairan.filter(p => p.nasabah_id !== id);
    if (window.renderAll) renderAll();
  },

  async createSetoran(data) {
    const payload = {
      ...data,
      foto: (data.metode === 'transfer' && data.foto) ? data.foto : null,
    };
    const id = await fsAdd('setoran', payload);
    const item = { ...payload, id };
    _cache.setoran.push(item);
    if (window.renderAll) renderAll();
    return item;
  },

  async updateSetoran(id, data) {
    const payload = { ...data };
    if (data.metode !== 'transfer') payload.foto = null;
    await fsUpdate('setoran', id, payload);
    _cache.setoran = _cache.setoran.map(s => s.id === id ? { ...s, ...payload } : s);
    if (window.renderAll) renderAll();
  },

  async deleteSetoran(id) {
    await fsDelete('setoran', id);
    _cache.setoran = _cache.setoran.filter(s => s.id !== id);
    if (window.renderAll) renderAll();
  },

  async createPencairan(data) {
    const id = await fsAdd('pencairan', data);
    const item = { ...data, id };
    _cache.pencairan.push(item);
    await this.updateNasabah(data.nasabah_id, { status: 'cair' });
    if (window.renderAll) renderAll();
    return item;
  },

  // Export / Import / Reset
  exportData() {
    return {
      nasabah:     this.getNasabahList(),
      setoran:     this.getSetoranList(),
      pencairan:   this.getPencairanList(),
      setting:     this.getSetting(),
      exported_at: new Date().toISOString(),
    };
  },

  async importData(data) {
    showLoadingOverlay(true);
    try {
      for (const n of _cache.nasabah)   await fsDelete('nasabah',   n.id);
      for (const s of _cache.setoran)   await fsDelete('setoran',   s.id);
      for (const p of _cache.pencairan) await fsDelete('pencairan', p.id);
      if (data.nasabah)   for (const n of data.nasabah)   await fsAdd('nasabah',   n);
      if (data.setoran)   for (const s of data.setoran)   await fsAdd('setoran',   s);
      if (data.pencairan) for (const p of data.pencairan) await fsAdd('pencairan', p);
      if (data.setting)   await fsSaveSetting(data.setting);
      await loadAllFromFirestore();
    } finally {
      showLoadingOverlay(false);
    }
  },

  async resetData() {
    showLoadingOverlay(true);
    try {
      for (const s of _cache.setoran)   await fsDelete('setoran',   s.id);
      for (const n of _cache.nasabah)   await fsDelete('nasabah',   n.id);
      for (const p of _cache.pencairan) await fsDelete('pencairan', p.id);
      _cache = { nasabah: [], setoran: [], pencairan: [] };
    } finally {
      showLoadingOverlay(false);
    }
  },
};

// Tandai Firebase siap
window._fbReady = true;
document.dispatchEvent(new Event('firebase-ready'));
