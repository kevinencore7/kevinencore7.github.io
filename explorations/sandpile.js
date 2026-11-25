// The identity of the Abelian sandpile group on an N x N grid, computed in the browser.
// Same arithmetic as my C program: sink all round the edge, e = stab(6 - stab(6)).
// Plain JS, no dependencies, no network. Kevin Encore, MIT licence.
'use strict';
(function (root) {

  var MAXN = 160;   // measured: about 1 s here, 4 s with the CPU slowed 4x

  // One sweep over the grid, toppling every cell with 4 or more grains as many times
  // as it can at once. Returns the number of topples. Stabilising is complete when a
  // sweep topples nothing; the result doesn't depend on the order (that is the
  // "Abelian" in the name).
  function sweep(h, N) {
    var t, v, k, i, j, tops = 0;
    for (i = 0; i < N; i++) {
      k = i * N;
      for (j = 0; j < N; j++, k++) {
        v = h[k];
        if (v < 4) continue;
        t = v >> 2;
        h[k] = v & 3;
        tops += t;
        if (i > 0) h[k - N] += t;
        if (i < N - 1) h[k + N] += t;
        if (j > 0) h[k - 1] += t;
        if (j < N - 1) h[k + 1] += t;
      }
    }
    return tops;
  }

  function stab(h, N) {
    var tops = 0, t;
    while ((t = sweep(h, N)) > 0) tops += t;
    return tops;
  }

  // A job that computes e in slices, so the page stays responsive.
  // step(ms) works for about ms milliseconds and returns true when e is finished.
  function Job(N) {
    this.N = N;
    this.h = new Int32Array(N * N);
    this.h.fill(6);
    this.phase = 0;          // 0: stabilising 6;  1: stabilising 6 - stab(6);  2: done
    this.topples = 0;
  }
  Job.prototype.step = function (ms) {
    var now = typeof performance !== 'undefined' ? function () { return performance.now(); } : Date.now;
    var t0 = now(), t, k, h = this.h, n = this.N * this.N;
    while (this.phase < 2) {
      t = sweep(h, this.N);
      this.topples += t;
      if (t === 0) {
        if (this.phase === 0) for (k = 0; k < n; k++) h[k] = 6 - h[k];
        this.phase++;
      }
      if (ms !== undefined && now() - t0 >= ms) break;
    }
    return this.phase === 2;
  };

  function identity(N) {
    var job = new Job(N);
    job.step();
    return { e: job.h, topples: job.topples };
  }

  // The largest centred k x k block of 2s, k with the parity of N; for odd N the centre
  // row and column are left out of the test (the odd-N identity has a cross of 1s with a
  // 0 at the centre). The same rule as squarewidth.c, except that at N = 1 this finds no
  // square (the identity there is a single 0) where squarewidth.c would report 1.
  function square(e, N) {
    var best = 0, k, o, ok, i, j, c = N >> 1;
    for (k = (N % 2 ? 3 : 2); k <= N; k += 2) {   // odd k = 1 would be the centre alone, no 2s at all
      o = (N - k) >> 1; ok = true;
      for (i = o; i < o + k && ok; i++)
        for (j = o; j < o + k; j++) {
          if (N % 2 && (i === c || j === c)) continue;
          if (e[i * N + j] !== 2) { ok = false; break; }
        }
      if (!ok) break;
      best = k;
    }
    var cross = null;
    if (N % 2 && best) {
      cross = [0, 0, 0, 0]; o = (N - best) >> 1;
      for (i = o; i < o + best; i++) { cross[e[c * N + i]]++; cross[e[i * N + c]]++; }
      cross[e[c * N + c]]--;
    }
    return { k: best, cross: cross, centre: e[c * N + c] };
  }

  // stab(e + e) = e: the defining property of an identity, checked on the result.
  function selfTest(e, N) {
    var d = new Int32Array(N * N), k;
    for (k = 0; k < N * N; k++) d[k] = 2 * e[k];
    stab(d, N);
    for (k = 0; k < N * N; k++) if (d[k] !== e[k]) return false;
    return true;
  }

  var core = { MAXN: MAXN, sweep: sweep, stab: stab, Job: Job, identity: identity, square: square, selfTest: selfTest };
  if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }

  // ---------- page ----------
  var doc = root.document;
  if (!doc) return;
  var $ = function (id) { return doc.getElementById(id); };
  var PAL = [[29, 39, 51], [93, 102, 114], [217, 205, 180], [46, 107, 94]];  // ink, quiet ink, pale paper, verdigris
  var cv = $('pile'), ctx = cv.getContext('2d'), job = null, timer = 0, lastE = null;

  function draw(h, N) {
    var img = ctx.createImageData(N, N), d = img.data, k, v, p;
    for (k = 0; k < N * N; k++) {
      v = h[k];
      p = v > 3 ? [150, 143, 132] : PAL[v];   // grey: a cell still holding 4 or more, mid-computation
      d[4 * k] = p[0]; d[4 * k + 1] = p[1]; d[4 * k + 2] = p[2]; d[4 * k + 3] = 255;
    }
    cv.width = N; cv.height = N;
    ctx.putImageData(img, 0, 0);
  }

  function fmt(x) { return x.toLocaleString('en-GB'); }

  function report(N, e, tops, ms) {
    var counts = [0, 0, 0, 0], k;
    for (k = 0; k < N * N; k++) counts[e[k]]++;
    var sq = square(e, N), ok = selfTest(e, N);
    var s = 'N = ' + N + ': ' + fmt(tops) + ' topples (' + (tops / Math.pow(N, 4)).toFixed(3) + ' N⁴), ' +
      (ms / 1000).toFixed(2) + ' s in this browser. ';
    s += 'Cells holding 0, 1, 2, 3 grains: ' + counts.map(fmt).join(', ') + '. ';
    s += 'Check stab(e + e) = e: ' + (ok ? 'holds.' : 'FAILS.');
    $('stats').textContent = s;
    var q;
    if (sq.k === 0) q = 'No centred square of 2s at this size.';
    else {
      q = 'Central square of 2s: side ' + sq.k + ' = ' + (sq.k / N).toFixed(4) + ' N. 5N/12 would be ' +
        (5 * N / 12).toFixed(2) + ', and 0.40 N (Dhar and co-authors’ 4L/5) ' + (0.4 * N).toFixed(1) + '.';
      if (sq.cross) {
        var other = sq.cross[0] + sq.cross[2] + sq.cross[3] - (sq.centre === 1 ? 0 : 1);
        q += ' Through its middle runs a cross, left out of the test: ' + sq.cross[1] + ' cells holding 1' +
          (other ? ' and ' + other + ' holding something else' : '') + ', with ' + sq.centre + ' at the centre.';
      }
    }
    $('square').textContent = q;
  }

  function start() {
    var N = Math.round(+$('nnum').value);
    if (!(N >= 1)) N = 1;
    if (N > MAXN) N = MAXN;
    $('nnum').value = N; $('n').value = N;
    if (timer) clearTimeout(timer);
    job = new Job(N);
    var t0 = performance.now();
    $('stats').textContent = 'Computing…';
    $('square').textContent = '';
    $('go').disabled = true;
    (function tick() {
      var done = job.step(40);
      draw(job.h, N);
      if (!done) {
        $('stats').textContent = 'Computing: ' + (job.phase === 0 ? 'stabilising 6 on every cell' : 'stabilising 6 minus that') +
          ', ' + fmt(job.topples) + ' topples so far…';
        timer = setTimeout(tick, 0);
      } else {
        timer = 0; $('go').disabled = false;
        lastE = job.h;
        report(N, job.h, job.topples, performance.now() - t0);
        $('pile').setAttribute('data-n', N);
      }
    })();
  }

  $('n').addEventListener('input', function () { $('nnum').value = $('n').value; });
  $('nnum').addEventListener('change', function () { $('n').value = $('nnum').value; });
  $('n').addEventListener('change', start);
  $('nnum').addEventListener('change', start);
  $('go').addEventListener('click', start);
  Array.prototype.forEach.call(doc.querySelectorAll('button[data-n]'), function (b) {
    b.addEventListener('click', function () { $('nnum').value = b.getAttribute('data-n'); start(); });
  });
  root.sandpileLast = function () { return lastE; };
  start();
})(typeof window !== 'undefined' ? window : this);
