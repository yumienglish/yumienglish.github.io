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
  // trang trí căn phòng sau nhân vật theo bộ: [cửa sổ (góc trên phải), 2 món trên tường trái]; số sao theo độ hiếm
  var DECOR = { teen: ['✨ 🌙', '💡', '🎧'], ket: ['🪐 ✨', '🛰️', '🚀'], a1: ['☀️ 🌳', '🦉', '🌻'] };
  var STARS = { c: 1, r: 2, e: 3, x: 4 };
  // khung tính cỡ nhân vật trong tủ đồ: bỏ lề trống 2 bên (cánh / thú cưng vẫn được vẽ tràn ra ngoài)
  var figBox = function (cat) { return { x: cat.w * 0.16, y: 0, w: cat.w * 0.68, h: cat.h }; };
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
    var W = cat.w, H = cat.h, box = opts.box || (opts.crop === 'head' ? headBox(cat) : { x: 0, y: 0, w: W, h: H });
    var layers = layersOf(cat, o).map(function (it) {
      return '<img alt="" draggable="false" src="' + esc(BASE + cat.dir + '/' + it.img) + '" style="position:absolute;left:' + ((it.x - box.x) / box.w * 100) + '%;top:' +
        ((it.y - box.y) / box.h * 100) + '%;width:' + (it.w / box.w * 100) + '%;height:' + (it.h / box.h * 100) + '%">';
    }).join('');
    return '<div class="yav' + (opts.crop === 'head' ? ' yav-head' : '') + '" style="position:relative;overflow:' + (opts.box ? 'visible' : 'hidden') + ';aspect-ratio:' + box.w + '/' + box.h + ';' + (opts.size ? 'width:' + opts.size + 'px;' : 'width:100%;') + '">' + layers + '</div>';
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
    // khung kiểu game thay đồ: thanh trên · căn phòng (nhân vật to, dải nhóm dọc, nút lưu nổi) · cột đồ bên phải tự cuộn
    '.yw-ov{position:fixed;inset:0;z-index:2147483001;background:var(--ya-bg,#120d2b);color:var(--ya-text,#fff);font-family:var(--ya-font,system-ui);overflow:hidden;' +
      '--w1:#2a2157;--w2:#4a3a86;--f1:#6d4c38;--f2:#3f2a20;--rug1:#ff7ab8;--rug2:#c2185b;--win1:#0e0a2e;--win2:#3b2a78}' +
    '.yw-st-ket{--w1:#e6f4ff;--w2:#c9e3ff;--f1:#b9c8df;--f2:#8ea2c2;--rug1:#a8d8ff;--rug2:#5aa9f0;--win1:#0b1240;--win2:#2b3a8f}' +
    '.yw-st-a1{--w1:#eef9e2;--w2:#d3eebf;--f1:#dcae7a;--f2:#b47e4c;--rug1:#ffd9a8;--rug2:#f0a35e;--win1:#7fd0ff;--win2:#d4f3ff}' +
    '.yw{--yw-lw:31%;--yw-rw:58px;position:relative;height:100%;max-width:1100px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) var(--yw-lw);grid-template-rows:auto minmax(0,1fr);grid-template-areas:"bar bar" "zone list";overflow:hidden;' +
      'background:linear-gradient(180deg,var(--w1) 0,var(--w2) 70%,var(--f1) 70%,var(--f2) 100%)}' +
    '.yw:before{content:"";position:absolute;left:0;right:0;top:70%;height:6px;background:rgba(0,0,0,.16)}' +
    '.yw.wide{--yw-lw:58%}.yw.norail{--yw-rw:0px}' +
    // thanh trên
    '.yw-bar{grid-area:bar;position:relative;z-index:3;display:flex;align-items:center;gap:6px;padding:8px 8px 6px}' +
    '.yw-x{flex:none;border:0;background:rgba(255,255,255,.92);color:#2b2440;width:38px;height:38px;border-radius:50%;font-size:18px;font-weight:800;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.2)}' +
    '.yw-title{flex:1;margin:0;font-family:var(--ya-head,inherit);font-size:20px}' +
    '.yw-tabs{flex:1;min-width:0;display:flex;gap:5px}' +
    '.yw-tabs button{flex:1 1 auto;min-width:0;border:0;border-radius:99px;padding:8px 6px;font:inherit;font-weight:800;font-size:13px;cursor:pointer;background:rgba(255,255,255,.9);color:#3a2f5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 6px rgba(0,0,0,.15)}' +
    '.yw-tabs button.on{background:linear-gradient(135deg,var(--ya-acc,#ff2e88),var(--ya-acc2,#8f6cf6));color:#fff}' +
    '.yw-coin{flex:none;font-weight:800;font-size:15px;background:linear-gradient(135deg,#ffcf3f,#ff9f1c);color:#3b2300;border-radius:99px;padding:7px 11px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.15)}' +
    // căn phòng + nhân vật
    '.yw-zone{grid-area:zone;position:relative;min-width:0;min-height:0}' +
    '.yw-win{position:absolute;top:3%;right:calc(var(--yw-rw) + 18px);width:28%;max-width:150px;aspect-ratio:6/5;border-radius:10px;border:5px solid rgba(255,255,255,.95);background:linear-gradient(var(--win1),var(--win2));display:flex;align-items:center;justify-content:center;font-size:clamp(13px,3.6vw,24px);box-shadow:0 2px 0 rgba(0,0,0,.12)}' +
    '.yw-dec{position:absolute;line-height:1;pointer-events:none;font-size:clamp(26px,7vw,46px)}.yw-dec.a{top:19%;left:5%}.yw-dec.b{top:38%;left:4%}' +
    '.yw-figwrap{position:absolute;top:4px;bottom:8px;left:0;right:calc(var(--yw-rw) * .35);display:flex;align-items:flex-end;justify-content:center;pointer-events:none}' +
    '.yw-fig{position:relative;flex:none}.yw-fig .yav{filter:drop-shadow(0 6px 8px rgba(0,0,0,.22))}' +
    '.yw-rug{position:absolute;left:50%;bottom:0;width:min(78%,320px);height:7%;transform:translateX(-50%);border-radius:50%;background:radial-gradient(var(--rug1),var(--rug2));opacity:.8}' +
    // dải nút nhóm dọc
    '.yw-rail{position:absolute;top:0;bottom:0;right:3px;width:calc(var(--yw-rw) + 7px);z-index:2;display:flex;flex-direction:column;gap:7px;overflow-y:auto;scrollbar-width:none;padding:8px 7px 10px 0}.yw-rail::-webkit-scrollbar{display:none}' +
    '.yw-rail>:first-child{margin-top:auto}.yw-rail>:last-child{margin-bottom:auto}' +
    '.yw-rail button{position:relative;flex:none;width:100%;border:0;border-radius:16px;padding:6px 2px 5px;background:rgba(255,255,255,.9);color:#3a2f5c;font:inherit;font-size:9.5px;font-weight:800;line-height:1.1;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.18)}' +
    '.yw-rail button i{display:block;font-style:normal;font-size:22px;line-height:1.15;margin-bottom:2px}' +
    '.yw-rail button.on{background:linear-gradient(135deg,var(--ya-acc,#ff2e88),var(--ya-acc2,#8f6cf6));color:#fff}' +
    '.yw-rail .yw-cn{position:absolute;top:-5px;right:-6px;margin:0}' +
    // nút lưu nổi (góc trên trái) + nhắc đang mặc thử
    '.yw-save{position:absolute;left:8px;top:6px;z-index:2;border:0;border-radius:99px;padding:11px 18px;font:inherit;font-weight:800;font-size:15px;color:#fff;cursor:pointer;background:linear-gradient(135deg,var(--ya-acc,#ff2e88),var(--ya-acc2,#8f6cf6));box-shadow:0 4px 12px rgba(0,0,0,.28)}' +
    '.yw-save[disabled]{opacity:.55;cursor:default;box-shadow:none}' +
    '.yw-trying{position:absolute;left:8px;top:56px;z-index:2;max-width:128px;background:rgba(255,255,255,.94);color:#2b2440;border-radius:12px;padding:6px 10px;font-size:11.5px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.18)}' +
    // cột đồ
    '.yw-list{grid-area:list;position:relative;z-index:2;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;background:rgba(255,255,255,.9);color:#2b2440;padding:8px 7px 28px;border-radius:18px 0 0 0;box-shadow:-4px 0 18px rgba(0,0,0,.18)}' +
    '.yw-dark .yw-list{background:rgba(24,17,56,.92);color:#fff}' +
    '.yw-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}' +
    '.yw-it{position:relative;display:block;width:100%;border:2px solid rgba(60,40,120,.14);background:#fff;border-radius:14px;padding:5px 5px 7px;cursor:pointer;text-align:center;color:inherit;font:inherit}' +
    '.yw-dark .yw-it{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.16)}' +
    '.yw-ov .yw-r-r{border-color:#4fc3f7}.yw-ov .yw-r-e{border-color:#b388ff}.yw-ov .yw-r-x{border-color:#ffd54f;background:linear-gradient(160deg,rgba(255,213,79,.24),rgba(255,255,255,.06))}' +
    '.yw-ov .yw-it.on{border-color:var(--ya-acc,#ff2e88);box-shadow:0 0 0 3px rgba(255,46,136,.28)}' +
    '.yw-it .yw-th{aspect-ratio:1;display:flex;align-items:center;justify-content:center;overflow:hidden}' +
    '.yw-it .yw-th img{max-width:100%;max-height:100%;object-fit:contain}' +
    '.yw-it b{display:block;font-size:11.5px;line-height:1.25;margin-top:3px}' +
    '.yw-it small{display:block;font-size:10.5px;opacity:.8;margin-top:1px}' +
    '.yw-stars{display:block;font-size:10px;letter-spacing:1px;color:#ffb300;margin-top:2px}' +
    '.yw-it small.yw-ltdt{color:#e53935;opacity:1;font-weight:800}' +
    '.yw-chk{position:absolute;top:5px;right:5px;z-index:1;width:20px;height:20px;border-radius:50%;background:var(--ya-acc,#ff2e88);color:#fff;font-size:12px;font-weight:900;line-height:20px;box-shadow:0 0 0 2px #fff}' +
    '.yw-new,.yw-soon{position:absolute;top:5px;left:5px;z-index:1;color:#fff;font-size:9.5px;font-weight:800;padding:1px 6px;border-radius:99px;background:linear-gradient(135deg,#ff2e88,#ffb300)}.yw-soon{background:#e53935}' +
    '.yw-buy{display:block;margin-top:5px;border:0;border-radius:10px;padding:6px 4px;font:inherit;font-weight:800;font-size:12px;cursor:pointer;background:linear-gradient(135deg,#ffcf3f,#ff9f1c);color:#3b2300;width:100%}' +
    '.yw-buy[disabled]{opacity:.45;cursor:default}' +
    '.yw-own{display:block;margin-top:5px;font-size:11px;font-weight:800;color:#2e9d4f}.yw-dark .yw-own{color:#7ee2a0}' +
    '.yw-need{display:block;margin-top:4px;font-size:10.5px;font-weight:700;color:#d9480f}.yw-dark .yw-need{color:#ffcf3f}' +
    '.yw-it.lock{cursor:default;opacity:.6}.yw-it.lock .yw-th{filter:grayscale(.5)}' +
    '.yw-cn{display:inline-block;margin-left:4px;background:linear-gradient(135deg,#ff2e88,#ffb300);color:#fff;font-size:9px;font-weight:800;padding:1px 5px;border-radius:99px;animation:yw-pulse 1.6s ease-in-out infinite}' +
    '@keyframes yw-pulse{50%{transform:scale(1.12)}}' +
    '.yw-note{font-size:11.5px;opacity:.85;margin:2px 2px 8px;line-height:1.35}.yw-vi{display:block;font-size:10.5px;opacity:.7;font-style:italic;margin-top:2px}' +
    '.yw-sec{font-size:11px;font-weight:800;opacity:.8;margin:14px 2px 6px}' +
    '.yw-ev{background:linear-gradient(135deg,#c62828,#2e7d32);color:#fff;border-radius:12px;padding:7px 9px;margin:0 0 8px;font-weight:800;font-size:12px;line-height:1.25}.yw-ev small{display:block;font-weight:600;opacity:.92;font-size:10.5px;margin-top:2px}' +
    // rương
    '.yw-chest{text-align:center;padding:6px 2px}' +
    '.yw-chest .yw-box{font-size:80px;line-height:1;display:inline-block;filter:drop-shadow(0 0 18px rgba(255,213,79,.7))}' +
    '.yw-chest .yw-box.shake{animation:yw-sh .6s infinite}@keyframes yw-sh{25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}' +
    '.yw-chest .yw-got{max-width:200px;margin:8px auto;animation:yw-pop .5s cubic-bezier(.2,1.5,.5,1)}@keyframes yw-pop{from{transform:scale(.3);opacity:0}}' +
    '.yw-chest .yw-note{font-size:12px}' +
    '.yw-chest .yw-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px 0}' +
    '.yw-chest .yw-btns button{border:0;border-radius:14px;padding:10px 14px;font:inherit;font-weight:800;font-size:13px;cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--ya-acc,#ff2e88),var(--ya-acc2,#8f6cf6))}' +
    '.yw-chest .yw-btns button[disabled]{opacity:.45;cursor:default}' +
    '.yw-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 16px;border-radius:12px;z-index:2147483002;font-weight:700;max-width:90vw;text-align:center}' +
    '.yav-head{border-radius:50%}' +
    '@media(max-width:370px){.yw-tabs .tl{display:none}.yw-tabs button{font-size:17px}}' +
    // máy tính: khung game đứng giữa, cột đồ rộng 2 cột
    '@media(min-width:721px){.yw{--yw-lw:360px;--yw-rw:70px;height:calc(100% - 32px);margin:16px auto;border-radius:24px;box-shadow:0 12px 40px rgba(0,0,0,.35)}.yw.wide{--yw-lw:460px}' +
      '.yw-list .yw-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.yw-it b{font-size:12.5px}.yw-rail button{font-size:10.5px}.yw-rail button i{font-size:26px}' +
      '.yw-bar{padding:12px 14px 8px}.yw-tabs{flex:0 1 420px}.yw-tabs button{font-size:14.5px;padding:9px 10px}.yw-bar .yw-coin{margin-left:auto}' +
      '.yw-save{font-size:17px;padding:12px 24px;left:16px;top:10px}.yw-trying{left:16px;top:68px;max-width:none}}';
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
        var ov = document.createElement('div'); ov.className = 'yw-ov yw-st-' + (DECOR[style] ? style : 'teen');
        var th = opts.theme || {};
        ['bg', 'text', 'acc', 'acc2', 'font', 'head'].forEach(function (k) { if (th[k]) ov.style.setProperty('--ya-' + k, th[k]); });
        ov.classList.add(th.bg && !th.dark ? 'yw-light' : 'yw-dark'); // trang nền sáng / tối
        document.body.appendChild(ov);
        try { document.documentElement.style.overflow = 'hidden'; } catch (_) {}
        var W = null, tab = creating ? 'wardrobe' : (opts.tab || 'wardrobe'), slot = creating ? 'body' : 'hair', busy = false, got = null, shopCat = 'all';
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
        var base = function () { return withDefaults(cat, saved); };
        var mineNow = function (id) { var it = cat.items[id]; return !!it && (it.src === 'free' || !!(W && W.owned.indexOf(id) >= 0)); };
        var notMine = function () { return Object.keys(cur).filter(function (s) { return cur[s] && !mineNow(cur[s]); }); }; // ô đang mặc thử đồ chưa mua
        // cởi món ở ô này → trả lại món đã lưu (nếu có); nhóm quần áo trống hẳn → mặc lại quần áo đã lưu
        var CLOTHES = ['top', 'bottom', 'dress', 'set'];
        var takeOff = function (s) {
          var b = base(), off = cur[s]; delete cur[s];
          if (b[s] && b[s] !== off && mineNow(b[s])) cur[s] = b[s];
          if (CLOTHES.indexOf(s) >= 0 && !CLOTHES.some(function (k) { return cur[k]; })) CLOTHES.forEach(function (k) { if (b[k] && mineNow(b[k])) cur[k] = b[k]; });
          cur = normalize(cur, cur.set ? 'set' : cur.dress ? 'dress' : 'top');
        };
        var lastView = '';
        var view = function () { return tab + '|' + (tab === 'wardrobe' ? slot : tab === 'shop' ? shopCat : ''); };
        // cỡ nhân vật: vừa khít chiều cao hoặc chiều rộng phần căn phòng
        function fit() {
          var z = ov.querySelector('.yw-figwrap'), f = ov.querySelector('.yw-fig'); if (!z || !f) return;
          var b = figBox(cat), w = Math.min(z.clientWidth, z.clientHeight * b.w / b.h); f.style.width = Math.max(80, Math.floor(w)) + 'px';
        }
        window.addEventListener('resize', fit);
        function close(v) { window.removeEventListener('resize', fit); ov.remove(); try { document.documentElement.style.overflow = ''; } catch (_) {} resolve(v); }
        function draw() {
          var dirty = JSON.stringify(cur) !== JSON.stringify(base());
          var oldList = ov.querySelector('.yw-list'), oldRail = ov.querySelector('.yw-rail');
          var keepList = oldList && lastView === view() ? oldList.scrollTop : 0, keepRail = oldRail && lastView.split('|')[0] === tab ? oldRail.scrollTop : 0;
          var d = DECOR[style] || DECOR.teen, rail = '', body = '';
          var stars = function (it) { return '<span class="yw-stars">' + new Array((STARS[it.rar] || 1) + 1).join('★') + '</span>'; };
          var chk = function (id) { return cur[cat.items[id].slot] === id ? '<span class="yw-chk">✔</span>' : ''; };
          var dm = function (s) { return esc(s.slice(8) + '/' + s.slice(5, 7)); };
          if (tab === 'wardrobe') {
            var slots = SLOTS.filter(function (s) { return items(function (it, id) { return it.slot === s[0] && (owns(id) || creating && it.src === 'free' && vis(it)); }).length; });
            if (!slots.some(function (s) { return s[0] === slot; }) && slots[0]) slot = slots[0][0];
            rail = slots.map(function (s) { return '<button data-s="' + s[0] + '"' + (s[0] === slot ? ' class="on"' : '') + '><i>' + s[1] + '</i>' + s[2] + '</button>'; }).join('');
            var mine = items(function (it, id) { return it.slot === slot && owns(id); });
            var opt = slot !== 'body' && slot !== 'hair';
            body = (creating ? '<p class="yw-note">Pick your starter look! Do homework to earn 🪙 and buy more.<span class="yw-vi">Chọn đồ cơ bản. Làm bài tập kiếm xu để mua thêm đồ nhé!</span></p>' : '') +
              '<div class="yw-grid">' + (opt ? '<button class="yw-it' + (!cur[slot] ? ' on' : '') + '" data-eq=""><div class="yw-th" style="font-size:34px">' + (slot === 'face' ? '🙂' : '🚫') + '</div><b>' + (slot === 'face' ? 'Default' : 'Take off') + '</b></button>' : '') +
              mine.map(function (id) { var it = cat.items[id];
                return '<button class="yw-it yw-r-' + (it.rar || 'c') + (cur[slot] === id ? ' on' : '') + '" data-eq="' + id + '">' + chk(id) + thumb(it) + '<b>' + esc(it.name) + '</b>' + (slot === 'body' ? '' : stars(it)) + '</button>'; }).join('') + '</div>';
          } else if (tab === 'shop') {
            if (!W) body = '<p class="yw-note">Loading the shop…</p>';
            else {
              var fresh = W.fresh || [], ev = hasEv(W.event) ? W.event : null;
              var soon = !ev && eventSoon(); if (!hasEv(soon)) soon = null; // bộ nhân vật không có đồ sự kiện (vd A1) → không hiện
              var all = W.shop.filter(function (id) { return cat.items[id] && vis(cat.items[id]); })
                .sort(function (a, b) { var ea = !!cat.items[a].ev, eb = !!cat.items[b].ev; return (eb - ea) || (fresh.indexOf(b) >= 0) - (fresh.indexOf(a) >= 0) || cat.items[a].price - cat.items[b].price; });
              // nhóm lọc (dải dọc): chỉ hiện nhóm có hàng; nhóm có đồ mới tuần này → chữ NEW
              var inCat = function (c, id) { return c[0] === 'all' || (c[0] === 'new' ? fresh.indexOf(id) >= 0 : c[3].indexOf(cat.items[id].slot) >= 0); };
              var cats = SHOP_CATS.filter(function (c) { return all.some(function (id) { return inCat(c, id); }); });
              if (!cats.some(function (c) { return c[0] === shopCat; })) shopCat = 'all';
              var curCat = cats.filter(function (c) { return c[0] === shopCat; })[0] || SHOP_CATS[0];
              var list = all.filter(function (id) { return inCat(curCat, id); });
              rail = cats.map(function (c) {
                var n = all.filter(function (id) { return inCat(c, id); }).length, nn = c[0] === 'all' ? 0 : all.filter(function (id) { return inCat(c, id) && fresh.indexOf(id) >= 0; }).length;
                return '<button data-c="' + c[0] + '"' + (c[0] === shopCat ? ' class="on"' : '') + '><i>' + c[1] + '</i>' + c[2] +
                  (c[0] === 'new' ? '<span class="yw-cn">' + n + '</span>' : nn ? '<span class="yw-cn">NEW</span>' : '') + '</button>'; }).join('');
              if (ev) body += '<div class="yw-ev">🎄 ' + esc(ev.name) + '<small>Limited items · ends in ' + daysLeft(ev) + ' day' + (daysLeft(ev) === 1 ? '' : 's') + '!</small></div>';
              else if (soon) body += '<div class="yw-ev">' + soon.icon + ' ' + esc(soon.name) + ' in ' + daysTo(soon) + ' day' + (daysTo(soon) === 1 ? '' : 's') + '!<small>Save your coins! 🪙</small></div>';
              // chạm thẻ = mặc thử ngay (mọi món, kể cả chưa đủ xu); chạm lần nữa = cởi ra
              body += '<div class="yw-grid">' + list.map(function (id) {
                var it = cat.items[id], have = W.owned.indexOf(id) >= 0, can = W.coins >= it.price;
                var foot = have ? '<span class="yw-own">✔ Owned</span>'
                  : can ? '<button class="yw-buy" data-buy="' + id + '" ' + (busy ? 'disabled' : '') + '>🪙 Buy ' + it.price + '</button>'
                  : '<span class="yw-need">🔒 Need ' + (it.price - W.coins) + ' more</span><button class="yw-buy" disabled>🪙 ' + it.price + '</button>';
                return '<div class="yw-it yw-r-' + (it.rar || 'c') + (cur[it.slot] === id ? ' on' : '') + '" data-try="' + id + '">' + (fresh.indexOf(id) >= 0 ? '<span class="yw-new">NEW</span>' : '') + chk(id) +
                  thumb(it) + '<b>' + esc(it.name) + '</b>' + stars(it) + (it.ev ? '<small class="yw-ltdt">❄️ Limited</small>' : '') + foot + '</div>';
              }).join('') + '</div>' + (list.length ? '' : '<p class="yw-note">Nothing here yet. New items arrive every Monday!</p>');
              if (soon) { // đồ sự kiện sắp mở: xếp cuối danh sách, theo nhóm đang chọn (nhóm New thì không hiện)
                var peek = shopCat === 'new' ? [] : items(function (it) { return it.ev === soon.id && vis(it) && (shopCat === 'all' || curCat[3].indexOf(it.slot) >= 0); });
                if (peek.length) body += '<p class="yw-sec">' + soon.icon + ' Coming ' + dm(soon.start) + '</p><div class="yw-grid">' + peek.map(function (id) { var it = cat.items[id];
                  return '<div class="yw-it lock yw-r-' + (it.rar || 'c') + '"><span class="yw-soon">SOON</span>' + thumb(it) + '<b>' + esc(it.name) + '</b><small>' + (it.src === 'chest' ? '💎 Chest' : '🪙 ' + it.price) + '</small></div>'; }).join('') + '</div>';
              }
            }
          } else {
            var left = items(function (it, id) { return it.src === 'chest' && vis(it) && !(it.rel && it.rel > todayStr()) && !(it.end && it.end < todayStr()) && !(W && W.owned.indexOf(id) >= 0); }).length;
            if (W && hasEv(W.event)) body += '<div class="yw-ev">🎄 Christmas items inside!<small>Snow Queen, Ice Prince, snowflake wings… until ' + dm(W.event.end) + '</small></div>';
            body += '<div class="yw-chest">' + (got ? '<div class="yw-got">' + thumb(cat.items[got]) + '<b>👑 ' + esc(cat.items[got].name) + '</b></div>' : '<div class="yw-box' + (busy ? ' shake' : '') + '">💎</div>') +
              '<p class="yw-note">The Exquisite Chest holds <b>exclusive</b> items you can’t buy in the shop, and it never gives you something you already have. ' + left + ' item' + (left === 1 ? '' : 's') + ' left to find.<span class="yw-vi">Rương Exquisite chứa đồ độc quyền không bán ở shop, và luôn ra món em chưa có.</span></p>' +
              '<div class="yw-btns"><button data-chest="free" ' + (busy || !W || !W.freeChests || !left ? 'disabled' : '') + '>🎁 Open free chest (' + (W ? W.freeChests : 0) + ')</button>' +
              '<button data-chest="coins" ' + (busy || !W || W.coins < W.chestPrice || !left ? 'disabled' : '') + '>🪙 ' + (W ? W.chestPrice : 600) + ' coins</button></div>' +
              '<p class="yw-note">Free chests: 1 for every 5 lessons, and 1 for every 3 lessons that are 100% right on the first try.<span class="yw-vi">Rương tặng: cứ 5 bài tập → 1 rương, cứ 3 bài đúng hết ngay lần 1 → 1 rương.</span></p></div>';
          }
          var nm = creating ? [] : notMine();
          var tabs = [['wardrobe', '👕', 'Wardrobe'], ['shop', '🛍️', 'Shop'], ['chest', '💎', 'Chest']].map(function (t) {
            return '<button data-t="' + t[0] + '"' + (tab === t[0] ? ' class="on"' : '') + '>' + t[1] + '<span class="tl"> ' + t[2] + '</span></button>'; }).join('');
          ov.innerHTML = '<div class="yw' + (tab === 'chest' ? ' wide' : '') + (rail ? '' : ' norail') + '"><div class="yw-bar">' +
            (creating ? '<h2 class="yw-title">✨ Create your character</h2>' : '<button class="yw-x" data-x aria-label="Close">✕</button><div class="yw-tabs">' + tabs + '</div><span class="yw-coin">🪙 ' + (W ? W.coins : '…') + '</span>') + '</div>' +
            '<div class="yw-zone"><div class="yw-win">' + d[0] + '</div><span class="yw-dec a">' + d[1] + '</span><span class="yw-dec b">' + d[2] + '</span>' +
            '<div class="yw-figwrap"><div class="yw-rug"></div><div class="yw-fig">' + render(cat, cur, { box: figBox(cat) }) + '</div></div>' +
            (rail ? '<div class="yw-rail">' + rail + '</div>' : '') +
            (nm.length ? '<div class="yw-trying">👀 Trying on · buy to keep!</div>' : '') +
            '<button class="yw-save" data-save ' + (dirty || creating ? '' : 'disabled') + '>' + (creating ? 'Done, let’s play! 🚀' : '💾 Save') + '</button></div>' +
            '<div class="yw-list">' + body + '</div></div>';
          fit();
          var nl = ov.querySelector('.yw-list'), nr = ov.querySelector('.yw-rail');
          if (nl) nl.scrollTop = keepList; if (nr) nr.scrollTop = keepRail;
          lastView = view();
          bind();
        }
        function bind() {
          var q = function (s) { return [].slice.call(ov.querySelectorAll(s)); };
          q('[data-x]').forEach(function (b) { b.onclick = function () { if (JSON.stringify(cur) !== JSON.stringify(base()) && !confirm('You haven’t saved your character. Leave anyway?')) return; close(); }; });
          q('[data-t]').forEach(function (b) { b.onclick = function () { tab = b.dataset.t; got = null; draw(); }; });
          q('[data-s]').forEach(function (b) { b.onclick = function () { slot = b.dataset.s; draw(); }; });
          q('[data-c]').forEach(function (b) { b.onclick = function () { shopCat = b.dataset.c; draw(); }; });
          q('[data-eq]').forEach(function (b) { b.onclick = function () { var id = b.dataset.eq; if (id) { cur[slot] = id; cur = normalize(cur, slot); } else delete cur[slot];
            // chọn Boy/Girl → bỏ đồ khác giới + đồ cơ bản của giới mới (lúc tạo: thay hết), shop/rương theo giới mới
            if (slot === 'body' && id) { applyBody(creating); if (!creating) refetch(); }
            draw(); }; });
          q('[data-try]').forEach(function (b) { b.onclick = function (e) {
            if (e.target.closest('[data-buy]')) return;
            var id = b.dataset.try, it = cat.items[id];
            if (cur[it.slot] === id) { takeOff(it.slot); if (it.slot === 'hair' && !cur.hair) cur.hair = id; } // tóc không để trống
            else { cur[it.slot] = id; cur = normalize(cur, it.slot); }
            draw(); }; });
          q('[data-buy]').forEach(function (b) { b.onclick = function (e) {
            e.stopPropagation();
            var id = b.dataset.buy, it = cat.items[id];
            if (!confirm('Buy "' + it.name + '" for ' + it.price + ' coins?')) return;
            busy = true; draw();
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
            if (!creating) { var nm = notMine(); if (nm.length) { nm.forEach(takeOff); draw(); } } // đồ mặc thử chưa mua → tự gỡ ra (không hỏi)
            var sb = ov.querySelector('[data-save]'); sb.disabled = true; sb.textContent = '…';
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
