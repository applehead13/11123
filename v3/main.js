/* ==========================================================================
   AXIOM.tech v3 — скрипты (чистый JS, без библиотек)
   ========================================================================== */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
  // плавная прокрутка якорей — после загрузки и восстановления позиции
  // Плавная инерционная прокрутка (Lenis). Не включается при «уменьшить движение»; якоря-ссылки тоже едут плавно.
  if (window.Lenis && !reduce) {
    var lenis = new Lenis({ lerp: .09, wheelMultiplier: 1, smoothWheel: true, anchors: true });
    window.axLenis = lenis;
    (function lenisRaf(t) { lenis.raf(t); requestAnimationFrame(lenisRaf); })(0);
  }
  // Ссылки-заглушки (документы, телефон, почта) — у них есть наведение, но они не кликаются: сайт-концепт.
  // Внутренние якоря сайта и ссылка на автора работают.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var h = a.getAttribute('href') || '';
    if (h === '#' || /^(tel|mailto):/i.test(h)) e.preventDefault();
  });
  var clamp = function (v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v)); };
  var rafThrottle = function (fn) { var t = false; return function () { if (t) return; t = true; requestAnimationFrame(function () { t = false; fn(); }); }; };

  /* ---------- Шапка, меню, подсветка пунктов ---------- */
  var top = $('.top');
  function onScrollTop() { top.classList.toggle('is-solid', scrollY > 40); }
  addEventListener('scroll', onScrollTop, { passive: true }); onScrollTop();
  var burger = $('.burger');
  burger.addEventListener('click', function () {
    var open = !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', open); burger.setAttribute('aria-expanded', open);
  });
  $$('.mmenu a').forEach(function (a) { a.addEventListener('click', function () { document.body.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false'); }); });
  var navLinks = $$('.nav a');
  if ('IntersectionObserver' in window) {
    var navIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) navLinks.forEach(function (a) { a.classList.toggle('is-on', a.getAttribute('href') === '#' + e.target.id); }); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main > section[id]').forEach(function (s) { navIO.observe(s); });
  }

  /* ---------- Появление: «прилёт» карточек и мерцание заголовков ---------- */
  var reveal = $$('[data-fly], [data-boot]');
  if (reduce || !('IntersectionObserver' in window)) reveal.forEach(function (el) { el.classList.add('is-in'); });
  else {
    var rIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); rIO.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -12% 0px' });
    reveal.forEach(function (el) { rIO.observe(el); });
  }

  /* ---------- Первый экран: деталь печатается слой за слоем ---------- */
  (function printer() {
    var cv = $('#printer'); if (!cv) return;
    var ctx = cv.getContext('2d');
    var hL = $('#hLayer'), hT = $('#hTotal'), hZ = $('#hZ');
    var LAYERS = 40, HEIGHT = 1.25, TEETH = 12;
    hT.textContent = String(LAYERS).padStart(3, '0');

    // Контур шестерни (вид сверху) и отверстие
    var outer = [], hole = [];
    for (var t = 0; t < TEETH; t++) {
      var a0 = t / TEETH * Math.PI * 2, s = Math.PI * 2 / TEETH;
      [[0, .8], [.18, .8], [.28, 1], [.62, 1], [.72, .8]].forEach(function (p) { outer.push([Math.cos(a0 + p[0] * s) * p[1], Math.sin(a0 + p[0] * s) * p[1]]); });
    }
    for (var h = 0; h < 32; h++) { var ah = h / 32 * Math.PI * 2; hole.push([Math.cos(ah) * .3, Math.sin(ah) * .3]); }
    var tips = outer.filter(function (p, i) { return i % 5 === 2 || i % 5 === 3; });

    // Сцена: деталь-каркас печатается на светлой сетке пола, уходящей к горизонту
    var variant = 1;
    var PITCH = { 1: -.3 };
    var W, H, dpr, cx, cy, f, rot = 0, pitch = PITCH[variant], mxTarget = 0, mx = 0;
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var wide = W > 1000;
      cx = wide ? W * .68 : W * .5; cy = wide ? H * .4 : H * .3 + Math.min(50, H * .06);   // телефон: деталь и сетка ниже, под тремя строками данных
      f = Math.min(W, H) * (wide ? 1.05 : .9);
      if (wide) cy = H * .36 + 30;      // +30px: деталь и подписи чуть ниже
      // «Идёт печать» — справа сверху от детали, характеристики — слева снизу (по диагонали).
      // Оба блока выравниваются по колонкам сетки (12 колонок контейнера).
      var hud = $('.hero__hud'), spec = $('.hero__spec');
      if (hud && spec) {
        if (wide) {
          var wrapEl = document.querySelector('.wrap'), cs = getComputedStyle(wrapEl);
          var gut = parseFloat(cs.paddingLeft) || 40, gap = parseFloat(getComputedStyle(document.querySelector('.hero__ui')).columnGap) || 16;
          var inner = Math.min(W, 2400) - gut * 2, x0 = (W - Math.min(W, 2400)) / 2 + gut, col = (inner - gap * 11) / 12;
          var colStart = function (n) { return x0 + (n - 1) * (col + gap); };          // левый край n-й колонки
          var snap = function (x) { return Math.max(1, Math.min(12, Math.round((x - x0) / (col + gap)) + 1)); };
          var colEnd = function (n) { return colStart(n) + col; };
          cx = colStart(9) - gap / 2;   // центр детали — на линии сетки между 8-й и 9-й колонками
          // Полуширина детали на экране ≈ 0.24f. Блоки ставим симметрично:
          // «идёт печать» — от ближайшей колонки справа от детали, характеристики — до ближайшей колонки слева.
          var half = f * .24, pad = 0;
          var nR = 12; for (var k = 1; k <= 12; k++) if (colStart(k) >= cx + half + pad) { nR = k; break; }
          var nL = 1;  for (var k2 = 12; k2 >= 1; k2--) if (colEnd(k2) <= cx - half - pad) { nL = k2; break; }
          hud.style.left = Math.round(colStart(nR)) + 'px';
          spec.style.left = Math.round(colEnd(nL) - spec.offsetWidth) + 'px';
          // По вертикали — одинаковый отступ от верха и низа детали
          var dy = f * .17;
          hud.style.top = Math.round(Math.max(cy - dy - hud.offsetHeight, 96)) + 'px';
          var limit = $('.hero__copy').getBoundingClientRect().top - cv.getBoundingClientRect().top - spec.offsetHeight - 24;
          spec.style.top = Math.round(Math.min(cy + dy, limit)) + 'px';
        } else { hud.style.left = hud.style.top = spec.style.left = spec.style.top = ''; }
      }

    }
    function proj(x, y, z, a) {
      var ca = Math.cos(a), sa = Math.sin(a);
      var x1 = x * ca - z * sa, z1 = x * sa + z * ca;
      var cp = Math.cos(pitch), sp = Math.sin(pitch);
      var y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      var d = 4.2 + z2;
      return [cx + f * x1 / d, cy - f * (y2 - .35) / d, d];
    }
    function ring(pts, y, a, close) {
      ctx.beginPath();
      pts.forEach(function (p, i) { var q = proj(p[0], y, p[1], a); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      if (close) ctx.closePath();
    }
    // Пол-сетка: линии уходят к горизонту. Ближний край пола обрезаем, чтобы
    // точки не попадали «за камеру» (иначе перспектива выворачивает линии).
    var NEAR = -1.9, FAR = 14;      // у камеры z отрицательный, вдаль — положительный
    function floor() {
      ctx.lineWidth = 1;
      var cxSave = cx, cySave = cy; cx = W / 2; cy = W > 1000 ? H * .5 : cySave;      // точка схода — по центру экрана: сетка расходится симметрично, мы смотрим прямо
      var N = 40, STEP = .8;      // линии с шагом .5 уходят далеко в стороны: сетка во всю ширину экрана
      // линии вглубь: растворяются у горизонта и у переднего края
      for (var i = -N; i <= N; i++) {
        var A = proj(i * STEP, 0, FAR, 0), B = proj(i * STEP, 0, NEAR, 0);
        var g = ctx.createLinearGradient(A[0], A[1], B[0], B[1]);
        g.addColorStop(0, 'rgba(238, 229, 213, 0.1)'); g.addColorStop(.3, 'rgba(238, 229, 213, 0.4)'); g.addColorStop(.88, 'rgba(238, 229, 213, 0.4)'); g.addColorStop(1, 'rgba(238, 229, 213, 0.1)');
        ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      }
      // поперечные линии: шаг по глубине постоянный, поэтому к горизонту они сгущаются
      for (var z = NEAR; z <= FAR + 1e-6; z += STEP) {
        var t = (z - NEAR) / (FAR - NEAR);
        var alpha = .34 * Math.min(1, (1 - t) * 2.6) * Math.min(1, t * 9);
        var C = proj(-N * STEP, 0, z, 0), D = proj(N * STEP, 0, z, 0);
        ctx.strokeStyle = 'rgba(238,229,213,' + alpha.toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(C[0], C[1]); ctx.lineTo(D[0], D[1]); ctx.stroke();
      }
          cx = cxSave; cy = cySave;
    }
    // Платформа принтера под деталью: вращается вместе с ней
    function plate(a) {
      var R = 1.35, i, A, B;
      ctx.fillStyle = 'rgba(27, 30, 33, 0.94)';
      ring([[-R, -R], [R, -R], [R, R], [-R, R]], -.02, a, true); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 94, 26, 0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = 'rgba(238, 229, 213, 0.1)'; ctx.lineWidth = 1;
      for (i = -R + .27; i < R; i += .27) {
        A = proj(i, -.02, -R, a); B = proj(i, -.02, R, a); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
        A = proj(-R, -.02, i, a); B = proj(R, -.02, i, a); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      }
      // торец платформы
      ctx.strokeStyle = 'rgba(255, 94, 26, 0.35)';
      ring([[-R, -R], [R, -R], [R, R], [-R, R]], -.12, a, true); ctx.stroke();
    }
    // Миллиметровка в экранных координатах: неподвижная
    function paper() {
      var step = 12, x, y;
      for (x = (cx % step); x < W; x += step) { ctx.strokeStyle = Math.round((x - cx) / step) % 10 === 0 ? 'rgba(255, 94, 26, 0.15)' : 'rgba(255, 94, 26, 0.15)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (y = (cy % step); y < H; y += step) { ctx.strokeStyle = Math.round((y - cy) / step) % 10 === 0 ? 'rgba(255, 94, 26, 0.15)' : 'rgba(255, 94, 26, 0.15)'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      // осевые линии чертежа
      ctx.setLineDash([14, 4, 2, 4]); ctx.strokeStyle = 'rgba(238, 229, 213, 0.2)';
      ctx.beginPath(); ctx.moveTo(cx - f * .5, cy + f * .04); ctx.lineTo(cx + f * .5, cy + f * .04); ctx.stroke();
      ctx.setLineDash([]);
    }

    var start = performance.now(), PRINT = 9000, HOLD = 1800;
    function frame(now) {
      var cyc = Math.max(0, now - start) % (PRINT + HOLD);
      var p = reduce ? 1 : clamp(cyc / PRINT, 0, 1);
      if (!reduce && variant !== 3) rot += .0035;
      mx += (mxTarget - mx) * .05;
      var a = variant === 3 ? .26 : rot + mx * .6;
      ctx.clearRect(0, 0, W, H);
      if (variant === 1) floor();
      if (variant === 2) plate(a);
      if (variant === 3) paper();
      var cur = Math.min(LAYERS - 1, Math.floor(p * LAYERS));
      var yAt = function (k) { return (k + 1) / LAYERS * HEIGHT; };
      // Призрак ещё не напечатанной части
      ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(238, 229, 213, 0.1)'; ctx.lineWidth = 1;
      [0, LAYERS - 1].forEach(function (k) { ring(outer, yAt(k), a, true); ctx.stroke(); });
      ctx.setLineDash([]);
      // Напечатанные слои
      for (var k = 0; k <= cur; k++) {
        var last = k === cur && p < 1;
        ctx.lineWidth = last ? 2 : 1;
        ctx.strokeStyle = last ? '#ff5e1a' : 'rgba(238,229,213,' + (.18 + .5 * k / LAYERS).toFixed(3) + ')';
        if (last) { ctx.shadowColor = 'rgba(255, 94, 26, 0.9)'; ctx.shadowBlur = 14; }
        ring(outer, yAt(k), a, true); ctx.stroke();
        ring(hole, yAt(k), a, true); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // Рёбра зубьев
      ctx.strokeStyle = 'rgba(238, 229, 213, 0.2)'; ctx.lineWidth = 1;
      tips.forEach(function (pt) { var A = proj(pt[0], 0, pt[1], a), B = proj(pt[0], yAt(cur), pt[1], a); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); });
      // Лазер: луч сверху в точку, бегущую по контуру
      if (p < 1) {
        var idx = Math.floor((cyc / 60) % outer.length), pt = outer[idx];
        var S = proj(pt[0], yAt(cur), pt[1], a), T = proj(0, 2.2, 0, a);
        var g = ctx.createLinearGradient(T[0], T[1], S[0], S[1]);
        g.addColorStop(0, 'rgba(255, 94, 26, 0.15)'); g.addColorStop(1, 'rgba(255, 94, 26, 0.9)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(T[0], T[1]); ctx.lineTo(S[0], S[1]); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.shadowColor = '#ff5e1a'; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.arc(S[0], S[1], 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
      hL.textContent = String(cur + 1).padStart(3, '0');
      hZ.textContent = (yAt(cur) / HEIGHT * 40).toFixed(1);   // условная высота детали — 40 мм
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    var raf, visible = true;
    addEventListener('mousemove', function (e) { mxTarget = (e.clientX / innerWidth - .5); }, { passive: true });
    addEventListener('resize', size, { passive: true });
    size();
    if ('IntersectionObserver' in window && !reduce) {
      new IntersectionObserver(function (es) {
        var v = es[0].isIntersecting;
        if (v && !visible) { visible = true; raf = requestAnimationFrame(frame); }
        if (!v) { visible = false; cancelAnimationFrame(raf); }
      }).observe(cv);
    }
    raf = requestAnimationFrame(frame);

  })();


  /* ---------- Сетка-подсказка: клавиша G или кнопка внизу слева ---------- */
  (function gridView() {
    var ov = document.createElement('div'); ov.className = 'gridview'; ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = '<div class="gridview__wrap"><div class="gridview__cols">' + new Array(13).join('<i></i>') + '</div></div>';
    document.body.appendChild(ov);
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'gridview__btn'; document.body.appendChild(btn);
    function label() { btn.textContent = 'Сетка ' + (ov.classList.contains('is-on') ? 'вкл' : 'выкл') + ' · ' + innerWidth + 'px'; }
    function toggle(on) {
      on = on === undefined ? !ov.classList.contains('is-on') : on;
      ov.classList.toggle('is-on', on); btn.setAttribute('aria-pressed', on);
      try { localStorage.setItem('axGrid', on ? '1' : '0'); } catch (e) {}
      label();
    }
    btn.addEventListener('click', function () { toggle(); });
    addEventListener('keydown', function (e) {
      if (/^(input|textarea|select)$/i.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'g' || e.key === 'G' || e.key === 'п' || e.key === 'П') toggle();
    });
    addEventListener('resize', label, { passive: true });
    var saved = null; try { saved = localStorage.getItem('axGrid'); } catch (e) {}
    toggle(saved === null ? true : saved === '1');   // по умолчанию включена
  })();

  /* ---------- Общие помощники для полосы печати и курсора (как в основной версии) ---------- */
  var reduceMotion = reduce;
  function anchorTarget(el) { return el; }
  function scrollToEl(el) { if (window.axLenis) window.axLenis.scrollTo(el, { offset: 0 }); else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
  function isLightAt(x, y, skipEl) {
    var stack = document.elementsFromPoint(x, y);
    for (var i = 0; i < stack.length; i++) {
      var node = stack[i];
      if (skipEl && (node === skipEl || skipEl.contains(node))) continue;
      var m = getComputedStyle(node).backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (m) { var p = m[1].split(','); var al = p.length > 3 ? parseFloat(p[3]) : 1;
        if (al > .5) return (.2126 * +p[0] + .7152 * +p[1] + .0722 * +p[2]) / 255 > .55; }
    }
    return null;
  }
  /* ---------- Полоса «печати» внизу экрана --------------------------------- */

  var PRINT_BAR = false;      // нижняя полоса «печати» пока выключена — вернуть: true
  function initPrintBar() {
    if (!PRINT_BAR || document.getElementById('axprint')) return;
    var TOTAL_LAYERS = 240;   // декоративный «общий счёт слоёв»
    var IDLE_DELAY = 500;     // мс без скролла до статуса «ПАУЗА»

    var root = document.createElement('div');
    root.id = 'axprint';
    root.innerHTML =
      '<div class="axp-bar">' +
        '<div class="axp-layer">' +
          '<i class="axp-status" id="axpStatus"></i>' +
          '<span class="axp-status-txt" id="axpStatusTxt">ИДЁТ ПЕЧАТЬ</span>' +
          '<i class="axp-divider"></i>' +
          'СЛОЙ <b id="axpLayerNo">001</b><span>/' + TOTAL_LAYERS + '</span>' +
        '</div>' +
        '<div class="axp-rail"><div class="axp-segs" id="axpSegs"></div></div>' +
        '<div class="axp-chapter"><span class="axp-chapter__no" id="axpChNo">01/01</span><span class="axp-chapter__name" id="axpChName">НАЧАЛО</span></div>' +
      '</div>';
    document.body.appendChild(root);

    var segsWrap = $('#axpSegs', root), layerNoEl = $('#axpLayerNo', root);
    var chNoEl = $('#axpChNo', root), chNameEl = $('#axpChName', root), statusTxtEl = $('#axpStatusTxt', root);
    var chapters = [], segEls = [], head, raf = null, idleTimer = null;

    var pad = function (n, len) { n = String(Math.round(n)); while (n.length < len) n = '0' + n; return n; };
    var docMax = function () { return Math.max(1, document.documentElement.scrollHeight - window.innerHeight); };

    function build() {
      var max = docMax();
      chapters = $$('[data-chapter]').map(function (sec) {
        var t = anchorTarget(sec);
        var top = t.getBoundingClientRect().top + window.scrollY;
        return { name: sec.dataset.chapter.toUpperCase(), frac: clamp(top / max), el: sec };
      }).sort(function (a, b) { return a.frac - b.frac; });

      if (!chapters.length) { root.classList.remove('is-ready'); return false; }

      segsWrap.innerHTML = chapters.map(function (c, i) {
        return '<button type="button" class="axp-seg" data-i="' + i + '" aria-label="' + c.name + '">' +
          '<span class="axp-seg__no">' + pad(i + 1, 2) + ' // ' + c.name + '</span>' +
          '<span class="axp-seg__fill"></span></button>';
      }).join('') + '<div class="axp-head" id="axpHead"></div>';

      head = $('#axpHead', segsWrap);
      segEls = $$('.axp-seg', segsWrap).map(function (btn) { return { btn: btn, fill: $('.axp-seg__fill', btn) }; });
      segEls.forEach(function (s, i) { s.btn.addEventListener('click', function () { scrollToEl(chapters[i].el); }); });
      return true;
    }

    function update() {
      raf = null;
      if (!chapters.length) return;
      var frac = clamp(window.scrollY / docMax());
      layerNoEl.textContent = pad(Math.max(1, TOTAL_LAYERS * frac), 3);

      var idx = 0, activeSegFrac = 0;
      for (var i = 0; i < chapters.length; i++) {
        var start = chapters[i].frac;
        var end = i + 1 < chapters.length ? chapters[i + 1].frac : 1;
        var segFrac = end > start ? clamp((frac - start) / (end - start)) : (frac >= start ? 1 : 0);
        segEls[i].fill.style.width = (segFrac * 100) + '%';
        segEls[i].btn.classList.toggle('is-done', segFrac >= 0.999);
        if (frac >= start - 0.0005) { idx = i; activeSegFrac = segFrac; }
      }
      head.style.left = ((idx + activeSegFrac) / chapters.length * 100) + '%';
      chNoEl.textContent = pad(idx + 1, 2) + '/' + pad(chapters.length, 2);
      chNameEl.textContent = chapters[idx].name;

      if (frac >= 0.999) {
        clearTimeout(idleTimer);
        root.classList.remove('is-idle'); root.classList.add('is-complete');
        statusTxtEl.textContent = 'ПЕЧАТЬ ЗАВЕРШЕНА';
      } else {
        root.classList.remove('is-complete');
      }
      root.classList.add('is-ready');
    }
    function kick() { if (raf === null) raf = requestAnimationFrame(update); }

    window.addEventListener('scroll', function () {
      var frac = clamp(window.scrollY / docMax());
      if (frac < 0.999) {
        root.classList.remove('is-idle', 'is-complete');
        statusTxtEl.textContent = 'ИДЁТ ПЕЧАТЬ';
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function () { root.classList.add('is-idle'); statusTxtEl.textContent = 'ПАУЗА'; }, IDLE_DELAY);
      }
      kick();
    }, { passive: true });
    window.addEventListener('resize', function () { build(); kick(); }, { passive: true });
    window.addEventListener('load', function () { build(); kick(); });
    if (window.ResizeObserver) new ResizeObserver(function () { build(); kick(); }).observe(document.body);
    build(); kick();
  }

  /* ---------- Курсор-визир (только мышь, экран ≥ 1024px) -------------------- */

  function initCursor() {
    if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    if (window.innerWidth < 1024 || document.getElementById('axc')) return;

    var E_CROSS = reduceMotion ? 1 : 0.20;   // инерция крестовины
    var E_RET = reduceMotion ? 1 : 0.13;     // инерция визира
    var PLATE = 300, PAD = 6, IDLE = 40;
    var HIT = 'a,button,[role="button"],input[type="submit"],.btn,.axf-upload,[data-cursor="hit"]';
    var TEXT = 'input[type="text"],input[type="email"],input[type="tel"],input[type="search"],input[type="number"],input[type="password"],textarea,[contenteditable="true"]';
    var ARM = '<svg viewBox="-2 -2 20 20" fill="none"><path d="M0 14L0 0L14 0" stroke="currentColor" stroke-width="2"/></svg>';
    var CROSS = '<svg viewBox="0 0 14 14" fill="none"><path d="M7 0V5M7 9V14M0 7H5M9 7H14" stroke="currentColor" stroke-width="2"/></svg>';

    var root = document.createElement('div');
    root.id = 'axc';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<i class="axc__v"></i><i class="axc__h"></i><i class="axc__dot">' + CROSS + '</i>' +
      '<span class="axc__co">X000.0  Y000.0</span>' +
      '<div class="axc__ret">' +
        '<div class="axc__c axc__c--tl">' + ARM + '</div><div class="axc__c axc__c--tr">' + ARM + '</div>' +
        '<div class="axc__c axc__c--br">' + ARM + '</div><div class="axc__c axc__c--bl">' + ARM + '</div>' +
      '</div>';
    document.body.appendChild(root);
    document.documentElement.classList.add('axc-on');

    var vLine = $('.axc__v', root), hLine = $('.axc__h', root), dot = $('.axc__dot', root);
    var co = $('.axc__co', root), ret = $('.axc__ret', root);

    var mx = innerWidth / 2, my = innerHeight / 2;
    var cx = mx, cy = my, rx = mx, ry = my, rw = IDLE, rh = IDLE, tx = mx, ty = my, tw = IDLE, th = IDLE;
    var locked = null, raf = null, live = false;

    var mm = function (v) {
      var p = Math.max(0, v).toFixed(1).split('.');
      while (p[0].length < 3) p[0] = '0' + p[0];
      return p[0] + '.' + p[1];
    };

    function retarget() {
      if (locked && document.contains(locked)) {
        var r = locked.getBoundingClientRect();
        if (r.width && r.width < innerWidth * 0.6 && r.height < innerHeight * 0.6) {
          tx = r.left + r.width / 2; ty = r.top + r.height / 2; tw = r.width + PAD * 2; th = r.height + PAD * 2;
          return;
        }
      }
      tx = mx; ty = my; tw = IDLE; th = IDLE;
    }

    function frame() {
      retarget();
      var light = isLightAt(mx, my, root);
      if (light !== null) root.classList.toggle('is-light', light);

      cx += (mx - cx) * E_CROSS; cy += (my - cy) * E_CROSS;
      rx += (tx - rx) * E_RET; ry += (ty - ry) * E_RET; rw += (tw - rw) * E_RET; rh += (th - rh) * E_RET;

      vLine.style.transform = 'translate3d(' + cx + 'px,0,0)';
      hLine.style.transform = 'translate3d(0,' + cy + 'px,0)';
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      co.style.transform = 'translate3d(' + (mx + 14) + 'px,' + (my - 16) + 'px,0)';
      co.textContent = 'X' + mm(mx / innerWidth * PLATE) + '  Y' + mm(my / innerHeight * PLATE);
      ret.style.width = rw + 'px'; ret.style.height = rh + 'px';
      ret.style.transform = 'translate3d(' + (rx - rw / 2) + 'px,' + (ry - rh / 2) + 'px,0)';

      var still = Math.abs(mx - cx) < .1 && Math.abs(my - cy) < .1 && Math.abs(tx - rx) < .1 &&
                  Math.abs(ty - ry) < .1 && Math.abs(tw - rw) < .1 && Math.abs(th - rh) < .1;
      raf = still ? null : requestAnimationFrame(frame);
    }
    function kick() { if (raf === null) raf = requestAnimationFrame(frame); }

    document.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (!live) { live = true; cx = mx; cy = my; rx = mx; ry = my; root.classList.add('is-on'); }
      kick();
    }, { passive: true });
    document.addEventListener('mouseover', function (e) {
      var t = e.target;
      if (!t.closest) return;
      if (t.closest(TEXT)) { document.documentElement.classList.add('axc-native'); return; }
      document.documentElement.classList.remove('axc-native');
      var h = t.closest(HIT);
      locked = h || null;
      root.classList.toggle('is-lock', !!h);
      kick();
    }, { passive: true });
    document.addEventListener('mouseleave', function () { root.classList.remove('is-on'); });
    document.addEventListener('mouseenter', function () { if (live) root.classList.add('is-on'); kick(); });
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick, { passive: true });
    kick();
  }

  /* ---------- Стекло: отражение «плывёт» при прокрутке и движении мыши ---------- */

  function initGlass() {
    if (reduceMotion) return;
    var root = document.documentElement;
    var mx = 0.5, my = 0.5;
    function update() {
      // Горизонталь: прокрутка + мышь, вертикаль: только мышь (чуть-чуть)
      var x = 50 + ((window.scrollY * 0.012) % 100) * 0.9 + (mx - 0.5) * 24;
      var y = 50 + (my - 0.5) * 30;
      root.style.setProperty('--env-x', x.toFixed(2) + '%');
      root.style.setProperty('--env-y', y.toFixed(2) + '%');
    }
    var tick = rafThrottle(update);
    window.addEventListener('scroll', tick, { passive: true });
    document.addEventListener('mousemove', function (e) {
      mx = e.clientX / window.innerWidth; my = e.clientY / window.innerHeight; tick();
    }, { passive: true });
    update();
  }

  initPrintBar();
  initCursor();

  /* ---------- Кейсы: досье ---------- */
  var CASES = [
    { tag: 'Электроника', img: 'case-1.png', model: '../assets/models/case-1.glb', name: 'Корпус для\u00a0выносной электроники', dims: ['86\u00a0мм', '58\u00a0мм'],
      kv: [['отрасль', 'Электроника'], ['материал', 'инженерный полимер'], ['партия', '20\u00a0шт']],
      stats: [['20', 'корпусов', 1], ['0', 'деформаций'], ['+130°', 'рабочая температура', 1]],
      t: 'Заказчику требовалась партия корпусов для\u00a0датчиков, устанавливаемых рядом с\u00a0промышленной печью —\u00a0обычный ABS-пластик деформировался в\u00a0течение недели эксплуатации.',
      s: 'Подобрали инженерный полимер с\u00a0температурой стеклования выше рабочей на\u00a040°C, пигмент ввели в\u00a0массу материала вместо покраски —\u00a0чтобы цвет не\u00a0выгорал от\u00a0температуры.',
      r: 'Партия из\u00a020\u00a0корпусов, ноль деформаций после месяца тестов, экономия на\u00a0литьевой оснастке.' },
    { tag: 'Авиация', img: 'case-2.png', model: '../assets/models/case-2.glb', name: 'Кронштейн сложной геометрии для\u00a0лёгкого летательного аппарата',
      kv: [['отрасль', 'Авиация'], ['технология', 'SLM, титановый сплав'], ['прототип', '3\u00a0дня']],
      stats: [['22%', 'снижение веса'], ['3', 'дня до\u00a0прототипа']],
      t: 'Кронштейн крепления с\u00a0внутренними полостями, которые фрезеровкой не\u00a0получить, а\u00a0нужны максимальная прочность при\u00a0минимальном весе.',
      s: 'Оптимизация модели убрала материал из\u00a0ненагруженных зон, печать титановым сплавом SLM с\u00a0последующей термообработкой для\u00a0снятия внутренних напряжений.',
      r: 'Снижение веса на\u00a022% при\u00a0сохранении расчётного запаса прочности, прототип готов через 3\u00a0дня.' },
    { tag: 'Энергетика', img: 'case-3.png', model: '../assets/models/case-3.glb', rim: .15, name: 'Партия термостойких крышек для\u00a0распределительных щитов',
      kv: [['отрасль', 'Энергетика'], ['технология', 'литьё в\u00a0силикон'], ['цвет', 'по\u00a0RAL заказчика']],
      stats: [['1000', 'штук', 1], ['5', 'дней вместо<br class="stat-br">недель']],
      t: '1000\u00a0крышек с\u00a0точным попаданием в\u00a0фирменный цвет заказчика, срок —\u00a0до\u00a0конца месяца, штатный поставщик литья не\u00a0успевал по\u00a0срокам.',
      s: 'Печать мастер-модели, снятие силиконовой формы, литьё партии полиуретаном с\u00a0точной цветопередачей по\u00a0RAL.',
      r: 'Вся партия изготовлена за\u00a05\u00a0дней вместо стандартных 3–4\u00a0недель на\u00a0литье с\u00a0металлической оснасткой.' },
    { tag: 'Медицина', img: 'case-4.png', model: '../assets/models/case-4.glb', name: 'Корпус диагностического анализатора',
      kv: [['отрасль', 'Медицина'], ['материал', 'химстойкий полимер'], ['цвет', 'RAL 7035']],
      stats: [['RAL 7035', 'точное совпадение'], ['1', 'попытка приёмки ОТК']],
      t: 'Корпус для\u00a0лабораторного прибора, контактирующего с\u00a0дезинфицирующими растворами —\u00a0требовалась химическая стойкость и\u00a0совпадение с\u00a0фирменным цветом RAL 7035.',
      s: 'Печать химстойким инженерным полимером, постобработка с\u00a0окраской в\u00a0требуемый RAL напрямую, без\u00a0промежуточного грунта.',
      r: 'Совпадение цвета в\u00a0допуске с\u00a0первой попытки, без\u00a0повторной покраски партии.' },
    { tag: 'Ретро\u2011авто', img: 'case-5.png', model: '../assets/models/case-5.glb', rim: .15, name: 'Деталь интерьера для\u00a0автомобиля 1970-х',
      kv: [['отрасль', 'Реставрация'], ['метод', '3D-скан + печать'], ['год выпуска', '1970']],
      stats: [['1970', 'год выпуска', 1], ['1', 'раз —\u00a0без\u00a0доработки']],
      t: 'Сломанная деталь интерьера для\u00a0автомобиля 1970-х, оригинал давно не\u00a0производится, найти на\u00a0разборках не\u00a0удалось.',
      s: 'Отсканировали уцелевший образец с\u00a0другого автомобиля коллекционера, восстановили геометрию, напечатали инженерным пластиком с\u00a0фактурой под\u00a0оригинальный пластик салона.',
      r: 'Деталь встала без\u00a0доработки с\u00a0первого раза, полное визуальное совпадение с\u00a0оригиналом.' }
  ];
  var tabsBox = $('#caseTabs'), thumbs = $('#caseThumbs'), sheet = $('#caseSheet'), stage = $('#caseStage');
  function countUp(el) {
    var txt = el.textContent, m = txt.match(/^([+]?)(\d+)(.*)$/);
    if (!m || reduce || txt === '1970') return;
    var to = +m[2], t0 = performance.now(), dur = 900;
    (function step(now) { var k = clamp((now - t0) / dur, 0, 1); el.textContent = m[1] + Math.round(to * (1 - Math.pow(1 - k, 3))) + m[3]; if (k < 1) requestAnimationFrame(step); })(t0);
  }
  var viewerRaf = 0, model3d = null, curCase = 0;
  // Если 3D-просмотрщик догрузился позже — перерисовать текущий кейс уже с моделью
  addEventListener('axmodel-ready', function () { if (CASES[curCase].model) showCase(curCase); });
  function initViewer(v) {
    var obj = $('.viewer__obj', v), ry = -20, rx = 10, try_ = ry, trx = rx, drag = null, last = performance.now(), idle = true, t0 = performance.now();
    // Деталь — объёмная картинка, поэтому поворот ограничен: ±55° по горизонтали
    cancelAnimationFrame(viewerRaf);
    function loop(now) {
      var dt = Math.min(50, now - last); last = now;
      if (idle && !reduce) { try_ += ((-20 + Math.sin((now - t0) / 1800) * 22) - try_) * .03; trx += (10 - trx) * .03; }   // плавно покачивается сама
      ry += (try_ - ry) * .12; rx += (trx - rx) * .12;
      obj.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      viewerRaf = requestAnimationFrame(loop);
    }
    v.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, ry: try_, rx: trx }; idle = false; v.setPointerCapture(e.pointerId); v.classList.add('is-drag'); });
    v.addEventListener('pointermove', function (e) {
      if (!drag) return;
      try_ = clamp(drag.ry + (e.clientX - drag.x) * .4, -55, 55);
      trx = clamp(drag.rx - (e.clientY - drag.y) * .35, -35, 45);
    });
    function up() { drag = null; v.classList.remove('is-drag'); setTimeout(function () { if (!drag) idle = true; }, 2500); }
    v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
    v.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { try_ = clamp(try_ - 15, -55, 55); idle = false; } if (e.key === 'ArrowRight') { try_ = clamp(try_ + 15, -55, 55); idle = false; }
      if (e.key === 'ArrowUp') trx = clamp(trx - 10, -35, 45); if (e.key === 'ArrowDown') trx = clamp(trx + 10, -35, 45);
    });
    viewerRaf = requestAnimationFrame(loop);
  }
  // «Вертушка»: оборот детали на 360° из кадров видео (сетка кадров в одной картинке).
  // Кадр меняется при перетаскивании мышью или пальцем; без касания деталь медленно вращается сама.
  function initTurntable(box, t) {
    var el = $('.turn__img', box), rows = Math.ceil(t.frames / t.cols);
    el.style.backgroundImage = 'url(' + t.src + ')';
    el.style.backgroundSize = (t.cols * 100) + '% ' + (rows * 100) + '%';
    el.style.aspectRatio = t.w + ' / ' + t.h;
    var pos = 0, drag = null, idle = true, last = performance.now();
    function show() {
      var n = ((Math.round(pos) % t.frames) + t.frames) % t.frames;
      el.style.backgroundPosition = (n % t.cols) / (t.cols - 1) * 100 + '% ' + Math.floor(n / t.cols) / (rows - 1) * 100 + '%';
    }
    function loop(now) {
      var dt = Math.min(50, now - last); last = now;
      if (idle && !reduce) { pos += dt * (t.speed || .006); show(); }
      if (box.isConnected) requestAnimationFrame(loop);
    }
    box.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, p: pos }; idle = false; box.setPointerCapture(e.pointerId); box.classList.add('is-drag'); });
    box.addEventListener('pointermove', function (e) { if (!drag) return; pos = drag.p - (e.clientX - drag.x) / 6; show(); });
    function up() { drag = null; box.classList.remove('is-drag'); setTimeout(function () { if (!drag) idle = true; }, 2500); }
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    box.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { idle = false; pos += e.key === 'ArrowLeft' ? -3 : 3; show(); } });
    show(); requestAnimationFrame(loop);
  }
  // Разметка карточки кейса: вынесена, чтобы измерить высоту всех кейсов
  function sheetHtml(i) {
    var c = CASES[i];
    return (
      '<span class="hud__tab" aria-hidden="true"><i></i><i></i><i></i><b></b></span>' +
      '<div class="dossier__head"><span>Кейс ' + String(i + 1).padStart(2, '0') + '</span><span>//' + c.tag + '</span></div>' +
      '<h3 style="font:700 var(--fs-sub)/var(--lh-sub) var(--font-mono);text-transform:uppercase">' + c.name + '</h3>' +
      '<dl class="kv">' + c.kv.map(function (r) { return '<div><dt>' + r[0] + '</dt><i></i><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' +
      '<div class="dossier__text"><p><b>Задача</b>' + c.t + '</p><p><b>Решение</b>' + c.s + '</p><p><b>Результат</b>' + c.r + '</p></div>');
  }
  // Все карточки одной высоты — по самому длинному кейсу
  function equalizeSheet() {
    var keep = curCase, max = 0, card = sheet.parentNode;
    if (window.matchMedia('(max-width: 699px)').matches) { sheet.style.minHeight = ''; card.style.alignSelf = 'start'; if (typeof placeWheel === 'function') placeWheel(curCase); return; }   // телефон: карточка по высоте текста
    sheet.style.minHeight = ''; card.style.alignSelf = 'start';      // без растяжения по правой колонке — меряем только текст
    CASES.forEach(function (_, k) { sheet.innerHTML = sheetHtml(k); max = Math.max(max, sheet.offsetHeight); });
    sheet.innerHTML = sheetHtml(keep < 0 ? 0 : keep);
    sheet.style.minHeight = max + 'px'; card.style.alignSelf = '';
    if (typeof placeWheel === 'function') placeWheel(curCase);
  }
  // Превью кейсов — бесконечное «колесо»: список повторён трижды, текущий кейс по центру колонки,
  // соседи уходят вверх и вниз — чем дальше, тем мельче, темнее и размытее. После последнего
  // кейса снова идёт первый. Колёсиком мыши можно листать по кругу.
  var N = CASES.length, wheelPos = N, wheelDir = 0;
  function wheelTarget(i) {
    if (wheelDir) { var t = wheelPos + wheelDir; wheelDir = 0; return t; }   // шаг колёсиком — в ту же сторону
    var best = i + N;                                                      // клик/вкладка — ближайшая копия
    [i, i + N, i + 2 * N].forEach(function (c) { if (Math.abs(c - wheelPos) < Math.abs(best - wheelPos)) best = c; });
    return best;
  }
  function markWheel() {
    $$('.thumb', thumbTrack).forEach(function (b, k) { b.setAttribute('aria-current', k === wheelPos); b.style.setProperty('--d', Math.abs(k - wheelPos)); b.classList.toggle('thumb--far', Math.abs(k - wheelPos) > 2); });
  }
  function placeWheel(i, instant) {
    // колонка колеса — ровно высотой с карточку кейса; в ней пять строк: текущий и по два соседа
    var card = window.matchMedia('(max-width: 1100px)').matches ? stage : sheet.parentNode;   // на телефоне колесо стоит рядом с деталью
    var phone = card === stage;
    if (card && card.offsetHeight) { thumbs.style.height = phone ? '' : card.offsetHeight + 'px'; thumbs.style.setProperty('--row', (card.offsetHeight / (phone ? 6 : 5)) + 'px'); }
    var it = $$('.thumb', thumbTrack)[wheelPos];
    if (!it) return;
    if (instant) thumbTrack.style.transition = 'none';
    thumbTrack.style.transform = 'translateY(' + Math.round(thumbs.clientHeight / 2 - it.offsetTop - it.offsetHeight / 2) + 'px)';
    if (instant) { void thumbTrack.offsetWidth; thumbTrack.style.transition = ''; }
  }
  // после прокрутки на крайнюю копию незаметно возвращаемся в среднюю
  function wrapWheel() {
    if (wheelPos >= N && wheelPos < 2 * N) return;
    wheelPos = (wheelPos % N) + N;
    var items = $$('.thumb', thumbTrack);
    items.forEach(function (b) { b.style.transition = 'none'; });
    markWheel(); placeWheel(curCase, true);
    void thumbTrack.offsetWidth; items.forEach(function (b) { b.style.transition = ''; });
  }
  var wheelLock = 0;
  thumbs.addEventListener('wheel', function (e) {
    e.preventDefault();
    var now = Date.now(); if (now - wheelLock < 420) return; wheelLock = now;
    var dir = e.deltaY > 0 ? 1 : -1;
    wheelDir = dir; showCase((curCase + dir + N) % N);
  }, { passive: false });
  // Телефон: колесо листается пальцем — смахнули вверх, следующий кейс; вниз, предыдущий
  var tY = null;
  thumbs.addEventListener('touchstart', function (e) { tY = e.touches[0].clientY; }, { passive: true });
  thumbs.addEventListener('touchmove', function (e) {
    if (tY === null) return;
    e.preventDefault();
    var dy = tY - e.touches[0].clientY;
    if (Math.abs(dy) < thumbs.clientHeight / 5 * .6) return;
    var dir = dy > 0 ? 1 : -1; tY = e.touches[0].clientY;
    wheelDir = dir; showCase((curCase + dir + N) % N);
  }, { passive: false });
  thumbs.addEventListener('touchend', function () { tY = null; }, { passive: true });
  addEventListener('resize', function () { placeWheel(curCase, true); });
  function showCase(i) {
    var c = CASES[i];
    $$('button', tabsBox).forEach(function (b, k) { b.setAttribute('aria-selected', k === i); });
    wheelPos = wheelTarget(i); markWheel(); placeWheel(i);
    sheet.innerHTML = sheetHtml(i);
    // Объёмная деталь: стопка из слоёв картинки со сдвигом по глубине — как напечатанная слоями.
    // Крутится мышью или пальцем.
    var LAYERS3D = 16, layersHtml = '';
    for (var k = 0; k < LAYERS3D; k++) {
      var z = (k - LAYERS3D + 1) * 2.2, dark = (.35 + .65 * k / (LAYERS3D - 1)).toFixed(2);
      layersHtml += '<img src="../assets/img/' + c.img + '" alt="' + (k === LAYERS3D - 1 ? c.name : '') + '" style="transform:translateZ(' + z + 'px);filter:brightness(' + dark + ')"' + (k < LAYERS3D - 1 ? ' aria-hidden="true"' : '') + '>';
    }
    if (model3d) { model3d.destroy(); model3d = null; }
    stage.dataset.case = i;
    var has3d = c.model && window.AxModel, hasTurn = !has3d && c.turntable;
    stage.innerHTML =
      '<span class="dossier__dim dossier__dim--t">Покрутите деталь мышью</span>' +
      (hasTurn ? '<div class="turn" tabindex="0" aria-label="Деталь: ' + c.name + '. Поворачивается мышью или стрелками"><div class="turn__img"></div><span class="turn__credit">3D-модель: Tripo</span></div>' : has3d ? '<div class="viewer3d" aria-label="3D-модель: ' + c.name + '. Поворачивается мышью или пальцем"><img class="viewer3d__poster" src="../assets/img/' + c.img + '" alt=""></div>' :
      '<div class="viewer" tabindex="0" aria-label="Деталь: ' + c.name + '. Поворачивается мышью или\u00a0стрелками"><div class="viewer__obj">' + layersHtml + '</div><i class="viewer__shadow"></i></div>') +
      '<div class="dossier__stats">' + c.stats.map(function (s) { return '<div class="stat' + (s[2] ? ' stat--g' : '') + '"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('') + '</div>';
    if (hasTurn) initTurntable($('.turn', stage), c.turntable);
    else if (has3d) model3d = window.AxModel.mount($('.viewer3d', stage), c.model, { rim: c.rim });
    else initViewer($('.viewer', stage));
    curCase = i;
    [sheet, stage].forEach(function (el) { el.classList.remove('scan-in'); void el.offsetWidth; el.classList.add('scan-in'); });
    $$('.stat b', stage).forEach(countUp);
  }
  var thumbTrack = document.createElement('div'); thumbTrack.className = 'wheel__track'; thumbs.appendChild(thumbTrack);
  CASES.forEach(function (c, i) {
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab');
    b.textContent = 'Кейс ' + String(i + 1).padStart(2, '0'); b.setAttribute('aria-label', 'Кейс ' + (i + 1) + ': ' + c.tag); b.addEventListener('click', function () { showCase(i); }); tabsBox.appendChild(b);
  });
  for (var copy = 0; copy < 3; copy++) CASES.forEach(function (c, i) {
    var t = document.createElement('button'); t.type = 'button'; t.className = 'thumb'; t.setAttribute('aria-label', c.name);
    if (copy !== 1) { t.tabIndex = -1; t.setAttribute('aria-hidden', 'true'); }
    t.innerHTML = '<img src="../assets/img/' + c.img + '" alt="" loading="lazy" style="transform:scale(' + ([1, 1.55, 1.3, 1.35, 1.05][i] || 1) + ')"><span>' + c.tag + '</span>';
    t.addEventListener('click', function () { showCase(i); }); thumbTrack.appendChild(t);
  });
  thumbTrack.addEventListener('transitionend', function (e) { if (e.target === thumbTrack) wrapWheel(); });
  showCase(0);
  equalizeSheet();
  var eqT; addEventListener('resize', function () { clearTimeout(eqT); eqT = setTimeout(equalizeSheet, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(equalizeSheet);

  /* ---------- Честно: детали летают вокруг текста ---------- */
  var floats = $$('.mega__float'), mega = $('.mega');
  function parallax() {
    var r = mega.getBoundingClientRect(), mid = r.top + r.height / 2 - innerHeight / 2;
    floats.forEach(function (el) { var d = +el.dataset.depth; el.style.transform = 'translate3d(0,' + (mid * d).toFixed(1) + 'px,0) rotate(' + (mid * d * .03).toFixed(2) + 'deg)'; });
  }
  if (!reduce) { addEventListener('scroll', function () { requestAnimationFrame(parallax); }, { passive: true }); parallax(); }
  // Летающие детали — объёмные: подключаем 3D-модели, когда просмотрщик готов
  function mountFloats() {
    if (!window.AxModel) return;
    floats.forEach(function (el, i) {
      if (el._m || !el.dataset.model) return;
      el._m = window.AxModel.mount(el, el.dataset.model, { still: true, rim: +el.dataset.rim, speed: [1.6, -1.2, 1, -1.8][i % 4], tilt: [1.05, .85, 1.2, .95][i % 4], spin: [[.3, 0, -.25], [-.2, 0, .3], [.15, 0, .2], [-.25, 0, -.15]][i % 4] });
    });
  }
  mountFloats(); addEventListener('axmodel-ready', mountFloats);
  // Шестерня в блоке «Не нашли ответ?» — крутится мышью, как детали в портфолио
  var faqGear = $('#faqGear');
  function mountFaqGear() { if (window.AxModel && faqGear && !faqGear._m) faqGear._m = window.AxModel.mount(faqGear, '../assets/models/gear.glb', { rim: 1.1, speed: .9 }); }
  // Шестерня создаётся, когда блок подходит к экрану: на телефонах так не исчерпывается число WebGL-контекстов
  var faqNear = false;
  function mountFaqGearNear() { if (faqNear) mountFaqGear(); }
  if (faqGear && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e, o) { if (e[0].isIntersecting) { faqNear = true; mountFaqGear(); o.disconnect(); } }, { rootMargin: '600px 0px' }).observe(faqGear);
  } else faqNear = true;
  mountFaqGearNear(); addEventListener('axmodel-ready', mountFaqGearNear);

  /* ---------- Процесс: этапы по прокрутке ---------- */
  var STEPS = [
    ['01', 'Отправка', 'до\u00a0начала работы', 'Загружаете 3D-модель (STEP, STL), чертёж или\u00a0просто фото/образец детали. Нет ничего из\u00a0этого —\u00a0расскажите задачу, поможем разобраться, что\u00a0нужно.'],
    ['02', 'Расчёт', 'до\u00a01\u00a0рабочего дня', 'Инженер проверяет деталь на\u00a0технологичность —\u00a0не\u00a0просто считает объём, а\u00a0смотрит, действительно\u00a0ли\u00a0конструкция напечатается так, как\u00a0задумано.'],
    ['03', 'Согласование', 'перед началом печати', 'Присылаем расчёт с\u00a0материалом, точным сроком и\u00a0ценой. Если в\u00a0конструкции есть уязвимое место —\u00a0предупреждаем сразу, до\u00a0начала печати, а\u00a0не\u00a0после.'],
    ['04', 'Печать', 'изготовление', 'Изготавливаем деталь и\u00a0доводим её\u00a0постобработкой (шлифовка, окраска, доработка посадочных мест) до\u00a0состояния, готового к\u00a0установке.'],
    ['05', 'Гарантия', 'если не\u00a0подошла', 'Проверяем несоответствие по\u00a0вашему чертежу. Если ошибка на\u00a0нашей стороне —\u00a0переделываем без\u00a0дополнительной оплаты. Если менялось ТЗ —\u00a0обсуждаем доработку отдельно, без\u00a0сюрпризов в\u00a0счёте.']
  ];
  var proc = $('#process'), cardsBox = $('#procCards');
  // Карточки этапов плывут по кругу (эллипсу) вокруг заголовка: сами, плюс ускоряются при прокрутке
  var KINDS = ['dark', 'cream', 'steel', 'dark', 'cream'];
  var pcs = STEPS.map(function (s, i) {
    var el = document.createElement('article');
    el.className = 'pcard pcard--' + KINDS[i];
    el.innerHTML = '<span class="pcard__no">' + s[0] + '</span><h3>' + s[1] + '</h3><p>' + s[3].replace(/(\S{8,})\u00a0/g, '$1 ').replace(/\u00a0(\S{8,})/g, ' $1') + '</p><div class="pcard__bar"><span>//' + s[2] + '</span><span>' + s[0] + '/05</span></div>';
    cardsBox.appendChild(el); return { el: el, a0: i / STEPS.length * Math.PI * 2 };
  });
  var orbitAng = 0, orbitLast = 0, orbitPaused = false, lastScrollY = scrollY, orbitSpeed = 0;
  cardsBox.addEventListener('pointerenter', function (e) { if (e.target.closest && e.target.closest('.pcard')) orbitPaused = true; }, true);
  cardsBox.addEventListener('pointerleave', function () { orbitPaused = false; }, true);
  // Вид блока: «круг» (карточки плывут вокруг заголовка) или «веер» (карточки по очереди
  // вылетают снизу и ложатся веером поверх заголовка). Переключатель временный — чтобы сравнить.
  var procMode = 'rows';      // «сетка» — строгая раскладка по колонкам; «веер» и «круг» сохранены в коде: 'fan' / 'orbit' (и показать переключатель)
  var modeBox = document.createElement('div');
  modeBox.className = 'proc__mode'; modeBox.setAttribute('role', 'group'); modeBox.setAttribute('aria-label', 'Вид блока этапов');
  modeBox.innerHTML = '<span>Вид блока</span><button type="button" data-m="orbit">Круг</button><button type="button" data-m="fan">Веер</button>';
  ($('.proc__pin', proc) || proc).appendChild(modeBox);
  function setProcMode(m) {
    procMode = m; proc.dataset.mode = m;
    $$('button', modeBox).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.m === m); });
  }
  $$('button', modeBox).forEach(function (b) { b.addEventListener('click', function () { setProcMode(b.dataset.m); }); });
  setProcMode(procMode);

  var FAN = [   // итоговое положение карточек веера: сдвиг (доля ширины карточки), подъём (px), поворот (°)
    [-1.5, 22, -9], [-.75, 6, -4.5], [0, 0, 0], [.75, 6, 4.5], [1.5, 22, 9]
  ];
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  // «Сетка»: карточки стоят по колонкам сетки вразнобой (не друг за другом); при прокрутке по очереди
  // мягко выезжают снизу и проявляются, а потом чуть-чуть дрейфуют с разной скоростью
  var GRID = [   // колонки, верх (% высоты экрана), дрейф (px на экран прокрутки)
    { c: '1 / 5',  t: 4,  d: -14 }, { c: '9 / 13', t: 8, d: 12 }, { c: '1 / 5',  t: 52, d: 10 },
    { c: '5 / 9',  t: 58, d: -12 }, { c: '9 / 13', t: 52, d: 8 }
  ];
  pcs.forEach(function (c, i) { c.el.style.setProperty('--c', GRID[i].c); c.el.style.setProperty('--top', GRID[i].t + '%'); });
  // «ряды»: положение карточек — колонки, ряд и сдвиг вниз (вразнобой)
  // порядок как на образце: ряд 1 — 01, 02, (пусто), (пусто), 05; ряд 2 — (пусто), 03, 04; четыре колонки без промежутков между карточками
  var ROWS_T = [{ c: '1 / 2', r: 1, m: '0' }, { c: '2 / 3', r: 1, m: '0' }, { c: '2 / 3', r: 2, m: '0' }, { c: '3 / 4', r: 2, m: '0' }, { c: '4 / 5', r: 1, m: '0' }];
  var ROWS_S = ROWS_T;
  var shortMq = matchMedia('(max-height: 820px)');
  function placeRows() {
    var R = shortMq.matches ? ROWS_S : ROWS_T;
    pcs.forEach(function (c, i) { c.el.style.setProperty('--r', R[i].r); c.el.style.setProperty('--m', R[i].m); if (procMode === 'rows') c.el.style.setProperty('--c', R[i].c); });
  }
  placeRows(); (shortMq.addEventListener ? shortMq.addEventListener('change', placeRows) : shortMq.addListener(placeRows));
  // «Ряды»: обычный заголовок блока, под ним высокие карточки в два ряда вразнобой; каждая мягко проявляется,
  // когда доезжает до нижней части экрана (без закрепления блока)
  function rowsAnim() {
    var r = proc.getBoundingClientRect(), span = proc.offsetHeight - innerHeight, p = clamp(-r.top / span, 0, 1);
    pcs.forEach(function (c, i) { c.el.classList.toggle('is-in', p > i * .14 + .02 || r.top < innerHeight * .2 && i === 0); });
  }
  function gridAnim() {
    var r = proc.getBoundingClientRect(), span = proc.offsetHeight - innerHeight, p = clamp(-r.top / span, 0, 1);
    pcs.forEach(function (c, i) {
      var t = ease(clamp((p - i * .13) / .2, 0, 1)), drift = (p - .5) * GRID[i].d * 4;
      c.el.style.transform = 'translate3d(0,' + Math.round((1 - t) * 70 + drift) + 'px,0)';
      c.el.style.opacity = t.toFixed(3);
      c.el.style.zIndex = 10 + i;
    });
  }
  function fan() {
    var r = proc.getBoundingClientRect(), span = proc.offsetHeight - innerHeight;
    var p = clamp(-r.top / span, 0, 1), H = cardsBox.clientHeight, n = pcs.length;
    pcs.forEach(function (c, i) {
      var cw = c.el.offsetWidth, f = FAN[i];
      // каждая карточка выезжает в своём отрезке прокрутки, последний отрезок — пауза с готовым веером
      var t = ease(clamp((p - i * .15) / .17, 0, 1));
      var x = f[0] * cw * .8, y = f[1] + (1 - t) * (H * .5 + 280), rot = f[2] + (1 - t) * (i % 2 ? 14 : -14);
      c.el.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y + H * .04) + 'px,0) translate(-50%,-50%) rotate(' + rot.toFixed(2) + 'deg)';
      c.el.style.zIndex = 10 + i;
      c.el.style.opacity = t > 0 ? 1 : 0;
    });
  }
  function orbit(now) {
    requestAnimationFrame(orbit);
    var dt = Math.min(50, now - (orbitLast || now)); orbitLast = now;
    if (innerWidth <= 1000) return;
    var r = proc.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    var dy = scrollY - lastScrollY; lastScrollY = scrollY;
    if (procMode === 'rows') { rowsAnim(); return; }
    if (procMode === 'grid') { gridAnim(); return; }
    if (procMode === 'fan') { fan(); return; }
    if (!reduce && !orbitPaused) orbitAng += dt * .00008;       // один оборот примерно за 80 секунд
    orbitAng += dy * .002;                                       // прокрутка подкручивает круг
    var W = cardsBox.clientWidth, H = cardsBox.clientHeight, rx = W * .37, ry = H * .3;
    pcs.forEach(function (c) {
      var a = c.a0 + orbitAng, sn = Math.sin(a), depth = (sn + 1) / 2;       // 1 — ближняя к нам (внизу круга)
      var x = Math.cos(a) * rx, y = sn * ry;
      c.el.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0) translate(-50%,-50%)';      // без масштаба — шрифт у всех карточек одного размера
      c.el.style.zIndex = Math.round(depth * 10);
      c.el.style.opacity = (.78 + .22 * depth).toFixed(2);
    });
  }
  requestAnimationFrame(orbit);

  /* ---------- Вопросы: открыт только один; открытие и закрытие плавные ---------- */
  var faqList = $$('.faq details');
  function faqAnim(d, open) {
    var sum = d.querySelector('summary'), ans = d.querySelector('.ans'), head = sum.offsetHeight;
    if (d._a) { d._a.onfinish = d._a.oncancel = null; d._a.cancel(); d._a = null; }   // иначе запоздалый oncancel старой анимации закрывал только что открытый ответ
    if (ans && ans.getAnimations) ans.getAnimations().forEach(function (x) { x.cancel(); });
    var from = d.offsetHeight, ease = 'cubic-bezier(.2, .8, .2, 1)';
    if (reduce) { d.open = open; return; }
    d.style.overflow = 'hidden';
    if (open) {
      d.open = true;
      var to = d.scrollHeight;
      d._a = d.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: 560, easing: ease });
      if (ans) ans.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 120, easing: ease, fill: 'backwards' });
    } else {
      d._a = d.animate([{ height: from + 'px' }, { height: head + 'px' }], { duration: 420, easing: ease });
      if (ans) ans.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
    }
    var a = d._a;
    a.onfinish = a.oncancel = function () { d._a = null; d.style.overflow = ''; if (!open) d.open = false; };
  }
  faqList.forEach(function (d) {
    d.querySelector('summary').addEventListener('click', function (e) {
      e.preventDefault();
      var willOpen = !(d.open && !(d._a && !d.classList.contains('is-closing')));
      willOpen = !d.open || (d._a && d.dataset.state === 'closing');
      d.dataset.state = willOpen ? 'opening' : 'closing';
      faqAnim(d, willOpen);
      if (willOpen) faqList.forEach(function (o) { if (o !== d && (o.open || o.dataset.state === 'opening')) { o.dataset.state = 'closing'; faqAnim(o, false); } });
    });
  });

  /* ---------- Калькулятор: деталь на сетке, ползунки и поля для точных цифр ---------- */
  var MAT = [['PLA', 'пластик, FDM', 8], ['ABS', 'инженерный, FDM', 10], ['Фотополимер', 'SLA', 18], ['Нейлон', 'SLS', 25], ['Металл', 'DMLS', 90]];
  var fmt = function (n) { n = Math.round(n); return n < 10000 ? String(n) : n.toLocaleString('ru-RU'); };
  var mult = function (q) { return q >= 50 ? .75 : q >= 20 ? .85 : q >= 10 ? .92 : q >= 5 ? .97 : 1; };
  // форма детали задаёт, какую долю габаритной коробки занимает материал (вилка от и до)
  var SHAPE = [['Не знаю', '', .3, 1], ['Простая', 'почти брусок', .75, 1], ['Средняя', 'вырезы, отверстия', .45, .75], ['Сложная', 'решётки, скругления', .25, .5]];
  var ccSt = { mat: 0, shape: 0, L: 50, W: 50, H: 30, Q: 1, exact: null }, ccChips = $('#ccMats'), ccShape = $('#ccShape'), ccCube = $('#ccCube');
  MAT.forEach(function (m, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'cc__chip'; b.dataset.i = i;
    b.innerHTML = '<b>' + m[0] + '</b><small>' + m[1] + '</small>'; b.addEventListener('click', function () { ccSt.mat = i; calc(); });
    ccChips.appendChild(b);
  });
  SHAPE.forEach(function (m, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'cc__chip'; b.dataset.i = i;
    b.innerHTML = '<b>' + m[0] + '</b>' + (m[1] ? '<small>' + m[1] + '</small>' : ''); b.addEventListener('click', function () { ccSt.shape = i; calc(); });
    ccShape.appendChild(b);
  });
  // «заготовка» — габаритная коробка детали; вращается мышью или пальцем, сама медленно поворачивается
  var ccYaw = -.6, ccPitch = .5, ccDrag = null, ccSpin = !reduce, ccStage = $('#ccStage');
  var ccBox = null;
  function mountCcBox() {
    if (ccBox || !window.AxModel || !window.AxModel.mountBox) return;
    ccBox = window.AxModel.mountBox(ccStage); ccCube.style.display = 'none'; ccSpin = false; ccBox.set(ccSt.L, ccSt.W, ccSt.H);
  }
  addEventListener('axmodel-ready', mountCcBox);
  function drawCube() {
    if (ccBox) { ccBox.set(ccSt.L, ccSt.W, ccSt.H); return; }
    var dx = ccSt.L, dy = ccSt.W, dz = ccSt.H, k = 255 / Math.sqrt(dx * dx + dy * dy + dz * dz);
    var hx = dx * k / 2, hy = dy * k / 2, hz = dz * k / 2, cy = Math.cos(ccYaw), sy = Math.sin(ccYaw), cp = Math.cos(ccPitch), sp = Math.sin(ccPitch);
    var rot = function (x, y, z) { var xr = x * cy - y * sy, yr = x * sy + y * cy; return [xr, yr, z]; };
    var proj = function (p) { return [200 + p[0], 150 - (p[2] * cp + p[1] * sp)]; };
    var cam = [0, -cp, sp];
    var F = [   // грани: нормаль и четыре угла
      { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] }, { n: [0, 0, -1], v: [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]] },
      { n: [1, 0, 0], v: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] }, { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
      { n: [0, 1, 0], v: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]] }, { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] }
    ];
    var light = [-.5, -.6, .65], out = [];
    F.forEach(function (f) {
      var n = rot(f.n[0], f.n[1], f.n[2]);
      var vis = n[0] * cam[0] + n[1] * cam[1] + n[2] * cam[2];
      if (vis <= .001) return;
      var pts = f.v.map(function (q) { return rot(q[0] * hx, q[1] * hy, q[2] * hz); });
      var cz = pts.reduce(function (a, p) { return a + p[0] * cam[0] + p[1] * cam[1] + p[2] * cam[2]; }, 0) / 4;
      var br = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]), t = .38 + .62 * br;
      var col = [Math.round(88 + (238 - 88) * t), Math.round(93 + (229 - 93) * t), Math.round(98 + (213 - 98) * t)];
      out.push({ z: cz, s: '<polygon points="' + pts.map(function (p) { var q = proj(p); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') + '" fill="rgb(' + col.join(',') + ')" stroke="rgba(13, 13, 13, 0.5)" stroke-width="1" stroke-linejoin="round"/>' });
    });
    out.sort(function (a, b) { return a.z - b.z; });
    ccCube.innerHTML = out.map(function (o) { return o.s; }).join('');
  }
  ccStage.addEventListener('pointerdown', function (e) { if (ccBox) return; ccDrag = { x: e.clientX, y: e.clientY, yaw: ccYaw, pitch: ccPitch }; ccSpin = false; ccStage.setPointerCapture(e.pointerId); });
  ccStage.addEventListener('pointermove', function (e) {
    if (!ccDrag) return;
    ccYaw = ccDrag.yaw + (e.clientX - ccDrag.x) * .012;
    ccPitch = clamp(ccDrag.pitch + (e.clientY - ccDrag.y) * .008, .12, 1.2);
    drawCube();
  });
  var ccEnd = function () { if (!ccDrag) return; ccDrag = null; setTimeout(function () { if (!ccDrag) ccSpin = !reduce; }, 2500); };
  ccStage.addEventListener('pointerup', ccEnd); ccStage.addEventListener('pointercancel', ccEnd);
  (function ccLoop() {
    requestAnimationFrame(ccLoop);
    if (!ccSpin || ccBox) return;
    var r = ccStage.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    ccYaw += .006; drawCube();
  })();
  var ccIds = { L: ['#cL', '#rL'], W: ['#cW', '#rW'], H: ['#cH', '#rH'], Q: ['#cQ', '#rQ'] };
  var rangeH = function (lo, hi) { return '<small>от</small> ' + fmt(lo) + ' <small>до</small> ' + fmt(hi) + '\u00a0₽'; };
  var range = function (lo, hi) { return 'от\u00a0' + fmt(lo) + ' до\u00a0' + fmt(hi) + '\u00a0₽'; };
  // итог всегда в одну строку: если не помещается — шрифт уменьшается, чтобы калькулятор не менял высоту
  function fitTotal() {
    var t = $('#cTotal'); t.style.removeProperty('font-size');
    var fs = parseFloat(getComputedStyle(t).fontSize), box = t.parentNode.clientWidth;
    // !important — иначе размер цифр из таблицы стилей перебивает подгонку
    while (t.scrollWidth > box && fs > 12) { fs -= 1; t.style.setProperty('font-size', fs + 'px', 'important'); }
  }
  function calc(src) {
    var q = Math.max(1, Math.round(ccSt.Q)), box = ccSt.L * ccSt.W * ccSt.H / 1000, rate = MAT[ccSt.mat][2], m = mult(q), sh = SHAPE[ccSt.shape];
    $$('.cc__chip', ccChips).forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.i === ccSt.mat); });
    $$('.cc__chip', ccShape).forEach(function (b) { b.setAttribute('aria-pressed', ccSt.exact === null && +b.dataset.i === ccSt.shape); b.disabled = ccSt.exact !== null; });
    Object.keys(ccIds).forEach(function (k) { ccIds[k].forEach(function (sel) { var e = $(sel); if (e !== src) e.value = ccSt[k]; }); });
    var exact = ccSt.exact !== null;
    $('#ccVolLab').textContent = exact ? 'объём вашей модели' : 'объём габаритов';
    $('#cVol').textContent = (exact ? ccSt.exact : box).toFixed(1) + ' см³';
    if (exact) {
      var u = 500 + ccSt.exact * rate;
      $('#cUnit').textContent = '≈ ' + fmt(u) + ' ₽';
      $('#cTotal').innerHTML = '≈ ' + fmt(u * q * m) + '\u00a0₽'; $('#ccTotLab').innerHTML = '//итого <i>(по\u00a0вашей модели)</i>';
    } else {
      var u1 = 500 + box * sh[2] * rate, u2 = 500 + box * sh[3] * rate;
      $('#cUnit').textContent = range(u1, u2);
      $('#cTotal').innerHTML = rangeH(u1 * q * m, u2 * q * m); $('#ccTotLab').innerHTML = '//итого <i>(зависит от\u00a0формы детали)</i>';
    }
    $('#cDisc').textContent = Math.round((1 - m) * 100) + '%';
    fitTotal();
    $('#ccDims').innerHTML = 'габариты\u00a0заготовки<span class="cc__sep"> · </span><span class="cc__size">' + ccSt.L + '\u00a0×\u00a0' + ccSt.W + '\u00a0×\u00a0' + ccSt.H + '\u00a0мм</span>';
    drawCube();
  }
  // Загрузка модели: STL читаем прямо в браузере (объём и габариты по треугольникам), остальные форматы — «посчитает инженер».
  // Файл никуда не отправляется. Это демонстрация возможности.
  function stlVolume(buf) {
    var dv = new DataView(buf), n = dv.getUint32(80, true), ascii = (80 + 4 + n * 50 !== buf.byteLength), v = 0, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], i, j, k;
    function acc(t) { for (j = 0; j < 3; j++) for (k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], t[j][k]); mx[k] = Math.max(mx[k], t[j][k]); }
      v += (t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[0][1] * (t[1][0] * t[2][2] - t[1][2] * t[2][0]) + t[0][2] * (t[1][0] * t[2][1] - t[1][1] * t[2][0])) / 6; }
    if (!ascii) { for (i = 0; i < n; i++) { var o = 84 + i * 50 + 12, t = []; for (j = 0; j < 3; j++) t.push([dv.getFloat32(o + j * 12, true), dv.getFloat32(o + j * 12 + 4, true), dv.getFloat32(o + j * 12 + 8, true)]); acc(t); } }
    else { var txt = new TextDecoder().decode(buf), re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g, mm, pts = []; while ((mm = re.exec(txt))) pts.push([+mm[1], +mm[2], +mm[3]]); for (i = 0; i + 2 < pts.length; i += 3) acc([pts[i], pts[i + 1], pts[i + 2]]); }
    return { vol: Math.abs(v) / 1000, size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]] };
  }
  var ccFile = $('#ccFile'), ccDropText = $('#ccDropText'), DROP_HINT = ccDropText.innerHTML;
  ccFile.addEventListener('change', function () {
    var f = ccFile.files[0];
    if (!f) { ccSt.exact = null; ccDropText.innerHTML = DROP_HINT; calc(); return; }
    if (/\.stl$/i.test(f.name)) {
      f.arrayBuffer().then(function (buf) {
        try {
          var r = stlVolume(buf);
          if (!(r.vol > 0)) throw 0;
          ccSt.exact = r.vol; ccSt.L = Math.round(r.size[0]); ccSt.W = Math.round(r.size[1]); ccSt.H = Math.round(r.size[2]);
          ccDropText.textContent = f.name + ' — посчитано по\u00a0модели. Нажмите, чтобы заменить';
        } catch (e) { ccSt.exact = null; ccDropText.textContent = 'Не удалось прочитать STL. Попробуйте другой файл'; }
        calc();
      });
    } else { ccSt.exact = null; ccDropText.textContent = f.name + ' — точную цену по\u00a0этому формату посчитает инженер'; calc(); }
  });
  Object.keys(ccIds).forEach(function (k) {
    ccIds[k].forEach(function (sel) {
      var e = $(sel); e.addEventListener('input', function () { var v = parseFloat(e.value); ccSt[k] = v > 0 ? v : 1; calc(e); });
      e.addEventListener('blur', function () { calc(); });      // пустое или нулевое поле возвращается к последнему значению
    });
  });
  mountCcBox(); calc(); addEventListener('resize', fitTotal); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTotal);

  /* ---------- Заявка (адрес приёма пока не задан) ---------- */
  var LEAD_ENDPOINT = '';
  var LABEL = { file: 'Отправить файл на\u00a0расчёт', drawing: 'Отправить чертёж на\u00a0расчёт', idea: 'Отправить заявку на\u00a0расчёт' };
  $$('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('#tabs button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      var idea = b.dataset.t === 'idea'; $('#drop').hidden = idea; $('#idea').hidden = !idea; $('#send').textContent = LABEL[b.dataset.t];
    });
  });
  // форма не меняет высоту при переключении вкладок: поле файла делаем той же высоты, что поле «Идея»
  function eqLead() {
    var drop = $('#drop'), idea = $('#idea'), wasIdea = !idea.hidden, wasDrop = !drop.hidden;
    drop.style.minHeight = ''; idea.style.minHeight = '';
    idea.hidden = false; drop.hidden = false;
    var h = Math.ceil(Math.max(drop.getBoundingClientRect().height, idea.getBoundingClientRect().height));
    idea.hidden = !wasIdea; drop.hidden = !wasDrop;
    drop.style.minHeight = h + 'px'; idea.style.minHeight = h + 'px';
  }
  eqLead(); addEventListener('resize', eqLead); if (document.fonts && document.fonts.ready) document.fonts.ready.then(eqLead);
  $('#drop').addEventListener('click', function (e) { if (e.target.id !== 'file') $('#file').click(); });
  $('#file').addEventListener('change', function (e) { $('#dropText').textContent = e.target.files[0] ? e.target.files[0].name : 'Загрузить файл —\u00a0перетащите сюда или\u00a0нажмите'; });
  $('#lead').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, btn = $('#send'), old = btn.textContent;
    if (!$('#consent').checked) { $('#consent').focus(); return; }
    if (!f.contact.value.trim()) { f.contact.focus(); return; }
    var done = function (ok) { btn.disabled = true; btn.textContent = ok ? 'Заявка отправлена ✓' : 'Не\u00a0удалось отправить'; setTimeout(function () { btn.disabled = false; btn.textContent = old; if (ok) f.reset(); }, 3500); };
    if (!LEAD_ENDPOINT) { done(true); return; }
    fetch(LEAD_ENDPOINT, { method: 'POST', body: new FormData(f) }).then(function (r) { done(r.ok); }).catch(function () { done(false); });
  });
})();

/* Боковая «рейка» разделов: точки у правого края, подпись по наведению */
(function () {
  var secs = Array.prototype.slice.call(document.querySelectorAll('main [data-chapter]')).filter(function (s) { return s.id && s.id !== 'hero'; });
  if (!secs.length) return;
  var rail = document.createElement('nav');
  rail.className = 'dots'; rail.setAttribute('aria-label', 'Разделы страницы');
  rail.innerHTML = secs.map(function (s) {
    return '<a href="#' + s.id + '" data-id="' + s.id + '"><span>//' + s.dataset.chapter.toUpperCase() + '</span><i></i></a>';
  }).join('');
  document.body.appendChild(rail);
  var links = Array.prototype.slice.call(rail.querySelectorAll('a'));
  function upd() {
    var y = innerHeight * .4, cur = null, past = scrollY > innerHeight * .5;
    secs.forEach(function (s) { var r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) cur = s.id; });
    rail.classList.toggle('is-on', past && !!cur);
    links.forEach(function (a) { a.classList.toggle('is-cur', a.dataset.id === cur); });
  }
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
})();

/* Телефон: активная услуга — та, что последней дошла до линии на 45% высоты экрана */
(function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll('.svc__card'));
  var mq = window.matchMedia('(max-width: 699px)');
  if (!cards.length) return;
  var raf = 0;
  function upd() {
    raf = 0;
    if (!mq.matches) { cards.forEach(function (c) { c.classList.remove('is-act'); }); return; }
    var line = innerHeight * .5, cur = -1;
    cards.forEach(function (c, i) { if (c.getBoundingClientRect().top <= line) cur = i; });
    var first = cards[0].getBoundingClientRect();
    if (cur < 0 && first.top < innerHeight * .9 && first.bottom > 0) cur = 0;
    var last = cards[cards.length - 1].getBoundingClientRect();
    if (last.bottom < 0) cur = -1;
    cards.forEach(function (c, i) { c.classList.toggle('is-act', i === cur); });
  }
  function req() { if (!raf) raf = requestAnimationFrame(upd); }
  addEventListener('scroll', req, { passive: true }); addEventListener('resize', req);
  if (mq.addEventListener) mq.addEventListener('change', req);
  upd();
})();


/* Подсказки под телефон: на устройствах без мыши — «пальцем» вместо «мышью» */
(function () {
  if (!window.matchMedia('(hover: none), (pointer: coarse), (max-width: 1100px)').matches) return;   // телефон и планшет: мыши нет
  function fix(root) {
    var els = root.querySelectorAll ? root.querySelectorAll('.dossier__dim') : [];
    Array.prototype.forEach.call(els, function (el) { if (el.textContent.indexOf('мышью') > -1) el.textContent = el.textContent.replace('мышью', 'пальцем'); });
    Array.prototype.forEach.call(root.querySelectorAll ? root.querySelectorAll('[aria-label*="мышью"]') : [], function (el) {
      el.setAttribute('aria-label', el.getAttribute('aria-label').replace('мышью или стрелками', 'пальцем').replace('мышью или стрелками', 'пальцем').replace('мышью', 'пальцем'));
    });
  }
  fix(document);
  new MutationObserver(function (m) { m.forEach(function (r) { r.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.matches && n.matches('.dossier__dim')) fix({ querySelectorAll: function () { return [n]; } }); fix(n); } }); }); })
    .observe(document.body, { childList: true, subtree: true });
})();

/* Значения показателей кейса («RAL 7035») — в одну строку: уменьшается только то значение, которое не помещается */
(function () {
  var stage = document.getElementById('caseStage');
  if (!stage) return;
  var busy = false;
  function fitStats() {
    if (busy) return; busy = true;
    Array.prototype.forEach.call(stage.querySelectorAll('.stat b'), function (b) {
      b.style.removeProperty('font-size');
      var st = b.parentNode, fs = parseFloat(getComputedStyle(b).fontSize);
      while (b.scrollWidth > st.clientWidth + 1 && fs > 14) { fs -= 1; b.style.setProperty('font-size', fs + 'px', 'important'); }
    });
    busy = false;
  }
  new MutationObserver(function () { fitStats(); }).observe(stage, { childList: true });
  addEventListener('resize', fitStats);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitStats);
  fitStats();
})();
