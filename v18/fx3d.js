/* ============================================================
   Хромовые объекты на Three.js r128. Модели не скачиваются —
   геометрия собирается кодом, отражения даёт нарисованная на холсте
   «студия»: тёмная комната, белые софтбоксы и красный свет снизу.
   Три фигуры под смысл блоков:
     funnel — воронка из колец, внизу красная капля (деньги из воронки);
     gyro   — три кольца вокруг ядра (система, которая держит себя сама);
     coil   — пружина, сжимается от прокрутки (рост по плану).
   Считается только пока объект на экране; при reduced-motion стоит.
   ============================================================ */
(function () {
  "use strict";
  if (!window.THREE) return;
  var THREE = window.THREE;
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function studio() {
    var c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    var g = c.getContext("2d");
    g.fillStyle = "#060606"; g.fillRect(0, 0, 1024, 512);
    function box(x, y, w, h, a) {
      var gr = g.createLinearGradient(x, y, x, y + h);
      gr.addColorStop(0, "rgba(255,255,255,0)");
      gr.addColorStop(0.25, "rgba(255,255,255," + a + ")");
      gr.addColorStop(0.75, "rgba(255,255,255," + a + ")");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(x, y, w, h);
    }
    box(60, 70, 230, 150, 1);        // ключевой софтбокс
    box(430, 40, 120, 110, 0.75);
    box(700, 110, 260, 90, 0.9);
    box(300, 260, 90, 60, 0.35);
    // красный свет снизу — наш акцент, только в отражении
    var r = g.createRadialGradient(560, 520, 10, 560, 520, 420);
    r.addColorStop(0, "rgba(231,26,33,0.95)");
    r.addColorStop(0.45, "rgba(172,12,15,0.5)");
    r.addColorStop(1, "rgba(172,12,15,0)");
    g.fillStyle = r; g.fillRect(0, 200, 1024, 312);
    var t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function make(canvas) {
    var kind = canvas.getAttribute("data-fx") || "gyro";
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    } catch (e) { canvas.style.display = "none"; return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    cam.position.set(0, 0, 8.4);
    var pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromEquirectangular(studio()).texture;

    var chrome = new THREE.MeshStandardMaterial({ color: 0xdadade, metalness: 1, roughness: 0.14, envMapIntensity: 1.3 });
    var ember  = new THREE.MeshStandardMaterial({ color: 0xc2141b, metalness: 0.35, roughness: 0.28, emissive: 0x5a0508, emissiveIntensity: 0.9, envMapIntensity: 1 });

    var root = new THREE.Group(); scene.add(root);
    var parts = [];

    if (kind === "funnel") {
      for (var i = 0; i < 7; i++) {
        var R = 1.75 - i * 0.235;
        var m = new THREE.Mesh(new THREE.TorusGeometry(R, 0.072, 28, 120), chrome);
        m.rotation.x = Math.PI / 2;
        m.position.y = 1.35 - i * 0.42;
        m.userData = { y: m.position.y, i: i };
        root.add(m); parts.push(m);
      }
      var drop = new THREE.Mesh(new THREE.SphereGeometry(0.2, 40, 40), ember);
      drop.position.y = -1.95; drop.userData = { drop: true };
      root.add(drop); parts.push(drop);
      root.rotation.set(0.42, 0, -0.22);
    } else if (kind === "coil") {
      var pts = [], turns = 5.5, N = 400;
      for (var k = 0; k <= N; k++) {
        var a = (k / N) * Math.PI * 2 * turns;
        pts.push(new THREE.Vector3(Math.cos(a) * 1.05, (k / N - 0.5) * 3.4, Math.sin(a) * 1.05));
      }
      var curve = new THREE.CatmullRomCurve3(pts);
      var coil = new THREE.Mesh(new THREE.TubeGeometry(curve, 900, 0.09, 20, false), chrome);
      root.add(coil); parts.push(coil);
      var capA = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 32), ember);
      capA.position.copy(pts[0]); coil.add(capA);
      root.rotation.set(0.25, 0, 0.5);
    } else {
      [1.7, 1.3, 0.92].forEach(function (R, i) {
        var m = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 28, 140), chrome);
        m.userData = { i: i };
        root.add(m); parts.push(m);
      });
      var core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 48, 48), ember);
      core.userData = { core: true };
      root.add(core); parts.push(core);
      root.rotation.set(0.3, 0.2, 0);
    }

    var W = 0, H = 0;
    function resize() {
      var r = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (w === W && h === H) return;
      W = w; H = h;
      renderer.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix();
    }

    var host = canvas.parentNode;
    var mx = 0, my = 0, tx = 0, ty = 0;
    host.addEventListener("pointermove", function (e) {
      var r = host.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    host.addEventListener("pointerleave", function () { tx = 0; ty = 0; });

    var seen = false, raf = 0, t0 = performance.now(), baseX = root.rotation.x, baseZ = root.rotation.z, baseY = root.rotation.y;

    function frame(now) {
      raf = 0;
      if (!seen || document.hidden) return;
      resize();
      var t = (now - t0) / 1000;
      mx += (tx - mx) * 0.06; my += (ty - my) * 0.06;
      // прокрутка чуть доворачивает объект
      var r = canvas.getBoundingClientRect();
      var sp = 1 - (r.top + r.height / 2) / window.innerHeight;   // ~0 внизу экрана, ~1 вверху

      root.rotation.x = baseX + my * 0.22;
      root.rotation.z = baseZ - mx * 0.12;
      root.rotation.y = baseY + mx * 0.35 + (kind === "coil" ? t * 0.35 : 0) + sp * 0.6;

      for (var i = 0; i < parts.length; i++) {
        var p = parts[i], u = p.userData;
        if (kind === "funnel") {
          if (u.drop) { p.position.y = -1.95 + Math.sin(t * 1.3) * 0.09; continue; }
          p.position.y = u.y + Math.sin(t * 0.9 - u.i * 0.55) * 0.07;
          p.rotation.x = Math.PI / 2 + Math.sin(t * 0.7 - u.i * 0.5) * 0.1;
          p.rotation.y = Math.cos(t * 0.6 - u.i * 0.45) * 0.08;
        } else if (kind === "gyro") {
          if (u.core) { var s = 1 + Math.sin(t * 1.4) * 0.04; p.scale.set(s, s, s); continue; }
          p.rotation.x = t * (0.32 + u.i * 0.11) + u.i * 1.1;
          p.rotation.y = t * (0.24 - u.i * 0.07) + u.i * 0.7;
        } else {
          p.scale.y = 0.86 + Math.sin(t * 0.8) * 0.06 + Math.max(0, Math.min(1, sp)) * 0.16;
        }
      }
      renderer.render(scene, cam);
      if (!still) raf = requestAnimationFrame(frame);
    }
    function go() { if (!raf && seen && !document.hidden) raf = requestAnimationFrame(frame); }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { seen = es[0].isIntersecting; go(); }, { rootMargin: "150px" }).observe(canvas);
    } else { seen = true; go(); }
    document.addEventListener("visibilitychange", go);
    window.addEventListener("resize", go);
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); seen = false; });
  }

  [].forEach.call(document.querySelectorAll("canvas.fx3d"), make);
})();
