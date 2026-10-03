/* Кристалл в третьей карточке утечек («87% базы»).
   Перенос сцены Эли из КРИСТАЛЛ/kristall.html на Three r128:
   бипирамида из четырёх граней, стекло по Френелю, радуга на рёбрах,
   прозрачный фон. Рисует только пока карточка видна. */
(function () {
  var host = document.querySelector("[data-leak-crystal]");
  if (!host) return;
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var S = { height: 1.75, sides: 4, size: 0.85, speed: 0.22, ior: 1.55, rainbow: 0.055, glint: 1.35, density: 0.42 };
  var started = false;

  function load(cb) {
    if (window.THREE) return cb();
    var s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s.onload = cb; document.head.appendChild(s);
  }

  function crystal(sides, h) {
    var pts = [], i;
    for (i = 0; i < sides; i++) { var a = i / sides * Math.PI * 2 + Math.PI / 4; pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))); }
    var top = new THREE.Vector3(0, h, 0), bot = new THREE.Vector3(0, -h, 0);
    var pos = [], nrm = [];
    function tri(a, b, c) {
      var n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
      [a, b, c].forEach(function (t) { pos.push(t.x, t.y, t.z); nrm.push(n.x, n.y, n.z); });
    }
    for (i = 0; i < sides; i++) { var p = pts[i], q = pts[(i + 1) % sides]; tri(p, q, top); tri(q, p, bot); }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    return g;
  }

  function start() {
    if (started) return; started = true;
    load(function () {
      var canvas = document.createElement("canvas"); host.appendChild(canvas);
      var renderer;
      try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { return; }
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
      renderer.outputEncoding = THREE.sRGBEncoding;
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100); camera.position.set(0, 0, 7.5);
      var mat = new THREE.ShaderMaterial({
        transparent: true, side: THREE.DoubleSide, depthWrite: false,
        uniforms: { uIor: { value: S.ior }, uRainbow: { value: S.rainbow }, uGlint: { value: S.glint }, uDensity: { value: S.density }, uRed: { value: 0 }, uAlpha: { value: 1 } },
        vertexShader: "varying vec3 vNormal;varying vec3 vToEye;void main(){vNormal=normalize(normalMatrix*normal);vec4 vp=modelViewMatrix*vec4(position,1.0);vToEye=normalize(-vp.xyz);gl_Position=projectionMatrix*vp;}",
        fragmentShader: "precision highp float;varying vec3 vNormal;varying vec3 vToEye;uniform float uIor,uRainbow,uGlint,uDensity,uRed,uAlpha;\n"
          + "void main(){vec3 n=normalize(vNormal);vec3 v=normalize(vToEye);float cosA=abs(dot(n,v));"
          + "float f0=pow((uIor-1.0)/(uIor+1.0),2.0);float fres=f0+(1.0-f0)*pow(1.0-cosA,5.0);"
          + "float edge=pow(1.0-cosA,2.2);vec3 rainbow=vec3(edge*(1.0+uRainbow*9.0),edge,edge*(1.0-uRainbow*6.0));"
          + "float glint=pow(1.0-cosA,7.0)*uGlint;float body=uDensity*(0.55+0.45*(1.0-cosA));"
          /* На светлой карточке белое стекло пропадает: даём граням
             серую светотень от верхнего левого света, как на макете. */
          + "vec3 L=normalize(vec3(-0.45,0.65,0.62));float lam=max(dot(n,L),0.0);float back=gl_FrontFacing?1.0:0.82;"
          + "vec3 R=reflect(-v,n);float env=0.5+0.5*smoothstep(-0.35,0.85,R.y);float spec=pow(max(dot(R,L),0.0),28.0);"
          + "float tone=(0.22+0.48*lam+0.38*env)*back;"
          /* стекло как у плюмбоба: светлое тело, холодный отлив у граней */
          + "vec3 glass=vec3(0.18)+vec3(tone)*(0.78+fres*0.3)*vec3(0.96,1.0,1.0)+rainbow*0.22;"
          /* красный: тело наливается цветом, блики остаются белыми */
          + "vec3 ruby=vec3(0.78,0.05,0.06)*(0.18+1.05*tone)+vec3(0.45,0.06,0.05)*fres;"
          + "vec3 color=mix(glass,ruby,uRed)+vec3(1.0)*(glint*0.8+spec*0.9);"
          + "float alpha=clamp((0.62+body*0.5+fres*0.4+glint*0.6+uRed*0.15)*uAlpha,0.0,0.97);gl_FragColor=vec4(color,alpha);\n"
          + "#include <tonemapping_fragment>\n#include <encodings_fragment>\n}"
      });
      var geo = crystal(S.sides, S.height);
      var group = new THREE.Group(); group.scale.setScalar(S.size); scene.add(group);
      /* внутренний кристалл: даёт отражения внутри, как на фото */
      var innerMat = mat.clone(); innerMat.uniforms.uAlpha.value = 0.55;
      var inner = new THREE.Mesh(geo, innerMat); inner.scale.set(0.56, 0.6, 0.56); inner.rotation.y = Math.PI / 4; group.add(inner);
      var mesh = new THREE.Mesh(geo, mat); group.add(mesh);
      /* тонкие рёбра */
      var edgeMat = new THREE.LineBasicMaterial({ color: 0xa9aeb2, transparent: true, opacity: 0.9 });
      var edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), edgeMat); group.add(edges);
      var innerEdges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
      innerEdges.scale.copy(inner.scale); innerEdges.rotation.copy(inner.rotation); group.add(innerEdges);
      var white = new THREE.Color(0xa9aeb2), redEdge = new THREE.Color(0xffb0a6);
      var shownAt = 0, red = 0;

      var W = 0, H = 0;
      function resize() {
        var r = host.getBoundingClientRect(); if (!r.width || !r.height) return;
        if (r.width !== W || r.height !== H) { W = r.width; H = r.height; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
      }
      var visible = true, raf = 0, last = performance.now();
      function frame(now) {
        raf = 0; if (!visible || document.hidden) return;
        var dt = Math.min((now - last) / 1000, 0.1); last = now;
        resize();
        if (!still) group.rotation.y += dt * S.speed * Math.PI;
        /* первые ~2.5 с белый, затем за ~3 с наливается красным */
        if (!shownAt) shownAt = now;
        var t = (now - shownAt) / 1000;
        red = still ? 1 : Math.min(1, Math.max(0, (t - 2.5) / 3));
        var e = red * red * (3 - 2 * red);
        mat.uniforms.uRed.value = e; innerMat.uniforms.uRed.value = e;
        edgeMat.color.copy(white).lerp(redEdge, e); innerEdges.material.color.copy(edgeMat.color);
        renderer.render(scene, camera);
        if (!still) raf = requestAnimationFrame(frame);
      }
      function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
      new IntersectionObserver(function (es) { var was = visible; visible = es[0].isIntersecting; if (visible && !was) shownAt = 0; if (visible) wake(); }, { rootMargin: "0px" }).observe(host);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) wake(); });
      window.addEventListener("resize", wake);
      if ("ResizeObserver" in window) new ResizeObserver(function () { resize(); wake(); }).observe(host);
      resize(); wake();
      host.classList.add("is-ready");
    });
  }
  new IntersectionObserver(function (es) { if (es[0].isIntersecting) start(); }, { rootMargin: "800px" }).observe(host);
})();
