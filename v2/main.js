/* ============================================================
   Predictive Arc — поле квадратных точек, изгибающееся по параболе.
   Шейдер из Originkit, обёртка переписана с React на ванильный JS.

   Параметры взяты из панели Originkit:
     background #030303 · base #7D0510 · accent #710F11 · highlight #AC0C0F
     density 78 · dot size 137% · speed 84
     arch: peak 90 · height 0 · thickness 206 · falloff 600
     pointer: enabled · radius 281 · strength 25
   ============================================================ */

(function () {
  "use strict";

  var MAX_DPR = 2;

  var VERT_SRC =
    "attribute vec2 a_pos;" +
    "void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }";

  var FRAG_SRC = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform vec2  uRes;",
    "uniform float uTime, uDpr, uCell, uDot;",
    "uniform float uPeak, uHeight, uThick, uFall;",
    "uniform vec3  uBg, uBase, uAccent, uHigh;",
    "uniform vec2  uMouse;",
    "uniform float uMouseRadius, uMouseStrength;",
    "void main(){",
    "  float cs = max(uCell, 2.0);",
    "  vec2 ci = floor(gl_FragCoord.xy / cs);",
    "  vec2 cc = (ci + 0.5) * cs;",
    "  float x = cc.x / uDpr;",
    "  float y = (uRes.y - cc.y) / uDpr;",
    "  float w = uRes.x / uDpr;",
    "  float h = uRes.y / uDpr;",
    "  float normX = (x - w * 0.5) / (w * 0.75);",
    "  float curveY = h * uPeak + normX * normX * (h * uHeight);",
    "  float mdx = x - uMouse.x;",
    "  float influence = uMouseStrength * exp(-(mdx * mdx) / (2.0 * uMouseRadius * uMouseRadius + 1.0));",
    "  curveY = mix(curveY, uMouse.y, influence);",
    "  float dist = abs(y - curveY);",
    "  float th = (140.0 + (1.0 - abs(normX)) * 80.0) * uThick;",
    "  vec3 col = uBg;",
    "  if (dist < th) {",
    "    float i = 1.0 - dist / th;",
    "    float waveX = sin(x * 0.015 + uTime);",
    "    float waveY = cos(y * 0.02 + uTime);",
    "    i = i * 0.7 + waveX * waveY * 0.3 * i;",
    "    i *= max(0.0, 1.0 - pow(abs(normX), uFall));",
    "    if (i > 0.02) {",
    "      float side = uDot * i * uDpr;",
    "      vec2 d = abs(gl_FragCoord.xy - cc);",
    "      float cov = 1.0 - smoothstep(side * 0.5 - 1.0, side * 0.5 + 1.0, max(d.x, d.y));",
    "      vec3 ink = mix(uBase, uAccent, clamp(pow(i, 1.1), 0.0, 1.0));",
    "      ink = mix(ink, uHigh, smoothstep(0.72, 1.0, i));",
    "      col = mix(uBg, ink, cov * clamp(i * 1.6, 0.0, 1.0));",
    "    }",
    "  }",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  /* ---------- Настройки ---------- */

  var OPTS = {
    background: "#030303",
    baseColor:  "#7D0510",
    accentColor:"#710F11",
    highlight:  "#AC0C0F",
    density: 78,
    dotSize: 137,
    speed: 84,
    arch: { peak: 90, archHeight: 0, thickness: 206, falloff: 600 },
    pointer: { enabled: true, radius: 281, strength: 25 }
  };

  /* ---------- Утилиты ---------- */

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error("PredictiveArc shader:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function parseColor(input, fb) {
    if (!input) return fb;
    var str = String(input).trim();
    if (str.charAt(0) === "#") {
      var hex = str.slice(1);
      if (hex.length === 3 || hex.length === 4) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      if (hex.length >= 6) {
        var r = parseInt(hex.slice(0, 2), 16);
        var g = parseInt(hex.slice(2, 4), 16);
        var b = parseInt(hex.slice(4, 6), 16);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r / 255, g / 255, b / 255];
      }
      return fb;
    }
    var m = str.match(/[\d.]+/g);
    if (m && m.length >= 3) {
      return [
        Math.min(255, parseFloat(m[0])) / 255,
        Math.min(255, parseFloat(m[1])) / 255,
        Math.min(255, parseFloat(m[2])) / 255
      ];
    }
    return fb;
  }

  function clampN(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ---------- Инициализация ---------- */

  function initArc(canvas) {
    var gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false })
          || canvas.getContext("experimental-webgl", { antialias: false, alpha: false, depth: false });

    if (!gl) {
      // WebGL недоступен — оставляем ровный фон, страница не ломается
      canvas.style.background = OPTS.background;
      return;
    }

    var vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) { canvas.style.background = OPTS.background; return; }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("PredictiveArc link:", gl.getProgramInfoLog(prog));
      canvas.style.background = OPTS.background;
      return;
    }
    gl.useProgram(prog);

    // Полноэкранный треугольник
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ["uRes","uTime","uDpr","uCell","uDot","uPeak","uHeight","uThick","uFall",
     "uBg","uBase","uAccent","uHigh","uMouse","uMouseRadius","uMouseStrength"
    ].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    var bg     = parseColor(OPTS.background,  [0.012, 0.012, 0.012]);
    var base   = parseColor(OPTS.baseColor,   [0.49, 0.02, 0.06]);
    var accent = parseColor(OPTS.accentColor, [0.44, 0.06, 0.07]);
    var high   = parseColor(OPTS.highlight,   [0.67, 0.05, 0.06]);

    gl.uniform3fv(U.uBg, bg);
    gl.uniform3fv(U.uBase, base);
    gl.uniform3fv(U.uAccent, accent);
    gl.uniform3fv(U.uHigh, high);

    // Плотность 0…100 → размер ячейки в пикселях (больше плотность — мельче ячейка)
    var baseCell = 26 - (clampN(OPTS.density, 0, 100) / 100) * 18;

    /* Ячейка задана под макет 1440. Без пересчёта на телефоне в кадр
       попадает втрое меньше колонок и сетка выглядит «отзумленной» —
       масштабируем её пропорционально ширине вьюпорта. */
    function cellFor(cssWidth) {
      var k = clampN(cssWidth / 1440, 0.42, 1.25);
      return Math.max(3, baseCell * k);
    }

    function applyCell() {
      var cssW = canvas.getBoundingClientRect().width || 1440;
      var cell = cellFor(cssW);
      gl.uniform1f(U.uCell, cell);
      gl.uniform1f(U.uDot, cell * (clampN(OPTS.dotSize, 10, 300) / 100));
    }
    applyCell();
    gl.uniform1f(U.uPeak,   clampN(OPTS.arch.peak, 0, 200) / 100);
    gl.uniform1f(U.uHeight, clampN(OPTS.arch.archHeight, -200, 200) / 100);
    gl.uniform1f(U.uThick,  clampN(OPTS.arch.thickness, 1, 400) / 100);
    gl.uniform1f(U.uFall,   clampN(OPTS.arch.falloff, 10, 600) / 100);

    var mouse = { x: -9999, y: -9999, strength: 0 };
    gl.uniform1f(U.uMouseRadius, OPTS.pointer.radius);

    var dpr = 1, W = 0, H = 0;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      var w = Math.max(1, Math.round(rect.width  * dpr));
      var h = Math.max(1, Math.round(rect.height * dpr));
      if (w === W && h === H) return;
      W = w; H = h;
      canvas.width = W;
      canvas.height = H;
      gl.viewport(0, 0, W, H);
      gl.uniform2f(U.uRes, W, H);
      gl.uniform1f(U.uDpr, dpr);
      applyCell();
    }

    if (OPTS.pointer.enabled) {
      window.addEventListener("pointermove", function (e) {
        var rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        mouse.strength = clampN(OPTS.pointer.strength, 0, 100) / 100;
      }, { passive: true });

      window.addEventListener("pointerleave", function () {
        mouse.strength = 0;
      }, { passive: true });
    }

    var start = performance.now();
    var running = true;
    var speed = clampN(OPTS.speed, 0, 200) / 100;

    function frame(now) {
      if (!running) return;
      resize();
      gl.uniform1f(U.uTime, ((now - start) / 1000) * speed);
      gl.uniform2f(U.uMouse, mouse.x, mouse.y);
      gl.uniform1f(U.uMouseStrength, mouse.strength);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(frame);
    }

    // Не крутим анимацию, пока вкладка скрыта
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        running = false;
      } else if (!running) {
        running = true;
        start = performance.now() - 1;
        requestAnimationFrame(frame);
      }
    });

    resize();
    requestAnimationFrame(frame);
  }


  /* ============================================================
     Сетка глифов «Sales» — тусклый слой под аркой.
     По мотивам Ripple Study (Originkit): моноширинная сетка букв,
     по которой бежит волна, поднимая яркость.
     Параметры панели: plate "Sales", density 40, glyph 68%,
     wave 302 · 160 · 100.
     ============================================================ */

  function initGlyphs(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var PLATE = "Sales";          // из какого слова берём буквы
    var DENSITY = 40;             // 0…100 → шаг сетки
    var GLYPH = 68;               // % от шага — кегль буквы
    var WAVE = { length: 302, speed: 160, amount: 100 };

    var dpr = 1, W = 0, H = 0;
    var step = 0, font = 0;
    var cols = 0, rows = 0, chars = null;

    function build() {
      // Плотность: больше — мельче ячейка
      step = 34 - (DENSITY / 100) * 18;
      font = step * (GLYPH / 100);
      cols = Math.ceil(W / dpr / step) + 1;
      rows = Math.ceil(H / dpr / step) + 1;

      // Раскладываем буквы слова вразнобой, фиксированно (без мигания при ресайзе)
      chars = new Array(cols * rows);
      var seed = 1337;
      function rnd() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }
      for (var i = 0; i < chars.length; i++) {
        chars[i] = PLATE.charAt(Math.floor(rnd() * PLATE.length));
      }
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(rect.width * dpr));
      var h = Math.max(1, Math.round(rect.height * dpr));
      if (w === W && h === H) return;
      W = w; H = h;
      canvas.width = W;
      canvas.height = H;
      build();
    }

    var start = performance.now();
    var running = true;

    function frame(now) {
      if (!running) return;
      resize();

      var t = (now - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W / dpr, H / dpr);
      ctx.font = font.toFixed(1) + 'px "SF Mono", ui-monospace, Menlo, monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      var phase = t * (WAVE.speed / 1000);
      var amount = WAVE.amount / 100;
      var hPx = H / dpr;

      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var px = x * step + step * 0.5;
          var py = y * step + step * 0.5;

          // Бегущая волна по диагонали
          var w1 = Math.sin((px + py) / WAVE.length - phase * Math.PI * 2);
          var w2 = Math.cos(py / (WAVE.length * 0.6) + phase * Math.PI);
          var wave = (w1 * 0.6 + w2 * 0.4) * 0.5 + 0.5;

          // Буквы ярче внизу, где проходит арка, и гаснут кверху
          var vert = Math.pow(py / hPx, 1.6);

          var alpha = (0.03 + wave * 0.075 * amount) * (0.25 + vert * 0.9);
          if (alpha < 0.012) continue;

          ctx.fillStyle = "rgba(255,255,255," + alpha.toFixed(3) + ")";
          ctx.fillText(chars[y * cols + x], px, py);
        }
      }

      requestAnimationFrame(frame);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        running = false;
      } else if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    });

    resize();
    requestAnimationFrame(frame);
  }

  /* ---------- Мобильное меню ---------- */

  function initMenu() {
    var burger = document.querySelector(".nav__burger");
    var sheet = document.querySelector(".sheet");
    if (!burger || !sheet) return;

    function set(open) {
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      sheet.hidden = !open;
      document.body.classList.toggle("menu-open", open);
    }

    burger.addEventListener("click", function () {
      set(burger.getAttribute("aria-expanded") !== "true");
    });

    sheet.addEventListener("click", function (e) {
      if (e.target.tagName === "A") set(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") set(false);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 720) set(false);
    });
  }


  /* ============================================================
     ПРЕЛОАДЕР — OrbConverge (Originkit), портирован с React.
     Сфера из точек ритмично схлопывается в кольцо и обратно.
     Пресет: dotColor #FFFFFF (белые, тонкие), dotSize 52, speed 34,
     spread 100, turn 0, tilt 0, drag 100, damping 20.
     ============================================================ */

  function initOrb(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    var TAU = Math.PI * 2;
    var PERIOD = 4.8;
    var BASE_SPREAD = 0.3;
    var PERSPECTIVE = 3.5;
    var MIN_RADIUS = 0.6;
    var MAX_DOTS = 1024;

    var P = {
      dot: "#FFFFFF",
      density: 300 / 100,
      dotSize: 52 / 100,
      speed: 34 / 50,
      spinTurns: 1,
      spread: 100 / 100,
      turn: 0,
      tilt: 0,
      drag: 100 / 100,
      damping: 20
    };

    function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
    function clampN(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
    function bump(x) { return 0.5 - 0.5 * Math.cos(TAU * clamp01(x)); }

    // Точки распределяются по сфере спиралью Фибоначчи — ложатся равномерно
    function fib(i, n) {
      var y = 1 - (i / Math.max(1, n - 1)) * 2;
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var th = 2.399963 * i;
      return [Math.cos(th) * r, y, Math.sin(th) * r];
    }

    function polar(p) {
      return [Math.acos(Math.max(-1, Math.min(1, p[1]))), Math.atan2(p[2], p[0])];
    }

    function spin(p, yaw, pitch) {
      var ca = Math.cos(yaw), sa = Math.sin(yaw);
      var rx = p[0] * ca - p[2] * sa;
      var rz = p[0] * sa + p[2] * ca;
      var co = Math.cos(pitch), so = Math.sin(pitch);
      var ry = p[1] * co - rz * so;
      rz = p[1] * so + rz * co;
      return [rx, ry, rz, p[3], p[4]];
    }

    // t = 0…1 — фаза схлопывания: сфера → кольцо → сфера
    function buildFrame(t, out) {
      var n = Math.max(1, Math.round(150 * P.density));
      var k = bump(t);
      for (var i = 0; i < n; i++) {
        var p = polar(fib(i, n));
        var th = p[0] + (Math.PI / 2 - p[0]) * k;
        var sr = Math.sin(th);
        out.push(spin(
          [Math.cos(p[1]) * sr, Math.cos(th), Math.sin(p[1]) * sr, 0.8 + 0.5 * k, 0.9],
          TAU * t, 0.4
        ));
      }
    }

    function project(pts, size, yaw, pitch, phase, emit) {
      var c = size / 2;
      var R = size * BASE_SPREAD * P.spread;
      var pv = PERSPECTIVE;
      var ds = dotScaleFor(size) * P.dotSize;
      var y2 = yaw + TAU * P.spinTurns * phase;
      var list = [];
      for (var i = 0; i < pts.length; i++) {
        var q = spin(pts[i], y2, pitch);
        var z = q[2];
        var s = pv / (pv - z);
        var f = clamp01((z + 1.1) / 2.2);
        list.push([
          c + q[0] * R * s,
          c + q[1] * R * s,
          ds * (0.4 + 1.6 * f) * s * (q[3] === undefined ? 1 : q[3]),
          (0.07 + 0.93 * Math.pow(f, 1.55)) * (q[4] === undefined ? 1 : q[4]),
          z
        ]);
      }
      // дальние точки рисуем первыми
      list.sort(function (a, b) { return a[4] - b[4]; });
      for (var j = 0; j < list.length; j++) emit(list[j][0], list[j][1], list[j][2], list[j][3]);
    }

    function dotScaleFor(size) {
      if (size <= 46) return 0.4;
      if (size <= 190) return 0.4 + ((size - 46) / 144) * 0.6;
      if (size <= 340) return 1 + ((size - 190) / 150) * 0.55;
      return 1.55;
    }

    // Подгоняем масштаб, чтобы сфера не вылезала за холст ни в одной фазе
    var fitCache = null;
    function autoFit(size) {
      if (fitCache && fitCache.size === size) return fitCache.fit;
      var half = size / 2, ext = 0;
      for (var k = 0; k < 20; k++) {
        var t = k / 20;
        var out = [];
        buildFrame(t, out);
        project(out, size, P.turn, P.tilt, t, function (x, y, r, a) {
          if (a <= 0.05 || r <= 0.15) return;
          ext = Math.max(ext, Math.abs(x - half) + 0.5 * r, Math.abs(y - half) + 0.5 * r);
        });
      }
      var fit = ext > 1 ? Math.max(0.55, Math.min(1.7, (0.415 * size) / ext)) : 1;
      fitCache = { size: size, fit: fit };
      return fit;
    }

    var drag = { active: false, lx: 0, ly: 0, lt: 0, yaw: 0, pitch: 0, vx: 0, vy: 0 };
    var phase = 0, last = performance.now(), raf = 0, alive = true;

    function render(now) {
      if (!alive) return;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var cw = canvas.clientWidth || 300;
      var ch = canvas.clientHeight || 300;
      var bw = Math.max(1, Math.round(cw * dpr));
      var bh = Math.max(1, Math.round(ch * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
        fitCache = null;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      phase = (phase + (dt * P.speed) / PERIOD) % 1;
      if (phase < 0) phase += 1;

      var size = Math.max(4, Math.min(cw, ch));
      var bx = (cw - size) / 2, by = (ch - size) / 2;

      if (!drag.active) {
        var decay = Math.exp(-P.damping * 0.12 * dt);
        drag.yaw += drag.vx * dt;
        drag.pitch += drag.vy * dt;
        drag.vx *= decay;
        drag.vy *= decay;
      }
      drag.pitch = clampN(drag.pitch, -Math.PI / 2 - P.tilt, Math.PI / 2 - P.tilt);

      var fit = autoFit(size);
      var half = size / 2;
      var out = [];
      buildFrame(phase, out);

      var drawn = 0;
      ctx.fillStyle = P.dot;
      project(out, size, P.turn + drag.yaw, P.tilt + drag.pitch, phase,
        function (x, y, r, a) {
          if (drawn >= MAX_DOTS) return;
          var rr = r * (0.55 + 0.45 * fit);
          if (rr <= 0.05 || a <= 0.004) return;
          var cx = bx + half + (x - half) * fit;
          var cy = by + half + (y - half) * fit;
          var dr = rr, da = Math.min(1, a);
          if (dr < MIN_RADIUS) {
            da *= (dr / MIN_RADIUS) * (dr / MIN_RADIUS);
            dr = MIN_RADIUS;
          }
          ctx.globalAlpha = da;
          ctx.beginPath();
          ctx.arc(cx, cy, dr, 0, TAU);
          ctx.fill();
          drawn++;
        });
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(render);
    }

    // Сферу можно крутить мышью
    function onDown(e) {
      if (P.drag <= 0) return;
      drag.active = true;
      drag.lx = e.clientX; drag.ly = e.clientY;
      drag.lt = performance.now();
      drag.vx = 0; drag.vy = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMove(e) {
      if (!drag.active) return;
      var k = (P.drag * TAU) / Math.max(1, canvas.clientWidth || 300);
      var dx = (e.clientX - drag.lx) * k;
      var dy = (e.clientY - drag.ly) * k;
      var now2 = performance.now();
      var span = Math.max(1, now2 - drag.lt);
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now2;
      drag.yaw -= dx;
      drag.pitch += dy;
      drag.vx = (-dx / span) * 1000;
      drag.vy = (dy / span) * 1000;
    }
    function onUp() { drag.active = false; }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    raf = requestAnimationFrame(render);

    return function stop() {
      alive = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }

  /* ---------- Логика ухода прелоадера ---------- */

  function initPreloader() {
    var node = document.getElementById("preloader");
    if (!node) return;

    var canvas = node.querySelector(".preloader__canvas");
    var stop = canvas ? initOrb(canvas) : null;

    var MIN_SHOW = 1400;   // сфера должна успеть отыграть фазу
    var MAX_WAIT = 6000;   // страховка: не держим дольше
    var began = performance.now();
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;

      var wait = Math.max(0, MIN_SHOW - (performance.now() - began));
      setTimeout(function () {
        node.classList.add("is-done");
        // герой стартует только теперь — иначе анимация отыграет под прелоадером
        document.body.classList.remove("is-loading");
        setTimeout(function () {
          if (stop) stop();
          if (node.parentNode) node.parentNode.removeChild(node);
        }, 700);
      }, wait);
    }

    var ready = document.fonts && document.fonts.ready
      ? document.fonts.ready
      : Promise.resolve();

    ready.then(finish);
    window.addEventListener("load", finish);
    setTimeout(finish, MAX_WAIT);
  }

  /* ---------- Старт ---------- */

  initPreloader();

  var glyphCanvas = document.querySelector(".hero__glyphs");
  if (glyphCanvas) initGlyphs(glyphCanvas);

  var canvas = document.querySelector(".hero__bg");
  if (canvas) initArc(canvas);
  initMenu();
})();
