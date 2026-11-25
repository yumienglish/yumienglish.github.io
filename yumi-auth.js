/* Yumi English – đăng nhập + bảng xếp hạng dùng chung cho mọi trang BTVN.
 * Nạp từ https://yumienglish.github.io/yumi-auth.js (cùng origin với mọi trang → dùng chung localStorage `yumi-auth`).
 *
 * Trang dùng:
 *   YumiAuth.ready()            → true nếu đang bật đăng nhập (ENFORCE hoặc link có ?login)
 *   YumiAuth.me()               → {user, name, fullName, cls, avatar} hoặc null
 *   YumiAuth.token()            → token gửi kèm bài nộp
 *   YumiAuth.require(opts)      → Promise<me>; chưa đăng nhập thì hiện màn đăng nhập
 *   YumiAuth.board(opts)        → popup bảng xếp hạng
 *   YumiAuth.autoBoard(opts)    → bật popup lần đầu mở mỗi ngày
 *   YumiAuth.setAvatar(av)      → emoji hoặc '/KET/img/ui/av-3.webp' để hiện trên bảng
 *   YumiAuth.authFailed(opts)   → gọi khi máy chủ trả {auth:true}; xoá token, bắt đăng nhập lại, Promise<me>
 *   YumiAuth.logout()
 * opts.theme = {bg, card, text, acc, acc2, font, head, dark}  (màu/font của từng trang)
 */
(function () {
  'use strict';
  // ====== CÔNG TẮC CHUNG: false = các trang chạy như cũ (gõ tên). Đổi true khi cô đã gửi PIN cho mọi em. ======
  var ENFORCE = true;
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyAom9bBpL0ms0VD7_bz5w691011llkFzttYSjKDyRyMCjLLeUZ4EZGGJLtLMFWuiV4sA/exec';
  // Mỗi link (KET / PET / B2 / A1 / IELTS) có phiên đăng nhập riêng → anh đăng nhập B2, em vào KET không bị nhận nhầm là anh.
  var SITE_ID = (function () { var p = location.pathname;
    return /^\/KET\//i.test(p) ? 'ket' : /^\/PET\//i.test(p) ? 'pet' : /^\/B2-First\//i.test(p) ? 'b2' : /^\/A1-KID\//i.test(p) ? 'a1' : /^\/ielts-homework\//i.test(p) ? 'ielts' : ''; })();
  var SITE_NAMES = { ket: 'KET Adventure', pet: 'PET Arena', b2: 'B2 First', a1: 'A1 KID', ielts: 'IELTS homework' };
  var LEGACY_KEY = 'yumi-auth'; // phiên cũ dùng chung mọi link (trước 25/11): kiểm tra rồi chuyển sang phiên của link
  var KEY = SITE_ID ? 'yumi-auth-' + SITE_ID : 'yumi-auth', DAY_KEY = 'yumi-board-day', BOARD_CACHE = 'yumi-board-cache' + (SITE_ID ? '-' + SITE_ID : '');
  function siteOk(m) { return !!m && (!SITE_ID || !m.site || m.site === '*' || m.site === SITE_ID); }

  var LS = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (_) {} }
  };
  var qs = (function () { try { return new URLSearchParams(location.search); } catch (_) { return { has: function () { return false; } }; } })();
  if (qs.has('login')) { try { sessionStorage.setItem('yumi-try-login', '1'); } catch (_) {} }
  function ready() {
    if (ENFORCE) return true;
    try { return qs.has('login') || sessionStorage.getItem('yumi-try-login') === '1'; } catch (_) { return qs.has('login'); }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function auth() { var a = LS.get(KEY); return a && a.token && a.me && a.me.user && siteOk(a.me) ? a : null; } // thiếu user / tài khoản link khác → đăng nhập lại
  function me() { var a = auth(); return a ? a.me : null; }
  function token() { var a = auth(); return a ? a.token : ''; }

  function post(body) {
    return fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  }


  /* ---------------- TIẾN ĐỘ THEO TÀI KHOẢN (không phụ thuộc máy) ----------------
   * Mỗi trang lưu tiến độ trong localStorage như cũ. Script này:
   *  - ghi nhớ dữ liệu trên máy là của ai (yumi-sync-<nhóm> = {user, at, dirty});
   *  - em khác đăng nhập → dọn dữ liệu em trước (cả bản ghi âm chưa nộp) rồi tải dữ liệu của em từ máy chủ;
   *  - trang ghi localStorage → em ngừng thao tác 10 giây thì gửi phần đổi lên máy chủ (đóng trang / đăng xuất thì gửi ngay).
   */
  var GROUPS = [
    { id: 'ket', path: /^\/KET\//i, keys: /^ket-/, idb: ['ket-selfstudy'], style: 'ket' },
    { id: 'pet', path: /^\/PET\//i, keys: /^pet-/, idb: ['pet-adventure'], style: 'teen' },
    { id: 'b2', path: /^\/B2-First\//i, keys: /^b2-/, idb: ['b2-adventure'], style: 'teen' },
    { id: 'a1', path: /^\/A1-KID\//i, keys: /^(a1kid-|btvn-listening-trainer-a1-)/, idb: [], style: 'a1' },
    { id: 'ielts', path: /^\/ielts-homework\//i, keys: /^(btvn-(?!listening-trainer-a1)|ielts-)/, idb: ['btvn-recordings'] }
  ];
  var DEVICE_ONLY = /-(sound|hi)$/, NO_SYNC = /-(sound|hi|tease|rec)$/, SYNC_PREFIX = 'yumi-sync-';
  var SITE = null; GROUPS.forEach(function (g) { if (g.path.test(location.pathname)) SITE = g; });
  var hasLS = (function () { try { return !!window.localStorage && !!window.Storage; } catch (_) { return false; } })();
  var rawSet = hasLS ? Storage.prototype.setItem : null, rawDel = hasLS ? Storage.prototype.removeItem : null, applying = false;
  function gById(id) { return GROUPS.filter(function (g) { return g.id === id; })[0]; }
  function groupOf(k) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].keys.test(k)) return GROUPS[i]; return null; }
  function syncable(k, v) { return !NO_SYNC.test(k) && (v == null || (String(v).indexOf('data:image') < 0 && String(v).length <= 60000)); } // ảnh tự chụp chỉ ở trên máy
  function sst(g) { return LS.get(SYNC_PREFIX + g.id) || {}; }
  function setSst(g, s) { try { rawSet.call(localStorage, SYNC_PREFIX + g.id, JSON.stringify(s)); } catch (_) {} }
  function lkeys(g) { var out = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && g.keys.test(k)) out.push(k); } } catch (_) {} return out; }
  function ldata(g) { var d = {}; lkeys(g).forEach(function (k) { var v = localStorage.getItem(k); if (syncable(k, v)) d[k] = v; }); return d; }
  function wipe(g) {
    applying = true; lkeys(g).forEach(function (k) { if (!DEVICE_ONLY.test(k)) try { rawDel.call(localStorage, k); } catch (_) {} }); applying = false;
    (g.idb || []).forEach(function (n) { try { indexedDB.deleteDatabase(n); } catch (_) {} });
  }
  // ghi dữ liệu máy chủ xuống máy (giữ phần đổi chưa gửi); true nếu có gì khác
  function applyData(g, data, dirty) {
    var changed = false; dirty = dirty || {}; data = data || {}; applying = true;
    try {
      lkeys(g).forEach(function (k) { if (DEVICE_ONLY.test(k) || dirty[k] || (k in data) || !syncable(k, localStorage.getItem(k))) return; rawDel.call(localStorage, k); changed = true; });
      Object.keys(data).forEach(function (k) { if (!g.keys.test(k) || dirty[k] || localStorage.getItem(k) === data[k]) return; try { rawSet.call(localStorage, k, data[k]); changed = true; } catch (_) {} });
    } finally { applying = false; }
    return changed;
  }
  function mark(k) {
    if (applying) return; var g = groupOf(k); if (g !== SITE) return; var m = me(); if (!m) return;
    var s = sst(g); if (s.user !== m.user) return; // máy chưa xác định chủ → chờ lần tải đầu
    s.dirty = s.dirty || {}; s.dirty[k] = 1; setSst(g, s); schedulePush(10000);
  }
  if (hasLS) {
    Storage.prototype.setItem = function (k, v) { rawSet.call(this, k, v); try { if (this === window.localStorage) mark(String(k)); } catch (_) {} };
    Storage.prototype.removeItem = function (k) { rawDel.call(this, k); try { if (this === window.localStorage) mark(String(k)); } catch (_) {} };
  }
  var pushTimer = null, pushing = false, firstWait = 0, urgentDue = 0;
  // gửi khi em ngừng thao tác 10 giây (gõ liên tục thì tối đa 60 giây/lần); lượt gửi gấp (≤1,5 giây) không bị lùi; đóng trang / đăng xuất → gửi ngay
  function schedulePush(ms) {
    var now = Date.now(); if (pushTimer && urgentDue && urgentDue <= now + ms) return;
    if (!firstWait) firstWait = now; clearTimeout(pushTimer);
    var wait = Math.max(0, Math.min(ms, firstWait + 60000 - now)); urgentDue = ms <= 1500 ? now + wait : 0;
    pushTimer = setTimeout(function () { pushTimer = null; urgentDue = 0; firstWait = 0; pushNow(false); }, wait);
  }
  function pendingGroups(u) {
    var out = null;
    GROUPS.forEach(function (g) {
      if (g !== SITE) return; // phiên này chỉ gửi tiến độ của link đang mở
      var s = sst(g); if (s.user !== u || !s.dirty) return; var ks = Object.keys(s.dirty); if (!ks.length) return;
      var set = {}, del = [], snap = {};
      ks.forEach(function (k) { var v = localStorage.getItem(k); snap[k] = v; if (v == null) del.push(k); else if (syncable(k, v)) set[k] = v; });
      (out = out || {})[g.id] = { set: set, del: del, snap: snap };
    });
    return out;
  }
  function pushNow(keepalive) {
    var a = auth(); if (!a || !hasLS) return Promise.resolve();
    if (pushing && !keepalive) { schedulePush(1500); return Promise.resolve(); }
    var u = a.me.user, pg = pendingGroups(u); if (!pg) return Promise.resolve();
    var groups = {}; Object.keys(pg).forEach(function (id) { groups[id] = { set: pg[id].set, del: pg[id].del }; });
    var body = JSON.stringify({ action: 'progress', token: a.token, groups: groups });
    var o = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body };
    if (keepalive && body.length < 60000) o.keepalive = true;
    pushing = true;
    return fetch(SCRIPT_URL, o).then(function (r) { return r.json(); }).then(function (j) {
      pushing = false; if (!j || !j.ok) { if (!(j && j.auth)) schedulePush(20000); return; }
      Object.keys(pg).forEach(function (id) {
        var g = gById(id), s = sst(g); if (s.user !== u) return; s.dirty = s.dirty || {};
        Object.keys(pg[id].snap).forEach(function (k) { if (localStorage.getItem(k) === pg[id].snap[k]) delete s.dirty[k]; }); // đổi tiếp trong lúc gửi → gửi lần sau
        if (j.at && j.at[id]) s.at = j.at[id];
        setSst(g, s);
      });
      if (pendingGroups(u)) schedulePush(1500);
    }).catch(function () { pushing = false; schedulePush(20000); });
  }
  function pullData() {
    var a = auth(); if (!a) return Promise.reject(new Error('no login'));
    var t = new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 9000); });
    return Promise.race([fetch(SCRIPT_URL + '?action=progress&token=' + encodeURIComponent(a.token)).then(function (r) { return r.json(); }), t]);
  }
  // bài tiến tới đâu: 3 = xong, 2 = đã nộp lần 1 (chờ làm lại), 1 = đang làm, 0 = khác
  function rankOf(v) { var o; try { o = JSON.parse(v); } catch (_) { return 0; } if (!o || typeof o !== 'object') return 0;
    if (o.phase === 'done' || o.done === true) return 3; if (o.phase === 'review' || o.phase === 'retry' || o.submitted === true || o.r1) return 2;
    return o.phase || o.startedAt ? 1 : 0; }
  // so dữ liệu máy chủ với máy → 'owner' (trang đang mở đổi chủ) / 'data' (dữ liệu trang đổi) / ''
  function reconcile(j, u) {
    var siteChanged = '';
    GROUPS.forEach(function (g) {
      if (g !== SITE) return; // tiến độ của link khác do phiên của link đó lo
      var s = sst(g), srv = (j.data || {})[g.id], at = (j.at || {})[g.id] || 0;
      if (s.user !== u) {
        if (!s.user) { // máy dùng từ trước khi có đồng bộ → GỘP: giữ dữ liệu trên máy, thêm bài máy chủ có mà máy chưa có;
          // cùng 1 bài thì giữ bản tiến xa hơn (đã xong > đã nộp lần 1 > đang làm), rồi gửi phần của máy lên
          var d = ldata(g), dirty = {}, ch2 = false; srv = srv || {};
          applying = true;
          try { Object.keys(srv).forEach(function (k) { if (!g.keys.test(k)) return;
            if (!(k in d) && localStorage.getItem(k) == null) { rawSet.call(localStorage, k, srv[k]); ch2 = true; }
            else if ((k in d) && rankOf(srv[k]) > rankOf(d[k])) { rawSet.call(localStorage, k, srv[k]); delete d[k]; ch2 = true; } }); }
          finally { applying = false; }
          Object.keys(d).forEach(function (k) { if (srv[k] !== d[k]) dirty[k] = 1; });
          setSst(g, { user: u, at: at, dirty: dirty }); if (ch2 && g === SITE && !siteChanged) siteChanged = 'data'; return;
        }
        wipe(g); applyData(g, srv || {}, {}); setSst(g, { user: u, at: at, dirty: {} });
        if (g === SITE) siteChanged = 'owner'; return;
      }
      if (srv && at > (s.at || 0)) { var ch = applyData(g, srv, s.dirty); s.at = at; setSst(g, s); if (ch && g === SITE && !siteChanged) siteChanged = 'data'; }
    });
    if (j.me && j.me.user === u) { var a = auth(); if (a) { a.me = j.me; LS.set(KEY, a); useStyle(); } }
    if (pendingGroups(u)) schedulePush(500);
    return siteChanged;
  }
  // đăng nhập xong: tải tiến độ của em trước khi trang chạy (initial) hoặc tải rồi mở lại trang (đang dùng dở)
  function syncAfterLogin(initial) {
    var m = me(); if (!m || !hasLS) return Promise.resolve();
    useStyle();
    return pullData().then(function (j) {
      if (!j || !j.ok) throw new Error('bad');
      var ch = reconcile(j, m.user);
      if (ch === 'owner' && !initial) { location.reload(); return new Promise(function () {}); }
    }).catch(function () { // mạng lỗi: ít nhất không để em này thấy dữ liệu của em khác
      if (SITE) { var s = sst(SITE); if (s.user && s.user !== m.user) { wipe(SITE); setSst(SITE, { user: m.user, at: 0, dirty: {} }); } }
    });
  }
  // mỗi lần mở trang (đã đăng nhập sẵn)
  function syncOnLoad() {
    var m = me(); if (!m || !hasLS) return;
    if (SITE) { var s = sst(SITE); if (s.user && s.user !== m.user) { wipe(SITE); setSst(SITE, { user: m.user, at: 0, dirty: {} }); } } // dọn trước khi trang đọc
    useStyle();
    pullData().then(function (j) {
      if (!j || !j.ok || !me() || me().user !== m.user) return;
      if (reconcile(j, m.user)) {
        var key = 'yumi-sync-reload', last = 0; try { last = Number(sessionStorage.getItem(key)) || 0; } catch (_) {}
        if (Date.now() - last > 60000) { try { sessionStorage.setItem(key, String(Date.now())); } catch (_) {} location.reload(); }
      }
    }).catch(function () {});
  }
  // nhân vật: mỗi bộ (teen / ket) giữ riêng → vào trang nào hiện nhân vật bộ đó
  function useStyle() {
    var a = auth(); if (!a || !SITE || !SITE.style) return;
    var o = a.me.outfits && a.me.outfits[SITE.style];
    if (!o || a.me.avatar === o) return;
    a.me.avatar = o; LS.set(KEY, a);
    try { post({ action: 'outfit', token: a.token, style: SITE.style, outfit: JSON.parse(o.slice(o.indexOf(':') + 1)) }).catch(function () {}); } catch (_) {}
  }
  if (hasLS) {
    window.addEventListener('pagehide', function () { pushNow(true); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') pushNow(true); });
  }

  /* ---------------- CSS (chỉ trong .ya-*) ---------------- */
  var CSS = '' +
    '.ya-ov{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;' +
    'font-family:var(--ya-font);color:var(--ya-text);-webkit-text-size-adjust:100%;box-sizing:border-box}' +
    '.ya-ov *{box-sizing:border-box}' +
    '.ya-ov.ya-full{background:var(--ya-bg);align-items:flex-start;overflow-y:auto;-webkit-overflow-scrolling:touch}' +
    '.ya-full .ya-card{margin:auto}.ya-lbl small{font-weight:400;opacity:.7}.ya-mode{margin:12px 0 4px}' +
    '.ya-ov.ya-dim{background:rgba(10,10,30,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}' +
    '.ya-card{background:var(--ya-card);border-radius:24px;box-shadow:0 18px 50px rgba(0,0,0,.22);width:100%;max-width:420px;padding:26px 22px;' +
    'animation:ya-pop .28s cubic-bezier(.2,1.4,.5,1)}' +
    '@keyframes ya-pop{from{transform:scale(.85);opacity:0}to{transform:none;opacity:1}}' +
    '.ya-h{font-family:var(--ya-head);font-size:28px;font-weight:800;margin:0 0 4px;text-align:center;line-height:1.15}' +
    '.ya-sub{text-align:center;opacity:.75;margin:0 0 18px;font-size:15px}' +
    '.ya-mascot{display:block;margin:-6px auto 8px;width:96px;height:96px;object-fit:contain;font-size:64px;text-align:center;line-height:96px}' +
    '.ya-lbl{display:block;font-weight:700;font-size:14px;margin:12px 0 6px;opacity:.85}' +
    '.ya-in{width:100%;font:inherit;font-size:20px;padding:12px 14px;border-radius:14px;border:2px solid var(--ya-line);background:var(--ya-field);color:var(--ya-text);outline:none}' +
    '.ya-in:focus,.ya-pin input:focus{border-color:var(--ya-acc);box-shadow:0 0 0 4px var(--ya-ring)}' +
    '.ya-pin{display:flex;gap:10px;justify-content:space-between}' +
    '.ya-pin input{width:22%;aspect-ratio:1/1.1;max-height:72px;text-align:center;font:inherit;font-size:30px;font-weight:800;border-radius:14px;' +
    'border:2px solid var(--ya-line);background:var(--ya-field);color:var(--ya-text);outline:none;-webkit-text-security:disc}' +
    '.ya-pin.ya-shake{animation:ya-shake .4s}' +
    '@keyframes ya-shake{20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}' +
    '.ya-btn{display:block;width:100%;margin-top:20px;font:inherit;font-family:var(--ya-head);font-size:22px;font-weight:800;padding:14px;border:0;border-radius:16px;cursor:pointer;' +
    'color:#fff;background:linear-gradient(135deg,var(--ya-acc),var(--ya-acc2));box-shadow:0 6px 0 rgba(0,0,0,.18)}' +
    '.ya-btn:active{transform:translateY(3px);box-shadow:0 3px 0 rgba(0,0,0,.18)}' +
    '.ya-btn[disabled]{opacity:.6;cursor:wait}' +
    '.ya-err{min-height:22px;margin:12px 0 0;text-align:center;color:#e0394d;font-weight:700;font-size:15px}' +
    '.ya-hint{text-align:center;font-size:14px;opacity:.7;margin:10px 0 0}.ya-vi{display:block;font-size:12px;font-style:italic;opacity:.8;margin-top:3px}' +
    /* board */
    '.ya-board{max-width:480px;padding:18px 14px 0;display:flex;flex-direction:column;max-height:min(92vh,760px);overflow:hidden}' +
    '.ya-top{display:flex;align-items:center;gap:8px;margin-bottom:10px}' +
    '.ya-top .ya-h{flex:1;margin:0;font-size:26px}' +
    '.ya-x{border:0;background:var(--ya-field);color:var(--ya-text);width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;flex:none}' +
    '.ya-tabs{display:flex;gap:6px;background:var(--ya-field);padding:5px;border-radius:14px;margin-bottom:12px}' +
    '.ya-tabs button{flex:1;border:0;background:none;color:var(--ya-text);font:inherit;font-weight:700;font-size:14px;padding:9px 4px;border-radius:10px;cursor:pointer;opacity:.7}' +
    '.ya-tabs button.on{background:linear-gradient(135deg,var(--ya-acc),var(--ya-acc2));color:#fff;opacity:1}' +
    '.ya-scroll{overflow-y:auto;flex:1;margin:0 -14px;padding:0 14px 10px;-webkit-overflow-scrolling:touch}' +
    '.ya-pod{display:flex;align-items:flex-end;justify-content:center;gap:8px;margin:6px 0 14px}' +
    '.ya-pod>div{flex:1;max-width:130px;text-align:center}' +
    '.ya-pod .ya-av{margin:0 auto 4px}' +
    '.ya-pod .ya-nm{font-weight:800;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.ya-pod .ya-xp{font-size:13px;opacity:.8}' +
    '.ya-step{margin-top:6px;border-radius:12px 12px 0 0;color:#fff;font-family:var(--ya-head);font-weight:800;font-size:24px;display:flex;align-items:flex-start;justify-content:center;padding-top:6px}' +
    '.ya-p1 .ya-step{height:86px;background:linear-gradient(#ffcf3f,#f5a300)}' +
    '.ya-p2 .ya-step{height:62px;background:linear-gradient(#cfd8e3,#97a6b8)}' +
    '.ya-p3 .ya-step{height:46px;background:linear-gradient(#f0b27a,#c87533)}' +
    '.ya-p1 .ya-av{width:72px;height:72px;font-size:46px;box-shadow:0 0 0 4px #ffcf3f}' +
    '.ya-crown{font-size:26px;line-height:1;margin-bottom:-4px}' +
    '.ya-av{width:44px;height:44px;border-radius:50%;background:var(--ya-field);display:flex;align-items:center;justify-content:center;font-size:28px;overflow:hidden;flex:none}' +
    '.ya-av img{width:100%;height:100%;object-fit:cover}.ya-av.ya-char{background:radial-gradient(circle,#fff,#e9e2ff)}.ya-av.ya-char .yav img{object-fit:fill}' +
    '.ya-av.ya-ini{font-family:var(--ya-head);font-weight:800;font-size:20px;color:#fff;background:linear-gradient(135deg,var(--ya-acc),var(--ya-acc2))}' +
    '.ya-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;margin-bottom:6px;background:var(--ya-field)}' +
    '.ya-row .ya-rk{width:30px;text-align:center;font-family:var(--ya-head);font-weight:800;font-size:18px;flex:none}' +
    '.ya-row .ya-nm{flex:1;min-width:0;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.ya-row .ya-xp{font-family:var(--ya-head);font-weight:800;font-size:17px;flex:none}' +
    '.ya-row .ya-xp small{font-size:11px;opacity:.7;margin-left:2px}' +
    '.ya-chip{display:inline-block;font-size:11px;font-weight:700;padding:1px 7px;border-radius:99px;margin-left:6px;vertical-align:2px;' +
    'background:var(--ya-ring);color:var(--ya-text)}' +
    '.ya-row.ya-me{background:linear-gradient(135deg,var(--ya-acc),var(--ya-acc2));color:#fff}' +
    '.ya-row.ya-me .ya-chip{background:rgba(255,255,255,.3);color:#fff}' +
    '.ya-pinme{margin:0 -14px;padding:8px 14px 14px;background:var(--ya-card);box-shadow:0 -8px 16px -10px rgba(0,0,0,.3)}' +
    '.ya-pinme .ya-row{margin:0}' +
    '.ya-msg{text-align:center;padding:30px 10px;opacity:.8}' +
    '.ya-foot{text-align:center;font-size:12px;opacity:.55;margin:4px 0 8px}' +
    '.ya-spin{width:34px;height:34px;border:4px solid var(--ya-ring);border-top-color:var(--ya-acc);border-radius:50%;margin:30px auto;animation:ya-rot .8s linear infinite}' +
    '@keyframes ya-rot{to{transform:rotate(360deg)}}' +
    '.ya-row[data-pid],.ya-pod [data-pid]{cursor:pointer}.ya-row[data-pid]:active{transform:scale(.98)}' +
    '.ya-hint2{text-align:center;font-size:12px;opacity:.6;margin:-4px 0 8px}' +
    '.ya-home{max-width:460px;padding:16px 14px 18px;max-height:min(94vh,820px);overflow-y:auto}' +
    '.ya-room{position:relative;height:300px;border-radius:20px;overflow:hidden;margin:6px 0 12px;background:linear-gradient(180deg,#ffe3f1 0,#f7d9ff 62%,#d9a46b 62%,#c98d55 100%)}' +
    '.ya-room:before{content:"";position:absolute;left:0;right:0;top:62%;height:6px;background:#b97a43}' +
    '.ya-win{position:absolute;top:22px;left:22px;width:78px;height:66px;border-radius:10px;border:5px solid #fff;background:linear-gradient(#3b2a78,#7b4fd6);box-shadow:0 2px 0 rgba(0,0,0,.1)}' +
    '.ya-win:after{content:"✨ ⭐";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:16px}' +
    '.ya-lamp{position:absolute;top:14px;right:26px;font-size:34px}.ya-plant{position:absolute;bottom:20px;right:16px;font-size:40px}' +
    '.ya-rug{position:absolute;left:50%;bottom:14px;width:220px;height:44px;margin-left:-110px;border-radius:50%;background:radial-gradient(#ff9ec7,#ff6fa5);opacity:.85}' +
    '.ya-who{position:absolute;left:50%;bottom:20px;width:178px;margin-left:-89px}' +
    '.ya-who.emo{width:auto;margin:0;transform:translateX(-50%);font-size:110px;line-height:1;bottom:40px}' +
    '.ya-nameplate{position:absolute;left:50%;top:12px;transform:translateX(-50%);background:#fff;color:#2b2440;border-radius:99px;padding:4px 14px;font-weight:800;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.12);white-space:nowrap}' +
    '.ya-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}' +
    '.ya-stat{background:var(--ya-field);border-radius:14px;padding:8px 6px;text-align:center}.ya-stat b{display:block;font-family:var(--ya-head);font-size:20px}.ya-stat span{font-size:12px;opacity:.75}' +
    '.ya-col{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:8px}' +
    '.ya-col div{background:var(--ya-field);border-radius:12px;padding:6px;text-align:center;font-size:11px;line-height:1.2}' +
    '.ya-col img{width:100%;aspect-ratio:1;object-fit:contain;display:block;margin-bottom:3px}' +
    '.ya-col .x{box-shadow:inset 0 0 0 2px #ffcf3f}.ya-col>span{grid-column:1/-1}' +
    '.ya-h3{font-family:var(--ya-head);font-size:17px;margin:4px 0 8px}' +
    '.ya-react{display:flex;gap:8px;justify-content:center;margin:-2px 0 12px}' +
    '.ya-react button{border:0;border-radius:99px;padding:8px 14px;font:inherit;font-weight:800;font-size:15px;background:var(--ya-field);color:var(--ya-text);cursor:pointer;transition:transform .15s}' +
    '.ya-react button.on{background:linear-gradient(135deg,var(--ya-acc),var(--ya-acc2));color:#fff}.ya-react button:active{transform:scale(1.15)}.ya-react button[disabled]{cursor:default;opacity:.85}' +
    '.ya-react small{display:block;font-size:10.5px;font-weight:600;opacity:.8}' +
    '.ya-gb{margin-top:14px}.ya-gb .c{background:var(--ya-field);border-radius:12px;padding:8px 10px;margin-bottom:6px;font-size:14px;line-height:1.35;position:relative}' +
    '.ya-gb .c b{font-size:13px}.ya-gb .c time{font-size:11px;opacity:.6;margin-left:6px}.ya-gb .c .del{position:absolute;top:4px;right:6px;border:0;background:none;cursor:pointer;font-size:14px;opacity:.6}' +
    '.ya-gb form,.ya-rn form{display:flex;gap:6px;margin-top:8px}.ya-gb input,.ya-rn input{flex:1;min-width:0;font:inherit;font-size:15px;padding:9px 12px;border-radius:12px;border:2px solid var(--ya-line);background:var(--ya-field);color:var(--ya-text)}' +
    '.ya-gb form button,.ya-rn form button,.ya-rn>button{border:0;border-radius:12px;padding:9px 14px;font:inherit;font-weight:800;color:#fff;cursor:pointer;background:linear-gradient(135deg,var(--ya-acc),var(--ya-acc2))}' +
    '.ya-rn{margin:0 0 12px;text-align:center}.ya-rn>button{background:linear-gradient(135deg,#ffcf3f,#ff9f1c);color:#3b2300}.ya-gerr{color:#e0394d;font-size:13px;font-weight:700;margin-top:4px;min-height:16px}' +
    '.ya-trophy{display:inline-flex;align-items:center;gap:6px;font:inherit;font-weight:800;cursor:pointer;border:0;border-radius:99px;padding:8px 14px;' +
    'color:#fff;background:linear-gradient(135deg,#ffb300,#ff6f3c);box-shadow:0 4px 0 rgba(0,0,0,.15)}' +
    '.ya-trophy:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(0,0,0,.15)}';

  var DEFAULT_THEME = { bg: 'linear-gradient(160deg,#ffe3ec,#e3fff4)', card: '#ffffff', text: '#2b2440', acc: '#ff6f91', acc2: '#8a5cff',
    font: "'Be Vietnam Pro','Segoe UI',system-ui,sans-serif", head: "'Baloo 2','Be Vietnam Pro',system-ui,sans-serif", dark: false };
  function injectCss() {
    if (document.getElementById('ya-css')) return;
    var s = document.createElement('style'); s.id = 'ya-css'; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  function applyTheme(el, t) {
    t = Object.assign({}, DEFAULT_THEME, t || {});
    var dark = !!t.dark;
    var v = { bg: t.bg, card: t.card, text: t.text, acc: t.acc, acc2: t.acc2, font: t.font, head: t.head,
      field: t.field || (dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.045)'),
      line: t.line || (dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.12)'),
      ring: t.ring || (dark ? 'rgba(255,255,255,.16)' : 'rgba(138,92,255,.18)') };
    Object.keys(v).forEach(function (k) { el.style.setProperty('--ya-' + k, v[k]); });
  }
  function overlay(cls, theme) {
    injectCss();
    var ov = document.createElement('div');
    ov.className = 'ya-ov ' + cls;
    applyTheme(ov, theme);
    document.body.appendChild(ov);
    return ov;
  }
  function avHtml(av, name) {
    av = String(av || '');
    var ini = esc(String(name || '?').trim().charAt(0).toUpperCase());
    if (/^[a-z0-9]+:{/.test(av)) { // nhân vật tủ đồ (avatar.js) → khuôn mặt nhân vật
      var ch = window.YumiAvatar ? window.YumiAvatar.html(av, { crop: 'head' }) : '';
      return ch ? '<div class="ya-av ya-char">' + ch + '</div>' : '<div class="ya-av ya-ini">' + ini + '</div>';
    }
    if (/^\/[\w-]+(\/[\w.-]+)+\.(webp|png|jpe?g|svg)$/i.test(av)) return '<div class="ya-av"><img src="' + esc(av) + '" alt="" ' +
      'onerror="this.parentNode.className=\'ya-av ya-ini\';this.parentNode.textContent=\'' + ini.replace(/'/g, '') + '\'"></div>';
    if (av) return '<div class="ya-av">' + esc(av) + '</div>';
    return '<div class="ya-av ya-ini">' + esc(String(name || '?').trim().charAt(0).toUpperCase()) + '</div>';
  }

  /* ---------------- ĐĂNG NHẬP ---------------- */
  var loginOpen = null;
  function loginScreen(opts) {
    opts = opts || {};
    if (loginOpen) return loginOpen;
    loginOpen = new Promise(function (resolve) {
      var ov = overlay('ya-full', opts.theme);
      var mascot = opts.mascot ? (/^[\w./-]+\.(webp|png|jpe?g|gif|svg)$/i.test(opts.mascot)
        ? '<img class="ya-mascot" src="' + esc(opts.mascot) + '" alt="">' : '<div class="ya-mascot">' + esc(opts.mascot) + '</div>') : '';
      var pinRow = function (g, label) {
        return '<div class="ya-pin" data-g="' + g + '">' + [0, 1, 2, 3].map(function (i) {
          return '<input inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="off" aria-label="' + label + ' ' + (i + 1) + '">';
        }).join('') + '</div>';
      };
      ov.innerHTML = '<div class="ya-card">' + mascot +
        '<h1 class="ya-h">' + esc(opts.title || 'Who’s playing?') + '</h1>' +
        '<div class="ya-tabs ya-mode"><button type="button" data-m="in" class="on">Log in</button><button type="button" data-m="new">✨ Sign up</button></div>' +
        // ---- đăng nhập ----
        '<form class="ya-f" data-f="in" autocomplete="off">' +
        '<p class="ya-sub">' + esc(opts.sub || 'Log in to save your stars and join the leaderboard 🏆') + '</p>' +
        (opts.wrongSite ? '<p class="ya-err" style="margin:-8px 0 10px">' + esc(opts.wrongSite) + '</p>' : '') +
        '<label class="ya-lbl" for="ya-user">Nickname</label>' +
        '<input class="ya-in" id="ya-user" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" maxlength="20" placeholder="Your nickname">' +
        '<label class="ya-lbl">PIN</label>' + pinRow('in', 'PIN') +
        '<p class="ya-err" role="alert"></p>' +
        '<button class="ya-btn" type="submit">Let’s go 🚀</button>' +
        '<p class="ya-hint">No account yet? Tap <b>✨ Sign up</b> above. Forgot your PIN? Message your teacher 💬<span class="ya-vi">Chưa có tài khoản? Bấm ✨ Sign up ở trên. Quên PIN thì nhắn cô nhé.</span></p>' +
        '</form>' +
        // ---- tạo tài khoản ----
        '<form class="ya-f" data-f="new" autocomplete="off" hidden>' +
        '<p class="ya-sub">Choose your own nickname and PIN 🎮</p>' +
        '<label class="ya-lbl" for="ya-nick">Nickname <small>(shown on the leaderboard)</small></label>' +
        '<input class="ya-in" id="ya-nick" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="20" placeholder="e.g. Shadow Fox, MinhAnh09">' +
        '<label class="ya-lbl" for="ya-full">Real full name <small>(only your teacher sees it)</small></label>' +
        '<input class="ya-in" id="ya-full" autocomplete="name" maxlength="60" placeholder="e.g. Nguyễn Minh Anh">' +
        '<label class="ya-lbl" for="ya-cls">Class</label>' +
        '<input class="ya-in" id="ya-cls" autocapitalize="characters" maxlength="20" placeholder="' + esc(opts.clsHint || 'VD: KET01') + '">' +
        '<label class="ya-lbl">4-digit PIN <small>(make one up and remember it)</small></label>' + pinRow('p1', 'PIN') +
        '<label class="ya-lbl">Type your PIN again</label>' + pinRow('p2', 'PIN again') +
        '<p class="ya-err" role="alert"></p>' +
        '<button class="ya-btn" type="submit">Create account ✨</button>' +
        '<p class="ya-hint">Your real name helps your teacher know who you are. Friends only see your nickname 😉<span class="ya-vi">Tên thật giúp cô biết em là ai. Bạn bè chỉ thấy nickname.</span></p>' +
        '</form></div>';
      var forms = { 'in': ov.querySelector('[data-f="in"]'), 'new': ov.querySelector('[data-f="new"]') };
      var user = ov.querySelector('#ya-user');
      var pins = function (g) { return [].slice.call(ov.querySelectorAll('.ya-pin[data-g="' + g + '"] input')); };
      var pinVal = function (g) { return pins(g).map(function (x) { return x.value; }).join(''); };
      var clearPins = function (g) { pins(g).forEach(function (x) { x.value = ''; }); };
      var shake = function (g) { var b = ov.querySelector('.ya-pin[data-g="' + g + '"]'); b.classList.remove('ya-shake'); void b.offsetWidth; b.classList.add('ya-shake'); };
      var submit = function (f) { f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true })); };
      // ô PIN: tự nhảy ô, dán cả mã, xoá lùi; đủ 4 số → (đăng nhập) gửi luôn / (tạo) sang ô nhập lại
      ['in', 'p1', 'p2'].forEach(function (g) {
        var ps = pins(g);
        ps.forEach(function (p, i) {
          p.addEventListener('input', function () {
            var d = p.value.replace(/\D/g, '');
            if (d.length > 1) { d.split('').slice(0, 4 - i).forEach(function (c, j) { ps[i + j].value = c; }); (ps[Math.min(3, i + d.length)] || p).focus(); }
            else { p.value = d; if (d && ps[i + 1]) ps[i + 1].focus(); }
            if (ps.every(function (x) { return x.value; })) {
              if (g === 'in') submit(forms['in']);
              else if (g === 'p1') pins('p2')[0].focus();
              else submit(forms['new']);
            }
          });
          p.addEventListener('keydown', function (e) { if (e.key === 'Backspace' && !p.value && ps[i - 1]) { ps[i - 1].value = ''; ps[i - 1].focus(); } });
          p.addEventListener('focus', function () { p.select && p.select(); });
        });
      });
      var mode = function (m) {
        [].forEach.call(ov.querySelectorAll('.ya-mode button'), function (b) { b.classList.toggle('on', b.dataset.m === m); });
        forms['in'].hidden = m !== 'in'; forms['new'].hidden = m !== 'new';
        setTimeout(function () { (m === 'in' ? (user.value ? pins('in')[0] : user) : ov.querySelector('#ya-nick')).focus(); }, 40);
      };
      ov.querySelector('.ya-mode').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) mode(b.dataset.m); });
      var saved = LS.get(KEY) || {}, lastUser = opts.wrongSite ? '' : (saved.me && saved.me.name) || saved.last;
      if (lastUser) user.value = lastUser;
      user.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); pins('in')[0].focus(); } });
      ['#ya-nick', '#ya-full', '#ya-cls'].forEach(function (id, i, arr) {
        ov.querySelector(id).addEventListener('keydown', function (e) {
          if (e.key !== 'Enter') return; e.preventDefault();
          (arr[i + 1] ? ov.querySelector(arr[i + 1]) : pins('p1')[0]).focus();
        });
      });
      try { document.documentElement.style.overflow = 'hidden'; } catch (_) {}
      mode(opts.mode === 'new' ? 'new' : 'in');
      var busy = false;
      var done = function (j) {
        LS.set(KEY, { token: j.token, me: j.me, at: Date.now() });
        ov.remove(); loginOpen = null;
        try { document.documentElement.style.overflow = ''; if (document.activeElement) document.activeElement.blur(); window.scrollTo(0, 0); } catch (_) {}
        syncAfterLogin(!!opts._initial).then(function () { resolve(me() || j.me); });
      };
      var run = function (f, body, label, onFail) {
        var err = f.querySelector('.ya-err'), btn = f.querySelector('.ya-btn');
        busy = true; btn.disabled = true; btn.textContent = '…'; err.textContent = '';
        post(body).then(function (j) {
          if (!j.ok) { var e = new Error(j.error || 'Something went wrong, please try again'); e.field = j.field; throw e; }
          done(j);
        }).catch(function (ex) {
          err.textContent = /fetch|network|Failed/i.test(ex.message) ? 'Weak connection, please try again' : ex.message;
          onFail(ex.field);
        }).then(function () { busy = false; btn.disabled = false; btn.textContent = label; });
      };
      forms['in'].addEventListener('submit', function (e) {
        e.preventDefault(); if (busy) return;
        var err = forms['in'].querySelector('.ya-err'), pin = pinVal('in');
        if (!user.value.trim()) { err.textContent = 'Please enter your nickname'; user.focus(); return; }
        if (pin.length !== 4) { err.textContent = 'Your PIN has 4 digits'; (pins('in').filter(function (x) { return !x.value; })[0] || pins('in')[0]).focus(); return; }
        run(forms['in'], { action: 'login', user: user.value, pin: pin, site: SITE_ID }, 'Let’s go 🚀', function () { clearPins('in'); shake('in'); pins('in')[0].focus(); });
      });
      forms['new'].addEventListener('submit', function (e) {
        e.preventDefault(); if (busy) return;
        var f = forms['new'], err = f.querySelector('.ya-err');
        var nick = f.querySelector('#ya-nick'), full = f.querySelector('#ya-full'), cls = f.querySelector('#ya-cls');
        var p1 = pinVal('p1'), p2 = pinVal('p2');
        var bad = function (msg, el) { err.textContent = msg; el.focus(); };
        if (nick.value.trim().length < 3) return bad('Your nickname needs at least 3 letters', nick);
        if (full.value.trim().split(/\s+/).length < 2) return bad('Please enter your full real name (first and last name)', full);
        if (!cls.value.trim()) return bad('Please enter your class', cls);
        if (p1.length !== 4) return bad('Your PIN needs 4 digits', pins('p1').filter(function (x) { return !x.value; })[0] || pins('p1')[0]);
        if (p1 !== p2) { clearPins('p2'); shake('p2'); return bad('The two PINs don’t match, please try again', pins('p2')[0]); }
        run(f, { action: 'register', nick: nick.value, full: full.value, cls: cls.value, pin: p1, site: SITE_ID }, 'Create account ✨', function (field) {
          if (field === 'pin') { clearPins('p1'); clearPins('p2'); shake('p1'); pins('p1')[0].focus(); }
          else if (field === 'nick') nick.focus(); else if (field === 'full') full.focus(); else if (field === 'cls') cls.focus();
        });
      });
    });
    return loginOpen;
  }
  function requireLogin(opts) {
    var m = me();
    if (m) return Promise.resolve(m);
    var show = function (extra) { return loginScreen(Object.assign({}, opts || {}, { _initial: true }, extra || {})).then(function (m2) { if (opts && opts.onLogin) opts.onLogin(m2); return m2; }); };
    var old = SITE_ID ? LS.get(LEGACY_KEY) : null;
    if (!old || !old.token || !old.me || !old.me.user) return show();
    var wait = overlay('ya-full', opts && opts.theme); wait.innerHTML = '<div class="ya-card" style="text-align:center"><p class="ya-sub" style="margin:0">Checking your account… ⏳</p></div>';
    var t = new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 9000); });
    return Promise.race([fetch(SCRIPT_URL + '?action=progress&token=' + encodeURIComponent(old.token)).then(function (r) { return r.json(); }), t]).then(function (j) {
      wait.remove();
      if (!j || !j.ok || !j.me) return show(); // hết phiên / lỗi mạng → đăng nhập
      if (!j.me.site) return show({ sub: 'Please log in once more to continue 🙂' }); // chưa rõ link → đăng nhập 1 lần để gắn với link này
      if (j.me.site !== '*' && j.me.site !== SITE_ID) // tài khoản của link khác (VD anh học B2, em mở KET)
        return show({ wrongSite: 'This is the ' + SITE_NAMES[SITE_ID] + ' page. Please log in with your own account 🙂' });
      LS.set(KEY, { token: old.token, me: j.me, at: Date.now() });
      if (j.me.site !== '*') LS.del(LEGACY_KEY); // đã chuyển sang phiên của link này
      reconcile(j, j.me.user); useStyle();
      if (opts && opts.onLogin) opts.onLogin(j.me);
      return j.me;
    }, function () { wait.remove(); return show(); });
  }

  /* ---------------- BẢNG XẾP HẠNG ---------------- */
  var TABS = [['week', 'This week'], ['month', 'This month'], ['all', 'All time']];
  // 1 lần tải dùng chung: tải sẵn lúc mở trang (nếu hôm nay bảng sẽ tự bật), mở lại trong 1 phút thì không hỏi lại máy chủ
  var boardReq = null, boardReqAt = 0;
  function fetchBoard() {
    if (boardReq && Date.now() - boardReqAt < 60000) return boardReq;
    boardReqAt = Date.now();
    boardReq = fetch(SCRIPT_URL + '?action=board&token=' + encodeURIComponent(token())).then(function (r) { return r.json(); });
    boardReq.then(function (j) { if (!j || !j.ok) boardReq = null; }, function () { boardReq = null; });
    return boardReq;
  }
  function board(opts) {
    opts = opts || {};
    if (!me()) return requireLogin(opts).then(function () { return board(opts); });
    var ov = overlay('ya-dim', opts.theme);
    var tab = 'week', data = (LS.get(BOARD_CACHE) || {}).data || null;
    ov.innerHTML = '<div class="ya-card ya-board" role="dialog" aria-label="Leaderboard">' +
      '<div class="ya-top"><h2 class="ya-h">🏆 Leaderboard</h2><button class="ya-x" aria-label="Close">✕</button></div>' +
      '<div class="ya-tabs">' + TABS.map(function (t) { return '<button data-t="' + t[0] + '"' + (t[0] === tab ? ' class="on"' : '') + '>' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="ya-scroll"></div><div class="ya-pinme"></div></div>';
    var sc = ov.querySelector('.ya-scroll'), pin = ov.querySelector('.ya-pinme');
    function close() { ov.remove(); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.ya-x').onclick = close;
    // chạm vào bạn nào → xem "nhà" của bạn đó
    ov.querySelector('.ya-board').addEventListener('click', function (e) { var p = e.target.closest('[data-pid]'); if (p && p.dataset.pid) home(p.dataset.pid, opts); });
    ov.querySelector('.ya-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      tab = b.dataset.t;
      [].forEach.call(ov.querySelectorAll('.ya-tabs button'), function (x) { x.classList.toggle('on', x === b); });
      render();
    });
    function row(o) {
      return '<div class="ya-row' + (o.me ? ' ya-me' : '') + '"' + (o.pid ? ' data-pid="' + esc(o.pid) + '"' : '') + '><span class="ya-rk">' + (o.rank <= 3 && o.xp > 0 ? ['🥇', '🥈', '🥉'][o.rank - 1] : o.rank) + '</span>' +
        avHtml(o.avatar, o.name) + '<span class="ya-nm">' + esc(o.name) + (o.cls ? '<span class="ya-chip">' + esc(o.cls) + '</span>' : '') + '</span>' +
        '<span class="ya-xp">' + o.xp + '<small>XP</small></span></div>';
    }
    function render() {
      if (!data) { sc.innerHTML = '<div class="ya-spin"></div>'; pin.innerHTML = ''; return; }
      var list = data[tab] || [];
      if (!list.length) { sc.innerHTML = '<p class="ya-msg">No one on the board yet 🌱</p>'; pin.innerHTML = data.pending ? '<p class="ya-msg">⏳ Your teacher is checking your name. You’ll join the board soon!</p>' : ''; return; }
      var top = list.filter(function (o) { return o.xp > 0; }).slice(0, 3);
      var html = '';
      if (top.length) {
        var order = [top[1], top[0], top[2]], cls = ['ya-p2', 'ya-p1', 'ya-p3'];
        html += '<div class="ya-pod">' + order.map(function (o, i) {
          if (!o) return '<div></div>';
          return '<div class="' + cls[i] + '" data-pid="' + esc(o.pid || '') + '">' + (i === 1 ? '<div class="ya-crown">👑</div>' : '') + avHtml(o.avatar, o.name) +
            '<div class="ya-nm">' + esc(o.name) + (o.me ? ' ⭐' : '') + '</div><div class="ya-xp">' + o.xp + ' XP</div>' +
            '<div class="ya-step">' + o.rank + '</div></div>';
        }).join('') + '</div>';
      }
      html += list.slice(top.length).map(row).join('');
      html = '<p class="ya-hint2">👆 Tap a player to visit their home 🏠</p>' + html;
      if (tab === 'week') html += '<p class="ya-foot">XP per lesson: first-try score + fixes on try 2 + staying focused + 🎯 all correct</p>';
      sc.innerHTML = html;
      var mine = list.filter(function (o) { return o.me; })[0];
      pin.innerHTML = mine ? row(mine) : data.pending ? '<p class="ya-msg" style="padding:10px 4px">⏳ Your teacher is checking your name. You’ll join the board soon!</p>' : '';
    }
    render();
    fetchBoard()
      .then(function (j) {
        if (j.auth) { boardReq = null; close(); return authFailed(opts).then(function () { return board(opts); }); }
        if (!j.ok) throw new Error(j.error || 'error');
        data = j; LS.set(BOARD_CACHE, { at: Date.now(), data: j });
        if (j.me) { var a = auth(); if (a) { a.me = j.me; LS.set(KEY, a); } }
        if (document.body.contains(ov)) render();
      })
      .catch(function () {
        if (!data && document.body.contains(ov)) sc.innerHTML = '<p class="ya-msg">Couldn’t load the leaderboard 😢<br>Check your connection and try again.</p>';
      });
    return Promise.resolve();
  }
  /* ---------------- NHÀ BẠN ---------------- */
  function home(pid, opts) {
    opts = opts || {};
    var ov = overlay('ya-dim', opts.theme); ov.style.zIndex = '2147483002';
    ov.innerHTML = '<div class="ya-card ya-home" role="dialog" aria-label="Player home"><div class="ya-top"><h2 class="ya-h">🏠 Loading…</h2><button class="ya-x" aria-label="Close">✕</button></div><div class="ya-spin"></div></div>';
    var close = function () { ov.remove(); };
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('.ya-x')) close(); });
    var shown = false, old = homeCache(pid);
    if (old) { show(old); shown = true; } // nhà đã xem trước đây → hiện ngay, máy chủ trả lời thì cập nhật
    fetch(SCRIPT_URL + '?action=profile&pid=' + encodeURIComponent(pid) + '&token=' + encodeURIComponent(token()))
      .then(function (r) { return r.json(); })
      .then(function (p) {
        if (!document.body.contains(ov)) return;
        if (!p.ok) throw new Error(p.error || 'error');
        homeCache(pid, p);
        var typing = ov.querySelector('.ya-home input:focus') || [].some.call(ov.querySelectorAll('.ya-home input'), function (i) { return i.value && i.value !== i.defaultValue; });
        if (shown && typing) return; // đang gõ lời nhắn → không vẽ lại kẻo mất chữ
        show(p);
      })
      .catch(function (e) { if (shown) return; var c = ov.querySelector('.ya-home'); if (c) c.innerHTML = '<div class="ya-top"><h2 class="ya-h">🏠</h2><button class="ya-x" aria-label="Close">✕</button></div><p class="ya-msg">Couldn’t open this home 😢<br>' + esc(e.message || '') + '</p>'; });
    function show(p) {
      {
        var m = /^([a-z0-9]+):(\{.*\})$/.exec(String(p.avatar || '')), style = m && m[1], outfit = null;
        try { outfit = m ? JSON.parse(m[2]) : null; } catch (_) {}
        var who = window.YumiAvatar && m ? '<div class="ya-who">' + window.YumiAvatar.html(p.avatar) + '</div>'
          : '<div class="ya-who emo">' + (p.avatar && !/^\//.test(p.avatar) && p.avatar.length < 8 ? esc(p.avatar) : '🙂') + '</div>';
        var st = function (v, l) { return '<div class="ya-stat"><b>' + v + '</b><span>' + l + '</span></div>'; };
        var rk = function (x) { return x && x.rank ? '#' + x.rank : '–'; };
        ov.querySelector('.ya-home').innerHTML = '<div class="ya-top"><h2 class="ya-h">🏠 ' + esc(p.me ? 'My home' : p.name + '’s home') + '</h2><button class="ya-x" aria-label="Close">✕</button></div>' + (p.cls ? '<p class="ya-sub" style="margin:-6px 0 4px">Class ' + esc(p.cls) + '</p>' : '') +
          '<div class="ya-room"><div class="ya-win"></div><div class="ya-lamp">🌙</div><div class="ya-plant">🪴</div><div class="ya-rug"></div>' + who + '</div>' +
          socialTop(p) +
          '<div class="ya-stats">' + st(rk(p.week), 'This week') + st(rk(p.month), 'This month') + st(rk(p.all), 'All time') +
          st((p.all && p.all.xp) || 0, 'Total XP') + st(p.lessons || 0, 'Lessons') + st('🔥 ' + (p.streak || 0), 'Week streak') + '</div>' +
          '<h3 class="ya-h3">🎒 Collection' + (p.owned && p.owned.length ? ' (' + p.owned.length + ')' : '') + '</h3><div class="ya-col" id="ya-col"><span style="opacity:.7;font-size:13px">' + (p.owned && p.owned.length ? 'Loading…' : (p.me ? 'Nothing yet. Earn coins and visit the shop! 🛍️' : 'Nothing yet.')) + '</span></div>' + guestbook(p);
        bindSocial(ov, p, pid, opts);
        if (p.owned && p.owned.length && window.YumiAvatar && style) {
          window.YumiAvatar.load(style).then(function (cat) { // giới tính của nhân vật → đúng hình biểu cảm nam/nữ
            var b = outfit && cat.items[outfit.body], g = b && b.g || '';
            return Promise.all(p.owned.map(function (id) { return window.YumiAvatar.itemThumb(style, id, g); }));
          }).then(function (list) {
            var box = ov.querySelector('#ya-col'); if (!box) return;
            list = list.filter(Boolean);
            box.innerHTML = list.length ? list.map(function (t) { return '<div' + (t.rar === 'x' ? ' class="x"' : '') + '><img src="' + esc(t.url) + '" alt="" loading="lazy">' + esc(t.name) + '</div>'; }).join('')
              : '<span style="opacity:.7;font-size:13px">Nothing yet.</span>';
          });
        }
      }
    }
  }
  // nhà đã xem (theo người xem): giữ 30 nhà gần nhất trên máy
  function homeCache(pid, p) {
    var m = me(), k = 'yumi-homes-' + (m && m.user), all = LS.get(k) || {};
    if (arguments.length < 2) return all[pid] && all[pid].p || null;
    if (p) all[pid] = { p: p, t: Date.now() }; else delete all[pid];
    var ks = Object.keys(all); if (ks.length > 30) ks.sort(function (a, b) { return all[a].t - all[b].t; }).slice(0, ks.length - 30).forEach(function (x) { delete all[x]; });
    LS.set(k, all);
  }
  var REACT_UI = [['like', '❤️', 'Love'], ['haha', '😆', 'Haha'], ['cay', '😤', 'So jealous']];
  function socialTop(p) {
    var s = p.social || { counts: {}, mine: {} };
    var html = '<div class="ya-react">' + REACT_UI.map(function (r) {
      return '<button type="button" data-react="' + r[0] + '"' + (s.mine[r[0]] ? ' class="on"' : '') + (p.me ? ' disabled' : '') + '>' + r[1] + ' ' + (s.counts[r[0]] || 0) + '<small>' + r[2] + '</small></button>';
    }).join('') + '</div>';
    if (p.me) html += '<div class="ya-rn"><button type="button" data-rn>✏️ Change nickname · ' + (p.renamePrice || 300) + ' 🪙</button>' +
      '<form hidden><input maxlength="20" placeholder="New nickname" value="' + esc(p.name) + '"><button type="submit">OK</button></form>' +
      '<div class="ya-gerr"></div><div style="font-size:12px;opacity:.7">You have ' + (p.coins || 0) + ' 🪙 · you can still log in with your old nickname</div></div>';
    return html;
  }
  var ago = function (s) {
    var d = new Date(s + ':00+07:00'), m = Math.round((Date.now() - d) / 60000);
    return isNaN(m) ? '' : m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago';
  };
  function guestbook(p) {
    var cs = (p.social && p.social.comments) || [];
    return '<div class="ya-gb"><h3 class="ya-h3">💬 Guestbook' + (cs.length ? ' (' + cs.length + ')' : '') + '</h3>' +
      '<div class="ya-gbl">' + (cs.length ? cs.map(function (c) {
        return '<div class="c"><b>' + esc(c.name) + '</b><time>' + ago(c.at) + '</time>' + (c.canDel ? '<button class="del" data-del="' + c.cid + '" aria-label="Delete">🗑</button>' : '') + '<div>' + esc(c.text) + '</div></div>';
      }).join('') : '<p style="opacity:.7;font-size:13px;margin:0">' + (p.me ? 'No messages yet. Visit your friends’ homes and say hi! 👋' : 'Be the first to write something nice! ✨') + '</p>') + '</div>' +
      '<form><input maxlength="120" placeholder="' + (p.me ? 'Reply to your visitors…' : 'Write something nice…') + '"><button type="submit">Send</button></form><div class="ya-gerr"></div></div>';
  }
  function bindSocial(ov, p, pid, opts) {
    var card = ov.querySelector('.ya-home'); if (!card) return;
    var redraw = function (social) { p.social = social; homeCache(pid, p); var top = card.querySelector('.ya-react'); var gb = card.querySelector('.ya-gb');
      if (top) top.outerHTML = socialTop(p).replace(/<div class="ya-rn">[\s\S]*$/, ''); if (gb) gb.outerHTML = guestbook(p); bindSocial(ov, p, pid, opts); };
    var call = function (body) { return post(Object.assign({ token: token() }, body)).then(function (j) { if (j.auth) { ov.remove(); authFailed(opts); throw new Error('auth'); } if (!j.ok) throw new Error(j.error || 'error'); return j; }); };
    [].forEach.call(card.querySelectorAll('[data-react]'), function (b) { b.onclick = function () { if (p.me) return; b.disabled = true;
      call({ action: 'react', pid: pid, type: b.dataset.react }).then(function (j) { redraw(j.social); }).catch(function () { b.disabled = false; }); }; });
    var gbf = card.querySelector('.ya-gb form'), gerr = card.querySelector('.ya-gb .ya-gerr');
    if (gbf) gbf.onsubmit = function (e) { e.preventDefault(); var inp = gbf.querySelector('input'), btn = gbf.querySelector('button'); if (!inp.value.trim()) return;
      btn.disabled = true; gerr.textContent = '';
      call({ action: 'comment', pid: pid, text: inp.value }).then(function (j) { redraw(j.social); }).catch(function (ex) { if (ex.message !== 'auth') gerr.textContent = ex.message; btn.disabled = false; }); };
    [].forEach.call(card.querySelectorAll('[data-del]'), function (b) { b.onclick = function () { if (!confirm('Delete this message?')) return;
      call({ action: 'delcomment', cid: b.dataset.del }).then(function (j) { redraw(j.social); }).catch(function (ex) { if (gerr) gerr.textContent = ex.message; }); }; });
    var rn = card.querySelector('[data-rn]');
    if (rn) { var rf = card.querySelector('.ya-rn form'), rerr = card.querySelector('.ya-rn .ya-gerr');
      rn.onclick = function () { rf.hidden = !rf.hidden; if (!rf.hidden) rf.querySelector('input').select(); };
      rf.onsubmit = function (e) { e.preventDefault(); var nick = rf.querySelector('input').value.trim(); if (!nick) return;
        if (!confirm('Change your nickname to "' + nick + '" for ' + (p.renamePrice || 300) + ' coins?')) return;
        rerr.textContent = '';
        call({ action: 'rename', nick: nick }).then(function (j) {
          var a = auth(); if (a) { a.me = Object.assign({}, a.me, j.me || { name: j.name }); LS.set(KEY, a); }
          LS.del(BOARD_CACHE); boardReq = null; homeCache(pid, null); ov.remove(); home(pid, opts);
          var t = document.createElement('div'); t.className = 'ya-ov ya-dim'; t.style.cssText = 'pointer-events:none;align-items:flex-end;background:none'; injectCss();
          t.innerHTML = '<div class="ya-card" style="max-width:320px;text-align:center;font-weight:800">✨ You are now ' + esc(j.name) + '!</div>'; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200);
        }).catch(function (ex) { if (ex.message !== 'auth') rerr.textContent = ex.message; }); };
    }
  }
  function autoBoard(opts) {
    if (!me()) return;
    if (LS.get(DAY_KEY) === today()) return;
    LS.set(DAY_KEY, today());
    setTimeout(function () { board(opts); }, (opts && opts.delay) || 600);
  }
  function trophy(opts) {
    injectCss();
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ya-trophy'; b.innerHTML = '🏆 <span>' + esc((opts && opts.label) || 'Ranking') + '</span>';
    b.onclick = function () { board(opts); };
    return b;
  }

  function setAvatar(av) {
    var a = auth(); if (!a || !av || a.me.avatar === av) return;
    a.me.avatar = av; LS.set(KEY, a);
    post({ action: 'avatar', token: a.token, avatar: av }).catch(function () {});
  }
  function authFailed(opts) {
    var a = auth();
    if (a) LS.set(KEY, { token: '', me: null, last: a.me && (a.me.name || a.me.user) });
    return loginScreen(Object.assign({}, opts || {}, { sub: 'Please log in again to send your work 📨' }));
  }
  function logout() { // gửi nốt tiến độ rồi mới đăng xuất
    var bye = function () { var a = auth(), old = LS.get(LEGACY_KEY); if (old && old.me && a && old.me.user === a.me.user) LS.del(LEGACY_KEY);
      LS.del(KEY); LS.del(BOARD_CACHE); location.reload(); };
    var t = setTimeout(bye, 4000); pushNow(false).then(function () { clearTimeout(t); bye(); }, function () { clearTimeout(t); bye(); });
  }
  if (ready()) syncOnLoad();
  // hôm nay bảng xếp hạng sẽ tự bật → tải sẵn ngay (song song với tiến độ), lúc bật lên đã có dữ liệu
  if (ready() && me() && LS.get(DAY_KEY) !== today()) { try { fetchBoard().catch(function () {}); } catch (_) {} }

  // nạp sẵn avatar.js (nhân vật + tủ đồ) để bảng xếp hạng vẽ được nhân vật
  (function () {
    var src = (document.currentScript ? document.currentScript.src : '');
    var go = function () { try {
      if (window.YumiAvatar || document.querySelector('script[data-yumi-av],script[src*="/avatar/avatar.js"]')) return;
      var s = document.createElement('script'); s.src = new URL('avatar/avatar.js?v=1', src || location.origin + '/').href;
      s.setAttribute('data-yumi-av', '1'); (document.head || document.documentElement).appendChild(s);
    } catch (_) {} };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  })();
  window.YumiAuth = { ready: ready, me: me, token: token, require: requireLogin, login: loginScreen, board: board, autoBoard: autoBoard,
    trophy: trophy, home: home, setAvatar: setAvatar, authFailed: authFailed, logout: logout, avatarHtml: avHtml, url: SCRIPT_URL,
    syncNow: function () { return pushNow(false); },
    setOutfit: function (str) { var a = auth(); if (!a) return; var st = /^([a-z0-9]+):/.exec(str || ''); a.me.avatar = str; if (st) { a.me.outfits = a.me.outfits || {}; a.me.outfits[st[1]] = str; } LS.set(KEY, a); },
    site: SITE_ID };
})();
