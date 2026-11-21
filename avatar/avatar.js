/* Yumi English – nhân vật đại diện + tủ đồ + shop + rương Exquisite (dùng chung, mỗi lớp 1 bộ nhân vật "style").
 * Nạp SAU yumi-auth.js:  <script src="/avatar/avatar.js?v=1"></script>
 * Danh mục từng bộ: /avatar/<style>/catalog.js  → gọi YumiAvatar.register(style, {w, h, items:{id:{slot,name,price,src,img,x,y,w,h,rar}}})
 *   src: 'free' (có sẵn) | 'shop' (mua bằng xu, shop đổi hàng mỗi tuần) | 'chest' (chỉ có trong rương Exquisite)
 *   img = file PNG/WebP đã cắt sát hình; x,y,w,h = vị trí trên khung gốc w×h (để chồng lớp khớp nhau).
 * API:
 *   YumiAvatar.html(outfitStr, {size, crop:'full'|'head'})  → HTML nhân vật (dùng cho bảng xếp hạng / trang chủ)
 *   YumiAvatar.ensure(opts)   → nếu em chưa có nhân vật bộ này thì mở màn Tạo nhân vật (Promise)
 *   YumiAvatar.open(opts)     → mở Tủ đồ / Shop / Rương. opts = {style, theme, tab}
 *   YumiAvatar.button(opts)   → nút "👕 Tủ đồ" để gắn vào trang chủ
 */
(function () {
  'use strict';
  var BASE = (function () { try { return new URL('.', document.currentScript.src).href; } catch (_) { return '/avatar/'; } })();
  var CATS = {}, LOADING = {};
  var SLOTS = [
    ['hair', '💇', 'Tóc'], ['face', '😊', 'Mặt'], ['top', '👕', 'Áo'], ['bottom', '👖', 'Quần'], ['dress', '👗', 'Váy'],
    ['set', '🎽', 'Set đồ'], ['shoes', '👟', 'Giày'], ['wings', '🪽', 'Cánh'], ['hat', '🧢', 'Mũ'], ['glasses', '🕶️', 'Kính'],
    ['bag', '👜', 'Túi'], ['hand', '🗡️', 'Cầm tay'], ['pet', '🐾', 'Thú cưng'], ['petacc', '🎀', 'Đồ thú cưng']
  ];
  // thứ tự vẽ (dưới → trên)
  var Z = ['wings', 'body', 'bottom', 'shoes', 'top', 'dress', 'set', 'face', 'hair', 'glasses', 'hat', 'bag', 'hand', 'pet', 'petacc'];
  var RAR = { c: 'Thường', r: 'Hiếm', e: 'Sử thi', x: 'Exquisite' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function register(style, cat) { CATS[style] = cat; }
  function load(style) {
    if (CATS[style]) return Promise.resolve(CATS[style]);
    if (LOADING[style]) return LOADING[style];
    LOADING[style] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = BASE + style + '/catalog.js?v=' + (window.YUMI_AV_V || 1);
      s.onload = function () { CATS[style] ? res(CATS[style]) : rej(new Error('catalog')); };
      s.onerror = function () { rej(new Error('catalog')); };
      document.head.appendChild(s);
    });
    return LOADING[style];
  }
  function parse(str) { // "teen:{...}" → {style, o}
    var m = /^([a-z0-9]+):(\{.*\})$/.exec(String(str || ''));
    if (!m) return null;
    try { return { style: m[1], o: JSON.parse(m[2]) }; } catch (_) { return null; }
  }
  function stringify(style, o) { return style + ':' + JSON.stringify(o); }
  /** Bỏ món xung đột: set ⟂ áo/quần/váy; váy ⟂ áo/quần. */
  function normalize(o, slot) {
    o = Object.assign({}, o);
    if (slot === 'set' && o.set) { delete o.top; delete o.bottom; delete o.dress; }
    if (slot === 'dress' && o.dress) { delete o.top; delete o.bottom; delete o.set; }
    if ((slot === 'top' || slot === 'bottom') && o[slot]) { delete o.dress; delete o.set; }
    return o;
  }
  function withDefaults(cat, o) { // ô trống bắt buộc (người, mặt) → món miễn phí đầu tiên
    o = Object.assign({}, o);
    ['body'].forEach(function (slot) { // mặt gốc có sẵn trong người → ô Mặt để trống = mặc định
      if (!o[slot]) { var id = Object.keys(cat.items).filter(function (k) { return cat.items[k].slot === slot && cat.items[k].src === 'free'; })[0]; if (id) o[slot] = id; }
    });
    return o;
  }
  /** Vẽ nhân vật (các lớp ảnh chồng nhau theo % để co giãn theo khung). crop 'head' = chỉ phần đầu (avatar tròn). */
  function render(cat, o, opts) {
    opts = opts || {};
    o = withDefaults(cat, o || {});
    var W = cat.w, H = cat.h, box = opts.crop === 'head' ? (cat.head || { x: W * 0.3, y: 0, w: W * 0.4, h: W * 0.4 }) : { x: 0, y: 0, w: W, h: H };
    var layers = Z.map(function (slot) { var it = o[slot] && cat.items[o[slot]]; return it ? it : null; }).filter(Boolean).map(function (it) {
      return '<img alt="" draggable="false" src="' + esc(BASE + cat.dir + '/' + it.img) + '" style="position:absolute;left:' + ((it.x - box.x) / box.w * 100) + '%;top:' +
        ((it.y - box.y) / box.h * 100) + '%;width:' + (it.w / box.w * 100) + '%;height:' + (it.h / box.h * 100) + '%">';
    }).join('');
    return '<div class="yav' + (opts.crop === 'head' ? ' yav-head' : '') + '" style="position:relative;overflow:hidden;aspect-ratio:' + box.w + '/' + box.h + ';' + (opts.size ? 'width:' + opts.size + 'px;' : 'width:100%;') + '">' + layers + '</div>';
  }
  /** HTML nhân vật từ chuỗi outfit (bảng xếp hạng). Danh mục chưa nạp → chỗ trống, nạp xong tự vẽ lại. */
  function html(str, opts) {
    var p = parse(str); if (!p) return '';
    if (CATS[p.style]) return render(CATS[p.style], p.o, opts);
    var id = 'yav' + Math.random().toString(36).slice(2);
    load(p.style).then(function (cat) { var el = document.getElementById(id); if (el) el.outerHTML = render(cat, p.o, opts); }).catch(function () {});
    return '<div id="' + id + '" class="yav" style="aspect-ratio:1;width:100%"></div>';
  }

  /* ---------------- CSS ---------------- */
  var CSS = '' +
    '.yw-ov{position:fixed;inset:0;z-index:2147483001;background:var(--ya-bg,#120d2b);color:var(--ya-text,#fff);font-family:var(--ya-font,system-ui);overflow-y:auto;-webkit-overflow-scrolling:touch}' +
    '.yw{max-width:980px;margin:0 auto;padding:14px 14px 40px;display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:16px}' +
    '@media(max-width:720px){.yw{grid-template-columns:1fr}.yw-left{position:sticky;top:0;z-index:2;background:var(--ya-bg,#120d2b);padding-bottom:8px}.yw-stage{max-width:210px;margin:0 auto}}' +
    '.yw-top{display:flex;align-items:center;gap:10px;grid-column:1/-1}' +
    '.yw-top h2{flex:1;margin:0;font-family:var(--ya-head,inherit);font-size:26px}' +
    '.yw-coin{font-weight:800;font-size:18px;background:linear-gradient(135deg,#ffcf3f,#ff9f1c);color:#3b2300;border-radius:99px;padding:6px 14px;white-space:nowrap}' +
    '.yw-x{border:0;background:rgba(255,255,255,.12);color:inherit;width:42px;height:42px;border-radius:50%;font-size:20px;cursor:pointer}' +
    '.yw-stage{background:radial-gradient(circle at 50% 40%,rgba(255,255,255,.18),rgba(255,255,255,.03) 70%);border-radius:22px;padding:6px;position:relative}' +
    '.yw-stat{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px;font-size:13px}' +
    '.yw-stat span{background:rgba(255,255,255,.1);border-radius:99px;padding:3px 10px}' +
    '.yw-save{display:block;width:100%;margin-top:10px;border:0;border-radius:14px;padding:12px;font:inherit;font-weight:800;font-size:18px;color:#fff;cursor:pointer;background:linear-gradient(135deg,var(--ya-acc,#ff2e88),var(--ya-acc2,#8f6cf6))}' +
    '.yw-save[disabled]{opacity:.5;cursor:default}' +
    '.yw-tabs{display:flex;gap:6px;background:rgba(255,255,255,.08);padding:5px;border-radius:14px;margin-bottom:10px}' +
    '.yw-tabs button{flex:1;border:0;background:none;color:inherit;font:inherit;font-weight:700;padding:9px 4px;border-radius:10px;cursor:pointer;opacity:.7}' +
    '.yw-tabs button.on{opacity:1;background:linear-gradient(135deg,var(--ya-acc,#ff2e88),var(--ya-acc2,#8f6cf6));color:#fff}' +
    '.yw-slots{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px;scrollbar-width:none}' +
    '.yw-slots button{flex:none;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:inherit;font:inherit;font-size:13px;padding:6px 10px;border-radius:99px;cursor:pointer;white-space:nowrap}' +
    '.yw-slots button.on{background:#fff;color:#111}' +
    '.yw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px}' +
    '.yw-it{position:relative;border:2px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);border-radius:16px;padding:6px 6px 8px;cursor:pointer;text-align:center;color:inherit;font:inherit}' +
    '.yw-it.on{border-color:var(--ya-acc,#ff2e88);box-shadow:0 0 0 3px rgba(255,46,136,.3)}' +
    '.yw-it .yw-th{aspect-ratio:1;display:flex;align-items:center;justify-content:center;overflow:hidden}' +
    '.yw-it .yw-th img{max-width:100%;max-height:100%;object-fit:contain}' +
    '.yw-it b{display:block;font-size:12.5px;line-height:1.25;margin-top:4px}' +
    '.yw-it small{display:block;font-size:12px;opacity:.85;margin-top:2px}' +
    '.yw-it .yw-lock{position:absolute;top:6px;right:6px;font-size:14px}' +
    '.yw-r-r{border-color:#4fc3f7}.yw-r-e{border-color:#b388ff}.yw-r-x{border-color:#ffd54f;background:linear-gradient(160deg,rgba(255,213,79,.18),rgba(255,255,255,.04))}' +
    '.yw-buy{margin-top:6px;border:0;border-radius:10px;padding:6px 8px;font:inherit;font-weight:800;font-size:13px;cursor:pointer;background:linear-gradient(135deg,#ffcf3f,#ff9f1c);color:#3b2300;width:100%}' +
    '.yw-buy[disabled]{opacity:.45;cursor:default}' +
    '.yw-note{font-size:13px;opacity:.8;margin:4px 0 12px}' +
    '.yw-chest{text-align:center;padding:10px}' +
    '.yw-chest .yw-box{font-size:96px;line-height:1;display:inline-block;filter:drop-shadow(0 0 18px rgba(255,213,79,.7))}' +
    '.yw-chest .yw-box.shake{animation:yw-sh .6s infinite}@keyframes yw-sh{25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}' +
    '.yw-chest .yw-got{max-width:220px;margin:10px auto;animation:yw-pop .5s cubic-bezier(.2,1.5,.5,1)}@keyframes yw-pop{from{transform:scale(.3);opacity:0}}' +
    '.yw-chest .yw-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px}' +
    '.yw-chest .yw-btns button{border:0;border-radius:14px;padding:12px 16px;font:inherit;font-weight:800;cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--ya-acc,#ff2e88),var(--ya-acc2,#8f6cf6))}' +
    '.yw-chest .yw-btns button[disabled]{opacity:.45;cursor:default}' +
    '.yw-earn{font-size:13.5px;line-height:1.6;background:rgba(255,255,255,.06);border-radius:14px;padding:10px 14px;margin-top:14px}' +
    '.yw-earn b{color:#ffcf3f}' +
    '.yw-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 16px;border-radius:12px;z-index:2147483002;font-weight:700;max-width:90vw;text-align:center}' +
    '.yav-head{border-radius:50%}';
  function injectCss() { if (document.getElementById('yw-css')) return; var s = document.createElement('style'); s.id = 'yw-css'; s.textContent = CSS; document.head.appendChild(s); }

  /* ---------------- máy chủ ---------------- */
  var A = function () { return window.YumiAuth; };
  function api(body) {
    body.token = A().token();
    return fetch(A().url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }
  function wallet(style) {
    return fetch(A().url + '?action=wallet&style=' + encodeURIComponent(style) + '&token=' + encodeURIComponent(A().token())).then(function (r) { return r.json(); });
  }
  function toast(msg) { var t = document.createElement('div'); t.className = 'yw-toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  function myOutfit(style) {
    var me = A() && A().me(); var p = me && parse(me.avatar);
    return p && p.style === style ? p.o : null;
  }
  function setMyOutfit(str) { try { var a = JSON.parse(localStorage.getItem('yumi-auth')); if (a && a.me) { a.me.avatar = str; localStorage.setItem('yumi-auth', JSON.stringify(a)); } } catch (_) {} }

  /* ---------------- Tủ đồ / Shop / Rương ---------------- */
  function open(opts) {
    opts = opts || {};
    var style = opts.style || 'teen', creating = !!opts.create;
    injectCss();
    return load(style).then(function (cat) {
      return new Promise(function (resolve) {
        var ov = document.createElement('div'); ov.className = 'yw-ov';
        var th = opts.theme || {};
        ['bg', 'text', 'acc', 'acc2', 'font', 'head'].forEach(function (k) { if (th[k]) ov.style.setProperty('--ya-' + k, th[k]); });
        document.body.appendChild(ov);
        try { document.documentElement.style.overflow = 'hidden'; } catch (_) {}
        var W = null, tab = creating ? 'wardrobe' : (opts.tab || 'wardrobe'), slot = 'hair', busy = false, got = null;
        var saved = myOutfit(style) || {}, cur = withDefaults(cat, saved);
        if (creating) ['hair', 'top', 'bottom', 'shoes'].forEach(function (s) { // tạo lần đầu: mặc sẵn đồ cơ bản, em đổi tuỳ thích
          if (cur[s]) return; var id = Object.keys(cat.items).filter(function (k) { return cat.items[k].slot === s && cat.items[k].src === 'free'; })[0]; if (id) cur[s] = id; });
        var items = function (f) { return Object.keys(cat.items).filter(function (id) { return f(cat.items[id], id); }); };
        var owns = function (id) { var it = cat.items[id]; return it.src === 'free' || (W && W.owned.indexOf(id) >= 0); };
        var thumb = function (it) { return '<div class="yw-th"><img loading="lazy" alt="" src="' + esc(BASE + cat.dir + '/' + (it.thumb || it.img)) + '"></div>'; };
        function close(v) { ov.remove(); try { document.documentElement.style.overflow = ''; } catch (_) {} resolve(v); }
        function draw() {
          var dirty = JSON.stringify(cur) !== JSON.stringify(withDefaults(cat, saved));
          var h = '<div class="yw"><div class="yw-top"><h2>' + (creating ? '✨ Tạo nhân vật' : '👕 Tủ đồ') + '</h2>' +
            '<span class="yw-coin">🪙 ' + (W ? W.coins : '…') + '</span>' + (creating ? '' : '<button class="yw-x" data-x aria-label="Đóng">✕</button>') + '</div>' +
            '<div class="yw-left"><div class="yw-stage">' + render(cat, cur) + '</div>' +
            (W ? '<div class="yw-stat"><span>🔥 Chuỗi ' + W.streak + ' tuần' + (W.mult > 1 ? ' (×' + W.mult + ' xu)' : '') + '</span><span>🎁 ' + W.freeChests + ' rương tặng</span></div>' : '') +
            '<button class="yw-save" data-save ' + (dirty || creating ? '' : 'disabled') + '>' + (creating ? 'Xong, vào chơi! 🚀' : '💾 Lưu nhân vật') + '</button></div><div class="yw-right">';
          if (!creating) h += '<div class="yw-tabs"><button data-t="wardrobe"' + (tab === 'wardrobe' ? ' class="on"' : '') + '>👕 Tủ đồ</button><button data-t="shop"' + (tab === 'shop' ? ' class="on"' : '') +
            '>🛍️ Shop tuần này</button><button data-t="chest"' + (tab === 'chest' ? ' class="on"' : '') + '>💎 Rương</button></div>';
          if (tab === 'wardrobe') {
            var slots = SLOTS.filter(function (s) { return items(function (it, id) { return it.slot === s[0] && (owns(id) || creating && it.src === 'free'); }).length; });
            if (!slots.some(function (s) { return s[0] === slot; }) && slots[0]) slot = slots[0][0];
            h += '<div class="yw-slots">' + slots.map(function (s) { return '<button data-s="' + s[0] + '"' + (s[0] === slot ? ' class="on"' : '') + '>' + s[1] + ' ' + s[2] + '</button>'; }).join('') + '</div>';
            var mine = items(function (it, id) { return it.slot === slot && owns(id); });
            var opt = slot !== 'body' && slot !== 'hair';
            h += '<div class="yw-grid">' + (opt ? '<button class="yw-it' + (!cur[slot] ? ' on' : '') + '" data-eq=""><div class="yw-th" style="font-size:34px">' + (slot === 'face' ? '🙂' : '🚫') + '</div><b>' + (slot === 'face' ? 'Mặc định' : 'Bỏ ra') + '</b></button>' : '') +
              mine.map(function (id) { var it = cat.items[id];
                return '<button class="yw-it yw-r-' + (it.rar || 'c') + (cur[slot] === id ? ' on' : '') + '" data-eq="' + id + '">' + thumb(it) + '<b>' + esc(it.name) + '</b></button>'; }).join('') + '</div>';
            if (!creating) h += '<p class="yw-note">Muốn thêm đồ? Vào 🛍️ Shop hoặc mở 💎 Rương nhé!</p>';
            else h += '<p class="yw-note">Đây là đồ cơ bản. Làm bài tập để kiếm 🪙 mua thêm đồ xịn ở shop nhé!</p>';
          } else if (tab === 'shop') {
            if (!W) h += '<p class="yw-note">Đang tải shop…</p>';
            else {
              h += '<p class="yw-note">Shop đổi hàng mỗi thứ Hai. Bấm vào món để mặc thử, đủ xu thì mua.</p><div class="yw-grid">' + W.shop.filter(function (id) { return cat.items[id]; }).map(function (id) {
                var it = cat.items[id], have = W.owned.indexOf(id) >= 0;
                return '<div class="yw-it yw-r-' + (it.rar || 'c') + (cur[it.slot] === id ? ' on' : '') + '" data-try="' + id + '">' + thumb(it) + '<b>' + esc(it.name) + '</b><small>' + (RAR[it.rar] || '') + '</small>' +
                  (have ? '<button class="yw-buy" disabled>✔ Đã có</button>' : '<button class="yw-buy" data-buy="' + id + '" ' + (busy || W.coins < it.price ? 'disabled' : '') + '>🪙 ' + it.price + '</button>') + '</div>';
              }).join('') + '</div>';
            }
          } else {
            var left = items(function (it, id) { return it.src === 'chest' && !(W && W.owned.indexOf(id) >= 0); }).length;
            h += '<div class="yw-chest">' + (got ? '<div class="yw-got">' + thumb(cat.items[got]) + '<b>👑 ' + esc(cat.items[got].name) + '</b></div>' : '<div class="yw-box' + (busy ? ' shake' : '') + '">💎</div>') +
              '<p class="yw-note">Rương Exquisite chứa đồ <b>độc quyền</b> không bán ở shop, và luôn ra món em chưa có. Còn ' + left + ' món chưa mở.</p>' +
              '<div class="yw-btns"><button data-chest="free" ' + (busy || !W || !W.freeChests || !left ? 'disabled' : '') + '>🎁 Mở rương tặng (' + (W ? W.freeChests : 0) + ')</button>' +
              '<button data-chest="coins" ' + (busy || !W || W.coins < W.chestPrice || !left ? 'disabled' : '') + '>🪙 ' + (W ? W.chestPrice : 600) + ' xu</button></div>' +
              '<p class="yw-note">Rương tặng: cứ 5 bài tập → 1 rương, cứ 3 bài đúng hết ngay lần 1 → 1 rương.</p></div>';
          }
          if (!creating) h += '<div class="yw-earn"><b>Cách kiếm 🪙</b><br>📚 Mỗi bài tập: 30 xu nộp bài + đến 50 xu theo % đúng lần 1<br>✏️ Sửa đúng hết ở lần 2: +20 · 🎯 Không rời trang: +10 · 💯 Đúng hết ngay: +20<br>' +
            '🔥 Tuần nào cũng nộp bài: xu ×1.2 → ×1.5<br>🎮 Mini game ôn từ: +5 xu/lượt (3 lượt/ngày)</div>';
          ov.innerHTML = h + '</div></div>';
          bind();
        }
        function bind() {
          var q = function (s) { return [].slice.call(ov.querySelectorAll(s)); };
          q('[data-x]').forEach(function (b) { b.onclick = function () { if (JSON.stringify(cur) !== JSON.stringify(withDefaults(cat, saved)) && !confirm('Em chưa lưu nhân vật. Thoát luôn?')) return; close(); }; });
          q('[data-t]').forEach(function (b) { b.onclick = function () { tab = b.dataset.t; got = null; draw(); }; });
          q('[data-s]').forEach(function (b) { b.onclick = function () { slot = b.dataset.s; draw(); }; });
          q('[data-eq]').forEach(function (b) { b.onclick = function () { var id = b.dataset.eq; if (id) { cur[slot] = id; cur = normalize(cur, slot); } else delete cur[slot]; draw(); }; });
          q('[data-try]').forEach(function (b) { b.onclick = function (e) { if (e.target.closest('[data-buy]')) return; var it = cat.items[b.dataset.try]; cur[it.slot] = b.dataset.try; cur = normalize(cur, it.slot); draw(); }; });
          q('[data-buy]').forEach(function (b) { b.onclick = function () {
            var id = b.dataset.buy, it = cat.items[id];
            if (!confirm('Mua "' + it.name + '" với ' + it.price + ' xu?')) return;
            busy = true; draw();
            api({ action: 'buy', style: style, item: id }).then(function (j) {
              if (j.auth) return A().authFailed({}).then(function () { busy = false; draw(); });
              if (!j.ok) throw new Error(j.error); W = j; cur[it.slot] = id; cur = normalize(cur, it.slot); toast('🎉 Đã mua ' + it.name + '! Nhớ bấm Lưu nhân vật nhé');
            }).catch(function (e) { toast(e.message); }).then(function () { busy = false; draw(); });
          }; });
          q('[data-chest]').forEach(function (b) { b.onclick = function () {
            var pay = b.dataset.chest;
            if (pay === 'coins' && !confirm('Mở rương với ' + W.chestPrice + ' xu?')) return;
            busy = true; got = null; draw();
            var t0 = Date.now();
            api({ action: 'chest', style: style, pay: pay }).then(function (j) {
              if (!j.ok) throw new Error(j.error);
              return new Promise(function (r) { setTimeout(r, Math.max(0, 1400 - (Date.now() - t0))); }).then(function () { W = j; got = j.got; var it = cat.items[j.got]; cur[it.slot] = j.got; cur = normalize(cur, it.slot); });
            }).catch(function (e) { toast(e.message); }).then(function () { busy = false; draw(); });
          }; });
          q('[data-save]').forEach(function (b) { b.onclick = function () {
            b.disabled = true; b.textContent = '…';
            var o = Object.assign({}, cur);
            api({ action: 'outfit', style: style, outfit: o }).then(function (j) {
              if (j.auth) return A().authFailed({}).then(function () { draw(); });
              if (!j.ok) throw new Error(j.error);
              saved = parse(j.outfit).o; setMyOutfit(j.outfit); toast('✅ Đã lưu nhân vật!');
              if (creating) close(j.outfit); else draw();
              if (opts.onSave) opts.onSave(j.outfit);
            }).catch(function (e) { toast(e.message || 'Không lưu được, thử lại nhé'); draw(); });
          }; });
        }
        draw();
        wallet(style).then(function (j) { if (j.ok) { W = j; draw(); } else if (j.auth) { A().authFailed({}).then(function () { return wallet(style); }).then(function (k) { if (k && k.ok) { W = k; draw(); } }); } }).catch(function () {});
      });
    });
  }
  /** Lần đầu: chưa có nhân vật bộ này → bắt tạo (chỉ đồ miễn phí). */
  function ensure(opts) {
    opts = opts || {};
    var style = opts.style || 'teen';
    if (!A() || !A().me() || myOutfit(style)) return Promise.resolve(null);
    return open(Object.assign({}, opts, { create: true }));
  }
  function button(opts) {
    injectCss();
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ya-trophy'; b.style.background = 'linear-gradient(135deg,#7c4dff,#ff2e88)';
    b.innerHTML = '👕 <span>' + esc((opts && opts.label) || 'Tủ đồ') + '</span>';
    b.onclick = function () { open(opts); };
    return b;
  }
  /** Mini game xong 1 lượt → +5 xu (máy chủ giới hạn 3 lượt/ngày). */
  function gamePlayed(name) {
    if (!A() || !A().token()) return Promise.resolve(null);
    return api({ action: 'game', game: name || '' }).then(function (j) { if (j && j.added) toast('🪙 +' + j.added + ' xu (mini game)'); return j; }).catch(function () { return null; });
  }
  window.YumiAvatar = { register: register, load: load, html: html, render: render, open: open, ensure: ensure, button: button, gamePlayed: gamePlayed, parse: parse, SLOTS: SLOTS };
})();
