// ===== GHARS CLUB - STORAGE & UTILITIES =====

// ===== INDEXEDDB FOR VIDEOS =====
const VideoDB = {
  db: null,
  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('GharsVideoDB', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('videos')) {
          db.createObjectStore('videos', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      req.onerror = (e) => reject(e);
    });
  },
  async save(id, blob) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('videos', 'readwrite');
      tx.objectStore('videos').put({ id, blob });
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  },
  async get(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('videos', 'readonly');
      const req = tx.objectStore('videos').get(id);
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
      req.onerror = reject;
    });
  },
  async delete(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('videos', 'readwrite');
      tx.objectStore('videos').delete(id);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  }
};

// ===== STORAGE HELPERS =====
const Store = {
  get(key, def = null) {
    try {
      const v = localStorage.getItem('ghars_' + key);
      return v !== null ? JSON.parse(v) : def;
    } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('ghars_' + key, JSON.stringify(val)); } catch(e) { console.error(e); }
  },
  del(key) { localStorage.removeItem('ghars_' + key); }
};

// ===== DEFAULT DATA =====
function initDefaults() {
  // Teacher account
  if (!Store.get('teacher_creds')) {
    Store.set('teacher_creds', { username: 'admin', password: 'ghars@2026', name: 'المعلم' });
  }
  // Students list
  if (!Store.get('students')) Store.set('students', []);
  // Groups
  if (!Store.get('groups')) Store.set('groups', []);
  // Homeworks
  if (!Store.get('homeworks')) Store.set('homeworks', []);
  // Meetings
  if (!Store.get('meetings')) Store.set('meetings', []);
  // Next meeting
  if (!Store.get('next_meeting')) Store.set('next_meeting', null);
  // Seerah lessons
  if (!Store.get('seerah_lessons')) Store.set('seerah_lessons', []);
  // Memorization fixed number
  if (!Store.get('memo_fixed')) Store.set('memo_fixed', 0);
  // Student memo scores
  if (!Store.get('memo_scores')) Store.set('memo_scores', {});
  // Initiatives data
  if (!Store.get('initiatives')) Store.set('initiatives', {});
  // Group points
  if (!Store.get('group_points')) Store.set('group_points', {});
  // Homework submissions
  if (!Store.get('hw_submissions')) Store.set('hw_submissions', {});
  // Attendance records
  if (!Store.get('attendance')) Store.set('attendance', {});
  // Seerah comments
  if (!Store.get('seerah_comments')) Store.set('seerah_comments', {});
  // Last seen
  if (!Store.get('last_seen')) Store.set('last_seen', {});
  // Current session
  if (!Store.get('session')) Store.set('session', null);
}

// ===== HIJRI DATE =====
function toHijri(date) {
  if (!date) date = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  // Using Umm al-Qura approximate calculation
  const jd = Math.floor((d.getTime() / 86400000) + 2440587.5);
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
            Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
             Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  const months = ['محرم','صفر','ربيع الأول','ربيع الثاني','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
  return `${day} ${months[month-1]} ${year}هـ`;
}

function getDayName(date) {
  const d = typeof date === 'string' ? new Date(date) : (date || new Date());
  const days = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  return days[d.getDay()];
}

function formatTime(date) {
  const d = typeof date === 'string' ? new Date(date) : (date || new Date());
  return d.toLocaleTimeString('ar-SA', { hour:'2-digit', minute:'2-digit', hour12: true });
}

// ===== AUTH =====
const Auth = {
  login(username, password) {
    const teacher = Store.get('teacher_creds');
    if (teacher && teacher.username === username && teacher.password === password) {
      Store.set('session', { type: 'teacher', username, name: teacher.name });
      this.updateLastSeen('teacher');
      return { type: 'teacher' };
    }
    const students = Store.get('students', []);
    const student = students.find(s => s.username === username && s.password === password);
    if (student) {
      Store.set('session', { type: 'student', username, name: student.name, id: student.id });
      this.updateLastSeen(student.id);
      return { type: 'student', student };
    }
    return null;
  },
  logout() {
    Store.set('session', null);
    window.location.href = 'index.html';
  },
  getSession() {
    return Store.get('session');
  },
  updateLastSeen(userId) {
    const ls = Store.get('last_seen', {});
    const now = new Date();
    ls[userId] = {
      day: getDayName(now),
      date: toHijri(now),
      time: formatTime(now),
      timestamp: now.toISOString()
    };
    Store.set('last_seen', ls);
  }
};

// ===== ID GENERATOR =====
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ===== USERNAME/PASSWORD GENERATOR =====
function generateCredentials(name) {
  const adjectives = ['kel','fel','fe','len','le','nd','jg','sd','fg','std'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  const username = adj + num;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$';
  let password = '';
  for (let i = 0; i < 8; i++) password += chars[Math.floor(Math.random() * chars.length)];
  return { username, password };
}

// ===== TOAST =====
function showToast(msg, type = 'success', icon = '') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icon || icons[type] || '📢'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== MODAL HELPERS =====
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}

function confirmAction(title, msg, icon, onConfirm) {
  // Build dynamic confirm modal
  let modal = document.getElementById('global-confirm-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'global-confirm-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal confirm-modal" style="max-width:400px">
        <button class="modal-close" onclick="closeModal('global-confirm-modal')">✕</button>
        <span class="confirm-icon" id="gcm-icon"></span>
        <h3 style="text-align:center;margin-bottom:10px;font-size:17px;color:var(--navy)" id="gcm-title"></h3>
        <p id="gcm-msg"></p>
        <div class="modal-actions">
          <button class="btn btn-gray btn-sm" onclick="closeModal('global-confirm-modal')">إلغاء</button>
          <button class="btn btn-red btn-sm" id="gcm-confirm">تأكيد الحذف</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if(e.target === modal) closeModal('global-confirm-modal'); });
  }
  document.getElementById('gcm-icon').textContent = icon || '🗑️';
  document.getElementById('gcm-title').textContent = title;
  document.getElementById('gcm-msg').textContent = msg;
  const btn = document.getElementById('gcm-confirm');
  btn.onclick = () => { closeModal('global-confirm-modal'); onConfirm(); };
  openModal('global-confirm-modal');
}

// ===== COUNTDOWN =====
function startCountdown(targetDateStr, displayEl, onEnd) {
  if (!displayEl) return;
  let interval = setInterval(() => {
    const now = new Date().getTime();
    const target = new Date(targetDateStr).getTime();
    const diff = target - now;
    if (diff <= 0) {
      clearInterval(interval);
      if (onEnd) onEnd();
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    displayEl.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')} ثانية`;
  }, 1000);
  return interval;
}

// ===== COPY TO CLIPBOARD =====
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

// ===== EXPORT =====
window.GharsStore = Store;
window.GharsAuth = Auth;
window.GharsVideoDB = VideoDB;
window.toHijri = toHijri;
window.getDayName = getDayName;
window.formatTime = formatTime;
window.genId = genId;
window.generateCredentials = generateCredentials;
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.confirmAction = confirmAction;
window.startCountdown = startCountdown;
window.copyToClipboard = copyToClipboard;
window.initDefaults = initDefaults;

