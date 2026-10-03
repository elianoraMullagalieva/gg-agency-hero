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
    /* Поле считается только пока холст рядом с экраном: на странице
       их теперь два (первый экран и подвал), и крутить оба сразу
       незачем. */
    var inView = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        var was = inView;
        inView = es[0].isIntersecting;
        if (inView && !was && running) requestAnimationFrame(frame);
      }, { rootMargin: "200px" }).observe(canvas);
    }

    function frame(now) {
      if (!running || !inView) return;
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
    /* Сетка букв — около 1600 вызовов fillText на кадр. Раньше она
       рисовалась всегда, даже когда первый экран давно прокручен,
       и отнимала время у блоков ниже. */
    var seen = true, looping = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        seen = es[0].isIntersecting;
        if (seen && running && !looping) { looping = true; requestAnimationFrame(frame); }
      }, { rootMargin: "100px" }).observe(canvas);
    }

    function frame(now) {
      if (!running || !seen) { looping = false; return; }
      looping = true;
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

    /* Мягкий свет на карточках утечек. Родня красному свету первого
     экрана: пятна медленно дышат у верхней кромки и тянутся к курсору.
     Поле считается на крошечном холсте (36×46) и растягивается
     браузером — отсюда мягкость без единого blur-фильтра в кадре.
     К началу текста свет растворяется полностью. */
  function initSoftGlow(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var card = canvas.closest(".leak") || canvas.parentNode;
    /* Настройки с разметки: откуда идёт свет (сверху или снизу),
       насколько он яркий и где растворяется. */
    var FLIP = canvas.getAttribute("data-origin") === "bottom";
    var GAIN = parseFloat(canvas.getAttribute("data-gain")) || 0.86;
    var FADE = (canvas.getAttribute("data-fade") || "0.14,0.6").split(",").map(parseFloat);
    var GW = 36, GH = 46;
    canvas.width = GW; canvas.height = GH;
    var img = ctx.createImageData(GW, GH), px = img.data;
    var seed = (canvas.getBoundingClientRect().left % 97) / 97 * 6.28;
    var mx = 0.6, my = 0.1, tx = 0.6, ty = 0.1, ms = 0, ts = 0;
    var seen = false, raf = 0, start = performance.now(), lastT = 0;
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    function sm(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }

    function frame(now) {
      raf = 0;
      if (!seen || document.hidden) return;
      // 30 кадров в секунду: свет медленный, разницы не видно
      if (now - lastT < 30) { raf = requestAnimationFrame(frame); return; }
      lastT = now;
      var t = (now - start) / 1000;
      mx += (tx - mx) * 0.1; my += (ty - my) * 0.1; ms += (ts - ms) * 0.08;
      // два пятна дышат у верхней кромки, третье идёт за курсором
      var ax = 0.64 + Math.sin(t * 0.23 + seed) * 0.16, ay = -0.04 + Math.cos(t * 0.19 + seed) * 0.05;
      var bx = 0.22 + Math.cos(t * 0.17 + seed * 1.7) * 0.14, by = 0.06 + Math.sin(t * 0.21 + seed) * 0.06;
      var asp = GH / GW;
      for (var y = 0; y < GH; y++) {
        var v = (y + 0.5) / GH;
        if (FLIP) v = 1 - v;
        // свет живёт у своей кромки и гаснет до начала текста
        var fade = (1 - sm(FADE[0], FADE[1], v)) * GAIN;
        for (var x = 0; x < GW; x++) {
          var u = (x + 0.5) / GW, o = (y * GW + x) * 4;
          if (fade <= 0.002) { px[o + 3] = 0; continue; }
          var d1x = u - ax, d1y = (v - ay) * asp, d2x = u - bx, d2y = (v - by) * asp;
          var d3x = u - mx, d3y = (v - my) * asp;
          var i = Math.exp(-(d1x * d1x + d1y * d1y) / 0.17) * 0.95
                + Math.exp(-(d2x * d2x + d2y * d2y) / 0.10) * 0.55
                + Math.exp(-(d3x * d3x + d3y * d3y) / 0.07) * 0.6 * ms;
          i *= fade;
          if (i > 1) i = 1;
          // тёмное бордо → алый → тёплый алый в самом ярком месте
          var k = i * i;
          px[o]     = 118 + k * 137;
          px[o + 1] = 6 + k * 40;
          px[o + 2] = 14 + k * 14;
          px[o + 3] = Math.pow(i, 1.25) * 245;
        }
      }
      ctx.putImageData(img, 0, 0);
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    function go() { if (!raf && seen && !document.hidden) raf = requestAnimationFrame(frame); }

    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width;
      ty = (e.clientY - r.top) / r.height;
      if (FLIP) ty = 1 - ty;
      ty = Math.min(0.5, ty);
      ts = 1;
    });
    card.addEventListener("pointerleave", function () { ts = 0; });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { seen = es[0].isIntersecting; go(); }, { rootMargin: "200px" }).observe(canvas);
    } else { seen = true; go(); }
    document.addEventListener("visibilitychange", go);
  }


  window.__softGlow = initSoftGlow;

  /* Пиксельный дождь. Та же механика, что у букв на первом экране:
     сетка и бегущая волна. Отличий три — ячейки квадратные, шаг
     мельче (карточка в пять раз уже экрана, и крупная сетка в ней
     читалась как брак), и градиент перевёрнут: густо сверху,
     редеет книзу, будто пиксели сыплются вниз. */
  function initPixelFall(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var CELLS = 24;                      // ячеек по ширине карточки
    var STEP = 13;                       // считается от ширины в resize()
    var WAVE = { length: 232, speed: 120 };
    var RED  = "231,26,33";

    var dpr = 1, W = 0, H = 0, cols = 0, rows = 0;
    var running = true, raf = 0, seen = true;

    function resize() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(r.width * dpr));
      var h = Math.max(1, Math.round(r.height * dpr));
      if (w === W && h === H) return;
      W = w; H = h;
      canvas.width = W; canvas.height = H;
      // Шаг от ширины карточки: на 4К она втрое шире, и сетка
      // с постоянным шагом превращалась в мелкую рябь
      STEP = r.width / CELLS;
      cols = CELLS + 1;
      rows = Math.ceil(r.height / STEP) + 1;
    }

    var start = performance.now();

    function frame(now) {
      raf = 0;
      if (!running) return;
      resize();

      var t = (now - start) / 1000;
      var phase = t * (WAVE.speed / 1000);
      var hPx = H / dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W / dpr, H / dpr);

      for (var y = 0; y < rows; y++) {
        var py = y * STEP;
        // Густо у верхнего края, к низу сходит на нет
        var k = py / hPx;
        var vert = Math.pow(1 - k, 1.9);
        // У самой кромки тише: иначе сетка упирается в пилюли
        // и номер с тегом тонут в ней
        vert *= 0.34 + Math.min(1, k / 0.15) * 0.66;
        if (vert <= 0.004) continue;
        for (var x = 0; x < cols; x++) {
          var px = x * STEP;
          var w1 = Math.sin((px + py) / WAVE.length - phase * Math.PI * 2);
          var w2 = Math.cos(py / (WAVE.length * 0.6) + phase * Math.PI);
          var wave = (w1 * 0.6 + w2 * 0.4) * 0.5 + 0.5;

          // Волна только подсвечивает; уровень задаёт высота,
          // иначе сетка читается как рябь, а не как градиент
          var a = vert * (0.58 + wave * 0.42);
          if (a < 0.012) continue;
          var sz = STEP * (0.1 + vert * 0.64);
          ctx.fillStyle = "rgba(" + RED + "," + a.toFixed(3) + ")";
          ctx.fillRect(px + (STEP - sz) / 2, py + (STEP - sz) / 2, sz, sz);
        }
      }
      if (seen) raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf && running && seen) raf = requestAnimationFrame(frame); }

    // Считаем только пока карточка на экране — их на странице несколько
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        seen = es[0].isIntersecting;
        wake();
      }, { rootMargin: "200px" }).observe(canvas);
    }
    document.addEventListener("visibilitychange", function () {
      running = !document.hidden;
      wake();
    });
    window.addEventListener("resize", wake);

    resize();
    wake();
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

  document.querySelectorAll(".hero__bg, .footer__bg").forEach(initArc);
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
  var ODO_STAGGER = 75;
  var ODO_DUR     = 2200;  // мс на один барабан  // мс между разрядами, справа налево

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
        /* Крутим покадрово и округляем до целого пикселя. CSS-переход
           на барабане длиной под две тысячи пикселей давал дробное
           сглаживание — в окне оказывались половинки цифр. Первым
           трогается младший разряд, последним старший. */
        var to = steps * unit;
        setTimeout(function () {
          var t0 = performance.now();
          (function step(now) {
            var k = Math.min(1, (now - t0) / ODO_DUR);
            var e = 1 - Math.pow(1 - k, 4);
            reel.style.transform = "translateY(" + Math.round(-to * e) + "px)";
            if (k < 1) requestAnimationFrame(step);
          })(t0);
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
    // Постоянный наклон: в эталоне карточки лежат косо и в покое
    var TILT = [-1.6, 1.2, -2.1, 0.9];
    var n = cards.length, peek = 0, cardH = 0, cur = 0, raf = 0;

    function measure() {
      /* И высота карточки, и ширина полоски считаются от одной
         свободной полосы: карточка забирает 62%, остальное делится
         между лесенкой. Клампы по отдельности не годились — на низких
         окнах полоски съедали всё место, и последнюю карточку
         накрывал следующий блок. */
      var stick = sec.querySelector(".stack__sticky");
      var head  = sec.querySelector(".stack__head");
      var free  = 0;
      if (stick && head) {
        var sc = getComputedStyle(stick);
        free = stick.clientHeight
             - parseFloat(sc.paddingTop) - parseFloat(sc.paddingBottom)
             - head.offsetHeight - (parseFloat(sc.rowGap) || 0)
             - 16;   // рамки карточек и округления
      }
      var rem = parseFloat(getComputedStyle(document.documentElement).fontSize);

      if (free > rem * 16) {
        // Карточка забирает 52% полосы: щель стала выше, в ней помещаются
        // пилюля с номером и название с воздухом сверху и снизу
        var h = free * 0.47;
        peek = (free - h) / (n - 1);
        // В полоску должна целиком влезать цифра
        // В щель целиком входят номер и название с воздухом снизу
        var nm = cards[0].querySelector(".stack__name");
        /* Карточки лежат с наклоном в разные стороны: у левого края соседние
           кромки сходятся на ~3% ширины. Этот запас входит в щель. */
        var minPeek = nm ? nm.offsetTop + nm.offsetHeight + rem + cards[0].offsetWidth * 0.03 : rem * 3;
        if (peek < minPeek) { peek = minPeek; h = free - (n - 1) * peek; }
        cards.forEach(function (c) {
          c.style.height = Math.max(rem * 8.5, h) + "px";
          c.style.minHeight = "0";
          c.style.setProperty("--peek", peek.toFixed(1) + "px");
        });
      } else {
        peek = parseFloat(getComputedStyle(cards[0]).getPropertyValue("--peek")) || rem * 4.5;
      }

      cardH = cards[0].offsetHeight;
      list.style.height = (cardH + (n - 1) * peek) + "px";
      if (lock) {
        // Экран на вход плюс по экрану на каждую приезжающую карточку
        sec.style.height = (window.innerHeight * (1 + (n - 1) * 0.62)) + "px";
      }
    }

    function goal() {
      var r = sec.getBoundingClientRect(), vh = window.innerHeight;
      var p;
      if (lock) {
        // 0.88 — стопка успевает постоять собранной до расфиксации
        p = -r.top / Math.max(1, (sec.offsetHeight - vh) * 0.88);
      } else {
        p = (vh - r.top) / (vh + r.height);
      }
      return Math.min(Math.max(p, 0), 1) * (n - 1);
    }

    /* Пружина по времени, а не функция от прокрутки. Прежний перелёт
       считался от local, то есть от положения скролла: при таком
       фильтре перерегулирования не бывает в принципе, и «отскок»
       выходил 0.6px вместо 2px. Здесь у каждой карточки своя масса:
       цель задаёт скролл, а доводит её пружина за ~0.5 с.
       K и C подобраны на перелёт около 0.45% хода — как в эталоне. */
    var K = 200, C = 24.3;
    var st = cards.map(function () { return { y: 1, v: 0 }; });
    var prev = 0;

    function paint(dt) {
      var p = goal();
      for (var i = 0; i < n; i++) {
        var to = 1 - Math.min(Math.max(p - (i - 1), 0), 1);
        if (i === 0) to = 0;
        var a = (to - st[i].y) * K - st[i].v * C;
        st[i].v += a * dt;
        st[i].y += st[i].v * dt;
        if (Math.abs(to - st[i].y) < 0.0004 && Math.abs(st[i].v) < 0.004) {
          st[i].y = to; st[i].v = 0;
        }
        var y = st[i].y * (window.innerHeight * 0.62);
        cards[i].style.transform =
          "translate3d(0," + y.toFixed(2) + "px,0) rotate(" + TILT[i % TILT.length] + "deg)";
        if (i > 0) cards[i - 1].style.setProperty("--cov", Math.min(1, Math.max(0, (1 - st[i].y) * 1.7)).toFixed(3));
      }
    }

    function loop(now) {
      var dt = prev ? Math.min(0.032, (now - prev) / 1000) : 0.016;
      prev = now;
      paint(dt);
      var r = sec.getBoundingClientRect();
      if (r.bottom > -200 && r.top < window.innerHeight + 200) {
        raf = requestAnimationFrame(loop);
      } else { raf = 0; prev = 0; }
    }

    function wake() { if (!raf) raf = requestAnimationFrame(loop); }

    measure();
    paint(0.016);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { measure(); wake(); });
    }
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
     Блок липкий (.approach__stick), и прокрутка доводит ленту до
     края, пока он держит экран. */
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
      /* Пауза на входе: блок встал — и первые 45% экрана прокрутки
         лента стоит. Человек успевает прочесть заголовок и первую
         карточку, движение запускает уже следующий скролл. */
      var hold = window.innerHeight * 0.45;
      // Лента доезжает до упора чуть раньше, чем блок отпускает экран
      var run = Math.max(1, (sec.offsetHeight - window.innerHeight - hold) * 0.8);
      var p = (-r.top - hold) / run;
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

  /* Веер источников. Положение карточек считается от прокрутки, а не
     проигрывается один раз: при движении вверх ход отыгрывает назад,
     и посмотреть его можно сколько угодно. */
  /* Веер источников · фиксация скролла.
     Прежде ход считался от верха секции — а карточки лежат в её низу,
     и к моменту, когда до них доезжаешь, веер уже собран. Теперь блок
     прилипает и прокрутка ведёт подъём: у каждой карточки свой отрезок
     хода, внутри него сначала движение, потом остановка — прочесть.
     Скорость задаёт сам скролл: крутишь быстрее — карточки встают
     быстрее, отматываешь назад — так же разъезжаются. */
  function initFan(sec) {
    if (!sec) return;
    var fan   = sec.querySelector(".fan");
    var stick = sec.querySelector(".sources__sticky");
    var lede  = sec.querySelector(".frame__lede");
    var side  = sec.querySelector(".frame__side");
    var cards = [].slice.call(sec.querySelectorAll(".fan__card"));
    if (!fan || !cards.length) return;

    var still = matchMedia("(prefers-reduced-motion: reduce)");
    var flat  = matchMedia("(max-width: 720px)");

    var n = cards.length, raf = 0, prev = 0, on = false;
    /* Экрана прокрутки на одну карточку и доля этого отрезка,
       которая уходит на движение. Остальное карточка стоит — это
       и есть время на чтение. */
    var STEP = 0.7, MOVE = 0.52;
    var seg = 1 / n;

    function rest() {
      sec.style.height = "";
      fan.style.width = "";
      cards.forEach(function (c) { c.style.opacity = 1; c.style.transform = "none"; });
    }

    function measure() {
      on = !(still.matches || flat.matches) && !!stick;
      if (!on) { rest(); return; }

      /* Веер не должен вылезать за прилипший экран: если по высоте
         не помещается — ужимаем его по ширине, пропорция та же. */
      if (lede && side) {
        var sc = getComputedStyle(stick), ss = getComputedStyle(side);
        var free = stick.clientHeight
                 - parseFloat(sc.paddingTop) - parseFloat(sc.paddingBottom)
                 - lede.offsetHeight - (parseFloat(ss.marginTop) || 0);
        var rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        // 0.9 — запас под наклон карточек: повёрнутый угол иначе
        // выходил за нижний край экрана на низких окнах
        var wByH = (free * 0.9) / (385 / 660);
        var w = Math.min(rem * 58, side.clientWidth, wByH);
        fan.style.width = Math.max(rem * 16, w) + "px";
      }
      sec.style.height = (window.innerHeight * (1 + n * STEP)) + "px";
    }

    function goal() {
      var r = sec.getBoundingClientRect(), vh = window.innerHeight;
      var span = Math.max(1, sec.offsetHeight - vh);
      /* Ход начинается ещё на въезде блока: иначе под заголовком
         целый экран пустого места, пока секция не прилипнет.
         0.94 — последняя карточка успевает встать до расфиксации. */
      var pre = vh * 0.45;
      var p = (pre - r.top) / (pre + span * 0.94);
      return Math.min(Math.max(p, 0), 1);
    }

    /* Пружина по времени, как в стопке: цель задаёт прокрутка,
       доводит её пружина — отсюда и мягкий перелёт, и то, что при
       быстром скролле карточка догоняет цель заметно резвее. */
    var K = 170, C = 22.5;
    var st = cards.map(function () { return { y: 1, v: 0 }; });

    function paint(dt) {
      var p = goal();
      for (var i = 0; i < n; i++) {
        var local = (p - i * seg) / (seg * MOVE);
        local = Math.min(Math.max(local, 0), 1);
        var to = 1 - local;
        var a = (to - st[i].y) * K - st[i].v * C;
        st[i].v += a * dt;
        st[i].y += st[i].v * dt;
        if (Math.abs(to - st[i].y) < 0.0004 && Math.abs(st[i].v) < 0.004) {
          st[i].y = to; st[i].v = 0;
        }
        cards[i].style.transform = "translate3d(0," + (st[i].y * 118).toFixed(2) + "%,0)";
        cards[i].style.opacity = Math.min(1, (1 - st[i].y) * 2.4).toFixed(3);
      }
    }

    function loop(now) {
      var dt = prev ? Math.min(0.032, (now - prev) / 1000) : 0.016;
      prev = now;
      if (on) paint(dt);
      var r = sec.getBoundingClientRect();
      if (on && r.bottom > -200 && r.top < window.innerHeight + 200) {
        raf = requestAnimationFrame(loop);
      } else { raf = 0; prev = 0; }
    }
    function wake() { if (!raf) raf = requestAnimationFrame(loop); }

    measure();
    if (on) paint(0.016);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { measure(); wake(); });
    }
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", function () { measure(); wake(); });
    if (still.addEventListener) still.addEventListener("change", function () { measure(); wake(); });
    if (flat.addEventListener)  flat.addEventListener("change",  function () { measure(); wake(); });
    wake();
  }


  /* Блок «Почему с нами по-другому»: карточки проявляются по очереди */
  function initWhy() {
    var sec = document.querySelector(".why");
    if (!sec) return;
    if (!("IntersectionObserver" in window)) { sec.classList.add("is-in"); return; }
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { sec.classList.add("is-in"); io.disconnect(); }
    }, { threshold: 0.2 });
    io.observe(sec);
  }


  /* Кейсы: карточка раскрывается в окне. Содержимое переносим из
     самой карточки — держать те же тексты в двух местах незачем. */
  function initCases() {
    var grid = document.querySelector(".cases__grid");
    var modal = document.getElementById("case-modal");
    if (!grid || !modal) return;

    var win = modal.querySelector(".cmodal__win");
    var last = null;

    function fill(card) {
      var get = function (s) { var e = card.querySelector(s); return e ? e.innerHTML : ""; };
      modal.querySelector(".cmodal__tag").innerHTML   = get(".ccard__tag");
      modal.querySelector(".cmodal__value").innerHTML = get(".ccard__value");
      modal.querySelector(".cmodal__lead").innerHTML  = get(".ccard__lead");
      modal.querySelector(".cmodal__name").innerHTML  = get(".ccard__name");
      modal.querySelector(".cmodal__meta").innerHTML  = get(".ccard__meta");
      var ba = card.querySelector(".ccard__ba");
      modal.querySelector(".cmodal__ba").innerHTML = ba ? ba.innerHTML : "";
    }

    function open(card, from) {
      fill(card);
      last = from;
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      win.querySelector(".cmodal__close").focus();
      document.addEventListener("keydown", onKey);
    }
    function close() {
      modal.hidden = true;
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      if (last) last.focus();
    }
    function onKey(e) {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;
      // Фокус не должен уходить за пределы окна, пока оно открыто
      var f = win.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }

    grid.addEventListener("click", function (e) {
      var btn = e.target.closest(".ccard__btn");
      if (btn) open(btn, btn);
    });
    modal.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close")) close();
    });
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
  function initLeaks(sec) {
    if (!sec) return;
    var rail = sec.querySelector(".leaks-rail");
    if (!rail) return;

    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var narrow = matchMedia("(max-width: 900px)").matches;
    if (reduce || narrow) return;

    var RUN = 1.8;   // во сколько раз путь прокрутки длиннее хода ленты
    var max = 0, hold = 0, tail = 0, cur = 0, raf = 0;

    function measure() {
      var cs  = getComputedStyle(rail);
      var gut = parseFloat(cs.paddingLeft) || 0;
      var gap = parseFloat(cs.columnGap) || 0;
      var vw  = window.innerWidth;

      /* Ширину карточки считаем от экрана, а не наоборот: в кадре
         должны стоять ровно четыре карточки и краешек пятой (7.8%
         ширины экрана — пропорция макета). На любом мониторе стартовый
         кадр выглядит одинаково, а прокрутка всегда имеет что везти. */
      /* Ширина ограничена с двух сторон, берём меньшую.
         По горизонтали: четыре карточки в кадре плюс краешек пятой
         (до 1200px — три, иначе карточка 190px и текст режется).
         По вертикали: карточка плюс подъём чётных должны уместиться
         между шапкой и нижним полем, равным боковому. Раньше высота
         шла только от ширины — на низких окнах карточки упирались
         в край, на высоких оставалась дыра. */
      var per  = vw < 1200 ? 3 : 4;
      var peek = vw * 0.078;
      var wByWidth = (vw - gut - (per + 1) * gap - peek) / per;

      var stick = sec.querySelector(".leaks-sticky");
      var head  = sec.querySelector(".leaks-head");
      var sc    = stick ? getComputedStyle(stick) : null;
      var wByHeight = Infinity;
      if (stick && head && sc) {
        var free = stick.clientHeight
                 - parseFloat(sc.paddingTop)
                 - parseFloat(sc.paddingBottom)
                 - head.offsetHeight
                 - (parseFloat(sc.rowGap) || 0);
        // 1.128 — карточка плюс подъём чётных на 12.8% её высоты
        var cardH = free / 1.10;
        wByHeight = cardH * (433 / 551);
      }

      /* Ведёт высота: карточка заполняет свободную полосу, и тогда
         нижнее поле совпадает с боковым. Ширина лишь ограничивает
         сверху, чтобы в кадр всё же попадало не меньше 2.6 карточек
         и ленте было что везти. */
      var wCap = (vw - gut - peek) / 2.6;
      var w = Math.max(160, Math.min(wByHeight, wCap, wByWidth * 1.6));
      /* Подгонка по факту в несколько проходов. Аналитически свободную
         полосу не сосчитать: на неё влияют переносы шапки, округления
         полей и резерв под подъём чётных, который сам зависит от
         ширины. Поэтому меряем получившийся зазор и подводим ширину,
         пока низ карточки не встанет ровно на боковое поле. */
      function apply(px) {
        rail.style.setProperty("--leak-w", px.toFixed(2) + "px");
        rail.style.paddingTop = (px * (551 / 433) * 0.10).toFixed(1) + "px";
      }
      apply(w);

      if (stick) {
        var want = parseFloat(sc.paddingBottom) || 0;
        var k = (433 / 551) / 1.10;          // насколько ширина меняет полную высоту
        for (var pass = 0; pass < 4; pass++) {
          var card = rail.querySelector(".leak");
          if (!card) break;
          var got = stick.getBoundingClientRect().bottom - card.getBoundingClientRect().bottom;
          var delta = got - want;
          if (Math.abs(delta) < 1.5) break;
          w = Math.max(160, Math.min(w + delta * k, wCap));
          apply(w);
        }
      }

      /* v14: карточки на 13% компактнее, чем позволяет полоса —
         под лентой остаётся воздух, как в макете. */
      if (sec.classList.contains("leaks--v14")) {
        /* Ширина от экрана: в кадре ~3.35 карточки, четвёртая всегда
           выглядывает и доезжает прокруткой. Не уже 380px, чтобы текст
           не наезжал на фото, и не выше свободной полосы по высоте. */
        var want = Math.min(900, Math.max(380, (vw - gut - 3 * gap) / 3.35));
        var byH = wByHeight * 0.96;
        /* Четвёртая карточка не должна целиком помещаться в кадр */
        var peekMin = (vw - gut - 3 * gap) / 3.55;
        w = Math.max(340, peekMin, Math.min(want, byH));
        apply(w);
      }

      // Сколько ленты не влезло: последняя карточка должна встать
      // ровно по правому полю сетки.
      max = Math.max(0, rail.scrollWidth - window.innerWidth);

      /* Пауза на входе: первый экран прокрутки блок просто стоит —
         стартовый кадр успевают прочесть. Дальше путь растянут в RUN
         раз: при ходе 1:1 один щелчок колеса уносил карточку целиком. */
      hold = window.innerHeight * 0.18;
      /* Хвост в конце: лента доезжает до упора, и блок ещё держит
         экран — последняя карточка успевает встать по полю сетки,
         и только следующий скролл уводит на другую секцию. */
      tail = window.innerHeight * 0.4;
      sec.style.height = (window.innerHeight + hold + max * RUN + tail) + "px";
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

    /* Пересчёт после подмены шрифта: до неё заголовок занимает лишнюю
       строку, свободная полоса выходит на ~27px короче, и карточка
       получается меньше, чем могла бы. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { measure(); wake(); });
    }
    addEventListener("load", function () { measure(); wake(); });

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
  [].forEach.call(document.querySelectorAll(".leaks"), initLeaks);
  [].forEach.call(document.querySelectorAll(".leak__fx"), initSoftGlow);
  initVennMark();
  initApproach();
  [].forEach.call(document.querySelectorAll(".sources"), initFan);
  initStacks();
  /* initWhy() снят: блок «Почему» появляется общим механизмом data-stage */
  initCases();
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


/* ============================================================
   НИЖНЯЯ ПОЛОВИНА · движение блоков от «Отзывов» до подвала.
   Один принцип на всё: прокрутка и наблюдатели пишут числа в
   CSS-переменные или классы, геометрию считает CSS. Canvas — только
   для графика и пиксельного дождя, и только пока блок на экране.
   Всё, что привязано к прокрутке, отматывается назад так же,
   как идёт вперёд: значения считаются от положения, а не от времени.
   ============================================================ */
(function () {
  "use strict";

  var still = matchMedia("(prefers-reduced-motion: reduce)");
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /* ---------- Дирижёр: rAF-цикл, живущий пока есть подписчики в кадре.
     Каждый блок регистрирует функцию, которая получает время кадра
     и сама решает, что считать. Один цикл на всех — один reflow. */
  var subs = [], raf = 0, prevT = 0;
  function tick(now) {
    raf = 0;
    var dt = prevT ? Math.min(0.032, (now - prevT) / 1000) : 0.016;
    prevT = now;
    var alive = false;
    for (var i = 0; i < subs.length; i++) if (subs[i](dt, now)) alive = true;
    if (alive) raf = requestAnimationFrame(tick); else prevT = 0;
  }
  function wake() { if (!raf) raf = requestAnimationFrame(tick); }
  function onScroll(fn) { subs.push(fn); }
  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("resize", wake);
  function near(r, pad) { return r.bottom > -(pad || 0) && r.top < window.innerHeight + (pad || 0); }

  /* ============================================================
     Появление секций. Секция с data-stage получает .is-in, когда
     её видно на 12%; когда её прокрутили назад так, что она снова
     целиком ниже экрана, класс снимается — появление можно
     посмотреть ещё раз. При уходе вверх ничего не меняем: иначе
     блок мерцал бы при каждом возврате.
     ============================================================ */
  function initStages() {
    var stages = [].slice.call(document.querySelectorAll('[data-stage]:not([data-stage="manual"])'));
    if (!stages.length) return;
    if (!("IntersectionObserver" in window) || still.matches) {
      stages.forEach(function (s) { s.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) e.target.classList.add("is-in");
        else if (e.boundingClientRect.top > 0) e.target.classList.remove("is-in");
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    stages.forEach(function (s) { io.observe(s); });
  }

  /* ============================================================
     Реестр «Почему по-другому»: строки наклоняются от скорости
     прокрутки и возвращаются пружиной. Скорость сглаживается,
     угол ограничен ±5°.
     ============================================================ */
  function initLedgerPush() {
    var sec = document.querySelector(".why");
    if (!sec || still.matches) return;
    var lastY = window.scrollY, vel = 0, push = 0;
    onScroll(function (dt) {
      var r = sec.getBoundingClientRect();
      if (!near(r, 100)) { lastY = window.scrollY; return false; }
      var y = window.scrollY;
      var v = (y - lastY) / Math.max(dt, 0.008);
      lastY = y;
      vel += (v - vel) * 0.2;
      var target = Math.max(-5, Math.min(5, vel / 260));
      push += (target - push) * 0.14;
      vel *= 0.86;
      if (Math.abs(push) < 0.02 && Math.abs(vel) < 1) { push = 0; vel = 0; }
      sec.style.setProperty("--push", push.toFixed(3));
      return push !== 0;
    });
  }

  /* ============================================================
     Как работаем · график выручки. Прокрутка блока ведёт курсор
     по оси времени: слева от курсора кривая уже «выпрямлена» и
     растёт, справа — ещё пики запусков. Этапы под графиком
     переключаются по тому же прогрессу, у активного заполняется
     верхняя линия.
     ============================================================ */
  function initPath() {
    var sec = document.querySelector(".path");
    if (!sec) return;
    var canvas = sec.querySelector(".path__canvas");
    var ctx = canvas && canvas.getContext("2d");
    var stages = [].slice.call(sec.querySelectorAll(".path__stage"));
    var axis = [].slice.call(sec.querySelectorAll(".path__axis span"));
    var legend = sec.querySelector("[data-path-legend]");
    if (!ctx || !stages.length) return;

    var LEGEND = [
      "зависит от даты запуска",
      "разложена по неделям",
      "идёт по регламентам",
      "растёт по плану"
    ];
    var n = stages.length;
    var wide = matchMedia("(min-width: 901px)");
    var lock = false;
    var dpr = 1, W = 0, H = 0;
    var shown = -1, drawnP = -1, seenP = 0;

    function measure() {
      lock = wide.matches && !still.matches;
      if (lock) sec.style.height = (window.innerHeight * (1 + n * 0.7)) + "px";
      else sec.style.height = "";
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(r.width * dpr));
      var h = Math.max(1, Math.round(r.height * dpr));
      if (w !== W || h !== H) { W = w; H = h; canvas.width = W; canvas.height = H; drawnP = -1; }
    }

    function progress() {
      if (still.matches) return 1;
      var r = sec.getBoundingClientRect(), vh = window.innerHeight;
      if (lock) return clamp01(-r.top / Math.max(1, (sec.offsetHeight - vh) * 0.92));
      /* Без фиксации: ход идёт, пока секция проходит через экран */
      return clamp01((vh * 0.7 - r.top) / Math.max(1, r.height * 0.85));
    }

    /* Пики запусков: три всплеска, между ними почти ноль */
    function spiky(x) {
      var y = 0.06;
      var peaks = [0.16, 0.44, 0.72];
      for (var i = 0; i < peaks.length; i++) {
        var d = (x - peaks[i]) / 0.032;
        y += Math.exp(-d * d) * (0.86 - i * 0.05);
        /* Хвост после пика: касса пустеет не мгновенно */
        var t = (x - peaks[i]) / 0.11;
        if (t > 0) y += Math.exp(-t * t) * 0.16;
      }
      return y;
    }
    /* Ровная выручка: растёт, с лёгкой рябью месяцев */
    function steady(x) {
      return 0.3 + 0.5 * x + Math.sin(x * 38) * 0.018;
    }
    function smooth(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

    function draw(p) {
      var w = W / dpr, h = H / dpr;
      var padT = h * 0.22, padB = h * 0.16, span = h - padT - padB;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var c = -0.05 + p * 1.15;      // курсор выходит за края: в начале всё пики, в конце всё ровно
      var N = 240;
      var pts = new Array(N + 1);
      for (var i = 0; i <= N; i++) {
        var x = i / N;
        var s = 1 - smooth(c - 0.05, c + 0.05, x);   // слева от курсора — 1
        var y = spiky(x) * (1 - s) + steady(x) * s;
        pts[i] = [x * w, padT + (1 - Math.min(1, y)) * span];
      }

      // Тихая сетка: три горизонтали, чтобы кривой было на что опереться
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      for (var gl = 1; gl <= 3; gl++) {
        var gy = Math.round(padT + span * gl / 4) + 0.5;
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      }

      var cx = clamp01(c) * w;
      var idx = Math.round(clamp01(c) * N);
      var cy = pts[idx][1];

      // Заливка — едва заметная, белая: график монохромный
      var g = ctx.createLinearGradient(0, padT, 0, h - padB * 0.4);
      g.addColorStop(0, "rgba(255,255,255,0.10)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.moveTo(0, h - padB * 0.4);
      for (i = 0; i <= idx; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[idx][0], h - padB * 0.4);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();

      // Линия: пройденная часть яркая, будущая — приглушена
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      for (i = idx; i <= N; i++) { if (i > idx) ctx.lineTo(pts[i][0], pts[i][1]); else ctx.moveTo(pts[i][0], pts[i][1]); }
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.stroke();
      ctx.beginPath();
      for (i = 0; i <= idx; i++) { if (i) ctx.lineTo(pts[i][0], pts[i][1]); else ctx.moveTo(pts[i][0], pts[i][1]); }
      ctx.lineWidth = 1.75;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.stroke();

      // Курсор: тонкая вертикаль и точка на кривой
      ctx.beginPath();
      ctx.moveTo(Math.round(cx) + 0.5, padT * 0.55);
      ctx.lineTo(Math.round(cx) + 0.5, h - padB * 0.4);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fill();

      // Подписи оси: пройденные запуски гаснут
      for (i = 0; i < axis.length; i++) {
        var ax = i / axis.length + 0.02;
        var passed = ax < c;
        axis[i].style.color = passed && i < axis.length - 1
          ? "rgba(255,255,255,0.18)" : (i === axis.length - 1 && passed ? "#fff" : "rgba(255,255,255,0.4)");
      }
    }

    function stage(p) {
      var seg = 1 / n;
      var act = Math.min(n - 1, Math.floor(p / seg + 1e-6));
      if (p >= 1) act = n - 1;
      for (var i = 0; i < n; i++) {
        var fill = clamp01((p - i * seg) / seg);
        stages[i].style.setProperty("--fill", fill.toFixed(3));
        stages[i].classList.toggle("is-active", i === act);
      }
      if (act !== shown) { shown = act; if (legend) legend.innerHTML = LEGEND[act]; }
    }

    /* Курсор можно тащить: пока держат — прогресс задаёт палец,
       отпустили — плавно возвращается к прокрутке. */
    var chart = sec.querySelector(".path__chart");
    var hold = -1, shownP = -1;
    function xToP(clientX) {
      var r = chart.getBoundingClientRect();
      var c = (clientX - r.left) / Math.max(1, r.width);
      return clamp01((c + 0.05) / 1.15);
    }
    if (chart) {
      chart.addEventListener("pointerdown", function (e) {
        if (e.button) return;
        hold = xToP(e.clientX);
        chart.classList.add("is-hold", "is-used");
        chart.setPointerCapture(e.pointerId);
        wake();
      });
      chart.addEventListener("pointermove", function (e) { if (hold >= 0) { hold = xToP(e.clientX); wake(); } });
      function drop() { hold = -1; chart.classList.remove("is-hold"); wake(); }
      chart.addEventListener("pointerup", drop);
      chart.addEventListener("pointercancel", drop);
    }
    onScroll(function () {
      var r = sec.getBoundingClientRect();
      if (!near(r, 200)) return false;
      var goalP = hold >= 0 ? hold : progress();
      if (shownP < 0) shownP = goalP;
      shownP += (goalP - shownP) * (hold >= 0 ? 0.35 : 0.18);
      if (Math.abs(goalP - shownP) < 0.0008) shownP = goalP;
      if (Math.abs(shownP - drawnP) > 0.0005) { measure(); draw(shownP); stage(shownP); drawnP = shownP; }
      return shownP !== goalP;
    });

    function reset() { measure(); drawnP = -1; wake(); }
    window.addEventListener("resize", reset);
    if (wide.addEventListener) wide.addEventListener("change", reset);
    if (still.addEventListener) still.addEventListener("change", reset);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reset);
    reset();
  }

  /* ============================================================
     Что остаётся у вас: стопка документов расходится по мере
     того, как блок въезжает в экран. Наведение раскрывает
     стопку целиком (это в CSS).
     ============================================================ */
  function initDocs() {
    var sec = document.querySelector(".keep");
    var docs = sec && sec.querySelector("[data-docs]");
    if (!sec || !docs || still.matches) return;
    var last = -1;
    onScroll(function () {
      var r = docs.getBoundingClientRect(), vh = window.innerHeight;
      if (!near(r, 200)) return false;
      var s = clamp01((vh * 0.9 - r.top) / (vh * 0.55));
      s = s * s * (3 - 2 * s);
      if (Math.abs(s - last) > 0.002) { sec.style.setProperty("--spread", s.toFixed(3)); last = s; }
      return false;
    });
    wake();
  }

  /* ============================================================
     С чего начать: панели. Клик или наведение открывает панель,
     остальные складываются. На телефоне — только клик.
     ============================================================ */
  function initPanels() {
    var box = document.querySelector("[data-panels]");
    if (!box) return;
    var panels = [].slice.call(box.querySelectorAll("[data-panel]"));
    var wide = matchMedia("(min-width: 801px)");
    function open(target, toggle) {
      panels.forEach(function (p) {
        var on = p === target && !(toggle && p.classList.contains("is-open") && !wide.matches);
        p.classList.toggle("is-open", on);
        p.querySelector(".panel__head").setAttribute("aria-expanded", on ? "true" : "false");
      });
    }
    panels.forEach(function (p) {
      p.querySelector(".panel__head").addEventListener("click", function () { open(p, true); });
      p.addEventListener("pointerenter", function (e) {
        if (wide.matches && e.pointerType === "mouse") open(p, false);
      });
    });
  }

  /* ============================================================
     Подвал: слово поднимается снизу по мере въезда подвала.
     ============================================================ */
  function initFooterWord() {
    var footer = document.querySelector(".footer");
    var word = footer && footer.querySelector(".footer__word");
    if (!footer || !word || still.matches) return;
    var last = -1;
    onScroll(function () {
      var r = word.getBoundingClientRect(), vh = window.innerHeight;
      if (!near(r, 200)) return false;
      var s = clamp01((vh - r.top) / (r.height * 1.1));
      s = 1 - Math.pow(1 - s, 2);
      if (Math.abs(s - last) > 0.002) { footer.style.setProperty("--rise", s.toFixed(3)); last = s; }
      return false;
    });
    wake();
  }

  /* ============================================================
     Опросник: светлый пиксельный дождь на красной панели. Тот же
     приём, что в «Утечках»: сетка и бегущая волна, ячейки крупнее.
     ============================================================ */
  function initQuizFx() {
    var canvas = document.querySelector(".quizform__fx");
    var ctx = canvas && canvas.getContext("2d");
    if (!ctx || still.matches) return;
    var CELLS = 26, STEP = 12, WAVE = { length: 220, speed: 110 };
    var dpr = 1, W = 0, H = 0, cols = 0, rows = 0, seen = false, raf = 0, start = performance.now();

    function resize() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (w === W && h === H) return;
      W = w; H = h; canvas.width = W; canvas.height = H;
      STEP = r.width / CELLS; cols = CELLS + 1; rows = Math.ceil(r.height / STEP) + 1;
    }
    function frame(now) {
      raf = 0;
      if (!seen || document.hidden) return;
      resize();
      var t = (now - start) / 1000, phase = t * (WAVE.speed / 1000), hPx = H / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W / dpr, hPx);
      for (var y = 0; y < rows; y++) {
        var py = y * STEP, k = py / hPx;
        var vert = Math.pow(1 - k, 2.2);
        if (vert <= 0.004) continue;
        for (var x = 0; x < cols; x++) {
          var px = x * STEP;
          var w1 = Math.sin((px + py) / WAVE.length - phase * Math.PI * 2);
          var w2 = Math.cos(py / (WAVE.length * 0.6) + phase * Math.PI);
          var wave = (w1 * 0.6 + w2 * 0.4) * 0.5 + 0.5;
          var a = vert * (0.5 + wave * 0.5) * 0.42;
          if (a < 0.012) continue;
          var sz = STEP * (0.12 + vert * 0.6);
          ctx.fillStyle = "rgba(255,255,255," + a.toFixed(3) + ")";
          ctx.fillRect(px + (STEP - sz) / 2, py + (STEP - sz) / 2, sz, sz);
        }
      }
      raf = requestAnimationFrame(frame);
    }
    function go() { if (!raf && seen && !document.hidden) raf = requestAnimationFrame(frame); }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { seen = es[0].isIntersecting; go(); }, { rootMargin: "100px" }).observe(canvas);
    } else { seen = true; go(); }
    document.addEventListener("visibilitychange", go);
    window.addEventListener("resize", go);
  }

  initStages();
  initLedgerPush();
  initPath();
  initDocs();
  initPanels();
  /* initFooterWord() снят: подвалом управляет блок v10 в конце файла */
  initQuizFx();
  wake();
})();

/* ============================================================
   Разбор · диалог. Три вопроса на странице, ответы копятся
   в стопке пилюль и уезжают в Telegram start-параметром.
   ============================================================ */
(function () {
  "use strict";
  var sec = document.querySelector("[data-ask]");
  if (!sec) return;

  var qs    = [].slice.call(sec.querySelectorAll(".ask__q"));
  var done  = sec.querySelector("[data-ask-done]");
  var num   = sec.querySelector("[data-ask-n]");
  var back  = sec.querySelector("[data-ask-back]");
  var link  = sec.querySelector("[data-ask-link]");
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var base  = sec.getAttribute("data-bot") || "https://t.me/";
  var TOTAL = qs.length - 1;          // вопросов на странице
  var answers = [];                   // { key, code, label }
  var cur = 0, busy = false;

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function render() {
    // стопка ответов
    done.innerHTML = "";
    answers.forEach(function (a) {
      var li = document.createElement("li");
      li.innerHTML = "<span>" + pad(answers.indexOf(a) + 1) + "</span>" + a.label;
      done.appendChild(li);
    });
    // номер вопроса
    var n = Math.min(cur + 1, 8);
    if (num.textContent !== pad(n)) {
      num.textContent = pad(n);
      num.classList.remove("is-swap"); void num.offsetWidth; num.classList.add("is-swap");
    }
    back.hidden = cur === 0;
    sec.style.setProperty("--warm", (answers.length / TOTAL).toFixed(3));
    // ссылка в бота: ответы кодом, только латиница и цифры
    var code = answers.map(function (a) { return a.key + a.code; }).join("_");
    link.href = base + (code ? (base.indexOf("?") > -1 ? "&" : "?") + "start=" + code : "");
  }

  function show(i) {
    qs.forEach(function (q, k) {
      var on = k === i;
      q.classList.toggle("is-current", on);
      q.setAttribute("aria-hidden", on ? "false" : "true");
      if (!on) q.classList.remove("is-out");
      q.querySelectorAll(".ask__opt").forEach(function (b) { b.classList.remove("is-picked"); });
    });
  }

  function go(i) {
    if (busy || i === cur) return;
    busy = true;
    qs[cur].classList.add("is-out");
    var delay = still ? 0 : 150;
    setTimeout(function () {
      cur = i;
      show(cur);
      render();
      busy = false;
      // Фокус на первый вариант, чтобы с клавиатуры идти дальше
      var f = qs[cur].querySelector(".ask__opt, .ask__cta");
      if (f && document.activeElement && sec.contains(document.activeElement)) f.focus({ preventScroll: true });
    }, delay);
  }

  sec.addEventListener("click", function (e) {
    var btn = e.target.closest(".ask__opt");
    if (!btn || busy) return;
    var q = btn.closest(".ask__q");
    var i = qs.indexOf(q);
    if (i !== cur || i >= TOTAL) return;
    btn.classList.add("is-picked");
    answers = answers.slice(0, i);
    answers.push({ key: q.getAttribute("data-q"), code: btn.getAttribute("data-v"), label: btn.textContent.trim() });
    setTimeout(function () { go(i + 1); }, still ? 0 : 180);
  });

  back.addEventListener("click", function () {
    if (busy || cur === 0) return;
    answers = answers.slice(0, cur - 1);
    go(cur - 1);
  });

  show(0);
  render();
})();

/* ============================================================
   Подвал · слово GG AGENCY собрано из пикселей. Та же сетка и
   бегущая волна, что у букв первого экрана, но обрезанная по
   контуру слова; книзу пиксели теплеют в красный, у курсора —
   светлеют. Рисуется только пока подвал в кадре.
   ============================================================ */
(function () {
  "use strict";
  var box = document.querySelector("[data-footer-word]");
  var canvas = box && box.querySelector(".footer__word-canvas");
  var text = box && box.querySelector(".footer__word-text");
  var ctx = canvas && canvas.getContext("2d");
  if (!ctx || !text) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var dpr = 1, W = 0, H = 0, step = 12, cols = 0, rows = 0;
  var mask = null, seen = false, raf = 0, start = performance.now();
  var mx = -1e4, my = -1e4, tx = -1e4, ty = -1e4;

  function build() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w === W && h === H && mask) return;
    W = w; H = h; canvas.width = W; canvas.height = H;
    // Маска: слово тем же шрифтом и кеглем, что у span в разметке
    var cs = getComputedStyle(text);
    var m = document.createElement("canvas");
    m.width = W; m.height = H;
    var mc = m.getContext("2d");
    mc.setTransform(dpr, 0, 0, dpr, 0, 0);
    mc.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
    mc.letterSpacing = cs.letterSpacing;
    mc.textAlign = "center";
    mc.textBaseline = "alphabetic";
    var tr = text.getBoundingClientRect();
    var fs = parseFloat(cs.fontSize);
    // Базовая линия: низ span минус спуск шрифта (~0.2em у Onest)
    mc.fillStyle = "#fff";
    mc.fillText(text.textContent.replace(/ /g, " "), (tr.left - r.left) + tr.width / 2, (tr.bottom - r.top) - fs * 0.21);
    mask = mc.getImageData(0, 0, W, H).data;
    // На телефоне слово мельче, сетка плотнее — иначе буквы рассыпаются
    step = Math.max(3.5, fs / (fs < 90 ? 16 : 20));
    cols = Math.ceil(r.width / step) + 1;
    rows = Math.ceil(r.height / step) + 1;
  }

  function frame(now) {
    raf = 0;
    if (!seen || document.hidden) return;
    build();
    box.classList.add("is-canvas");
    var t = (now - start) / 1000, phase = t * 0.14;
    var w = W / dpr, h = H / dpr;
    // курсор догоняет с запаздыванием
    mx += (tx - mx) * 0.12; my += (ty - my) * 0.12;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var R = Math.max(90, w * 0.12);
    for (var y = 0; y < rows; y++) {
      var py = y * step + step / 2;
      for (var x = 0; x < cols; x++) {
        var px = x * step + step / 2;
        var ix = Math.min(W - 1, Math.round(px * dpr)), iy = Math.min(H - 1, Math.round(py * dpr));
        if (mask[(iy * W + ix) * 4 + 3] < 128) continue;
        var w1 = Math.sin((px + py) / 260 - phase * Math.PI * 2);
        var w2 = Math.cos(py / 150 + phase * Math.PI);
        var wave = (w1 * 0.6 + w2 * 0.4) * 0.5 + 0.5;
        var dx = px - mx, dy = py - my;
        var near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / R);
        var k = py / h;                                   // 0 верх … 1 низ
        var a = 0.55 + wave * 0.45;
        var sz = step * (0.55 + wave * 0.35 + near * 0.25);
        // книзу — к красному, у курсора — к белому
        var red = 0;   // слово чисто белое: красный тон убран по замечанию
        var rC = 255, gC = Math.round(255 - red * 243), bC = Math.round(255 - red * 240);
        ctx.fillStyle = "rgba(" + rC + "," + gC + "," + bC + "," + Math.min(1, a + near * 0.4).toFixed(3) + ")";
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
    }
    raf = requestAnimationFrame(frame);
  }
  function go() { if (!raf && seen && !document.hidden) raf = requestAnimationFrame(frame); }

  box.addEventListener("pointermove", function (e) {
    var r = canvas.getBoundingClientRect();
    tx = e.clientX - r.left; ty = e.clientY - r.top;
  });
  box.addEventListener("pointerleave", function () { tx = -1e4; ty = -1e4; });
  // Слово aria-hidden и без pointer-events: включаем их только для канваса
  box.style.pointerEvents = "auto";

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { seen = es[0].isIntersecting; go(); }, { rootMargin: "100px" }).observe(box);
  } else { seen = true; go(); }
  document.addEventListener("visibilitychange", go);
  window.addEventListener("resize", function () { mask = null; go(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { mask = null; go(); });
})();

/* Подвал · московское время, обновляется раз в полминуты */
(function () {
  var el = document.querySelector("[data-msk]");
  if (!el || !window.Intl) return;
  var fmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
  function tick() { el.textContent = fmt.format(new Date()); }
  tick();
  setInterval(tick, 30000);
})();

/* ============================================================
   v6 · приёмы из библиотеки компонентов, адаптированные под сайт.
   ============================================================ */
(function () {
  "use strict";
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hover = matchMedia("(hover: hover)").matches;

  /* ---------- Заголовки по строкам (Line Mask) ---------- */
  function splitLines() {
    var sel = ".reviews__title, .why__title, .cases__title, .keep__title, .fit__title, .start__title, .people__teamtitle";
    [].forEach.call(document.querySelectorAll(sel), function (el) {
      if (still) return;
      var src = el.dataset.lmSrc || el.innerHTML;
      el.dataset.lmSrc = src;
      // Слова оборачиваем, <br> считаем принудительным переносом
      var tmp = document.createElement("div");
      tmp.innerHTML = src;
      var tokens = [];
      tmp.childNodes.forEach(function (n) {
        if (n.nodeType === 3) n.textContent.split(/\s+/).forEach(function (w) { if (w) tokens.push(w); });
        else if (n.nodeName === "BR") tokens.push("\n");
      });
      el.innerHTML = "";
      var spans = tokens.map(function (t) {
        if (t === "\n") { el.appendChild(document.createElement("br")); return null; }
        var s = document.createElement("span");
        s.textContent = t;
        el.appendChild(s); el.appendChild(document.createTextNode(" "));
        return s;
      });
      var rows = [], prev = null;
      spans.forEach(function (s) {
        if (!s) { prev = null; return; }
        var top = Math.round(s.getBoundingClientRect().top);
        if (top !== prev) { rows.push([]); prev = top; }
        rows[rows.length - 1].push(s.textContent);
      });
      el.innerHTML = "";
      rows.forEach(function (row, i) {
        var line = document.createElement("span"), inner = document.createElement("i");
        line.className = "lm-line";
        line.style.setProperty("--i", i);
        inner.innerHTML = row.join(" ").replace(/ /g, " ").replace(/ /g, " ");
        line.appendChild(inner);
        el.appendChild(line);
      });
      el.classList.add("is-split");
      el.setAttribute("aria-label", tmp.textContent.replace(/\s+/g, " ").trim());
    });
  }
  var lt;
  window.addEventListener("resize", function () { clearTimeout(lt); lt = setTimeout(splitLines, 220); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(splitLines); else splitLines();

  /* ---------- Цифры лентой (Number Roll) ---------- */
  function rolls() {
    var sel = ".ccard__value, .ledger__value > span";
    [].forEach.call(document.querySelectorAll(sel), function (el) {
      if (el.dataset.nr) return;
      el.dataset.nr = "1";
      var text = el.textContent;
      var out = "", k = 0;
      for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        if (ch >= "0" && ch <= "9") {
          var strip = "";
          for (var d = 0; d <= 9; d++) strip += "<u>" + d + "</u>";
          out += '<span class="nr__d" style="--k:' + k + '"><i style="--n:' + ch + '">' + strip + "</i></span>";
          k++;
        } else out += ch === " " ? "&nbsp;" : ch;
      }
      if (!k) return;
      el.innerHTML = '<span class="odo-a11y">' + text + '</span><span class="nr" aria-hidden="true">' + out + "</span>";
    });
  }
  rolls();

  /* ---------- Световое пятно (Spotlight) ---------- */
  var spots = ".ccard--dark .ccard__btn, .vreview__frame, .fit__half--no";
  [].forEach.call(document.querySelectorAll(spots), function (el) { el.classList.add("spot"); });
  if (hover) {
    document.addEventListener("pointermove", function (e) {
      var el = e.target.closest && e.target.closest(".spot");
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty("--sx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      el.style.setProperty("--sy", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    }, { passive: true });
  }

  /* ---------- Магнит на кнопках ---------- */
  if (false && hover && !still) {
    [].forEach.call(document.querySelectorAll(".cases__cta, .people__cta, .start__cta, .ask__cta"), function (btn) {
      btn.classList.add("mag");
      var MAX = 8;
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        var dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        var dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        btn.style.transform = "translate(" + (dx * MAX).toFixed(1) + "px," + (dy * MAX).toFixed(1) + "px)";
        [].forEach.call(btn.children, function (c) {
          c.style.transform = "translate(" + (dx * MAX * 0.45).toFixed(1) + "px," + (dy * MAX * 0.45).toFixed(1) + "px)";
        });
      });
      btn.addEventListener("pointerleave", function () {
        btn.style.transform = "";
        [].forEach.call(btn.children, function (c) { c.style.transform = ""; });
      });
    });
  }

  /* ---------- Подпись «Смотреть» у курсора над видео ---------- */
  if (hover && !still) {
    var cur = document.createElement("span");
    cur.className = "vcur"; cur.textContent = "Смотреть"; cur.setAttribute("aria-hidden", "true");
    document.body.appendChild(cur);
    var cx = 0, cy = 0, tx = 0, ty = 0, on = false, raf = 0;
    function move() {
      raf = 0;
      cx += (tx - cx) * 0.22; cy += (ty - cy) * 0.22;
      cur.style.left = cx.toFixed(1) + "px"; cur.style.top = cy.toFixed(1) + "px";
      if (on || Math.abs(tx - cx) > 0.5) raf = requestAnimationFrame(move);
    }
    document.addEventListener("pointermove", function (e) {
      var f = e.target.closest && e.target.closest(".vreview__frame");
      tx = e.clientX; ty = e.clientY;
      if (f && !on) { on = true; cx = tx; cy = ty; cur.classList.add("is-on"); }
      if (!f && on) { on = false; cur.classList.remove("is-on"); }
      if (!raf) raf = requestAnimationFrame(move);
    }, { passive: true });
    // Если в кадр вставлено <video>: при наведении играет без звука
    document.addEventListener("pointerover", function (e) {
      var f = e.target.closest && e.target.closest(".vreview__frame");
      var v = f && f.querySelector("video");
      if (v) { v.muted = true; v.play().catch(function () {}); }
    });
    document.addEventListener("pointerout", function (e) {
      var f = e.target.closest && e.target.closest(".vreview__frame");
      var v = f && f.querySelector("video");
      if (v && !f.contains(e.relatedTarget)) { v.pause(); }
    });
  }

  /* ---------- Лента скринов с инерцией ---------- */
  (function () {
    var box = document.querySelector(".shots");
    var tracks = box && box.querySelectorAll(".shots__track");
    if (!box || tracks.length < 2 || still) return;
    var x = 0, speed = 0.6, target = 0.6, boost = 0, half = 0, lastY = window.scrollY, seen = false, raf = 0;
    function measure() { half = tracks[0].getBoundingClientRect().width; }
    box.addEventListener("pointerenter", function () { target = 0.12; });
    box.addEventListener("pointerleave", function () { target = 0.6; });
    window.addEventListener("scroll", function () { boost += (window.scrollY - lastY) * 0.05; lastY = window.scrollY; go(); }, { passive: true });
    function loop() {
      raf = 0;
      if (!seen) return;
      if (!half) measure();
      speed += (target - speed) * 0.06;
      boost *= 0.92;
      x -= speed + boost;
      if (half && x <= -half) x += half;
      if (x > 0) x -= half;
      box.style.setProperty("--x", x.toFixed(2) + "px");
      raf = requestAnimationFrame(loop);
    }
    function go() { if (!raf && seen) raf = requestAnimationFrame(loop); }
    new IntersectionObserver(function (es) { seen = es[0].isIntersecting; go(); }, { rootMargin: "100px" }).observe(box);
    window.addEventListener("resize", measure);
  })();

  /* ---------- Окно кейса вырастает из карточки (FLIP) ---------- */
  (function () {
    var grid = document.querySelector(".cases__grid");
    var modal = document.getElementById("case-modal");
    var win = modal && modal.querySelector(".cmodal__win");
    if (!grid || !win || still || !win.animate) return;
    var from = null;
    grid.addEventListener("click", function (e) {
      var btn = e.target.closest(".ccard__btn");
      if (btn) from = btn.getBoundingClientRect();
    }, true);
    new MutationObserver(function () {
      if (modal.hidden || !from) return;
      var to = win.getBoundingClientRect();
      var dx = from.left - to.left, dy = from.top - to.top;
      var sx = from.width / to.width, sy = from.height / to.height;
      win.animate([
        { transform: "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")", opacity: 0.4 },
        { transform: "none", opacity: 1 }
      ], { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
      var inner = win.children;
      [].forEach.call(inner, function (c, i) {
        if (c.classList.contains("cmodal__close")) return;
        c.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
          { duration: 500, delay: 180 + i * 40, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" });
      });
      from = null;
    }).observe(modal, { attributes: true, attributeFilter: ["hidden"] });
  })();

  /* ---------- Копирование почты ---------- */
  (function () {
    var link = document.querySelector('.footer__col a[href^="mailto:"]');
    if (!link || !navigator.clipboard) return;
    var wrap = document.createElement("span");
    wrap.className = "footer__mail";
    link.parentNode.insertBefore(wrap, link);
    wrap.appendChild(link);
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "footer__copy"; btn.setAttribute("aria-label", "Скопировать адрес");
    btn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" stroke-width="1.4"/></svg>';
    var done = document.createElement("span");
    done.className = "footer__copy-done"; done.textContent = "Скопировано"; done.setAttribute("aria-live", "polite");
    wrap.appendChild(btn); wrap.appendChild(done);
    var t;
    btn.addEventListener("click", function () {
      navigator.clipboard.writeText(link.textContent.trim()).then(function () {
        wrap.classList.add("is-copied");
        clearTimeout(t); t = setTimeout(function () { wrap.classList.remove("is-copied"); }, 1800);
      });
    });
  })();

  /* ---------- Зерно на тёмных секциях ---------- */
  if (!still) {
    [].forEach.call(document.querySelectorAll(".reviews, .footer, .fit__half--no"), function (el) {
      el.classList.add("grain");
    });
  }

  /* ---------- Отбор: граница следит за курсором ---------- */
  (function () {
    var fit = document.querySelector(".fit");
    var no = fit && fit.querySelector(".fit__half--no");
    if (!fit || !no || !hover || still) return;
    fit.addEventListener("pointermove", function (e) {
      var r = fit.getBoundingClientRect();
      var k = (e.clientX - r.left) / r.width - 0.5;   // -0.5 … 0.5
      no.style.setProperty("--cut", (k * 6).toFixed(2) + "%");
    }, { passive: true });
    fit.addEventListener("pointerleave", function () { no.style.setProperty("--cut", "0%"); });
  })();
})();


/* ============================================================
   v7 · мягкий свет вместо красных заливок. На элементы с data-glow
   кладётся крошечный холст; поле и реакцию на курсор считает тот же
   initSoftGlow, что и на карточках утечек.
   ============================================================ */
(function () {
  if (!window.__softGlow) return;
  var list = [].slice.call(document.querySelectorAll("[data-glow]"));
  var last = document.querySelector(".stack__card:last-child");
  if (last) { last.setAttribute("data-origin", "top"); last.setAttribute("data-gain", "0.85"); list.push(last); }
  list.forEach(function (el) {
    var c = document.createElement("canvas");
    c.className = "glow-fx";
    c.setAttribute("aria-hidden", "true");
    ["data-origin", "data-gain", "data-fade"].forEach(function (a) {
      if (el.hasAttribute(a)) c.setAttribute(a, el.getAttribute(a));
    });
    el.classList.add("has-glow");
    el.insertBefore(c, el.firstChild);
    // курсор слушаем на самой карточке, а не на холсте
    var orig = c.closest;
    c.closest = function (s) { return s === ".leak" ? el : orig.call(c, s); };
    window.__softGlow(c);
  });
})();


/* ============================================================
   v10 · подвал. Страница уезжает вверх и открывает подвал,
   который стоит под ней на месте. Слово GG AGENCY собрано из букв:
   каждая поднимается из-под кромки со своим шагом, а толщина букв
   следует за курсором — тяжелеют те, что ближе. Без курсора по слову
   медленно идёт волна толщины.
   ============================================================ */
(function () {
  "use strict";
  var footer = document.querySelector(".footer");
  if (!footer) return;
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var word = footer.querySelector("[data-letters]");
  var bg = footer.querySelector(".footer__bg");
  var last = document.querySelector("#quiz");
  var letters = [];

  if (word) {
    var text = word.textContent;
    word.textContent = "";
    text.split("").forEach(function (ch, i) {
      var s = document.createElement("span");
      s.className = "fl";
      s.style.setProperty("--i", i);
      s.textContent = ch === " " || ch === "\u00a0" ? "\u00a0" : ch;
      word.appendChild(s);
      letters.push({ el: s, w: 500, space: ch === " " || ch === "\u00a0" });
    });
  }

  var reveal = false, fh = 0;
  function layout() {
    fh = footer.offsetHeight;
    // Открытие из-под страницы — только если подвал целиком влезает в экран
    reveal = !still && window.innerWidth > 900 && fh <= window.innerHeight * 0.96 && !!last;
    document.documentElement.classList.toggle("has-reveal", reveal);
    document.documentElement.style.setProperty("--footer-h", reveal ? fh + "px" : "0px");
  }

  function uncovered() {
    if (reveal) {
      var doc = document.documentElement.scrollHeight;
      return Math.max(0, Math.min(1, (window.scrollY + window.innerHeight - (doc - fh)) / fh));
    }
    var r = footer.getBoundingClientRect();
    return Math.max(0, Math.min(1, (window.innerHeight - r.top) / Math.min(r.height, window.innerHeight)));
  }

  var px = -1, py = -1, raf = 0, t0 = performance.now(), shown = -1;
  footer.addEventListener("pointermove", function (e) { px = e.clientX; py = e.clientY; });
  footer.addEventListener("pointerleave", function () { px = -1; py = -1; });

  function frame(now) {
    raf = 0;
    var u = uncovered();
    if (Math.abs(u - shown) > 0.002) {
      shown = u;
      footer.style.setProperty("--rise", still ? 1 : (1 - Math.pow(1 - u, 2)).toFixed(3));
      footer.classList.toggle("is-in", u > 0.2);
      // холст со светом не считается, пока подвал закрыт страницей
      if (bg) bg.hidden = u <= 0.001;
    }
    /* Игра толщины букв снята по замечанию: слово стоит спокойно,
       весом 500. Остались подъём при открытии подвала и свет. */
    return;
    var t = (now - t0) / 1000, moving = false;
    for (var i = 0; i < letters.length; i++) {
      var L = letters[i]; if (L.space) continue;
      var target;
      if (px >= 0) {
        var r = L.el.getBoundingClientRect();
        var dx = (r.left + r.width / 2 - px) / (window.innerWidth * 0.22);
        var dy = (r.top + r.height / 2 - py) / (window.innerHeight * 0.6);
        var d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
        target = 260 + (1 - d) * (1 - d) * 600;
      } else {
        target = 430 + Math.sin(t * 0.9 - i * 0.55) * 150;
      }
      L.w += (target - L.w) * 0.1;
      L.el.style.fontVariationSettings = '"wght" ' + L.w.toFixed(0);
      moving = true;
    }
    if (moving) raf = requestAnimationFrame(frame);
  }
  function go() { if (!raf) raf = requestAnimationFrame(frame); }

  var top = footer.querySelector("[data-top]");
  if (top) top.addEventListener("click", function (e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
  });

  layout();
  window.addEventListener("resize", function () { layout(); shown = -1; go(); });
  window.addEventListener("scroll", go, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); go(); });
  window.addEventListener("load", function () { layout(); go(); });
  go();
})();

/* ============================================================
   v11 · подсказка «Листайте вправо» под лентами со свайпом.
   ============================================================ */
(function () {
  "use strict";
  var RAILS = ".leaks-rail, .approach__rail, .reviews__strip, .situation .cards, .staff";
  var ICON = '<svg viewBox="0 0 28 10" fill="none" aria-hidden="true"><path d="M0 5h26M22 1l4 4-4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var items = [];

  [].forEach.call(document.querySelectorAll(RAILS), function (rail) {
    var hint = document.createElement("p");
    hint.className = "swipe-hint";
    hint.setAttribute("aria-hidden", "true");
    hint.innerHTML = "<span>Листайте вправо</span>" + ICON;
    rail.parentNode.insertBefore(hint, rail.nextSibling);
    var it = { rail: rail, hint: hint, used: false };
    rail.addEventListener("scroll", function () {
      if (rail.scrollLeft > 24 && !it.used) { it.used = true; hint.classList.add("is-used"); }
    }, { passive: true });
    items.push(it);
  });

  function check() {
    items.forEach(function (it) {
      var cs = getComputedStyle(it.rail);
      var swipe = (cs.overflowX === "auto" || cs.overflowX === "scroll") &&
                  it.rail.scrollWidth > it.rail.clientWidth + 16;
      it.hint.hidden = !swipe;
      if (!swipe) return;
      // лента без собственных полей — подсказка тоже без них
      it.hint.classList.toggle("swipe-hint--flush", parseFloat(cs.paddingRight) < 1 && parseFloat(cs.marginRight) >= 0);
      // родитель с большим gap: подтягиваем подсказку к ленте
      var ps = getComputedStyle(it.hint.parentNode);
      var gap = (ps.display.indexOf("flex") > -1 || ps.display.indexOf("grid") > -1) ? (parseFloat(ps.rowGap) || 0) : 0;
      it.hint.style.marginTop = gap > 14 ? (14 - gap) + "px" : "";
    });
  }
  check();
  var t;
  window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(check, 200); });
  window.addEventListener("load", check);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(check);
})();

/* ============================================================
   Форма заявки: окно, проверка полей, отправка в Telegram.
   Настройки лежат в form-config.js (в git его нет):
     window.GG_FORM = { token: "…", chat: "…" }
   или, если есть свой сервер-посредник:
     window.GG_FORM = { endpoint: "https://…" }
   ============================================================ */
(function () {
  "use strict";
  var modal = document.getElementById("lead");
  var form = document.getElementById("leadForm");
  if (!modal || !form) return;
  var win = modal.querySelector(".lead__win");
  var done = modal.querySelector(".lead__done");
  var send = form.querySelector(".lead__send");
  var status = form.querySelector(".lead__status");
  var cfg = window.GG_FORM || {};
  var last = null, from = "";

  function open(trigger) {
    last = trigger || null;
    from = trigger ? (trigger.textContent || "").replace(/\s+/g, " ").trim() : "";
    form.hidden = false; done.hidden = true;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    setTimeout(function () { var f = form.querySelector("input[name=name]"); if (f) f.focus({ preventScroll: true }); }, 60);
  }
  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
    if (last && last.focus) last.focus({ preventScroll: true });
  }
  function onKey(e) {
    if (e.key === "Escape") { close(); return; }
    if (e.key !== "Tab") return;
    var f = [].filter.call(win.querySelectorAll("button, [href], input:not(.lead__trap), textarea"), function (el) { return el.offsetParent !== null && !el.disabled; });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(".hero__cta, .nav__cta, .sheet__cta, [data-lead]");
    if (t) { e.preventDefault(); open(t); return; }
    var c = e.target.closest && e.target.closest("[data-lead-close]");
    if (c && modal.contains(c)) { if (c.tagName !== "A") e.preventDefault(); close(); }
  });

  function ready() {
    var ok = form.name.value.trim().length > 1 && form.contact.value.trim().length > 3 &&
             form.c1.checked && form.c2.checked && form.c3.checked;
    send.disabled = !ok;
    return ok;
  }
  form.addEventListener("input", ready);
  form.addEventListener("change", ready);

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!ready() || form.company.value) return;   // заполненная ловушка — бот
    var lines = [
      "<b>Заявка с сайта GG Agency</b>",
      "",
      "<b>Имя:</b> " + esc(form.name.value.trim()),
      "<b>Контакт:</b> " + esc(form.contact.value.trim())
    ];
    if (form.project && form.project.value.trim()) lines.push("<b>Проект:</b> " + esc(form.project.value.trim()));
    if (form.note.value.trim()) lines.push("<b>Что с продажами:</b> " + esc(form.note.value.trim()));
    lines.push("", "Согласия: политика, рассылки, обработка данных — отмечены");
    if (from) lines.push("Кнопка: " + esc(from));
    lines.push("Страница: " + esc(location.href.split("#")[0]));
    var text = lines.join("\n");

    var url, body;
    if (cfg.endpoint) { url = cfg.endpoint; body = { text: text }; }
    else if (cfg.token && cfg.chat) { url = "https://api.telegram.org/bot" + cfg.token + "/sendMessage"; body = { chat_id: cfg.chat, text: text, parse_mode: "HTML", disable_web_page_preview: true }; }
    else { status.textContent = "Форма ещё не подключена. Напишите нам в Telegram."; return; }

    send.disabled = true; status.textContent = "Отправляем…";
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
      .then(function (d) {
        if (d && d.ok === false) throw new Error(d.description || "error");
        form.reset(); status.textContent = ""; form.hidden = true; done.hidden = false;
      })
      .catch(function () {
        status.textContent = "Не получилось отправить. Попробуйте ещё раз или напишите нам в Telegram.";
        ready();
      });
  });
})();

/* ============================================================
   «Источники»: прилипший блок по высоте равен содержимому и стоит
   по центру экрана. На высоких мониторах под веером нет пустоты.
   ============================================================ */
(function () {
  "use strict";
  var sec = document.querySelector(".sources--lock");
  var stick = sec && sec.querySelector(".sources__sticky");
  var frame = stick && stick.querySelector(".frame");
  if (!stick || !frame) return;
  var wide = matchMedia("(min-width: 721px)");
  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var t = 0;
  function fit() {
    stick.style.height = ""; stick.style.top = "";
    if (!wide.matches || still.matches) return;
    // даём основному скрипту пересчитать веер от полной высоты
    window.dispatchEvent(new Event("gg:refit"));
    var cs = getComputedStyle(stick), vh = window.innerHeight;
    var pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
    var used = frame.offsetHeight + pt + pb;
    if (used >= vh) return;                       // на низких окнах всё как было
    stick.style.height = used + "px";
    // верхнее поле уходит за край экрана только если блок не помещается с ним
    stick.style.top = Math.max(0, (vh - used) / 2 - pt * 0.35) + "px";
  }
  function later() { clearTimeout(t); t = setTimeout(fit, 120); }
  window.addEventListener("resize", later);
  window.addEventListener("load", later);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  later();
})();

/* Телефон в мосте: масштаб сцены к ширине панели (картинка 800px) */
(function () {
  var panel = document.querySelector(".ask__panel--phone");
  if (!panel) return;
  function fit() { panel.style.setProperty("--k", (panel.clientWidth / 800).toFixed(4)); }
  fit();
  if ("ResizeObserver" in window) new ResizeObserver(fit).observe(panel);
  else window.addEventListener("resize", fit);
})();

/* Статический режим: график на последнем этапе, всё в покое */
(function () {
  if (!document.documentElement.classList.contains("is-static")) return;
  window.addEventListener("load", function () {
    setTimeout(function () {
      /* Цифры лентой при reduced-motion стоят на нуле — возвращаем текст */
      document.querySelectorAll("[data-nr]").forEach(function (el) {
        var a = el.querySelector(".odo-a11y"); if (a) el.textContent = a.textContent;
      });
      var st = document.querySelectorAll(".path__stage");
      st.forEach(function (s, i) { s.classList.toggle("is-active", i === st.length - 1); s.style.setProperty("--fill", "1"); });
      var lg = document.querySelector("[data-path-legend]"); if (lg) lg.textContent = "растёт по плану";
      document.querySelectorAll(".fan__card").forEach(function (c) { c.style.transform = "none"; c.style.opacity = "1"; });
      document.querySelectorAll(".leaks-rail, .approach__rail").forEach(function (r) { r.style.transform = "none"; r.scrollLeft = 0; });
      window.dispatchEvent(new Event("resize"));
      /* График рисуется только рядом с экраном: проходим страницу
         до конца, даём ему дорисоваться и возвращаемся наверх. */
      var y = 0, H = document.documentElement.scrollHeight, path = document.querySelector(".path");
      (function step() {
        if (y < H) { window.scrollTo(0, y); y += 500; setTimeout(step, 40); return; }
        if (path) window.scrollTo(0, path.getBoundingClientRect().top + window.scrollY - 100);
        setTimeout(function () { window.scrollTo(0, 0); document.documentElement.classList.add("is-static-ready"); }, 1200);
      })();
    }, 800);
  });
})();
