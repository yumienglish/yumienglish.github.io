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
  var KEY = 'yumi-auth', DAY_KEY = 'yumi-board-day', BOARD_CACHE = 'yumi-board-cache';

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
  function auth() { var a = LS.get(KEY); return a && a.token && a.me ? a : null; }
  function me() { var a = auth(); return a ? a.me : null; }
  function token() { var a = auth(); return a ? a.token : ''; }

  function post(body) {
    return fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
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
    '.ya-hint{text-align:center;font-size:14px;opacity:.7;margin:10px 0 0}' +
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
    '.ya-av img{width:100%;height:100%;object-fit:cover}' +
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
        '<div class="ya-tabs ya-mode"><button type="button" data-m="in" class="on">Log in</button><button type="button" data-m="new">✨ Tạo tài khoản</button></div>' +
        // ---- đăng nhập ----
        '<form class="ya-f" data-f="in" autocomplete="off">' +
        '<p class="ya-sub">' + esc(opts.sub || 'Log in to save your stars and join the leaderboard 🏆') + '</p>' +
        '<label class="ya-lbl" for="ya-user">Nickname</label>' +
        '<input class="ya-in" id="ya-user" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" maxlength="20" placeholder="Your nickname">' +
        '<label class="ya-lbl">PIN</label>' + pinRow('in', 'PIN') +
        '<p class="ya-err" role="alert"></p>' +
        '<button class="ya-btn" type="submit">Let’s go 🚀</button>' +
        '<p class="ya-hint">Chưa có tài khoản? Bấm <b>✨ Tạo tài khoản</b> ở trên. Quên PIN thì nhắn cô nhé 💬</p>' +
        '</form>' +
        // ---- tạo tài khoản ----
        '<form class="ya-f" data-f="new" autocomplete="off" hidden>' +
        '<p class="ya-sub">Tự đặt nickname và mã PIN của em nhé 🎮</p>' +
        '<label class="ya-lbl" for="ya-nick">Nickname <small>(hiện trên bảng xếp hạng)</small></label>' +
        '<input class="ya-in" id="ya-nick" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="20" placeholder="VD: Sói Con, MinhAnh09">' +
        '<label class="ya-lbl" for="ya-full">Họ và tên thật <small>(chỉ cô thấy)</small></label>' +
        '<input class="ya-in" id="ya-full" autocomplete="name" maxlength="60" placeholder="VD: Nguyễn Minh Anh">' +
        '<label class="ya-lbl" for="ya-cls">Lớp</label>' +
        '<input class="ya-in" id="ya-cls" autocapitalize="characters" maxlength="20" placeholder="' + esc(opts.clsHint || 'VD: KET01') + '">' +
        '<label class="ya-lbl">Mã PIN 4 số <small>(em tự nghĩ, nhớ kĩ nhé)</small></label>' + pinRow('p1', 'PIN') +
        '<label class="ya-lbl">Nhập lại mã PIN</label>' + pinRow('p2', 'Nhập lại PIN') +
        '<p class="ya-err" role="alert"></p>' +
        '<button class="ya-btn" type="submit">Tạo tài khoản ✨</button>' +
        '<p class="ya-hint">Tên thật giúp cô biết em là ai. Bạn bè chỉ thấy nickname 😉</p>' +
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
      var saved = LS.get(KEY) || {}, lastUser = (saved.me && saved.me.name) || saved.last;
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
        resolve(j.me);
      };
      var run = function (f, body, label, onFail) {
        var err = f.querySelector('.ya-err'), btn = f.querySelector('.ya-btn');
        busy = true; btn.disabled = true; btn.textContent = '…'; err.textContent = '';
        post(body).then(function (j) {
          if (!j.ok) { var e = new Error(j.error || 'Không được rồi, em thử lại nhé'); e.field = j.field; throw e; }
          done(j);
        }).catch(function (ex) {
          err.textContent = /fetch|network|Failed/i.test(ex.message) ? 'Mạng yếu, em thử lại nhé' : ex.message;
          onFail(ex.field);
        }).then(function () { busy = false; btn.disabled = false; btn.textContent = label; });
      };
      forms['in'].addEventListener('submit', function (e) {
        e.preventDefault(); if (busy) return;
        var err = forms['in'].querySelector('.ya-err'), pin = pinVal('in');
        if (!user.value.trim()) { err.textContent = 'Em nhập nickname nhé'; user.focus(); return; }
        if (pin.length !== 4) { err.textContent = 'PIN có 4 số nhé'; (pins('in').filter(function (x) { return !x.value; })[0] || pins('in')[0]).focus(); return; }
        run(forms['in'], { action: 'login', user: user.value, pin: pin }, 'Let’s go 🚀', function () { clearPins('in'); shake('in'); pins('in')[0].focus(); });
      });
      forms['new'].addEventListener('submit', function (e) {
        e.preventDefault(); if (busy) return;
        var f = forms['new'], err = f.querySelector('.ya-err');
        var nick = f.querySelector('#ya-nick'), full = f.querySelector('#ya-full'), cls = f.querySelector('#ya-cls');
        var p1 = pinVal('p1'), p2 = pinVal('p2');
        var bad = function (msg, el) { err.textContent = msg; el.focus(); };
        if (nick.value.trim().length < 3) return bad('Nickname cần ít nhất 3 chữ nhé', nick);
        if (full.value.trim().split(/\s+/).length < 2) return bad('Em nhập đủ họ và tên thật nhé', full);
        if (!cls.value.trim()) return bad('Em nhập lớp nhé', cls);
        if (p1.length !== 4) return bad('Mã PIN có 4 số nhé', pins('p1').filter(function (x) { return !x.value; })[0] || pins('p1')[0]);
        if (p1 !== p2) { clearPins('p2'); shake('p2'); return bad('Hai mã PIN chưa giống nhau, em nhập lại nhé', pins('p2')[0]); }
        run(f, { action: 'register', nick: nick.value, full: full.value, cls: cls.value, pin: p1 }, 'Tạo tài khoản ✨', function (field) {
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
    return loginScreen(opts).then(function (m2) { if (opts && opts.onLogin) opts.onLogin(m2); return m2; });
  }

  /* ---------------- BẢNG XẾP HẠNG ---------------- */
  var TABS = [['week', 'This week'], ['month', 'This month'], ['all', 'All time']];
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
    ov.querySelector('.ya-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      tab = b.dataset.t;
      [].forEach.call(ov.querySelectorAll('.ya-tabs button'), function (x) { x.classList.toggle('on', x === b); });
      render();
    });
    function row(o) {
      return '<div class="ya-row' + (o.me ? ' ya-me' : '') + '"><span class="ya-rk">' + (o.rank <= 3 && o.xp > 0 ? ['🥇', '🥈', '🥉'][o.rank - 1] : o.rank) + '</span>' +
        avHtml(o.avatar, o.name) + '<span class="ya-nm">' + esc(o.name) + (o.cls ? '<span class="ya-chip">' + esc(o.cls) + '</span>' : '') + '</span>' +
        '<span class="ya-xp">' + o.xp + '<small>XP</small></span></div>';
    }
    function render() {
      if (!data) { sc.innerHTML = '<div class="ya-spin"></div>'; pin.innerHTML = ''; return; }
      var list = data[tab] || [];
      if (!list.length) { sc.innerHTML = '<p class="ya-msg">Chưa có ai trên bảng 🌱</p>'; pin.innerHTML = data.pending ? '<p class="ya-msg">⏳ Cô đang kiểm tra họ tên của em. Ghép xong em sẽ lên bảng nhé!</p>' : ''; return; }
      var top = list.filter(function (o) { return o.xp > 0; }).slice(0, 3);
      var html = '';
      if (top.length) {
        var order = [top[1], top[0], top[2]], cls = ['ya-p2', 'ya-p1', 'ya-p3'];
        html += '<div class="ya-pod">' + order.map(function (o, i) {
          if (!o) return '<div></div>';
          return '<div class="' + cls[i] + '">' + (i === 1 ? '<div class="ya-crown">👑</div>' : '') + avHtml(o.avatar, o.name) +
            '<div class="ya-nm">' + esc(o.name) + (o.me ? ' ⭐' : '') + '</div><div class="ya-xp">' + o.xp + ' XP</div>' +
            '<div class="ya-step">' + o.rank + '</div></div>';
        }).join('') + '</div>';
      }
      html += list.slice(top.length).map(row).join('');
      if (tab === 'week') html += '<p class="ya-foot">Mỗi bài: % đúng + sửa đúng lần 2 + tập trung không rời trang + 🎯 đúng hết</p>';
      sc.innerHTML = html;
      var mine = list.filter(function (o) { return o.me; })[0];
      pin.innerHTML = mine ? row(mine) : data.pending ? '<p class="ya-msg" style="padding:10px 4px">⏳ Cô đang kiểm tra họ tên của em. Ghép xong em sẽ lên bảng nhé!</p>' : '';
    }
    render();
    fetch(SCRIPT_URL + '?action=board&token=' + encodeURIComponent(token()))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.auth) { close(); return authFailed(opts).then(function () { return board(opts); }); }
        if (!j.ok) throw new Error(j.error || 'error');
        data = j; LS.set(BOARD_CACHE, { at: Date.now(), data: j });
        if (j.me) { var a = auth(); if (a) { a.me = j.me; LS.set(KEY, a); } }
        if (document.body.contains(ov)) render();
      })
      .catch(function () {
        if (!data && document.body.contains(ov)) sc.innerHTML = '<p class="ya-msg">Không tải được bảng xếp hạng 😢<br>Em kiểm tra mạng rồi mở lại nhé.</p>';
      });
    return Promise.resolve();
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
    return loginScreen(Object.assign({}, opts || {}, { sub: 'Em đăng nhập lại để gửi bài nhé 📨' }));
  }
  function logout() { LS.del(KEY); LS.del(BOARD_CACHE); location.reload(); }

  window.YumiAuth = { ready: ready, me: me, token: token, require: requireLogin, login: loginScreen, board: board, autoBoard: autoBoard,
    trophy: trophy, setAvatar: setAvatar, authFailed: authFailed, logout: logout, avatarHtml: avHtml, url: SCRIPT_URL };
})();
