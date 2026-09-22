(function () {
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); }
    });
  }, { threshold: 0.3 });
  document.querySelectorAll("[data-anim]").forEach(function (el) { io.observe(el); });
})();
