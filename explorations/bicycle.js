// Self-stability of the Whipple bicycle, linearised (Meijaard, Papadopoulos, Ruina & Schwab 2007).
// Plain script, no dependencies, nothing loaded from elsewhere. MIT licence.
'use strict';
(function () {
  var G = 9.81;

  // Benchmark parameters, Meijaard et al. 2007 Table 1. SI units, angles in radians.
  var BENCH = {
    w: 1.02, c: 0.08, lam: Math.PI / 10,
    rR: 0.3, mR: 2.0, IRxx: 0.0603, IRyy: 0.12,
    xB: 0.3, zB: -0.9, mB: 85.0, IBxx: 9.2, IByy: 11.0, IBzz: 2.8, IBxz: 2.4,
    xH: 0.9, zH: -0.7, mH: 4.0, IHxx: 0.05892, IHyy: 0.06, IHzz: 0.00708, IHxz: -0.00756,
    rF: 0.35, mF: 3.0, IFxx: 0.1405, IFyy: 0.28
  };

  // Appendix A, eqs (A1)-(A27). Returns [M, C1, K0, K2], each a 2x2 array.
  function matrices(p) {
    var w = p.w, c = p.c, lam = p.lam, rR = p.rR, rF = p.rF;
    var mR = p.mR, mB = p.mB, mH = p.mH, mF = p.mF;
    var xB = p.xB, zB = p.zB, xH = p.xH, zH = p.zH;
    var IRxx = p.IRxx, IRzz = p.IRxx, IFxx = p.IFxx, IFzz = p.IFxx;
    var mT = mR + mB + mH + mF;
    var xT = (xB * mB + xH * mH + w * mF) / mT;
    var zT = (-rR * mR + zB * mB + zH * mH - rF * mF) / mT;
    var ITxx = IRxx + p.IBxx + p.IHxx + IFxx + mR * rR * rR + mB * zB * zB + mH * zH * zH + mF * rF * rF;
    var ITxz = p.IBxz + p.IHxz - mB * xB * zB - mH * xH * zH + mF * w * rF;
    var ITzz = IRzz + p.IBzz + p.IHzz + IFzz + mB * xB * xB + mH * xH * xH + mF * w * w;
    var mA = mH + mF;
    var xA = (xH * mH + w * mF) / mA;
    var zA = (zH * mH - rF * mF) / mA;
    var IAxx = p.IHxx + IFxx + mH * (zH - zA) * (zH - zA) + mF * (rF + zA) * (rF + zA);
    var IAxz = p.IHxz - mH * (xH - xA) * (zH - zA) + mF * (w - xA) * (rF + zA);
    var IAzz = p.IHzz + IFzz + mH * (xH - xA) * (xH - xA) + mF * (w - xA) * (w - xA);
    var sl = Math.sin(lam), cl = Math.cos(lam);
    var uA = (xA - w - c) * cl - zA * sl;
    var IAll = mA * uA * uA + IAxx * sl * sl + 2 * IAxz * sl * cl + IAzz * cl * cl;
    var IAlx = -mA * uA * zA + IAxx * sl + IAxz * cl;
    var IAlz = mA * uA * xA + IAxz * sl + IAzz * cl;
    var mu = c / w * cl;
    var SR = rR ? p.IRyy / rR : 0, SF = rF ? p.IFyy / rF : 0, ST = SR + SF;
    var SA = mA * uA + mu * mT * xT;
    var M = [[ITxx, IAlx + mu * ITxz], [IAlx + mu * ITxz, IAll + 2 * mu * IAlz + mu * mu * ITzz]];
    var K0 = [[mT * zT, -SA], [-SA, -SA * sl]];
    var K2 = [[0, (ST - mT * zT) / w * cl], [0, (SA + SF * sl) / w * cl]];
    var C1 = [[0, mu * ST + SF * cl + ITxz / w * cl - mu * mT * zT],
              [-(mu * ST + SF * cl), IAlz / w * cl + mu * (SA + ITzz / w * cl)]];
    return [M, C1, K0, K2];
  }

  // The page's four knobs on top of the benchmark: trail c (m), steer-axis tilt (degrees,
  // measured from vertical), and a factor on both wheels' spin inertia (the gyroscopic terms).
  function params(c, tiltDeg, gyro) {
    var p = {}, k;
    for (k in BENCH) p[k] = BENCH[k];
    p.c = c; p.lam = tiltDeg * Math.PI / 180;
    p.IRyy = gyro * BENCH.IRyy; p.IFyy = gyro * BENCH.IFyy;
    return p;
  }

  // Coefficients [a4..a0] of det(M s^2 + v C1 s + g K0 + v^2 K2).
  function charpoly(m, v) {
    var P = [[], []], i, j;
    for (i = 0; i < 2; i++) for (j = 0; j < 2; j++)
      P[i][j] = [m[0][i][j], v * m[1][i][j], G * m[2][i][j] + v * v * m[3][i][j]];
    function mul(a, b) {
      var r = [0, 0, 0, 0, 0];
      for (var x = 0; x < 3; x++) for (var y = 0; y < 3; y++) r[x + y] += a[x] * b[y];
      return r;
    }
    var d1 = mul(P[0][0], P[1][1]), d2 = mul(P[0][1], P[1][0]);
    return d1.map(function (x, k) { return x - d2[k]; });
  }

  // Complex numbers as [re, im].
  function cmul(a, b) { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]; }
  function cdiv(a, b) {
    var d = b[0] * b[0] + b[1] * b[1];
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
  }

  // All four roots of a quartic: Durand-Kerner, then Newton polish (as in bicycle.py, which
  // stops Durand-Kerner at 1e-15; the stability edges come out the same to 14 decimals).
  function roots(coef) {
    var a = coef.map(function (x) { return x / coef[0]; }), n = a.length - 1, i, j, it;
    function f(z) { var r = [0, 0]; for (var k = 0; k <= n; k++) { r = cmul(r, z); r[0] += a[k]; } return r; }
    function df(z) { var r = [0, 0]; for (var k = 0; k < n; k++) { r = cmul(r, z); r[0] += a[k] * (n - k); } return r; }
    var z = [], b = [1, 0];
    for (i = 0; i < n; i++) { z.push(b); b = cmul(b, [0.4, 0.9]); }
    for (it = 0; it < 2000; it++) {
      var nz = [], moved = 0;
      for (i = 0; i < n; i++) {
        var den = [1, 0];
        for (j = 0; j < n; j++) if (j !== i) den = cmul(den, [z[i][0] - z[j][0], z[i][1] - z[j][1]]);
        var q = cdiv(f(z[i]), den);
        nz.push([z[i][0] - q[0], z[i][1] - q[1]]);
        moved = Math.max(moved, Math.hypot(q[0], q[1]));
      }
      z = nz;
      if (moved < 1e-12) break;   // Newton below supplies the last digits; 1e-15 only stalls
    }
    return z.map(function (r) {
      for (var k = 0; k < 5; k++) {
        var d = df(r);
        if (d[0] === 0 && d[1] === 0) break;
        var q = cdiv(f(r), d);
        r = [r[0] - q[0], r[1] - q[1]];
      }
      if (Math.abs(r[1]) < 1e-9) r = [r[0], 0];
      return r;
    }).sort(function (x, y) { return x[0] - y[0] || x[1] - y[1]; });
  }

  function eig(m, v) { return roots(charpoly(m, v)); }
  function maxre(m, v) { return Math.max.apply(null, eig(m, v).map(function (r) { return r[0]; })); }

  // Speed intervals in (0, vmax] where every eigenvalue has negative real part, found on a
  // 0.01 m/s grid and refined by bisection. An interval that runs past vmax ends in Infinity.
  function stableRanges(m, vmax, step) {
    vmax = vmax || 10; step = step || 0.01;
    var out = [], prev = null, start = null, n = Math.round(vmax / step);
    for (var k = 1; k <= n; k++) {
      var v = k * step, s = maxre(m, v) < 0;
      if (prev !== null && s !== prev) {
        var lo = v - step, hi = v;
        for (var b = 0; b < 60; b++) {
          var mid = (lo + hi) / 2;
          if ((maxre(m, mid) < 0) === prev) lo = mid; else hi = mid;
        }
        var edge = (lo + hi) / 2;
        if (s) start = edge; else { out.push([start, edge]); start = null; }
      } else if (prev === null && s) start = 0;
      prev = s;
    }
    if (start !== null) out.push([start, Infinity]);
    return out;
  }

  // Right-hand side of M q'' + v C1 q' + (g K0 + v^2 K2) q = 0, state [lean, steer, lean rate, steer rate].
  function deriv(m, v) {
    var M = m[0], C = m[1], det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
    var Mi = [[M[1][1] / det, -M[0][1] / det], [-M[1][0] / det, M[0][0] / det]];
    var K = [[0, 0], [0, 0]];
    for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) K[i][j] = G * m[2][i][j] + v * v * m[3][i][j];
    return function (s) {
      var f0 = -(v * C[0][0] * s[2] + v * C[0][1] * s[3] + K[0][0] * s[0] + K[0][1] * s[1]);
      var f1 = -(v * C[1][0] * s[2] + v * C[1][1] * s[3] + K[1][0] * s[0] + K[1][1] * s[1]);
      return [s[2], s[3], Mi[0][0] * f0 + Mi[0][1] * f1, Mi[1][0] * f0 + Mi[1][1] * f1];
    };
  }
  function rk4(rhs, s, dt) {
    function add(a, b, h) { return a.map(function (x, i) { return x + h * b[i]; }); }
    var k1 = rhs(s), k2 = rhs(add(s, k1, dt / 2)), k3 = rhs(add(s, k2, dt / 2)), k4 = rhs(add(s, k3, dt));
    return s.map(function (x, i) { return x + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]); });
  }

  var core = { BENCH: BENCH, matrices: matrices, params: params, charpoly: charpoly, roots: roots,
               eig: eig, maxre: maxre, stableRanges: stableRanges, deriv: deriv, rk4: rk4 };
  if (typeof document === 'undefined') { if (typeof module !== 'undefined') module.exports = core; return; }

  // ---------------------------------------------------------------- the page
  var $ = function (id) { return document.getElementById(id); };
  var css = getComputedStyle(document.documentElement);
  var INK = css.getPropertyValue('--ink').trim() || '#1d2733';
  var QUIET = css.getPropertyValue('--quiet').trim() || '#5d6672';
  var RULE = css.getPropertyValue('--rule').trim() || '#c9bfae';
  var GREEN = css.getPropertyValue('--verdigris').trim() || '#2e6b5e';
  var PAPER = css.getPropertyValue('--paper').trim() || '#f4efe4';
  var VMAX = 10, KICK = 0.5, TSPAN = 6, FALL = 0.6;   // m/s; rad/s; s shown; rad, where the drawing gives up

  var plot = $('eigplot'), rig = $('rig'), trace = $('trace');
  var ui = { v: $('v'), c: $('c'), tilt: $('tilt'), gyro: $('gyro') };
  var cur;          // current bicycle: matrices, curves, stable window
  var sim;          // current push test

  function fit(cv) {
    var r = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * r) || cv.height !== Math.round(h * r)) { cv.width = Math.round(w * r); cv.height = Math.round(h * r); }
    var x = cv.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0);
    return { x: x, w: w, h: h };
  }
  // Snapped to each slider's own step, so a range input's float noise can't move the answer.
  function num(id) { var q = { v: 100, c: 10000, tilt: 10, gyro: 100 }[id]; return Math.round(parseFloat(ui[id].value) * q) / q; }
  function fmtRanges(r) {
    if (!r.length) return 'none between 0 and ' + VMAX + ' m/s';
    return r.map(function (p) {
      return p[0].toFixed(4) + ' < v < ' + (p[1] === Infinity ? VMAX + ' (end of the scan)' : p[1].toFixed(4)) + ' m/s';
    }).join(', ');
  }
  function deg(a) { return (a < 0 ? '−' : '') + Math.abs(a * 180 / Math.PI).toFixed(1) + '°'; }
  function stableAt(v) { return cur.ranges.some(function (p) { return v > p[0] && v < p[1]; }); }

  function rebuild() {
    var m = matrices(params(num('c'), num('tilt'), num('gyro')));
    var pts = [];
    for (var k = 0; k <= 500; k++) { var v = k * VMAX / 500; pts.push([v, eig(m, v)]); }
    cur = { m: m, pts: pts, ranges: stableRanges(m, VMAX, 0.01) };
    $('cval').textContent = (num('c') * 100).toFixed(1).replace('-', '−') + ' cm';
    $('tiltval').textContent = num('tilt').toFixed(1) + '°';
    $('gyroval').textContent = '× ' + num('gyro').toFixed(2);
    $('window').textContent = fmtRanges(cur.ranges);
    var bench = num('c') === 0.08 && num('tilt') === 18 && num('gyro') === 1;
    $('benchnote').textContent = bench && cur.ranges.length === 1 ? 'These are the benchmark values. To 14 decimals this page computes ' +
      cur.ranges[0][0].toFixed(14) + ' and ' + cur.ranges[0][1].toFixed(14) + '; Meijaard et al. print 4.29238253634111 and 6.02426201538837.' : '';
    speed();
  }

  function speed() {
    var v = num('v'), ev = eig(cur.m, v);
    $('vval').textContent = v.toFixed(2) + ' m/s';
    $('eigs').textContent = ev.map(function (r) {
      return (r[0] >= 0 ? '+' : '−') + Math.abs(r[0]).toFixed(3) + (r[1] ? (r[1] > 0 ? '\u00a0+\u00a0' : '\u00a0−\u00a0') + Math.abs(r[1]).toFixed(3) + 'i' : '');   // no-break spaces: one eigenvalue, one line
    }).join(',  ');
    $('verdict').textContent = stableAt(v) ? 'Self-stable at this speed: every real part is negative.' :
      'Not self-stable at this speed: at least one real part is positive.';
    drawPlot();
    push();
  }

  // Real parts of the four eigenvalues against speed, the stable window shaded.
  function drawPlot() {
    var c = fit(plot), x = c.x, W = c.w, H = c.h, L = 44, R = 10, T = 10, B = 36;
    var YMIN = -10, YMAX = 6;
    function px(v) { return L + (W - L - R) * v / VMAX; }
    function py(y) { return T + (H - T - B) * (YMAX - y) / (YMAX - YMIN); }
    x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(46,107,94,0.14)';
    cur.ranges.forEach(function (p) { var a = px(p[0]), b = px(Math.min(p[1], VMAX)); x.fillRect(a, T, b - a, H - T - B); });
    x.strokeStyle = RULE; x.lineWidth = 1; x.fillStyle = QUIET; x.font = '12px Georgia, serif';
    x.textAlign = 'right'; x.textBaseline = 'middle';
    for (var y = YMIN; y <= YMAX; y += 2) {
      x.beginPath(); x.moveTo(L, py(y)); x.lineTo(W - R, py(y)); x.stroke();
      x.fillText(String(y).replace('-', '−'), L - 6, py(y));
    }
    x.textAlign = 'center'; x.textBaseline = 'top';
    for (var v = 0; v <= VMAX; v += 1) x.fillText(String(v), px(v), H - B + 6);
    x.fillText('speed, m/s', (L + W - R) / 2, H - 15);
    x.strokeStyle = INK; x.beginPath(); x.moveTo(L, py(0)); x.lineTo(W - R, py(0)); x.stroke();
    x.save(); x.beginPath(); x.rect(L, T, W - L - R, H - T - B); x.clip();
    cur.pts.forEach(function (p) {
      p[1].forEach(function (r) {
        x.fillStyle = r[1] ? INK : QUIET;
        x.fillRect(px(p[0]) - 1, py(r[0]) - 1, r[1] ? 2.2 : 1.6, r[1] ? 2.2 : 1.6);
      });
    });
    x.restore();
    var sv = px(num('v'));
    x.strokeStyle = GREEN; x.setLineDash([4, 3]); x.beginPath(); x.moveTo(sv, T); x.lineTo(sv, H - B); x.stroke(); x.setLineDash([]);
    x.save(); x.translate(12, (T + H - B) / 2); x.rotate(-Math.PI / 2); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = QUIET; x.fillText('real part, 1/s', 0, 0); x.restore();
  }

  // Push test: from upright, a lean-rate kick, integrated with RK4 at 1 ms.
  function push() {
    sim = { rhs: deriv(cur.m, num('v')), s: [0, 0, KICK, 0], t: 0, hist: [[0, 0, 0]], fell: false, last: null };
  }
  function step(dtWall) {
    var n = Math.round(Math.min(dtWall, 0.05) / 0.001);
    for (var i = 0; i < n && !sim.fell && sim.t < TSPAN; i++) {
      sim.s = rk4(sim.rhs, sim.s, 0.001); sim.t += 0.001;
      if (i % 10 === 0) sim.hist.push([sim.t, sim.s[0], sim.s[1]]);
      if (Math.abs(sim.s[0]) > FALL) sim.fell = true;
    }
  }

  function drawRig() {
    var c = fit(rig), x = c.x, W = c.w, H = c.h, phi = sim.s[0], del = sim.s[1];
    x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
    var gy = H - 22, cx = W * 0.27, len = H * 0.62;
    // Rear view: the bicycle as a leaning stroke on its wheel's contact point.
    x.strokeStyle = RULE; x.lineWidth = 1; x.beginPath(); x.moveTo(12, gy); x.lineTo(W * 0.52, gy); x.stroke();
    var tip = [cx + len * Math.sin(phi), gy - len * Math.cos(phi)];
    x.strokeStyle = INK; x.lineWidth = 5; x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx, gy); x.lineTo(tip[0], tip[1]); x.stroke();
    x.lineWidth = 3; var hb = 26;
    x.beginPath(); x.moveTo(tip[0] - hb * Math.cos(phi), tip[1] - hb * Math.sin(phi));
    x.lineTo(tip[0] + hb * Math.cos(phi), tip[1] + hb * Math.sin(phi)); x.stroke();
    x.fillStyle = QUIET; x.font = '12px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'bottom';
    x.fillText('from behind: lean ' + deg(phi), cx, H - 4);
    // Top view: frame along the road, front wheel turned by the steer angle.
    var ox = W * 0.62, oy = H * 0.5, fw = W * 0.3;
    x.strokeStyle = RULE; x.lineWidth = 1; x.setLineDash([3, 4]);
    x.beginPath(); x.moveTo(ox - 10, oy); x.lineTo(W - 8, oy); x.stroke(); x.setLineDash([]);
    x.strokeStyle = QUIET; x.lineWidth = 5;
    x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + 34, oy); x.stroke();             // rear wheel
    x.strokeStyle = INK; x.lineWidth = 2;
    x.beginPath(); x.moveTo(ox + 17, oy); x.lineTo(ox + fw, oy); x.stroke();        // frame
    var d = Math.max(-1.2, Math.min(1.2, del));
    x.lineWidth = 5; x.beginPath();
    // Riding left to right seen from above, the rider's right is down the screen; positive
    // steer (Meijaard's sign, as for lean) is to the right, so the wheel's leading end goes down.
    x.moveTo(ox + fw - 17 * Math.cos(d), oy - 17 * Math.sin(d));
    x.lineTo(ox + fw + 17 * Math.cos(d), oy + 17 * Math.sin(d)); x.stroke();           // front wheel
    x.fillText('from above: steer ' + deg(del), ox + fw / 2, H - 4);
    if (sim.fell) {
      x.fillStyle = INK; x.textBaseline = 'top'; x.textAlign = 'left';
      x.fillText('Fallen over (past ' + Math.round(FALL * 180 / Math.PI) + '°: the linear model ends here)', 12, 8);
    }
  }

  function drawTrace() {
    var c = fit(trace), x = c.x, W = c.w, H = c.h, L = 44, R = 10, T = 8, B = 26;
    var hs = sim.hist, amp = 0.05;
    hs.forEach(function (h) { amp = Math.max(amp, Math.abs(h[1]), Math.abs(h[2])); });
    amp = Math.min(amp, FALL) * 1.1;
    function px(t) { return L + (W - L - R) * t / TSPAN; }
    function py(y) { return T + (H - T - B) * (1 - (y + amp) / (2 * amp)); }
    x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
    x.strokeStyle = RULE; x.lineWidth = 1; x.fillStyle = QUIET; x.font = '12px Georgia, serif';
    x.textAlign = 'center'; x.textBaseline = 'top';
    for (var t = 0; t <= TSPAN; t++) { x.beginPath(); x.moveTo(px(t), T); x.lineTo(px(t), H - B); x.stroke(); x.fillText(t + ' s', px(t), H - B + 5); }
    x.strokeStyle = INK; x.beginPath(); x.moveTo(L, py(0)); x.lineTo(W - R, py(0)); x.stroke();
    x.textAlign = 'right'; x.textBaseline = 'middle';
    x.fillText((amp * 180 / Math.PI).toFixed(0) + '°', L - 6, py(amp * 0.9));
    x.fillText('−' + (amp * 180 / Math.PI).toFixed(0) + '°', L - 6, py(-amp * 0.9));
    x.save(); x.beginPath(); x.rect(L, T, W - L - R, H - T - B); x.clip();
    [[1, INK, []], [2, GREEN, [5, 3]]].forEach(function (s) {
      x.strokeStyle = s[1]; x.lineWidth = 1.6; x.setLineDash(s[2]); x.beginPath();
      hs.forEach(function (h, i) { if (i) x.lineTo(px(h[0]), py(h[s[0]])); else x.moveTo(px(h[0]), py(h[s[0]])); });
      x.stroke();
    });
    x.restore(); x.setLineDash([]);
  }

  // Once a push test has ended its picture doesn't change, so stop redrawing until something does.
  var drawn = null;
  function frame(now) {
    if (sim.last !== null) step((now - sim.last) / 1000);
    sim.last = now;
    var done = sim.fell || sim.t >= TSPAN;
    if (!(done && drawn === sim)) { drawRig(); drawTrace(); drawn = done ? sim : null; }
    requestAnimationFrame(frame);
  }

  // Slider input arrives faster than a rebuild; do at most one per frame.
  var pending = null;
  function later(fn) { if (!pending) requestAnimationFrame(function () { var f = pending; pending = null; f(); }); if (pending !== rebuild) pending = fn; }
  ui.v.addEventListener('input', function () { later(speed); });
  ['c', 'tilt', 'gyro'].forEach(function (k) { ui[k].addEventListener('input', function () { later(rebuild); }); });
  $('push').addEventListener('click', push);
  $('bench').addEventListener('click', function () {
    ui.c.value = 0.08; ui.tilt.value = 18; ui.gyro.value = 1; ui.v.value = 5; rebuild();
  });
  window.addEventListener('resize', function () { drawPlot(); drawn = null; });
  rebuild();
  requestAnimationFrame(frame);
})();
