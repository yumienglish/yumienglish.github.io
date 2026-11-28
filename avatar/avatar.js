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
    ['body', '🧑', 'Boy / Girl'], ['hair', '💇', 'Hair'], ['face', '😊', 'Face'], ['top', '👕', 'Tops'], ['bottom', '👖', 'Bottoms'], ['dress', '👗', 'Dresses'],
    ['set', '🎽', 'Outfits'], ['shoes', '👟', 'Shoes'], ['wings', '🪽', 'Wings'], ['hat', '🧢', 'Hats'], ['glasses', '🕶️', 'Glasses'],
    ['bag', '👜', 'Bags'], ['hand', '🎸', 'In hand'], ['pet', '🐾', 'Pets'], ['petacc', '🎀', 'Pet items']
  ];
  // nhóm lọc trong Shop (gộp nhiều ô cho ít nút, dễ tìm) – 'all' và 'new' là nhóm đặc biệt
  var SHOP_CATS = [
    ['all', '✨', 'All'], ['new', '🆕', 'New'], ['look', '💇', 'Hair & Face', ['hair', 'face']],
    ['clothes', '👕', 'Clothes', ['top', 'bottom', 'dress', 'set']], ['shoes', '👟', 'Shoes', ['shoes']],
    ['acc', '🧢', 'Accessories', ['hat', 'glasses', 'bag', 'hand']], ['pets', '🐾', 'Pets', ['pet', 'petacc']], ['wings', '🪽', 'Wings', ['wings']]
  ];
  // thứ tự vẽ (dưới → trên)
  var Z = ['wings', 'body', 'bottom', 'shoes', 'top', 'dress', 'set', 'face', 'hair', 'glasses', 'hat', 'bag', 'hand', 'pet', 'petacc'];
  var RAR = { c: 'Common', r: 'Rare', e: 'Epic', x: 'Exquisite' };
  // Sự kiện (khớp AV_EVENTS trong Code.gs): đồ giới hạn thời gian
  var EVENTS = [{ id: 'xmas', icon: '🎄', name: 'Christmas Event', start: '2026-12-01', end: '2026-12-31' }];
  var todayStr = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  var eventNow = function () { var t = todayStr(); return EVENTS.filter(function (e) { return e.start <= t && e.end >= t; })[0] || null; };
  var eventSoon = function () { var t = new Date(), lim = new Date(t.getTime() + 10 * 86400000); return EVENTS.filter(function (e) { return new Date(e.start + 'T00:00:00') > t && new Date(e.start + 'T00:00:00') <= lim; })[0] || null; };
  var daysTo = function (e) { return Math.max(1, Math.ceil((new Date(e.start + 'T00:00:00') - new Date()) / 86400000)); };
  var daysLeft = function (e) { return Math.max(0, Math.round((new Date(e.end + 'T23:59:59') - new Date()) / 86400000)); };
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
  function genderOf(cat, o) { var b = o && o.body && cat.items[o.body]; return b && b.g || ''; } // 'm' | 'f' | ''
  function fitG(it, g) { return !it.g || !g || it.g === g; }
  function variant(it, g) { var v = it.imgs && it.imgs[g]; return v ? Object.assign({}, it, v) : it; } // biểu cảm: hình riêng theo thân
  function withDefaults(cat, o) { // ô trống bắt buộc (người, mặt) → món miễn phí đầu tiên
    o = Object.assign({}, o);
    ['body'].forEach(function (slot) { // mặt gốc có sẵn trong người → ô Mặt để trống = mặc định
      if (!o[slot]) { var id = Object.keys(cat.items).filter(function (k) { return cat.items[k].slot === slot && cat.items[k].src === 'free' && !cat.items[k].hide; })[0]; if (id) o[slot] = id; }
    });
    return o;
  }
  /** Vẽ nhân vật (các lớp ảnh chồng nhau theo % để co giãn theo khung). crop 'head' = chỉ phần đầu (avatar tròn). */
  function headBox(cat) { return cat.head || { x: cat.w * 0.3, y: 0, w: cat.w * 0.4, h: cat.w * 0.4 }; }
  /** Các lớp ảnh (dưới → trên) của 1 bộ đồ. */
  function layersOf(cat, o) {
    o = withDefaults(cat, o || {});
    var g = genderOf(cat, o);
    var held = o.hand && cat.items[o.hand]; // món cầm tay vẽ cả bàn tay mới → thân dùng ảnh không có bàn tay phải (tránh 2 bàn tay)
    return Z.map(function (slot) { var it = o[slot] && cat.items[o[slot]];
      if (it && slot === 'body' && held && held.nohand && it.nohand) it = Object.assign({}, it, { img: it.nohand });
      return it ? variant(it, g) : null; }).filter(Boolean);
  }
  function render(cat, o, opts) {
    opts = opts || {};
    var W = cat.w, H = cat.h, box = opts.crop === 'head' ? headBox(cat) : { x: 0, y: 0, w: W, h: H };
    var layers = layersOf(cat, o).map(function (it) {
      return '<img alt="" draggable="false" src="' + esc(BASE + cat.dir + '/' + it.img) + '" style="position:absolute;left:' + ((it.x - box.x) / box.w * 100) + '%;top:' +
        ((it.y - box.y) / box.h * 100) + '%;width:' + (it.w / box.w * 100) + '%;height:' + (it.h / box.h * 100) + '%">';
    }).join('');
    return '<div class="yav' + (opts.crop === 'head' ? ' yav-head' : '') + '" style="position:relative;overflow:hidden;aspect-ratio:' + box.w + '/' + box.h + ';' + (opts.size ? 'width:' + opts.size + 'px;' : 'width:100%;') + '">' + layers + '</div>';
  }
  /** HTML nhân vật từ chuỗi outfit (bảng xếp hạng). Danh mục chưa nạp → chỗ trống, nạp xong tự vẽ lại. */
  /* Đầu nhân vật (bảng xếp hạng, trang chủ): ghép các lớp thành 1 ảnh nhỏ 128px rồi nhớ lại → mỗi bạn 1 ảnh nhỏ thay vì 5–8 lớp ảnh lớn. */
  var HEAD_PX = 128, HEAD_VER = 'h2', HKEY = 'yumi-heads', HMAX = 60, HMEM = {}, HPEND = {}, IMGS = {};
  var canHead = (function () { try { var c = document.createElement('canvas'); return !!(c.getContext && c.getContext('2d')); } catch (_) { return false; } })();
  function headStore() { try { return JSON.parse(localStorage.getItem(HKEY)) || {}; } catch (_) { return {}; } }
  function headGet(k) {
    if (HMEM[k]) return HMEM[k];
    var s = headStore(); if (s[k] && s[k].u) { HMEM[k] = s[k].u; return s[k].u; }
    return null;
  }
  function headPut(k, u, onlyStore) {
    if (!onlyStore) HMEM[k] = u;
    if (!/^data:image\/webp/.test(u) || u.length > 20000) return; // chỉ lưu bản webp nhỏ (iPhone chưa xuất được webp → chỉ nhớ trong lúc mở trang)
    try { var s = headStore(); s[k] = { u: u, t: Date.now() }; var ks = Object.keys(s);
      if (ks.length > HMAX) ks.sort(function (a, b) { return s[a].t - s[b].t; }).slice(0, ks.length - HMAX).forEach(function (x) { delete s[x]; });
      localStorage.setItem(HKEY, JSON.stringify(s)); } catch (_) {}
  }
  function loadImg(src) { // giải mã ảnh ở luồng phụ (decode) → lúc vẽ canvas không bị khựng
    return IMGS[src] || (IMGS[src] = new Promise(function (res, rej) { var i = new Image(); i.decoding = 'async';
      i.onload = function () { if (i.decode) i.decode().then(function () { res(i); }, function () { res(i); }); else res(i); };
      i.onerror = function () { delete IMGS[src]; rej(new Error('img')); }; i.src = src; }));
  }
  var hq = Promise.resolve(); // ghép lần lượt từng đầu, nghỉ 1 nhịp giữa các đầu → không dồn việc làm đứng màn hình
  function nextTick() { return new Promise(function (r) { (window.requestAnimationFrame || setTimeout)(function () { setTimeout(r, 0); }); }); }
  function headUrl(cat, o) {
    var box = headBox(cat), L = layersOf(cat, o);
    return Promise.all(L.map(function (l) { return loadImg(BASE + cat.dir + '/' + l.img); })).then(function (ims) {
      var job = hq.then(nextTick).then(function () { return draw(ims); }); hq = job.catch(function () {}); return job;
    });
    function draw(ims) {
      var c = document.createElement('canvas'); c.width = c.height = HEAD_PX; var x = c.getContext('2d');
      x.imageSmoothingEnabled = true; try { x.imageSmoothingQuality = 'medium'; } catch (_) {} // 'high' chậm gấp 6 lần, ở 128px nhìn như nhau
      var kx = HEAD_PX / box.w, ky = HEAD_PX / box.h;
      ims.forEach(function (im, i) { var l = L[i]; x.drawImage(im, (l.x - box.x) * kx, (l.y - box.y) * ky, l.w * kx, l.h * ky); });
      // nén ảnh ở luồng phụ (toBlob) → hiện bằng blob URL; bản webp đổi sang chuỗi để lưu (lúc rảnh)
      if (c.toBlob && window.URL && URL.createObjectURL) return new Promise(function (res) {
        c.toBlob(function (b) {
          if (!b) { res({ show: c.toDataURL('image/png') }); return; }
          var keep = null;
          if (b.type === 'image/webp' && window.FileReader) keep = new Promise(function (r) { var f = new FileReader(); f.onload = function () { r(String(f.result)); }; f.onerror = function () { r(null); }; f.readAsDataURL(b); });
          res({ show: URL.createObjectURL(b), keep: keep });
        }, 'image/webp', 0.82);
      });
      return { show: c.toDataURL('image/png') };
    }
  }
  function headHtml(u, opts) {
    return '<div class="yav yav-head" style="position:relative;overflow:hidden;aspect-ratio:1/1;' + (opts.size ? 'width:' + opts.size + 'px;' : 'width:100%;') + '">' +
      '<img alt="" draggable="false" src="' + esc(u) + '" style="display:block;width:100%;height:100%"></div>';
  }
  function headLater(p, str, opts) { // chỗ trống → ghép xong thì thay (cùng 1 nhân vật chỉ ghép 1 lần)
    var k = HEAD_VER + '.' + (window.YUMI_AV_V || 1) + '|' + str, id = 'yav' + Math.random().toString(36).slice(2);
    var job = HPEND[k] || (HPEND[k] = load(p.style).then(function (cat) { return headUrl(cat, p.o); }).then(function (r) {
      HMEM[k] = r.show; delete HPEND[k];
      if (r.keep) r.keep.then(function (u) { if (u) headPut(k, u, true); }); else if (/^data:image\/webp/.test(r.show)) headPut(k, r.show, true);
      return r.show; },
      function (e) { delete HPEND[k]; throw e; }));
    job.then(function (u) { var el = document.getElementById(id); if (el) el.outerHTML = headHtml(u, opts); },
      function () { load(p.style).then(function (cat) { var el = document.getElementById(id); if (el) el.outerHTML = render(cat, p.o, opts); }).catch(function () {}); }); // lỗi → vẽ kiểu cũ
    return '<div id="' + id + '" class="yav yav-head" style="aspect-ratio:1/1;' + (opts.size ? 'width:' + opts.size + 'px;' : 'width:100%;') + '"></div>';
  }
  function html(str, opts) {
    var p = parse(str); if (!p) return '';
    opts = opts || {};
    if (opts.crop === 'head' && canHead) {
      var u = headGet(HEAD_VER + '.' + (window.YUMI_AV_V || 1) + '|' + str);
      return u ? headHtml(u, opts) : headLater(p, str, opts);
    }
    if (CATS[p.style]) return render(CATS[p.style], p.o, opts);
    var id = 'yav' + Math.random().toString(36).slice(2);
    load(p.style).then(function (cat) { var el = document.getElementById(id); if (el) el.outerHTML = render(cat, p.o, opts); }).catch(function () {});
    return '<div id="' + id + '" class="yav" style="aspect-ratio:1;width:100%"></div>';
  }

  /* ---------------- CSS ---------------- */
  var CSS = '' +
    '.yw-ov{position:fixed;inset:0;z-index:2147483001;background:var(--ya-bg,#120d2b);color:var(--ya-text,#fff);font-family:var(--ya-font,system-ui);overflow-y:auto;-webkit-overflow-scrolling:touch}' +
    '.yw{max-width:980px;margin:0 auto;padding:14px 14px 40px;display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:16px}' +
    '.yw>div{min-width:0}.yw-top{min-width:0}' +
    '@media(max-width:720px){.yw{grid-template-columns:minmax(0,1fr)}.yw-left{position:sticky;top:0;z-index:2;background:var(--ya-bg,#120d2b);padding-bottom:8px}.yw-stage{max-width:210px;margin:0 auto}}' +
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
    '.yw-cats{flex-wrap:wrap;overflow:visible}.yw-cats button{font-weight:700}.yw-cats button i{font-style:normal;opacity:.6;font-weight:600;margin-left:4px}' +
    '.yw-cn{display:inline-block;margin-left:5px;background:linear-gradient(135deg,#ff2e88,#ffb300);color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:99px;vertical-align:1px;animation:yw-pulse 1.6s ease-in-out infinite}' +
    '@keyframes yw-pulse{50%{transform:scale(1.12)}}' +
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
    '.yw-it.lock{opacity:.55;cursor:default}.yw-it.lock .yw-th{filter:grayscale(.6)}.yw-need{display:block;margin-top:6px;font-size:12px;font-weight:700;color:#ffcf3f}' +
    '.yw-new{position:absolute;top:6px;left:6px;background:linear-gradient(135deg,#ff2e88,#ffb300);color:#fff;font-size:11px;font-weight:800;padding:2px 7px;border-radius:99px}' +
    '.yw-acts{display:flex;gap:6px;margin-top:6px}.yw-acts button{flex:1;border:0;border-radius:10px;padding:7px 4px;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer}' +
    '.yw-acts .yw-tryb{background:rgba(255,255,255,.16);color:inherit}.yw-acts .yw-buyb{background:linear-gradient(135deg,#ffcf3f,#ff9f1c);color:#3b2300}' +
    '.yw-note{font-size:13px;opacity:.8;margin:4px 0 12px}' +
    '.yw-chest{text-align:center;padding:10px}' +
    '.yw-chest .yw-box{font-size:96px;line-height:1;display:inline-block;filter:drop-shadow(0 0 18px rgba(255,213,79,.7))}' +
    '.yw-chest .yw-box.shake{animation:yw-sh .6s infinite}@keyframes yw-sh{25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}' +
    '.yw-chest .yw-got{max-width:220px;margin:10px auto;animation:yw-pop .5s cubic-bezier(.2,1.5,.5,1)}@keyframes yw-pop{from{transform:scale(.3);opacity:0}}' +
    '.yw-chest .yw-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px}' +
    '.yw-chest .yw-btns button{border:0;border-radius:14px;padding:12px 16px;font:inherit;font-weight:800;cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--ya-acc,#ff2e88),var(--ya-acc2,#8f6cf6))}' +
    '.yw-chest .yw-btns button[disabled]{opacity:.45;cursor:default}' +
    '.yw-earn{font-size:13.5px;line-height:1.6;background:rgba(255,255,255,.06);border-radius:14px;padding:10px 14px;margin-top:14px}' +
    '.yw-earn b{color:#ffcf3f}.yw-vi{display:block;font-size:12px;opacity:.7;font-style:italic;margin-top:2px}.yw-earn .yw-vi{margin-top:6px}' +
    '.yw-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 16px;border-radius:12px;z-index:2147483002;font-weight:700;max-width:90vw;text-align:center}' +
    '.yav-head{border-radius:50%}' +
    // giao diện sáng (VD lớp KET): khung/viền tối nhạt thay cho trắng mờ
    '.yw-light .yw-x,.yw-light .yw-stat span,.yw-light .yw-tabs,.yw-light .yw-it,.yw-light .yw-slots button,.yw-light .yw-earn{background:rgba(40,20,90,.06);border-color:rgba(40,20,90,.14)}' +
    '.yw-light .yw-it.on{border-color:var(--ya-acc,#ff2e88)}.yw-light .yw-slots button.on{background:var(--ya-text,#22303c);color:#fff}.yw-light .yw-stage{background:radial-gradient(circle at 50% 40%,#fff,rgba(255,255,255,.4) 70%)}' +
    '.yw-light .yw-earn b{color:#d9480f}.yw-light .yw-need{color:#d9480f}.yw-light .yw-left{background:var(--ya-bg)}' +
    '.yw-ev{background:linear-gradient(135deg,#c62828,#2e7d32);color:#fff;border-radius:14px;padding:10px 12px;margin:0 0 10px;font-weight:800;display:flex;align-items:center;gap:8px}' +
    '.yw-ev small{display:block;font-weight:600;opacity:.9}.yw-ev b{font-size:16px}' +
    '.yw-ltd{position:absolute;top:6px;right:6px;background:#e53935;color:#fff;font-size:10.5px;font-weight:800;padding:2px 6px;border-radius:99px}';
  function injectCss() { if (document.getElementById('yw-css')) return; var s = document.createElement('style'); s.id = 'yw-css'; s.textContent = CSS; document.head.appendChild(s); }

  /* ---------------- máy chủ ---------------- */
  var A = function () { return window.YumiAuth; };
  function api(body) {
    body.token = A().token();
    return fetch(A().url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }
  // ví (xu, shop, đồ đã có) lần trước lưu trên máy → mở tủ đồ hiện ngay, máy chủ trả lời thì cập nhật
  function wkey(style, g) { var m = A() && A().me(); return 'yumi-wallet-' + (m && m.user) + '-' + style + '-' + (g || ''); }
  function wcached(style, g) { try { var j = JSON.parse(localStorage.getItem(wkey(style, g))); return j && j.ok ? j : null; } catch (_) { return null; } }
  function wkeep(style, g, j) { if (j && j.ok && j.shop) { try { localStorage.setItem(wkey(style, g), JSON.stringify(j)); } catch (_) {} } return j; }
  function wallet(style, g) {
    return fetch(A().url + '?action=wallet&style=' + encodeURIComponent(style) + '&g=' + encodeURIComponent(g || '') + '&token=' + encodeURIComponent(A().token()))
      .then(function (r) { return r.json(); }).then(function (j) { return wkeep(style, g, j); });
  }
  function toast(msg) { var t = document.createElement('div'); t.className = 'yw-toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  function myOutfit(style) { // nhân vật bộ này (mỗi bộ teen / ket lưu riêng)
    var me = A() && A().me(); if (!me) return null;
    var p = me.outfits && me.outfits[style] ? parse(me.outfits[style]) : null;
    if (p && p.style === style) return p.o;
    p = parse(me.avatar);
    return p && p.style === style ? p.o : null;
  }
  function setMyOutfit(str) { if (A() && A().setOutfit) return A().setOutfit(str); // phiên đăng nhập riêng từng link
    try { var a = JSON.parse(localStorage.getItem('yumi-auth')); var p = parse(str);
    if (a && a.me) { a.me.avatar = str; if (p) { a.me.outfits = a.me.outfits || {}; a.me.outfits[p.style] = str; } localStorage.setItem('yumi-auth', JSON.stringify(a)); } } catch (_) {} }

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
        if (th.bg && !th.dark) ov.classList.add('yw-light'); // trang nền sáng
        document.body.appendChild(ov);
        try { document.documentElement.style.overflow = 'hidden'; } catch (_) {}
        var W = null, tab = creating ? 'wardrobe' : (opts.tab || 'wardrobe'), slot = creating ? 'body' : 'hair', busy = false, got = null, sel = '', shopCat = 'all';
        var saved = myOutfit(style) || {}, cur = withDefaults(cat, saved);
        var G = function () { return genderOf(cat, cur); };
        W = creating ? null : wcached(style, G()); // hiện ngay bản lần trước
        // đổi thân (Boy/Girl) → bỏ đồ khác giới, mặc đồ cơ bản của giới mới cho ô trống (lúc tạo: thay hết)
        var applyBody = function (all) {
          var g = G(); Object.keys(cur).forEach(function (s) { var it = cat.items[cur[s]]; if (s !== 'body' && (!it || it.hide || !fitG(it, g))) delete cur[s]; });
          var d = cat.defaults && cat.defaults[cur.body]; if (d) Object.keys(d).forEach(function (k) { if (all || !cur[k]) cur[k] = d[k]; });
          cur = normalize(cur, 'top');
        };
        if (creating || (cur.body && cat.items[cur.body] && cat.items[cur.body].hide)) { if (!cur.body || cat.items[cur.body].hide) cur.body = withDefaults(cat, {}).body; applyBody(true); }
        var items = function (f) { return Object.keys(cat.items).filter(function (id) { return f(cat.items[id], id); }); };
        var hasEv = function (e) { return !!e && items(function (it) { return it.ev === e.id; }).length > 0; }; // bộ này có đồ của sự kiện đó không
        var vis = function (it) { return !it.hide && (it.slot === 'body' || fitG(it, G())); }; // Boy/Girl luôn chọn được
        var owns = function (id) { var it = cat.items[id]; return vis(it) && (it.src === 'free' || (W && W.owned.indexOf(id) >= 0)); };
        var thumb = function (it) { it = variant(it, G()); return '<div class="yw-th"><img loading="lazy" alt="" src="' + esc(BASE + cat.dir + '/' + (it.thumb || it.img)) + '"></div>'; };
        var refetch = function () { wallet(style, G()).then(function (j) { if (j.ok) { W = j; draw(); } }).catch(function () {}); };
        function close(v) { ov.remove(); try { document.documentElement.style.overflow = ''; } catch (_) {} resolve(v); }
        function draw() {
          var dirty = JSON.stringify(cur) !== JSON.stringify(withDefaults(cat, saved));
          var h = '<div class="yw"><div class="yw-top"><h2>' + (creating ? '✨ Create your character' : '👕 Wardrobe') + '</h2>' +
            '<span class="yw-coin">🪙 ' + (W ? W.coins : '…') + '</span>' + (creating ? '' : '<button class="yw-x" data-x aria-label="Close">✕</button>') + '</div>' +
            '<div class="yw-left"><div class="yw-stage">' + render(cat, cur) + '</div>' +
            (W ? '<div class="yw-stat"><span>🔥 ' + W.streak + '-week streak' + (W.mult > 1 ? ' (×' + W.mult + ' coins)' : '') + '</span><span>🎁 ' + W.freeChests + ' free chest' + (W.freeChests === 1 ? '' : 's') + '</span></div>' : '') +
            '<button class="yw-save" data-save ' + (dirty || creating ? '' : 'disabled') + '>' + (creating ? 'Done, let’s play! 🚀' : '💾 Save character') + '</button></div><div class="yw-right">';
          if (!creating) h += '<div class="yw-tabs"><button data-t="wardrobe"' + (tab === 'wardrobe' ? ' class="on"' : '') + '>👕 Wardrobe</button><button data-t="shop"' + (tab === 'shop' ? ' class="on"' : '') +
            '>🛍️ Shop</button><button data-t="chest"' + (tab === 'chest' ? ' class="on"' : '') + '>💎 Chest</button></div>';
          if (tab === 'wardrobe') {
            var slots = SLOTS.filter(function (s) { return items(function (it, id) { return it.slot === s[0] && (owns(id) || creating && it.src === 'free' && vis(it)); }).length; });
            if (!slots.some(function (s) { return s[0] === slot; }) && slots[0]) slot = slots[0][0];
            h += '<div class="yw-slots">' + slots.map(function (s) { return '<button data-s="' + s[0] + '"' + (s[0] === slot ? ' class="on"' : '') + '>' + s[1] + ' ' + s[2] + '</button>'; }).join('') + '</div>';
            var mine = items(function (it, id) { return it.slot === slot && owns(id); });
            var opt = slot !== 'body' && slot !== 'hair';
            h += '<div class="yw-grid">' + (opt ? '<button class="yw-it' + (!cur[slot] ? ' on' : '') + '" data-eq=""><div class="yw-th" style="font-size:34px">' + (slot === 'face' ? '🙂' : '🚫') + '</div><b>' + (slot === 'face' ? 'Default' : 'Take off') + '</b></button>' : '') +
              mine.map(function (id) { var it = cat.items[id];
                return '<button class="yw-it yw-r-' + (it.rar || 'c') + (cur[slot] === id ? ' on' : '') + '" data-eq="' + id + '">' + thumb(it) + '<b>' + esc(it.name) + '</b></button>'; }).join('') + '</div>';
            if (!creating) h += '<p class="yw-note">Want more? Visit the 🛍️ Shop or open a 💎 Chest!</p>';
            else h += '<p class="yw-note">These are your starter clothes. Do your homework to earn 🪙 coins and buy cool new items in the shop!<span class="yw-vi">Đây là đồ cơ bản. Làm bài tập để kiếm xu mua thêm đồ xịn ở shop nhé!</span></p>';
          } else if (tab === 'shop') {
            if (!W) h += '<p class="yw-note">Loading the shop…</p>';
            else {
              var fresh = W.fresh || [], ev = hasEv(W.event) ? W.event : null;
              var soon = !ev && eventSoon(); if (!hasEv(soon)) soon = null; // bộ nhân vật không có đồ sự kiện (vd A1) → không hiện banner
              var all = W.shop.filter(function (id) { return cat.items[id] && vis(cat.items[id]); })
                .sort(function (a, b) { var ea = !!cat.items[a].ev, eb = !!cat.items[b].ev; return (eb - ea) || (fresh.indexOf(b) >= 0) - (fresh.indexOf(a) >= 0) || cat.items[a].price - cat.items[b].price; });
              // nhóm lọc (đặt trên cùng): chỉ hiện nhóm có hàng; nhóm có đồ mới tuần này → chữ NEW
              var inCat = function (c, id) { return c[0] === 'all' || (c[0] === 'new' ? fresh.indexOf(id) >= 0 : c[3].indexOf(cat.items[id].slot) >= 0); };
              var cats = SHOP_CATS.filter(function (c) { return all.some(function (id) { return inCat(c, id); }); });
              if (!cats.some(function (c) { return c[0] === shopCat; })) shopCat = 'all';
              var curCat = cats.filter(function (c) { return c[0] === shopCat; })[0] || SHOP_CATS[0];
              var list = all.filter(function (id) { return inCat(curCat, id); });
              if (all.length) h += '<div class="yw-slots yw-cats">' + cats.map(function (c) {
                var n = all.filter(function (id) { return inCat(c, id); }).length, nn = c[0] === 'all' ? 0 : all.filter(function (id) { return inCat(c, id) && fresh.indexOf(id) >= 0; }).length;
                return '<button data-c="' + c[0] + '"' + (c[0] === shopCat ? ' class="on"' : '') + '>' + c[1] + ' ' + c[2] +
                  (c[0] === 'new' ? '<span class="yw-cn">' + n + '</span>' : nn ? '<span class="yw-cn">NEW</span>' : '<i>' + n + '</i>') + '</button>'; }).join('') + '</div>';
              if (soon) { // xem trước đồ sự kiện sắp mở (khoá, chưa thử/mua được) – lọc theo nhóm đang chọn, nhóm New thì không hiện
                var peek = shopCat === 'new' ? [] : items(function (it) { return it.ev === soon.id && vis(it) && (shopCat === 'all' || curCat[3].indexOf(it.slot) >= 0); });
                h += '<div class="yw-ev"><span style="font-size:28px">' + soon.icon + '</span><div><b>' + esc(soon.name) + ' starts in ' + daysTo(soon) + ' day' + (daysTo(soon) === 1 ? '' : 's') + '!</b><small>Sneak peek: limited items from ' + esc(soon.start.slice(8) + '/' + soon.start.slice(5, 7)) + '. Save your coins! 🪙</small></div></div>' +
                  (peek.length ? '<div class="yw-grid" style="margin-bottom:14px">' + peek.map(function (id) { var it = cat.items[id];
                    return '<div class="yw-it lock yw-r-' + (it.rar || 'c') + '"><span class="yw-ltd">SOON ❄️</span>' + thumb(it) + '<b>' + esc(it.name) + '</b><small>' + (it.src === 'chest' ? '💎 Chest' : '🪙 ' + it.price) + '</small><span class="yw-need">Coming ' + esc(soon.start.slice(8) + '/' + soon.start.slice(5, 7)) + '</span></div>'; }).join('') + '</div>' : '');
              }
              if (ev) h += '<div class="yw-ev"><span style="font-size:28px">🎄</span><div><b>' + esc(ev.name) + '</b><small>Limited Christmas items · ends in ' + daysLeft(ev) + ' day' + (daysLeft(ev) === 1 ? '' : 's') + '!</small></div></div>';
              h += '<p class="yw-note">' + (shopCat === 'new' ? 'Just arrived this week! 🎉' : 'New items arrive every Monday!') + ' Tap an item you can afford to try it on or buy it.<span class="yw-vi">' + (shopCat === 'new' ? 'Hàng mới về tuần này!' : 'Mỗi thứ Hai shop có thêm hàng mới.') + ' Đủ xu thì chạm vào món để thử hoặc mua.</span></p><div class="yw-grid">' + list.map(function (id) {
                var it = cat.items[id], have = W.owned.indexOf(id) >= 0, can = W.coins >= it.price;
                var tag = (fresh.indexOf(id) >= 0 ? '<span class="yw-new">NEW</span>' : '') + (it.ev ? '<span class="yw-ltd">LIMITED ❄️</span>' : '');
                var cls = 'yw-it yw-r-' + (it.rar || 'c') + (cur[it.slot] === id ? ' on' : '') + (!have && !can ? ' lock' : '');
                var foot = have ? '<button class="yw-buy" data-try="' + id + '">✔ Owned · wear</button>'
                  : !can ? '<span class="yw-need">🔒 Need ' + (it.price - W.coins) + ' more 🪙</span><button class="yw-buy" disabled>🪙 ' + it.price + '</button>'
                  : sel === id ? '<div class="yw-acts"><button class="yw-tryb" data-try="' + id + '">👀 Try on</button><button class="yw-buyb" data-buy="' + id + '" ' + (busy ? 'disabled' : '') + '>🪙 Buy ' + it.price + '</button></div>'
                  : '<button class="yw-buy" data-sel="' + id + '">🪙 ' + it.price + '</button>';
                return '<div class="' + cls + '"' + (!have && can ? ' data-sel="' + id + '"' : '') + '>' + tag + thumb(it) + '<b>' + esc(it.name) + '</b><small>' + (RAR[it.rar] || '') + '</small>' + foot + '</div>';
              }).join('') + '</div>' + (list.length ? '' : '<p class="yw-note">Nothing here yet. New items arrive every Monday!</p>');
            }
          } else {
            var left = items(function (it, id) { return it.src === 'chest' && vis(it) && !(it.rel && it.rel > todayStr()) && !(it.end && it.end < todayStr()) && !(W && W.owned.indexOf(id) >= 0); }).length;
            if (W && hasEv(W.event)) h += '<div class="yw-ev"><span style="font-size:28px">🎄</span><div><b>Christmas items inside!</b><small>Snow Queen, Ice Prince, snowflake wings… until ' + esc(W.event.end.slice(8) + '/' + W.event.end.slice(5, 7)) + '</small></div></div>';
            h += '<div class="yw-chest">' + (got ? '<div class="yw-got">' + thumb(cat.items[got]) + '<b>👑 ' + esc(cat.items[got].name) + '</b></div>' : '<div class="yw-box' + (busy ? ' shake' : '') + '">💎</div>') +
              '<p class="yw-note">The Exquisite Chest holds <b>exclusive</b> items you can’t buy in the shop, and it never gives you something you already have. ' + left + ' item' + (left === 1 ? '' : 's') + ' left to find.<span class="yw-vi">Rương Exquisite chứa đồ độc quyền không bán ở shop, và luôn ra món em chưa có.</span></p>' +
              '<div class="yw-btns"><button data-chest="free" ' + (busy || !W || !W.freeChests || !left ? 'disabled' : '') + '>🎁 Open free chest (' + (W ? W.freeChests : 0) + ')</button>' +
              '<button data-chest="coins" ' + (busy || !W || W.coins < W.chestPrice || !left ? 'disabled' : '') + '>🪙 ' + (W ? W.chestPrice : 600) + ' coins</button></div>' +
              '<p class="yw-note">Free chests: 1 for every 5 lessons, and 1 for every 3 lessons that are 100% right on the first try.<span class="yw-vi">Rương tặng: cứ 5 bài tập → 1 rương, cứ 3 bài đúng hết ngay lần 1 → 1 rương.</span></p></div>';
          }
          if (!creating) h += '<div class="yw-earn"><b>How to earn 🪙</b><br>📚 Every lesson: 30 coins for handing it in + up to 50 for your first-try score<br>✏️ Fix all mistakes on try 2: +20 · 🎯 Stay on the page: +10 · 💯 All correct first time: +20<br>' +
            '🔥 Hand in every week: coins ×1.2 → ×1.5<br>🎮 Word mini games: +5 coins a round (3 rounds a day)' +
            '<span class="yw-vi">Mỗi bài: 30 xu nộp bài + đến 50 xu theo điểm lần 1 · sửa hết lỗi ở lần 2 +20 · không rời trang +10 · đúng hết ngay +20 · tuần nào cũng nộp bài: xu ×1.2 → ×1.5 · mini game ôn từ +5 xu/lượt (3 lượt/ngày)</span></div>';
          ov.innerHTML = h + '</div></div>';
          bind();
        }
        function bind() {
          var q = function (s) { return [].slice.call(ov.querySelectorAll(s)); };
          q('[data-x]').forEach(function (b) { b.onclick = function () { if (JSON.stringify(cur) !== JSON.stringify(withDefaults(cat, saved)) && !confirm('You haven’t saved your character. Leave anyway?')) return; close(); }; });
          q('[data-t]').forEach(function (b) { b.onclick = function () { tab = b.dataset.t; got = null; draw(); }; });
          q('[data-s]').forEach(function (b) { b.onclick = function () { slot = b.dataset.s; draw(); }; });
          q('[data-c]').forEach(function (b) { b.onclick = function () { shopCat = b.dataset.c; sel = ''; draw(); }; });
          q('[data-eq]').forEach(function (b) { b.onclick = function () { var id = b.dataset.eq; if (id) { cur[slot] = id; cur = normalize(cur, slot); } else delete cur[slot];
            // chọn Boy/Girl → bỏ đồ khác giới + đồ cơ bản của giới mới (lúc tạo: thay hết), shop/rương theo giới mới
            if (slot === 'body' && id) { applyBody(creating); if (!creating) refetch(); }
            draw(); }; });
          q('[data-sel]').forEach(function (b) { b.onclick = function (e) { if (e.target.closest('[data-try],[data-buy]')) return; e.stopPropagation(); sel = sel === b.dataset.sel ? '' : b.dataset.sel; draw(); }; });
          q('[data-try]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var it = cat.items[b.dataset.try]; cur[it.slot] = b.dataset.try; cur = normalize(cur, it.slot); draw(); }; });
          q('[data-buy]').forEach(function (b) { b.onclick = function () {
            var id = b.dataset.buy, it = cat.items[id];
            if (!confirm('Buy "' + it.name + '" for ' + it.price + ' coins?')) return;
            busy = true; sel = ''; draw();
            api({ action: 'buy', style: style, item: id, g: G() }).then(function (j) {
              if (j.auth) return A().authFailed({}).then(function () { busy = false; draw(); });
              if (!j.ok) throw new Error(j.error); W = wkeep(style, G(), j); cur[it.slot] = id; cur = normalize(cur, it.slot); toast('🎉 You got ' + it.name + '! Don’t forget to tap Save');
            }).catch(function (e) { toast(e.message); }).then(function () { busy = false; draw(); });
          }; });
          q('[data-chest]').forEach(function (b) { b.onclick = function () {
            var pay = b.dataset.chest;
            if (pay === 'coins' && !confirm('Open a chest for ' + W.chestPrice + ' coins?')) return;
            busy = true; got = null; draw();
            var t0 = Date.now();
            api({ action: 'chest', style: style, pay: pay, g: G() }).then(function (j) {
              if (!j.ok) throw new Error(j.error);
              return new Promise(function (r) { setTimeout(r, Math.max(0, 1400 - (Date.now() - t0))); }).then(function () { W = wkeep(style, G(), j); got = j.got; var it = cat.items[j.got]; cur[it.slot] = j.got; cur = normalize(cur, it.slot); });
            }).catch(function (e) { toast(e.message); }).then(function () { busy = false; draw(); });
          }; });
          q('[data-save]').forEach(function (b) { b.onclick = function () {
            b.disabled = true; b.textContent = '…';
            var o = Object.assign({}, cur);
            api({ action: 'outfit', style: style, outfit: o }).then(function (j) {
              if (j.auth) return A().authFailed({}).then(function () { draw(); });
              if (!j.ok) throw new Error(j.error);
              saved = parse(j.outfit).o; setMyOutfit(j.outfit); toast('✅ Character saved!');
              if (creating) close(j.outfit); else draw();
              if (opts.onSave) opts.onSave(j.outfit);
            }).catch(function (e) { toast(e.message || 'Couldn’t save, please try again'); draw(); });
          }; });
        }
        draw();
        wallet(style, G()).then(function (j) { if (j.ok) { W = j; draw(); } else if (j.auth) { A().authFailed({}).then(function () { return wallet(style, G()); }).then(function (k) { if (k && k.ok) { W = k; draw(); } }); } }).catch(function () {});
      });
    });
  }
  /** Lần đầu: chưa có nhân vật bộ này → bắt tạo (chỉ đồ miễn phí). */
  function ensure(opts) {
    opts = opts || {};
    var style = opts.style || 'teen';
    if (!A() || !A().me()) return Promise.resolve(null);
    var o = myOutfit(style);
    if (!o) return open(Object.assign({}, opts, { create: true }));
    return load(style).then(function (cat) {
      var b = cat.items[o.body];
      if (!b || b.hide) return open(Object.assign({}, opts, { create: true }));
      return null; // đã có nhân vật → vào thẳng (bỏ hướng dẫn tân thủ 26/11)
    });
  }
  function button(opts) {
    injectCss();
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ya-trophy'; b.style.background = 'linear-gradient(135deg,#7c4dff,#ff2e88)';
    var ev = eventNow(); b.setAttribute('data-yw-btn', '1'); b._ywOpts = opts || {};
    b.innerHTML = (ev ? ev.icon : '👕') + ' <span>' + esc((opts && opts.label) || 'Wardrobe') + '</span>';
    b.onclick = function () { open(opts); };
    return b;
  }
  /** Mini game xong 1 lượt → +5 xu (máy chủ giới hạn 3 lượt/ngày). */
  function gamePlayed(name) {
    if (!A() || !A().token()) return Promise.resolve(null);
    return api({ action: 'game', game: name || '' }).then(function (j) { if (j && j.added) toast('🪙 +' + j.added + ' coins (mini game)'); return j; }).catch(function () { return null; });
  }
  /** Ảnh sản phẩm của 1 món (cho "nhà bạn"): Promise<{url, name, rar} | null> */
  function itemThumb(style, id, g) {
    return load(style).then(function (cat) { var it = cat.items[id]; if (!it || it.slot === 'body') return null; it = variant(it, g);
      return { url: BASE + cat.dir + '/' + (it.thumb || it.img), name: it.name, rar: it.rar || 'c' }; }).catch(function () { return null; });
  }
  window.YumiAvatar = { itemThumb: itemThumb, register: register, load: load, html: html, render: render, open: open, ensure: ensure, button: button, gamePlayed: gamePlayed, parse: parse, SLOTS: SLOTS };
})();
