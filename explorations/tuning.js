// How well n equal divisions of the octave approximate just intervals, n = 1..72.
// Plain script, no dependencies, nothing loaded from elsewhere. MIT licence.
// The arithmetic is the same as the note's Python (patent val, minimax error in cents).
'use strict';
(function () {
  var NMAX = 72;
  var PRIMES = [2, 3, 5, 7];
  // Each interval as [name, numerator, denominator, exponents of 2, 3, 5, 7].
  var IV = [
    ['fifth', 3, 2, [-1, 1, 0, 0]],
    ['major third', 5, 4, [-2, 0, 1, 0]],
    ['minor third', 6, 5, [1, 1, -1, 0]],
    ['harmonic seventh', 7, 4, [-2, 0, 0, 1]],
    ['septimal tritone', 7, 5, [0, 0, -1, 1]],
    ['septimal minor third', 7, 6, [-1, -1, 0, 1]]
  ];
  var SET5 = [0, 1, 2], SET7 = [0, 1, 2, 3, 4, 5];

  function cents(a, b) { return 1200 * Math.log2(a / b); }
  // Patent val: each prime to its nearest step.
  function val(n) { return PRIMES.map(function (p) { return Math.round(n * Math.log2(p)); }); }
  function steps(v, ex) { var s = 0; for (var i = 0; i < 4; i++) s += ex[i] * v[i]; return s; }

  // Everything about one n: per-interval steps and errors, set errors, consistency.
  function edo(n) {
    var v = val(n), step = 1200 / n;
    var iv = IV.map(function (q) {
      var just = cents(q[1], q[2]), k = steps(v, q[3]), e = k * step - just;
      var direct = Math.round(n * just / 1200);
      return { name: q[0], ratio: q[1] + '/' + q[2], just: just, steps: k, cents: k * step, err: e, rel: Math.abs(e) / step, consistent: k === direct };
    });
    function set(S) {
      var m = 0, c = true;
      S.forEach(function (i) { m = Math.max(m, Math.abs(iv[i].err)); c = c && iv[i].consistent; });
      return { max: m, rel: m / step, consistent: c };
    }
    return { n: n, step: step, val: v, iv: iv, s3: { max: Math.abs(iv[0].err), rel: iv[0].rel }, s5: set(SET5), s7: set(SET7) };
  }

  var ALL = [];
  for (var n = 1; n <= NMAX; n++) ALL.push(edo(n));

  // n whose absolute error beats every smaller n.
  function records(key) {
    var best = Infinity, out = [];
    ALL.forEach(function (r) { if (r[key].max < best - 1e-12) { best = r[key].max; out.push(r.n); } });
    return out;
  }
  // Rank by relative error among n = 5..72 (1 = best), as in the note.
  function rank(key, n) {
    var ns = ALL.filter(function (r) { return r.n >= 5; }).sort(function (a, b) { return a[key].rel - b[key].rel; });
    for (var i = 0; i < ns.length; i++) if (ns[i].n === n) return i + 1;
    return null;
  }

  var core = { edo: edo, ALL: ALL, records: records, rank: rank, NMAX: NMAX };
  if (typeof module === 'object' && module.exports) { module.exports = core; return; }

  // ---------- page ----------
  function $(id) { return document.getElementById(id); }
  var REC = { s3: records('s3'), s5: records('s5'), s7: records('s7') };
  var ui = { n: $('n'), nnum: $('nnum'), set: $('set'), scale: $('scale') };

  function sgn(x, d) { return (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d); }
  function fit(cv) {
    var r = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * r) || cv.height !== Math.round(h * r)) { cv.width = Math.round(w * r); cv.height = Math.round(h * r); }
    var x = cv.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0);
    return { x: x, w: w, h: h };
  }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000'; }
  function curN() { var v = parseInt(ui.n.value, 10); return Math.min(NMAX, Math.max(1, isNaN(v) ? 12 : v)); }
  function curKey() { return ui.set.value; }

  function table(r) {
    var rows = r.iv.map(function (q, i) {
      var tr = document.createElement('tr');
      if (i === 3) tr.className = 'seven';
      var first = document.createElement('td'), nm = document.createElement('span');
      first.textContent = q.ratio; nm.className = 'nm'; nm.textContent = q.name; first.appendChild(nm); tr.appendChild(first);
      [q.just.toFixed(2), String(q.steps), q.cents.toFixed(2), sgn(q.err, 2), q.rel.toFixed(3) + (q.consistent ? '' : ' *')]
        .forEach(function (t) { var td = document.createElement('td'); td.textContent = t; td.className = 'n'; tr.appendChild(td); });
      return tr;
    });
    var tb = $('ivrows'); tb.textContent = '';
    rows.forEach(function (tr) { tb.appendChild(tr); });
  }

  function summary(r) {
    function line(key, label) {
      var s = r[key], rk = r.n >= 5 ? rank(key, r.n) : null, rec = REC[key].indexOf(r.n) >= 0;
      return label + ': worst error ' + s.max.toFixed(2) + ' c, ' + s.rel.toFixed(3) + ' of a step' +
        (rk ? ', rank ' + rk + ' of 68 by that fraction' : '') + (rec ? ', a record' : '') +
        (key !== 's3' && !s.consistent ? ', not consistent' : '') + '.';
    }
    $('sum3').textContent = line('s3', 'Fifth alone');
    $('sum5').textContent = line('s5', '5-limit');
    $('sum7').textContent = line('s7', '7-limit');
    $('stepval').textContent = r.n + ' notes · step ' + r.step.toFixed(2) + ' c · val ⟨' + r.val.join(' ') + ']';
  }

  function drawPlot() {
    var f = fit($('plot')), x = f.x, w = f.w, h = f.h, key = curKey(), logy = ui.scale.value === 'abs';
    var L = 56, R = 10, T = 14, B = 30, pw = w - L - R, ph = h - T - B;
    var ink = css('--ink'), quiet = css('--quiet'), rule = css('--rule'), green = css('--verdigris');
    x.clearRect(0, 0, w, h);
    x.font = '12px Georgia, serif'; x.textBaseline = 'middle';
    function X(n) { return L + (n - 0.5) / NMAX * pw; }
    // y: absolute error on a log scale (0.05 to 1000 c), or fraction of a step (0 to 0.5+).
    var Y = logy
      ? function (v) { var lo = Math.log10(0.05), hi = Math.log10(1000); return T + ph * (1 - (Math.log10(Math.max(v, 0.05)) - lo) / (hi - lo)); }
      : function (v) { return T + ph * (1 - Math.min(v, 1) / 1); };
    x.strokeStyle = rule; x.fillStyle = quiet; x.lineWidth = 1; x.textAlign = 'right';
    var ticks = logy ? [0.1, 1, 10, 100, 1000] : [0, 0.25, 0.5, 0.75, 1];
    ticks.forEach(function (t) {
      var y = Math.round(Y(t)) + 0.5;
      x.beginPath(); x.moveTo(L, y); x.lineTo(L + pw, y); x.stroke();
      x.fillText(logy ? (t < 1 ? t.toFixed(1) : String(t)) : t.toFixed(2), L - 5, y);
    });
    x.save(); x.translate(10, T + ph / 2); x.rotate(-Math.PI / 2); x.textAlign = 'center';
    x.fillText(logy ? 'worst error, cents' : 'worst error ÷ step', 0, 0); x.restore();
    x.textAlign = 'center'; x.textBaseline = 'top';
    for (var t = 6; t <= NMAX; t += 6) x.fillText(String(t), X(t), T + ph + 6);
    if (!logy) { // a random n would average 0.25 of a step on a single interval
      x.setLineDash([4, 3]); x.strokeStyle = quiet; x.beginPath(); x.moveTo(L, Y(0.25)); x.lineTo(L + pw, Y(0.25)); x.stroke(); x.setLineDash([]);
    }
    var sel = curN(), bw = Math.max(1, pw / NMAX - 2);
    ALL.forEach(function (r) {
      var v = logy ? r[key].max : r[key].rel, rec = REC[key].indexOf(r.n) >= 0;
      x.fillStyle = r.n === sel ? ink : rec ? green : rule;
      var y = Y(v); x.fillRect(X(r.n) - bw / 2, y, bw, T + ph - y);
    });
    x.textBaseline = 'bottom'; x.fillStyle = green; x.font = '11px Georgia, serif';
    // Label records from 5 up, skipping one that would touch the label before it.
    var lastRight = -Infinity;
    REC[key].forEach(function (n) {
      if (n < 5) return;
      var t = String(n), half = x.measureText(t).width / 2 + 1;
      if (X(n) - half < lastRight) return;
      x.fillText(t, X(n), Y(logy ? ALL[n - 1][key].max : ALL[n - 1][key].rel) - 2); lastRight = X(n) + half;
    });
    x.strokeStyle = ink; x.beginPath(); x.moveTo(L, T + ph + 0.5); x.lineTo(L + pw, T + ph + 0.5); x.stroke();
  }

  function recLists() {
    $('rec3').textContent = REC.s3.join(', ');
    $('rec5').textContent = REC.s5.join(', ');
    $('rec7').textContent = REC.s7.join(', ');
  }

  // ---------- sound ----------
  // Nothing is made until a button is pressed; the gain can't go above CAP.
  var CAP = 0.25, ac = null, master = null, voices = [];
  var ROOT = 220 * Math.pow(2, 3 / 12); // middle C, 261.63 Hz (A3 = 220 Hz plus three 12-EDO semitones)
  function audio() {
    if (!ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { $('audionote').textContent = 'This browser has no Web Audio, so the triads can’t play.'; return null; }
      ac = new AC(); master = ac.createGain(); master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    master.gain.value = Math.min(CAP, parseFloat($('vol').value) * CAP);
    return ac;
  }
  function stop() {
    voices.forEach(function (o) { try { o.stop(); } catch (e) { /* already stopped */ } });
    voices = [];
  }
  // One note: a sine, or six harmonics at 1/k, so mistuned thirds beat audibly.
  function note(freq, t0, dur, rich) {
    var g = ac.createGain(), parts = rich ? 6 : 1, norm = 0;
    for (var k = 1; k <= parts; k++) norm += 1 / k;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.3 / norm, t0 + 0.04);
    g.gain.setValueAtTime(0.3 / norm, t0 + dur - 0.25);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    g.connect(master);
    for (k = 1; k <= parts; k++) {
      var o = ac.createOscillator(), a = ac.createGain();
      o.type = 'sine'; o.frequency.value = freq * k; a.gain.value = 1 / k;
      o.connect(a); a.connect(g); o.start(t0); o.stop(t0 + dur + 0.02);
      voices.push(o);
    }
  }
  function triad(which, t0) {
    var r = ALL[curN() - 1], f;
    if (which === 'just') f = [1, 5 / 4, 3 / 2];
    else f = [0, r.iv[1].steps, r.iv[0].steps].map(function (k) { return Math.pow(2, k / r.n); });
    var rich = $('timbre').value === 'rich';
    f.forEach(function (m) { note(ROOT * m, t0, 2.2, rich); });
    return f.map(function (m) { return (ROOT * m).toFixed(2); }).join(', ');
  }
  function play(which) {
    if (!audio()) return;
    stop();
    var t = ac.currentTime + 0.05, r = ALL[curN() - 1], msg;
    if (which === 'both') {
      triad('just', t); triad('edo', t + 2.5);
      msg = 'Just, then ' + r.n + '-EDO.';
    } else {
      msg = (which === 'just' ? 'Just 4:5:6' : r.n + '-EDO') + ': ' + triad(which, t) + ' Hz.';
    }
    $('audionote').textContent = msg;
  }

  function update(from) {
    if (from === 'num') ui.n.value = ui.nnum.value;
    var n = curN(); ui.n.value = n; ui.nnum.value = n;
    var r = ALL[n - 1];
    table(r); summary(r); drawPlot();
  }

  ui.n.addEventListener('input', function () { update('range'); });
  ui.nnum.addEventListener('change', function () { update('num'); });
  ui.set.addEventListener('change', drawPlot);
  ui.scale.addEventListener('change', drawPlot);
  Array.prototype.forEach.call(document.querySelectorAll('[data-n]'), function (b) {
    b.addEventListener('click', function () { ui.n.value = b.getAttribute('data-n'); update('range'); });
  });
  $('pjust').addEventListener('click', function () { play('just'); });
  $('pedo').addEventListener('click', function () { play('edo'); });
  $('pboth').addEventListener('click', function () { play('both'); });
  $('pstop').addEventListener('click', function () { stop(); $('audionote').textContent = 'Stopped.'; });
  $('vol').addEventListener('input', function () { if (master) master.gain.value = Math.min(CAP, parseFloat($('vol').value) * CAP); });
  window.addEventListener('resize', drawPlot);
  recLists();
  update('range');
})();
