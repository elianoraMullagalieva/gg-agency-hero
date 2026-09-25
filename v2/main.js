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
    speed: 118,
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
      // На узких экранах ячейка ужималась до 0.42 от базовой: точки
      // мельчали до неразличимых, а волна шла через вдвое большее
      // число ячеек — движение читалось как замедленное. Держим
      // сетку крупной, чтобы декор и амплитуда были видны.
      var k = clampN(cssWidth / 1440, 1.15, 1.25);
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

    // iOS Safari выгружает WebGL-контекст при нехватке памяти или
    // возврате из фона: без этого фон навсегда застывал ровной
    // заливкой, хотя страница выглядела рабочей.
    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      running = false;
    }, false);

    canvas.addEventListener("webglcontextrestored", function () {
      initArc(canvas);
    }, false);

    // Возврат на вкладку из фона на мобильных не всегда шлёт
    // visibilitychange — подстраховываемся pageshow.
    window.addEventListener("pageshow", function () {
      if (!running && !document.hidden) {
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

    // Мобильный Safari при возврате из фона не всегда шлёт
    // visibilitychange — иначе волна оставалась застывшей.
    window.addEventListener("pageshow", function () {
      if (!running && !document.hidden) {
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
      if (e.key !== "Escape") return;
      var wasOpen = burger.getAttribute("aria-expanded") === "true";
      set(false);
      // Меню закрылось — фокус не должен остаться на скрытом пункте,
      // иначе следующий Tab уводит в начало страницы.
      if (wasOpen) burger.focus();
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

  // Тот же фон переиспользуется в блоке схемы
  document.querySelectorAll(".hero__glyphs").forEach(initGlyphs);

  document.querySelectorAll(".hero__bg").forEach(initArc);
/* Аккордеон услуг — та же механика, что у вопросов. */
/* Поочерёдное появление строк «Где утекают деньги». */
/* Кейс: цифры докручиваются от нуля при появлении секции. */
  function initCase() {
    var sec = document.querySelector(".case-sec");
    if (!sec) return;

    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    function run() {
      sec.classList.add("is-in");
      if (reduce) return;
      sec.querySelectorAll("[data-count]").forEach(function (el) {
        var target = parseFloat(el.getAttribute("data-count"));
        var pre = el.getAttribute("data-prefix") || "";
        var suf = el.getAttribute("data-suffix") || "";
        var t0 = null;
        function step(now) {
          if (!t0) t0 = now;
          var k = Math.min(1, (now - t0) / 1100);
          var e = 1 - Math.pow(1 - k, 3);
          el.textContent = pre + Math.round(target * e) + suf;
          if (k < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }

    if (!("IntersectionObserver" in window)) { run(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { run(); io.disconnect(); }
      });
    }, { threshold: 0.2 });
    io.observe(sec);
  }

/* Появление карточек блока «Какая у вас ситуация» */
/* Одометр: каждая цифра — барабан, прокручивается к своему знаку.
     Соседние разряды стартуют с разной задержкой, поэтому число
     «собирается», а не переключается разом. */
  var ODO_TURNS   = 2;   // базовых полных оборота барабана
  var ODO_STAGGER = 75;  // мс между разрядами, справа налево

  function initOdometer() {
    var vals = document.querySelectorAll(".stat__value");
    if (!vals.length) return;

    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    function build(el) {
      if (el.dataset.odoReady) return;
      // Исходное значение запоминаем до перестройки: после неё
      // textContent соберёт все цифры барабанов.
      var text = (el.dataset.odoValue || el.textContent).trim();
      el.dataset.odoValue = text;
      el.dataset.odoReady = "1";
      // Сколько цифр в числе — столько барабанов; правый крутится
      // дольше левого, как в эталоне (там младшие разряды проходят
      // заметно больше полных циклов, чем старшие).
      var total = 0, j;
      for (j = 0; j < text.length; j++) if (text[j] >= "0" && text[j] <= "9") total++;

      var out = "", idx = 0;
      for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        if (ch >= "0" && ch <= "9") {
          // Полные обороты до остановки: база 2 плюс по одному на разряд
          // вправо. Без них барабан «130+» на нуле не двигался вовсе.
          var turns = ODO_TURNS + idx;
          var steps = turns * 10 + parseInt(ch, 10);
          var reel = "";
          for (var n = 0; n <= steps; n++) reel += "<span>" + (n % 10) + "</span>";
          out += '<span class="odo" data-d="' + ch + '" data-steps="' + steps +
                 '" data-i="' + idx + '" data-n="' + total + '"><span class="odo__reel">' +
                 reel + "</span></span>";
          idx++;
        } else {
          out += "<span>" + ch + "</span>";
        }
      }
      // Барабаны — картинка: в textContent попало бы «012345…».
      // Настоящее значение отдаём скринридеру отдельной строкой.
      el.innerHTML = '<span class="odo-a11y">' + text + "</span>" +
                     '<span aria-hidden="true">' + out + "</span>";
    }

    function run(el) {
      var odos = el.querySelectorAll(".odo");
      odos.forEach(function (o, i) {
        var steps = parseInt(o.dataset.steps, 10);
        var n     = parseInt(o.dataset.n, 10) || 1;
        var reel  = o.querySelector(".odo__reel");
        /* Шаг в целых пикселях. В em он дробный, а Safari округляет окно
           обрезки до целого — за два десятка шагов набегало смещение и
           в окне оказывались половинки соседних цифр. */
        var unit = Math.round(parseFloat(getComputedStyle(o).fontSize));
        o.style.height = unit + "px";
        var digits = reel.children;
        for (var q = 0; q < digits.length; q++) digits[q].style.height = unit + "px";
        reel.style.transform = "translateY(0)";
        // Первым трогается младший разряд, последним — старший:
        // в эталоне левая цифра замирает на ~130 мс позже правой.
        setTimeout(function () {
          reel.style.transform = "translateY(-" + (steps * unit) + "px)";
        }, 80 + (n - 1 - i) * ODO_STAGGER);
      });
    }

    vals.forEach(build);

    if (reduce || !("IntersectionObserver" in window)) {
      vals.forEach(function (el) {
        var slots = el.querySelectorAll(".odo");
        el.querySelectorAll(".odo__reel").forEach(function (r, i) {
          r.style.transition = "none";
          r.style.transform = "translateY(-" + slots[i].dataset.steps + "em)";
        });
      });
      return;
    }

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target;
        // Ждём ухода прелоадера: иначе барабаны докручиваются,
        // пока экран ещё закрыт, и человек видит готовые цифры.
        if (document.body.classList.contains("is-loading")) {
          var wait = setInterval(function () {
            if (!document.body.classList.contains("is-loading")) {
              clearInterval(wait);
              setTimeout(function () { run(el); }, 260);
            }
          }, 80);
        } else {
          run(el);
        }
      });
    }, { threshold: 0.6 });
    vals.forEach(function (el) { io.observe(el); });
  }

/* Радиальная лента: дуга, повторы и угол хода считаются от кегля.
     Эталон Osmo — R ≈ 1.26 × ширины окна, прогиб ≈ 10% ширины,
     ход ≈ 240 px/с при ширине 1440. Текст едет по дуге, дуга стоит. */
  /* Бегущая строка клиентов: текст едет по волне (эталон — Text Path).
     Шов повтора невидим только тогда, когда ход за цикл равен
     ОДНОВРЕМЕННО длине одного повтора текста и целому числу периодов
     волны. Поэтому период подбирается от измеренного текста, а не
     задаётся руками: иначе при любом кегле шов вылезает в кадр. */
  function initClientsWave() {
    var svg = document.querySelector(".clients__svg");
    if (!svg) return;
    var tp   = svg.querySelector("textPath");
    var path = svg.querySelector("#clientsWave");
    var spin = svg.querySelector(".clients__spin");
    var text = svg.querySelector(".clients__text");
    if (!tp || !path || !spin || !text) return;

    var NS    = "http://www.w3.org/2000/svg";
    /* viewBox совпадает с реальной шириной: font-size внутри SVG
       задаётся в ЕДИНИЦАХ viewBox, а не в пикселях. При жёстком
       viewBox 1440 на мобиле масштаб 0.27 и текст рисовался в 3.8px. */
    var VW    = 1440;
    var SPEED = parseFloat(svg.dataset.waveSpeed) || 56; // единиц viewBox в секунду
    var AMP_K = 0;       // 0 — строка ровная. Волну убрали, путь прямой.

    /* Разделитель с вшитыми полукруглыми шпациями: просвет между
       именами всегда одинаковый, а обычные пробелы внутри имён
       («Pixel School») остаются нормальными. word-spacing так нельзя —
       он раздвигает и те, и другие. */
    /* Имена и разделители — отдельные tspan: только так точку можно
       покрасить отдельно от названия. Шпации вшиты в разделитель,
       поэтому просвет между брендами ровный, а пробелы внутри имён
       («Pixel School») остаются обычными. */
    var SEP = "\u2002·\u2002";
    var names = (svg.dataset.waveNames || tp.textContent)
      .split(/\s*·\s*/).map(function (n) { return n.replace(/\s+/g, " ").trim(); })
      .filter(Boolean);
    svg.dataset.waveNames = names.join(" · ");

    function markup(times) {
      var out = "", i, j;
      for (i = 0; i < times; i++)
        for (j = 0; j < names.length; j++)
          out += "<tspan>" + names[j] + "</tspan>" +
                 '<tspan class="clients__dot">' + SEP + "</tspan>";
      return out;
    }

    var period = 0;   // длина одного повтора вдоль пути

    /* Волна из полупериодов: Q рисует первый горб, T зеркалит остальные.
       Вершина квадратичной кривой лежит на полпути к контрольной точке,
       поэтому смещение контроля берём вдвое больше амплитуды. */
    function wave(x0, base, h, a, segs) {
      var d = "M " + x0 + " " + base +
              " Q " + (x0 + h / 2) + " " + (base - 2 * a) +
              " "   + (x0 + h)     + " " + base;
      for (var i = 2; i <= segs; i++) d += " T " + (x0 + i * h) + " " + base;
      return d;
    }

    // Во сколько раз дуга волны длиннее своей проекции на X.
    // Форма подобна при любом периоде, поэтому меряем один раз.
    var stretch = 0;
    function measureStretch() {
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", wave(0, 200, 100, 100 * AMP_K, 2));
      p.setAttribute("fill", "none");
      svg.appendChild(p);
      var L = p.getTotalLength();
      svg.removeChild(p);
      return L / 200;
    }

    function layout() {
      var w = svg.getBoundingClientRect().width;
      if (!w) return;
      VW = Math.round(w);          // единица viewBox == пиксель
      var fs = parseFloat(getComputedStyle(text).fontSize);

      /* Длину повтора меряем отдельным зондом обычным текстом:
         getComputedTextLength() на textPath не учитывает содержимое
         вложенных tspan и занижает результат втрое. */
      var probe = document.createElementNS(NS, "text");
      probe.setAttribute("class", text.getAttribute("class") || "");
      probe.setAttribute("x", "-99999");
      probe.textContent = names.join(SEP) + SEP;
      svg.appendChild(probe);
      var rep = probe.getComputedTextLength();
      svg.removeChild(probe);
      if (!rep) return;
      if (!stretch) stretch = measureStretch();

      // Полупериод ≈ 3.6 кегля — пропорция из эталона (180 при кегле 50).
      // Округляем до чётного, чтобы волна закончилась в той же фазе.
      var repX = rep / stretch;                                  // тот же повтор по оси X
      var segs = Math.max(2, Math.round(repX / (fs * 3.6) / 2) * 2);
      var h     = repX / segs;                                   // полупериод
      var a     = h * AMP_K;                                     // амплитуда
      var shift = repX;                                          // ход за цикл

      // Базовая линия ниже, бокс выше: выносные элементы должны
      // помещаться целиком, иначе при клиппинге срежет верхушки.
      var base = a + fs * 1.22;
      var H    = Math.ceil(base + a + fs * 0.36);

      // Путь начинается левее кадра и кончается правее: текст скользит
      // ВДОЛЬ него, поэтому запас нужен с обеих сторон.
      var x0    = -shift;
      var total = VW + 2 * shift;
      path.setAttribute("d", wave(x0, base, h, a, Math.ceil(total / h)));

      // Текста должно хватить на весь путь плюс один ход — иначе к концу
      // цикла правый край пустеет.
      var pathLen = path.getTotalLength();
      tp.innerHTML = markup(Math.ceil((pathLen + rep) / rep) + 1);

      svg.setAttribute("viewBox", "0 0 " + VW + " " + H);
      // Ход за цикл — ровно один повтор текста. Путь прямой, поэтому
      // сдвиг по X равен длине повтора и шов не виден.
      period = rep;
      spin.style.setProperty("--wave-shift", (-repX).toFixed(2) + "px");
      spin.style.setProperty("--wave-dur",   (repX / SPEED).toFixed(3) + "s");
    }

    layout();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

    /* Ход строки — CSS-сдвиг группы. Путь прямой, наклон у всех глифов
       нулевой, поэтому пересчитывать их положение покадрово незачем:
       transform уходит на композитор и не трогает раскладку текста. */
    var still = matchMedia("(prefers-reduced-motion: reduce)");
    function sync() {
      spin.style.animationPlayState =
        (still.matches || !visible || document.hidden) ? "paused" : "running";
    }

    var visible = true;
    if ("IntersectionObserver" in window) {
      visible = false;
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        sync();
      }, { rootMargin: "120px" }).observe(svg);
    }
    document.addEventListener("visibilitychange", sync);
    if (still.addEventListener) still.addEventListener("change", sync);
    sync();

    var t;
    addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(layout, 160);
    });
  }




  /* Стопка «Кто и как продаёт». Карточки наезжают снизу одна на другую.
     Версия --lock держит страницу, пока стопка не собралась; --flow
     собирает её за проход блока через кадр. Обе считают одно и то же:
     сколько карточек уже село. */
  function initStack(sec) {
    var list = sec.querySelector(".stack__list");
    var cards = [].slice.call(sec.querySelectorAll(".stack__card"));
    if (!list || cards.length < 2) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (matchMedia("(max-width: 900px)").matches) return;

    var lock = sec.classList.contains("stack--lock");
    var n = cards.length, peek = 0, cardH = 0, cur = 0, raf = 0;

    function measure() {
      peek = parseFloat(getComputedStyle(cards[0]).getPropertyValue("--peek")) ||
             parseFloat(getComputedStyle(document.documentElement).fontSize) * 4.5;
      cardH = cards[0].offsetHeight;
      list.style.height = (cardH + (n - 1) * peek) + "px";
      if (lock) {
        // Экран на вход плюс по экрану на каждую приезжающую карточку
        sec.style.height = (window.innerHeight * (1 + (n - 1) * 0.72)) + "px";
      }
    }

    function goal() {
      var r = sec.getBoundingClientRect(), vh = window.innerHeight;
      var p;
      if (lock) {
        p = -r.top / Math.max(1, sec.offsetHeight - vh);
      } else {
        p = (vh - r.top) / (vh + r.height);
      }
      return Math.min(Math.max(p, 0), 1) * (n - 1);
    }

    function paint() {
      for (var i = 0; i < n; i++) {
        // local: 0 — карточка ещё внизу, 1 — села на место
        var local = Math.min(Math.max(cur - (i - 1), 0), 1);
        if (i === 0) local = 1;
        /* Посадка с перелётом: карточка проскакивает место и
           возвращается — тот самый bounce из эталона. */
        var e = local < 1
          ? 1 - Math.pow(1 - local, 3)
          : 1;
        var over = Math.sin(Math.min(local, 1) * Math.PI) * 0.06 * (1 - local);
        var y = (1 - e - over) * (window.innerHeight * 0.75);
        var tilt = (1 - local) * (i % 2 ? 1.6 : -1.6);
        cards[i].style.transform = "translate3d(0," + y.toFixed(1) + "px,0) rotate(" + tilt.toFixed(2) + "deg)";
        cards[i].style.opacity = local > 0.02 || i === 0 ? 1 : 0;
      }
    }

    function loop() {
      var to = goal();
      cur += (to - cur) * 0.16;
      if (Math.abs(to - cur) < 0.004) cur = to;
      paint();
      var r = sec.getBoundingClientRect();
      if (r.bottom > -200 && r.top < window.innerHeight + 200) {
        raf = requestAnimationFrame(loop);
      } else { raf = 0; }
    }
    function wake() { if (!raf) raf = requestAnimationFrame(loop); }

    measure();
    cur = goal();
    paint();
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", function () { measure(); wake(); });
    wake();
  }


  /* Подпись студии в углу схемы: набирается и стирается по кругу.
     Идёт только пока блок в кадре — за экраном таймер ни к чему. */
  function initVennMark() {
    var el = document.querySelector(".venn-mark__type");
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = "GG Agency";
      return;
    }
    var WORD = "GG Agency";
    var i = 0, back = false, timer = 0, live = false;

    function step() {
      if (!live) return;
      el.textContent = WORD.slice(0, i);
      var wait = back ? 55 : 110;
      if (!back && i === WORD.length) { back = true; wait = 1900; }
      else if (back && i === 0) { back = false; wait = 700; }
      else { i += back ? -1 : 1; }
      timer = setTimeout(step, wait);
    }

    var sec = document.querySelector(".venn-sec");
    if (!("IntersectionObserver" in window)) { live = true; step(); return; }
    new IntersectionObserver(function (es) {
      live = es[0].isIntersecting && !document.hidden;
      clearTimeout(timer);
      if (live) step();
    }, { threshold: 0 }).observe(sec || el);
  }


  /* Лента «Наш подход»: две карточки в кадре, третья выглядывает.
     Прокрутка блока доводит её до края. Без липкой фиксации — блок
     не во весь экран, и второй замок подряд читался бы как заедание. */
  function initApproach() {
    var rail = document.querySelector(".approach__rail");
    var sec  = document.querySelector(".approach");
    if (!rail || !sec) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (matchMedia("(max-width: 1000px)").matches) return;

    var max = 0, cur = 0, raf = 0;

    function measure() { max = Math.max(0, rail.scrollWidth - rail.clientWidth); }

    function goal() {
      /* Отсчёт от момента, когда блок уже встал по центру: до этого
         r.top >= 0 и ход равен нулю. Раньше лента начинала ехать,
         пока блок только выходил снизу, и первая карточка уползала
         ещё до того, как до неё доходили глазами. */
      var r = sec.getBoundingClientRect();
      // 0.85 — чтобы лента доезжала до упора чуть раньше, чем блок
      // отпускает экран, а не на самом последнем пикселе.
      var run = Math.max(1, (sec.offsetHeight - window.innerHeight) * 0.85);
      var p = -r.top / run;
      return Math.min(Math.max(p, 0), 1) * max;
    }

    function loop() {
      var to = goal();
      cur += (to - cur) * 0.12;
      if (Math.abs(to - cur) < 0.4) cur = to;
      rail.scrollLeft = cur;
      var r = sec.getBoundingClientRect();
      if (r.bottom > -200 && r.top < window.innerHeight + 200) {
        raf = requestAnimationFrame(loop);
      } else { raf = 0; }
    }
    function wake() { if (!raf) raf = requestAnimationFrame(loop); }

    measure();
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", function () { measure(); wake(); });
    wake();
  }

  function initStacks() {
    [].forEach.call(document.querySelectorAll(".stack"), initStack);
  }

  /* Веер источников: запускается, когда блок входит в кадр */
  function initFan() {
    var sec = document.querySelector(".sources");
    if (!sec) return;
    if (!("IntersectionObserver" in window)) { sec.classList.add("is-in"); return; }
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { sec.classList.add("is-in"); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(sec);
  }

  function initCards() {
    var sec = document.querySelector(".situation");
    if (!sec) return;
    if (!("IntersectionObserver" in window)) { sec.classList.add("is-in"); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { sec.classList.add("is-in"); io.disconnect(); }
      });
    }, { threshold: 0.15 });
    io.observe(sec);
  }

  /* Липкая лента: пока блок закреплён, прокрутка гонит карточки
     вбок. Когда последняя встала по краю сетки — блок отпускает. */
  function initLeaks() {
    var sec = document.querySelector(".leaks");
    if (!sec) return;
    var rail = sec.querySelector(".leaks-rail");
    if (!rail) return;

    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var narrow = matchMedia("(max-width: 900px)").matches;
    if (reduce || narrow) return;

    var RUN = 3.2;   // во сколько раз путь прокрутки длиннее хода ленты
    var max = 0, hold = 0, cur = 0, raf = 0;

    function measure() {
      var cs  = getComputedStyle(rail);
      var gut = parseFloat(cs.paddingLeft) || 0;
      var gap = parseFloat(cs.columnGap) || 0;
      var vw  = window.innerWidth;

      /* Ширину карточки считаем от экрана, а не наоборот: в кадре
         должны стоять ровно четыре карточки и краешек пятой (7.8%
         ширины экрана — пропорция макета). На любом мониторе стартовый
         кадр выглядит одинаково, а прокрутка всегда имеет что везти. */
      var peek = vw * 0.078;
      var w = (vw - gut - 4 * gap - peek) / 4;
      rail.style.setProperty("--leak-w", w.toFixed(2) + "px");

      /* Чётные карточки подняты на 12.8% своей высоты, и этот подъём
         растёт вместе с шириной экрана. Резервируем его отступом сверху,
         иначе на широких и низких окнах они лезут на подзаголовок. */
      rail.style.paddingTop = (w * (446 / 301) * 0.128).toFixed(1) + "px";

      // Сколько ленты не влезло: последняя карточка должна встать
      // ровно по правому полю сетки.
      max = Math.max(0, rail.scrollWidth - window.innerWidth);

      /* Пауза на входе: первый экран прокрутки блок просто стоит —
         стартовый кадр успевают прочесть. Дальше путь растянут в RUN
         раз: при ходе 1:1 один щелчок колеса уносил карточку целиком. */
      hold = window.innerHeight * 0.45;
      sec.style.height = (window.innerHeight + hold + max * RUN) + "px";
    }

    function target() {
      var r = sec.getBoundingClientRect();
      var p = (-r.top - hold) / (max * RUN);
      return Math.min(Math.max(p, 0), 1) * max;
    }

    /* Ход сглажен: позиция догоняет цель по экспоненте, поэтому лента
       не дёргается на каждом щелчке колеса, а доезжает. */
    function loop() {
      var to = target();
      cur += (to - cur) * 0.14;
      if (Math.abs(to - cur) < 0.4) cur = to;
      rail.style.transform = "translate3d(" + (-cur).toFixed(2) + "px,0,0)";
      var r = sec.getBoundingClientRect();
      var near = r.bottom > -200 && r.top < window.innerHeight + 200;
      if (near) { raf = requestAnimationFrame(loop); } else { raf = 0; rail.style.transform = "translate3d(" + (-to) + "px,0,0)"; cur = to; }
    }

    function wake() {
      if (!raf) raf = requestAnimationFrame(loop);
    }

    measure();
    cur = target();
    rail.style.transform = "translate3d(" + (-cur) + "px,0,0)";
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", function () { measure(); wake(); });
    wake();
  }

  function initServices() {
    var triggers = document.querySelectorAll(".services-trigger");
    if (!triggers.length) return;

    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        var item = trigger.closest(".services-item");
        var isOpen = item.classList.contains("is-open");

        document.querySelectorAll(".services-item").forEach(function (el) {
          el.classList.remove("is-open");
          var t = el.querySelector(".services-trigger");
          if (t) t.setAttribute("aria-expanded", "false");
        });

        if (!isOpen) {
          item.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  function initQuestions() {
    var triggers = document.querySelectorAll(".questions-trigger");
    if (!triggers.length) return;

    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        var item = trigger.closest(".questions-item");
        var isOpen = item.classList.contains("is-open");

        document.querySelectorAll(".questions-item").forEach(function (el) {
          el.classList.remove("is-open");
          var t = el.querySelector(".questions-trigger");
          if (t) t.setAttribute("aria-expanded", "false");
        });

        if (!isOpen) {
          item.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
        }
      });
    });
  }


  /* ============================================================
     Схема трёх опор: точки стягиваются к центру пересечения,
     контуры прочерчиваются при входе секции в экран.
     ============================================================ */

/* Плоская версия схемы: появление по скроллу. */
  function initVennFlat() {
    var el = document.querySelector(".venn__flat");
    if (!el) return;
    if (!("IntersectionObserver" in window)) { el.classList.add("on"); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { el.classList.add("on"); io.disconnect(); }
      });
    }, { threshold: 0.25 });
    io.observe(el);
  }

  function initVenn() {
    var venn = document.querySelector(".venn");
    if (!venn) return;

    if (!("IntersectionObserver" in window)) {
      venn.classList.add("is-in");
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          venn.classList.add("is-in");
          io.disconnect();
        }
      });
    }, { threshold: 0.25 });

    io.observe(venn);
  }


  /* ============================================================
     Лента скринов переписок: шаг раз в 3 секунды, с начала после
     последней карточки. Пауза при наведении и касании, ничего
     не крутится за пределами экрана и при prefers-reduced-motion.
     ============================================================ */

  function initShots() {
    var shots = document.querySelector("[data-shots]");
    if (!shots) return;

    var track = shots.querySelector(".shots__track");
    if (!track) return;

    var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    var STEP_MS = 3000;
    var timer = null;
    var paused = false;
    var visible = false;

    function step() {
      if (paused || !visible) return;

      var item = track.querySelector(".shot");
      if (!item) return;

      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      var delta = item.getBoundingClientRect().width + gap;
      var max = shots.scrollWidth - shots.clientWidth;

      // допуск в 2px: дробный scrollLeft иначе не даёт вернуться в начало
      if (shots.scrollLeft >= max - 2) {
        shots.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        shots.scrollTo({ left: shots.scrollLeft + delta, behavior: "smooth" });
      }
    }

    function start() {
      if (timer) return;
      timer = window.setInterval(step, STEP_MS);
    }

    function stop() {
      if (!timer) return;
      window.clearInterval(timer);
      timer = null;
    }

    function pause() { paused = true; }
    function resume() { paused = false; }

    shots.addEventListener("mouseenter", pause);
    shots.addEventListener("mouseleave", resume);
    shots.addEventListener("focusin", pause);
    shots.addEventListener("focusout", resume);
    shots.addEventListener("touchstart", pause, { passive: true });
    shots.addEventListener("touchend", resume, { passive: true });

    // ручная прокрутка тоже считается касанием: не дёргаем ленту под рукой
    shots.addEventListener("pointerdown", pause);
    window.addEventListener("pointerup", resume);

    if (motionQuery.addEventListener) {
      motionQuery.addEventListener("change", function (e) {
        if (e.matches) stop(); else if (visible) start();
      });
    }

    if (!("IntersectionObserver" in window)) {
      visible = true;
      start();
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        visible = e.isIntersecting;
        if (visible) start(); else stop();
      });
    }, { threshold: 0.2 });

    io.observe(shots);
  }

  initMenu();
  initVenn();
  initVennFlat();
  initQuestions();
  initServices();
  initLeaks();
  initVennMark();
  initApproach();
  initFan();
  initStacks();
  initCards();
  initOdometer();
  initClientsWave();
  initCase();
  initShots();
})();

/* --- Выравнивание заголовков карточек --- */
/* Блок текста карточки прижат к её низу, поэтому верх заголовка
   зависит от высоты всего, что лежит ниже. Описание у разных карточек
   переносится на разное число строк (1180px: 2 и 4 строки), и заголовки
   расходились до 45px. Резервируем по ряду одинаковую высоту заголовка
   и описания — верх заголовка совпадает у всех карточек ряда.
   Только min-height: содержимое и порядок DOM не трогаем. */
(function () {
  var PARTS = [".card__name", ".card__note"];

  function rows(cards) {
    // группируем по фактическому ряду сетки: offsetTop с допуском 2px
    var map = [];
    cards.forEach(function (c) {
      var t = c.offsetTop;
      var row = null;
      for (var i = 0; i < map.length; i++) {
        if (Math.abs(map[i].top - t) <= 2) { row = map[i]; break; }
      }
      if (!row) { row = { top: t, items: [] }; map.push(row); }
      row.items.push(c);
    });
    return map;
  }

  function align() {
    var cards = [].slice.call(document.querySelectorAll(".situation .card"));
    if (!cards.length) return;

    // сбрасываем прошлый резерв, иначе высоты только растут
    cards.forEach(function (c) {
      PARTS.forEach(function (sel) {
        var el = c.querySelector(".card__face--front " + sel);
        if (el) el.style.minHeight = "";
      });
    });

    rows(cards).forEach(function (row) {
      PARTS.forEach(function (sel) {
        var els = row.items.map(function (c) {
          return c.querySelector(".card__face--front " + sel);
        }).filter(Boolean);
        if (els.length < 2) return;
        var max = 0;
        els.forEach(function (el) {
          var h = el.getBoundingClientRect().height;
          if (h > max) max = h;
        });
        els.forEach(function (el) { el.style.minHeight = max.toFixed(2) + "px"; });
      });
    });
  }

  function schedule() {
    // два кадра: после перерасчёта шрифта и после раскладки сетки
    requestAnimationFrame(function () { requestAnimationFrame(align); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  window.addEventListener("load", schedule);

  if ("ResizeObserver" in window) {
    var list = document.querySelector(".situation .cards");
    if (list) {
      var busy = false;
      new ResizeObserver(function () {
        if (busy) return;
        busy = true;
        requestAnimationFrame(function () { busy = false; align(); });
      }).observe(list);
    }
  } else {
    window.addEventListener("resize", schedule);
  }
})();
