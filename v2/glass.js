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

  var FRAG = [
    "uniform vec3 uGlass; uniform vec3 uRoomTop; uniform vec3 uRoomBottom;",
    "uniform vec3 uHighlight; uniform float uIor; uniform float uDispersion;",
    "uniform float uClarity; uniform float uEdge; uniform float uGloss;",
    "uniform float uOpacity;",
    "varying vec3 vNormal; varying vec3 vView;",
    "const vec3 KEY = vec3(0.55, 0.72, 0.42);",
    "const vec3 FILL = vec3(-0.62, -0.28, 0.73);",
    "vec3 room(vec3 dir) {",
    "  vec3 base = mix(uRoomBottom, uRoomTop, clamp(dir.y * 0.5 + 0.5, 0.0, 1.0));",
    "  float key = pow(max(dot(dir, normalize(KEY)), 0.0), 28.0);",
    "  float fill = pow(max(dot(dir, normalize(FILL)), 0.0), 12.0);",
    "  return base + uHighlight * (key * 1.6 + fill * 0.35);",
    "}",
    "void main() {",
    "  vec3 n = normalize(vNormal); vec3 v = normalize(vView);",
    "  if (!gl_FrontFacing) n = -n;",
    "  float facing = gl_FrontFacing ? 1.0 : 0.45;",
    "  float f = clamp(pow(1.0 - max(dot(n, v), 0.0), 5.0), 0.0, 1.0);",
    "  float rim = clamp(f * uEdge, 0.0, 1.0);",
    "  vec3 reflected = room(reflect(-v, n));",
    "  float eta = 1.0 / max(1.001, uIor);",
    "  vec3 rRay = refract(-v, n, eta * (1.0 + uDispersion));",
    "  vec3 gRay = refract(-v, n, eta);",
    "  vec3 bRay = refract(-v, n, eta * (1.0 - uDispersion));",
    "  vec3 refracted = vec3(room(rRay).r, room(gRay).g, room(bRay).b);",
    "  vec3 tinted = mix(refracted, refracted * uGlass, 1.0 - uClarity);",
    "  vec3 col = mix(tinted, reflected, rim);",
    "  float face = smoothstep(-0.35, 0.9, dot(n, normalize(KEY)));",
    "  col *= 0.72 + face * 0.55;",
    "  vec3 hKey = normalize(normalize(KEY) + v);",
    "  vec3 hFill = normalize(normalize(FILL) + v);",
    "  float spec = pow(max(dot(n, hKey), 0.0), uGloss) * 1.35",
    "    + pow(max(dot(n, hFill), 0.0), uGloss * 0.35) * 0.5",
    "    + pow(max(dot(n, hKey), 0.0), 6.0) * 0.12;",
    "  col += uHighlight * spec * facing;",
    "  float alpha = 0.05 + rim * 0.85 + clamp(spec, 0.0, 1.0) * 0.75;",
    "  alpha += (1.0 - uClarity) * 0.16;",
    "  alpha += face * 0.1;",
    "  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0) * facing * uOpacity);",
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
        uRoomTop:   { value: new THREE.Color(cfg.roomTop) },
        uRoomBottom:{ value: new THREE.Color(cfg.roomBottom) },
        uHighlight: { value: new THREE.Color(cfg.highlight) },
        uIor:       { value: cfg.ior },
        uDispersion:{ value: cfg.dispersion },
        uClarity:   { value: cfg.clarity },
        uEdge:      { value: cfg.edge },
        uGloss:     { value: cfg.gloss },
        uOpacity:   { value: 0 }
      },
      transparent: true,
      side: THREE.DoubleSide,
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
  var DARK = {
    glass: "#1f1f1f", roomTop: "#4a4a4a", roomBottom: "#101010",
    highlight: "#ffffff", ior: 1.30, dispersion: 0.03,
    clarity: 0.62, edge: 3.2, gloss: 200
  };
  // Красное стекло — результат в зоне пересечения.
  var RED = {
    glass: "#ff0a1e", roomTop: "#e8081c", roomBottom: "#8f0512",
    highlight: "#ffb3b7", ior: 1.34, dispersion: 0.05,
    clarity: 0.14, edge: 2.2, gloss: 240
  };

  // Позиции повторяют макет: три опоры + центр
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
      it.mesh.rotation.y += it.spin * dt;
      it.mesh.rotation.x = Math.sin(it.t * 0.35) * 0.12;
    });

    renderer.render(scene, camera);
  }
  // Цикл больше не стартует сам: его включает sync(), когда сцена
  // реально видна. См. IntersectionObserver выше.
})();
