/* ==========================================================================
   AXIOM.tech — скрипты сайта
   Всё на чистом JS; единственная внешняя библиотека — Lenis (плавный скролл),
   она необязательна: без неё сайт работает с обычным скроллом.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Настройки, которые можно менять ---------------------------- */

  // Кадры анимации принтера в первом экране
  var FRAMES_URL = function (i) {
    return 'https://raw.githubusercontent.com/applehead13/Axiom-3D/refs/heads/main/frame_' +
      String(i + 1).padStart(4, '0') + '.jpg';
  };
  var FRAMES_COUNT = 98;

  // Куда отправлять заявки. Пока пусто — заявка только «имитируется» (см. initForms).
  // Пример: 'https://example.com/api/lead'
  var LEAD_ENDPOINT = '';

  /* ---------- Хелперы ---------------------------------------------------- */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var clamp = function (v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.matchMedia('(max-width: 900px)');
  var lenis = null;

  function onReady(fn) {
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  }

  function rafThrottle(fn) {
    var ticking = false;
    return function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; fn(); });
    };
  }

  // Для якорей: у «липкого» портфолио целью служит его обёртка, а не сам блок
  function anchorTarget(el) {
    var p = el.parentElement;
    return p && p.classList.contains('sticky-wrap') ? p : el;
  }

  function scrollToEl(el) {
    var t = anchorTarget(el);
    if (lenis) lenis.scrollTo(t, { offset: -3 });
    else t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------- Плавный скролл + якорные ссылки ----------------------------- */

  function initScroll() {
    if (window.Lenis && !reduceMotion) {
      lenis = new window.Lenis({
        duration: 1.2,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        smoothWheel: true
      });
      var raf = function (time) { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }

    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href').slice(1);
      if (!id) { e.preventDefault(); return; }
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      scrollToEl(target);
      if (history.replaceState) history.replaceState(null, '', '#' + id);
    });
  }

  /* ---------- Первый экран: интерфейс исчезает после 300px скролла --------- */

  function initHeroFade() {
    var ui = $('[data-scroll-fade]');
    if (!ui) return;
    var HOLD_PX = 300;
    var update = function () { ui.classList.toggle('is-gone', window.scrollY > HOLD_PX); };
    window.addEventListener('scroll', rafThrottle(update), { passive: true });
    update();
  }

  /* ---------- Покадровая анимация принтера (canvas) ------------------------ */

  function initFrames() {
    var canvas = $('#frames');
    var hero = $('#hero');
    var about = $('#about');
    if (!canvas || !hero || !about) return;

    var ctx = canvas.getContext('2d');
    var images = new Array(FRAMES_COUNT);
    var ready = [];             // индексы загруженных кадров
    var current = 0;            // сглаженное значение кадра
    var target = 0;
    var dpr = 1, W = 0, H = 0;
    var lastDrawn = -1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      lastDrawn = -1;
    }

    // Ближайший уже загруженный кадр (если нужный ещё грузится)
    function nearest(i) {
      if (images[i] && images[i].complete && images[i].naturalWidth) return images[i];
      for (var d = 1; d < FRAMES_COUNT; d++) {
        var a = images[i - d], b = images[i + d];
        if (a && a.complete && a.naturalWidth) return a;
        if (b && b.complete && b.naturalWidth) return b;
      }
      return null;
    }

    function draw(i) {
      var img = nearest(i);
      if (!img) return;
      var s = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      var w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      lastDrawn = i;
    }

    // Загрузка: сначала первый кадр, потом остальные пачками
    function load(i) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { ready.push(i); if (i === 0) draw(0); };
      img.onerror = function () { /* битый кадр просто пропускаем */ };
      img.src = FRAMES_URL(i);
      images[i] = img;
    }
    load(0);
    var next = 1;
    (function pump() {
      var n = 0;
      while (next < FRAMES_COUNT && n < 6) { load(next++); n++; }
      if (next < FRAMES_COUNT) setTimeout(pump, 120);
    })();

    var range = 1, fadeSpan = 1;
    function measure() {
      range = Math.max(1, about.offsetTop + about.offsetHeight - window.innerHeight);
      fadeSpan = Math.max(1, window.innerHeight * 0.6);
    }

    var running = false;
    function tick() {
      var y = window.scrollY;
      var p = clamp(y / range);
      target = p * (FRAMES_COUNT - 1);
      current += (target - current) * 0.18;
      if (Math.abs(target - current) < 0.01) current = target;

      var fade = 1 - clamp((y - range) / fadeSpan);
      canvas.style.opacity = fade;
      canvas.style.visibility = fade <= 0 ? 'hidden' : 'visible';

      var idx = Math.round(current);
      if (fade > 0 && idx !== lastDrawn) draw(idx);

      if (Math.abs(target - current) > 0.01 && fade > 0) requestAnimationFrame(tick);
      else running = false;
    }
    function kick() { if (!running) { running = true; requestAnimationFrame(tick); } }

    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', function () { resize(); measure(); kick(); }, { passive: true });
    window.addEventListener('load', function () { measure(); kick(); });
    resize(); measure(); kick();
  }

  /* ---------- Заголовки: «печатная машинка» -------------------------------- */

  function initTypewriter() {
    var els = $$('.tw');
    if (!els.length) return;
    var MS_PER_CHAR = 42;

    function show(el) { el.classList.add('is-shown'); }
    if (reduceMotion || !('IntersectionObserver' in window)) { els.forEach(show); return; }

    function getLines(el) {
      var range = document.createRange();
      range.selectNodeContents(el);
      var rects = Array.prototype.slice.call(range.getClientRects()).sort(function (a, b) { return a.top - b.top; });
      var lines = [];
      rects.forEach(function (r) {
        var last = lines[lines.length - 1];
        if (last && Math.abs(r.top - last.top) < 4) {
          last.left = Math.min(last.left, r.left); last.right = Math.max(last.right, r.right);
          last.top = Math.min(last.top, r.top); last.bottom = Math.max(last.bottom, r.bottom);
        } else {
          lines.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
        }
      });
      var chars = Math.round(el.textContent.replace(/\s+/g, ' ').trim().length / Math.max(1, lines.length));
      return lines.map(function (l) {
        return { left: l.left, top: l.top + window.scrollY, width: l.right - l.left, height: l.bottom - l.top, chars: chars };
      });
    }

    function runOne(el) {
      var lines = getLines(el);
      if (!lines.length) { show(el); return; }
      var done = 0;
      lines.forEach(function (l) {
        var wrap = document.createElement('div');
        wrap.className = 'tw-linebox';
        wrap.style.cssText = 'top:' + l.top + 'px;left:' + l.left + 'px;width:' + l.width + 'px;height:' + l.height + 'px';
        var cover = document.createElement('div'); cover.className = 'tw-cover';
        var cursor = document.createElement('div'); cursor.className = 'tw-cursor';
        wrap.appendChild(cover); wrap.appendChild(cursor);
        document.body.appendChild(wrap);
        cursor.style.opacity = 1;
        var dur = Math.max(300, l.chars * MS_PER_CHAR), t0 = null;
        (function step(ts) {
          if (t0 === null) t0 = ts;
          var p = Math.min(1, (ts - t0) / dur);
          cover.style.clipPath = 'inset(0 ' + ((1 - p) * 100) + '% 0 0)';
          cursor.style.left = (p * l.width) + 'px';
          if (p < 1) requestAnimationFrame(step);
          else { wrap.remove(); if (++done === lines.length) show(el); }
        })(performance.now());
      });
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { runOne(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
    // Ждём шрифты, чтобы переносы строк посчитались правильно (но не дольше 1.5 с)
    var observe = function () { els.forEach(function (el) { io.observe(el); }); };
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 1500); })]).then(observe);
  }

  /* ---------- Логотип: «печать» значка + смена цвета на светлых блоках ---- */

  // Светлый ли фон в точке (по цвету фона элементов под ней)
  function isLightAt(x, y, skipEl) {
    var stack = document.elementsFromPoint(x, y);
    if (!stack || !stack.length) return null;
    var forced = stack[0].closest && stack[0].closest('[data-cursor-theme]');
    if (forced) return forced.getAttribute('data-cursor-theme') === 'light';
    for (var i = 0; i < stack.length; i++) {
      var node = stack[i];
      if (node.nodeType !== 1 || (skipEl && (node === skipEl || skipEl.contains(node)))) continue;
      var m = getComputedStyle(node).backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (m) {
        var p = m[1].split(',');
        var a = p.length > 3 ? parseFloat(p[3]) : 1;
        if (a > 0.5) return (0.2126 * +p[0] + 0.7152 * +p[1] + 0.0722 * +p[2]) / 255 > 0.55;
      }
    }
    return null;
  }

  function initLogo() {
    var logo = $('#siteLogo');
    if (!logo) return;
    var mark = $('.logo__mark', logo);
    var text = $('.logo__text', logo);

    var beam = document.createElement('i');
    beam.className = 'logo-beam';
    logo.appendChild(beam);

    function print() {
      if (reduceMotion) { mark.classList.add('is-in'); return; }
      void mark.offsetWidth;
      mark.classList.add('is-in');
      beam.classList.add('is-run');
    }
    requestAnimationFrame(print);

    function update() {
      var r = logo.getBoundingClientRect();
      var light = isLightAt(r.left + r.width / 2, r.top + r.height / 2, logo);
      if (light !== null) text.classList.toggle('is-on-light', light);
    }
    window.addEventListener('scroll', rafThrottle(update), { passive: true });
    window.addEventListener('resize', rafThrottle(update), { passive: true });
    setTimeout(update, 500);
    update();
  }

  /* ---------- Слайдер услуг ----------------------------------------------- */

  function initSlider() {
    var stage = $('#sliderStage');
    if (!stage) return;
    var slider = $('#slider');
    var slides = $$('[data-slide]', stage);
    var prevBtn = $('#sliderPrev'), nextBtn = $('#sliderNext'), dotsWrap = $('#sliderDots');
    var SCAN_MS = 1500;
    var current = 0, busy = false, backdrop = null, introDone = false;

    var dots = slides.map(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'dot' + (i === 0 ? ' is-active' : '');
      b.setAttribute('aria-label', 'Слайд ' + (i + 1));
      b.addEventListener('click', function () { go(i); });
      dotsWrap.appendChild(b);
      return b;
    });

    function playVideo(slide, on) {
      var v = $('video', slide);
      if (!v) return;
      if (on) {
        if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src;
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      } else {
        v.pause();
      }
    }

    function updateNav() {
      prevBtn.classList.toggle('is-available', current > 0);
      nextBtn.classList.toggle('is-available', current < slides.length - 1);
    }

    function scanMode() { return !isMobile.matches && !reduceMotion; }

    function setup() {
      var scan = scanMode();
      slides.forEach(function (s, i) {
        s.classList.toggle('scan', scan);
        s.classList.toggle('is-hidden', i !== current);
        s.classList.toggle('is-in', !scan && i === current);
        if (!scan && i === current) playVideo(s, true);
      });
      if (backdrop) { backdrop.remove(); backdrop = null; }
      if (scan) {
        backdrop = document.createElement('div');
        backdrop.className = 'slider__backdrop';
        stage.appendChild(backdrop);
        slides.forEach(function (s) { s.classList.remove('is-in'); });
        if (introDone) { slides[current].classList.add('is-in'); backdrop.classList.add('is-clear'); }
      }
      updateNav();
    }

    function intro() {
      if (introDone) return;
      introDone = true;
      var s = slides[current];
      if (scanMode()) {
        void s.offsetWidth;
        s.classList.add('is-in');
        if (backdrop) backdrop.classList.add('is-clear');
      } else {
        s.classList.add('is-in');
      }
      playVideo(s, true);
    }

    function go(idx) {
      if (busy) return;
      idx = clamp(idx, 0, slides.length - 1);
      if (idx === current) return;
      busy = true;
      var out = slides[current], inn = slides[idx];
      dots[current].classList.remove('is-active');
      dots[idx].classList.add('is-active');
      out.classList.remove('is-in'); out.classList.add('is-hidden');
      playVideo(out, false);
      current = idx;
      inn.classList.remove('is-hidden');
      if (scanMode()) {
        backdrop.style.transition = 'none';
        backdrop.classList.remove('is-clear');
        void backdrop.offsetWidth;
        backdrop.style.transition = '';
        void inn.offsetWidth;
        inn.classList.add('is-in');
        backdrop.classList.add('is-clear');
      } else {
        inn.classList.add('is-in');
      }
      playVideo(inn, true);
      updateNav();
      setTimeout(function () { busy = false; }, scanMode() ? SCAN_MS : 0);
    }

    prevBtn.addEventListener('click', function () { go(current - 1); });
    nextBtn.addEventListener('click', function () { go(current + 1); });
    slider.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') go(current - 1);
      if (e.key === 'ArrowRight') go(current + 1);
    });

    setup();
    if (isMobile.addEventListener) isMobile.addEventListener('change', setup);

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { intro(); io.disconnect(); }
      }, { threshold: 0.25 });
      io.observe(stage);
    } else { intro(); }
  }

  /* ---------- Кейсы: неон + раскрывающаяся панель --------------------------- */

  function initCases() {
    var cases = $$('.case');
    if (!cases.length) return;

    // Неоновое появление картинок по очереди
    var variants = ['neon--a', 'neon--b', 'neon--c', 'neon--a', 'neon--b', 'neon--dark'];
    var imgs = cases.map(function (c, i) {
      var img = $('.neon', c);
      if (img) img.classList.add(variants[i % variants.length]);
      return img;
    }).filter(Boolean);

    var started = false;
    function start() {
      if (started) return;
      started = true;
      imgs.forEach(function (img, i) { setTimeout(function () { img.classList.add('is-in'); }, reduceMotion ? 0 : i * 500); });
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { start(); io.disconnect(); }
      }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
      io.observe(cases[0]);
    } else { start(); }

    // Раскрытие: наведение на «+» (мышь) или нажатие (тач / клавиатура)
    var canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
    function setOpen(c, open) {
      c.classList.toggle('is-open', open);
      var panel = $('.reveal', c);
      if (panel) panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      var plus = $('.plus', c);
      if (plus) plus.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    cases.forEach(function (c) {
      var plus = $('.plus', c);
      if (!plus) return;
      plus.setAttribute('aria-expanded', 'false');
      plus.addEventListener('mouseenter', function () { if (canHover.matches) setOpen(c, true); });
      plus.addEventListener('click', function (e) { e.stopPropagation(); setOpen(c, !c.classList.contains('is-open')); });
      c.addEventListener('mouseleave', function () {
        // пока курсор ушёл, но фокус в форме кейса №6 — панель не закрываем
        if (canHover.matches && !c.contains(document.activeElement)) setOpen(c, false);
      });
      c.addEventListener('focusout', function (e) {
        if (!c.contains(e.relatedTarget) && !c.matches(':hover')) setOpen(c, false);
      });
    });
    document.addEventListener('click', function (e) {
      cases.forEach(function (c) { if (c.classList.contains('is-open') && !c.contains(e.target)) setOpen(c, false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') cases.forEach(function (c) { setOpen(c, false); });
    });
  }

  /* ---------- Портфолио «прилипает», честный блок наезжает сверху ---------- */

  function initSticky() {
    var el = $('#portfolio');
    var next = $('#honest');
    if (!el || !next || el.parentNode.classList.contains('sticky-wrap')) return;

    var EFFECT_RANGE = 700, MAX_BLUR = 3, MIN_SCALE = 0.95;
    var HOLD_PX = 1000;   // пересчитывается в layout(): липнет, пока «Честно» не перекроет весь экран
    var wrap = document.createElement('div');
    wrap.className = 'sticky-wrap';
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);

    function layout() {
      if (isMobile.matches) {
        wrap.style.height = ''; wrap.style.marginBottom = '';
        el.style.top = ''; el.style.position = 'relative'; el.style.filter = ''; el.style.transform = '';
        return;
      }
      el.style.position = '';
      HOLD_PX = window.innerHeight + parseFloat(getComputedStyle(next).marginTop || 0) + 40;
      wrap.style.height = (el.offsetHeight + HOLD_PX) + 'px';
      wrap.style.marginBottom = (-HOLD_PX) + 'px';
      // липнет нижним краем к низу окна — следом наезжает «Честно»
      el.style.top = Math.min(0, window.innerHeight - el.offsetHeight) + 'px';
    }

    function effect() {
      if (isMobile.matches || reduceMotion) return;
      var progress = clamp((window.innerHeight - next.getBoundingClientRect().top) / EFFECT_RANGE);
      el.style.filter = progress > 0 ? 'blur(' + (progress * MAX_BLUR) + 'px)' : '';
      el.style.transform = progress > 0 ? 'scale(' + (1 - progress * (1 - MIN_SCALE)) + ')' : '';
    }

    layout(); effect();
    window.addEventListener('resize', function () { layout(); effect(); }, { passive: true });
    window.addEventListener('load', function () { layout(); effect(); });
    window.addEventListener('scroll', rafThrottle(effect), { passive: true });
    if (window.ResizeObserver) new ResizeObserver(layout).observe(el);
  }

  /* ---------- Калькулятор -------------------------------------------------- */

  function initCalc() {
    var BASE_COST = 500;
    var MATERIALS = [
      { id: 'pla',   label: 'PLA / пластик (FDM)',   pricePerCm3: 8 },
      { id: 'abs',   label: 'ABS / инженерный (FDM)', pricePerCm3: 10 },
      { id: 'resin', label: 'Фотополимер (SLA)',     pricePerCm3: 18 },
      { id: 'nylon', label: 'Нейлон (SLS)',          pricePerCm3: 25 },
      { id: 'metal', label: 'Металл (DMLS)',         pricePerCm3: 90 }
    ];
    var select = $('#axcMaterial');
    if (!select) return;

    var lEl = $('#axcL'), wEl = $('#axcW'), hEl = $('#axcH'), qEl = $('#axcQty');
    var qMinus = $('#axcQtyMinus'), qPlus = $('#axcQtyPlus');
    var volumeOut = $('#axcVolume'), perUnitOut = $('#axcPerUnit'), totalOut = $('#axcTotal');
    var dropdown = $('#axcMaterialDropdown'), trigger = $('#axcMaterialTrigger');
    var valueEl = $('#axcMaterialValue'), listEl = $('#axcMaterialList');

    function qtyMultiplier(q) { return q >= 50 ? 0.75 : q >= 20 ? 0.85 : q >= 10 ? 0.92 : q >= 5 ? 0.97 : 1; }
    function fmt(n) { var r = Math.round(n); return r < 10000 ? String(r) : r.toLocaleString('ru-RU'); }

    MATERIALS.forEach(function (m, i) {
      var opt = document.createElement('option');
      opt.value = m.id; opt.textContent = m.label; select.appendChild(opt);
      var li = document.createElement('li');
      li.className = 'axc-dropdown-item' + (i === 0 ? ' is-selected' : '');
      li.setAttribute('role', 'option'); li.dataset.id = m.id; li.textContent = m.label;
      listEl.appendChild(li);
    });
    valueEl.textContent = MATERIALS[0].label;

    function closeDropdown() { dropdown.classList.remove('is-open'); trigger.setAttribute('aria-expanded', 'false'); }
    function openDropdown() { dropdown.classList.add('is-open'); trigger.setAttribute('aria-expanded', 'true'); }
    trigger.addEventListener('click', function (e) { e.stopPropagation(); dropdown.classList.contains('is-open') ? closeDropdown() : openDropdown(); });
    listEl.addEventListener('click', function (e) {
      var item = e.target.closest('.axc-dropdown-item');
      if (!item) return;
      select.value = item.dataset.id;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      valueEl.textContent = item.textContent;
      $$('.axc-dropdown-item', listEl).forEach(function (el) { el.classList.toggle('is-selected', el === item); });
      closeDropdown();
    });
    document.addEventListener('click', function (e) { if (!dropdown.contains(e.target)) closeDropdown(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDropdown(); });

    function calc() {
      var L = Math.max(1, parseFloat(lEl.value) || parseFloat(lEl.placeholder) || 0);
      var W = Math.max(1, parseFloat(wEl.value) || parseFloat(wEl.placeholder) || 0);
      var H = Math.max(1, parseFloat(hEl.value) || parseFloat(hEl.placeholder) || 0);
      var qty = Math.max(1, parseInt(qEl.value, 10) || 1);
      var material = MATERIALS.filter(function (m) { return m.id === select.value; })[0] || MATERIALS[0];
      var volumeCm3 = (L * W * H) / 1000;
      var perUnit = BASE_COST + volumeCm3 * material.pricePerCm3;
      var total = perUnit * qty * qtyMultiplier(qty);
      volumeOut.textContent = volumeCm3.toFixed(1) + ' см³';
      perUnitOut.textContent = '≈ ' + fmt(perUnit) + ' ₽';
      totalOut.textContent = '≈ ' + fmt(total) + '₽';
      qMinus.classList.toggle('is-disabled', qty <= 1);
    }
    [select, lEl, wEl, hEl, qEl].forEach(function (el) { el.addEventListener('input', calc); el.addEventListener('change', calc); });
    qMinus.addEventListener('click', function () { qEl.value = Math.max(1, (parseInt(qEl.value, 10) || 1) - 1); calc(); });
    qPlus.addEventListener('click', function () { qEl.value = Math.max(1, (parseInt(qEl.value, 10) || 1) + 1); calc(); });
    calc();
  }

  /* ---------- Формы -------------------------------------------------------- */

  function initForms() {
    // Вкладки основной формы: файл / чертёж / идея
    var form = $('.axf-form');
    if (form) {
      var tabs = $$('.axf-tab', form);
      var uploadBlock = $('#axfUpload'), uploadText = $('#axfUploadText'), fileInput = $('#axfFile');
      var ideaBlock = $('#axfIdea'), submitBtn = $('#axfSubmit');
      var UPLOAD_DEFAULT = 'Загрузить файл — перетащите сюда или нажмите';
      var LABELS = {
        file: 'Отправить файл на расчёт >>',
        drawing: 'Отправить чертёж на расчёт >>',
        idea: 'Отправить заявку на расчёт >>'
      };
      var setTab = function (tab) {
        form.dataset.tab = tab;
        tabs.forEach(function (b) { b.classList.toggle('is-active', b.dataset.tab === tab); });
        if (tab === 'idea') { uploadBlock.style.display = 'none'; ideaBlock.style.display = 'flex'; }
        else {
          uploadBlock.style.display = 'flex'; ideaBlock.style.display = 'none';
          uploadText.textContent = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : UPLOAD_DEFAULT;
        }
        submitBtn.textContent = LABELS[tab] || LABELS.file;
      };
      tabs.forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab); }); });
      fileInput.addEventListener('change', function () {
        uploadText.textContent = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : UPLOAD_DEFAULT;
      });
      uploadBlock.addEventListener('click', function (e) { if (e.target !== fileInput) fileInput.click(); });
      setTab('file');
    }

    // Отправка заявок (обе формы)
    $$('[data-lead-form]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var consent = $('input[type="checkbox"]', f);
        var contact = $('input[name="contact"]', f);
        if (consent && !consent.checked) { consent.focus(); consent.closest('label').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 250 }); return; }
        if (contact && !contact.value.trim()) { contact.focus(); return; }

        var btn = $('button[type="submit"]', f);
        var original = btn.innerHTML;
        var data = new FormData(f);
        data.append('form', f.dataset.leadForm);

        var done = function (ok) {
          btn.disabled = true;
          btn.textContent = ok ? 'Заявка отправлена ✓' : 'Не удалось отправить';
          setTimeout(function () { btn.disabled = false; btn.innerHTML = original; if (ok) f.reset(); }, 3500);
        };

        if (!LEAD_ENDPOINT) {
          // Адрес отправки ещё не задан — только показываем, как это будет выглядеть
          console.info('[AXIOM] Заявка (адрес отправки не настроен, см. LEAD_ENDPOINT в js/main.js):', Array.from(data.entries()));
          done(true);
          return;
        }
        fetch(LEAD_ENDPOINT, { method: 'POST', body: data })
          .then(function (r) { done(r.ok); })
          .catch(function () { done(false); });
      });
    });
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

  /* ---------- Сетка-подсказка: клавиша G, кнопка слева внизу или ?grid в адресе ---- */

  function initGridView() {
    var overlay = document.createElement('div');
    overlay.className = 'gridview';
    overlay.setAttribute('aria-hidden', 'true');
    var cols = '';
    for (var i = 0; i < 12; i++) cols += '<i></i>';
    overlay.innerHTML = '<div class="gridview__wrap"><div class="gridview__cols">' + cols + '</div></div>' +
      '<span class="gridview__edge gridview__edge--l"></span><span class="gridview__edge gridview__edge--r"></span>';
    document.body.appendChild(overlay);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gridview__btn';
    btn.setAttribute('aria-pressed', 'false');
    document.body.appendChild(btn);

    // Число колонок карточек портфолио на текущей ширине
    function casesCols() {
      var g = $('#cases');
      return g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0;
    }
    function label() {
      var on = overlay.classList.contains('is-on');
      btn.textContent = 'Сетка ' + (on ? 'вкл' : 'выкл') + ' · ' + window.innerWidth + 'px · карт. ' + casesCols();
    }
    function toggle(force) {
      var on = force === undefined ? !overlay.classList.contains('is-on') : force;
      overlay.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      label();
    }
    btn.addEventListener('click', function () { toggle(); });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'g' || e.key === 'G' || e.key === 'п' || e.key === 'П') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (/^(input|textarea|select)$/i.test((e.target.tagName || ''))) return;
        toggle();
      }
    });
    window.addEventListener('resize', rafThrottle(label), { passive: true });
    toggle(/[?&]grid\b/.test(location.search));
  }

  /* ---------- Запуск ------------------------------------------------------- */

  onReady(function () {
    initScroll();
    initHeroFade();
    initFrames();
    initLogo();
    initTypewriter();
    initSlider();
    initCases();
    initSticky();
    initCalc();
    initForms();
    initPrintBar();
    initCursor();
    initGridView();
  });
})();
