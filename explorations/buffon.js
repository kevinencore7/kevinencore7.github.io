// Buffon's needle with Lazzarini's second-series setup: needle 2.5 cm, lines 3 cm apart.
// Plain script, no dependencies, nothing loaded from elsewhere. MIT licence.
'use strict';
(function () {
  var L = 2.5, D = 3;                      // cm
  var P = 2 * L / (Math.PI * D);           // 5/(3 pi), used only for the "expected" figures
  var ROWS = 5, COLS = 16;                 // surface shown, in line spacings
  var KEEP = 400;                          // needles kept on the drawing
  var LAZ = [[100, 53], [200, 107], [1000, 524], [2000, 1060], [3000, 1591], [3408, 1808], [4000, 2122]];

  // Seeded generator (mulberry32), so a run can be repeated from its seed.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // One drop. The direction comes from a random point in the unit disc (rejection),
  // so the simulation itself never uses pi.
  function drop(r) {
    var u, v, s;
    do { u = 2 * r() - 1; v = 2 * r() - 1; s = u * u + v * v; } while (s > 1 || s === 0);
    s = Math.sqrt(s);
    var x = r() * COLS * D, y = r() * ROWS * D;
    var dx = (L / 2) * u / s, dy = (L / 2) * v / s;
    var y1 = y - dy, y2 = y + dy;
    return { x1: x - dx, y1: y1, x2: x + dx, y2: y2, hit: Math.floor(y1 / D) !== Math.floor(y2 / D) };
  }

  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  function est(n, h) { return h ? 2 * L * n / (D * h) : NaN; }     // = 5n / 3h
  function frac(n, h) { var a = 5 * n, b = 3 * h, g = gcd(a, b); return (a / g) + '/' + (b / g); }
  function isMilu(n, h) { return n % 213 === 0 && h * 213 === n * 113; }   // 5n/3h = 355/113
  function fmt(x, d) { return isFinite(x) ? x.toFixed(d) : '–'; }
  function group(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function sci(x) {
    if (!isFinite(x)) return '–';
    if (x === 0) return '0';
    var e = Math.floor(Math.log10(Math.abs(x)));
    if (e >= -3) return (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(Math.max(4, -e + 1));
    var sup = String(e).replace(/-/, '⁻').replace(/\d/g, function (c) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]; });
    return (x >= 0 ? '+' : '−') + (Math.abs(x) / Math.pow(10, e)).toFixed(1) + '×10' + sup;
  }

  var $ = function (id) { return document.getElementById(id); };
  var field = $('field'), plot = $('plot');
  var fctx = field.getContext('2d'), pctx = plot.getContext('2d');
  var css = getComputedStyle(document.documentElement);
  var INK = css.getPropertyValue('--ink').trim() || '#1d2733';
  var QUIET = css.getPropertyValue('--quiet').trim() || '#5d6672';
  var RULE = css.getPropertyValue('--rule').trim() || '#c9bfae';
  var GREEN = css.getPropertyValue('--verdigris').trim() || '#2e6b5e';
  var PAPER = css.getPropertyValue('--paper').trim() || '#f4efe4';

  var s;            // state of the current run
  function reset() {
    var seed = parseInt($('seed').value, 10);
    if (!isFinite(seed)) seed = 1901;
    s = { r: rng(seed), seed: seed, n: 0, h: 0, recent: [], path: [], every: 1, hits: [], running: false };
    $('stopnote').textContent = '';
    draw();
  }

  function step(k, stopAt, stopOnHit) {
    for (var i = 0; i < k; i++) {
      if (stopAt && s.n >= stopAt) return 'target';
      var d = drop(s.r);
      s.n++; if (d.hit) s.h++;
      s.recent.push(d); if (s.recent.length > KEEP) s.recent.shift();
      if (s.n % s.every === 0) {
        s.path.push([s.n, est(s.n, s.h)]);
        if (s.path.length > 4000) {           // thin the path, keep the plot light
          s.path = s.path.filter(function (p, j) { return j % 2 === 1; });
          s.every *= 2;
        }
      }
      if (isMilu(s.n, s.h)) {
        s.hits.push([s.n, s.h]);
        if (stopOnHit) return 'hit';
      }
    }
    return null;
  }

  // ---- drawing

  function fit(c) {
    var w = c.clientWidth, h = c.clientHeight, k = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * k) || c.height !== Math.round(h * k)) { c.width = Math.round(w * k); c.height = Math.round(h * k); }
    var ctx = c.getContext('2d'); ctx.setTransform(k, 0, 0, k, 0, 0);
    return [w, h];
  }

  function drawField() {
    var wh = fit(field), w = wh[0], h = wh[1];
    var pad = 10, sc = Math.min((w - 2 * pad) / (COLS * D), (h - 2 * pad) / (ROWS * D));
    var ox = (w - COLS * D * sc) / 2, oy = (h - ROWS * D * sc) / 2;
    fctx.fillStyle = PAPER; fctx.fillRect(0, 0, w, h);
    fctx.strokeStyle = QUIET; fctx.lineWidth = 1;
    for (var i = 0; i <= ROWS; i++) {
      var y = Math.round(oy + i * D * sc) + 0.5;
      fctx.beginPath(); fctx.moveTo(0, y); fctx.lineTo(w, y); fctx.stroke();
    }
    fctx.lineCap = 'round';
    for (var j = 0; j < s.recent.length; j++) {
      var d = s.recent[j], fresh = j >= s.recent.length - 3;
      fctx.strokeStyle = d.hit ? GREEN : INK;
      fctx.globalAlpha = fresh ? 1 : 0.15 + 0.6 * j / s.recent.length;
      fctx.lineWidth = fresh ? 2.2 : 1.2;
      fctx.beginPath();
      fctx.moveTo(ox + d.x1 * sc, oy + d.y1 * sc); fctx.lineTo(ox + d.x2 * sc, oy + d.y2 * sc);
      fctx.stroke();
    }
    fctx.globalAlpha = 1;
  }

  function drawPlot() {
    var wh = fit(plot), w = wh[0], h = wh[1];
    var l = 44, r = 10, t = 10, b = 26;
    var nmax = Math.max(4000, s.n);
    var lo = 2.9, hi = 3.4;
    var X = function (n) { return l + (w - l - r) * Math.log(n) / Math.log(nmax); };
    var Y = function (v) { return t + (h - t - b) * (hi - Math.min(hi, Math.max(lo, v))) / (hi - lo); };
    pctx.fillStyle = PAPER; pctx.fillRect(0, 0, w, h);
    pctx.font = '11px serif'; pctx.fillStyle = QUIET; pctx.strokeStyle = RULE; pctx.lineWidth = 1;
    [2.9, 3.0, 3.1, 3.2, 3.3, 3.4].forEach(function (v) {
      var y = Math.round(Y(v)) + 0.5;
      pctx.beginPath(); pctx.moveTo(l, y); pctx.lineTo(w - r, y); pctx.stroke();
      pctx.fillText(v.toFixed(1), 6, y + 4);
    });
    [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000].forEach(function (n) {
      if (n > nmax) return;
      var x = Math.round(X(n)) + 0.5;
      pctx.beginPath(); pctx.moveTo(x, t); pctx.lineTo(x, h - b); pctx.stroke();
      pctx.fillText(group(n), x - 8, h - 8);
    });
    // honest spread: pi +/- 2 standard deviations of the estimate
    pctx.fillStyle = 'rgba(46,107,94,0.12)';
    pctx.beginPath();
    var n, k;
    for (k = 0; k <= 200; k++) { n = Math.exp(Math.log(nmax) * k / 200); pctx.lineTo(X(n), Y(Math.PI + 2 * Math.PI * Math.sqrt((1 - P) / (n * P)))); }
    for (k = 200; k >= 0; k--) { n = Math.exp(Math.log(nmax) * k / 200); pctx.lineTo(X(n), Y(Math.PI - 2 * Math.PI * Math.sqrt((1 - P) / (n * P)))); }
    pctx.closePath(); pctx.fill();
    pctx.strokeStyle = GREEN; pctx.setLineDash([4, 3]);
    pctx.beginPath(); pctx.moveTo(l, Y(Math.PI)); pctx.lineTo(w - r, Y(Math.PI)); pctx.stroke();
    pctx.setLineDash([]);
    pctx.strokeStyle = INK; pctx.lineWidth = 1.4; pctx.beginPath();
    var started = false;
    s.path.forEach(function (p) {
      if (!isFinite(p[1])) return;
      if (started) pctx.lineTo(X(p[0]), Y(p[1])); else { pctx.moveTo(X(p[0]), Y(p[1])); started = true; }
    });
    pctx.stroke();
    // Lazzarini's printed second series, as hollow squares
    pctx.strokeStyle = QUIET; pctx.lineWidth = 1.2;
    LAZ.forEach(function (p) { var x = X(p[0]), y = Y(est(p[0], p[1])); pctx.strokeRect(x - 3, y - 3, 6, 6); });
  }

  function draw() {
    var e = est(s.n, s.h);
    $('n').textContent = group(s.n);
    $('h').textContent = group(s.h);
    $('pi').textContent = fmt(e, 7);
    $('frac').textContent = s.h ? frac(s.n, s.h) : '–';
    $('err').textContent = s.h ? sci(e - Math.PI) : '–';
    $('exp').textContent = s.n ? group(Math.round(s.n * P)) + ' ± ' + group(Math.round(Math.sqrt(s.n * P * (1 - P)))) : '–';
    $('sd').textContent = s.n ? '± ' + fmt(Math.PI * Math.sqrt((1 - P) / (s.n * P)), 4) : '–';
    $('hits').textContent = s.hits.length ? s.hits.slice(0, 8).map(function (p) { return group(p[0]) + '/' + group(p[1]); }).join(', ') + (s.hits.length > 8 ? ', …' : '') : 'none yet';
    drawField(); drawPlot();
  }

  // ---- controls

  // Drops per second, not per frame, so a slow screen runs slower to look at but not to finish.
  var speeds = [10, 60, 600, 6000, 60000];
  function run() {
    if (s.running) { s.running = false; $('run').textContent = 'Run'; return; }
    s.running = true; $('run').textContent = 'Pause';
    var target = parseInt($('target').value, 10) || 0, stopOnHit = $('stophit').checked;
    var last = performance.now(), owed = 1;
    (function frame(now) {
      if (!s.running) return;
      if (now) { owed += Math.min(1, (now - last) / 1000) * (speeds[$('speed').value] || 600); last = now; }
      var k = Math.floor(owed); owed -= k;
      var why = step(k, target, stopOnHit);
      draw();
      if (why) {
        s.running = false; $('run').textContent = 'Run';
        var e = est(s.n, s.h);
        $('stopnote').textContent = (why === 'hit' ? 'Stopped at the first 355/113: ' : (s.n > target ? 'Already past the limit of ' : 'Stopped at the limit of ') + group(target) + ' drops: ') +
          group(s.n) + ' drops, ' + group(s.h) + ' crossings, estimate ' + fmt(e, 7) + ', ' + frac(s.n, s.h) + '.';
        return;
      }
      requestAnimationFrame(frame);
    })();
  }

  $('run').addEventListener('click', run);
  $('one').addEventListener('click', function () { if (!s.running) { step(1); draw(); } });
  $('reset').addEventListener('click', function () { s.running = false; $('run').textContent = 'Run'; reset(); });
  $('seed').addEventListener('change', function () { s.running = false; $('run').textContent = 'Run'; reset(); });
  window.addEventListener('resize', draw);

  // ---- many runs: how often does each kind of stop give 355/113?

  $('many').addEventListener('click', function () {
    var runs = Math.min(20000, Math.max(100, parseInt($('runs').value, 10) || 2000));   // the input's own limits, enforced
    var r = rng(s.seed * 7 + 1), fixed = 0, by3408 = 0, by4000 = 0, near = 0;
    for (var k = 0; k < runs; k++) {
      var n = 0, h = 0, hit = false;
      while (n < 4000) {
        n++; if (drop(r).hit) h++;
        if (!hit && isMilu(n, h)) { hit = true; if (n <= 3408) by3408++; by4000++; }
        if (n === 3408) {
          if (h === 1808) fixed++;
          if (Math.abs(est(n, h) - Math.PI) < 0.01) near++;
        }
      }
    }
    var pc = function (x) { return (100 * x / runs).toFixed(1) + '%'; };
    $('manyout').textContent = group(runs) + ' honest runs of 4,000 drops (seed ' + s.seed + '). Stopping at exactly 3,408, fixed in advance: ' +
      group(fixed) + ' landed on 1,808 crossings (' + pc(fixed) + '), and ' + pc(near) + ' were within 0.01 of π. Watching for 355/113 after every drop: ' +
      pc(by3408) + ' saw it by 3,408 drops, ' + pc(by4000) + ' by 4,000.';
  });

  reset();
})();
