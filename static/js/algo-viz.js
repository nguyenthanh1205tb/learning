/*!
 * algo-viz.js — Thư viện hoạt ảnh thuật toán tương tác (vanilla JS, không phụ thuộc).
 *
 * Nhúng trong Markdown (md_in_html):
 *   <div class="algo-viz" data-viz="sort" data-algo="bubble" data-input="5,1,4,2,8"></div>
 *
 * Kiến trúc: mỗi thuật toán là một hàm "builder" chạy trước toàn bộ thuật toán và ghi lại
 * danh sách các bước (ảnh chụp trạng thái + chú thích tiếng Việt + bộ đếm). Một Player dùng
 * chung vẽ từng bước bằng SVG inline và cung cấp các nút điều khiển.
 *
 * Test hook: element.__algoViz = { steps, goto(i), index, result }
 */
(function () {
  'use strict';
  if (window.AlgoViz && window.AlgoViz._loaded) return;

  var REG = {};
  function reg(viz, algos, fn) {
    REG[viz] = REG[viz] || {};
    algos.split(',').forEach(function (a) { REG[viz][a.trim()] = fn; });
  }

  /* ================================================================
   * 1. Tiện ích
   * ================================================================ */
  function VizErr(msg) { this.message = msg; this.name = 'VizErr'; }
  VizErr.prototype = Object.create(Error.prototype);
  function fail(msg) { throw new VizErr(msg); }

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ESC[c]; }); }
  function fmt(v) {
    if (v === Infinity) return '∞';
    if (v === -Infinity) return '-∞';
    if (v == null) return '';
    return String(v);
  }
  function b(v) { return '<b>' + esc(fmt(v)) + '</b>'; }
  function code(v) { return '<code>' + esc(fmt(v)) + '</code>'; }
  function arrS(a) { return '[' + a.map(fmt).join(', ') + ']'; }
  function bA(a) { return b(arrS(a)); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function clone(o) {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) return o.map(clone);
    var r = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = clone(o[k]);
    return r;
  }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function swap(a, i, j) { var t = a[i]; a[i] = a[j]; a[j] = t; }
  function mk(n, fn) { var a = []; for (var i = 0; i < n; i++) a.push(fn(i)); return a; }
  function tw(s, fs) { return String(s).length * (fs || 13) * 0.62; }

  /** Đọc & kiểm tra thuộc tính data-*. Lỗi → VizErr với thông báo tiếng Việt. */
  function params(el) {
    function raw(n) { var v = el.getAttribute('data-' + n); return v == null ? '' : String(v).trim(); }
    function need(n, ex) {
      var v = raw(n);
      if (v === '') fail('Thiếu thuộc tính <code>data-' + n + '</code>' + (ex ? ' (ví dụ: <code>data-' + n + '="' + esc(ex) + '"</code>)' : '') + '.');
      return v;
    }
    var P = {
      raw: raw,
      has: function (n) { return raw(n) !== ''; },
      nums: function (n, o) {
        o = o || {};
        if (!P.has(n) && o.def) return o.def.slice();
        var parts = need(n, o.ex || '5,1,4,2,8').split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; });
        var out = parts.map(function (x) {
          if (!/^[-+]?\d+$/.test(x)) fail('Giá trị "' + esc(x) + '" trong <code>data-' + n + '</code> không phải số nguyên.');
          return parseInt(x, 10);
        });
        var min = o.min != null ? o.min : -999, max = o.max != null ? o.max : 999;
        var minL = o.minLen != null ? o.minLen : 1, maxL = o.maxLen != null ? o.maxLen : 16;
        out.forEach(function (v) { if (v < min || v > max) fail('Giá trị ' + v + ' trong <code>data-' + n + '</code> nằm ngoài khoảng cho phép ' + min + '..' + max + '.'); });
        if (out.length < minL) fail('<code>data-' + n + '</code> cần ít nhất ' + minL + ' giá trị.');
        if (out.length > maxL) fail('<code>data-' + n + '</code> chỉ cho phép tối đa ' + maxL + ' giá trị (hiện có ' + out.length + ').');
        return out;
      },
      int: function (n, o) {
        o = o || {};
        var s = raw(n);
        if (s === '') { if ('def' in o) return o.def; need(n, o.ex); }
        if (!/^[-+]?\d+$/.test(s)) fail('<code>data-' + n + '="' + esc(s) + '"</code> phải là một số nguyên.');
        var v = parseInt(s, 10);
        if (o.min != null && v < o.min) fail('<code>data-' + n + '</code> phải ≥ ' + o.min + ' (hiện là ' + v + ').');
        if (o.max != null && v > o.max) fail('<code>data-' + n + '</code> phải ≤ ' + o.max + ' (hiện là ' + v + ').');
        return v;
      },
      list: function (n, o) {
        o = o || {};
        var out = need(n, o.ex).split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; });
        if (!out.length) fail('<code>data-' + n + '</code> đang rỗng.');
        if (o.maxLen && out.length > o.maxLen) fail('<code>data-' + n + '</code> chỉ cho phép tối đa ' + o.maxLen + ' phần tử.');
        if (o.itemMax) out.forEach(function (x) { if (x.length > o.itemMax) fail('Phần tử "' + esc(x) + '" trong <code>data-' + n + '</code> quá dài (tối đa ' + o.itemMax + ' ký tự).'); });
        return out;
      },
      str: function (n, o) {
        o = o || {};
        var s = need(n, o.ex);
        if (o.maxLen && s.length > o.maxLen) fail('<code>data-' + n + '</code> quá dài (tối đa ' + o.maxLen + ' ký tự).');
        return s;
      },
      bool: function (n) { return /^(true|1|yes|on)$/i.test(raw(n)); }
    };
    return P;
  }

  /** Bộ ghi bước: mỗi bước = trạng thái (đã sao chép) + chú thích + bộ đếm. */
  function Rec(counters) {
    this.steps = []; this.c = {};
    var self = this;
    (counters || []).forEach(function (k) { self.c[k] = 0; });
  }
  Rec.prototype.inc = function (k, d) { this.c[k] = (this.c[k] || 0) + (d == null ? 1 : d); };
  Rec.prototype.s = function (cap, state) {
    state = state || {};
    state.cap = cap;
    state.st = Object.assign({}, this.c);
    this.steps.push(state);
    if (this.steps.length > 3000) fail('Dữ liệu quá lớn: vượt quá 3000 bước hoạt ảnh. Hãy dùng đầu vào nhỏ hơn.');
    return state;
  };

  /* ================================================================
   * 2. SVG primitives (chuỗi) + khối bố cục
   * ================================================================ */
  function sc(st) { return st ? ' s-' + st : ''; }
  function R(x, y, w, h, st, rx, extra) {
    return '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(w) + '" height="' + r1(h) + '" rx="' + (rx == null ? 4 : rx) + '" class="av-box' + sc(st) + (extra ? ' ' + extra : '') + '"/>';
  }
  function T(x, y, s, cls, anc) {
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" class="av-t ' + (cls || '') + '" text-anchor="' + (anc || 'middle') + '" dominant-baseline="central">' + esc(fmt(s)) + '</text>';
  }
  function C(cx, cy, r, st, extra) {
    return (extra ? '' : '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="' + r1(r) + '" class="av-under"/>') + '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="' + r1(r) + '" class="av-box' + sc(st) + (extra ? ' ' + extra : '') + '"/>';
  }
  function L(x1, y1, x2, y2, st, extra) {
    return '<line x1="' + r1(x1) + '" y1="' + r1(y1) + '" x2="' + r1(x2) + '" y2="' + r1(y2) + '" class="av-ln' + sc(st) + (extra ? ' ' + extra : '') + '"/>';
  }
  function head(x, y, ux, uy, st, sz) {
    sz = sz || 8;
    var px = -uy, py = ux;
    var bx = x - ux * sz, by = y - uy * sz;
    return '<path class="av-hd' + sc(st) + '" d="M' + r1(x) + ',' + r1(y) + 'L' + r1(bx + px * sz * 0.5) + ',' + r1(by + py * sz * 0.5) + 'L' + r1(bx - px * sz * 0.5) + ',' + r1(by - py * sz * 0.5) + 'Z"/>';
  }
  /** Mũi tên thẳng, rút ngắn s1 ở đầu và s2 ở cuối. */
  function arrow(x1, y1, x2, y2, st, s1, s2, noHead) {
    var dx = x2 - x1, dy = y2 - y1, d = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / d, uy = dy / d;
    var ax = x1 + ux * (s1 || 0), ay = y1 + uy * (s1 || 0), bx = x2 - ux * (s2 || 0), by = y2 - uy * (s2 || 0);
    if (noHead) return L(ax, ay, bx, by, st);
    return L(ax, ay, bx - ux * 5, by - uy * 5, st) + head(bx, by, ux, uy, st);
  }
  /** Cung cong (bậc 2) từ (x1,y1) tới (x2,y2), lệch "bend" theo pháp tuyến. */
  function curve(x1, y1, x2, y2, bend, st, s1, s2, noHead) {
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, d = Math.sqrt(dx * dx + dy * dy) || 1;
    var cx = mx - dy / d * bend, cy = my + dx / d * bend;
    function trim(px, py, qx, qy, s) { var ex = qx - px, ey = qy - py, e = Math.sqrt(ex * ex + ey * ey) || 1; return [px + ex / e * s, py + ey / e * s]; }
    var a = trim(x1, y1, cx, cy, s1 || 0), z = trim(x2, y2, cx, cy, s2 || 0);
    var ux = z[0] - cx, uy = z[1] - cy, e = Math.sqrt(ux * ux + uy * uy) || 1; ux /= e; uy /= e;
    var p = '<path class="av-ln' + sc(st) + '" d="M' + r1(a[0]) + ',' + r1(a[1]) + 'Q' + r1(cx) + ',' + r1(cy) + ' ' + r1(z[0]) + ',' + r1(z[1]) + '"/>';
    return { s: p + (noHead ? '' : head(z[0], z[1], ux, uy, st)), lx: 0.25 * x1 + 0.5 * cx + 0.25 * x2, ly: 0.25 * y1 + 0.5 * cy + 0.25 * y2 };
  }

  function blk(w, h, s) { return { w: w, h: h, s: s || '' }; }
  function tr(x, y, s) { return '<g transform="translate(' + r1(x) + ',' + r1(y) + ')">' + s + '</g>'; }
  function vstack(bs, gap, left) {
    gap = gap == null ? 16 : gap;
    bs = bs.filter(Boolean);
    var W = Math.max.apply(null, bs.map(function (q) { return q.w; }).concat([0])), y = 0, s = '';
    bs.forEach(function (q, i) { s += tr(left ? 0 : (W - q.w) / 2, y, q.s); y += q.h + (i < bs.length - 1 ? gap : 0); });
    return blk(W, y, s);
  }
  function hstack(bs, gap) {
    gap = gap == null ? 24 : gap;
    bs = bs.filter(Boolean);
    var H = Math.max.apply(null, bs.map(function (q) { return q.h; }).concat([0])), x = 0, s = '';
    bs.forEach(function (q, i) { s += tr(x, 0, q.s); x += q.w + (i < bs.length - 1 ? gap : 0); });
    return blk(x, H, s);
  }
  /** Dòng chữ (nhãn) dạng khối. */
  function tb(str, cls, fs) { fs = fs || 13; return blk(Math.max(tw(str, fs), 10), fs + 8, T(0, (fs + 8) / 2, str, cls || 'av-lb', 'start')); }
  /** Giữ chỗ để bố cục không nhảy. */
  function sp(w, h) { return blk(w, h, ''); }

  /** Nhãn con trỏ (i, j, lo, mid...) — nhiều tên cùng ô thì xếp chồng. */
  function ptrMax(p) {
    var by = {}, m = 1;
    for (var k in p) { var i = p[k]; if (i == null) continue; by[i] = (by[i] || 0) + 1; m = Math.max(m, by[i]); }
    return m;
  }
  function ptrs(p, xf, y, up, n) {
    var by = {}, s = '';
    for (var k in p) { var i = p[k]; if (i == null || i < 0 || i >= n) continue; (by[i] = by[i] || []).push(k); }
    Object.keys(by).forEach(function (i) {
      var x = xf(+i), names = by[i];
      if (up) {
        s += '<path class="av-ph" d="M' + r1(x - 5) + ',' + r1(y - 8) + 'L' + r1(x + 5) + ',' + r1(y - 8) + 'L' + r1(x) + ',' + r1(y) + 'Z"/>';
        names.forEach(function (nm, k) { s += T(x, y - 17 - k * 13, nm, 'av-p'); });
      } else {
        s += '<path class="av-ph" d="M' + r1(x - 5) + ',' + r1(y + 8) + 'L' + r1(x + 5) + ',' + r1(y + 8) + 'L' + r1(x) + ',' + r1(y) + 'Z"/>';
        names.forEach(function (nm, k) { s += T(x, y + 17 + k * 13, nm, 'av-p'); });
      }
    });
    return s;
  }

  /**
   * Một hàng ô (mảng). o: {w,h,g,cls[],idx:true|[],ptr:{},ptrRows,br:[{l,r,t,st}],label,labelW,sub:[] }
   */
  function cells(vals, o) {
    o = o || {};
    var w = o.w || 32, h = o.h || 30, g = o.g == null ? 4 : o.g, n = vals.length;
    var lab = o.label != null ? (o.labelW || tw(o.label, 12) + 12) : 0;
    var X = function (i) { return lab + i * (w + g); };
    var s = '', y = 0;
    if (o.ptrUp) y = 22 + 13 * ((o.ptrRows || ptrMax(o.ptr || {})) - 1);
    if (o.label != null) s += T(lab - 8, y + h / 2, o.label, 'av-lb', 'end');
    vals.forEach(function (v, i) {
      s += R(X(i), y, w, h, o.cls && o.cls[i]);
      s += T(X(i) + w / 2, y + h / 2, v, w < 26 || String(fmt(v)).length > 3 ? 'av-v av-sm' : 'av-v');
    });
    var yb = y + h;
    if (o.idx) {
      vals.forEach(function (v, i) { s += T(X(i) + w / 2, yb + 9, o.idx === true ? i : o.idx[i], 'av-i'); });
      yb += 18;
    }
    if (o.br) {
      o.br.forEach(function (q) {
        if (q.l == null || q.r == null || q.l > q.r) { yb += 26; return; }
        var x1 = X(q.l) + 2, x2 = X(q.r) + w - 2;
        s += L(x1, yb + 4, x2, yb + 4, q.st || 'cur', 'av-br') + L(x1, yb, x1, yb + 6, q.st || 'cur', 'av-br') + L(x2, yb, x2, yb + 6, q.st || 'cur', 'av-br');
        if (q.t) s += T((x1 + x2) / 2, yb + 16, q.t, 'av-p');
        yb += 26;
      });
    }
    if (o.ptr && o.ptrUp) s += ptrs(o.ptr, function (i) { return X(i) + w / 2; }, y - 2, true, n);
    else if (o.ptr) { s += ptrs(o.ptr, function (i) { return X(i) + w / 2; }, yb + 2, false, n); yb += 24 + 13 * ((o.ptrRows || ptrMax(o.ptr)) - 1) + 4; }
    return blk(Math.max(lab + n * (w + g) - g, 10), yb, s);
  }

  /** Cột (bar chart) cho sort. */
  function bars(st, rows) {
    var a = st.a, n = a.length, bw = n > 10 ? 27 : 36, g = n > 10 ? 4 : 6, H = 120;
    var mx = Math.max.apply(null, a.concat([1]));
    var X = function (i) { return i * (bw + g); };
    var s = '', base = H + 20;
    a.forEach(function (v, i) {
      if (v == null) { s += R(X(i), base - 4, bw, 4, 'dim', 1); return; }
      var h = 6 + (H - 6) * v / mx;
      s += R(X(i), base - h, bw, h, st.cls[i], 3);
      s += T(X(i) + bw / 2, base - h - 9, v, 'av-v');
      s += T(X(i) + bw / 2, base + 10, i, 'av-i');
    });
    s += ptrs(st.ptr || {}, function (i) { return X(i) + bw / 2; }, base + 21, false, n);
    return blk(n * (bw + g) - g, base + 21 + 24 + 13 * ((rows || 2) - 1), s);
  }

  /** Cây nhị phân dạng heap (mảng) — vị trí theo tầng. */
  function heapTree(vals, cls, size, o) {
    o = o || {};
    var n = size == null ? vals.length : size, depth = 0;
    while ((1 << (depth + 1)) - 1 < Math.max(vals.length, 1)) depth++;
    var slot = o.slot || 38, W = Math.max((1 << depth) * slot, 60), lh = 50, r = 15, s = '';
    function pos(i) { var d = Math.floor(Math.log2(i + 1)), p = i - ((1 << d) - 1); return [(p + 0.5) * W / (1 << d), r + 2 + d * lh]; }
    for (var i = 1; i < n; i++) { var a = pos(i), q = pos((i - 1) >> 1); s += L(q[0], q[1], a[0], a[1], cls && (cls[i] === 'swap' && cls[(i - 1) >> 1] === 'swap') ? 'swap' : ''); }
    for (i = 0; i < n; i++) {
      var p = pos(i);
      s += C(p[0], p[1], r, cls && cls[i]);
      s += T(p[0], p[1], vals[i], String(vals[i]).length > 2 ? 'av-v av-sm' : 'av-v');
      if (o.idx) s += T(p[0] + r + 2, p[1] - r + 2, i, 'av-i', 'start');
    }
    return blk(W, r * 2 + 4 + depth * lh, s);
  }

  /* ================================================================
   * 3. Player
   * ================================================================ */
  var SPEEDS = [1700, 1150, 750, 420, 200];

  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function Player(el, def, title) {
    var self = this;
    this.el = el; this.def = def; this.i = 0; this.timer = null;
    el.innerHTML = '';
    el.classList.add('av-on');
    if (title) el.appendChild(h('div', 'av-title', esc(title)));
    this.stage = h('div', 'av-stage');
    this.cap = h('div', 'av-cap'); this.cap.setAttribute('aria-live', 'polite');
    var ctrl = h('div', 'av-ctrl');
    function btn(txt, aria, fn) {
      var x = h('button', 'av-btn', txt); x.type = 'button'; x.setAttribute('aria-label', aria); x.title = aria;
      x.addEventListener('click', fn); ctrl.appendChild(x); return x;
    }
    this.bReset = btn('⏮', 'Về bước đầu (reset)', function () { self.pause(); self.show(0); });
    this.bPrev = btn('◀', 'Lùi một bước', function () { self.pause(); self.show(self.i - 1); });
    this.bPlay = btn('▶', 'Chạy tự động', function () { self.toggle(); });
    this.bPlay.classList.add('av-play');
    this.bNext = btn('▶|', 'Tiến một bước', function () { self.pause(); self.show(self.i + 1); });
    var sl = h('label', 'av-speed');
    sl.appendChild(h('span', null, 'Tốc độ'));
    this.speed = h('input'); this.speed.type = 'range'; this.speed.min = 1; this.speed.max = 5; this.speed.value = 3;
    this.speed.setAttribute('aria-label', 'Tốc độ chạy');
    sl.appendChild(this.speed); ctrl.appendChild(sl);
    this.stepEl = h('span', 'av-step'); ctrl.appendChild(this.stepEl);
    this.stats = h('div', 'av-stats');
    this.legend = h('div', 'av-legend');
    (def.leg || []).forEach(function (q) {
      var it = h('span', 'av-lg'); it.appendChild(h('i', 'av-sw s-' + q[0])); it.appendChild(document.createTextNode(q[1])); self.legend.appendChild(it);
    });
    el.appendChild(this.stage); el.appendChild(this.cap); el.appendChild(ctrl); el.appendChild(this.stats);
    if (def.leg && def.leg.length) el.appendChild(this.legend);
    el.setAttribute('tabindex', el.getAttribute('tabindex') || '0');
    el.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|BUTTON/.test(e.target.tagName) && e.key === ' ') return;
      if (e.key === 'ArrowRight') { self.pause(); self.show(self.i + 1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { self.pause(); self.show(self.i - 1); e.preventDefault(); }
      else if (e.key === ' ' && e.target === el) { self.toggle(); e.preventDefault(); }
    });
    // Đo kích thước lớn nhất qua mọi bước → khung cố định, không nhảy bố cục.
    var W = 0, H = 0;
    def.steps.forEach(function (st, k) { var q = def.render(st, k); W = Math.max(W, q.w); H = Math.max(H, q.h); });
    this.W = W; this.H = H;
    var api = {
      steps: def.steps, result: def.result, index: 0,
      goto: function (i) { self.pause(); self.show(i); return api.index; },
      play: function () { self.play(); }, pause: function () { self.pause(); }
    };
    this.api = api;
    el.__algoViz = api;
    this.show(0);
  }
  Player.prototype.show = function (i) {
    var steps = this.def.steps;
    i = Math.max(0, Math.min(steps.length - 1, i | 0));
    this.i = i; this.api.index = i;
    var st = steps[i], q = this.def.render(st, i), p = 10, W = this.W + 2 * p, Hh = this.H + 2 * p;
    this.stage.innerHTML = '<svg class="av-svg" viewBox="0 0 ' + r1(W) + ' ' + r1(Hh) + '" style="max-width:' + Math.round(W * 1.3) + 'px" role="img" aria-label="' + esc((this.el.getAttribute('data-title') || 'Minh họa thuật toán') + ' — bước ' + (i + 1)) + '" xmlns="http://www.w3.org/2000/svg">' +
      tr(p + (this.W - q.w) / 2, p, q.s) + '</svg>';
    this.cap.innerHTML = st.cap || '';
    this.stepEl.textContent = 'Bước ' + (i + 1) + '/' + steps.length;
    var ks = Object.keys(st.st || {});
    this.stats.innerHTML = ks.map(function (k) { return '<span class="av-stat">' + esc(k) + ': <b>' + esc(fmt(st.st[k])) + '</b></span>'; }).join('');
    this.stats.style.display = ks.length ? '' : 'none';
    this.bPrev.disabled = i === 0; this.bReset.disabled = i === 0;
    this.bNext.disabled = i === steps.length - 1;
  };
  Player.prototype.toggle = function () { if (this.timer) this.pause(); else this.play(); };
  Player.prototype.play = function () {
    var self = this;
    if (this.i >= this.def.steps.length - 1) this.show(0);
    this.bPlay.textContent = '⏸'; this.bPlay.setAttribute('aria-label', 'Tạm dừng'); this.bPlay.title = 'Tạm dừng';
    function tick() {
      if (!self.el.isConnected) { self.pause(); return; }
      if (self.i >= self.def.steps.length - 1) { self.pause(); return; }
      self.show(self.i + 1);
      self.timer = setTimeout(tick, SPEEDS[(+self.speed.value || 3) - 1]);
    }
    this.timer = setTimeout(tick, Math.min(500, SPEEDS[(+self.speed.value || 3) - 1]));
  };
  Player.prototype.pause = function () {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.bPlay.textContent = '▶'; this.bPlay.setAttribute('aria-label', 'Chạy tự động'); this.bPlay.title = 'Chạy tự động';
  };

  /* ================================================================
   * 4. SORT
   * ================================================================ */
  var LEG_SORT = [['cmp', 'đang so sánh'], ['swap', 'hoán đổi / ghi'], ['done', 'đã đúng vị trí']];

  function sortBase(P, counters) {
    var a = P.nums('input', { min: 0, max: 99, maxLen: 16 });
    var rec = new Rec(counters), done = {};
    function snap(cap, marks, ptr, x) {
      marks = marks || {};
      var cls = a.map(function (_, i) { return marks[i] || (done[i] ? 'done' : ''); });
      rec.s(cap, { a: a.slice(), cls: cls, ptr: Object.assign({}, ptr || {}), x: x ? clone(x) : null });
    }
    function allDone() { a.forEach(function (_, i) { done[i] = 1; }); }
    return { a: a, rec: rec, done: done, snap: snap, allDone: allDone };
  }
  function M() { var m = {}; for (var i = 0; i < arguments.length; i += 2) if (arguments[i] != null) m[arguments[i]] = arguments[i + 1]; return m; }
  function sortOut(S, render, leg) {
    return { steps: S.rec.steps, render: render || function (st) { return bars(st); }, leg: leg || LEG_SORT, result: S.a.slice() };
  }

  reg('sort', 'bubble', function (P) {
    var S = sortBase(P, ['so sánh', 'hoán đổi']), a = S.a, n = a.length;
    S.snap('Mảng ban đầu ' + bA(a) + '. Bubble sort so sánh từng cặp kề nhau; phần tử lớn nhất sẽ "nổi" dần về cuối.');
    for (var i = 0; i < n - 1; i++) {
      var sw = false;
      for (var j = 0; j < n - 1 - i; j++) {
        S.rec.inc('so sánh');
        var p = { j: j, 'j+1': j + 1 };
        if (a[j] > a[j + 1]) {
          S.snap('Lượt ' + (i + 1) + ': so sánh ' + b(a[j]) + ' và ' + b(a[j + 1]) + ' → ' + a[j] + ' > ' + a[j + 1] + ' nên hoán đổi', M(j, 'cmp', j + 1, 'cmp'), p);
          swap(a, j, j + 1); S.rec.inc('hoán đổi'); sw = true;
          S.snap('Đã hoán đổi → ' + b(a[j]) + ' đứng trước ' + b(a[j + 1]), M(j, 'swap', j + 1, 'swap'), p);
        } else {
          S.snap('Lượt ' + (i + 1) + ': so sánh ' + b(a[j]) + ' và ' + b(a[j + 1]) + ' → ' + a[j] + ' ≤ ' + a[j + 1] + ' nên giữ nguyên', M(j, 'cmp', j + 1, 'cmp'), p);
        }
      }
      S.done[n - 1 - i] = 1;
      if (!sw) { S.allDone(); S.snap('Lượt ' + (i + 1) + ' không có hoán đổi nào → mảng đã được sắp xếp, dừng sớm.'); break; }
      S.snap('Hết lượt ' + (i + 1) + ': ' + b(a[n - 1 - i]) + ' đã về đúng vị trí ' + (n - 1 - i) + '.');
    }
    S.allDone();
    S.snap('Hoàn tất! Mảng đã sắp xếp: ' + bA(a));
    return sortOut(S);
  });

  reg('sort', 'selection', function (P) {
    var S = sortBase(P, ['so sánh', 'hoán đổi']), a = S.a, n = a.length;
    S.snap('Mảng ban đầu ' + bA(a) + '. Selection sort: mỗi lượt tìm phần tử nhỏ nhất trong phần chưa sắp rồi đưa về đầu.');
    for (var i = 0; i < n - 1; i++) {
      var m = i;
      S.snap('Lượt ' + (i + 1) + ': tìm min trong đoạn [' + i + '..' + (n - 1) + ']; tạm coi min = a[' + i + '] = ' + b(a[i]), M(i, 'piv'), { i: i, min: i });
      for (var j = i + 1; j < n; j++) {
        S.rec.inc('so sánh');
        var less = a[j] < a[m];
        S.snap('So sánh a[' + j + '] = ' + b(a[j]) + ' với min hiện tại ' + b(a[m]) + ' → ' + (less ? a[j] + ' < ' + a[m] + ' nên cập nhật min = ' + a[j] : a[j] + ' ≥ ' + a[m] + ', giữ nguyên min'), M(m, 'piv', j, 'cmp'), { i: i, j: j, min: m });
        if (less) m = j;
      }
      if (m !== i) {
        swap(a, i, m); S.rec.inc('hoán đổi');
        S.snap('Hoán đổi a[' + i + '] và a[' + m + '] → ' + b(a[i]) + ' về vị trí ' + i, M(i, 'swap', m, 'swap'), { i: i, min: m });
      } else S.snap('min đã nằm ở vị trí ' + i + ' → không cần hoán đổi', M(i, 'piv'), { i: i });
      S.done[i] = 1;
    }
    S.allDone();
    S.snap('Hoàn tất! Mảng đã sắp xếp: ' + bA(a));
    return sortOut(S, null, [['cmp', 'đang so sánh'], ['piv', 'min hiện tại'], ['swap', 'hoán đổi'], ['done', 'đã đúng vị trí']]);
  });

  reg('sort', 'insertion', function (P) {
    var S = sortBase(P, ['so sánh', 'dịch chuyển']), a = S.a, n = a.length;
    function pre(k, extra) { var m = {}; for (var t = 0; t < k; t++) m[t] = 'vis'; return Object.assign(m, extra || {}); }
    S.snap('Mảng ban đầu ' + bA(a) + '. Insertion sort: lần lượt chèn từng phần tử vào đúng chỗ trong đoạn đầu đã sắp.', pre(1));
    for (var i = 1; i < n; i++) {
      var key = a[i], j = i;
      S.snap('Lấy key = a[' + i + '] = ' + b(key) + ', chèn vào đoạn đã sắp [0..' + (i - 1) + ']', pre(i, M(i, 'cur')), { i: i });
      while (j > 0) {
        S.rec.inc('so sánh');
        if (a[j - 1] > a[j]) {
          S.snap('So sánh ' + b(a[j - 1]) + ' với key ' + b(key) + ' → ' + a[j - 1] + ' > ' + key + ' nên dịch ' + a[j - 1] + ' sang phải', pre(i + 1, M(j - 1, 'cmp', j, 'cur')), { j: j - 1, i: i });
          swap(a, j - 1, j); S.rec.inc('dịch chuyển'); j--;
          S.snap('Đã dịch: key ' + b(key) + ' lùi về vị trí ' + j, pre(i + 1, M(j, 'swap', j + 1, 'swap')), { j: j, i: i });
        } else {
          S.snap('So sánh ' + b(a[j - 1]) + ' với key ' + b(key) + ' → ' + a[j - 1] + ' ≤ ' + key + ' nên dừng; key đứng ở vị trí ' + j, pre(i + 1, M(j - 1, 'cmp', j, 'cur')), { j: j - 1, i: i });
          break;
        }
      }
      if (j === 0) S.snap('key ' + b(key) + ' nhỏ nhất đến giờ → đặt ở đầu mảng', pre(i + 1, M(0, 'cur')), { i: i });
    }
    S.allDone();
    S.snap('Hoàn tất! Mảng đã sắp xếp: ' + bA(a));
    return sortOut(S, null, [['cur', 'key đang chèn'], ['cmp', 'đang so sánh'], ['swap', 'dịch chuyển'], ['vis', 'đoạn đã sắp'], ['done', 'hoàn tất']]);
  });

  reg('sort', 'merge', function (P) {
    var S = sortBase(P, ['so sánh', 'ghi']), a = S.a, n = a.length;
    function rng(lo, hi, st, extra) { var m = {}; for (var t = lo; t <= hi; t++) m[t] = st; return Object.assign(m, extra || {}); }
    S.snap('Mảng ban đầu ' + bA(a) + '. Merge sort: chia đôi đến khi còn 1 phần tử, rồi trộn các đoạn đã sắp.');
    function ms(lo, hi) {
      if (lo >= hi) return;
      var mid = (lo + hi) >> 1;
      S.snap('Chia đoạn [' + lo + '..' + hi + '] thành [' + lo + '..' + mid + '] và [' + (mid + 1) + '..' + hi + ']', Object.assign(rng(lo, mid, 'vis'), rng(mid + 1, hi, 'q')), { lo: lo, mid: mid, hi: hi });
      ms(lo, mid); ms(mid + 1, hi);
      var Lh = a.slice(lo, mid + 1), Rh = a.slice(mid + 1, hi + 1), i = 0, j = 0, k = lo;
      S.snap('Trộn hai đoạn đã sắp L = ' + bA(Lh) + ' và R = ' + bA(Rh), Object.assign(rng(lo, mid, 'vis'), rng(mid + 1, hi, 'q')), { lo: lo, hi: hi }, { L: Lh, R: Rh, i: 0, j: 0 });
      while (i < Lh.length && j < Rh.length) {
        S.rec.inc('so sánh'); S.rec.inc('ghi');
        var takeL = Lh[i] <= Rh[j];
        a[k] = takeL ? Lh[i] : Rh[j];
        S.snap('So sánh L[' + i + '] = ' + b(Lh[i]) + ' và R[' + j + '] = ' + b(Rh[j]) + ' → ' + (takeL ? Lh[i] + ' ≤ ' + Rh[j] : Lh[i] + ' > ' + Rh[j]) + ' nên ghi ' + b(a[k]) + ' vào a[' + k + ']', Object.assign(rng(k + 1, hi, 'dim'), rng(lo, k - 1, 'vis'), M(k, 'swap')), { k: k }, { L: Lh, R: Rh, i: i, j: j, pick: takeL ? 'L' : 'R' });
        if (takeL) i++; else j++;
        k++;
      }
      while (i < Lh.length || j < Rh.length) {
        var fromL = i < Lh.length;
        a[k] = fromL ? Lh[i] : Rh[j]; S.rec.inc('ghi');
        S.snap((fromL ? 'R' : 'L') + ' đã hết → chép phần còn lại ' + b(a[k]) + ' của ' + (fromL ? 'L' : 'R') + ' vào a[' + k + ']', Object.assign(rng(k + 1, hi, 'dim'), rng(lo, k - 1, 'vis'), M(k, 'swap')), { k: k }, { L: Lh, R: Rh, i: i, j: j, pick: fromL ? 'L' : 'R' });
        if (fromL) i++; else j++;
        k++;
      }
      if (lo === 0 && hi === n - 1) S.allDone();
      S.snap('Đoạn [' + lo + '..' + hi + '] đã trộn xong: ' + bA(a.slice(lo, hi + 1)), rng(lo, hi, lo === 0 && hi === n - 1 ? 'done' : 'vis'));
    }
    ms(0, n - 1);
    S.allDone();
    S.snap('Hoàn tất! Mảng đã sắp xếp: ' + bA(a));
    var maxL = Math.ceil(n / 2);
    return sortOut(S, function (st) {
      var x = st.x, w = n > 10 ? 27 : 32;
      var sub = x ? hstack([
        cells(x.L, { w: w, label: 'L', cls: x.L.map(function (_, t) { return t < x.i ? 'dim' : (t === x.i && x.pick === 'L' ? 'cmp' : (t === x.i ? 'cmp' : '')); }), ptr: x.i < x.L.length ? { i: x.i } : {}, ptrRows: 1 }),
        cells(x.R, { w: w, label: 'R', cls: x.R.map(function (_, t) { return t < x.j ? 'dim' : (t === x.j ? 'cmp' : ''); }), ptr: x.j < x.R.length ? { j: x.j } : {}, ptrRows: 1 })
      ], 28) : null;
      var ph = cells(range(maxL), { w: w, label: 'L', ptr: { i: 0 }, ptrRows: 1 });
      return vstack([bars(st, 3), sub ? vstack([sub, sp(1, ph.h - sub.h)], 0) : sp(ph.w * 2 + 28, ph.h)]);
    }, [['vis', 'đoạn trái / đã trộn'], ['q', 'đoạn phải'], ['cmp', 'đang so sánh'], ['swap', 'vừa ghi'], ['done', 'đã xong']]);
  });

  reg('sort', 'quick', function (P) {
    var S = sortBase(P, ['so sánh', 'hoán đổi']), a = S.a, n = a.length;
    function marks(lo, hi, i, extra) {
      var m = {};
      for (var t = 0; t < n; t++) if (!S.done[t] && (t < lo || t > hi)) m[t] = 'dim';
      for (t = lo; t <= i; t++) m[t] = 'vis';
      m[hi] = 'piv';
      return Object.assign(m, extra || {});
    }
    S.snap('Mảng ban đầu ' + bA(a) + '. Quick sort (Lomuto): chọn pivot = phần tử cuối, dồn các phần tử ≤ pivot về bên trái.');
    function qs(lo, hi) {
      if (lo > hi) return;
      if (lo === hi) { S.done[lo] = 1; S.snap('Đoạn [' + lo + '..' + lo + '] chỉ có 1 phần tử (' + b(a[lo]) + ') → đã đúng vị trí', M(lo, 'done')); return; }
      var pv = a[hi], i = lo - 1;
      S.snap('Phân hoạch đoạn [' + lo + '..' + hi + ']: pivot = a[' + hi + '] = ' + b(pv) + ', i = ' + (lo - 1) + ' (ranh giới vùng ≤ pivot)', marks(lo, hi, i), { lo: lo, hi: hi });
      for (var j = lo; j < hi; j++) {
        S.rec.inc('so sánh');
        if (a[j] <= pv) {
          i++;
          var cap = 'So sánh a[' + j + '] = ' + b(a[j]) + ' với pivot ' + b(pv) + ' → ' + a[j] + ' ≤ ' + pv + ' nên tăng i = ' + i + (i !== j ? ' và hoán đổi a[' + i + '] ↔ a[' + j + ']' : ' (i = j, không cần đổi)');
          S.snap(cap, marks(lo, hi, i - 1, M(j, 'cmp')), { i: i, j: j });
          if (i !== j) { swap(a, i, j); S.rec.inc('hoán đổi'); S.snap('Đã hoán đổi → ' + b(a[i]) + ' vào vùng ≤ pivot', marks(lo, hi, i - 1, M(i, 'swap', j, 'swap')), { i: i, j: j }); }
        } else {
          S.snap('So sánh a[' + j + '] = ' + b(a[j]) + ' với pivot ' + b(pv) + ' → ' + a[j] + ' > ' + pv + ' nên bỏ qua', marks(lo, hi, i, M(j, 'cmp')), { i: i >= lo ? i : null, j: j });
        }
      }
      var p = i + 1;
      if (p !== hi) { swap(a, p, hi); S.rec.inc('hoán đổi'); }
      S.done[p] = 1;
      S.snap('Đưa pivot ' + b(pv) + ' về vị trí i + 1 = ' + p + ' → pivot đã đúng chỗ; bên trái ≤ ' + pv + ', bên phải > ' + pv, M(p, 'done', hi, p !== hi ? 'swap' : 'done'), { 'i+1': p });
      qs(lo, p - 1); qs(p + 1, hi);
    }
    qs(0, n - 1);
    S.allDone();
    S.snap('Hoàn tất! Mảng đã sắp xếp: ' + bA(a));
    return sortOut(S, null, [['piv', 'pivot'], ['cmp', 'đang so sánh'], ['vis', 'vùng ≤ pivot'], ['swap', 'hoán đổi'], ['done', 'đã đúng vị trí']]);
  });

  reg('sort', 'heap', function (P) {
    var S = sortBase(P, ['so sánh', 'hoán đổi']), a = S.a, n = a.length;
    function sift(i, size) {
      while (true) {
        var l = 2 * i + 1, r = 2 * i + 2, lg = i;
        if (l >= size) { S.snap('a[' + i + '] = ' + b(a[i]) + ' không có con → dừng', M(i, 'cur'), { i: i }, { size: size }); return; }
        S.rec.inc('so sánh'); if (a[l] > a[lg]) lg = l;
        if (r < size) { S.rec.inc('so sánh'); if (a[r] > a[lg]) lg = r; }
        var kids = 'con trái ' + b(a[l]) + (r < size ? ', con phải ' + b(a[r]) : '');
        if (lg === i) { S.snap('So sánh a[' + i + '] = ' + b(a[i]) + ' với ' + kids + ' → cha đã lớn nhất, dừng', M(i, 'cur', l, 'cmp', r < size ? r : null, 'cmp'), { i: i }, { size: size }); return; }
        S.snap('So sánh a[' + i + '] = ' + b(a[i]) + ' với ' + kids + ' → con lớn nhất là ' + b(a[lg]) + ' > ' + a[i] + ' nên hoán đổi', M(i, 'cur', l, 'cmp', r < size ? r : null, 'cmp'), { i: i }, { size: size });
        swap(a, i, lg); S.rec.inc('hoán đổi');
        S.snap('Đã hoán đổi ' + b(a[lg]) + ' xuống vị trí ' + lg, M(i, 'swap', lg, 'swap'), { i: lg }, { size: size });
        i = lg;
      }
    }
    S.snap('Mảng ban đầu ' + bA(a) + '. Giai đoạn 1: xây max-heap (sift-down từ nút trong cuối cùng về gốc).', {}, {}, { size: n });
    for (var i = (n >> 1) - 1; i >= 0; i--) {
      S.snap('Heapify nút a[' + i + '] = ' + b(a[i]), M(i, 'cur'), { i: i }, { size: n });
      sift(i, n);
    }
    S.snap('Đã có max-heap: phần tử lớn nhất ' + b(a[0]) + ' nằm ở gốc. Giai đoạn 2: lần lượt lấy gốc ra cuối.', M(0, 'piv'), {}, { size: n });
    for (var end = n - 1; end >= 1; end--) {
      swap(a, 0, end); S.rec.inc('hoán đổi'); S.done[end] = 1;
      S.snap('Hoán đổi gốc (max = ' + b(a[end]) + ') với a[' + end + '] → ' + a[end] + ' đã đúng vị trí; heap còn ' + end + ' phần tử', M(0, 'swap', end, 'done'), { end: end }, { size: end });
      if (end > 1) sift(0, end);
    }
    S.allDone();
    S.snap('Hoàn tất! Mảng đã sắp xếp: ' + bA(a), {}, {}, { size: 0 });
    return sortOut(S, function (st) {
      var size = st.x ? st.x.size : 0;
      var t = heapTree(st.a, st.cls, size, { slot: 34 });
      return vstack([bars(st, 1), vstack([tb('Cây heap (' + size + ' phần tử đầu mảng):', 'av-lb', 12), t], 6)]);
    }, [['cur', 'nút đang xét'], ['cmp', 'con đang so sánh'], ['swap', 'hoán đổi'], ['piv', 'gốc = max'], ['done', 'đã đúng vị trí']]);
  });

  reg('sort', 'counting', function (P) {
    var S = sortBase(P, ['đếm', 'ghi']), a = S.a, n = a.length;
    var mn = Math.min.apply(null, a), mx = Math.max.apply(null, a), K = mx - mn + 1, cnt = mk(K, function () { return 0; });
    S.snap('Mảng ban đầu ' + bA(a) + '. Counting sort: đếm số lần xuất hiện của mỗi giá trị (' + mn + '..' + mx + ') rồi ghi lại theo thứ tự.', {}, {}, { cnt: cnt, hi: -1 });
    for (var i = 0; i < n; i++) {
      cnt[a[i] - mn]++; S.rec.inc('đếm');
      S.snap('Đếm: a[' + i + '] = ' + b(a[i]) + ' → count[' + a[i] + '] = ' + b(cnt[a[i] - mn]), M(i, 'cmp'), { i: i }, { cnt: cnt, hi: a[i] - mn });
    }
    S.snap('Đếm xong. Giờ duyệt count từ ' + mn + ' đến ' + mx + ' và ghi mỗi giá trị đúng số lần của nó.', {}, {}, { cnt: cnt, hi: -1 });
    var k = 0, dim = {};
    for (i = 0; i < n; i++) dim[i] = 'dim';
    for (var v = 0; v < K; v++) {
      while (cnt[v] > 0) {
        a[k] = v + mn; cnt[v]--; S.rec.inc('ghi'); S.done[k] = 1; delete dim[k];
        S.snap('count[' + (v + mn) + '] > 0 → ghi ' + b(v + mn) + ' vào a[' + k + '] (count[' + (v + mn) + '] còn ' + cnt[v] + ')', Object.assign({}, dim, M(k, 'swap')), { k: k }, { cnt: cnt, hi: v });
        k++;
      }
    }
    S.allDone();
    S.snap('Hoàn tất! Mảng đã sắp xếp: ' + bA(a), {}, {}, { cnt: cnt, hi: -1 });
    return sortOut(S, function (st) {
      var x = st.x, per = 16, rows = [];
      for (var s0 = 0; s0 < K; s0 += per) {
        var part = x.cnt.slice(s0, s0 + per);
        rows.push(cells(part, { w: 28, h: 26, idx: part.map(function (_, t) { return t + s0 + mn; }), cls: part.map(function (_, t) { return t + s0 === x.hi ? 'cur' : (part[t] ? 'vis' : ''); }) }));
      }
      return vstack([bars(st, 1), vstack([tb('count[giá trị]:', 'av-lb', 12)].concat(rows), 4, true)]);
    }, [['cmp', 'đang đếm'], ['cur', 'ô count đang dùng'], ['swap', 'vừa ghi'], ['done', 'đã xong']]);
  });

  reg('sort', 'radix', function (P) {
    var S = sortBase(P, ['phân phối', 'gom']), a = S.a, n = a.length, mx = Math.max.apply(null, a);
    var NAMES = { 1: 'hàng đơn vị', 10: 'hàng chục', 100: 'hàng trăm' };
    var maxB = 1;
    S.snap('Mảng ban đầu ' + bA(a) + '. Radix sort LSD (cơ số 10): phân phối theo từng chữ số, từ hàng đơn vị lên, vào 10 bucket 0..9.', {}, {}, { bk: mk(10, function () { return []; }), hi: -1, taken: -1 });
    for (var exp = 1; Math.floor(mx / exp) > 0; exp *= 10) {
      var bk = mk(10, function () { return []; });
      S.snap('Xét chữ số ' + NAMES[exp] + ' (exp = ' + exp + ').', {}, {}, { bk: bk, hi: -1, taken: -1 });
      for (var i = 0; i < n; i++) {
        var d = Math.floor(a[i] / exp) % 10;
        bk[d].push(a[i]); S.rec.inc('phân phối'); maxB = Math.max(maxB, bk[d].length);
        S.snap('a[' + i + '] = ' + b(a[i]) + ' có chữ số ' + NAMES[exp] + ' = ' + b(d) + ' → bỏ vào bucket ' + d, M(i, 'cmp'), { i: i }, { bk: bk, hi: d, taken: -1 });
      }
      var k = 0;
      for (d = 0; d < 10; d++) {
        if (!bk[d].length) continue;
        var from = k;
        bk[d].forEach(function (v) { a[k++] = v; S.rec.inc('gom'); });
        var m = {}; for (var t = from; t < k; t++) m[t] = 'swap';
        S.snap('Gom bucket ' + d + ' = ' + bA(bk[d]) + ' → ghi lại vào a[' + from + '..' + (k - 1) + ']', m, {}, { bk: bk, hi: d, taken: d });
      }
      S.snap('Sau khi xét ' + NAMES[exp] + ': ' + bA(a), {}, {}, { bk: mk(10, function () { return []; }), hi: -1, taken: -1 });
    }
    S.allDone();
    S.snap('Hoàn tất! Mảng đã sắp xếp: ' + bA(a), {}, {}, { bk: mk(10, function () { return []; }), hi: -1, taken: -1 });
    return sortOut(S, function (st) {
      var x = st.x, cw = 34, g = 5, bh = 20, H = maxB * (bh + 2), s = '';
      for (var d = 0; d < 10; d++) {
        var X = d * (cw + g);
        s += R(X, 0, cw, H + 4, d === x.hi ? 'q' : '', 3, 'av-bucket');
        x.bk[d].forEach(function (v, t) {
          s += R(X + 2, H + 2 - (t + 1) * (bh + 2), cw - 4, bh, x.taken >= d ? 'dim' : (d === x.hi && t === x.bk[d].length - 1 && x.taken < 0 ? 'cmp' : 'vis'), 3);
          s += T(X + cw / 2, H + 2 - (t + 1) * (bh + 2) + bh / 2, v, 'av-v av-sm');
        });
        s += T(X + cw / 2, H + 16, d, 'av-i');
      }
      return vstack([bars(st, 1), vstack([tb('Bucket 0..9:', 'av-lb', 12), blk(10 * (cw + g) - g, H + 24, s)], 4)]);
    }, [['cmp', 'đang phân phối'], ['q', 'bucket đang dùng'], ['swap', 'vừa gom về'], ['done', 'đã xong']]);
  });

  reg('sort', 'shell', function (P) {
    var S = sortBase(P, ['so sánh', 'hoán đổi']), a = S.a, n = a.length;
    S.snap('Mảng ban đầu ' + bA(a) + '. Shell sort: insertion sort trên các phần tử cách nhau "gap", gap giảm dần n/2, n/4, ..., 1.');
    for (var gap = n >> 1; gap > 0; gap >>= 1) {
      S.snap('gap = ' + b(gap) + ': sắp xếp chèn các dãy con gồm phần tử cách nhau ' + gap + ' vị trí.', {}, { gap: 0 });
      for (var i = gap; i < n; i++) {
        var j = i;
        while (j >= gap) {
          S.rec.inc('so sánh');
          var p = { 'j-gap': j - gap, j: j };
          if (a[j - gap] > a[j]) {
            S.snap('gap ' + gap + ': so sánh a[' + (j - gap) + '] = ' + b(a[j - gap]) + ' và a[' + j + '] = ' + b(a[j]) + ' → ' + a[j - gap] + ' > ' + a[j] + ' nên hoán đổi', M(j - gap, 'cmp', j, 'cmp'), p);
            swap(a, j - gap, j); S.rec.inc('hoán đổi');
            S.snap('Đã hoán đổi → ' + b(a[j - gap]) + ' lùi về vị trí ' + (j - gap), M(j - gap, 'swap', j, 'swap'), p);
            j -= gap;
          } else {
            S.snap('gap ' + gap + ': so sánh a[' + (j - gap) + '] = ' + b(a[j - gap]) + ' và a[' + j + '] = ' + b(a[j]) + ' → ' + a[j - gap] + ' ≤ ' + a[j] + ' nên dừng', M(j - gap, 'cmp', j, 'cmp'), p);
            break;
          }
        }
      }
      S.snap('Xong gap = ' + gap + ': ' + bA(a));
    }
    S.allDone();
    S.snap('Hoàn tất! Mảng đã sắp xếp: ' + bA(a));
    return sortOut(S);
  });

  /* ================================================================
   * 5. SEARCH + ARRAY
   * ================================================================ */
  function cellW(n) { return n > 12 ? 30 : 34; }

  reg('search', 'linear', function (P) {
    var a = P.nums('input'), t = P.int('target'), n = a.length, rec = new Rec(['so sánh']), found = -1;
    function snap(cap, cls, ptr) { rec.s(cap, { cls: cls, ptr: ptr || {} }); }
    snap('Tìm ' + b(t) + ' trong ' + bA(a) + ' bằng cách xét lần lượt từ trái sang phải.', mk(n, function () { return ''; }));
    for (var i = 0; i < n; i++) {
      rec.inc('so sánh');
      var cls = mk(n, function (k) { return k < i ? 'dim' : ''; });
      if (a[i] === t) { cls[i] = 'done'; found = i; snap('So sánh a[' + i + '] = ' + b(a[i]) + ' với ' + b(t) + ' → bằng nhau! Tìm thấy tại chỉ số ' + b(i) + ' sau ' + (i + 1) + ' lần so sánh.', cls, { i: i }); break; }
      cls[i] = 'cmp';
      snap('So sánh a[' + i + '] = ' + b(a[i]) + ' với ' + b(t) + ' → khác nhau, xét phần tử kế tiếp', cls, { i: i });
    }
    if (found < 0) snap('Đã duyệt hết ' + n + ' phần tử mà không thấy ' + b(t) + ' → trả về ' + b(-1), mk(n, function () { return 'dim'; }));
    var w = cellW(n);
    return { steps: rec.steps, result: found, leg: [['cmp', 'đang so sánh'], ['dim', 'đã loại'], ['done', 'tìm thấy']],
      render: function (st) { return cells(a, { w: w, idx: true, cls: st.cls, ptr: st.ptr, ptrRows: 1 }); } };
  });

  reg('search', 'binary', function (P) {
    var a = P.nums('input'), t = P.int('target'), n = a.length, rec = new Rec(['so sánh']), found = -1;
    for (var q = 1; q < n; q++) if (a[q] < a[q - 1]) fail('Binary search cần <code>data-input</code> đã sắp xếp tăng dần (a[' + (q - 1) + '] = ' + a[q - 1] + ' > a[' + q + '] = ' + a[q] + ').');
    function snap(cap, lo, hi, mid, st) {
      var cls = mk(n, function (k) { return k < lo || k > hi ? 'dim' : 'q'; });
      if (mid != null) cls[mid] = st || 'cmp';
      rec.s(cap, { cls: cls, ptr: mid != null ? { lo: lo, mid: mid, hi: hi } : { lo: lo, hi: hi } });
    }
    var lo = 0, hi = n - 1;
    snap('Tìm ' + b(t) + ' trong mảng đã sắp. Vùng tìm kiếm ban đầu: lo = 0, hi = ' + (n - 1) + '.', lo, hi);
    while (lo <= hi) {
      var mid = (lo + hi) >> 1; rec.inc('so sánh');
      var head = 'lo = ' + lo + ', hi = ' + hi + ' → mid = ⌊(' + lo + ' + ' + hi + ') / 2⌋ = ' + mid + ', a[mid] = ' + b(a[mid]);
      if (a[mid] === t) { found = mid; snap(head + ' = ' + t + ' → tìm thấy tại chỉ số ' + b(mid) + '!', lo, hi, mid, 'done'); break; }
      if (a[mid] < t) { snap(head + ' < ' + t + ' → bỏ nửa trái, lo = mid + 1 = ' + (mid + 1), lo, hi, mid); lo = mid + 1; }
      else { snap(head + ' > ' + t + ' → bỏ nửa phải, hi = mid − 1 = ' + (mid - 1), lo, hi, mid); hi = mid - 1; }
    }
    if (found < 0) rec.s('lo = ' + lo + ' > hi = ' + hi + ' → vùng tìm kiếm rỗng, không có ' + b(t) + ' → trả về ' + b(-1), { cls: mk(n, function () { return 'dim'; }), ptr: {} });
    var w = cellW(n);
    return { steps: rec.steps, result: found, leg: [['q', 'vùng tìm kiếm'], ['cmp', 'mid'], ['dim', 'đã loại'], ['done', 'tìm thấy']],
      render: function (st) { return cells(a, { w: w, idx: true, cls: st.cls, ptr: st.ptr, ptrRows: 3 }); } };
  });

  reg('array', 'two-pointers', function (P) {
    var a = P.nums('input'), t = P.int('target'), n = a.length, rec = new Rec(['so sánh']), res = null;
    for (var q = 1; q < n; q++) if (a[q] < a[q - 1]) fail('Two pointers cần <code>data-input</code> đã sắp xếp tăng dần.');
    function snap(cap, l, r, st) {
      var cls = mk(n, function (k) { return k < l || k > r ? 'dim' : ''; });
      if (l < n) cls[l] = st || 'cmp'; if (r >= 0) cls[r] = st || 'cmp';
      rec.s(cap, { cls: cls, ptr: { L: l, R: r } });
    }
    var l = 0, r = n - 1;
    snap('Tìm cặp có tổng = ' + b(t) + '. Đặt L ở đầu, R ở cuối mảng đã sắp.', l, r);
    while (l < r) {
      var s = a[l] + a[r]; rec.inc('so sánh');
      var hd = 'a[L] + a[R] = ' + a[l] + ' + ' + a[r] + ' = ' + b(s);
      if (s === t) { res = [l, r]; snap(hd + ' = ' + t + ' → tìm thấy cặp (' + a[l] + ', ' + a[r] + ') tại chỉ số ' + l + ' và ' + r + '!', l, r, 'done'); break; }
      if (s < t) { snap(hd + ' < ' + t + ' → cần tổng lớn hơn: tăng L', l, r); l++; }
      else { snap(hd + ' > ' + t + ' → cần tổng nhỏ hơn: giảm R', l, r); r--; }
    }
    if (!res) rec.s('L ≥ R → không có cặp nào có tổng ' + b(t) + '.', { cls: mk(n, function () { return 'dim'; }), ptr: {} });
    var w = cellW(n);
    return { steps: rec.steps, result: res, leg: [['cmp', 'L / R'], ['dim', 'đã loại'], ['done', 'cặp tìm được']],
      render: function (st) { return cells(a, { w: w, idx: true, cls: st.cls, ptr: st.ptr, ptrRows: 2 }); } };
  });

  reg('array', 'sliding-window', function (P) {
    var a = P.nums('input'), n = a.length, k = P.int('k', { min: 1, max: n, ex: '3' }), rec = new Rec(['phép cộng/trừ']);
    function snap(cap, l, sum, best, bl, extra) {
      var cls = mk(n, function (x) { return x >= l && x < l + k ? 'q' : ''; });
      Object.assign(cls, extra || {});
      rec.s(cap, { cls: cls, ptr: { L: l, R: l + k - 1 }, sum: sum, best: best, bl: bl });
    }
    var sum = 0;
    for (var i = 0; i < k; i++) { sum += a[i]; rec.inc('phép cộng/trừ'); }
    var best = sum, bl = 0;
    snap('Cửa sổ đầu tiên a[0..' + (k - 1) + ']: tổng = ' + b(sum) + '. Ghi nhận max = ' + sum + '.', 0, sum, best, bl);
    for (i = k; i < n; i++) {
      sum += a[i] - a[i - k]; rec.inc('phép cộng/trừ', 2);
      var better = sum > best;
      if (better) { best = sum; bl = i - k + 1; }
      snap('Trượt sang phải: thêm a[' + i + '] = ' + b(a[i]) + ', bỏ a[' + (i - k) + '] = ' + b(a[i - k]) + ' → tổng = ' + b(sum) + (better ? ' > max cũ → cập nhật max = ' + sum : ' (max vẫn = ' + best + ')'), i - k + 1, sum, best, bl, M(i, 'cmp', i - k, 'dim'));
    }
    var fin = mk(n, function (x) { return x >= bl && x < bl + k ? 'done' : ''; });
    rec.s('Hoàn tất! Tổng lớn nhất của cửa sổ kích thước ' + k + ' là ' + b(best) + ' (a[' + bl + '..' + (bl + k - 1) + ']). Mỗi bước chỉ tốn O(1) thay vì cộng lại k phần tử.', { cls: fin, ptr: { L: bl, R: bl + k - 1 }, sum: best, best: best, bl: bl });
    var w = cellW(n);
    return { steps: rec.steps, result: best, leg: [['q', 'cửa sổ hiện tại'], ['cmp', 'vừa thêm'], ['dim', 'vừa bỏ'], ['done', 'cửa sổ tốt nhất']],
      render: function (st) {
        return vstack([cells(a, { w: w, idx: true, cls: st.cls, ptr: st.ptr, ptrRows: 2, br: [{ l: st.bl, r: st.bl + k - 1, t: 'max = ' + st.best, st: 'done' }] }),
          tb('Tổng cửa sổ = ' + st.sum + '   |   max = ' + st.best, 'av-lb')], 8);
      } };
  });

  reg('array', 'prefix-sum', function (P) {
    var a = P.nums('input'), n = a.length, rec = new Rec(['phép cộng']), pre = mk(n + 1, function () { return null; });
    pre[0] = 0;
    function snap(cap, ac, pc) { rec.s(cap, { p: pre.slice(), ac: ac || {}, pc: pc || {} }); }
    snap('Xây mảng prefix: P[0] = 0, P[i+1] = P[i] + a[i]. P[i] = tổng i phần tử đầu tiên.', {}, M(0, 'done'));
    for (var i = 0; i < n; i++) {
      pre[i + 1] = pre[i] + a[i]; rec.inc('phép cộng');
      snap('P[' + (i + 1) + '] = P[' + i + '] + a[' + i + '] = ' + pre[i] + ' + ' + a[i] + ' = ' + b(pre[i + 1]), M(i, 'cmp'), M(i, 'cmp', i + 1, 'swap'));
    }
    var l = Math.min(1, n - 1), r = Math.min(3, n - 1);
    var am = {}; for (i = l; i <= r; i++) am[i] = 'q';
    snap('Xong! Tổng đoạn a[' + l + '..' + r + '] = P[' + (r + 1) + '] − P[' + l + '] = ' + pre[r + 1] + ' − ' + pre[l] + ' = ' + b(pre[r + 1] - pre[l]) + ' — chỉ O(1) mỗi truy vấn.', am, M(l, 'cmp', r + 1, 'done'));
    var w = cellW(n + 1), g = 4;
    return { steps: rec.steps, result: pre.slice(), leg: [['cmp', 'đang dùng'], ['swap', 'vừa tính'], ['q', 'đoạn truy vấn'], ['done', 'kết quả']],
      render: function (st) {
        var ra = cells(a, { w: w, g: g, idx: true, cls: a.map(function (_, i) { return st.ac[i]; }) });
        var rp = cells(st.p, { w: w, g: g, idx: true, cls: st.p.map(function (_, i) { return st.pc[i]; }) });
        var lab = 26;
        return blk(lab + (w + g) / 2 + rp.w, ra.h + rp.h + 34,
          T(lab - 6, 15, 'a', 'av-lb', 'end') + tr(lab + (w + g) / 2, 0, ra.s) + T(lab - 6, ra.h + 34 + 15, 'P', 'av-lb', 'end') + tr(lab, ra.h + 34, rp.s));
      } };
  });

  reg('array', 'kadane', function (P) {
    var a = P.nums('input'), n = a.length, rec = new Rec(['bước']);
    var cur = a[0], best = a[0], cs = 0, bl = 0, br = 0;
    function snap(cap, i) {
      var cls = mk(n, function (x) { return x >= cs && x <= i ? 'q' : ''; });
      if (i < n) cls[i] = 'cur';
      rec.s(cap, { cls: cls, i: i, cur: cur, best: best, cs: cs, bl: bl, br: br });
    }
    snap('Kadane: cur = tổng lớn nhất của dãy con kết thúc tại i; best = kết quả tốt nhất. Bắt đầu: cur = best = a[0] = ' + b(a[0]) + '.', 0);
    for (var i = 1; i < n; i++) {
      rec.inc('bước');
      var ext = cur + a[i], cap;
      if (a[i] > ext) { cap = 'i = ' + i + ': cur + a[i] = ' + cur + ' + ' + a[i] + ' = ' + ext + ' < a[i] = ' + a[i] + ' → bỏ dãy cũ, bắt đầu lại từ i: cur = ' + b(a[i]); cur = a[i]; cs = i; }
      else { cap = 'i = ' + i + ': nối dài dãy: cur = max(a[i], cur + a[i]) = max(' + a[i] + ', ' + ext + ') = ' + b(ext); cur = ext; }
      if (cur > best) { best = cur; bl = cs; br = i; cap += ' > best → cập nhật best = ' + b(best); }
      else cap += ' (best vẫn = ' + best + ')';
      snap(cap, i);
    }
    rec.s('Hoàn tất! Tổng dãy con liên tiếp lớn nhất = ' + b(best) + ', đoạn a[' + bl + '..' + br + '] = ' + bA(a.slice(bl, br + 1)) + '.', { cls: mk(n, function (x) { return x >= bl && x <= br ? 'done' : ''; }), i: n, cur: cur, best: best, cs: cs, bl: bl, br: br });
    var w = cellW(n);
    return { steps: rec.steps, result: best, leg: [['cur', 'phần tử i'], ['q', 'dãy con hiện tại'], ['done', 'dãy tốt nhất']],
      render: function (st) {
        return vstack([cells(a, { w: w, idx: true, cls: st.cls, ptr: st.i < n ? { i: st.i } : {}, ptrRows: 1, br: [{ l: st.bl, r: st.br, t: 'best = ' + st.best, st: 'done' }] }),
          tb('cur = ' + st.cur + '   |   best = ' + st.best, 'av-lb')], 8);
      } };
  });

  /** Danh sách "chip" tự xuống dòng (kết quả, thứ tự duyệt, thao tác...). */
  function chips(items, o) {
    o = o || {};
    var maxW = o.maxW || 400, hh = 24, g = 6, x = 0, y = 0, s = '', W = 0, x0 = 0;
    if (o.label) { s += T(0, hh / 2, o.label, 'av-lb', 'start'); x0 = x = tw(o.label, 12.5) + 10; W = x; }
    items.forEach(function (it, i) {
      var txt = String(it), w = Math.max(24, tw(txt, 11.5) + 14);
      if (x + w > maxW && x > x0) { x = x0; y += hh + g; }
      s += R(x, y, w, hh, o.cls && o.cls[i], 5) + T(x + w / 2, y + hh / 2, txt, 'av-v av-sm');
      x += w + g; W = Math.max(W, x - g);
    });
    if (!items.length && o.empty) { s += T(x, hh / 2, o.empty, 'av-i', 'start'); W = Math.max(W, x + tw(o.empty, 10)); }
    return blk(Math.max(W, o.minW || 0, 10), y + hh, s);
  }

  /* ================================================================
   * 6. LINKED LIST
   * ================================================================ */
  function llRender(xmin, xmax, rows) {
    var BW = 44, BH = 30, SX = 76, top = 50, RY = 84;
    return function (st) {
      var X = function (x) { return 34 + (x - xmin) * SX; }, Y = function (y) { return top + y * RY; };
      var occ = {}, s = '';
      st.nodes.forEach(function (nd) { if (!nd.gone || nd.gone === 1) occ[nd.y + ':' + nd.x] = 1; });
      st.nodes.forEach(function (nd, i) {
        if (nd.gone === 2) return;
        var t = st.nx[i], x = X(nd.x), y = Y(nd.y), es = (st.ec || {})[i] || (nd.gone ? 'dim' : '');
        if (t == null) return;
        if (t === -1) {
          var nx, ny, tx, ty;
          if (!occ[nd.y + ':' + (nd.x + 1)]) { nx = x + BW; ny = y + BH / 2; tx = x + BW + 34; ty = ny; s += arrow(nx, ny, tx, ty, es) + T(tx + 3, ty, 'null', 'av-i', 'start'); }
          else if (!occ[nd.y + ':' + (nd.x - 1)]) { nx = x; ny = y + BH / 2; tx = x - 30; ty = ny; s += arrow(nx, ny, tx, ty, es) + T(tx - 3, ty, 'null', 'av-i', 'end'); }
          else { s += arrow(x + BW / 2, y + BH, x + BW / 2, y + BH + 20, es) + T(x + BW / 2, y + BH + 28, 'null', 'av-i'); }
          return;
        }
        var tn = st.nodes[t], X2 = X(tn.x), Y2 = Y(tn.y);
        if (tn.y === nd.y && tn.x === nd.x + 1) s += arrow(x + BW, y + BH / 2, X2, Y2 + BH / 2, es);
        else if (tn.y === nd.y && tn.x === nd.x - 1) s += arrow(x, y + BH / 2, X2 + BW, Y2 + BH / 2, es);
        else if (tn.y !== nd.y) {
          var up = tn.y < nd.y;
          s += arrow(x + BW / 2 + (tn.x > nd.x ? 8 : -8), up ? y : y + BH, X2 + BW / 2 + (tn.x > nd.x ? -8 : 8), up ? Y2 + BH : Y2, es);
        } else {
          var dx = X2 - x, c = curve(x + BW / 2, y + BH, X2 + BW / 2, Y2 + BH, (dx > 0 ? 1 : -1) * (26 + Math.abs(dx) * 0.12), es || 'q', 0, 0);
          s += c.s;
        }
      });
      var byN = {};
      Object.keys(st.ptr || {}).forEach(function (k) { var i = st.ptr[k]; if (i == null || i < 0) return; (byN[i] = byN[i] || []).push(k); });
      st.nodes.forEach(function (nd, i) {
        if (nd.gone === 2) return;
        var x = X(nd.x), y = Y(nd.y);
        s += R(x, y, BW, BH, nd.st || (nd.gone ? 'dim' : ''), 5);
        s += T(x + BW / 2, y + BH / 2, nd.v, String(nd.v).length > 3 ? 'av-v av-sm' : 'av-v');
        if (nd.idx != null) s += T(x + BW / 2, y + BH + 9, nd.idx, 'av-i');
        (byN[i] || []).forEach(function (nm, k) {
          if (k === 0) s += '<path class="av-ph" d="M' + r1(x + BW / 2 - 5) + ',' + r1(y - 10) + 'L' + r1(x + BW / 2 + 5) + ',' + r1(y - 10) + 'L' + r1(x + BW / 2) + ',' + r1(y - 2) + 'Z"/>';
          s += T(x + BW / 2, y - 18 - k * 13, nm, 'av-p');
        });
      });
      return blk(X(xmax) + BW + 70, top + (rows - 1) * RY + BH + 46, s);
    };
  }
  function llBase(P, counters) {
    var vals = P.nums('input', { ex: '1,2,3,4', maxLen: 10 });
    var L = {
      vals: vals, rec: new Rec(counters), head: 0,
      nodes: vals.map(function (v, i) { return { v: v, x: i, y: 0 }; }),
      nx: vals.map(function (_, i) { return i < vals.length - 1 ? i + 1 : -1; })
    };
    L.val = function (i) { return i == null || i < 0 ? 'null' : L.nodes[i].v; };
    L.list = function () { var out = [], seen = {}, c = L.head; while (c >= 0 && !seen[c]) { seen[c] = 1; out.push(L.nodes[c].v); c = L.nx[c]; } return out; };
    L.relayout = function () { var c = L.head, k = 0, seen = {}; while (c >= 0 && !seen[c]) { seen[c] = 1; L.nodes[c].x = k++; L.nodes[c].y = 0; c = L.nx[c]; } };
    L.snap = function (cap, ptr, marks, ec) {
      var nodes = L.nodes.map(function (nd, i) { var q = Object.assign({}, nd); q.st = (marks || {})[i] || ''; return q; });
      var p = Object.assign({ head: L.head }, ptr || {});
      L.rec.s(cap, { nodes: nodes, nx: L.nx.slice(), ptr: p, ec: ec || {} });
    };
    L.str = function () { return b(L.list().join(' → ') + (L.list().length ? ' → ' : '') + 'null'); };
    return L;
  }
  var LEG_LL = [['cur', 'nút đang xét'], ['swap', 'mũi tên vừa đổi'], ['done', 'đã xử lý / kết quả']];

  reg('linkedlist', 'reverse', function (P) {
    var Lk = llBase(P, ['đổi mũi tên']), prev = -1, curr = Lk.head, n = Lk.vals.length, dn = {};
    Lk.snap('Danh sách: ' + Lk.str() + '. Đảo ngược bằng 3 con trỏ: prev = null, curr = head, next.', { curr: curr });
    while (curr >= 0) {
      var next = Lk.nx[curr];
      Lk.snap('Lưu next = curr.next = ' + b(Lk.val(next)) + ' (để không mất phần còn lại)', { prev: prev, curr: curr, next: next }, Object.assign({}, dn, M(curr, 'cur')));
      Lk.nx[curr] = prev; Lk.rec.inc('đổi mũi tên');
      Lk.snap('Đảo mũi tên: curr.next = prev → ' + b(Lk.val(curr)) + ' giờ trỏ về ' + b(Lk.val(prev)), { prev: prev, curr: curr, next: next }, Object.assign({}, dn, M(curr, 'cur')), M(curr, 'swap'));
      dn[curr] = 'done';
      prev = curr; curr = next;
      Lk.snap('Tiến lên: prev = ' + b(Lk.val(prev)) + ', curr = ' + b(Lk.val(curr)), { prev: prev, curr: curr }, dn);
    }
    Lk.head = prev;
    Lk.snap('curr = null → dừng. head mới = prev = ' + b(Lk.val(prev)) + '. Danh sách: ' + Lk.str(), {}, dn);
    return { steps: Lk.rec.steps, result: Lk.list(), leg: LEG_LL, render: llRender(0, n - 1, 1) };
  });

  reg('linkedlist', 'middle', function (P) {
    var Lk = llBase(P, ['bước của slow']), slow = 0, fast = 0;
    Lk.snap('Danh sách: ' + Lk.str() + '. Hai con trỏ: slow đi 1 bước, fast đi 2 bước mỗi lượt.', { slow: 0, fast: 0 });
    while (fast >= 0 && Lk.nx[fast] >= 0) {
      slow = Lk.nx[slow]; fast = Lk.nx[Lk.nx[fast]]; Lk.rec.inc('bước của slow');
      Lk.snap('slow → ' + b(Lk.val(slow)) + ' (1 bước), fast → ' + b(Lk.val(fast)) + ' (2 bước)', { slow: slow, fast: fast }, M(slow, 'cur', fast >= 0 ? fast : null, 'q'));
    }
    Lk.snap((fast < 0 ? 'fast = null' : 'fast.next = null') + ' → dừng. Khi fast tới cuối, slow ở giữa: phần tử giữa là ' + b(Lk.val(slow)) + '.', { slow: slow, fast: fast >= 0 ? fast : null }, M(slow, 'done'));
    return { steps: Lk.rec.steps, result: Lk.val(slow), leg: [['cur', 'slow'], ['q', 'fast'], ['done', 'phần tử giữa']], render: llRender(0, Lk.vals.length - 1, 1) };
  });

  reg('linkedlist', 'insert', function (P) {
    var Lk = llBase(P, ['bước duyệt']), n = Lk.vals.length;
    var v = P.int('value', { ex: '9', min: -999, max: 999 }), k = P.int('index', { min: 0, max: n, def: n });
    var ni = Lk.nodes.length;
    Lk.snap('Danh sách: ' + Lk.str() + '. Chèn giá trị ' + b(v) + ' vào vị trí ' + b(k) + '.', {});
    Lk.nodes.push({ v: v, x: k - 0.5, y: 1 }); Lk.nx.push(null);
    if (k === 0) {
      Lk.snap('Tạo nút mới ' + b(v) + '.', { 'mới': ni }, M(ni, 'new'));
      Lk.nx[ni] = Lk.head;
      Lk.snap('Chèn vào đầu: new.next = head (' + b(Lk.val(Lk.head)) + ')', { 'mới': ni }, M(ni, 'new'), M(ni, 'swap'));
      Lk.head = ni;
      Lk.snap('head = new → nút mới thành đầu danh sách. Chỉ O(1)!', {}, M(ni, 'new'));
    } else {
      var curr = Lk.head;
      Lk.snap('Tạo nút mới ' + b(v) + '. Cần đi tới nút đứng trước vị trí ' + k + ' (chỉ số ' + (k - 1) + ').', { curr: curr, 'mới': ni }, M(ni, 'new', curr, 'cur'));
      for (var i = 0; i < k - 1; i++) {
        curr = Lk.nx[curr]; Lk.rec.inc('bước duyệt');
        Lk.snap('curr = curr.next → ' + b(Lk.val(curr)) + ' (chỉ số ' + (i + 1) + ')', { curr: curr, 'mới': ni }, M(ni, 'new', curr, 'cur'));
      }
      Lk.nx[ni] = Lk.nx[curr];
      Lk.snap('new.next = curr.next → nút mới trỏ tới ' + b(Lk.val(Lk.nx[ni])) + ' (làm trước để không mất phần sau)', { curr: curr, 'mới': ni }, M(ni, 'new', curr, 'cur'), M(ni, 'swap'));
      Lk.nx[curr] = ni;
      Lk.snap('curr.next = new → ' + b(Lk.val(curr)) + ' giờ trỏ tới nút mới', { curr: curr, 'mới': ni }, M(ni, 'new', curr, 'cur'), M(curr, 'swap'));
    }
    Lk.relayout();
    Lk.snap('Hoàn tất! Danh sách sau khi chèn: ' + Lk.str(), {}, M(ni, 'done'));
    return { steps: Lk.rec.steps, result: Lk.list(), leg: [['new', 'nút mới'], ['cur', 'curr'], ['swap', 'mũi tên vừa đổi'], ['done', 'kết quả']], render: llRender(-0.5, n, 2) };
  });

  reg('linkedlist', 'delete', function (P) {
    var Lk = llBase(P, ['bước duyệt']), n = Lk.vals.length, v = P.int('value', { ex: '3' }), gone = -1;
    Lk.snap('Danh sách: ' + Lk.str() + '. Xóa nút đầu tiên có giá trị ' + b(v) + '.', {});
    if (Lk.nodes[0].v === v) {
      gone = 0;
      Lk.snap('head có giá trị ' + b(v) + ' → chỉ cần head = head.next', {}, M(0, 'swap'));
      Lk.head = Lk.nx[0]; Lk.nodes[0].y = 1; Lk.nodes[0].gone = 1;
      Lk.snap('head giờ là ' + b(Lk.val(Lk.head)) + '; nút cũ bị tách ra', {}, M(0, 'swap'));
    } else {
      var prev = 0, curr = Lk.nx[0];
      Lk.snap('head.value = ' + Lk.nodes[0].v + ' ≠ ' + v + '. Duyệt với prev = head, curr = head.next.', { prev: prev, curr: curr }, M(curr, 'cur'));
      while (curr >= 0 && Lk.nodes[curr].v !== v) {
        Lk.rec.inc('bước duyệt');
        Lk.snap('curr.value = ' + b(Lk.nodes[curr].v) + ' ≠ ' + v + ' → tiến prev và curr', { prev: prev, curr: curr }, M(curr, 'cmp'));
        prev = curr; curr = Lk.nx[curr];
      }
      if (curr < 0) Lk.snap('curr = null → không tìm thấy giá trị ' + b(v) + ', danh sách giữ nguyên.', { prev: prev });
      else {
        gone = curr;
        Lk.snap('curr.value = ' + b(v) + ' → tìm thấy nút cần xóa', { prev: prev, curr: curr }, M(curr, 'swap'));
        Lk.nx[prev] = Lk.nx[curr]; Lk.nodes[curr].y = 1; Lk.nodes[curr].gone = 1;
        Lk.snap('prev.next = curr.next → ' + b(Lk.val(prev)) + ' trỏ thẳng tới ' + b(Lk.val(Lk.nx[prev])) + ', bỏ qua nút ' + v, { prev: prev, curr: curr }, M(curr, 'swap'), M(prev, 'swap'));
      }
    }
    if (gone >= 0) { Lk.nodes[gone].gone = 2; Lk.relayout(); Lk.snap('Hoàn tất! Danh sách sau khi xóa: ' + Lk.str(), {}); }
    return { steps: Lk.rec.steps, result: Lk.list(), leg: [['cur', 'curr'], ['cmp', 'đang so sánh'], ['swap', 'nút bị xóa / mũi tên đổi']], render: llRender(0, n - 1, 2) };
  });

  reg('linkedlist', 'detect-cycle', function (P) {
    var Lk = llBase(P, ['bước']), n = Lk.vals.length, ct = P.int('cycle-to', { min: -1, max: n - 1, def: -1 });
    if (ct >= 0) Lk.nx[n - 1] = ct;
    var slow = 0, fast = 0, meet = -1;
    Lk.snap('Danh sách ' + (ct >= 0 ? 'có nút cuối trỏ ngược về chỉ số ' + ct + ' (' + b(Lk.nodes[ct].v) + ')' : 'kết thúc bằng null') + '. Floyd: slow đi 1 bước, fast đi 2 bước; nếu gặp nhau → có chu trình.', { slow: 0, fast: 0 });
    while (true) {
      if (fast < 0 || Lk.nx[fast] < 0) { Lk.snap('fast chạm null → danh sách ' + b('không có chu trình') + '.', { slow: slow, fast: fast >= 0 ? fast : null }, M(slow, 'cur')); break; }
      slow = Lk.nx[slow]; fast = Lk.nx[Lk.nx[fast]]; Lk.rec.inc('bước');
      if (slow === fast) { meet = slow; Lk.snap('slow → ' + b(Lk.val(slow)) + ', fast → ' + b(Lk.val(fast)) + ' → hai con trỏ GẶP NHAU → ' + b('có chu trình') + '!', { slow: slow, fast: fast }, M(slow, 'swap')); break; }
      Lk.snap('slow → ' + b(Lk.val(slow)) + ', fast → ' + b(Lk.val(fast)) + (fast < 0 ? '' : ' (chưa gặp nhau)'), { slow: slow, fast: fast >= 0 ? fast : null }, M(slow, 'cur', fast >= 0 ? fast : null, 'q'));
    }
    var start = -1;
    if (meet >= 0) {
      var p1 = 0, p2 = meet;
      Lk.snap('Tìm điểm bắt đầu chu trình: đặt p1 = head, p2 = điểm gặp; cả hai cùng đi 1 bước.', { p1: p1, p2: p2 }, M(p1, 'cur', p2, 'q'));
      while (p1 !== p2) { p1 = Lk.nx[p1]; p2 = Lk.nx[p2]; Lk.rec.inc('bước'); Lk.snap('p1 → ' + b(Lk.val(p1)) + ', p2 → ' + b(Lk.val(p2)), { p1: p1, p2: p2 }, M(p1, 'cur', p2, 'q')); }
      start = p1;
      Lk.snap('p1 = p2 tại ' + b(Lk.val(p1)) + ' (chỉ số ' + p1 + ') → đó là nút bắt đầu chu trình.', { p1: p1 }, M(p1, 'done'));
    }
    return { steps: Lk.rec.steps, result: { cycle: meet >= 0, start: start }, leg: [['cur', 'slow / p1'], ['q', 'fast / p2'], ['swap', 'gặp nhau'], ['done', 'đầu chu trình']], render: llRender(0, n - 1, 1) };
  });

  /* ================================================================
   * 7. STACK / QUEUE
   * ================================================================ */
  function parseOps(P, allowed, ex) {
    var raw = P.list('ops', { ex: ex, maxLen: 24 });
    return raw.map(function (op) {
      var m = op.match(/^([A-Za-z-]+)(?:\s+(\S{1,6}))?$/);
      var name = m && m[1].toLowerCase();
      if (!m || !(name in allowed) || (allowed[name] && m[2] == null) || (!allowed[name] && m[2] != null)) {
        fail('Thao tác "' + esc(op) + '" không hợp lệ. Hợp lệ: ' + Object.keys(allowed).map(function (k) { return code(k + (allowed[k] ? ' x' : '')); }).join(', ') + '.');
      }
      return { op: name, arg: m[2], raw: op };
    });
  }

  reg('stack', 'ops', function (P) {
    var ops = parseOps(P, { push: 1, pop: 0, peek: 0, top: 0, isempty: 0, size: 0 }, 'push 3,push 5,pop,peek'), st = [], rec = new Rec(['push', 'pop']), out = [], cap = 1;
    function snap(c, k, hl) { rec.s(c, { s: st.slice(), k: k, hl: hl || '', out: out.slice() }); cap = Math.max(cap, st.length); }
    snap('Stack (LIFO) rỗng. Các thao tác: ' + ops.map(function (o) { return code(o.raw); }).join(' '), -1);
    ops.forEach(function (o, k) {
      if (o.op === 'push') { st.push(o.arg); rec.inc('push'); snap(code(o.raw) + ': đặt ' + b(o.arg) + ' lên đỉnh stack', k, 'new'); }
      else if (o.op === 'pop') {
        if (!st.length) { snap(code('pop') + ': stack rỗng → không thể pop (lỗi underflow)', k, 'bad'); return; }
        snap(code('pop') + ': lấy phần tử ở đỉnh ra → ' + b(st[st.length - 1]), k, 'swap');
        out.push(st.pop()); rec.inc('pop'); snap('Đã pop ' + b(out[out.length - 1]) + '; đỉnh mới là ' + b(st.length ? st[st.length - 1] : '(rỗng)'), k);
      } else if (o.op === 'peek' || o.op === 'top') snap(code(o.raw) + ': xem đỉnh (không lấy ra) → ' + b(st.length ? st[st.length - 1] : '(rỗng)'), k, 'cmp');
      else if (o.op === 'isempty') snap(code(o.raw) + ' → ' + b(st.length ? 'false' : 'true'), k, 'cmp');
      else snap(code(o.raw) + ' → ' + b(st.length), k, 'cmp');
    });
    rec.s('Kết thúc. Stack (đáy → đỉnh): ' + bA(st) + '. Thứ tự lấy ra: ' + bA(out) + ' — vào sau, ra trước (LIFO).', { s: st.slice(), k: ops.length, hl: '', out: out.slice() });
    cap = Math.max(cap, 3);
    return { steps: rec.steps, result: st.slice(), leg: [['new', 'vừa push'], ['swap', 'sắp pop'], ['cmp', 'peek'], ['bad', 'lỗi']],
      render: function (x) {
        var bw = 70, bh = 28, s = '', H = cap * (bh + 3) + 10;
        s += L(0, 0, 0, H, '', 'av-thick') + L(bw + 12, 0, bw + 12, H, '', 'av-thick') + L(0, H, bw + 12, H, '', 'av-thick');
        x.s.forEach(function (v, i) {
          var y = H - 6 - (i + 1) * (bh + 3), top = i === x.s.length - 1;
          s += R(6, y, bw, bh, top ? x.hl : '', 4) + T(6 + bw / 2, y + bh / 2, v, 'av-v');
          if (top) s += arrow(bw + 60, y + bh / 2, bw + 16, y + bh / 2, '') + T(bw + 64, y + bh / 2, 'top', 'av-p', 'start');
        });
        if (!x.s.length) { s += T(6 + bw / 2, H - 20, '(rỗng)', 'av-i'); if (x.hl === 'bad') s += R(4, H - 36, bw + 4, 30, 'bad', 4); }
        var col = blk(bw + 100, H + 4, s);
        var opsB = chips(ops.map(function (o) { return o.raw; }), { label: 'Thao tác:', cls: ops.map(function (_, i) { return i === x.k ? 'cur' : (i < x.k ? 'dim' : ''); }), maxW: 360 });
        return vstack([col, opsB, chips(x.out, { label: 'Đã pop:', empty: '—', maxW: 360 })], 12);
      } };
  });

  reg('queue', 'ops', function (P) {
    var ops = parseOps(P, { enqueue: 1, dequeue: 0, peek: 0, front: 0, isempty: 0, size: 0 }, 'enqueue 3,enqueue 5,dequeue'), q = [], rec = new Rec(['enqueue', 'dequeue']), out = [], cap = 3;
    function snap(c, k, hl) { rec.s(c, { q: q.slice(), k: k, hl: hl || '', out: out.slice() }); cap = Math.max(cap, q.length); }
    snap('Queue (FIFO) rỗng. Các thao tác: ' + ops.map(function (o) { return code(o.raw); }).join(' '), -1);
    ops.forEach(function (o, k) {
      if (o.op === 'enqueue') { q.push(o.arg); rec.inc('enqueue'); snap(code(o.raw) + ': thêm ' + b(o.arg) + ' vào cuối hàng (rear)', k, 'new'); }
      else if (o.op === 'dequeue') {
        if (!q.length) { snap(code('dequeue') + ': hàng đợi rỗng → không thể dequeue', k, 'bad'); return; }
        snap(code('dequeue') + ': lấy phần tử ở đầu hàng (front) ra → ' + b(q[0]), k, 'swap');
        out.push(q.shift()); rec.inc('dequeue'); snap('Đã dequeue ' + b(out[out.length - 1]) + '; front mới là ' + b(q.length ? q[0] : '(rỗng)'), k);
      } else if (o.op === 'peek' || o.op === 'front') snap(code(o.raw) + ': xem phần tử đầu hàng → ' + b(q.length ? q[0] : '(rỗng)'), k, 'cmp');
      else if (o.op === 'isempty') snap(code(o.raw) + ' → ' + b(q.length ? 'false' : 'true'), k, 'cmp');
      else snap(code(o.raw) + ' → ' + b(q.length), k, 'cmp');
    });
    rec.s('Kết thúc. Queue (front → rear): ' + bA(q) + '. Thứ tự lấy ra: ' + bA(out) + ' — vào trước, ra trước (FIFO).', { q: q.slice(), k: ops.length, hl: '', out: out.slice() });
    return { steps: rec.steps, result: q.slice(), leg: [['new', 'vừa enqueue'], ['swap', 'sắp dequeue'], ['cmp', 'peek'], ['bad', 'lỗi']],
      render: function (x) {
        var n = x.q.length, cls = x.q.map(function (_, i) {
          if (x.hl === 'new') return i === n - 1 ? 'new' : '';
          if (x.hl === 'swap' || x.hl === 'cmp') return i === 0 ? x.hl : '';
          return '';
        });
        var vals = x.q.slice(); while (vals.length < cap) vals.push('');
        var ptr = n ? (n === 1 ? { 'front,rear': 0 } : { front: 0, rear: n - 1 }) : {};
        var row = cells(vals, { w: 44, cls: cls.concat(mk(cap - n, function () { return 'dim'; })), ptr: ptr, ptrRows: 1 });
        var opsB = chips(ops.map(function (o) { return o.raw; }), { label: 'Thao tác:', cls: ops.map(function (_, i) { return i === x.k ? 'cur' : (i < x.k ? 'dim' : ''); }), maxW: 360 });
        return vstack([hstack([tb('ra ←', 'av-lb'), row, tb('← vào', 'av-lb')], 8), opsB, chips(x.out, { label: 'Đã dequeue:', empty: '—', maxW: 360 })], 12);
      } };
  });

  /* ================================================================
   * 8. HASH TABLE
   * ================================================================ */
  function hashOf(k, m) {
    if (/^-?\d+$/.test(k)) { var v = parseInt(k, 10), hv = ((v % m) + m) % m; return { h: hv, exp: 'h(' + k + ') = ' + k + ' mod ' + m + ' = ' + b(hv) }; }
    var codes = [], sum = 0;
    for (var i = 0; i < k.length; i++) { codes.push(k.charCodeAt(i)); sum += k.charCodeAt(i); }
    var hh = sum % m;
    return { h: hh, exp: 'h("' + esc(k) + '") = (' + (codes.length <= 8 ? codes.join(' + ') : codes.slice(0, 3).join(' + ') + ' + … + ' + codes[codes.length - 1]) + ') mod ' + m + ' = ' + sum + ' mod ' + m + ' = ' + b(hh) };
  }
  function hashSetup(P) {
    var keys = P.list('input', { ex: 'apple,banana,cat', maxLen: 14, itemMax: 10 }), m = P.int('size', { min: 1, max: 17, def: 7 });
    return { keys: keys, m: m, kw: Math.max(40, Math.max.apply(null, keys.map(function (k) { return tw(k, 11.5); })) + 14) };
  }
  reg('hash', 'chaining', function (P) {
    var H = hashSetup(P), m = H.m, tbl = mk(m, function () { return []; }), rec = new Rec(['va chạm']), maxC = 1;
    function snap(c, hi, st, key) { rec.s(c, { t: clone(tbl), hi: hi, st: st, key: key }); }
    snap('Bảng băm ' + m + ' bucket, xử lý va chạm bằng chaining (mỗi bucket là một danh sách). Hàm băm: tổng mã ký tự mod ' + m + '.', -1);
    H.keys.forEach(function (k) {
      var r = hashOf(k, m);
      snap('Chèn ' + b(k) + ': ' + r.exp + ' → bucket ' + r.h, r.h, 'cmp', k);
      if (tbl[r.h].indexOf(k) >= 0) { snap(b(k) + ' đã có trong bucket ' + r.h + ' → bỏ qua (không lưu trùng khóa)', r.h, 'cmp', k); return; }
      var col = tbl[r.h].length > 0;
      if (col) rec.inc('va chạm');
      tbl[r.h].push(k); maxC = Math.max(maxC, tbl[r.h].length);
      snap(col ? 'Va chạm! Bucket ' + r.h + ' đã có ' + bA(tbl[r.h].slice(0, -1)) + ' → nối ' + b(k) + ' vào cuối chuỗi' : 'Bucket ' + r.h + ' trống → đặt ' + b(k) + ' vào', r.h, col ? 'swap' : 'new', k);
    });
    var load = (H.keys.length / m).toFixed(2);
    snap('Hoàn tất! Hệ số tải α = số khóa / số bucket ≈ ' + b(load) + '. Tìm kiếm trung bình O(1 + α).', -1);
    return { steps: rec.steps, result: tbl, leg: [['cmp', 'bucket đang xét'], ['new', 'khóa vừa thêm'], ['swap', 'va chạm']],
      render: function (x) {
        var rh = 32, s = '', kw = H.kw;
        for (var i = 0; i < m; i++) {
          var y = i * rh;
          s += T(14, y + 13, i, 'av-i') + R(26, y, 30, 26, i === x.hi ? x.st === 'swap' ? 'swap' : 'cmp' : '', 3);
          var xx = 56;
          x.t[i].forEach(function (k, j) {
            s += arrow(xx, y + 13, xx + 18, y + 13, '');
            var last = i === x.hi && j === x.t[i].length - 1 && k === x.key && x.st !== 'cmp';
            s += R(xx + 18, y + 1, kw, 24, last ? 'new' : '', 4) + T(xx + 18 + kw / 2, y + 13, k, 'av-v av-sm');
            xx += 18 + kw;
          });
          if (!x.t[i].length) s += T(41, y + 13, '∅', 'av-i');
        }
        return blk(56 + maxC * (kw + 18) + 4, m * rh, s);
      } };
  });
  reg('hash', 'linear-probing', function (P) {
    var H = hashSetup(P), m = H.m, tbl = mk(m, function () { return null; }), rec = new Rec(['lần dò', 'va chạm']);
    function snap(c, probe, st, final) { rec.s(c, { t: tbl.slice(), probe: probe.slice(), st: st, fin: final }); }
    snap('Bảng băm ' + m + ' ô, xử lý va chạm bằng dò tuyến tính (linear probing): ô bận thì thử ô kế tiếp (i + 1) mod ' + m + '.', [], '', -1);
    H.keys.forEach(function (k) {
      var r = hashOf(k, m), idx = r.h, probe = [idx], tries = 0;
      rec.inc('lần dò');
      snap('Chèn ' + b(k) + ': ' + r.exp + ' → thử ô ' + idx, probe, 'cmp', -1);
      while (tbl[idx] != null && tbl[idx] !== k) {
        rec.inc('va chạm'); tries++;
        if (tries >= m) { snap('Đã thử hết ' + m + ' ô → bảng đầy, không chèn được ' + b(k) + '!', probe, 'bad', -1); return; }
        var nxt = (idx + 1) % m;
        snap('Ô ' + idx + ' đã có ' + b(tbl[idx]) + ' → va chạm, thử ô (' + idx + ' + 1) mod ' + m + ' = ' + nxt, probe.concat([nxt]), 'cmp', -1);
        idx = nxt; probe.push(idx); rec.inc('lần dò');
      }
      if (tbl[idx] === k) { snap(b(k) + ' đã có ở ô ' + idx + ' → bỏ qua', probe, 'cmp', idx); return; }
      tbl[idx] = k;
      snap('Ô ' + idx + ' trống → đặt ' + b(k) + ' vào ô ' + idx + (probe.length > 1 ? ' (sau ' + probe.length + ' lần dò)' : ''), probe, 'cmp', idx);
    });
    snap('Hoàn tất! Hệ số tải α ≈ ' + b((tbl.filter(function (x) { return x != null; }).length / m).toFixed(2)) + '. α càng gần 1 thì chuỗi dò càng dài.', [], '', -1);
    return { steps: rec.steps, result: tbl.slice(), leg: [['cmp', 'ô đang dò'], ['swap', 'ô bận (va chạm)'], ['new', 'vừa đặt vào'], ['bad', 'bảng đầy']],
      render: function (x) {
        var rh = 32, s = '', kw = H.kw;
        for (var i = 0; i < m; i++) {
          var y = i * rh, pi = x.probe.indexOf(i), st = '';
          if (i === x.fin) st = 'new';
          else if (pi >= 0) st = x.st === 'bad' ? 'bad' : (pi === x.probe.length - 1 ? 'cmp' : 'swap');
          s += T(14, y + 13, i, 'av-i') + R(26, y, kw + 10, 26, st, 3) + T(26 + (kw + 10) / 2, y + 13, x.t[i] == null ? '' : x.t[i], 'av-v av-sm');
          if (pi >= 0) s += T(kw + 44, y + 13, 'lần ' + (pi + 1), 'av-p', 'start');
        }
        return blk(kw + 100, m * rh, s);
      } };
  });

  /* ================================================================
   * 9. RECURSION / BACKTRACKING
   * ================================================================ */
  /** Bố cục cây tổng quát: lá xếp liên tiếp, nút trong nằm giữa các con. nodes[i] = {kids:[]} */
  function layoutTree(nodes, root, slot, lh) {
    var next = 0, depth = 0;
    (function go(i, d) {
      var nd = nodes[i]; nd.d = d; depth = Math.max(depth, d);
      if (!nd.kids.length) { nd.px = next++ * slot + slot / 2; }
      else { nd.kids.forEach(function (c) { go(c, d + 1); }); nd.px = (nodes[nd.kids[0]].px + nodes[nd.kids[nd.kids.length - 1]].px) / 2; }
      nd.py = 16 + d * lh;
    })(root, 0);
    return { w: Math.max(next * slot, slot), h: 32 + depth * lh };
  }

  reg('recursion', 'fib-tree', function (P) {
    var n = P.int('n', { min: 0, max: 6, ex: '5' }), nodes = [], rec = new Rec(['lời gọi']);
    (function mkT(k) { var id = nodes.length; nodes.push({ k: k, kids: [] }); if (k >= 2) { nodes[id].kids.push(mkT(k - 1)); nodes[id].kids.push(mkT(k - 2)); } return id; })(n);
    var dims = layoutTree(nodes, 0, 44, 54);
    var state = nodes.map(function () { return ''; }), val = nodes.map(function () { return null; }), stack = [];
    function snap(c) { rec.s(c, { st: state.slice(), val: val.slice(), stack: stack.map(function (i) { return 'fib(' + nodes[i].k + ')'; }) }); }
    function fib(i, parent) {
      var k = nodes[i].k; rec.inc('lời gọi');
      if (stack.length) state[stack[stack.length - 1]] = 'q';
      stack.push(i); state[i] = 'cur';
      if (k < 2) {
        val[i] = k; state[i] = 'done'; stack.pop();
        if (stack.length) state[stack[stack.length - 1]] = 'cur';
        snap('Gọi ' + code('fib(' + k + ')') + ' → trường hợp cơ sở, trả về ' + b(k) + (parent != null ? ' cho fib(' + nodes[parent].k + ')' : ''));
        return k;
      }
      snap('Gọi ' + code('fib(' + k + ')') + ' → cần fib(' + (k - 1) + ') + fib(' + (k - 2) + ')');
      var a = fib(nodes[i].kids[0], i);
      var c = fib(nodes[i].kids[1], i);
      val[i] = a + c; state[i] = 'done'; stack.pop();
      if (stack.length) state[stack[stack.length - 1]] = 'cur';
      snap(code('fib(' + k + ')') + ' = fib(' + (k - 1) + ') + fib(' + (k - 2) + ') = ' + a + ' + ' + c + ' = ' + b(a + c) + (parent != null ? ' → trả về cho fib(' + nodes[parent].k + ')' : ''));
      return a + c;
    }
    snap('Tính ' + code('fib(' + n + ')') + ' bằng đệ quy thuần. Mỗi nút là một lời gọi hàm; để ý các nhánh trùng lặp.');
    var res = fib(0, null);
    var cnt = {}; nodes.forEach(function (nd) { cnt[nd.k] = (cnt[nd.k] || 0) + 1; });
    rec.s('Hoàn tất! fib(' + n + ') = ' + b(res) + ' sau ' + nodes.length + ' lời gọi' + (n >= 4 ? ' — fib(2) bị tính ' + cnt[2] + ' lần, fib(3) bị tính ' + cnt[3] + ' lần. Memoization sẽ loại bỏ các lần tính lặp này.' : '.'), { st: state.slice(), val: val.slice(), stack: [] });
    return { steps: rec.steps, result: res, leg: [['cur', 'đang chạy'], ['q', 'đang chờ (trên stack)'], ['done', 'đã trả về']],
      render: function (x) {
        var s = '';
        nodes.forEach(function (nd, i) { nd.kids.forEach(function (c) { if (x.st[c]) s += L(nd.px, nd.py + 11, nodes[c].px, nodes[c].py - 11, x.st[c] === 'done' ? '' : 'q'); }); });
        nodes.forEach(function (nd, i) {
          if (!x.st[i]) return;
          s += R(nd.px - 20, nd.py - 11, 40, 22, x.st[i], 6) + T(nd.px, nd.py, 'f(' + nd.k + ')', 'av-v av-sm');
          if (x.val[i] != null) s += T(nd.px, nd.py + 19, '=' + x.val[i], 'av-p');
        });
        return vstack([blk(dims.w, dims.h + 8, s), chips(x.stack, { label: 'Call stack:', empty: '(rỗng)', maxW: Math.max(360, dims.w) })], 10, true);
      } };
  });

  function btTree(maxN, n) { return n <= maxN; }

  reg('recursion', 'permutations', function (P) {
    var a = P.nums('input', { ex: '1,2,3', maxLen: 4 }), n = a.length, rec = new Rec(['lời gọi', 'hoán vị']);
    var used = a.map(function () { return false; }), path = [], res = [], showTree = btTree(3, n);
    var nodes = [{ kids: [], lab: '[ ]', key: '' }], byKey = { '': 0 };
    if (showTree) (function mkT(id, us, key) {
      for (var i = 0; i < n; i++) if (!us[i]) { var k2 = key + ',' + i, c = nodes.length; nodes.push({ kids: [], lab: String(a[i]), key: k2 }); byKey[k2] = c; nodes[id].kids.push(c); us[i] = true; mkT(c, us, k2); us[i] = false; }
    })(0, a.map(function () { return false; }), '');
    var dims = showTree ? layoutTree(nodes, 0, 40, 46) : null;
    var seen = {}, pidx = [];
    function snap(c, hl) {
      var key = pidx.length ? ',' + pidx.join(',') : '';
      seen[key] = 1;
      rec.s(c, { path: path.slice(), used: used.slice(), res: res.map(function (r) { return '[' + r.join(',') + ']'; }), seen: Object.assign({}, seen), key: key, hl: hl || '' });
    }
    snap('Sinh mọi hoán vị của ' + bA(a) + ' bằng quay lui: mỗi tầng chọn một phần tử chưa dùng, đủ ' + n + ' phần tử thì lưu lại.');
    (function bt() {
      rec.inc('lời gọi');
      if (path.length === n) { res.push(path.slice()); rec.inc('hoán vị'); snap('path đủ ' + n + ' phần tử → ' + b('lưu') + ' hoán vị ' + bA(path) + ' (#' + res.length + ')', 'done'); return; }
      for (var i = 0; i < n; i++) {
        if (used[i]) continue;
        used[i] = true; path.push(a[i]); pidx.push(i);
        snap('Chọn ' + b(a[i]) + ' → path = ' + bA(path));
        bt();
        used[i] = false; path.pop(); pidx.pop();
        snap('Quay lui: bỏ ' + b(a[i]) + ' khỏi path → path = ' + bA(path), 'back');
      }
    })();
    rec.s('Hoàn tất! Có ' + b(res.length) + ' hoán vị = ' + n + '!.', { path: [], used: used.slice(), res: res.map(function (r) { return '[' + r.join(',') + ']'; }), seen: seen, key: null, hl: '' });
    return { steps: rec.steps, result: res, leg: [['cur', 'đường đi hiện tại'], ['vis', 'đã thăm'], ['done', 'hoán vị hoàn chỉnh'], ['dim', 'phần tử đã dùng']],
      render: function (x) {
        var parts = [];
        if (showTree) {
          var s = '', onPath = {};
          if (x.key != null) { var ks = x.key.split(',').slice(1), acc = ''; onPath[''] = 1; ks.forEach(function (q) { acc += ',' + q; onPath[acc] = 1; }); }
          nodes.forEach(function (nd) { nd.kids.forEach(function (c) { if (x.seen[nodes[c].key]) s += L(nd.px, nd.py + 10, nodes[c].px, nodes[c].py - 10, onPath[nodes[c].key] ? 'cur' : ''); }); });
          nodes.forEach(function (nd) {
            if (!x.seen[nd.key]) return;
            var leaf = !nd.kids.length, st = onPath[nd.key] ? (nd.key === x.key && x.hl === 'done' ? 'done' : 'cur') : (leaf ? 'done' : 'vis');
            s += C(nd.px, nd.py, 12, st) + T(nd.px, nd.py, nd.lab, 'av-v av-sm');
          });
          parts.push(blk(dims.w, dims.h, s));
        }
        parts.push(hstack([cells(a, { w: 30, label: 'input', labelW: 50, cls: x.used.map(function (u) { return u ? 'dim' : ''; }) }), cells(x.path.concat(mk(n - x.path.length, function () { return ''; })), { w: 30, label: 'path', labelW: 44, cls: x.path.map(function () { return 'cur'; }) })], 20));
        parts.push(chips(x.res, { label: 'Kết quả:', empty: '—', maxW: 380 }));
        return vstack(parts, 12);
      } };
  });

  reg('recursion', 'subsets', function (P) {
    var a = P.nums('input', { ex: '1,2,3', maxLen: 5 }), n = a.length, rec = new Rec(['lời gọi', 'tập con']);
    var path = [], pidx = [], res = [], showTree = n <= 4;
    var nodes = [{ kids: [], key: '', lab: '{}' }];
    if (showTree) (function mkT(id, start, key) { for (var i = start; i < n; i++) { var k2 = key + ',' + i, c = nodes.length; nodes.push({ kids: [], key: k2, lab: String(a[i]) }); nodes[id].kids.push(c); mkT(c, i + 1, k2); } })(0, 0, '');
    var dims = showTree ? layoutTree(nodes, 0, 40, 46) : null;
    var seen = {};
    function mask(ix) { var m = mk(n, function () { return '0'; }); ix.forEach(function (i) { m[n - 1 - i] = '1'; }); return m.join(''); }
    function lab(p, ix) { return '{' + p.join(',') + '}·' + mask(ix); }
    function snap(c, hl) { var key = pidx.length ? ',' + pidx.join(',') : ''; seen[key] = 1; rec.s(c, { path: path.slice(), res: res.slice(), seen: Object.assign({}, seen), key: key, hl: hl || '' }); }
    snap('Sinh mọi tập con của ' + bA(a) + ': mỗi nút của cây là một tập con; từ một nút chỉ thêm các phần tử ' + b('đứng sau') + ' phần tử vừa chọn.');
    (function bt(start) {
      rec.inc('lời gọi');
      res.push(lab(path, pidx)); rec.inc('tập con');
      snap('Ghi nhận tập con ' + b('{' + path.join(', ') + '}') + ' (bitmask ' + code(mask(pidx)) + ')', 'done');
      for (var i = start; i < n; i++) {
        path.push(a[i]); pidx.push(i);
        snap('Chọn ' + b(a[i]) + ' → path = ' + bA(path));
        bt(i + 1);
        path.pop(); pidx.pop();
        snap('Quay lui: bỏ ' + b(a[i]) + ' → path = ' + bA(path), 'back');
      }
    })(0);
    rec.s('Hoàn tất! Có ' + b(res.length) + ' = 2^' + n + ' tập con. Mỗi tập con ứng với một bitmask ' + n + ' bit (bit i = 1 nếu chọn phần tử thứ i).', { path: [], res: res.slice(), seen: seen, key: null, hl: '' });
    return { steps: rec.steps, result: res.map(function (r) { return r.split('·')[0]; }), leg: [['cur', 'đường đi hiện tại'], ['done', 'vừa ghi nhận'], ['vis', 'đã thăm']],
      render: function (x) {
        var parts = [];
        if (showTree) {
          var s = '', onPath = {};
          if (x.key != null) { var acc = ''; onPath[''] = 1; x.key.split(',').slice(1).forEach(function (q) { acc += ',' + q; onPath[acc] = 1; }); }
          nodes.forEach(function (nd) { nd.kids.forEach(function (c) { if (x.seen[nodes[c].key]) s += L(nd.px, nd.py + 10, nodes[c].px, nodes[c].py - 10, onPath[nodes[c].key] ? 'cur' : ''); }); });
          nodes.forEach(function (nd) {
            if (!x.seen[nd.key]) return;
            var st = onPath[nd.key] ? (nd.key === x.key && x.hl === 'done' ? 'done' : 'cur') : 'vis';
            s += C(nd.px, nd.py, 12, st) + T(nd.px, nd.py, nd.lab, 'av-v av-sm');
          });
          parts.push(blk(dims.w, dims.h, s));
        }
        parts.push(cells(x.path.concat(mk(n - x.path.length, function () { return ''; })), { w: 30, label: 'path', labelW: 44, cls: x.path.map(function () { return 'cur'; }) }));
        parts.push(chips(x.res, { label: 'Kết quả:', empty: '—', maxW: 380, cls: x.res.map(function (_, i) { return i === x.res.length - 1 && x.hl === 'done' ? 'done' : ''; }) }));
        return vstack(parts, 12);
      } };
  });

  reg('recursion', 'nqueens', function (P) {
    var n = P.int('n', { min: 4, max: 8, ex: '4' }), cols = [], rec = new Rec(['lần thử', 'quay lui']), sol = null;
    function snap(c, tryC, bad, st) { rec.s(c, { q: cols.slice(), t: tryC, bad: bad, st: st || '' }); }
    function conflict(r, c) { for (var i = 0; i < r; i++) { if (cols[i] === c) return [i, 'cùng cột']; if (Math.abs(cols[i] - c) === r - i) return [i, 'cùng đường chéo']; } return null; }
    snap('Đặt ' + n + ' quân hậu lên bàn cờ ' + n + '×' + n + ' sao cho không quân nào ăn nhau: mỗi hàng một quân, thử lần lượt từng cột.', null, null);
    (function place(r) {
      if (r === n) { sol = cols.slice(); return true; }
      for (var c = 0; c < n; c++) {
        rec.inc('lần thử');
        var cf = conflict(r, c);
        if (cf) { snap('Hàng ' + r + ', thử cột ' + c + ': bị hậu ở (' + cf[0] + ', ' + cols[cf[0]] + ') tấn công (' + cf[1] + ') ✗', [r, c], [cf[0], cols[cf[0]]], 'bad'); continue; }
        cols.push(c);
        snap('Hàng ' + r + ', thử cột ' + c + ': an toàn → đặt hậu tại (' + r + ', ' + c + ')', [r, c], null, 'new');
        if (place(r + 1)) return true;
        cols.pop(); rec.inc('quay lui');
        snap('Không đặt được hàng ' + (r + 1) + ' → quay lui: nhấc hậu ở (' + r + ', ' + c + ') và thử cột tiếp theo', [r, c], null, 'back');
      }
      return false;
    })(0);
    rec.s(sol ? 'Tìm thấy lời giải! Cột của hậu theo từng hàng: ' + bA(sol) + '.' : 'Không có lời giải.', { q: cols.slice(), t: null, bad: null, st: 'done' });
    return { steps: rec.steps, result: sol, leg: [['new', 'vừa đặt'], ['bad', 'ô bị tấn công'], ['cmp', 'hậu tấn công'], ['done', 'lời giải']],
      render: function (x) {
        var cs = n <= 6 ? 42 : 34, s = '', L0 = 16;
        for (var r = 0; r < n; r++) {
          s += T(L0 - 8, 16 + r * cs + cs / 2, r, 'av-i');
          for (var c = 0; c < n; c++) {
            var st = '';
            if (x.t && x.t[0] === r && x.t[1] === c) st = x.st === 'bad' ? 'bad' : (x.st === 'back' ? 'dim' : 'new');
            if (x.bad && x.bad[0] === r && x.bad[1] === c) st = 'cmp';
            if (x.st === 'done' && x.q[r] === c) st = 'done';
            s += '<rect x="' + (L0 + c * cs) + '" y="' + (16 + r * cs) + '" width="' + cs + '" height="' + cs + '" class="' + ((r + c) % 2 ? 'av-dark' : 'av-light') + '"/>';
            if (st) s += R(L0 + c * cs + 1.5, 16 + r * cs + 1.5, cs - 3, cs - 3, st, 3);
            if (x.q[r] === c) s += T(L0 + c * cs + cs / 2, 16 + r * cs + cs / 2 + 1, '♛', 'av-v av-big');
          }
        }
        for (c = 0; c < n; c++) s += T(L0 + c * cs + cs / 2, 7, c, 'av-i');
        s += '<rect x="' + L0 + '" y="16" width="' + n * cs + '" height="' + n * cs + '" class="av-end"/>';
        return blk(L0 + n * cs + 2, 18 + n * cs, s);
      } };
  });

  /* ================================================================
   * 10. BST (tree)
   * ================================================================ */
  function bstIns(T, v) {
    var nd = { v: v, l: -1, r: -1 };
    if (T.root < 0) { T.nodes.push(nd); T.root = T.nodes.length - 1; return T.root; }
    var c = T.root;
    while (true) {
      var cur = T.nodes[c];
      if (v === cur.v) return -1;
      var side = v < cur.v ? 'l' : 'r';
      if (cur[side] < 0) { T.nodes.push(nd); cur[side] = T.nodes.length - 1; return cur[side]; }
      c = cur[side];
    }
  }
  function bstLevel(T) { var out = [], q = T.root >= 0 ? [T.root] : []; while (q.length) { var i = q.shift(), nd = T.nodes[i]; out.push(nd.v); if (nd.l >= 0) q.push(nd.l); if (nd.r >= 0) q.push(nd.r); } return out; }
  function bstBlock(Tr, cls) {
    var k = 0, dep = 0, pos = {}, slot = 40, lh = 54, r = 17, s = '', ON = { vis: 1, cmp: 1, done: 1, swap: 1, cur: 1 };
    (function go(i, d) { if (i < 0) return; go(Tr.nodes[i].l, d + 1); pos[i] = [k++ * slot + slot / 2, r + 2 + d * lh]; dep = Math.max(dep, d); go(Tr.nodes[i].r, d + 1); })(Tr.root, 0);
    Object.keys(pos).forEach(function (i) {
      var nd = Tr.nodes[i];
      [nd.l, nd.r].forEach(function (c) { if (c >= 0) s += L(pos[i][0], pos[i][1], pos[c][0], pos[c][1], ON[cls[i]] && ON[cls[c]] ? 'vis' : ''); });
    });
    Object.keys(pos).forEach(function (i) { s += C(pos[i][0], pos[i][1], r, cls[i]) + T(pos[i][0], pos[i][1], Tr.nodes[i].v, String(Tr.nodes[i].v).length > 2 ? 'av-v av-sm' : 'av-v'); });
    if (Tr.root < 0) s += T(slot, r, '(cây rỗng)', 'av-i');
    return blk(Math.max(k, 2) * slot, 2 * r + 4 + dep * lh, s);
  }
  function bstSetup(P) {
    var vals = P.nums('input', { ex: '50,30,70,20,40,60,80', maxLen: 15 }), T = { nodes: [], root: -1 };
    return { vals: vals, T: T, build: function () { vals.forEach(function (v) { bstIns(T, v); }); } };
  }
  function bstRender(extra) {
    return function (x) {
      var parts = [bstBlock(x.T, x.cls || {})];
      if (extra) extra(x, parts);
      return vstack(parts, 12);
    };
  }
  var LEG_BST = [['cmp', 'đang so sánh'], ['vis', 'đường đi'], ['new', 'nút mới'], ['done', 'kết quả'], ['swap', 'thay đổi']];

  reg('tree', 'bst-insert', function (P) {
    var S = bstSetup(P), T = S.T, rec = new Rec(['so sánh']);
    function snap(c, cls) { rec.s(c, { T: clone(T), cls: cls || {} }); }
    snap('Xây BST bằng cách chèn lần lượt ' + bA(S.vals) + '. Nhỏ hơn → sang trái, lớn hơn → sang phải.');
    S.vals.forEach(function (v) {
      if (T.root < 0) { bstIns(T, v); snap('Cây rỗng → ' + b(v) + ' trở thành gốc', M(T.root, 'new')); return; }
      var c = T.root, path = {};
      while (true) {
        var nd = T.nodes[c]; rec.inc('so sánh');
        var cls = Object.assign({}, path, M(c, 'cmp'));
        if (v === nd.v) { snap('Chèn ' + b(v) + ': bằng ' + nd.v + ' → khóa đã tồn tại, bỏ qua', cls); break; }
        var side = v < nd.v ? 'l' : 'r', word = v < nd.v ? v + ' < ' + nd.v + ' → đi sang trái' : v + ' > ' + nd.v + ' → đi sang phải';
        if (nd[side] < 0) {
          snap('Chèn ' + b(v) + ': ' + word + ' — chỗ trống', cls);
          var id = bstIns(T, v); path[c] = 'vis';
          snap('Đặt ' + b(v) + ' làm con ' + (side === 'l' ? 'trái' : 'phải') + ' của ' + nd.v, Object.assign({}, path, M(id, 'new')));
          break;
        }
        snap('Chèn ' + b(v) + ': ' + word, cls);
        path[c] = 'vis'; c = nd[side];
      }
    });
    var ino = []; (function go(i) { if (i < 0) return; go(T.nodes[i].l); ino.push(T.nodes[i].v); go(T.nodes[i].r); })(T.root);
    snap('Hoàn tất! Duyệt inorder cho dãy tăng dần: ' + bA(ino) + '.');
    return { steps: rec.steps, result: bstLevel(T), leg: LEG_BST, render: bstRender() };
  });

  reg('tree', 'bst-search', function (P) {
    var S = bstSetup(P), T = S.T, t = P.int('target'), rec = new Rec(['so sánh']), found = false, pv = [];
    S.build();
    function snap(c, cls) { rec.s(c, { T: T, cls: cls || {} }); }
    snap('Tìm ' + b(t) + ' trong BST: bắt đầu từ gốc, mỗi lần so sánh loại bỏ một nhánh.');
    var c = T.root, path = {};
    while (c >= 0) {
      var nd = T.nodes[c]; rec.inc('so sánh'); pv.push(nd.v);
      if (nd.v === t) { found = true; snap('So sánh với ' + b(nd.v) + ' → bằng ' + t + ' → tìm thấy sau ' + pv.length + ' lần so sánh!', Object.assign({}, path, M(c, 'done'))); break; }
      var left = t < nd.v;
      snap('So sánh với ' + b(nd.v) + ' → ' + t + (left ? ' < ' : ' > ') + nd.v + ' → đi sang ' + (left ? 'trái' : 'phải') + (((left ? nd.l : nd.r) < 0) ? ', nhưng nhánh đó rỗng' : ''), Object.assign({}, path, M(c, 'cmp')));
      path[c] = 'vis'; c = left ? nd.l : nd.r;
    }
    if (!found) snap('Gặp null → ' + b(t) + ' không có trong cây.', path);
    return { steps: rec.steps, result: { found: found, path: pv }, leg: LEG_BST, render: bstRender() };
  });

  reg('tree', 'bst-delete', function (P) {
    var S = bstSetup(P), T = S.T, t = P.int('target', { ex: '30' }), rec = new Rec(['so sánh']);
    S.build();
    function snap(c, cls) { rec.s(c, { T: clone(T), cls: cls || {} }); }
    function repl(p, c, child) { if (p < 0) T.root = child; else if (T.nodes[p].l === c) T.nodes[p].l = child; else T.nodes[p].r = child; }
    snap('Xóa ' + b(t) + ' khỏi BST. Trước tiên tìm nút chứa ' + t + '.');
    var p = -1, c = T.root, path = {};
    while (c >= 0 && T.nodes[c].v !== t) {
      rec.inc('so sánh');
      var left = t < T.nodes[c].v;
      snap('So sánh với ' + b(T.nodes[c].v) + ' → đi sang ' + (left ? 'trái' : 'phải'), Object.assign({}, path, M(c, 'cmp')));
      path[c] = 'vis'; p = c; c = left ? T.nodes[c].l : T.nodes[c].r;
    }
    if (c < 0) snap('Không tìm thấy ' + b(t) + ' → cây giữ nguyên.', path);
    else {
      rec.inc('so sánh');
      var nd = T.nodes[c];
      if (nd.l < 0 && nd.r < 0) {
        snap('Tìm thấy ' + b(t) + '. Trường hợp 1: nút lá → chỉ cần gỡ bỏ.', Object.assign({}, path, M(c, 'swap')));
        repl(p, c, -1); snap('Đã gỡ ' + b(t) + '.', {});
      } else if (nd.l < 0 || nd.r < 0) {
        var ch = nd.l >= 0 ? nd.l : nd.r;
        snap('Tìm thấy ' + b(t) + '. Trường hợp 2: chỉ có một con (' + T.nodes[ch].v + ') → nối con đó lên thay chỗ.', Object.assign({}, path, M(c, 'swap', ch, 'cmp')));
        repl(p, c, ch); snap('Đã thay ' + b(t) + ' bằng ' + b(T.nodes[ch].v) + '.', M(ch, 'done'));
      } else {
        snap('Tìm thấy ' + b(t) + '. Trường hợp 3: có hai con → thay bằng successor (nút nhỏ nhất của cây con phải).', Object.assign({}, path, M(c, 'swap')));
        var sp = c, s = nd.r, sc2 = M(c, 'swap');
        snap('Sang phải một bước: ' + b(T.nodes[s].v), Object.assign({}, sc2, M(s, 'cmp')));
        while (T.nodes[s].l >= 0) { sc2[s] = 'vis'; sp = s; s = T.nodes[s].l; snap('Đi tiếp sang trái: ' + b(T.nodes[s].v), Object.assign({}, sc2, M(s, 'cmp'))); }
        snap('Successor = ' + b(T.nodes[s].v) + ' (không còn con trái).', Object.assign({}, sc2, M(s, 'done')));
        nd.v = T.nodes[s].v;
        snap('Chép ' + b(nd.v) + ' vào vị trí của ' + t + '; giờ cần xóa nút successor cũ.', M(c, 'done', s, 'swap'));
        repl(sp, s, T.nodes[s].r);
        snap('Đã xóa successor cũ (nối con phải của nó, nếu có, lên thay).', M(c, 'done'));
      }
      snap('Hoàn tất! Duyệt theo tầng: ' + bA(bstLevel(T)) + '.', {});
    }
    return { steps: rec.steps, result: bstLevel(T), leg: LEG_BST, render: bstRender() };
  });

  function travReg(kind) {
    reg('tree', kind, function (P) {
      var S = bstSetup(P), T = S.T, rec = new Rec(['nút đã in']), out = [], cls = {}, q = [];
      S.build();
      var NAME = { inorder: 'Inorder (trái → gốc → phải)', preorder: 'Preorder (gốc → trái → phải)', postorder: 'Postorder (trái → phải → gốc)', levelorder: 'Level-order (theo tầng, dùng hàng đợi)' };
      function snap(c) { rec.s(c, { T: T, cls: Object.assign({}, cls), out: out.slice(), q: q.map(function (i) { return T.nodes[i].v; }) }); }
      function emit(i) { out.push(T.nodes[i].v); rec.inc('nút đã in'); cls[i] = 'done'; }
      snap('Duyệt cây ' + NAME[kind] + '.');
      if (kind === 'levelorder') {
        if (T.root >= 0) q.push(T.root);
        snap('Cho gốc ' + b(T.nodes[T.root].v) + ' vào hàng đợi.');
        while (q.length) {
          var i = q.shift(); emit(i); cls[i] = 'cur';
          var nd = T.nodes[i], kids = [nd.l, nd.r].filter(function (c) { return c >= 0; });
          kids.forEach(function (c) { q.push(c); cls[c] = 'q'; });
          snap('Lấy ' + b(nd.v) + ' ra khỏi hàng đợi → in; ' + (kids.length ? 'cho các con ' + kids.map(function (c) { return T.nodes[c].v; }).join(', ') + ' vào hàng đợi' : 'không có con'));
          cls[i] = 'done';
        }
      } else {
        (function go(i) {
          if (i < 0) return;
          var nd = T.nodes[i]; cls[i] = 'cur';
          if (kind === 'preorder') { emit(i); snap('Tới ' + b(nd.v) + ' → in ngay (gốc trước), rồi sang trái, sang phải'); cls[i] = 'done'; }
          else snap('Tới ' + b(nd.v) + ' → ' + (kind === 'inorder' ? 'duyệt cây con trái trước' : 'duyệt hai cây con trước'));
          if (kind !== 'preorder') cls[i] = 'vis';
          go(nd.l);
          if (kind === 'inorder') { cls[i] = 'cur'; emit(i); snap('Xong cây con trái của ' + nd.v + ' → in ' + b(nd.v) + ', rồi sang phải'); cls[i] = 'done'; }
          go(nd.r);
          if (kind === 'postorder') { cls[i] = 'cur'; emit(i); snap('Xong cả hai cây con của ' + nd.v + ' → in ' + b(nd.v)); cls[i] = 'done'; }
        })(T.root);
      }
      snap('Hoàn tất! Thứ tự ' + kind + ': ' + bA(out));
      return { steps: rec.steps, result: out.slice(), leg: [['cur', 'nút đang xét'], ['vis', 'đang chờ (trên đường đi)'], ['q', 'trong hàng đợi'], ['done', 'đã in']],
        render: bstRender(function (x, parts) {
          if (kind === 'levelorder') parts.push(chips(x.q, { label: 'Hàng đợi:', empty: '(rỗng)', maxW: 380 }));
          parts.push(chips(x.out, { label: 'Kết quả:', empty: '—', maxW: 380 }));
        }) };
    });
  }
  ['inorder', 'preorder', 'postorder', 'levelorder'].forEach(travReg);

  /* ================================================================
   * 11. HEAP
   * ================================================================ */
  function heapReg(kind) {
    reg('heap', kind, function (P) {
      var inp = P.nums('input', { ex: '5,3,8,1,9,2', maxLen: 15 }), tp = (P.raw('type') || 'min').toLowerCase();
      if (tp !== 'min' && tp !== 'max') fail('<code>data-type</code> chỉ nhận "min" hoặc "max".');
      var mx = tp === 'max', rec = new Rec(['so sánh', 'hoán đổi']), a = kind === 'insert' ? [] : inp.slice(), out = [];
      var better = function (x, y) { return mx ? x > y : x < y; }, SY = mx ? '>' : '<', NSY = mx ? '≤' : '≥', HN = mx ? 'max-heap' : 'min-heap';
      function snap(c, cls) { rec.s(c, { a: a.slice(), cls: cls || {}, out: out.slice() }); }
      function up(i) {
        while (i > 0) {
          var p = (i - 1) >> 1; rec.inc('so sánh');
          if (better(a[i], a[p])) {
            snap(b(a[i]) + ' ' + SY + ' cha ' + b(a[p]) + ' → vi phạm tính chất ' + HN + ', hoán đổi lên', M(i, 'cmp', p, 'cmp'));
            swap(a, i, p); rec.inc('hoán đổi'); snap('Đã hoán đổi: ' + b(a[p]) + ' lên vị trí ' + p, M(p, 'swap', i, 'swap')); i = p;
          } else { snap(b(a[i]) + ' ' + NSY + ' cha ' + b(a[p]) + ' → đúng vị trí, dừng sift-up', M(i, 'done', p, 'cmp')); return; }
        }
        snap(b(a[0]) + ' đã lên tới gốc.', M(0, 'done'));
      }
      function down(i, size) {
        while (true) {
          var l = 2 * i + 1, r = 2 * i + 2, bst = i;
          if (l >= size) { snap(b(a[i]) + ' không còn con → dừng sift-down', M(i, 'done')); return; }
          rec.inc('so sánh'); if (better(a[l], a[bst])) bst = l;
          if (r < size) { rec.inc('so sánh'); if (better(a[r], a[bst])) bst = r; }
          var kids = 'con ' + a[l] + (r < size ? ', ' + a[r] : '');
          if (bst === i) { snap('So sánh ' + b(a[i]) + ' với ' + kids + ' → cha đã ' + (mx ? 'lớn' : 'nhỏ') + ' nhất, dừng', M(i, 'done', l, 'cmp', r < size ? r : null, 'cmp')); return; }
          snap('So sánh ' + b(a[i]) + ' với ' + kids + ' → con ' + (mx ? 'lớn' : 'nhỏ') + ' nhất là ' + b(a[bst]) + ' → hoán đổi xuống', M(i, 'cur', l, 'cmp', r < size ? r : null, 'cmp'));
          swap(a, i, bst); rec.inc('hoán đổi'); snap('Đã hoán đổi: ' + b(a[bst]) + ' xuống vị trí ' + bst, M(i, 'swap', bst, 'swap')); i = bst;
        }
      }
      if (kind === 'insert') {
        snap('Chèn lần lượt ' + bA(inp) + ' vào ' + HN + ' rỗng: thêm vào cuối mảng rồi sift-up.');
        inp.forEach(function (v) { a.push(v); snap('Thêm ' + b(v) + ' vào cuối mảng (chỉ số ' + (a.length - 1) + ')', M(a.length - 1, 'new')); up(a.length - 1); });
      } else {
        snap('Mảng ' + bA(a) + '. Heapify (build-heap): sift-down từ nút trong cuối cùng (chỉ số ' + ((a.length >> 1) - 1) + ') ngược về gốc → O(n).');
        for (var i = (a.length >> 1) - 1; i >= 0; i--) { snap('Sift-down nút a[' + i + '] = ' + b(a[i]), M(i, 'cur')); down(i, a.length); }
        snap('Đã có ' + HN + ': ' + bA(a) + '. Gốc = ' + b(a[0]) + ' là phần tử ' + (mx ? 'lớn' : 'nhỏ') + ' nhất.', M(0, 'done'));
        if (kind === 'extract') {
          while (a.length) {
            var top = a[0];
            snap('Extract: lấy gốc ' + b(top) + ' ra', M(0, 'swap'));
            out.push(top);
            var last = a.pop();
            if (a.length) { a[0] = last; snap('Đưa phần tử cuối ' + b(last) + ' lên gốc, rồi sift-down', M(0, 'cur')); down(0, a.length); }
          }
          snap('Hoàn tất! Thứ tự lấy ra: ' + bA(out) + ' — đã sắp ' + (mx ? 'giảm' : 'tăng') + ' dần (đây chính là heap sort).');
        }
      }
      if (kind !== 'extract') snap('Hoàn tất! ' + HN + ' dạng mảng: ' + bA(a) + '. Con của i ở 2i+1, 2i+2; cha ở ⌊(i−1)/2⌋.');
      return { steps: rec.steps, result: kind === 'extract' ? out.slice() : a.slice(), leg: [['cmp', 'đang so sánh'], ['cur', 'nút đang xét'], ['swap', 'hoán đổi'], ['new', 'vừa thêm'], ['done', 'đúng vị trí']],
        render: function (x) {
          var cls = x.a.map(function (_, i) { return x.cls[i] || ''; });
          var parts = [x.a.length ? heapTree(x.a, cls, x.a.length, { idx: true }) : tb('(heap rỗng)', 'av-i'), cells(x.a.length ? x.a : [''], { w: 32, idx: x.a.length ? true : false, cls: cls })];
          if (kind === 'extract') parts.push(chips(x.out, { label: 'Đã lấy ra:', empty: '—', maxW: 380 }));
          return vstack(parts, 14);
        } };
    });
  }
  ['insert', 'heapify', 'extract'].forEach(heapReg);

  /* ================================================================
   * 12. GRAPH
   * ================================================================ */
  function graphSetup(P) {
    var names = P.list('nodes', { ex: 'A,B,C,D', maxLen: 12, itemMax: 4 }), id = {};
    names.forEach(function (nm, i) { if (nm in id) fail('Đỉnh "' + esc(nm) + '" bị lặp trong <code>data-nodes</code>.'); id[nm] = i; });
    var raw = P.list('edges', { ex: 'A-B:4,A-C:2', maxLen: 40 }), directed = P.bool('directed'), weighted = false, edges = [];
    raw.forEach(function (e) {
      var m = e.match(/^([^\s:-]+)\s*-\s*([^\s:]+)\s*(?::\s*(-?\d+(?:\.\d+)?))?$/);
      if (!m) fail('Cạnh "' + esc(e) + '" sai định dạng (ví dụ: <code>A-B:4</code> hoặc <code>A-B</code>).');
      if (!(m[1] in id) || !(m[2] in id)) fail('Cạnh "' + esc(e) + '" dùng đỉnh không có trong <code>data-nodes</code>.');
      if (m[3] != null) weighted = true;
      edges.push({ u: id[m[1]], v: id[m[2]], w: m[3] != null ? +m[3] : 1 });
    });
    edges.forEach(function (e) { e.rev = directed && edges.some(function (f) { return f.u === e.v && f.v === e.u; }); });
    var adj = names.map(function () { return []; });
    edges.forEach(function (e, k) { adj[e.u].push({ v: e.v, w: e.w, e: k }); if (!directed) adj[e.v].push({ v: e.u, w: e.w, e: k }); });
    var sv = P.raw('start'), start = sv ? id[sv] : 0;
    if (sv && start == null) fail('<code>data-start="' + esc(sv) + '"</code> không có trong <code>data-nodes</code>.');
    var n = names.length, R = n <= 3 ? 70 : Math.max(88, n * 17), pad = 46;
    var pos = names.map(function (_, i) { var a = -Math.PI / 2 + 2 * Math.PI * i / n; return [pad + R + R * Math.cos(a), pad + R + R * Math.sin(a), Math.cos(a), Math.sin(a)]; });
    var G = { names: names, id: id, edges: edges, adj: adj, directed: directed, weighted: weighted, start: start, pos: pos, W: 2 * (pad + R), H: 2 * (pad + R) };
    G.N = function (i) { return names[i]; };
    G.E = function (k) { var e = edges[k]; return names[e.u] + (directed ? '→' : '–') + names[e.v] + (weighted ? ' (' + e.w + ')' : ''); };
    return G;
  }
  function graphBlock(G, x) {
    var s = '', top = '', r = 18;
    G.edges.forEach(function (e, k) {
      var a = G.pos[e.u], c = G.pos[e.v], st = (x.es && x.es[k]) || '', lx, ly, piece = '';
      if (e.u === e.v) { piece = C(a[0] + a[2] * 26, a[1] + a[3] * 26, 10, '', 'av-bucket'); lx = a[0] + a[2] * 40; ly = a[1] + a[3] * 40; }
      else if (G.directed && e.rev) { var cv = curve(a[0], a[1], c[0], c[1], 20, st, r, r + 1); piece = cv.s; lx = cv.lx; ly = cv.ly; }
      else { piece = G.directed ? arrow(a[0], a[1], c[0], c[1], st, r, r + 1) : L(a[0], a[1], c[0], c[1], st); lx = (a[0] + c[0]) / 2; ly = (a[1] + c[1]) / 2; }
      if (G.weighted) { var ww = tw(e.w, 11.5) + 6; piece += '<rect class="av-wbg" x="' + r1(lx - ww / 2) + '" y="' + r1(ly - 8) + '" width="' + r1(ww) + '" height="16" rx="3"/>' + T(lx, ly, e.w, 'av-w' + (st && st !== 'dim' ? ' av-p' : '')); }
      if (st && st !== 'dim') top += piece; else s += piece;
    });
    s += top;
    G.names.forEach(function (nm, i) {
      var p = G.pos[i];
      s += C(p[0], p[1], r, x.ns && x.ns[i]) + T(p[0], p[1], nm, nm.length > 2 ? 'av-v av-sm' : 'av-v');
      if (x.bd && x.bd[i] != null) s += T(p[0] + p[2] * (r + 16), p[1] + p[3] * (r + 14), x.bd[i], 'av-p');
    });
    return blk(G.W, G.H, s);
  }
  function gTable(G, vals, label, cls) { return cells(vals, { w: 34, h: 26, idx: G.names, label: label, labelW: 64, cls: cls }); }
  function gOut(G, def, extraParts) {
    def.render = function (x) { return vstack([graphBlock(G, x)].concat(extraParts(x)), 12); };
    return def;
  }

  reg('graph', 'bfs', function (P) {
    var G = graphSetup(P), n = G.names.length, rec = new Rec(['đỉnh đã thăm', 'cạnh đã xét']);
    var ns = mk(n, function () { return ''; }), es = G.edges.map(function () { return ''; }), vis = {}, q = [], order = [];
    function snap(c) { rec.s(c, { ns: ns.slice(), es: es.slice(), q: q.map(G.N), order: order.map(G.N) }); }
    vis[G.start] = 1; q.push(G.start); ns[G.start] = 'q';
    snap('Bắt đầu BFS từ ' + b(G.N(G.start)) + ': đánh dấu đã thăm và cho vào hàng đợi.');
    while (q.length) {
      var u = q.shift(); order.push(u); ns[u] = 'cur'; rec.inc('đỉnh đã thăm');
      snap('Lấy ' + b(G.N(u)) + ' ra khỏi đầu hàng đợi → thăm. Xét các đỉnh kề của ' + G.N(u) + '.');
      G.adj[u].forEach(function (a) {
        rec.inc('cạnh đã xét');
        if (!vis[a.v]) { vis[a.v] = 1; q.push(a.v); ns[a.v] = 'q'; es[a.e] = 'done'; snap(G.N(u) + ' – ' + b(G.N(a.v)) + ': chưa thăm → đánh dấu, cho vào cuối hàng đợi'); }
        else if (es[a.e] !== 'done') { es[a.e] = 'cmp'; snap(G.N(u) + ' – ' + b(G.N(a.v)) + ': đã được đánh dấu → bỏ qua'); es[a.e] = 'dim'; }
      });
      ns[u] = 'vis';
    }
    var miss = G.names.filter(function (_, i) { return !vis[i]; });
    snap('Hoàn tất! Thứ tự BFS: ' + b(order.map(G.N).join(' → ')) + '. Các cạnh xanh tạo thành cây BFS (đường đi ít cạnh nhất từ ' + G.N(G.start) + ').' + (miss.length ? ' Không tới được: ' + esc(miss.join(', ')) + '.' : ''));
    return gOut(G, { steps: rec.steps, result: order.map(G.N), leg: [['cur', 'đang xét'], ['q', 'trong hàng đợi'], ['vis', 'đã thăm'], ['done', 'cạnh cây BFS']] }, function (x) {
      return [chips(x.q, { label: 'Hàng đợi:', empty: '(rỗng)', maxW: 380 }), chips(x.order, { label: 'Thứ tự thăm:', empty: '—', maxW: 380 })];
    });
  });

  reg('graph', 'dfs', function (P) {
    var G = graphSetup(P), n = G.names.length, rec = new Rec(['đỉnh đã thăm', 'cạnh đã xét']);
    var ns = mk(n, function () { return ''; }), es = G.edges.map(function () { return ''; }), vis = {}, stk = [], order = [];
    function snap(c) { rec.s(c, { ns: ns.slice(), es: es.slice(), stk: stk.map(G.N), order: order.map(G.N) }); }
    snap('Bắt đầu DFS (đệ quy) từ ' + b(G.N(G.start)) + ': đi sâu hết mức theo một nhánh rồi mới quay lui.');
    (function dfs(u, from) {
      vis[u] = 1; order.push(u); stk.push(u); rec.inc('đỉnh đã thăm');
      if (from != null) ns[from] = 'q';
      ns[u] = 'cur';
      snap('Thăm ' + b(G.N(u)) + ' (push vào stack đệ quy).');
      G.adj[u].forEach(function (a) {
        if (es[a.e] === 'done' && vis[a.v]) return;
        rec.inc('cạnh đã xét');
        if (!vis[a.v]) { es[a.e] = 'done'; snap(G.N(u) + ' – ' + b(G.N(a.v)) + ': chưa thăm → đi sâu vào ' + G.N(a.v)); dfs(a.v, u); ns[u] = 'cur'; snap('Quay lại ' + b(G.N(u)) + ', xét tiếp các đỉnh kề còn lại.'); }
        else { var o = es[a.e]; es[a.e] = 'cmp'; snap(G.N(u) + ' – ' + b(G.N(a.v)) + ': đã thăm → bỏ qua'); es[a.e] = o || 'dim'; }
      });
      stk.pop(); ns[u] = 'vis';
    })(G.start, null);
    snap('Hoàn tất! Thứ tự DFS: ' + b(order.map(G.N).join(' → ')) + '.');
    return gOut(G, { steps: rec.steps, result: order.map(G.N), leg: [['cur', 'đang xét'], ['q', 'trên stack (chờ quay lại)'], ['vis', 'đã xong'], ['done', 'cạnh cây DFS']] }, function (x) {
      return [chips(x.stk, { label: 'Stack:', empty: '(rỗng)', maxW: 380 }), chips(x.order, { label: 'Thứ tự thăm:', empty: '—', maxW: 380 })];
    });
  });

  function distMap(G, d) { var o = {}; G.names.forEach(function (nm, i) { o[nm] = d[i] === Infinity ? null : d[i]; }); return o; }

  reg('graph', 'dijkstra', function (P) {
    var G = graphSetup(P), n = G.names.length, rec = new Rec(['lần relax', 'cập nhật']);
    G.edges.forEach(function (e) { if (e.w < 0) fail('Dijkstra không dùng được với trọng số âm (cạnh ' + esc(G.E(G.edges.indexOf(e))) + '). Hãy dùng <code>bellman-ford</code>.'); });
    var d = mk(n, function () { return Infinity; }), pe = mk(n, function () { return -1; }), done = {}, cur = -1, ex = -1;
    d[G.start] = 0;
    function snap(c) {
      var es = G.edges.map(function () { return ''; }); pe.forEach(function (k) { if (k >= 0) es[k] = 'done'; }); if (ex >= 0) es[ex] = 'cmp';
      var ns = mk(n, function (i) { return i === cur ? 'cur' : done[i] ? 'vis' : (d[i] < Infinity ? 'q' : ''); });
      rec.s(c, { ns: ns, es: es, bd: d.map(fmt), d: d.slice(), prev: pe.map(function (k, i) { return k < 0 ? '-' : G.N(G.edges[k].u === i ? G.edges[k].v : G.edges[k].u); }), dn: Object.assign({}, done) });
    }
    snap('Khởi tạo: dist[' + G.N(G.start) + '] = 0, các đỉnh khác = ∞. Mỗi vòng chốt đỉnh chưa chốt có dist nhỏ nhất.');
    while (true) {
      var u = -1;
      for (var i = 0; i < n; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
      if (u < 0) break;
      done[u] = 1; cur = u; ex = -1;
      snap('Chọn ' + b(G.N(u)) + ' (dist nhỏ nhất chưa chốt = ' + d[u] + ') → chốt: dist[' + G.N(u) + '] = ' + b(d[u]) + ' là tối ưu.');
      G.adj[u].forEach(function (a) {
        if (done[a.v]) return;
        rec.inc('lần relax'); ex = a.e;
        var nd = d[u] + a.w, hd = 'Relax ' + G.N(u) + ' → ' + G.N(a.v) + ': dist[' + G.N(u) + '] + ' + a.w + ' = ' + nd;
        if (nd < d[a.v]) { var old = d[a.v]; d[a.v] = nd; pe[a.v] = a.e; rec.inc('cập nhật'); snap(hd + ' < ' + fmt(old) + ' → cập nhật dist[' + G.N(a.v) + '] = ' + b(nd)); }
        else snap(hd + ' ≥ ' + d[a.v] + ' → giữ nguyên');
      });
      ex = -1;
    }
    cur = -1;
    snap('Hoàn tất! Khoảng cách ngắn nhất từ ' + G.N(G.start) + ': ' + G.names.map(function (nm, i) { return nm + ' = ' + b(d[i]); }).join(', ') + '. Cạnh xanh = cây đường đi ngắn nhất.');
    return gOut(G, { steps: rec.steps, result: distMap(G, d), leg: [['cur', 'vừa chốt'], ['vis', 'đã chốt'], ['q', 'đã có dist tạm'], ['cmp', 'cạnh đang relax'], ['done', 'cạnh đường đi ngắn nhất']] }, function (x) {
      return [vstack([gTable(G, x.d, 'dist', x.d.map(function (_, i) { return x.dn[i] ? 'vis' : ''; })), gTable(G, x.prev, 'trước')], 4, true)];
    });
  });

  reg('graph', 'bellman-ford', function (P) {
    var G = graphSetup(P), n = G.names.length, rec = new Rec(['lần relax', 'cập nhật']);
    var d = mk(n, function () { return Infinity; }), pe = mk(n, function () { return -1; }), ex = -1, hot = -1, neg = false;
    d[G.start] = 0;
    var dirs = [];
    G.edges.forEach(function (e, k) { dirs.push({ u: e.u, v: e.v, w: e.w, e: k }); if (!G.directed) dirs.push({ u: e.v, v: e.u, w: e.w, e: k }); });
    function snap(c, bad) {
      var es = G.edges.map(function () { return ''; }); pe.forEach(function (k) { if (k >= 0) es[k] = 'done'; }); if (ex >= 0) es[ex] = bad ? 'bad' : 'cmp';
      var ns = mk(n, function (i) { return i === hot ? 'cur' : (d[i] < Infinity ? 'q' : ''); });
      rec.s(c, { ns: ns, es: es, bd: d.map(fmt), d: d.slice(), hot: hot });
    }
    snap('Khởi tạo: dist[' + G.N(G.start) + '] = 0, còn lại ∞. Lặp tối đa V − 1 = ' + (n - 1) + ' vòng; mỗi vòng relax lần lượt mọi cạnh (chấp nhận trọng số âm).');
    for (var it = 1; it < n; it++) {
      var changed = false; ex = -1; hot = -1;
      snap('Vòng ' + b(it) + ': duyệt tất cả ' + dirs.length + ' cạnh theo thứ tự.');
      dirs.forEach(function (q) {
        ex = q.e; hot = -1; rec.inc('lần relax');
        var hd = 'Vòng ' + it + ', cạnh ' + G.N(q.u) + '→' + G.N(q.v) + ' (' + q.w + '): ';
        if (d[q.u] === Infinity) { snap(hd + 'dist[' + G.N(q.u) + '] = ∞ → chưa relax được'); return; }
        var nd = d[q.u] + q.w;
        if (nd < d[q.v]) { var old = d[q.v]; d[q.v] = nd; pe[q.v] = q.e; changed = true; hot = q.v; rec.inc('cập nhật'); snap(hd + d[q.u] + ' + ' + q.w + ' = ' + nd + ' < ' + fmt(old) + ' → cập nhật dist[' + G.N(q.v) + '] = ' + b(nd)); }
        else snap(hd + d[q.u] + ' + ' + q.w + ' = ' + nd + ' ≥ ' + d[q.v] + ' → giữ nguyên');
      });
      ex = -1; hot = -1;
      if (!changed) { snap('Vòng ' + it + ' không có cập nhật nào → dist đã ổn định, dừng sớm.'); break; }
    }
    ex = -1; hot = -1;
    snap('Kiểm tra chu trình âm: relax thêm một vòng — nếu còn cải thiện được thì có chu trình âm.');
    dirs.some(function (q) {
      if (d[q.u] !== Infinity && d[q.u] + q.w < d[q.v]) { neg = true; ex = q.e; snap('Cạnh ' + G.N(q.u) + '→' + G.N(q.v) + ' vẫn relax được → ' + b('có chu trình âm') + '! Khoảng cách ngắn nhất không xác định.', true); return true; }
      return false;
    });
    if (!neg) snap('Không cạnh nào relax thêm được → không có chu trình âm. Kết quả: ' + G.names.map(function (nm, i) { return nm + ' = ' + b(d[i]); }).join(', ') + '.');
    return gOut(G, { steps: rec.steps, result: { dist: distMap(G, d), negCycle: neg }, leg: [['cmp', 'cạnh đang relax'], ['cur', 'vừa cập nhật'], ['q', 'đã có dist'], ['done', 'cạnh đường đi hiện tại'], ['bad', 'chu trình âm']] }, function (x) {
      return [gTable(G, x.d, 'dist', x.d.map(function (_, i) { return i === x.hot ? 'cur' : ''; }))];
    });
  });

  function mstCheck(G) { if (G.directed) fail('Cây khung nhỏ nhất (Prim/Kruskal) cần đồ thị vô hướng — bỏ <code>data-directed</code>.'); }
  reg('graph', 'prim', function (P) {
    var G = graphSetup(P), n = G.names.length, rec = new Rec(['cạnh đã xét']); mstCheck(G);
    var inT = {}, mst = [], total = 0, cand = [], pick = -1;
    inT[G.start] = 1;
    function snap(c) {
      var es = G.edges.map(function () { return ''; }); cand.forEach(function (k) { es[k] = 'q'; }); mst.forEach(function (k) { es[k] = 'done'; }); if (pick >= 0) es[pick] = 'cmp';
      rec.s(c, { ns: mk(n, function (i) { return inT[i] ? 'vis' : ''; }), es: es, mst: mst.map(G.E), total: total });
    }
    snap('Prim: bắt đầu cây từ ' + b(G.N(G.start)) + '. Mỗi bước chọn cạnh nhẹ nhất nối cây với một đỉnh bên ngoài.');
    while (Object.keys(inT).length < n) {
      cand = []; pick = -1;
      G.edges.forEach(function (e, k) { if (!!inT[e.u] !== !!inT[e.v]) { cand.push(k); rec.inc('cạnh đã xét'); if (pick < 0 || e.w < G.edges[pick].w) pick = k; } });
      if (pick < 0) { snap('Không còn cạnh nào nối ra ngoài → đồ thị không liên thông; đây là cây khung của thành phần chứa ' + G.N(G.start) + '.'); break; }
      var e = G.edges[pick], nv = inT[e.u] ? e.v : e.u;
      snap('Các cạnh cắt (tím): ' + cand.map(function (k) { return esc(G.E(k)); }).join(', ') + ' → nhẹ nhất: ' + b(G.E(pick)));
      inT[nv] = 1; mst.push(pick); total += e.w; cand = []; var pk = pick; pick = -1;
      snap('Thêm cạnh ' + b(G.E(pk)) + ' và đỉnh ' + b(G.N(nv)) + ' vào cây. Tổng trọng số = ' + b(total));
    }
    snap('Hoàn tất! Cây khung nhỏ nhất gồm ' + mst.length + ' cạnh, tổng trọng số = ' + b(total) + '.');
    return gOut(G, { steps: rec.steps, result: { total: total, edges: mst.map(G.E) }, leg: [['vis', 'đỉnh trong cây'], ['q', 'cạnh ứng viên'], ['cmp', 'cạnh được chọn'], ['done', 'cạnh của MST']] }, function (x) {
      return [chips(x.mst, { label: 'MST (tổng ' + x.total + '):', empty: '—', maxW: 400 })];
    });
  });

  reg('graph', 'kruskal', function (P) {
    var G = graphSetup(P), n = G.names.length, rec = new Rec(['cạnh đã xét']); mstCheck(G);
    var order = G.edges.map(function (_, k) { return k; }).sort(function (a, c) { return G.edges[a].w - G.edges[c].w || a - c; });
    var par = range(n), rk = mk(n, function () { return 0; }), status = {}, mst = [], total = 0, curE = -1;
    function find(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
    function snap(c) {
      var es = G.edges.map(function (_, k) { return status[k] === 'ok' ? 'done' : status[k] === 'skip' ? 'dim' : ''; }); if (curE >= 0) es[curE] = status[curE] === 'skip' ? 'bad' : 'cmp';
      var roots = range(n).map(function (i) { var r = i; while (par[r] !== r) r = par[r]; return r; });
      var ns = mk(n, function (i) { return curE >= 0 && (G.edges[curE].u === i || G.edges[curE].v === i) ? 'cur' : (mst.length && roots.filter(function (r) { return r === roots[i]; }).length > 1 ? 'vis' : ''); });
      rec.s(c, { ns: ns, es: es, list: order.map(G.E), lc: order.map(function (k) { return k === curE ? (status[k] === 'skip' ? 'bad' : 'cmp') : status[k] === 'ok' ? 'done' : status[k] === 'skip' ? 'dim' : ''; }), grp: roots.map(G.N), total: total });
    }
    snap('Kruskal: sắp xếp các cạnh theo trọng số tăng dần, lần lượt chọn cạnh nếu nó không tạo chu trình (kiểm tra bằng Union-Find).');
    for (var t = 0; t < order.length && mst.length < n - 1; t++) {
      var k = order[t], e = G.edges[k], ru = find(e.u), rv = find(e.v); curE = k; rec.inc('cạnh đã xét');
      if (ru !== rv) {
        if (rk[ru] < rk[rv]) { var tmp = ru; ru = rv; rv = tmp; }
        par[rv] = ru; if (rk[ru] === rk[rv]) rk[ru]++;
        status[k] = 'ok'; mst.push(k); total += e.w;
        snap('Cạnh ' + b(G.E(k)) + ': ' + G.N(e.u) + ' và ' + G.N(e.v) + ' thuộc hai nhóm khác nhau → ' + b('chọn') + ', gộp hai nhóm. Tổng = ' + total);
      } else { status[k] = 'skip'; snap('Cạnh ' + b(G.E(k)) + ': ' + G.N(e.u) + ' và ' + G.N(e.v) + ' đã cùng nhóm → sẽ tạo chu trình → ' + b('bỏ qua')); }
    }
    curE = -1;
    snap((mst.length === n - 1 ? 'Đủ V − 1 = ' + (n - 1) + ' cạnh → xong! ' : 'Hết cạnh — đồ thị không liên thông. ') + 'Tổng trọng số cây khung nhỏ nhất = ' + b(total) + '.');
    return gOut(G, { steps: rec.steps, result: { total: total, edges: mst.map(G.E) }, leg: [['cmp', 'cạnh đang xét'], ['done', 'cạnh được chọn'], ['bad', 'bỏ (tạo chu trình)'], ['vis', 'đỉnh đã nối']] }, function (x) {
      return [chips(x.list, { label: 'Cạnh đã sắp:', cls: x.lc, maxW: 400 }), gTable(G, x.grp, 'nhóm (gốc)')];
    });
  });

  reg('graph', 'topo', function (P) {
    var G = graphSetup(P), n = G.names.length, rec = new Rec(['cạnh đã bỏ']);
    if (!G.directed) fail('Topo sort cần đồ thị có hướng: thêm <code>data-directed="true"</code>.');
    var indeg = mk(n, function () { return 0; }), es = G.edges.map(function () { return ''; }), q = [], order = [], ns = mk(n, function () { return ''; }), hi = -1;
    G.edges.forEach(function (e) { indeg[e.v]++; });
    function snap(c) { rec.s(c, { ns: ns.slice(), es: es.slice(), indeg: indeg.slice(), q: q.map(G.N), order: order.map(G.N), hi: hi, bd: null }); }
    snap('Kahn: đếm in-degree (số cạnh đi vào) của mỗi đỉnh. Đỉnh có in-degree 0 không phụ thuộc gì → có thể làm trước.');
    for (var i = 0; i < n; i++) if (indeg[i] === 0) { q.push(i); ns[i] = 'q'; }
    snap('Cho các đỉnh có in-degree 0 vào hàng đợi: ' + b(q.map(G.N).join(', ') || '(không có)'));
    while (q.length) {
      var u = q.shift(); order.push(u); ns[u] = 'cur'; hi = -1;
      snap('Lấy ' + b(G.N(u)) + ' ra → thêm vào thứ tự topo. Bỏ các cạnh đi ra từ ' + G.N(u) + '.');
      G.adj[u].forEach(function (a) {
        indeg[a.v]--; es[a.e] = 'dim'; hi = a.v; rec.inc('cạnh đã bỏ');
        if (indeg[a.v] === 0) { q.push(a.v); ns[a.v] = 'q'; }
        es[a.e] = 'cmp';
        snap('Bỏ cạnh ' + G.N(u) + '→' + G.N(a.v) + ': in-degree[' + G.N(a.v) + '] = ' + b(indeg[a.v]) + (indeg[a.v] === 0 ? ' → cho ' + G.N(a.v) + ' vào hàng đợi' : ''));
        es[a.e] = 'dim';
      });
      ns[u] = 'done'; hi = -1;
    }
    var ok = order.length === n;
    snap(ok ? 'Hoàn tất! Thứ tự topo: ' + b(order.map(G.N).join(' → ')) + '.' : 'Còn ' + (n - order.length) + ' đỉnh có in-degree > 0 → đồ thị có ' + b('chu trình') + ', không tồn tại thứ tự topo.');
    return gOut(G, { steps: rec.steps, result: ok ? order.map(G.N) : null, leg: [['q', 'trong hàng đợi'], ['cur', 'đang lấy ra'], ['done', 'đã xếp'], ['cmp', 'cạnh vừa bỏ']] }, function (x) {
      return [gTable(G, x.indeg, 'in-degree', x.indeg.map(function (_, i) { return i === x.hi ? 'cmp' : (x.ns[i] === 'done' ? 'dim' : ''); })), chips(x.q, { label: 'Hàng đợi:', empty: '(rỗng)', maxW: 380 }), chips(x.order, { label: 'Thứ tự topo:', empty: '—', maxW: 380 })];
    });
  });

  /* ================================================================
   * 13. GRID (mê cung)
   * ================================================================ */
  function gridSetup(P) {
    var rows = P.str('grid', { ex: 'S..#|.#..|...E', maxLen: 400 }).split('|').map(function (r) { return r.trim(); });
    var C0 = rows[0].length, S = null, E = null;
    if (rows.length > 12 || C0 > 16) fail('Lưới quá lớn (tối đa 12 hàng × 16 cột).');
    rows.forEach(function (r, i) {
      if (r.length !== C0) fail('Các hàng của <code>data-grid</code> phải dài bằng nhau (hàng ' + i + ' dài ' + r.length + ', hàng 0 dài ' + C0 + ').');
      if (!/^[S.#E]+$/.test(r)) fail('<code>data-grid</code> chỉ dùng các ký tự <code>S . # E</code> (hàng ' + i + ': "' + esc(r) + '").');
      for (var j = 0; j < r.length; j++) { if (r[j] === 'S') { if (S) fail('Chỉ được có một ô S.'); S = [i, j]; } if (r[j] === 'E') { if (E) fail('Chỉ được có một ô E.'); E = [i, j]; } }
    });
    if (!S || !E) fail('<code>data-grid</code> cần có đúng một ô <code>S</code> (xuất phát) và một ô <code>E</code> (đích).');
    return { g: rows, R: rows.length, C: C0, S: S, E: E };
  }
  var DIRS = [[0, 1, 'phải'], [1, 0, 'xuống'], [0, -1, 'trái'], [-1, 0, 'lên']];
  function gridRender(Gd) {
    return function (x) {
      var cs = Gd.C > 12 ? 26 : 32, s = '';
      for (var r = 0; r < Gd.R; r++) for (var c = 0; c < Gd.C; c++) {
        var ch = Gd.g[r][c], k = r * Gd.C + c, X = c * cs, Y = r * cs;
        if (ch === '#') { s += R(X + 1, Y + 1, cs - 2, cs - 2, '', 2, 'av-wall'); continue; }
        s += R(X + 1, Y + 1, cs - 2, cs - 2, x.cl[k] || '', 3);
        if (ch === 'S' || ch === 'E') s += T(X + cs / 2, Y + cs / 2, ch, 'av-v');
        else if (x.dist && x.dist[k] != null) s += T(X + cs / 2, Y + cs / 2, x.dist[k], 'av-i');
      }
      return blk(Gd.C * cs, Gd.R * cs, s);
    };
  }
  var LEG_GRID = [['cur', 'ô đang xét'], ['q', 'biên (chờ xét)'], ['vis', 'đã thăm'], ['path', 'đường đi']];
  reg('grid', 'bfs-path', function (P) {
    var Gd = gridSetup(P), R0 = Gd.R, C0 = Gd.C, rec = new Rec(['ô đã thăm']), cl = {}, dist = {}, par = {}, q = [], found = -1;
    var key = function (r, c) { return r * C0 + c; }, nm = function (k) { return '(' + Math.floor(k / C0) + ',' + (k % C0) + ')'; };
    function snap(c) { rec.s(c, { cl: Object.assign({}, cl), dist: Object.assign({}, dist) }); }
    var s0 = key(Gd.S[0], Gd.S[1]), e0 = key(Gd.E[0], Gd.E[1]);
    dist[s0] = 0; q.push(s0); cl[s0] = 'q';
    snap('BFS từ S ' + nm(s0) + ': loang ra theo từng "lớp" khoảng cách. Số trong ô = số bước từ S.');
    while (q.length && found < 0) {
      var u = q.shift(), ur = Math.floor(u / C0), uc = u % C0, added = []; cl[u] = 'cur'; rec.inc('ô đã thăm');
      DIRS.forEach(function (d) {
        var nr = ur + d[0], nc = uc + d[1];
        if (nr < 0 || nc < 0 || nr >= R0 || nc >= C0 || Gd.g[nr][nc] === '#') return;
        var k = key(nr, nc); if (k in dist) return;
        dist[k] = dist[u] + 1; par[k] = u; q.push(k); cl[k] = 'q'; added.push(nm(k));
        if (k === e0 && found < 0) found = k;
      });
      snap('Lấy ' + nm(u) + ' (khoảng cách ' + dist[u] + ') khỏi hàng đợi → ' + (added.length ? 'thêm ' + added.length + ' ô kề chưa thăm: ' + added.join(' ') : 'không có ô kề mới') + (found >= 0 ? ' — trong đó có E!' : ''));
      cl[u] = 'vis';
    }
    var len = -1;
    if (found >= 0) {
      len = dist[found];
      var c = found; while (c != null) { cl[c] = 'path'; c = par[c]; }
      snap('Tới E sau ' + b(len) + ' bước — BFS đảm bảo đây là đường ' + b('ngắn nhất') + '. Lần ngược theo ô cha để dựng đường đi.');
    } else snap('Hàng đợi rỗng mà chưa tới E → ' + b('không có đường đi') + '.');
    return { steps: rec.steps, result: len, leg: LEG_GRID, render: gridRender(Gd) };
  });
  reg('grid', 'dfs-path', function (P) {
    var Gd = gridSetup(P), R0 = Gd.R, C0 = Gd.C, rec = new Rec(['ô đã thăm', 'quay lui']), cl = {}, vis = {}, path = [];
    var key = function (r, c) { return r * C0 + c; }, nm = function (k) { return '(' + Math.floor(k / C0) + ',' + (k % C0) + ')'; };
    function snap(c) { var m = Object.assign({}, cl); path.forEach(function (k, i) { m[k] = i === path.length - 1 ? 'cur' : 'path'; }); rec.s(c, { cl: m }); }
    var s0 = key(Gd.S[0], Gd.S[1]), e0 = key(Gd.E[0], Gd.E[1]);
    snap('DFS từ S: đi sâu theo thứ tự hướng phải → xuống → trái → lên; gặp ngõ cụt thì quay lui.');
    var ok = (function go(u) {
      vis[u] = 1; path.push(u); rec.inc('ô đã thăm');
      if (u === e0) { snap('Tới E! Đường tìm được dài ' + b(path.length - 1) + ' bước (DFS không đảm bảo ngắn nhất).'); return true; }
      snap('Đi tới ' + nm(u) + ' (độ sâu ' + (path.length - 1) + ')');
      var ur = Math.floor(u / C0), uc = u % C0;
      for (var i = 0; i < 4; i++) {
        var nr = ur + DIRS[i][0], nc = uc + DIRS[i][1];
        if (nr < 0 || nc < 0 || nr >= R0 || nc >= C0 || Gd.g[nr][nc] === '#' || vis[key(nr, nc)]) continue;
        if (go(key(nr, nc))) return true;
      }
      path.pop(); cl[u] = 'vis'; rec.inc('quay lui');
      snap(nm(u) + ' là ngõ cụt → quay lui' + (path.length ? ' về ' + nm(path[path.length - 1]) : ''));
      return false;
    })(s0);
    if (!ok) snap('Đã thử hết mọi hướng → ' + b('không có đường đi') + '.');
    return { steps: rec.steps, result: ok ? path.length - 1 : -1, leg: [['cur', 'ô hiện tại'], ['path', 'đường đang đi'], ['vis', 'ngõ cụt (đã quay lui)']], render: gridRender(Gd) };
  });

  /* ================================================================
   * 14. UNION-FIND
   * ================================================================ */
  reg('unionfind', 'ops', function (P) {
    var n = P.int('n', { min: 1, max: 12, ex: '6' }), ops = P.list('ops', { ex: 'union 0 1,find 1', maxLen: 20 }).map(function (o) {
      var m = o.match(/^(union|find|connected)\s+(\d+)(?:\s+(\d+))?$/i);
      if (!m || (m[1].toLowerCase() === 'find') !== (m[3] == null)) fail('Thao tác "' + esc(o) + '" không hợp lệ. Dùng <code>union a b</code>, <code>find a</code> hoặc <code>connected a b</code>.');
      var a = +m[2], c = m[3] != null ? +m[3] : null;
      if (a >= n || (c != null && c >= n)) fail('Thao tác "' + esc(o) + '": chỉ số phải nằm trong 0..' + (n - 1) + '.');
      return { op: m[1].toLowerCase(), a: a, b: c, raw: o };
    });
    var par = range(n), rk = mk(n, function () { return 0; }), rec = new Rec(['bước đi lên', 'nén']), k = -1;
    function snap(c, cls) { rec.s(c, { p: par.slice(), rk: rk.slice(), cls: cls || {}, k: k }); }
    function findS(x, show) {
      var path = [x], c = x;
      while (par[c] !== c) { c = par[c]; path.push(c); rec.inc('bước đi lên'); }
      var root = c, cls = {};
      path.forEach(function (q) { cls[q] = 'cmp'; }); cls[root] = 'done';
      if (show) snap('find(' + x + '): đi lên theo parent ' + b(path.join(' → ')) + ' → gốc là ' + b(root), cls);
      var moved = path.slice(0, -2).filter(function (q) { return par[q] !== root; });
      if (moved.length) {
        moved.forEach(function (q) { par[q] = root; rec.inc('nén'); cls[q] = 'swap'; });
        snap('Nén đường đi: gắn ' + b(moved.join(', ')) + ' trỏ thẳng về gốc ' + root + ' → lần sau find chỉ 1 bước', cls);
      }
      return root;
    }
    snap('Union-Find với ' + n + ' phần tử: ban đầu mỗi phần tử là một nhóm riêng (parent[i] = i). Dùng union by rank + path compression.');
    ops.forEach(function (o, i) {
      k = i;
      if (o.op === 'find') { var r = findS(o.a, true); snap(code(o.raw) + ' → ' + b(r), M(o.a, 'cur', r, 'done')); return; }
      var ra = findS(o.a, false), rb = findS(o.b, false);
      if (o.op === 'connected') { snap(code(o.raw) + ': find(' + o.a + ') = ' + ra + ', find(' + o.b + ') = ' + rb + ' → ' + b(ra === rb ? 'true (cùng nhóm)' : 'false (khác nhóm)'), M(o.a, 'cur', o.b, 'cur')); return; }
      if (ra === rb) { snap(code(o.raw) + ': find(' + o.a + ') = find(' + o.b + ') = ' + ra + ' → đã cùng nhóm, không làm gì', M(ra, 'done')); return; }
      var hd = code(o.raw) + ': find(' + o.a + ') = ' + ra + ' (hạng ' + rk[ra] + '), find(' + o.b + ') = ' + rb + ' (hạng ' + rk[rb] + ')';
      var big = ra, sm = rb;
      if (rk[ra] < rk[rb]) { big = rb; sm = ra; }
      var eq = rk[ra] === rk[rb];
      par[sm] = big; if (eq) rk[big]++;
      snap(hd + ' → ' + (eq ? 'cùng hạng: gắn gốc ' + sm + ' vào ' + big + ', hạng[' + big + '] = ' + rk[big] : 'gắn gốc hạng thấp ' + sm + ' vào gốc hạng cao ' + big), M(sm, 'swap', big, 'done'));
    });
    k = ops.length;
    var groups = range(n).filter(function (i) { return par[i] === i; }).length;
    snap('Hoàn tất! parent = ' + bA(par) + ', còn ' + b(groups) + ' nhóm.');
    return { steps: rec.steps, result: par.slice(), leg: [['cmp', 'đường đi lên gốc'], ['done', 'gốc'], ['swap', 'vừa đổi parent'], ['cur', 'phần tử được hỏi']],
      render: function (x) {
        var kids = mk(n, function () { return []; });
        x.p.forEach(function (pp, i) { if (pp !== i) kids[pp].push(i); });
        var nodes = mk(n, function (i) { return { kids: kids[i] }; }), off = 0, s = '', H = 0;
        range(n).filter(function (i) { return x.p[i] === i; }).forEach(function (r) {
          var dm = layoutTree(nodes, r, 38, 50);
          (function sh(i) { nodes[i].px += off; nodes[i].kids.forEach(sh); })(r);
          off += dm.w + 6; H = Math.max(H, dm.h);
        });
        nodes.forEach(function (nd, i) { if (x.p[i] !== i) { var q = nodes[x.p[i]]; s += arrow(nd.px, nd.py, q.px, q.py, x.cls[i] === 'swap' ? 'swap' : '', 15, 16); } });
        nodes.forEach(function (nd, i) { s += C(nd.px, nd.py, 15, x.cls[i]) + T(nd.px, nd.py, i, 'av-v'); });
        return vstack([blk(off, H, s), cells(x.p, { w: 30, idx: true, label: 'parent', labelW: 58, cls: x.p.map(function (_, i) { return x.cls[i] || ''; }) }),
          chips(ops.map(function (o) { return o.raw; }), { label: 'Thao tác:', maxW: 400, cls: ops.map(function (_, i) { return i === x.k ? 'cur' : (i < x.k ? 'dim' : ''); }) })], 12);
      } };
  });

  /* ================================================================
   * 15. TRIE
   * ================================================================ */
  reg('trie', 'insert', function (P) {
    var words = P.list('input', { ex: 'cat,car,cart,dog', maxLen: 10, itemMax: 10 }).map(function (w) { return w.toLowerCase(); });
    var nodes = [{ ch: '', kids: [], end: false }], rec = new Rec(['nút mới']), wi = -1;
    function snap(c, cls) { rec.s(c, { nodes: clone(nodes), cls: cls || {}, wi: wi }); }
    snap('Trie bắt đầu với một nút gốc rỗng. Mỗi cạnh là một ký tự; nút có viền đôi đánh dấu kết thúc một từ (isEnd).');
    words.forEach(function (w, i) {
      wi = i;
      var cur = 0, path = M(0, 'vis');
      snap('Chèn từ ' + b('"' + w + '"') + ': bắt đầu từ gốc.', path);
      for (var t = 0; t < w.length; t++) {
        var ch = w[t], nx = -1;
        nodes[cur].kids.forEach(function (k) { if (nodes[k].ch === ch) nx = k; });
        if (nx >= 0) { cur = nx; snap('Ký tự ' + b("'" + ch + "'") + ' đã có → đi xuống (dùng chung tiền tố "' + esc(w.slice(0, t + 1)) + '")', Object.assign({}, path, M(cur, 'cmp'))); }
        else {
          nodes.push({ ch: ch, kids: [], end: false }); nx = nodes.length - 1; rec.inc('nút mới');
          var ks = nodes[cur].kids; ks.push(nx); ks.sort(function (a, c) { return nodes[a].ch < nodes[c].ch ? -1 : 1; });
          cur = nx; snap('Ký tự ' + b("'" + ch + "'") + ' chưa có → tạo nút mới', Object.assign({}, path, M(cur, 'new')));
        }
        path[cur] = 'vis';
      }
      var had = nodes[cur].end; nodes[cur].end = true;
      snap(had ? 'Từ "' + esc(w) + '" đã có sẵn (isEnd đã = true).' : 'Hết từ → đánh dấu isEnd = true tại nút ' + b("'" + nodes[cur].ch + "'") + '. Đã chèn ' + b('"' + w + '"') + '.', Object.assign({}, path, M(cur, 'done')));
    });
    wi = words.length;
    var all = [];
    (function dfs(i, pre) { if (nodes[i].end) all.push(pre); nodes[i].kids.forEach(function (k) { dfs(k, pre + nodes[k].ch); }); })(0, '');
    snap('Hoàn tất! Trie có ' + b(nodes.length - 1) + ' nút ký tự cho ' + words.length + ' từ — các từ chung tiền tố dùng chung nút.');
    return { steps: rec.steps, result: { nodes: nodes.length - 1, words: all }, leg: [['vis', 'đường đi'], ['cmp', 'ký tự đã có'], ['new', 'nút mới tạo'], ['done', 'kết thúc từ']],
      render: function (x) {
        var nd = x.nodes, dm = layoutTree(nd, 0, 34, 46), s = '';
        nd.forEach(function (q) { q.kids.forEach(function (k) { s += L(q.px, q.py + 13, nd[k].px, nd[k].py - 13, x.cls[k] && x.cls[q.kids ? k : k] ? 'vis' : ''); }); });
        nd.forEach(function (q, i) {
          if (q.end) s += '<circle cx="' + r1(q.px) + '" cy="' + r1(q.py) + '" r="17" class="av-end' + sc(x.cls[i] || 'done') + '"/>';
          s += C(q.px, q.py, 13, x.cls[i] || (q.end ? 'done' : '')) + T(q.px, q.py, i === 0 ? '•' : q.ch, 'av-v');
        });
        return vstack([blk(Math.max(dm.w, 60), dm.h + 4, s), chips(words, { label: 'Từ:', maxW: 380, cls: words.map(function (_, i) { return i === x.wi ? 'cur' : (i < x.wi ? 'done' : ''); }) })], 12);
      } };
  });

  /* ================================================================
   * 16. DP
   * ================================================================ */
  /** Bảng 1 chiều tự xuống dòng mỗi `per` ô. */
  function dp1(vals, cls, per, w) {
    var rows = [];
    for (var s0 = 0; s0 < vals.length; s0 += per) {
      var part = vals.slice(s0, s0 + per);
      rows.push(cells(part, { w: w, h: 28, idx: part.map(function (_, t) { return t + s0; }), cls: part.map(function (_, t) { return cls[t + s0] || ''; }) }));
    }
    return vstack(rows, 6, true);
  }
  /** Bảng 2 chiều có tiêu đề hàng/cột. cls: {"i,j": state} */
  function dp2(vals, rows, cols, cls, o) {
    o = o || {};
    var cw = o.cw || 30, ch = 26, lw = o.lw || 30, th = 20, s = '';
    if (o.corner) s += T(lw - 6, th / 2, o.corner, 'av-i', 'end');
    cols.forEach(function (c, j) { s += T(lw + j * cw + cw / 2 - 1, th / 2, c, 'av-lb'); });
    rows.forEach(function (r, i) { s += T(lw - 6, th + i * ch + ch / 2 - 1, r, 'av-lb', 'end'); });
    vals.forEach(function (row, i) {
      row.forEach(function (v, j) {
        var st = cls[i + ',' + j] || '';
        s += R(lw + j * cw, th + i * ch, cw - 2, ch - 2, st || (v == null ? 'dim' : ''), 3);
        if (v != null) s += T(lw + j * cw + cw / 2 - 1, th + i * ch + ch / 2 - 1, v, String(fmt(v)).length > 3 ? 'av-v av-sm' : 'av-v');
      });
    });
    return blk(lw + cols.length * cw, th + rows.length * ch, s);
  }
  var LEG_DP = [['swap', 'ô đang tính'], ['cmp', 'ô phụ thuộc'], ['path', 'truy vết / đáp án']];

  function fibLike(P, climb) {
    var n = P.int('n', { min: 0, max: 30, ex: '6' }), rec = new Rec(['phép cộng']), dp = mk(n + 1, function () { return null; });
    var F = climb ? 'ways' : 'dp';
    function snap(c, cls) { rec.s(c, { dp: dp.slice(), cls: cls || {} }); }
    if (climb) {
      snap('Leo ' + n + ' bậc, mỗi lần 1 hoặc 2 bậc. ways[i] = số cách lên bậc i; bước cuối là 1 bậc (từ i − 1) hoặc 2 bậc (từ i − 2) → ways[i] = ways[i−1] + ways[i−2].');
      dp[0] = 1; if (n >= 1) dp[1] = 1;
      snap('Cơ sở: ways[0] = 1 (đứng yên), ways[1] = 1.', M(0, 'path', n >= 1 ? 1 : null, 'path'));
    } else {
      snap('Fibonacci bằng quy hoạch động bottom-up: dp[i] = dp[i−1] + dp[i−2], mỗi ô chỉ tính đúng một lần.');
      dp[0] = 0; if (n >= 1) dp[1] = 1;
      snap('Cơ sở: dp[0] = 0, dp[1] = 1.', M(0, 'path', n >= 1 ? 1 : null, 'path'));
    }
    for (var i = 2; i <= n; i++) {
      dp[i] = dp[i - 1] + dp[i - 2]; rec.inc('phép cộng');
      snap(F + '[' + i + '] = ' + F + '[' + (i - 1) + '] + ' + F + '[' + (i - 2) + '] = ' + dp[i - 1] + ' + ' + dp[i - 2] + ' = ' + b(dp[i]), M(i, 'swap', i - 1, 'cmp', i - 2, 'cmp'));
    }
    snap('Hoàn tất! ' + (climb ? 'Số cách leo ' + n + ' bậc' : 'fib(' + n + ')') + ' = ' + b(dp[n]) + ' — O(n) thời gian thay vì O(2ⁿ) của đệ quy thuần.', M(n, 'path'));
    var w = Math.max(32, tw(dp[n], 11.5) + 10);
    return { steps: rec.steps, result: dp[n], leg: LEG_DP, render: function (x) { return dp1(x.dp, x.cls, 10, w); } };
  }
  reg('dp', 'fibonacci', function (P) { return fibLike(P, false); });
  reg('dp', 'climbing-stairs', function (P) { return fibLike(P, true); });

  reg('dp', 'coin-change', function (P) {
    var coins = P.nums('coins', { min: 1, max: 50, maxLen: 8, ex: '1,2,5' }), A = P.int('amount', { min: 0, max: 40, ex: '11' });
    var rec = new Rec(['phép so sánh']), dp = mk(A + 1, function () { return null; }), ch = mk(A + 1, function () { return -1; }), used = [];
    function snap(c, cls) { rec.s(c, { dp: dp.slice(), cls: cls || {}, used: used.slice() }); }
    snap('Đổi ' + b(A) + ' bằng ít đồng xu nhất với các mệnh giá ' + bA(coins) + '. dp[x] = số xu ít nhất để tạo ra x; dp[x] = min(dp[x − c] + 1).');
    dp[0] = 0; snap('Cơ sở: dp[0] = 0 (không cần xu nào).', M(0, 'path'));
    for (var x = 1; x <= A; x++) {
      var best = Infinity, cls = M(x, 'swap'), parts = [];
      coins.forEach(function (c) {
        if (c > x) return;
        rec.inc('phép so sánh'); cls[x - c] = 'cmp';
        var v = dp[x - c] + 1; parts.push('dp[' + (x - c) + '] + 1 = ' + fmt(v));
        if (v < best) { best = v; ch[x] = c; }
      });
      dp[x] = best;
      snap('dp[' + x + ']: ' + (parts.length ? parts.join(', ') : 'không đồng xu nào ≤ ' + x) + ' → dp[' + x + '] = ' + b(best), cls);
    }
    if (dp[A] === Infinity) snap('dp[' + A + '] = ∞ → ' + b('không thể') + ' đổi được ' + A + ' → trả về -1.', M(A, 'bad'));
    else {
      var cur = A, pc = {};
      while (cur > 0) { pc[cur] = 'path'; used.push(ch[cur]); snap('Truy vết: tại ' + cur + ' đã dùng đồng ' + b(ch[cur]) + ' → sang dp[' + (cur - ch[cur]) + ']', Object.assign({}, pc)); cur -= ch[cur]; }
      pc[0] = 'path';
      snap('Hoàn tất! Cần ít nhất ' + b(dp[A]) + ' đồng xu: ' + bA(used) + '.', pc);
    }
    return { steps: rec.steps, result: dp[A] === Infinity ? -1 : dp[A], leg: LEG_DP,
      render: function (q) { return vstack([dp1(q.dp, q.cls, 12, 30), chips(q.used, { label: 'Xu đã dùng:', empty: '—', maxW: 380 })], 12, true); } };
  });

  reg('dp', 'knapsack', function (P) {
    var wt = P.nums('weights', { min: 1, max: 20, maxLen: 6, ex: '1,3,4,5' }), vl = P.nums('values', { min: 0, max: 99, maxLen: 6, ex: '1,4,5,7' }), W = P.int('capacity', { min: 0, max: 15, ex: '7' });
    if (wt.length !== vl.length) fail('<code>data-weights</code> và <code>data-values</code> phải có cùng số phần tử.');
    var n = wt.length, rec = new Rec(['ô đã tính']), dp = mk(n + 1, function () { return mk(W + 1, function () { return null; }); }), take = [];
    function snap(c, cls) { rec.s(c, { dp: clone(dp), cls: cls || {}, take: take.slice() }); }
    snap('Balo 0/1 sức chứa ' + b(W) + '. dp[i][w] = giá trị lớn nhất khi chỉ dùng i vật đầu và sức chứa w.');
    for (var w = 0; w <= W; w++) dp[0][w] = 0;
    snap('Hàng 0: không có vật nào → giá trị 0 với mọi sức chứa.', (function () { var c = {}; for (var t = 0; t <= W; t++) c['0,' + t] = 'path'; return c; })());
    for (var i = 1; i <= n; i++) for (w = 0; w <= W; w++) {
      var no = dp[i - 1][w], cls = {}, cap;
      cls[i + ',' + w] = 'swap'; cls[(i - 1) + ',' + w] = 'cmp'; rec.inc('ô đã tính');
      cap = 'Vật ' + i + ' (nặng ' + wt[i - 1] + ', giá ' + vl[i - 1] + '), sức chứa ' + w + ': không lấy = ' + no;
      if (wt[i - 1] <= w) {
        var yes = dp[i - 1][w - wt[i - 1]] + vl[i - 1]; cls[(i - 1) + ',' + (w - wt[i - 1])] = 'cmp';
        dp[i][w] = Math.max(no, yes);
        cap += '; lấy = dp[' + (i - 1) + '][' + (w - wt[i - 1]) + '] + ' + vl[i - 1] + ' = ' + yes + ' → dp = ' + b(dp[i][w]);
      } else { dp[i][w] = no; cap += '; quá nặng (' + wt[i - 1] + ' > ' + w + ') không lấy được → dp = ' + b(no); }
      snap(cap, cls);
    }
    var pc = {}, cw = W;
    for (i = n; i >= 1; i--) {
      pc[i + ',' + cw] = 'path';
      if (dp[i][cw] !== dp[i - 1][cw]) { take.unshift(i); snap('Truy vết: dp[' + i + '][' + cw + '] = ' + dp[i][cw] + ' ≠ dp[' + (i - 1) + '][' + cw + '] = ' + dp[i - 1][cw] + ' → ' + b('lấy vật ' + i) + ', sức chứa còn ' + (cw - wt[i - 1]), Object.assign({}, pc)); cw -= wt[i - 1]; }
      else snap('Truy vết: dp[' + i + '][' + cw + '] = dp[' + (i - 1) + '][' + cw + '] → không lấy vật ' + i, Object.assign({}, pc));
    }
    pc['0,' + cw] = 'path';
    snap('Hoàn tất! Giá trị lớn nhất = ' + b(dp[n][W]) + ', chọn các vật ' + bA(take) + ' (tổng nặng ' + take.reduce(function (s, t) { return s + wt[t - 1]; }, 0) + ').', pc);
    var rows = ['0'].concat(wt.map(function (q, t) { return (t + 1) + ' (' + q + ',' + vl[t] + ')'; }));
    return { steps: rec.steps, result: { best: dp[n][W], items: take.slice() }, leg: LEG_DP,
      render: function (x) { return vstack([dp2(x.dp, rows, range(W + 1), x.cls, { lw: 64, corner: 'vật\\w', cw: 30 }), chips(x.take.map(function (t) { return 'vật ' + t; }), { label: 'Đã chọn:', empty: '—', maxW: 380 })], 10, true); } };
  });

  function strPair(P) {
    var a = P.str('a', { ex: 'ABCBDAB', maxLen: 12 }), c = P.str('b', { ex: 'BDCABA', maxLen: 12 });
    return [a, c];
  }
  reg('dp', 'lcs', function (P) {
    var ab = strPair(P), A = ab[0], B = ab[1], m = A.length, n = B.length, rec = new Rec(['ô đã tính']), out = '';
    var dp = mk(m + 1, function () { return mk(n + 1, function () { return null; }); });
    function snap(c, cls) { rec.s(c, { dp: clone(dp), cls: cls || {}, out: out }); }
    snap('LCS của ' + b(A) + ' và ' + b(B) + '. dp[i][j] = độ dài dãy con chung dài nhất của i ký tự đầu của A và j ký tự đầu của B.');
    for (var i = 0; i <= m; i++) dp[i][0] = 0; for (var j = 0; j <= n; j++) dp[0][j] = 0;
    snap('Hàng 0 và cột 0 = 0 (một chuỗi rỗng thì LCS rỗng).');
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) {
      var cls = {}; cls[i + ',' + j] = 'swap'; rec.inc('ô đã tính');
      if (A[i - 1] === B[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1; cls[(i - 1) + ',' + (j - 1)] = 'cmp';
        snap('A[' + (i - 1) + '] = B[' + (j - 1) + '] = ' + b(A[i - 1]) + ' → khớp: dp[' + i + '][' + j + '] = dp[' + (i - 1) + '][' + (j - 1) + '] + 1 = ' + b(dp[i][j]), cls);
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]); cls[(i - 1) + ',' + j] = 'cmp'; cls[i + ',' + (j - 1)] = 'cmp';
        snap(esc(A[i - 1]) + ' ≠ ' + esc(B[j - 1]) + ' → dp[' + i + '][' + j + '] = max(trên ' + dp[i - 1][j] + ', trái ' + dp[i][j - 1] + ') = ' + b(dp[i][j]), cls);
      }
    }
    var pc = {}; i = m; j = n;
    while (i > 0 && j > 0) {
      pc[i + ',' + j] = 'path';
      if (A[i - 1] === B[j - 1]) { out = A[i - 1] + out; snap('Truy vết: ' + b(A[i - 1]) + ' khớp → thuộc LCS, đi chéo lên. LCS (từ cuối): ' + b(out), Object.assign({}, pc)); i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) { snap('Truy vết: không khớp, ô trên (' + dp[i - 1][j] + ') ≥ ô trái (' + dp[i][j - 1] + ') → đi lên', Object.assign({}, pc)); i--; }
      else { snap('Truy vết: không khớp, ô trái lớn hơn → đi sang trái', Object.assign({}, pc)); j--; }
    }
    snap('Hoàn tất! Độ dài LCS = ' + b(dp[m][n]) + ', một LCS là ' + b('"' + out + '"') + '.', pc);
    return { steps: rec.steps, result: { len: dp[m][n], lcs: out }, leg: LEG_DP,
      render: function (x) { return vstack([dp2(x.dp, ['∅'].concat(A.split('')), ['∅'].concat(B.split('')), x.cls, { corner: 'A\\B' }), tb('LCS: "' + x.out + '"', 'av-lb')], 10, true); } };
  });

  reg('dp', 'edit-distance', function (P) {
    var ab = strPair(P), A = ab[0], B = ab[1], m = A.length, n = B.length, rec = new Rec(['ô đã tính']), ops = [];
    var dp = mk(m + 1, function () { return mk(n + 1, function () { return null; }); });
    function snap(c, cls) { rec.s(c, { dp: clone(dp), cls: cls || {}, ops: ops.slice() }); }
    snap('Khoảng cách chỉnh sửa (Levenshtein) từ ' + b(A) + ' sang ' + b(B) + ': số thao tác chèn / xóa / thay ít nhất. dp[i][j] cho i ký tự đầu của A và j ký tự đầu của B.');
    for (var i = 0; i <= m; i++) dp[i][0] = i; for (var j = 0; j <= n; j++) dp[0][j] = j;
    snap('Hàng 0: dp[0][j] = j (chèn j ký tự); cột 0: dp[i][0] = i (xóa i ký tự).');
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) {
      var cls = {}; cls[i + ',' + j] = 'swap'; rec.inc('ô đã tính');
      if (A[i - 1] === B[j - 1]) { dp[i][j] = dp[i - 1][j - 1]; cls[(i - 1) + ',' + (j - 1)] = 'cmp'; snap(b(A[i - 1]) + ' = ' + b(B[j - 1]) + ' → không tốn thao tác: dp[' + i + '][' + j + '] = dp[' + (i - 1) + '][' + (j - 1) + '] = ' + b(dp[i][j]), cls); }
      else {
        var del = dp[i - 1][j], ins = dp[i][j - 1], rep = dp[i - 1][j - 1];
        dp[i][j] = 1 + Math.min(del, ins, rep); cls[(i - 1) + ',' + j] = 'cmp'; cls[i + ',' + (j - 1)] = 'cmp'; cls[(i - 1) + ',' + (j - 1)] = 'cmp';
        snap(esc(A[i - 1]) + ' ≠ ' + esc(B[j - 1]) + ' → 1 + min(xóa ' + del + ', chèn ' + ins + ', thay ' + rep + ') = ' + b(dp[i][j]), cls);
      }
    }
    var pc = {}; i = m; j = n;
    while (i > 0 || j > 0) {
      pc[i + ',' + j] = 'path';
      if (i > 0 && j > 0 && A[i - 1] === B[j - 1] && dp[i][j] === dp[i - 1][j - 1]) { i--; j--; continue; }
      if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) { ops.unshift('thay ' + A[i - 1] + '→' + B[j - 1]); i--; j--; }
      else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) { ops.unshift('xóa ' + A[i - 1]); i--; }
      else { ops.unshift('chèn ' + B[j - 1]); j--; }
      snap('Truy vết: ' + b(ops[0]), Object.assign({}, pc));
    }
    pc['0,0'] = 'path';
    snap('Hoàn tất! Khoảng cách chỉnh sửa = ' + b(dp[m][n]) + ' thao tác.', pc);
    return { steps: rec.steps, result: dp[m][n], leg: LEG_DP,
      render: function (x) { return vstack([dp2(x.dp, ['∅'].concat(A.split('')), ['∅'].concat(B.split('')), x.cls, { corner: 'A\\B' }), chips(x.ops, { label: 'Thao tác:', empty: '—', maxW: 380 })], 10, true); } };
  });

  reg('dp', 'lis', function (P) {
    var a = P.nums('input', { ex: '10,9,2,5,3,7,101,18' }), n = a.length, rec = new Rec(['so sánh']), dp = mk(n, function () { return null; }), pv = mk(n, function () { return -1; });
    function snap(c, ac, dc) { rec.s(c, { dp: dp.slice(), ac: ac || {}, dc: dc || {} }); }
    snap('Dãy con tăng dài nhất (LIS) của ' + bA(a) + '. dp[i] = độ dài LIS kết thúc tại a[i] = 1 + max(dp[j]) với j < i và a[j] < a[i].');
    for (var i = 0; i < n; i++) {
      var best = 1, bj = -1, deps = M(i, 'swap');
      for (var j = 0; j < i; j++) { rec.inc('so sánh'); if (a[j] < a[i]) { deps[j] = 'cmp'; if (dp[j] + 1 > best) { best = dp[j] + 1; bj = j; } } }
      dp[i] = best; pv[i] = bj;
      snap('i = ' + i + ' (a[i] = ' + b(a[i]) + '): ' + (bj < 0 ? 'không có a[j] < ' + a[i] + ' phía trước → dp[' + i + '] = 1' : 'các j có a[j] < ' + a[i] + ' (vàng); tốt nhất j = ' + bj + ' → dp[' + i + '] = dp[' + bj + '] + 1 = ' + b(best)), deps, deps);
    }
    var mi = 0; for (i = 1; i < n; i++) if (dp[i] > dp[mi]) mi = i;
    var seq = [], pc = {};
    for (var c = mi; c >= 0; c = pv[c]) { seq.unshift(a[c]); pc[c] = 'path'; }
    snap('Hoàn tất! Độ dài LIS = max(dp) = ' + b(dp[mi]) + ', truy vết qua prev: ' + bA(seq) + '.', pc, pc);
    var w = cellW(n);
    return { steps: rec.steps, result: dp[mi], leg: LEG_DP,
      render: function (x) {
        return vstack([cells(a, { w: w, label: 'a', labelW: 30, cls: a.map(function (_, i) { return x.ac[i]; }) }), cells(x.dp, { w: w, label: 'dp', labelW: 30, idx: true, cls: x.dp.map(function (_, i) { return x.dc[i]; }) })], 6, true);
      } };
  });

  /* ================================================================
   * 17. STRING MATCHING
   * ================================================================ */
  function strSetup(P) {
    var t = P.str('text', { ex: 'ABABDABACDABABCABAB', maxLen: 32 }), p = P.str('pattern', { ex: 'ABABCABAB', maxLen: 32 });
    if (p.length > t.length) fail('<code>data-pattern</code> dài hơn <code>data-text</code>.');
    return { t: t, p: p };
  }
  function strRender(S, extra) {
    var w = S.t.length > 22 ? 20 : 24, g = 3;
    return function (x) {
      var tt = cells(S.t.split(''), { w: w, g: g, h: 28, idx: true, cls: S.t.split('').map(function (_, i) { return (x.tc || {})[i] || ''; }), ptr: x.tp || {}, ptrUp: true, ptrRows: 1 });
      var pr = cells(S.p.split(''), { w: w, g: g, h: 28, cls: S.p.split('').map(function (_, i) { return (x.pc || {})[i] || ''; }), ptr: x.pp || {}, ptrRows: 1 });
      var off = (x.off || 0) * (w + g), s = tt.s + tr(off, tt.h + 6, pr.s), H = tt.h + 6 + pr.h, Wd = Math.max(tt.w, off + pr.w);
      if (x.lps) {
        var lr = cells(x.lps.map(function (v) { return v == null ? '' : v; }), { w: w, g: g, h: 24, cls: x.lps.map(function (_, i) { return (x.lc || {})[i] || ''; }) });
        s += tr(off, H + 2, lr.s) + T(off - 6, H + 14, 'lps', 'av-lb', 'end'); H += 26;
      }
      var parts = [blk(Wd, H, s)];
      if (extra) extra(x, parts);
      parts.push(chips((x.found || []).map(function (f) { return 'vị trí ' + f; }), { label: 'Tìm thấy:', empty: '—', maxW: 380 }));
      return vstack(parts, 10, true);
    };
  }
  var LEG_STR = [['cmp', 'đang so sánh'], ['done', 'khớp'], ['bad', 'không khớp'], ['path', 'vị trí tìm thấy']];
  function rngCls(a, b2, st) { var m = {}; for (var i = a; i < b2; i++) m[i] = st; return m; }

  reg('string', 'naive', function (P) {
    var S = strSetup(P), t = S.t, p = S.p, n = t.length, m = p.length, rec = new Rec(['so sánh ký tự']), found = [];
    function snap(c, x) { x.found = found.slice(); rec.s(c, x); }
    snap('Naive: đặt pattern ở từng vị trí s = 0..' + (n - m) + ' và so từng ký tự từ trái sang phải.', { off: 0 });
    for (var s = 0; s <= n - m; s++) {
      var j = 0;
      for (; j < m; j++) {
        rec.inc('so sánh ký tự');
        var ok = t[s + j] === p[j], tc = rngCls(s, s + j, 'done'), pc = rngCls(0, j, 'done');
        tc[s + j] = ok ? 'done' : 'bad'; pc[j] = ok ? 'done' : 'bad';
        if (!ok) { snap('s = ' + s + ': text[' + (s + j) + '] = ' + b(t[s + j]) + ' ≠ pattern[' + j + '] = ' + b(p[j]) + ' → sai sau ' + j + ' ký tự khớp; dịch pattern sang 1 ô và so lại từ đầu', { off: s, tc: tc, pc: pc, tp: { i: s + j }, pp: { j: j } }); break; }
        if (j === m - 1 || j === 0) snap('s = ' + s + ': text[' + (s + j) + '] = pattern[' + j + '] = ' + b(p[j]) + (j === m - 1 ? '' : ' → so tiếp'), { off: s, tc: tc, pc: pc, tp: { i: s + j }, pp: { j: j } });
      }
      if (j === m) { found.push(s); snap('Khớp đủ ' + m + ' ký tự → tìm thấy tại vị trí ' + b(s) + '!', { off: s, tc: rngCls(s, s + m, 'path'), pc: rngCls(0, m, 'path') }); }
    }
    snap('Hoàn tất! ' + (found.length ? 'Pattern xuất hiện tại ' + bA(found) : 'Không tìm thấy pattern') + '. Tổng ' + rec.c['so sánh ký tự'] + ' lần so sánh ký tự — tệ nhất O(n·m).', { off: found.length ? found[0] : 0, tc: found.length ? rngCls(found[0], found[0] + m, 'path') : {} });
    return { steps: rec.steps, result: found.slice(), leg: LEG_STR, render: strRender(S) };
  });

  reg('string', 'kmp', function (P) {
    var S = strSetup(P), t = S.t, p = S.p, n = t.length, m = p.length, rec = new Rec(['so sánh ký tự']), found = [], lps = mk(m, function () { return null; });
    function snap(c, x) { x.found = found.slice(); x.lps = lps.slice(); rec.s(c, x); }
    snap('KMP — giai đoạn 1: xây bảng LPS. lps[i] = độ dài tiền tố dài nhất của pattern[0..i] cũng là hậu tố của nó.', { off: 0 });
    lps[0] = 0;
    var len = 0, i = 1;
    snap('lps[0] = 0. Dùng i (đang xét) và len (độ dài tiền tố-hậu tố hiện tại).', { off: 0, lc: M(0, 'done') });
    while (i < m) {
      rec.inc('so sánh ký tự');
      if (p[i] === p[len]) { len++; lps[i] = len; snap('pattern[' + i + '] = pattern[' + (len - 1) + '] = ' + b(p[i]) + ' → len = ' + len + ', lps[' + i + '] = ' + b(len), { off: 0, pc: M(i, 'done', len - 1, 'cmp'), pp: { i: i }, lc: M(i, 'swap') }); i++; }
      else if (len > 0) { var ol = len; len = lps[len - 1]; snap('pattern[' + i + '] = ' + b(p[i]) + ' ≠ pattern[' + ol + '] = ' + b(p[ol]) + ' → lùi len = lps[' + (ol - 1) + '] = ' + len + ' (không tăng i)', { off: 0, pc: M(i, 'bad', ol, 'cmp'), pp: { i: i }, lc: M(ol - 1, 'cmp') }); }
      else { lps[i] = 0; snap('pattern[' + i + '] = ' + b(p[i]) + ' ≠ pattern[0] và len = 0 → lps[' + i + '] = ' + b(0), { off: 0, pc: M(i, 'bad', 0, 'cmp'), pp: { i: i }, lc: M(i, 'swap') }); i++; }
    }
    snap('Bảng LPS: ' + bA(lps) + '. Giai đoạn 2: so khớp; i trên text chỉ tăng, khi sai thì j = lps[j − 1].', { off: 0 });
    i = 0; var j = 0;
    while (i < n) {
      rec.inc('so sánh ký tự');
      if (t[i] === p[j]) {
        var tc = rngCls(i - j, i + 1, 'done'), pc = rngCls(0, j + 1, 'done');
        snap('text[' + i + '] = pattern[' + j + '] = ' + b(t[i]) + ' → khớp, tăng i và j', { off: i - j, tc: tc, pc: pc, tp: { i: i }, pp: { j: j } });
        i++; j++;
        if (j === m) {
          found.push(i - m);
          snap('j = m = ' + m + ' → tìm thấy tại vị trí ' + b(i - m) + '! Đặt j = lps[' + (m - 1) + '] = ' + lps[m - 1] + ' để tìm tiếp.', { off: i - m, tc: rngCls(i - m, i, 'path'), pc: rngCls(0, m, 'path'), lc: M(m - 1, 'cmp') });
          j = lps[m - 1];
        }
      } else if (j > 0) {
        var oj = j; j = lps[j - 1];
        snap('text[' + i + '] = ' + b(t[i]) + ' ≠ pattern[' + oj + '] = ' + b(p[oj]) + ' → j = lps[' + (oj - 1) + '] = ' + b(j) + ': trượt pattern sang, giữ nguyên i', { off: i - oj, tc: Object.assign(rngCls(i - oj, i, 'done'), M(i, 'bad')), pc: Object.assign(rngCls(0, oj, 'done'), M(oj, 'bad')), tp: { i: i }, pp: { j: oj }, lc: M(oj - 1, 'cmp') });
      } else {
        snap('text[' + i + '] = ' + b(t[i]) + ' ≠ pattern[0] = ' + b(p[0]) + ' → tăng i', { off: i, tc: M(i, 'bad'), pc: M(0, 'bad'), tp: { i: i }, pp: { j: 0 } });
        i++;
      }
    }
    snap('Hoàn tất! ' + (found.length ? 'Pattern xuất hiện tại ' + bA(found) : 'Không tìm thấy pattern') + '. ' + rec.c['so sánh ký tự'] + ' lần so sánh — O(n + m).', { off: found.length ? found[0] : 0, tc: found.length ? rngCls(found[0], found[0] + m, 'path') : {} });
    return { steps: rec.steps, result: found.slice(), leg: [['cmp', 'đang dùng'], ['done', 'khớp'], ['bad', 'không khớp'], ['swap', 'lps vừa tính'], ['path', 'tìm thấy']], render: strRender(S) };
  });

  reg('string', 'rabin-karp', function (P) {
    var S = strSetup(P), t = S.t, p = S.p, n = t.length, m = p.length, D = 256, Q = 101, rec = new Rec(['so sánh hash', 'so sánh ký tự', 'va chạm giả']), found = [];
    function snap(c, x) { x.found = found.slice(); rec.s(c, x); }
    var h = 1; for (var k = 0; k < m - 1; k++) h = (h * D) % Q;
    var hp = 0, ht = 0;
    for (k = 0; k < m; k++) { hp = (D * hp + p.charCodeAt(k)) % Q; ht = (D * ht + t.charCodeAt(k)) % Q; }
    snap('Rabin-Karp: hash(s) = Σ mã ký tự × ' + D + '^vị trí, lấy mod ' + Q + '. hash(pattern) = ' + b(hp) + ', hash(cửa sổ đầu) = ' + b(ht) + '. h = ' + D + '^(m−1) mod ' + Q + ' = ' + h + '.', { off: 0, hp: hp, ht: ht, tc: rngCls(0, m, 'q') });
    for (var s = 0; s <= n - m; s++) {
      rec.inc('so sánh hash');
      var win = rngCls(s, s + m, 'q');
      if (ht === hp) {
        var ok = true;
        for (k = 0; k < m; k++) { rec.inc('so sánh ký tự'); if (t[s + k] !== p[k]) { ok = false; break; } }
        if (ok) { found.push(s); snap('s = ' + s + ': hash cửa sổ = ' + ht + ' = hash(pattern) → so từng ký tự: khớp hết → tìm thấy tại ' + b(s) + '!', { off: s, hp: hp, ht: ht, tc: rngCls(s, s + m, 'path'), pc: rngCls(0, m, 'path') }); }
        else { rec.inc('va chạm giả'); snap('s = ' + s + ': hash trùng (' + ht + ') nhưng ký tự ' + k + ' khác (' + esc(t[s + k]) + ' ≠ ' + esc(p[k]) + ') → ' + b('va chạm giả') + ', bỏ qua', { off: s, hp: hp, ht: ht, tc: Object.assign(win, M(s + k, 'bad')), pc: M(k, 'bad') }); }
      } else snap('s = ' + s + ': hash cửa sổ "' + esc(t.substr(s, m)) + '" = ' + b(ht) + ' ≠ ' + hp + ' → loại ngay bằng 1 phép so sánh số', { off: s, hp: hp, ht: ht, tc: win, pc: rngCls(0, m, 'dim') });
      if (s < n - m) {
        var old = ht;
        ht = (D * (ht - t.charCodeAt(s) * h) + t.charCodeAt(s + m)) % Q; if (ht < 0) ht += Q;
        snap('Cuộn hash: bỏ ' + b(t[s]) + ' (mã ' + t.charCodeAt(s) + '), thêm ' + b(t[s + m]) + ' (mã ' + t.charCodeAt(s + m) + '): (' + D + '·(' + old + ' − ' + t.charCodeAt(s) + '·' + h + ') + ' + t.charCodeAt(s + m) + ') mod ' + Q + ' = ' + b(ht) + ' — O(1)', { off: s + 1, hp: hp, ht: ht, tc: Object.assign(rngCls(s + 1, s + m + 1, 'q'), M(s, 'dim', s + m, 'cmp')) });
      }
    }
    snap('Hoàn tất! ' + (found.length ? 'Pattern xuất hiện tại ' + bA(found) : 'Không tìm thấy pattern') + '. Chỉ so từng ký tự khi hash trùng — trung bình O(n + m).', { off: found.length ? found[0] : 0, hp: hp, ht: ht, tc: found.length ? rngCls(found[0], found[0] + m, 'path') : {} });
    return { steps: rec.steps, result: found.slice(), leg: [['q', 'cửa sổ hiện tại'], ['cmp', 'ký tự vừa thêm'], ['bad', 'khác'], ['path', 'tìm thấy']],
      render: strRender(S, function (x, parts) { parts.push(tb('hash(pattern) = ' + x.hp + '   |   hash(cửa sổ) = ' + x.ht, 'av-lb')); }) };
  });

  /* ================================================================
   * 99. Khởi tạo
   * ================================================================ */
  function errBox(el, msg) {
    el.innerHTML = '';
    var box = h('div', 'algo-viz-error', '<b>⚠ Không thể hiển thị hoạt ảnh</b> (data-viz="' + esc(el.getAttribute('data-viz') || '') + '", data-algo="' + esc(el.getAttribute('data-algo') || '') + '"): ' + msg);
    box.setAttribute('role', 'alert');
    el.appendChild(box);
  }
  function initOne(el) {
    if (!el || el.__algoViz || el.getAttribute('data-av-init')) return;
    el.setAttribute('data-av-init', '1');
    var viz = (el.getAttribute('data-viz') || '').trim(), algo = (el.getAttribute('data-algo') || '').trim();
    try {
      if (!viz) fail('Thiếu thuộc tính <code>data-viz</code>. Các giá trị hợp lệ: ' + Object.keys(REG).map(code).join(', ') + '.');
      var grp = REG[viz];
      if (!grp) fail('Không hỗ trợ <code>data-viz="' + esc(viz) + '"</code>. Các giá trị hợp lệ: ' + Object.keys(REG).map(code).join(', ') + '.');
      var fn = grp[algo];
      if (!fn) fail((algo ? 'Không hỗ trợ <code>data-algo="' + esc(algo) + '"</code>' : 'Thiếu thuộc tính <code>data-algo</code>') + ' cho <code>data-viz="' + esc(viz) + '"</code>. Hợp lệ: ' + Object.keys(grp).map(code).join(', ') + '.');
      var def = fn(params(el), algo);
      if (!def || !def.steps || !def.steps.length) fail('Không tạo được bước nào từ dữ liệu đầu vào.');
      new Player(el, def, el.getAttribute('data-title'));
    } catch (e) {
      var msg = e instanceof VizErr ? e.message : 'Lỗi nội bộ khi dựng hoạt ảnh (' + esc(e && e.message) + ').';
      if (window.console && console.warn) console.warn('[algo-viz]', viz + '/' + algo + ':', e instanceof VizErr ? e.message.replace(/<[^>]+>/g, '') : e);
      try { errBox(el, msg); } catch (e2) { /* bỏ qua */ }
      el.__algoViz = { steps: [], error: msg.replace(/<[^>]+>/g, ''), index: 0, goto: function () { return 0; } };
    }
  }
  function init(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var els = scope.querySelectorAll('.algo-viz');
    for (var i = 0; i < els.length; i++) initOne(els[i]);
  }

  /** Chạy builder không cần DOM (dùng cho kiểm thử): attrs = {input: '5,1,4', ...}. */
  function build(viz, algo, attrs) {
    var el = { getAttribute: function (n) { var k = n.replace(/^data-/, ''); return attrs && attrs[k] != null ? String(attrs[k]) : null; } };
    if (!REG[viz] || !REG[viz][algo]) fail('Không hỗ trợ ' + viz + '/' + algo);
    var def = REG[viz][algo](params(el), algo);
    def.steps.forEach(function (st, k) { def.render(st, k); });
    return def;
  }

  window.AlgoViz = { _loaded: true, init: function (root) { init(root); }, initOne: initOne, build: build, registry: REG, register: reg };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
  if (window.document$ && typeof window.document$.subscribe === 'function') {
    window.document$.subscribe(function () { init(); });
  }
})();
