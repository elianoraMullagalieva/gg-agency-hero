/* Кристалл в блоке «Мы работаем не со всеми».
   Порт спектрального стекла из Facet Crystal Lab (MIT) на Three r128:
   выпуклый кварц из двух колец и двух вершин, лучи ломаются внутри
   по плоскостям граней, три канала с разным показателем преломления.
   Three.js подгружается только когда блок близко к экрану. */
(function () {
  var host = document.querySelector("[data-path-crystal]");
  if (!host) return;
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var started = false;

  function load(cb) {
    if (window.THREE) return cb();
    var s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s.onload = cb; document.head.appendChild(s);
  }

  function geometry(sides, aspect) {
    /* Октаэдр из рецепта Эли: квадрат по экватору и две вершины */
    var pts = [], i, a;
    for (i = 0; i < 4; i++) { a = i / 4 * Math.PI * 2 + Math.PI / 4; pts.push([Math.cos(a), 0, Math.sin(a)]); }
    var top = pts.length; pts.push([0, 1.35 * aspect, 0]);
    var bot = pts.length; pts.push([0, -1.35 * aspect, 0]);
    var tris = [];
    for (i = 0; i < 4; i++) { var j = (i + 1) % 4; tris.push([i, top, j]); tris.push([j, bot, i]); }
    var pos = [], nrm = [], planes = [];
    tris.forEach(function (t) {
      var A = new THREE.Vector3().fromArray(pts[t[0]]), B = new THREE.Vector3().fromArray(pts[t[1]]), C = new THREE.Vector3().fromArray(pts[t[2]]);
      var n = B.clone().sub(A).cross(C.clone().sub(A)).normalize();
      if (n.dot(A) < 0) { n.negate(); var tmp = B; B = C; C = tmp; }
      [A, B, C].forEach(function (p) { pos.push(p.x, p.y, p.z); nrm.push(n.x, n.y, n.z); });
      planes.push(new THREE.Vector4(n.x, n.y, n.z, -n.dot(A)));
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    g.userData.planes = planes;
    return g;
  }

  function environment() {
    var w = 256, h = 128, data = new Float32Array(w * h * 4);
    var panels = [[0.2, 0.66, 10, 0.045, 0.16, [1, 1, 1]], [0.7, 0.6, 7, 0.055, 0.2, [1, 0.96, 0.96]], [0.48, 0.9, 6, 0.16, 0.035, [1, 0.75, 0.72]], [0.95, 0.4, 2.5, 0.02, 0.2, [1, 0.3, 0.26]]];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var u = x / w, v = y / h, c = [0.035, 0.03, 0.03];
      panels.forEach(function (p) {
        var dx = Math.min(Math.abs(u - p[0]), 1 - Math.abs(u - p[0])) / p[3], dy = (v - p[1]) / p[4];
        var glow = Math.exp(-Math.pow(dx, 6) - Math.pow(dy, 6)) * p[2];
        c[0] += glow * p[5][0]; c[1] += glow * p[5][1]; c[2] += glow * p[5][2];
      });
      var k = (y * w + x) * 4; data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 1;
    }
    var t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
    t.wrapS = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    return t;
  }

  var VS = "varying vec3 vPosition;varying vec3 vNormal;varying vec3 vEye;void main(){vPosition=position;vNormal=normal;mat3 m=mat3(modelMatrix);vec3 delta=cameraPosition-modelMatrix[3].xyz;vEye=vec3(dot(delta,m[0])/dot(m[0],m[0]),dot(delta,m[1])/dot(m[1],m[1]),dot(delta,m[2])/dot(m[2],m[2]));gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}";
  var FS = "precision highp float;varying vec3 vPosition;varying vec3 vNormal;varying vec3 vEye;uniform vec4 uPlanes[40];uniform int uPlaneCount;uniform sampler2D uEnvironment;uniform vec3 uColor;uniform float uIor;uniform float uDispersion;uniform float uRoughness;uniform float uAbsorption;uniform int uBounces;uniform mat3 uWorldRotation;"
    + "vec3 env(vec3 d){d=normalize(uWorldRotation*d);vec2 uv=vec2(atan(d.z,d.x)*.159154943+.5,asin(clamp(d.y,-1.,1.))*.318309886+.5);vec3 col=texture2D(uEnvironment,uv).rgb;float r=uRoughness*.075;col+=texture2D(uEnvironment,uv+vec2(r,r)).rgb+texture2D(uEnvironment,uv-vec2(r,r)).rgb;return col/3.;}"
    + "float fresnel(float c,float ior){float f=(ior-1.)/(ior+1.);return f*f+(1.-f*f)*pow(1.-clamp(c,0.,1.),5.);}"
    + "float trace(vec3 incident,vec3 normal,float ior,int ch){float entry=fresnel(dot(-incident,normal),ior);float result=env(reflect(incident,normal))[ch]*entry;vec3 dir=refract(incident,normal,1./ior);vec3 origin=vPosition+dir*.001;float tp=1.-entry;"
    + "for(int b=0;b<8;b++){if(b>=uBounces)break;float dist=1e6;vec3 hn=vec3(0.,1.,0.);for(int i=0;i<40;i++){if(i>=uPlaneCount)break;vec3 n=uPlanes[i].xyz;float den=dot(n,dir);if(den>.00001){float t=-(dot(n,origin)+uPlanes[i].w)/den;if(t>.00001&&t<dist){dist=t;hn=n;}}}if(dist>1e5)break;"
    + "tp*=exp(-dist*uAbsorption*(1.-uColor[ch])*.85);vec3 outg=refract(dir,-hn,ior);float f=fresnel(dot(dir,hn),ior);if(dot(outg,outg)>.001){result+=tp*(1.-f)*env(outg)[ch];tp*=f;}origin+=dir*dist;dir=reflect(dir,hn);origin+=dir*.001;if(tp<.005)break;}return result;}"
    + "void main(){vec3 n=normalize(vNormal),inc=normalize(vPosition-vEye);vec3 color=vec3(trace(inc,n,uIor-uDispersion*.035,0),trace(inc,n,uIor,1),trace(inc,n,uIor+uDispersion*.035,2));gl_FragColor=vec4(color,1.);\n"
    + "#include <tonemapping_fragment>\n#include <encodings_fragment>\n}";

  function start() {
    if (started) return; started = true;
    load(function () {
      var canvas = host.querySelector("canvas");
      var renderer;
      try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
      renderer.outputEncoding = THREE.sRGBEncoding;
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0, 0, 6.2);
      var env = environment();
      var root = new THREE.Group(); scene.add(root);
      function shard(scale, x, z, tilt, angle, seedTurn) {
        var g = geometry(4, 1.15);
        var pl = g.userData.planes;
        var u = {
          uPlanes: { value: pl.concat(Array.apply(null, Array(40 - pl.length)).map(function () { return new THREE.Vector4(); })) },
          uPlaneCount: { value: pl.length }, uEnvironment: { value: env },
          uColor: { value: new THREE.Color("#ff8052") }, uIor: { value: 1.54 }, uDispersion: { value: 3.0 },
          uRoughness: { value: 0.205 }, uAbsorption: { value: 3.55 }, uBounces: { value: 8 },
          uWorldRotation: { value: new THREE.Matrix3() }
        };
        var m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: u }));
        m.scale.setScalar(scale); m.position.set(x, (scale - 1) * 0.9, z);
        m.rotation.set(Math.sin(angle) * tilt, angle, Math.cos(angle) * tilt);
        root.add(m);
      }
      shard(1, 0, 0, 0.08, 0.3, 0);
      root.position.y = 0;

      var targetX = 0, targetY = 0, cx = 0, cy = 0;
      if (!still) host.addEventListener("pointermove", function (e) {
        var r = host.getBoundingClientRect();
        targetX = ((e.clientX - r.left) / r.width - 0.5) * 0.8; targetY = ((e.clientY - r.top) / r.height - 0.5) * 0.5;
      });
      host.addEventListener("pointerleave", function () { targetX = 0; targetY = 0; });

      var W = 0, H = 0;
      function resize() {
        var r = host.getBoundingClientRect(); if (!r.width || !r.height) return;
        if (r.width !== W || r.height !== H) { W = r.width; H = r.height; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
      }
      var visible = false, raf = 0, last = performance.now(), t = 0;
      function frame(now) {
        raf = 0;
        if (!visible || document.hidden) return;
        var dt = Math.min((now - last) / 1000, 0.1); last = now; t += dt;
        resize();
        cx += (targetX - cx) * 0.05; cy += (targetY - cy) * 0.05;
        root.rotation.y = still ? 0.6 : t * 0.7; root.rotation.x = 0.12;
        root.position.y = still ? 0 : Math.sin(t * 1.1) * 0.06;
        root.updateMatrixWorld(true);
        root.traverse(function (o) { if (o.material && o.material.uniforms) o.material.uniforms.uWorldRotation.value.setFromMatrix4(new THREE.Matrix4().extractRotation(o.matrixWorld)); });
        renderer.render(scene, camera);
        if (!still) raf = requestAnimationFrame(frame);
      }
      function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) wake(); }, { rootMargin: "100px" }).observe(host);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) wake(); });
      window.addEventListener("resize", function () { resize(); wake(); });
      resize(); visible = true; wake();
      host.classList.add("is-ready");
    });
  }
  new IntersectionObserver(function (es) { if (es[0].isIntersecting) start(); }, { rootMargin: "600px" }).observe(host);
})();
