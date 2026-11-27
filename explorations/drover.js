// Drover: play against the perfect computer. Plain JS, no dependencies, no network.
// The rules engine and solver are a port of drover.py (same move order, same choice of
// move for the computer). A position is {b, x, o, m}: b is the burned cells as a 25-bit
// number (bit i = cell i), x and o are the pieces' cells, m is the mover, 'X' or 'O'.
// Cell i = row * 5 + col, row 0 = rank 1, col 0 = file a. The mover moves the other piece.
'use strict';
var Drover = (function () {
  var N = 5, FILES = 'abcde';
  var START = { v1: ['c1', 'c5'], v2: ['a1', 'e1'] };
  var NB = [], i;
  for (i = 0; i < N * N; i++) {
    var r = Math.floor(i / N), c = i % N, out = [], dr, dc;
    for (dr = -1; dr <= 1; dr++) for (dc = -1; dc <= 1; dc++)
      if ((dr || dc) && r + dr >= 0 && r + dr < N && c + dc >= 0 && c + dc < N) out.push((r + dr) * N + c + dc);
    NB.push(out);
  }
  function cell(s) {
    var col = FILES.indexOf(s[0]), row = parseInt(s.slice(1), 10) - 1;
    if (col < 0 || !(row >= 0 && row < N)) throw new Error('off the board: ' + s);
    return row * N + col;
  }
  function name(k) { return FILES[k % N] + (Math.floor(k / N) + 1); }
  function start(v) { var s = START[v || 'v1']; return { b: 0, x: cell(s[0]), o: cell(s[1]), m: 'X' }; }
  function burned(b, k) { return Math.floor(b / Math.pow(2, k)) % 2 === 1; }
  function steps(b, frm, other) {
    return NB[frm].filter(function (j) { return !burned(b, j) && j !== other; });
  }
  function legalMoves(p) { return p.m === 'X' ? steps(p.b, p.o, p.x) : steps(p.b, p.x, p.o); }
  function play(p, mv) {
    if (legalMoves(p).indexOf(mv) < 0) throw new Error('illegal move ' + name(mv));
    if (p.m === 'X') return { b: p.b + Math.pow(2, p.o), x: p.x, o: mv, m: 'O' };
    return { b: p.b + Math.pow(2, p.x), x: mv, o: p.o, m: 'X' };
  }
  function winner(p) { return legalMoves(p).length ? null : p.m; }
  function exitsAfter(p, mv) {
    var q = play(p, mv);
    return legalMoves({ b: q.b, x: q.x, o: q.o, m: p.m }).length;
  }
  function orderedMoves(p) {
    return legalMoves(p).map(function (mv) { return [exitsAfter(p, mv), mv]; })
      .sort(function (a, z) { return a[0] - z[0] || a[1] - z[1]; })
      .map(function (e) { return e[1]; });
  }
  // The mover is implied by the number of burned cells, so b, x and o make the key.
  var memo = new Map();
  function key(p) { return p.b + p.x * 33554432 + p.o * 1073741824; }  // 2^25, 2^30
  function wins(p) {
    var k = key(p), v = memo.get(k);
    if (v !== undefined) return v;
    var moves = orderedMoves(p);
    v = moves.length === 0;
    for (var j = 0; !v && j < moves.length; j++) if (!wins(play(p, moves[j]))) v = true;
    memo.set(k, v);
    return v;
  }
  function computerMove(p) {
    var moves = orderedMoves(p), j;
    for (j = 0; j < moves.length; j++) if (!wins(play(p, moves[j]))) return moves[j];
    var best = moves[0], bestN = Infinity;
    moves.forEach(function (mv) {
      var ch = play(p, mv), n = legalMoves(ch).filter(function (r) { return !wins(play(ch, r)); }).length;
      if (n < bestN) { bestN = n; best = mv; }
    });
    return best;
  }
  return { N: N, cell: cell, name: name, start: start, burned: burned, legalMoves: legalMoves,
    play: play, winner: winner, orderedMoves: orderedMoves, wins: wins, computerMove: computerMove,
    memoSize: function () { return memo.size; } };
})();

if (typeof module === 'object' && module.exports) module.exports = Drover;

if (typeof document !== 'undefined') (function () {
  var D = Drover, $ = function (id) { return document.getElementById(id); };
  var board = $('board'), status = $('status'), record = $('record'), verdict = $('verdict');
  var variant = 'v2', human = 'X', pos, hist, cells = [], busy = false, refocus = false;
  var k;
  for (k = 0; k < 25; k++) {
    var b = document.createElement('button'), row = 4 - Math.floor(k / 5), col = k % 5, idx = row * 5 + col;
    b.type = 'button'; b.dataset.i = idx;
    b.addEventListener('click', onCell);
    board.appendChild(b); cells[idx] = b;
  }
  function other(s) { return s === 'X' ? 'O' : 'X'; }
  function draw() {
    var moves = D.winner(pos) || busy || pos.m !== human ? [] : D.legalMoves(pos);
    for (var i = 0; i < 25; i++) {
      var c = cells[i], t = i === pos.x ? 'X' : i === pos.o ? 'O' : '', burnt = D.burned(pos.b, i);
      var legal = moves.indexOf(i) >= 0;
      c.textContent = t;
      c.className = (t ? 'tok tok-' + t : '') + (burnt ? ' burnt' : '') + (legal ? ' legal' : '');
      c.disabled = !legal;
      c.setAttribute('aria-label', D.name(i) + (t ? ', ' + t + "'s piece" : burnt ? ', burned' : ', clear') +
        (legal ? ', move ' + other(human) + ' here' : ''));
    }
    var w = D.winner(pos);
    if (w) {
      status.textContent = other(w) + ' is stranded. ' + w + ' wins' + (w === human ? ': you win.' : ': the computer wins.');
    } else if (busy) {
      status.textContent = 'The computer (' + pos.m + ') is thinking…';
    } else if (pos.m === human) {
      status.textContent = 'Your move: you are ' + human + ', so move ' + other(human) + '’s piece to one of the marked cells.';
    }
    record.textContent = hist.length ? hist.map(function (h, j) { return (j + 1) + '.' + (j % 2 ? 'O' : 'X') + h; }).join(' ') : '—';
  }
  function computer() {
    busy = true; draw();
    setTimeout(function () {
      var t0 = performance.now(), mv = D.computerMove(pos), ms = performance.now() - t0;
      if (ms > 50) verdict.textContent = 'The computer’s first look took ' + Math.round(ms) + ' ms (' +
        D.memoSize().toLocaleString('en') + ' positions solved so far).';
      hist.push(D.name(mv)); pos = D.play(pos, mv); busy = false; draw();
      // The cell just played is disabled now, so put a keyboard player back on the board.
      var first = board.querySelector('button.legal');
      if (refocus && first) first.focus({ preventScroll: true });
      refocus = false;
    }, 250);
  }
  function onCell(e) {
    if (busy || D.winner(pos) || pos.m !== human) return;
    var mv = +e.currentTarget.dataset.i;
    if (D.legalMoves(pos).indexOf(mv) < 0) return;
    refocus = document.activeElement === e.currentTarget;
    hist.push(D.name(mv)); pos = D.play(pos, mv); draw();
    if (!D.winner(pos)) computer();
  }
  function newGame() {
    variant = document.querySelector('input[name="variant"]:checked').value;
    human = document.querySelector('input[name="side"]:checked').value;
    pos = D.start(variant); hist = []; busy = false; verdict.textContent = '';
    draw();
    if (pos.m !== human) computer();
  }
  $('new').addEventListener('click', newGame);
  newGame();
})();
