// The equation of time and the analemma, from a Kepler orbit, with its two causes on sliders.
// Plain script, no dependencies, nothing loaded from elsewhere. MIT licence.
// The arithmetic is a port of the note's Python model: Meeus ch. 25 elements, Kepler's
// equation solved exactly, four nutation terms and aberration (Meeus eq. 28.1), dT = 69 s.
// Sign: EoT = sundial time minus clock time, positive in November.
'use strict';
(function () {
  var D2R = Math.PI / 180, MIN_PER_DEG = 4;

  function wrap180(x) { return ((x + 180) % 360 + 360) % 360 - 180; }
  function kepler(M, e) {
    var E = M + e * Math.sin(M);
    for (var i = 0; i < 50; i++) {
      var dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-15) break;
    }
    return E;
  }
  function trueAnom(M, e) {
    var E = kepler(M, e);
    return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  }
  // Right ascension (deg) of ecliptic longitude lam (deg) at obliquity eps (deg).
  function raFromLon(lam, eps) {
    return Math.atan2(Math.cos(eps * D2R) * Math.sin(lam * D2R), Math.cos(lam * D2R)) / D2R;
  }
  // T = Julian centuries TT from J2000.0; degrees except e.
  function elements(T) {
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    var M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    var e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
    var eps0 = 23 + 26 / 60 + (21.448 - 46.8150 * T - 0.00059 * T * T + 0.001813 * T * T * T) / 3600;
    var Om = 125.04452 - 1934.136261 * T, Lm = 218.3165 + 481267.8813 * T;
    var dpsi = (-17.20 * Math.sin(Om * D2R) - 1.32 * Math.sin(2 * L0 * D2R)
      - 0.23 * Math.sin(2 * Lm * D2R) + 0.21 * Math.sin(2 * Om * D2R)) / 3600;
    var deps = (9.20 * Math.cos(Om * D2R) + 0.57 * Math.cos(2 * L0 * D2R)
      + 0.10 * Math.cos(2 * Lm * D2R) - 0.09 * Math.cos(2 * Om * D2R)) / 3600;
    return { L0: L0, M: M, e: e, eps0: eps0, dpsi: dpsi, deps: deps };
  }

  // The sliders scale the real elements, so at their defaults the model is exactly the note's:
  // eScale multiplies e, epsScale multiplies the true obliquity, periShift (deg) moves perihelion.
  var REAL = { eScale: 1, epsScale: 1, periShift: 0 };

  // EoT (minutes) and its exact split at a UT Julian date:
  // ecc = L0 - lambda (equation of centre), obl = lambda_app - alpha (reduction to the equator),
  // rest = aberration constant + nutation; ecc + obl + rest = total by construction.
  function eotParts(jdUT, o) {
    o = o || REAL;
    var T = (jdUT + 69 / 86400 - 2451545.0) / 36525;
    var el = elements(T);
    var e = el.e * o.eScale;
    var M = el.M - o.periShift;
    var nu = trueAnom(M * D2R, e) / D2R;
    var lam = el.L0 + (nu - M);
    var R = 1.000001018 * (1 - e * e) / (1 + e * Math.cos(nu * D2R));
    var lamApp = lam + el.dpsi - 20.4898 / 3600 / R;
    var eps = (el.eps0 + el.deps) * o.epsScale;
    var alpha = raFromLon(lamApp, eps);
    var dec = Math.asin(Math.sin(eps * D2R) * Math.sin(lamApp * D2R)) / D2R;
    var total = wrap180(el.L0 - 0.0057183 - alpha + el.dpsi * Math.cos(eps * D2R)) * MIN_PER_DEG;
    var ecc = wrap180(el.L0 - lam) * MIN_PER_DEG;
    var obl = wrap180(lamApp - alpha) * MIN_PER_DEG;
    return { total: total, ecc: ecc, obl: obl, rest: total - ecc - obl, dec: dec };
  }

  function jd(y, m, d, h) {
    if (h === undefined) h = 12;
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + h / 24;
  }
  var JD0 = jd(2026, 1, 1);              // 2026 Jan 1, 12:00 UT; day k is JD0 + k
  var NDAYS = 365;

  // Elements at 2026-07-02, as the note states them.
  var E26 = (function () { var el = elements((jd(2026, 7, 2) - 2451545.0) / 36525); return { e: el.e, eps: el.eps0, peri: ((el.L0 - el.M) % 360 + 360) % 360 }; })();

  function year(o) {
    var days = [];
    for (var k = 0; k < NDAYS; k++) days.push(eotParts(JD0 + k, o));
    return days;
  }

  function bisect(f, a, b) {
    var fa = f(a);
    for (var i = 0; i < 60; i++) {
      var m = (a + b) / 2, fm = f(m);
      if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else b = m;
    }
    return (a + b) / 2;
  }
  function golden(f, a, b, sign) {
    var g = (Math.sqrt(5) - 1) / 2, c = b - g * (b - a), d = a + g * (b - a);
    var fc = sign * f(c), fd = sign * f(d);
    for (var i = 0; i < 80; i++) {
      if (fc > fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = sign * f(c); }
      else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = sign * f(d); }
    }
    return (a + b) / 2;
  }

  // Turning points and zeros of one series (key) through the year, refined on the continuous
  // model: t is days after 2026 Jan 1 12:00 UT.
  function events(days, o, key) {
    key = key || 'total';
    var v = days.map(function (p) { return p[key]; });
    var f = function (t) { return eotParts(JD0 + t, o)[key]; };
    var ext = [], zeros = [];
    for (var i = 1; i < v.length - 1; i++) {
      var up = v[i] - v[i - 1], dn = v[i + 1] - v[i];
      if (up * dn < 0 || (up !== 0 && dn === 0)) {
        var s = up > 0 ? 1 : -1, t = golden(f, i - 1, i + 1, s);
        ext.push({ t: t, v: f(t), kind: s > 0 ? 'max' : 'min' });
      }
    }
    for (var j = 0; j < v.length - 1; j++) {
      if (v[j] === 0) zeros.push({ t: j });
      else if (v[j] * v[j + 1] < 0) zeros.push({ t: bisect(f, j, j + 1) });
    }
    return { ext: ext, zeros: zeros };
  }

  // Self-intersections of the daily analemma (EoT, dec), as in the note: closed polyline.
  function crossings(days) {
    var pts = days.map(function (p) { return [p.total, p.dec]; }), n = pts.length, out = [];
    for (var i = 0; i < n - 1; i++) {
      for (var j = i + 2; j < n - 1; j++) {
        var p = pts[i], p2 = pts[i + 1], q = pts[j], q2 = pts[j + 1];
        var d = (p2[0] - p[0]) * (q2[1] - q[1]) - (p2[1] - p[1]) * (q2[0] - q[0]);
        if (d === 0) continue;
        var t = ((q[0] - p[0]) * (q2[1] - q[1]) - (q[1] - p[1]) * (q2[0] - q[0])) / d;
        var u = ((q[0] - p[0]) * (p2[1] - p[1]) - (q[1] - p[1]) * (p2[0] - p[0])) / d;
        if (t >= 0 && t < 1 && u >= 0 && u < 1) out.push({ ti: i + t, tj: j + u, eot: p[0] + t * (p2[0] - p[0]), dec: p[1] + t * (p2[1] - p[1]) });
      }
    }
    return out;
  }

  var core = { eotParts: eotParts, jd: jd, JD0: JD0, year: year, events: events, crossings: crossings, elements: elements, E26: E26, REAL: REAL };
  if (typeof module === 'object' && module.exports) { module.exports = core; return; }

  // ---------- page ----------
  function $(id) { return document.getElementById(id); }
  var MON = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
  var MSTART = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];

  function ms(x) {
    var s = Math.abs(x) * 60 < 0.05 ? '' : x < 0 ? '−' : '+', a = Math.abs(x) * 60, m = Math.floor(a / 60), sec = a - 60 * m;
    if (sec >= 59.95) { m += 1; sec = 0; }
    return s + m + 'm' + (sec < 10 ? '0' : '') + sec.toFixed(1) + 's';
  }
  // t days after Jan 1 12:00 UT -> "3 Nov, 08 h UT"
  function when(t, hours) {
    var x = t + 0.5, d = Math.floor(x), h = Math.floor((x - d) * 24);
    var mo = 0; while (mo < 11 && d >= MSTART[mo + 1]) mo++;
    var s = (d - MSTART[mo] + 1) + ' ' + MON[mo];
    return hours === false ? s : s + ', ' + (h < 10 ? '0' : '') + h + ' h UT';
  }
  function fit(cv) {
    var r = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * r) || cv.height !== Math.round(h * r)) { cv.width = Math.round(w * r); cv.height = Math.round(h * r); }
    var x = cv.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0);
    return { x: x, w: w, h: h };
  }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000'; }
  function niceStep(span, n) {
    var raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }

  var ui = { e: $('ecc'), eps: $('obl'), peri: $('peri'), ev: $('eccval'), epsv: $('oblval'), periv: $('perival') };
  var state = { eScale: 1, epsScale: 1, periShift: 0 };
  var REALYEAR = year(REAL);
  var cur = null;

  function isReal() { return state.eScale === 1 && state.epsScale === 1 && state.periShift === 0; }
  function syncSliders() {
    ui.e.value = (E26.e * state.eScale).toFixed(4);
    ui.eps.value = (E26.eps * state.epsScale).toFixed(2);
    ui.peri.value = Math.round(((E26.peri + state.periShift) % 360 + 360) % 360);
  }
  function labels() {
    var e = E26.e * state.eScale, eps = E26.eps * state.epsScale, w = ((E26.peri + state.periShift) % 360 + 360) % 360;
    ui.ev.textContent = e.toFixed(state.eScale === 1 ? 7 : 4);
    ui.epsv.textContent = eps.toFixed(state.epsScale === 1 ? 5 : 2) + '°';
    // Perihelion date: when the mean sun's longitude L0 equals w (L0 = 280.46 deg at J2000 noon).
    var t = ((w - eotRefL0()) % 360 + 360) % 360 / 0.98564736;
    ui.periv.textContent = w.toFixed(state.periShift === 0 ? 2 : 0) + '° (' + when(t, false) + ')';
  }
  function eotRefL0() { return elements((JD0 + 69 / 86400 - 2451545.0) / 36525).L0 % 360; }

  function compute() {
    var days = year(state);
    var ev = events(days, state, 'total');
    cur = { days: days, ev: ev, cross: crossings(days), ecc: events(days, state, 'ecc'), obl: events(days, state, 'obl') };
  }

  // Every turning point of one term, in date order; "zero all year" when it is switched off.
  function termText(evs, key) {
    var big = cur.days.some(function (p) { return Math.abs(p[key]) * 60 >= 0.05; });
    if (!big) return 'zero all year';
    if (!evs.ext.length) return 'no turning points';
    return evs.ext.map(function (x) { return ms(x.v) + ' on ' + when(x.t, false); }).join(', ');
  }

  function table() {
    var rows = [];
    cur.ev.ext.forEach(function (x) { rows.push({ t: x.t, what: x.kind === 'max' ? 'maximum' : 'minimum', v: ms(x.v) }); });
    cur.ev.zeros.forEach(function (z) { rows.push({ t: z.t, what: 'sundial = clock', v: '0' }); });
    rows.sort(function (a, b) { return a.t - b.t; });
    var tb = $('evrows'); tb.textContent = '';
    if (!rows.length) { var tr0 = document.createElement('tr'), td0 = document.createElement('td'); td0.colSpan = 3; td0.textContent = 'No turning points: the sundial and the clock agree all year.'; tr0.appendChild(td0); tb.appendChild(tr0); }
    var hi = -Infinity, lo = Infinity;
    cur.ev.ext.forEach(function (x) { hi = Math.max(hi, x.v); lo = Math.min(lo, x.v); });
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      [when(r.t), r.what, r.v].forEach(function (s, i) {
        var td = document.createElement('td'); td.textContent = s; if (i === 2) td.className = 'n'; tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    $('sumecc').textContent = 'Eccentricity term: ' + termText(cur.ecc, 'ecc') + '.';
    $('sumobl').textContent = 'Tilt term: ' + termText(cur.obl, 'obl') + '.';
    var c = cur.cross;
    $('sumx').textContent = c.length === 0
      ? (state.epsScale === 0 ? 'The analemma has collapsed to a horizontal line: with no tilt, the Sun’s declination never changes.' : 'The curve doesn’t cross itself: it is a single loop, not a figure 8.')
      : c.length === 1
        ? 'It crosses itself once, at declination ' + (Math.abs(c[0].dec) < 0.005 ? '' : c[0].dec < 0 ? '−' : '+') + Math.abs(c[0].dec).toFixed(2) + '° and EoT ' + ms(c[0].eot) + ', on ' + when(c[0].ti) + ' and ' + when(c[0].tj) + '.'
        : 'It crosses itself ' + c.length + ' times.';
    var range = (isFinite(hi) ? hi : 0) - (isFinite(lo) ? lo : 0);
    $('sumr').textContent = isFinite(hi) ? 'Over the year the sundial runs from ' + ms(lo) + ' to ' + ms(hi) + ' against the clock, a range of ' + (range).toFixed(1) + ' minutes.' : '';
  }

  // Analemma: declination (up) against EoT (right), same clock time every day.
  function drawAnalemma() {
    var cv = $('ana'), g = fit(cv), x = g.x, W = g.w, H = g.h;
    var ink = css('--ink'), quiet = css('--quiet'), rule = css('--rule'), green = css('--verdigris');
    x.clearRect(0, 0, W, H);
    var all = cur.days.concat(REALYEAR);
    var xm = 17, ym = 25;
    all.forEach(function (p) { xm = Math.max(xm, Math.abs(p.total) * 1.06); ym = Math.max(ym, Math.abs(p.dec) * 1.06); });
    var L = 44, R = 12, T = 14, B = 34;
    var sx = function (v) { return L + (v + xm) / (2 * xm) * (W - L - R); };
    var sy = function (v) { return T + (ym - v) / (2 * ym) * (H - T - B); };
    x.font = '12px Georgia, serif'; x.lineWidth = 1;
    var st = niceStep(2 * xm, W < 500 ? 4 : 8);
    x.strokeStyle = rule; x.fillStyle = quiet; x.textAlign = 'center';
    for (var v = Math.ceil(-xm / st) * st; v <= xm; v += st) {
      x.beginPath(); x.moveTo(sx(v), T); x.lineTo(sx(v), H - B); x.stroke();
      x.fillText((v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(Math.round(v)), sx(v), H - B + 15);
    }
    x.fillText('sundial minus clock, minutes', L + (W - L - R) / 2, H - 4);
    x.textAlign = 'right';
    var sty = niceStep(2 * ym, 6);
    for (var d = Math.ceil(-ym / sty) * sty; d <= ym; d += sty) {
      x.beginPath(); x.moveTo(L, sy(d)); x.lineTo(W - R, sy(d)); x.stroke();
      x.fillText((d < 0 ? '−' : d > 0 ? '+' : '') + Math.abs(Math.round(d)) + '°', L - 5, sy(d) + 4);
    }
    x.strokeStyle = quiet; x.beginPath(); x.moveTo(sx(0), T); x.lineTo(sx(0), H - B); x.stroke();
    x.beginPath(); x.moveTo(L, sy(0)); x.lineTo(W - R, sy(0)); x.stroke();
    function path(days, col, wid, dash) {
      x.strokeStyle = col; x.lineWidth = wid; x.setLineDash(dash || []);
      x.beginPath();
      days.forEach(function (p, i) { var X = sx(p.total), Y = sy(p.dec); if (i) x.lineTo(X, Y); else x.moveTo(X, Y); });
      x.closePath(); x.stroke(); x.setLineDash([]);
    }
    if (!isReal()) path(REALYEAR, quiet, 1, [4, 3]);
    path(cur.days, ink, 1.8);
    // the 1st of each month, labelled away from the middle of the curve and kept inside the plot
    var cx = 0, cy = 0;
    cur.days.forEach(function (p) { cx += sx(p.total); cy += sy(p.dec); });
    cx /= cur.days.length; cy /= cur.days.length;
    x.fillStyle = green; x.font = '11px Georgia, serif';
    for (var m = 0; m < 12; m++) {
      var p = cur.days[MSTART[m]], X = sx(p.total), Y = sy(p.dec);
      x.beginPath(); x.arc(X, Y, 3, 0, 2 * Math.PI); x.fill();
      var dx = X - cx, dy = Y - cy, r = Math.sqrt(dx * dx + dy * dy) || 1, tw = x.measureText(MON[m]).width;
      // step outward until the label clears the crossing circles (1 Sep sits next to the 30 Aug one)
      for (var off = 9; off <= 30; off += 3) {
        var lx = X + off * dx / r, ly = Math.min(Math.max(Y + off * dy / r + 4, T + 10), H - B - 3);
        var right = dx >= 0;
        if (right && lx + tw > W - R) right = false;
        if (!right && lx - tw < L) right = true;
        var x0 = right ? lx : lx - tw, x1 = x0 + tw, y0 = ly - 9, y1 = ly + 2;
        if (!cur.cross.some(function (c) {
          var qx = sx(c.eot), qy = sy(c.dec);
          return qx > x0 - 8 && qx < x1 + 8 && qy > y0 - 8 && qy < y1 + 10;
        })) break;
      }
      x.textAlign = right ? 'left' : 'right';
      x.fillText(MON[m], lx, ly);
    }
    cur.cross.forEach(function (c) {
      x.strokeStyle = ink; x.lineWidth = 1; x.beginPath(); x.arc(sx(c.eot), sy(c.dec), 5, 0, 2 * Math.PI); x.stroke();
    });
  }

  // EoT through the year, and its two terms.
  function drawCurve() {
    var cv = $('curve'), g = fit(cv), x = g.x, W = g.w, H = g.h;
    var ink = css('--ink'), quiet = css('--quiet'), rule = css('--rule'), green = css('--verdigris');
    x.clearRect(0, 0, W, H);
    var ym = 17;
    cur.days.forEach(function (p) { ym = Math.max(ym, Math.abs(p.total) * 1.06, Math.abs(p.ecc) * 1.06, Math.abs(p.obl) * 1.06); });
    var L = 40, R = 10, T = 10, B = 24;
    var sx = function (t) { return L + t / NDAYS * (W - L - R); };
    var sy = function (v) { return T + (ym - v) / (2 * ym) * (H - T - B); };
    x.font = '12px Georgia, serif'; x.lineWidth = 1; x.strokeStyle = rule; x.fillStyle = quiet;
    x.textAlign = 'center';
    for (var m = 0; m < 12; m++) {
      x.beginPath(); x.moveTo(sx(MSTART[m]), T); x.lineTo(sx(MSTART[m]), H - B); x.stroke();
      if (W > 420 || m % 2 === 0) x.fillText(MON[m], sx((MSTART[m] + MSTART[m + 1]) / 2), H - B + 15);
    }
    x.textAlign = 'right';
    var st = niceStep(2 * ym, 6);
    for (var v = Math.ceil(-ym / st) * st; v <= ym; v += st) {
      x.strokeStyle = v === 0 ? quiet : rule;
      x.beginPath(); x.moveTo(L, sy(v)); x.lineTo(W - R, sy(v)); x.stroke();
      x.fillText((v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(Math.round(v)), L - 5, sy(v) + 4);
    }
    function line(key, col, wid, dash) {
      x.strokeStyle = col; x.lineWidth = wid; x.setLineDash(dash || []);
      x.beginPath();
      cur.days.forEach(function (p, i) { var X = sx(i), Y = sy(p[key]); if (i) x.lineTo(X, Y); else x.moveTo(X, Y); });
      x.stroke(); x.setLineDash([]);
    }
    line('ecc', green, 1.4);
    line('obl', quiet, 1.4, [5, 3]);
    line('total', ink, 2);
  }

  var pending = false;
  function update() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      compute(); labels(); table(); drawAnalemma(); drawCurve();
    });
  }
  ui.e.addEventListener('input', function () { state.eScale = parseFloat(ui.e.value) / E26.e; update(); });
  ui.eps.addEventListener('input', function () { state.epsScale = parseFloat(ui.eps.value) / E26.eps; update(); });
  ui.peri.addEventListener('input', function () { state.periShift = parseFloat(ui.peri.value) - E26.peri; update(); });
  var PRESETS = {
    real: { eScale: 1, epsScale: 1, periShift: 0 },
    tiltonly: { eScale: 0, epsScale: 1, periShift: 0 },
    ecconly: { eScale: 1, epsScale: 0, periShift: 0 },
    june: { eScale: 1, epsScale: 1, periShift: 90 - E26.peri }   // perihelion at the June solstice
  };
  Array.prototype.forEach.call(document.querySelectorAll('button[data-preset]'), function (b) {
    b.addEventListener('click', function () {
      var p = PRESETS[b.getAttribute('data-preset')];
      state.eScale = p.eScale; state.epsScale = p.epsScale; state.periShift = p.periShift;
      syncSliders(); update();
    });
  });
  window.addEventListener('resize', update);
  syncSliders(); update();
})();
