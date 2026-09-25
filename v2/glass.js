/* ============================================================
   Стеклянные сферы — порт шейдера Originkit «Liquid Glass Cube»
   с React на ваниль. Три тёмные фигуры + красная в центре.
   Появление — как в варианте A: по очереди, со сборкой.
   ============================================================ */
(function () {
  var mount = document.getElementById("glassStage");
  if (!mount || !window.THREE) return;

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- шейдер ---------- */
  var VERT = [
    "varying vec3 vNormal;",
    "varying vec3 vView;",
    "void main() {",
    "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
    "  vNormal = normalize(normalMatrix * normal);",
    "  vView = -mv.xyz;",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");

  /* Плотное красное стекло. Прежний шейдер имитировал прозрачную
     плёнку с переливом — на тёмном фоне перелив не читался, а тело
     просвечивало. Здесь цвет набирается по закону Бугера: чем длиннее
     путь луча внутри, тем гуще красный, поэтому центр глубокий, а
     кромка светлая. Объём держит Френель, жизнь — блик, который
     медленно обходит сферу. */
  var FRAG = [
    "uniform vec3 uGlass; uniform vec3 uDeep; uniform vec3 uHighlight;",
    "uniform float uEdge; uniform float uGloss; uniform float uTime;",
    "uniform float uOpacity;",
    "varying vec3 vNormal; varying vec3 vView;",
    "void main() {",
    "  vec3 n = normalize(vNormal); vec3 v = normalize(vView);",
    "  if (!gl_FrontFacing) n = -n;",
    "  float ndv = max(dot(n, v), 0.0);",
    // толщина: в лоб смотрим сквозь всё тело, у края — вскользь
    "  float thick = pow(ndv, 0.8);",
    "  vec3 body = mix(uGlass, uDeep, thick);",
    // Френель — светлая кромка, она и читается как объём
    "  float f = pow(1.0 - ndv, 3.4);",
    "  float rim = clamp(f * uEdge, 0.0, 1.0);",
    "  vec3 col = mix(body, uHighlight, rim * 0.42);",
    // блик обходит сферу по кругу — стекло живое, а не залитое
    "  float a = uTime * 0.32;",
    "  vec3 key = normalize(vec3(cos(a) * 0.8, 0.5, sin(a) * 0.8 + 0.45));",
    "  float spec = pow(max(dot(n, normalize(key + v)), 0.0), uGloss);",
    "  float wash = pow(max(dot(n, key), 0.0), 2.6);",
    "  col += uHighlight * (spec * 0.55 + wash * 0.14);",
    // вторая подсветка с изнанки — внутри стекла что-то происходит
    "  vec3 back = normalize(vec3(-cos(a * 0.55) * 0.9, -0.4, -sin(a * 0.55)));",
    "  col += uGlass * pow(max(dot(n, normalize(back + v)), 0.0), uGloss * 0.4) * 0.55;",
    "  float alpha = 0.90 + rim * 0.10;",
    "  gl_FragColor = vec4(col, alpha * uOpacity);",
    "}"
  ].join("\n");

  /* ---------- сквиркл вместо сферы ---------- */
  function buildBody(exponent, segW, segH) {
    var geo = new THREE.SphereGeometry(1, segW, segH);
    var pos = geo.getAttribute("position");
    var v = new THREE.Vector3();
    var n = Math.max(2, exponent);
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      var d = Math.pow(Math.abs(v.x), n) + Math.pow(Math.abs(v.y), n) + Math.pow(Math.abs(v.z), n);
      var r = Math.pow(d, -1 / n);
      pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  function mat(cfg) {
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uGlass:     { value: new THREE.Color(cfg.glass) },
        uDeep:      { value: new THREE.Color(cfg.deep) },
        uHighlight: { value: new THREE.Color(cfg.highlight) },
        uEdge:      { value: cfg.edge },
        uGloss:     { value: cfg.gloss },
        uTime:      { value: 0 },
        uOpacity:   { value: 0 }
      },
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false
    });
  }

  /* ---------- сцена ---------- */
  // Узкие экраны: antialias дорог, а сглаживание даёт почти нулевой
  // выигрыш при pixelRatio 2+. Отключаем и режем pixelRatio.
  var narrow = window.matchMedia("(max-width: 640px)").matches;

  // Фолбэк: без WebGL (или при отказе контекста) блок остался бы пустым.
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !narrow, alpha: true });
  } catch (err) {
    renderer = null;
  }
  if (!renderer || !renderer.getContext()) {
    mount.classList.add("no-webgl");
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  var el = renderer.domElement;
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  mount.appendChild(el);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 2000);

  // Тёмное стекло — крупные опоры. Кромка белёсая за счёт uHighlight.
  // Красное стекло — результат в зоне пересечения.
  // Корпус, глубина и свет. Красный держится в фирменном створе,
  // но в глубине уходит почти в чёрный — иначе шар плоский.
  var RED = {
    // highlight светлее тела, но всё ещё красный: чисто белый блик
    // читался как посторонний белый кружок внутри шара.
    glass: "#c20f1a", deep: "#3a0208", highlight: "#ff5a52",
    edge: 1.25, gloss: 26
  };

  // Позиции повторяют макет: три опоры + центр
  // Один слой: материал теперь непрозрачный по телу и даёт объём сам.
  var SPEC = [
    { p: [0, 0, 0], s: 1.0, cfg: RED, spin: -0.16 }
  ];

  // На узких экранах сквиркл читается и на вдвое меньшей сетке:
  // 96×72 = 6912 вершин против 48×36 = 1728 — силуэт тот же.
  var geoBody = narrow ? buildBody(2.35, 48, 36) : buildBody(2.35, 96, 72);
  var items = SPEC.map(function (s) {
    var m = mat(s.cfg);
    var mesh = new THREE.Mesh(geoBody, m);
    mesh.position.set(s.p[0], s.p[1], s.p[2]);
    mesh.scale.setScalar(s.s);
    mesh.renderOrder = s.cfg === RED ? 2 : 1;
    scene.add(mesh);
    return { mesh: mesh, m: m, spin: s.spin, base: s.s, t: 0 };
  });

  function resize() {
    var w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    var aspect = w / h;
    var dist = 6.6;
    var span = 2.5;
    var visible = aspect < 1 ? span / aspect : span;
    camera.aspect = aspect;
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.fov = 2 * Math.atan(visible / 2 / dist) * (180 / Math.PI);
    camera.updateProjectionMatrix();
    // Цикл может стоять на паузе (вне экрана / reduced-motion) —
    // тогда после ресайза в буфере осталась бы картинка старого размера.
    if (typeof running !== "undefined" && !running) renderer.render(scene, camera);
  }
  resize();
  new ResizeObserver(resize).observe(mount);

  /* ---------- появление по очереди, как в варианте A ---------- */
  var started = reduce;
  if (reduce) items.forEach(function (it) { it.m.uniforms.uOpacity.value = 1; });

  // Сцена видна в экране? Вне экрана рендер останавливаем совсем:
  // раньше 4 объекта со сложным шейдером крутились всё время, пока
  // открыта вкладка, даже когда блок далеко за пределами видимости.
  var onScreen = false;
  var running = false;

  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      onScreen = e.isIntersecting;
      if (onScreen && !started) {
        started = true;
        mount.classList.add("on");
      }
      sync();
    });
  }, { threshold: 0 });
  io.observe(mount);

  document.addEventListener("visibilitychange", sync);

  function sync() {
    // При prefers-reduced-motion кадр рисуем один раз — статичная
    // картинка вместо бесконечного цикла.
    if (reduce) {
      if (onScreen && !document.hidden && !drawnOnce) {
        drawnOnce = true;
        renderer.render(scene, camera);
      }
      return;
    }
    var want = onScreen && !document.hidden;
    if (want && !running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    } else if (!want) {
      running = false;
    }
  }

  var drawnOnce = false;
  var t0 = performance.now();
  var last = t0;

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (started && !reduce) {
      var el2 = (now - t0) / 1000;
      items.forEach(function (it, i) {
        // те же задержки, что у контуров в варианте A
        var delay = i * 0.28;
        var k = Math.max(0, Math.min(1, (el2 - delay) / 1.1));
        var e = 1 - Math.pow(1 - k, 3);
        it.m.uniforms.uOpacity.value = e;
        it.mesh.scale.setScalar(it.base * (0.82 + e * 0.18));
      });
    }

    items.forEach(function (it) {
      it.t += dt;
      it.m.uniforms.uTime.value = it.t;
      it.mesh.rotation.y += it.spin * dt;
      it.mesh.rotation.x = Math.sin(it.t * 0.35) * 0.12;
    });

    renderer.render(scene, camera);
  }
  // Цикл больше не стартует сам: его включает sync(), когда сцена
  // реально видна. См. IntersectionObserver выше.
})();
