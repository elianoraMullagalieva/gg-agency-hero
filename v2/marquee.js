/* ============================================================
   Бегущая строка клиентов · механика Osmo
   Направление инвертируется по скроллу, поверх идёт параллакс.
   Конфиг — на data-атрибутах разметки.
   ============================================================ */
(function () {
  var box = document.querySelector("[data-marquee-speed]");
  if (!box || !window.gsap || !window.ScrollTrigger) return;

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  gsap.registerPlugin(ScrollTrigger);

  var rail  = box.querySelector(".clients__rail");
  var group = rail.firstElementChild;

  var speed       = parseFloat(box.dataset.marqueeSpeed) || 34;
  var dir         = box.dataset.marqueeDirection === "right" ? 1 : -1;
  var scrollSpeed = parseFloat(box.dataset.marqueeScrollSpeed) || 0;

  // Скорость режется на узких экранах — лента не мельтешит
  var w = window.innerWidth;
  var factor = w < 479 ? 0.25 : w < 991 ? 0.5 : 1;
  var duration = speed / factor;

  // Дублируем группу, пока не покроем ширину экрана дважды:
  // так шов никогда не попадает в кадр.
  var need = Math.ceil((window.innerWidth * 2) / group.offsetWidth) + 1;
  for (var i = 0; i < need; i++) rail.appendChild(group.cloneNode(true));

  // Бесконечный ход на xPercent — устойчив к ресайзу и к тому,
  // что шрифт догружается после первого кадра.
  var loop = gsap.to(rail, {
    xPercent: dir * -(100 / (need + 1)),
    ease: "none",
    duration: duration,
    repeat: -1
  });

  // Инверсия направления по скроллу + параллакс поверх хода
  var shift = { v: 0 };
  ScrollTrigger.create({
    trigger: document.body,
    start: "top top",
    end: "bottom bottom",
    onUpdate: function (self) {
      var down = self.direction === 1;
      loop.timeScale(down ? 1 : -1);
      box.dataset.marqueeStatus = down ? "normal" : "inverted";

      if (scrollSpeed) {
        gsap.to(shift, {
          v: (down ? -1 : 1) * scrollSpeed,
          duration: 0.45,
          ease: "power2.out",
          overwrite: true,
          onUpdate: function () {
            gsap.set(rail, { xPercent: "+=0", x: shift.v + "vw" });
          }
        });
      }
    }
  });

  // Наведение притормаживает ленту, а не обрывает движение
  box.addEventListener("pointerenter", function () {
    gsap.to(loop, { timeScale: 0, duration: 0.5, overwrite: true });
  });
  box.addEventListener("pointerleave", function () {
    gsap.to(loop, { timeScale: 1, duration: 0.6, overwrite: true });
  });
})();
