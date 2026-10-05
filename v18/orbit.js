/* v18 · 3D-карусель: вход и поворот прокруткой.
   Вход (по времени, когда блок встал в экран): центральная карточка
   вырастает из маленькой, затем из-за неё выходят соседи.
   Дальше прокрутка поворачивает карусель на следующие карточки.
   Работает в «Отделе продаж» везде, а на телефоне ещё и в «Какая
   у вас ситуация?» (секция получает липкую обёртку и высоту). */
(function () {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("is-static")) return;

  function orbit(sec, stage, cards, dots, fit) {
    var n = cards.length;
    if (!n) return;
    var intro = 0, introStart = 0, played = false;
    var cur = 0, raf = 0;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    function back(t) { var c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
    function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
    function progress() {
      var r = sec.getBoundingClientRect(), span = sec.offsetHeight - window.innerHeight;
      return clamp(-r.top / Math.max(1, span), 0, 1);
    }
    function render() {
      var cw = cards[0].offsetWidth;
      var gap = cw * 0.82;
      var grow = back(clamp(intro / 0.55, 0, 1));
      var spread = ease(clamp((intro - 0.45) / 0.55, 0, 1));
      cards.forEach(function (c, k) {
        var d = k - cur;
        d = ((d + n / 2) % n + n) % n - n / 2;
        var ad = Math.abs(d);
        var x = d * gap * spread;
        var s = (1 - Math.min(ad, 2) * 0.14);
        var ry = clamp(-d * 22, -40, 40) * spread;
        var z = -ad * 120 * spread;
        var o = ad < 0.5 ? 1 : clamp(1.75 - ad, 0, 1) * spread;
        if (ad < 0.5) { s *= 0.32 + 0.68 * grow; o = clamp(intro / 0.12, 0, 1); }
        c.style.transform = "translate3d(" + x.toFixed(1) + "px,0," + z.toFixed(1) + "px) rotateY(" + ry.toFixed(2) + "deg) scale(" + s.toFixed(3) + ")";
        c.style.opacity = o.toFixed(3);
        c.style.zIndex = String(100 - Math.round(ad * 10));
        c.style.filter = ad > 0.5 ? "saturate(" + (1 - Math.min(ad - 0.5, 1) * 0.4) + ")" : "";
      });
      var on = Math.round(cur);
      dots.forEach(function (dt, i) { dt.classList.toggle("on", i === on); });
    }
    function loop(now) {
      raf = 0;
      if (played && intro < 1) { intro = clamp((now - introStart) / 1300, 0, 1); }
      var goal = progress() * (n - 1);
      if (intro < 1) goal = 0;
      cur += (goal - cur) * 0.12;
      if (Math.abs(goal - cur) < 0.001) cur = goal;
      render();
      var r = sec.getBoundingClientRect();
      if ((intro < 1 && played) || Math.abs(goal - cur) > 0.001 || (r.top < window.innerHeight && r.bottom > 0 && !played)) raf = requestAnimationFrame(loop);
    }
    function wake() { if (!raf) raf = requestAnimationFrame(loop); }
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting && !played) { played = true; introStart = performance.now(); sec.classList.add("is-on"); wake(); }
    }, { threshold: 0.35 }).observe(stage);
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", function () { if (fit) fit(); wake(); });
    if (fit) fit();
    render();
  }

  var orb = document.querySelector(".orb");
  if (orb) orbit(orb, orb.querySelector(".orb__stage"), [].slice.call(orb.querySelectorAll(".orb__card")), [].slice.call(orb.querySelectorAll(".orb__dots i")));

})();

/* Линейные 3D-объекты в карточках: тонкие линии и точки, медленное
   вращение. Цвет — текущий цвет текста карточки, акцент — красная точка. */
(function () {
  var canvases = [].slice.call(document.querySelectorAll(".orb__fx"));
  if (!canvases.length) return;
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function ring(P, E, cx, y, cz, r, m, closed) {
    var base = P.length, j;
    for (j = 0; j < m; j++) { var a = j / m * Math.PI * 2; P.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]); }
    if (closed !== false) for (j = 0; j < m; j++) E.push([base + j, base + (j + 1) % m]);
    return base;
  }
  function box(P, E, x, z, w, h, y0) {      // каркас параллелепипеда
    var b = P.length, d = w / 2;
    [[-d, -d], [d, -d], [d, d], [-d, d]].forEach(function (q) { P.push([x + q[0], y0, z + q[1]]); });
    [[-d, -d], [d, -d], [d, d], [-d, d]].forEach(function (q) { P.push([x + q[0], y0 - h, z + q[1]]); });
    for (var k = 0; k < 4; k++) { E.push([b + k, b + (k + 1) % 4]); E.push([b + 4 + k, b + 4 + (k + 1) % 4]); E.push([b + k, b + 4 + k]); }
    return b + 4;
  }
  function build(kind) {
    var P = [], E = [], N = [], path = [], i, j;
    if (kind === "net") {
      // Команда: три яруса ролей. Сверху 1 управляет, в середине 3 продают, внизу 5 квалифицируют
      var tiers = [[-0.7, 0, 1], [0.0, 0.55, 3], [0.7, 0.9, 5]], idx = [];
      tiers.forEach(function (t, ti) {
        ring(P, E, 0, t[0], 0, Math.max(t[1], 0.001), 64, ti > 0).toString();
        var row = [];
        for (j = 0; j < t[2]; j++) { var a = j / t[2] * Math.PI * 2 + ti * 0.4; var p = P.length; P.push([Math.cos(a) * t[1], t[0], Math.sin(a) * t[1]]); N.push(p); row.push(p); }
        idx.push(row);
      });
      idx[1].forEach(function (p) { E.push([idx[0][0], p]); });
      idx[2].forEach(function (p, k) { E.push([idx[1][k % 3], p]); });
      return { P: P, E: E, N: N, accent: idx[0][0], path: null };
    }
    if (kind === "funnel") {
      // Процесс продажи: пять этапов-колец, заявка проходит сверху вниз
      var lv = [0.95, 0.76, 0.58, 0.42, 0.28];
      lv.forEach(function (r, k) { ring(P, E, 0, -0.8 + k * 0.4, 0, r, 64); });
      for (j = 0; j <= 160; j++) { var t = j / 160, a2 = t * Math.PI * 6, r2 = 0.9 - t * 0.66, p2 = P.length; P.push([Math.cos(a2) * r2, -0.8 + t * 1.6, Math.sin(a2) * r2]); path.push(p2); }
      return { P: P, E: E, N: [], accent: path[0], path: path, ghost: true };
    }
    if (kind === "sphere") {
      // Управление: дашборд — сетка и столбики отчётности
      var g = 3, step = 0.5, off = -step * (g - 1) / 2, H = [0.3, 0.5, 0.42, 0.62, 0.78, 0.7, 0.95, 1.15, 1.4];
      for (i = 0; i <= g; i++) { var a3 = P.length; P.push([off - step / 2 + i * step, 0.75, off - step / 2]); P.push([off - step / 2 + i * step, 0.75, off - step / 2 + g * step]); E.push([a3, a3 + 1]);
                                 var b3 = P.length; P.push([off - step / 2, 0.75, off - step / 2 + i * step]); P.push([off - step / 2 + g * step, 0.75, off - step / 2 + i * step]); E.push([b3, b3 + 1]); }
      var tops = [];
      for (i = 0; i < g; i++) for (j = 0; j < g; j++) { tops.push(box(P, E, off + i * step, off + j * step, step * 0.5, H[i * g + j] * 1.1, 0.75)); }
      return { P: P, E: E, N: [], accent: tops[8], path: null };
    }
    // Мотивация и план: ступени вверх и кольцо-цель
    var n = 6, sw = 0.32, sh = 0.26, depth = 0.5, x0 = -0.95, y0 = 0.8;
    for (i = 0; i < n; i++) {
      var x = x0 + i * sw, y = y0 - i * sh, q = P.length;
      P.push([x, y, -depth], [x, y - sh, -depth], [x + sw, y - sh, -depth], [x, y, depth], [x, y - sh, depth], [x + sw, y - sh, depth]);
      E.push([q, q + 1], [q + 1, q + 2], [q + 3, q + 4], [q + 4, q + 5], [q, q + 3], [q + 1, q + 4], [q + 2, q + 5]);
      var c = P.length; P.push([x + sw * 0.5, y - sh, 0]); path.push(c);
    }
    var goal = ring(P, E, x0 + n * sw + 0.05, y0 - n * sh - 0.05, 0, 0.18, 40);
    var gc = P.length; P.push([x0 + n * sw + 0.05, y0 - n * sh - 0.05, 0]); path.push(gc);
    return { P: P, E: E, N: path.slice(0, -1), accent: path[0], path: path, steps: true };
  }

  var items = canvases.map(function (cv) {
    return { cv: cv, ctx: cv.getContext("2d"), m: build(cv.getAttribute("data-shape")), w: 0, h: 0, color: "" };
  });

  function size(it) {
    var r = it.cv.getBoundingClientRect(); var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (w && (w !== it.w || h !== it.h)) { it.w = it.cv.width = w; it.h = it.cv.height = h; }
    it.color = getComputedStyle(it.cv.parentNode).color;
  }

  function draw(it, t) {
    var c = it.ctx, w = it.w, h = it.h; if (!w) return;
    c.clearRect(0, 0, w, h);
    var ry = t * 0.35, rx = -0.42 + Math.sin(t * 0.25) * 0.06, cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
    var S = w * 0.4, ox = w / 2, oy = h / 2, F = 3.2;
    var pr = it.m.P.map(function (p) {
      var x = p[0] * cy - p[2] * sy, z = p[0] * sy + p[2] * cy, y = p[1] * cx - z * sx; z = p[1] * sx + z * cx;
      var k = F / (F + z); return [ox + x * S * k, oy + y * S * k, z];
    });
    c.strokeStyle = it.color; c.fillStyle = it.color; c.lineWidth = Math.max(0.7, dpr * 0.6);
    c.globalAlpha = 0.42; c.beginPath();
    it.m.E.forEach(function (e) { var a = pr[e[0]], b = pr[e[1]]; c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); });
    c.stroke();
    if (it.m.ghost && it.m.path) {           // тонкий пунктир пути заявки
      c.globalAlpha = 0.18; c.setLineDash([2 * dpr, 4 * dpr]); c.beginPath();
      it.m.path.forEach(function (k, n) { var p = pr[k]; if (n) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); c.setLineDash([]);
    }
    c.globalAlpha = 0.85;
    it.m.N.forEach(function (k) { var p = pr[k]; c.beginPath(); c.arc(p[0], p[1], dpr * 2.1, 0, 6.283); c.fill(); });
    var ak = it.m.accent;
    if (it.m.path) {
      var L = it.m.path.length, cyc = it.m.steps ? 5 : 3.6, ph = (t % cyc) / cyc;
      if (it.m.steps) ak = it.m.path[Math.min(L - 1, Math.floor(ph * (L + 1)))];
      else ak = it.m.path[Math.min(L - 1, Math.floor(ph * L))];
    }
    var ac = pr[ak]; c.globalAlpha = 1; c.fillStyle = "#e8231b"; c.shadowColor = "rgba(232,35,27,.7)"; c.shadowBlur = 8 * dpr;
    c.beginPath(); c.arc(ac[0], ac[1], dpr * 2.8, 0, 6.283); c.fill(); c.shadowBlur = 0;
  }

  var sec = document.querySelector(".orb"), visible = false, raf = 0, t0 = performance.now(), last = 0;
  function frame(now) {
    raf = 0; if (!visible || document.hidden) return;
    if (now - last > 32) { last = now; var t = (now - t0) / 1000; items.forEach(function (it) { if (parseFloat(it.cv.parentNode.style.opacity || "1") > 0.02) draw(it, t); }); }
    if (!still) raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf) raf = requestAnimationFrame(frame); }
  items.forEach(size);
  window.addEventListener("resize", function () { items.forEach(size); wake(); });
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { items.forEach(size); wake(); } }, { rootMargin: "100px" }).observe(sec);
  if (still) { items.forEach(function (it) { size(it); draw(it, 1.2); }); }
})();
