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
  function buildBody(exponent) {
    var geo = new THREE.SphereGeometry(1, 96, 72);
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
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  var el = renderer.domElement;
  el.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  mount.appendChild(el);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 2000);

  // Тёмное стекло — крупные опоры. Кромка белёсая за счёт uHighlight.
  var DARK = {
    glass: "#101010", roomTop: "#1b1b1b", roomBottom: "#050505",
    highlight: "#ffffff", ior: 1.30, dispersion: 0.03,
    clarity: 0.55, edge: 1.5, gloss: 380
  };
  // Красное стекло — результат в зоне пересечения.
  var RED = {
    glass: "#c8102e", roomTop: "#8f0d1e", roomBottom: "#3a0409",
    highlight: "#ff6b70", ior: 1.34, dispersion: 0.05,
    clarity: 0.5, edge: 1.7, gloss: 300
  };

  // Позиции повторяют макет: три опоры + центр
  var SPEC = [
    { p: [-0.78, 0.46, 0.0],  s: 1.02, cfg: DARK, spin: 0.055 },
    { p: [ 0.78, 0.46, -0.1], s: 1.02, cfg: DARK, spin: -0.045 },
    { p: [ 0.0, -0.66, 0.1],  s: 1.02, cfg: DARK, spin: 0.05 },
    { p: [ 0.0,  0.02, 0.9],  s: 0.6,  cfg: RED,  spin: -0.08 }
  ];

  var geoBody = buildBody(2.9);
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
    var span = 3.9;
    var visible = aspect < 1 ? span / aspect : span;
    camera.aspect = aspect;
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.fov = 2 * Math.atan(visible / 2 / dist) * (180 / Math.PI);
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(mount);

  /* ---------- появление по очереди, как в варианте A ---------- */
  var started = reduce;
  if (reduce) items.forEach(function (it) { it.m.uniforms.uOpacity.value = 1; });

  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting && !started) {
        started = true;
        mount.classList.add("on");
        io.disconnect();
      }
    });
  }, { threshold: 0.3 });
  io.observe(mount);

  var t0 = performance.now();
  var last = t0;

  function frame(now) {
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
  requestAnimationFrame(frame);
})();
