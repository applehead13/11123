/* ==========================================================================
   AXIOM.tech v3 — скрипты (чистый JS, без библиотек)
   ========================================================================== */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

    // Сцена: только деталь на фоне звёздной пыли (пол и сетка отключены)
    var variant = 4;
    var PITCH = { 4: .36 };
    var W, H, dpr, cx, cy, f, rot = 0, pitch = PITCH[variant], mxTarget = 0, mx = 0;
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var wide = W > 1000;
      cx = wide ? W * .68 : W * .5; cy = wide ? H * .4 : H * .3;
      f = Math.min(W, H) * (wide ? 1.05 : .9);
      if (wide) cy = H * .47;
      // Блок «идёт печать» и характеристики — слева снизу от детали
      var hud = $('.hero__hud');
      if (hud) {
        if (wide) { hud.style.left = Math.round(cx - f * .3) + 'px'; hud.style.top = Math.round(cy - f * .02) + 'px'; }
        // характеристики — по диагонали: справа сверху от детали
        var spec = $('.hero__spec');
        if (spec) { if (wide) { var gut = parseFloat(getComputedStyle(document.querySelector('.wrap')).paddingLeft) || 40; spec.style.left = Math.round(Math.min(cx + f * .26, W - gut - spec.offsetWidth)) + 'px'; spec.style.top = Math.round(cy - f * .36) + 'px'; } else { spec.style.left = ''; spec.style.top = ''; } }
        else { hud.style.left = ''; hud.style.top = ''; }
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
    var NEAR = -2.4, FAR = 9;      // у камеры z отрицательный, вдаль — положительный
    function floor() {
      ctx.lineWidth = 1;
      for (var i = -16; i <= 16; i++) {
        var A = proj(i * .5, 0, FAR, 0), B = proj(i * .5, 0, NEAR, 0);
        var g = ctx.createLinearGradient(A[0], A[1], B[0], B[1]);
        g.addColorStop(0, 'rgba(255,94,26,0)'); g.addColorStop(1, 'rgba(255,94,26,.3)');
        ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      }
      for (var z = NEAR; z <= FAR + 1e-6; z += .5) {
        var alpha = clamp(1 - (z - NEAR) / (FAR - NEAR), 0, 1) * .3;
        var C = proj(-8, 0, z, 0), D = proj(8, 0, z, 0);
        ctx.strokeStyle = 'rgba(255,94,26,' + alpha.toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(C[0], C[1]); ctx.lineTo(D[0], D[1]); ctx.stroke();
      }
    }
    // Платформа принтера под деталью: вращается вместе с ней
    function plate(a) {
      var R = 1.35, i, A, B;
      ctx.fillStyle = 'rgba(27,30,33,.9)';
      ring([[-R, -R], [R, -R], [R, R], [-R, R]], -.02, a, true); ctx.fill();
      ctx.strokeStyle = 'rgba(255,94,26,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = 'rgba(238,229,213,.08)'; ctx.lineWidth = 1;
      for (i = -R + .27; i < R; i += .27) {
        A = proj(i, -.02, -R, a); B = proj(i, -.02, R, a); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
        A = proj(-R, -.02, i, a); B = proj(R, -.02, i, a); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      }
      // торец платформы
      ctx.strokeStyle = 'rgba(255,94,26,.25)';
      ring([[-R, -R], [R, -R], [R, R], [-R, R]], -.12, a, true); ctx.stroke();
    }
    // Миллиметровка в экранных координатах: неподвижная
    function paper() {
      var step = 12, x, y;
      for (x = (cx % step); x < W; x += step) { ctx.strokeStyle = Math.round((x - cx) / step) % 10 === 0 ? 'rgba(255,94,26,.22)' : 'rgba(255,94,26,.06)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (y = (cy % step); y < H; y += step) { ctx.strokeStyle = Math.round((y - cy) / step) % 10 === 0 ? 'rgba(255,94,26,.22)' : 'rgba(255,94,26,.06)'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      // осевые линии чертежа
      ctx.setLineDash([14, 4, 2, 4]); ctx.strokeStyle = 'rgba(238,229,213,.28)';
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
      ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(238,229,213,.09)'; ctx.lineWidth = 1;
      [0, LAYERS - 1].forEach(function (k) { ring(outer, yAt(k), a, true); ctx.stroke(); });
      ctx.setLineDash([]);
      // Напечатанные слои
      for (var k = 0; k <= cur; k++) {
        var last = k === cur && p < 1;
        ctx.lineWidth = last ? 2 : 1;
        ctx.strokeStyle = last ? '#ff5e1a' : 'rgba(238,229,213,' + (.18 + .5 * k / LAYERS).toFixed(3) + ')';
        if (last) { ctx.shadowColor = 'rgba(255,94,26,.9)'; ctx.shadowBlur = 14; }
        ring(outer, yAt(k), a, true); ctx.stroke();
        ring(hole, yAt(k), a, true); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // Рёбра зубьев
      ctx.strokeStyle = 'rgba(238,229,213,.22)'; ctx.lineWidth = 1;
      tips.forEach(function (pt) { var A = proj(pt[0], 0, pt[1], a), B = proj(pt[0], yAt(cur), pt[1], a); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); });
      // Лазер: луч сверху в точку, бегущую по контуру
      if (p < 1) {
        var idx = Math.floor((cyc / 60) % outer.length), pt = outer[idx];
        var S = proj(pt[0], yAt(cur), pt[1], a), T = proj(0, 2.2, 0, a);
        var g = ctx.createLinearGradient(T[0], T[1], S[0], S[1]);
        g.addColorStop(0, 'rgba(255,94,26,0)'); g.addColorStop(1, 'rgba(255,94,26,.9)');
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
  function scrollToEl(el) { el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
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

  function initPrintBar() {
    if (document.getElementById('axprint')) return;
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
      stats: [['20', 'корпусов'], ['0', 'деформаций'], ['+130°', 'рабочая температура']],
      t: 'Заказчику требовалась партия корпусов для\u00a0датчиков, устанавливаемых рядом с\u00a0промышленной печью\u00a0— обычный ABS-пластик деформировался в\u00a0течение недели эксплуатации.',
      s: 'Подобрали инженерный полимер с\u00a0температурой стеклования выше рабочей на\u00a040°C, пигмент ввели в\u00a0массу материала вместо покраски\u00a0— чтобы цвет не\u00a0выгорал от\u00a0температуры.',
      r: 'Партия из\u00a020\u00a0корпусов, ноль деформаций после месяца тестов, экономия на\u00a0литьевой оснастке.' },
    { tag: 'Авиация', img: 'case-2.png', model: '../assets/models/case-2.glb', name: 'Кронштейн сложной геометрии для\u00a0лёгкого летательного аппарата',
      kv: [['отрасль', 'Авиация'], ['технология', 'SLM, титановый сплав'], ['прототип', '3\u00a0дня']],
      stats: [['22%', 'снижение веса'], ['3', 'дня до\u00a0прототипа']],
      t: 'Кронштейн крепления с\u00a0внутренними полостями, которые фрезеровкой не\u00a0получить, а\u00a0нужны максимальная прочность при\u00a0минимальном весе.',
      s: 'Оптимизация модели убрала материал из\u00a0ненагруженных зон, печать титановым сплавом SLM с\u00a0последующей термообработкой для\u00a0снятия внутренних напряжений.',
      r: 'Снижение веса на\u00a022% при\u00a0сохранении расчётного запаса прочности, прототип готов через 3\u00a0дня.' },
    { tag: 'Энергетика', img: 'case-3.png', model: '../assets/models/case-3.glb', rim: .15, name: 'Партия термостойких крышек для\u00a0распределительных щитов',
      kv: [['отрасль', 'Энергетика'], ['технология', 'литьё в\u00a0силикон'], ['цвет', 'по\u00a0RAL заказчика']],
      stats: [['1000', 'штук'], ['5', 'дней вместо недель']],
      t: '1000\u00a0крышек с\u00a0точным попаданием в\u00a0фирменный цвет заказчика, срок\u00a0— до\u00a0конца месяца, штатный поставщик литья не\u00a0успевал по\u00a0срокам.',
      s: 'Печать мастер-модели, снятие силиконовой формы, литьё партии полиуретаном с\u00a0точной цветопередачей по\u00a0RAL.',
      r: 'Вся партия изготовлена за\u00a05\u00a0дней вместо стандартных 3–4\u00a0недель на\u00a0литье с\u00a0металлической оснасткой.' },
    { tag: 'Медицина', img: 'case-4.png', model: '../assets/models/case-4.glb', name: 'Корпус диагностического анализатора',
      kv: [['отрасль', 'Медицина'], ['материал', 'химстойкий полимер'], ['цвет', 'RAL 7035']],
      stats: [['RAL 7035', 'точное совпадение'], ['1', 'попытка приёмки ОТК']],
      t: 'Корпус для\u00a0лабораторного прибора, контактирующего с\u00a0дезинфицирующими растворами\u00a0— требовалась химическая стойкость и\u00a0совпадение с\u00a0фирменным цветом RAL 7035.',
      s: 'Печать химстойким инженерным полимером, постобработка с\u00a0окраской в\u00a0требуемый RAL напрямую, без\u00a0промежуточного грунта.',
      r: 'Совпадение цвета в\u00a0допуске с\u00a0первой попытки, без\u00a0повторной покраски партии.' },
    { tag: 'Ретро\u2011авто', img: 'case-5.png', name: 'Деталь интерьера для\u00a0автомобиля 1970-х',
      kv: [['отрасль', 'Реставрация'], ['метод', '3D-скан + печать'], ['год выпуска', '1970']],
      stats: [['1970', 'год выпуска'], ['1', 'раз\u00a0— без\u00a0доработки']],
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
  function showCase(i) {
    var c = CASES[i];
    $$('button', tabsBox).forEach(function (b, k) { b.setAttribute('aria-selected', k === i); });
    $$('.thumb', thumbs).forEach(function (b, k) { b.setAttribute('aria-current', k === i); });
    sheet.innerHTML =
      '<span class="hud__tab" aria-hidden="true"><i></i><i></i><i></i><b></b></span>' +
      '<div class="dossier__head"><span>Кейс ' + String(i + 1).padStart(2, '0') + ' · ' + c.tag + '</span><span>' + String(i + 1).padStart(2, '0') + ' из\u00a0' + String(CASES.length).padStart(2, '0') + '</span></div>' +
      '<h3 style="font:700 var(--fs-sub)/1.15 var(--font-mono);text-transform:uppercase">' + c.name + '</h3>' +
      '<dl class="kv">' + c.kv.map(function (r) { return '<div><dt>' + r[0] + '</dt><i></i><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' +
      '<div class="dossier__text"><p><b>Задача</b>' + c.t + '</p><p><b>Решение</b>' + c.s + '</p><p><b>Результат</b>' + c.r + '</p></div>';
    // Объёмная деталь: стопка из слоёв картинки со сдвигом по глубине — как напечатанная слоями.
    // Крутится мышью или пальцем.
    var LAYERS3D = 16, layersHtml = '';
    for (var k = 0; k < LAYERS3D; k++) {
      var z = (k - LAYERS3D + 1) * 2.2, dark = (.35 + .65 * k / (LAYERS3D - 1)).toFixed(2);
      layersHtml += '<img src="../assets/img/' + c.img + '" alt="' + (k === LAYERS3D - 1 ? c.name : '') + '" style="transform:translateZ(' + z + 'px);filter:brightness(' + dark + ')"' + (k < LAYERS3D - 1 ? ' aria-hidden="true"' : '') + '>';
    }
    if (model3d) { model3d.destroy(); model3d = null; }
    var has3d = c.model && window.AxModel;
    stage.innerHTML =
      '<span class="dossier__dim dossier__dim--t">Покрутите деталь мышью</span>' +
      (has3d ? '<div class="viewer3d" aria-label="3D-модель: ' + c.name + '. Поворачивается мышью или пальцем"><img class="viewer3d__poster" src="../assets/img/' + c.img + '" alt=""></div>' :
      '<div class="viewer" tabindex="0" aria-label="Деталь: ' + c.name + '. Поворачивается мышью или\u00a0стрелками"><div class="viewer__obj">' + layersHtml + '</div><i class="viewer__shadow"></i></div>') +
      '<div class="dossier__stats">' + c.stats.map(function (s) { return '<div class="stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('') + '</div>';
    if (has3d) model3d = window.AxModel.mount($('.viewer3d', stage), c.model, { rim: c.rim });
    else initViewer($('.viewer', stage));
    curCase = i;
    [sheet, stage].forEach(function (el) { el.classList.remove('scan-in'); void el.offsetWidth; el.classList.add('scan-in'); });
    $$('.stat b', stage).forEach(countUp);
  }
  CASES.forEach(function (c, i) {
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab');
    b.textContent = c.tag; b.addEventListener('click', function () { showCase(i); }); tabsBox.appendChild(b);
    var t = document.createElement('button'); t.type = 'button'; t.className = 'thumb'; t.setAttribute('aria-label', c.name);
    t.innerHTML = '<img src="../assets/img/' + c.img + '" alt="" loading="lazy"><span>' + c.tag + '</span>';
    t.addEventListener('click', function () { showCase(i); }); thumbs.appendChild(t);
  });
  var more = document.createElement('a'); more.href = '#order'; more.className = 'thumb'; more.style.textDecoration = 'none';
  more.classList.add('thumb--more'); more.innerHTML = '<b>Ваша задача</b><span>Оставить заявку &gt;&gt;</span>'; thumbs.appendChild(more);
  showCase(0);

  /* ---------- Честно: детали летают вокруг текста ---------- */
  var floats = $$('.mega__float'), mega = $('.mega');
  function parallax() {
    var r = mega.getBoundingClientRect(), mid = r.top + r.height / 2 - innerHeight / 2;
    floats.forEach(function (el) { var d = +el.dataset.depth; el.style.transform = 'translate3d(0,' + (mid * d).toFixed(1) + 'px,0) rotate(' + (mid * d * .03).toFixed(2) + 'deg)'; });
  }
  if (!reduce) { addEventListener('scroll', function () { requestAnimationFrame(parallax); }, { passive: true }); parallax(); }

  /* ---------- Процесс: этапы по прокрутке ---------- */
  var STEPS = [
    ['01', 'Отправка', 'до\u00a0начала работы', 'Загружаете 3D-модель (STEP, STL), чертёж или\u00a0просто фото/образец детали. Нет ничего из\u00a0этого\u00a0— расскажите задачу, поможем разобраться, что\u00a0нужно.'],
    ['02', 'Расчёт', 'до\u00a01\u00a0рабочего дня', 'Инженер проверяет деталь на\u00a0технологичность\u00a0— не\u00a0просто считает объём, а\u00a0смотрит, действительно\u00a0ли\u00a0конструкция напечатается так, как\u00a0задумано.'],
    ['03', 'Согласование', 'перед началом печати', 'Присылаем расчёт с\u00a0материалом, точным сроком и\u00a0ценой. Если в\u00a0конструкции есть уязвимое место\u00a0— предупреждаем сразу, до\u00a0начала печати, а\u00a0не\u00a0после.'],
    ['04', 'Печать', 'изготовление', 'Изготавливаем деталь и\u00a0доводим её\u00a0постобработкой (шлифовка, окраска, доработка посадочных мест) до\u00a0состояния, готового к\u00a0установке.'],
    ['05', 'Гарантия', 'если не\u00a0подошла', 'Проверяем несоответствие по\u00a0вашему чертежу. Если ошибка на\u00a0нашей стороне\u00a0— переделываем без\u00a0дополнительной оплаты. Если менялось ТЗ\u00a0— обсуждаем доработку отдельно, без\u00a0сюрпризов в\u00a0счёте.']
  ];
  var proc = $('#process'), rail = $('#procRail'), card = $('#procCard'), layers = $$('.layer'), nozzle = $('#nozzle'), read = $('#procRead');
  STEPS.forEach(function (s, i) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = s[0]; b.setAttribute('aria-label', 'Этап ' + s[1]);
    b.addEventListener('click', function () { var r = proc.getBoundingClientRect(); scrollTo({ top: scrollY + r.top + (proc.offsetHeight - innerHeight) * (i + .5) / STEPS.length, behavior: reduce ? 'auto' : 'smooth' }); });
    rail.appendChild(b);
  });
  var curStep = -1;
  function setStep(i) {
    if (i === curStep) return; curStep = i;
    var s = STEPS[i];
    card.innerHTML = '<span class="hud__tab" aria-hidden="true"><i></i><i></i><i></i><b></b></span><span class="proc__no">' + s[0] + '</span><h3>' + s[1] + '</h3><p>' + s[3] + '</p><div class="hud__bar"><span>//' + s[2] + '</span><span>' + s[0] + '/05</span></div>';
    card.classList.remove('scan-in'); void card.offsetWidth; card.classList.add('scan-in');
    $$('button', rail).forEach(function (b, k) { b.classList.toggle('is-on', k === i); b.classList.toggle('is-done', k < i); });
    layers.forEach(function (l, k) { l.classList.toggle('is-on', k <= i); l.classList.toggle('is-now', k === i); });
    var lt = layers[i]; nozzle.style.bottom = (lt.offsetTop >= 0 ? (lt.parentElement.offsetHeight - lt.offsetTop) : 0) + parseFloat(getComputedStyle(lt.parentElement).bottom) + 14 + 'px';
    read.innerHTML = 'этап <b>' + s[0] + '</b>/05<br>слой <b>' + (i + 1) + '</b> из\u00a05<br>' + s[2];
  }
  function onProc() {
    if (innerWidth <= 1000) return;
    var r = proc.getBoundingClientRect(), span = proc.offsetHeight - innerHeight;
    setStep(clamp(Math.floor(clamp(-r.top / span, 0, .999) * STEPS.length), 0, STEPS.length - 1));
  }
  addEventListener('scroll', onProc, { passive: true }); addEventListener('resize', function () { curStep = -1; onProc(); });
  setStep(0); onProc();

  /* ---------- Калькулятор ---------- */
  var MAT = [['PLA / пластик (FDM)', 8], ['ABS / инженерный (FDM)', 10], ['Фотополимер (SLA)', 18], ['Нейлон (SLS)', 25], ['Металл (DMLS)', 90]];
  var sel = $('#cMat');
  MAT.forEach(function (m, i) { var o = document.createElement('option'); o.value = i; o.textContent = m[0]; sel.appendChild(o); });
  var fmt = function (n) { n = Math.round(n); return n < 10000 ? String(n) : n.toLocaleString('ru-RU'); };
  var mult = function (q) { return q >= 50 ? .75 : q >= 20 ? .85 : q >= 10 ? .92 : q >= 5 ? .97 : 1; };
  var num = function (el) { return Math.max(1, parseFloat(el.value) || parseFloat(el.placeholder) || 0); };
  function calc() {
    var vol = num($('#cL')) * num($('#cW')) * num($('#cH')) / 1000, q = Math.max(1, parseInt($('#cQ').value, 10) || 1);
    var unit = 500 + vol * MAT[sel.value][1], m = mult(q);
    $('#cVol').textContent = vol.toFixed(1) + ' см³';
    $('#cUnit').textContent = '≈ ' + fmt(unit) + ' ₽';
    $('#cDisc').textContent = Math.round((1 - m) * 100) + '%';
    $('#cTotal').textContent = '≈ ' + fmt(unit * q * m) + ' ₽';
  }
  ['#cMat', '#cL', '#cW', '#cH', '#cQ'].forEach(function (s) { $(s).addEventListener('input', calc); $(s).addEventListener('change', calc); });
  $('#cMinus').addEventListener('click', function () { $('#cQ').value = Math.max(1, (parseInt($('#cQ').value, 10) || 1) - 1); calc(); });
  $('#cPlus').addEventListener('click', function () { $('#cQ').value = (parseInt($('#cQ').value, 10) || 1) + 1; calc(); });
  calc();

  /* ---------- Заявка (адрес приёма пока не задан) ---------- */
  var LEAD_ENDPOINT = '';
  var LABEL = { file: 'Отправить файл на\u00a0расчёт', drawing: 'Отправить чертёж на\u00a0расчёт', idea: 'Отправить заявку на\u00a0расчёт' };
  $$('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('#tabs button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      var idea = b.dataset.t === 'idea'; $('#drop').hidden = idea; $('#idea').hidden = !idea; $('#send').textContent = LABEL[b.dataset.t];
    });
  });
  $('#drop').addEventListener('click', function (e) { if (e.target.id !== 'file') $('#file').click(); });
  $('#file').addEventListener('change', function (e) { $('#dropText').textContent = e.target.files[0] ? e.target.files[0].name : 'Загрузить файл\u00a0— перетащите сюда или\u00a0нажмите'; });
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
