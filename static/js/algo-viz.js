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
    return '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="' + r1(r) + '" class="av-box' + sc(st) + (extra ? ' ' + extra : '') + '"/>';
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

  /* @@MORE@@ */

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
