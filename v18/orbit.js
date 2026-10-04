/* v18 · «Отдел продаж»: вход и карусель.
   Вход (по времени, когда блок встал в экран): центральная карточка
   вырастает из маленькой, затем из-за неё выходят соседи.
   Дальше прокрутка поворачивает карусель на следующие карточки. */
(function () {
  var sec = document.querySelector(".orb");
  if (!sec) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("is-static")) return;
  var cards = [].slice.call(sec.querySelectorAll(".orb__card"));
  var dots = [].slice.call(sec.querySelectorAll(".orb__dots i"));
  var n = cards.length;
  var intro = 0, introStart = 0, played = false;   // 0..1
  var cur = 0, raf = 0;

  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function back(t) { var c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function progress() {
    var r = sec.getBoundingClientRect(), span = sec.offsetHeight - window.innerHeight;
    return clamp(-r.top / Math.max(1, span), 0, 1);
  }

  function render() {
    var stage = sec.querySelector(".orb__stage");
    var cw = cards[0].offsetWidth;
    var gap = cw * 0.82;
    // фазы входа: 0–0.55 — рост центральной, 0.45–1 — выход соседей
    var grow = back(clamp(intro / 0.55, 0, 1));
    var spread = ease(clamp((intro - 0.45) / 0.55, 0, 1));
    cards.forEach(function (c, k) {
      var d = k - cur;                       // расстояние до центра в карточках
      d = ((d + n / 2) % n + n) % n - n / 2;  // по кругу: у первой есть сосед слева
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
    // карусель включается после входа; до этого стоит на первой
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
  }, { threshold: 0.35 }).observe(sec.querySelector(".orb__stage"));
  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("resize", wake);
  render();
})();

/* Линейные 3D-объекты в карточках: тонкие линии и точки, медленное
   вращение. Цвет — текущий цвет текста карточки, акцент — красная точка. */
(function () {
  var canvases = [].slice.call(document.querySelectorAll(".orb__fx"));
  if (!canvases.length) return;
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function build(kind) {
    var P = [], E = [], i, j, a, b;
    if (kind === "funnel") {                       // кольца, сужающиеся книзу
      for (i = 0; i < 9; i++) {
        var y = -0.8 + i * 0.2, r = 0.95 - i * 0.075, base = P.length, m = 48;
        for (j = 0; j < m; j++) { a = j / m * Math.PI * 2; P.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
        for (j = 0; j < m; j++) E.push([base + j, base + (j + 1) % m]);
      }
    } else if (kind === "sphere") {                // сфера из точек + экватор
      var n = 380, g = Math.PI * (3 - Math.sqrt(5));
      for (i = 0; i < n; i++) { var yy = 1 - (i / (n - 1)) * 2, rr = Math.sqrt(1 - yy * yy), th = g * i; P.push([Math.cos(th) * rr * 0.95, yy * 0.95, Math.sin(th) * rr * 0.95]); }
      var eb = P.length; for (j = 0; j < 64; j++) { a = j / 64 * Math.PI * 2; P.push([Math.cos(a) * 1.08, 0, Math.sin(a) * 1.08]); }
      for (j = 0; j < 64; j++) E.push([eb + j, eb + (j + 1) % 64]);
      var mb = P.length; for (j = 0; j < 64; j++) { a = j / 64 * Math.PI * 2; P.push([0, Math.cos(a) * 1.08, Math.sin(a) * 1.08]); }
      for (j = 0; j < 64; j++) E.push([mb + j, mb + (j + 1) % 64]);
    } else if (kind === "net") {                   // сеть узлов: роли и связи
      var cnt = 42, gg = Math.PI * (3 - Math.sqrt(5));
      for (i = 0; i < cnt; i++) { var uy = 1 - (i / (cnt - 1)) * 2, us = Math.sqrt(1 - uy * uy), ut = gg * i, ur = i % 3 ? 0.95 : 0.55; P.push([Math.cos(ut) * us * ur, uy * ur, Math.sin(ut) * us * ur]); }
      for (i = 0; i < P.length; i++) {
        var near = [];
        for (j = 0; j < P.length; j++) if (j !== i) { var ddx = P[i][0] - P[j][0], ddy = P[i][1] - P[j][1], ddz = P[i][2] - P[j][2]; near.push([ddx * ddx + ddy * ddy + ddz * ddz, j]); }
        near.sort(function (x, y) { return x[0] - y[0]; });
        for (var q2 = 0; q2 < 3; q2++) if (i < near[q2][1]) E.push([i, near[q2][1]]);
      }
    } else {                                       // двойная спираль со ступенями
      var st = 120, b1 = 0, b2 = st + 1;
      for (i = 0; i <= st; i++) { var ht = i / st, ha = ht * Math.PI * 4, hr = 0.42 + ht * 0.4; P.push([Math.cos(ha) * hr, 0.9 - ht * 1.8, Math.sin(ha) * hr]); if (i) E.push([b1 + i - 1, b1 + i]); }
      for (i = 0; i <= st; i++) { var ht2 = i / st, ha2 = ht2 * Math.PI * 4 + Math.PI, hr2 = 0.42 + ht2 * 0.4; P.push([Math.cos(ha2) * hr2, 0.9 - ht2 * 1.8, Math.sin(ha2) * hr2]); if (i) E.push([b2 + i - 1, b2 + i]); }
      for (i = 0; i <= st; i += 5) E.push([b1 + i, b2 + i]);
    }
    return { P: P, E: E, dots: kind === "sphere" || kind === "net", accent: kind === "helix" ? 0 : (kind === "funnel" ? P.length - 1 : (kind === "net" ? 21 : 3)) };
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
    if (it.m.dots) pr.forEach(function (p) { c.globalAlpha = 0.25 + 0.55 * (1 - (p[2] + 1.1) / 2.2); c.beginPath(); c.arc(p[0], p[1], dpr * 1.05, 0, 6.283); c.fill(); });
    var ac = pr[it.m.accent]; c.globalAlpha = 1; c.fillStyle = "#e8231b"; c.shadowColor = "rgba(232,35,27,.7)"; c.shadowBlur = 8 * dpr;
    c.beginPath(); c.arc(ac[0], ac[1], dpr * 2.6, 0, 6.283); c.fill(); c.shadowBlur = 0;
  }

  var sec = document.querySelector(".orb"), visible = false, raf = 0, t0 = performance.now(), last = 0;
  function frame(now) {
    raf = 0; if (!visible || document.hidden) return;
    if (now - last > 32) { last = now; var t = (now - t0) / 1000; items.forEach(function (it) { if (parseFloat(it.cv.parentNode.style.opacity || "1") > 0.02) draw(it, t + it.m.P.length * 0.01); }); }
    if (!still) raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf) raf = requestAnimationFrame(frame); }
  items.forEach(size);
  window.addEventListener("resize", function () { items.forEach(size); wake(); });
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { items.forEach(size); wake(); } }, { rootMargin: "100px" }).observe(sec);
  if (still) { items.forEach(function (it) { size(it); draw(it, 1.2); }); }
})();
