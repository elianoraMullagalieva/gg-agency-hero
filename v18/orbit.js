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
