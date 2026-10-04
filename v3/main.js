/* ==========================================================================
   AXIOM.tech v3 — скрипты (чистый JS, без библиотек)
   ========================================================================== */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

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

    // Варианты сцены (переключатель на первом экране или ?hero=1..4 в адресе):
    // 1 — неподвижный пол-сетка, вращается только деталь;
    // 2 — стол принтера: квадратная платформа с сеткой вращается вместе с деталью;
    // 3 — чертёж: вид сверху на миллиметровке, ничего не вращается;
    // 4 — без пола: только деталь в пустой студии.
    var PITCH = { 1: .32, 2: .42, 3: 1.18, 4: .36 };
    var variant = +(location.search.match(/[?&]hero=(\d)/) || [])[1] || 1;
    if (!PITCH[variant]) variant = 1;
    var W, H, dpr, cx, cy, f, rot = 0, pitch = PITCH[variant], mxTarget = 0, mx = 0;
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var wide = W > 1000;
      cx = wide ? W * .68 : W * .5; cy = wide ? H * .4 : H * .3;
      f = Math.min(W, H) * (wide ? 1.05 : .9);
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

    // Переключатель вариантов (временный — чтобы выбрать один)
    var sw = document.createElement('div');
    sw.className = 'hero__switch';
    sw.innerHTML = '<span>фон:</span>' + [1, 2, 3, 4].map(function (n) {
      return '<button type="button" data-v="' + n + '"' + (n === variant ? ' aria-pressed="true"' : '') + '>' + ['', 'сетка', 'стол', 'чертёж', 'пусто'][n] + '</button>';
    }).join('');
    cv.parentElement.appendChild(sw);
    sw.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      variant = +b.dataset.v; pitch = PITCH[variant];
      $$('button', sw).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      if (history.replaceState) history.replaceState(null, '', '?hero=' + variant);
      if (reduce) frame(performance.now());
    });
  })();

  /* ---------- Кейсы: досье ---------- */
  var CASES = [
    { tag: 'Электроника', img: 'case-1.png', name: 'Корпус для выносной электроники', dims: ['86 мм', '58 мм'],
      kv: [['отрасль', 'Электроника'], ['материал', 'инженерный полимер'], ['партия', '20 шт']],
      stats: [['20', 'корпусов'], ['0', 'деформаций'], ['+130°', 'рабочая температура']],
      t: 'Заказчику требовалась партия корпусов для датчиков, устанавливаемых рядом с промышленной печью — обычный ABS-пластик деформировался в течение недели эксплуатации.',
      s: 'Подобрали инженерный полимер с температурой стеклования выше рабочей на 40°C, пигмент ввели в массу материала вместо покраски — чтобы цвет не выгорал от температуры.',
      r: 'Партия из 20 корпусов, ноль деформаций после месяца тестов, экономия на литьевой оснастке.' },
    { tag: 'Авиация', img: 'case-2.png', name: 'Кронштейн сложной геометрии для лёгкого летательного аппарата',
      kv: [['отрасль', 'Авиация'], ['технология', 'SLM, титановый сплав'], ['прототип', '3 дня']],
      stats: [['22%', 'снижение веса'], ['3', 'дня до прототипа']],
      t: 'Кронштейн крепления с внутренними полостями, которые фрезеровкой не получить, а нужны максимальная прочность при минимальном весе.',
      s: 'Оптимизация модели убрала материал из ненагруженных зон, печать титановым сплавом SLM с последующей термообработкой для снятия внутренних напряжений.',
      r: 'Снижение веса на 22% при сохранении расчётного запаса прочности, прототип готов через 3 дня.' },
    { tag: 'Энергетика', img: 'case-3.png', name: 'Партия термостойких крышек для распределительных щитов',
      kv: [['отрасль', 'Энергетика'], ['технология', 'литьё в силикон'], ['цвет', 'по RAL заказчика']],
      stats: [['1000', 'штук'], ['5', 'дней вместо недель']],
      t: '1000 крышек с точным попаданием в фирменный цвет заказчика, срок — до конца месяца, штатный поставщик литья не успевал по срокам.',
      s: 'Печать мастер-модели, снятие силиконовой формы, литьё партии полиуретаном с точной цветопередачей по RAL.',
      r: 'Вся партия изготовлена за 5 дней вместо стандартных 3–4 недель на литье с металлической оснасткой.' },
    { tag: 'Медицина', img: 'case-4.png', name: 'Корпус диагностического анализатора',
      kv: [['отрасль', 'Медицина'], ['материал', 'химстойкий полимер'], ['цвет', 'RAL 7035']],
      stats: [['RAL 7035', 'точное совпадение'], ['1', 'попытка приёмки ОТК']],
      t: 'Корпус для лабораторного прибора, контактирующего с дезинфицирующими растворами — требовалась химическая стойкость и совпадение с фирменным цветом RAL 7035.',
      s: 'Печать химстойким инженерным полимером, постобработка с окраской в требуемый RAL напрямую, без промежуточного грунта.',
      r: 'Совпадение цвета в допуске с первой попытки, без повторной покраски партии.' },
    { tag: 'Ретро-авто', img: 'case-5.png', name: 'Деталь интерьера для автомобиля 1970-х',
      kv: [['отрасль', 'Реставрация'], ['метод', '3D-скан + печать'], ['год выпуска', '1970']],
      stats: [['1970', 'год выпуска'], ['1', 'раз — без доработки']],
      t: 'Сломанная деталь интерьера для автомобиля 1970-х, оригинал давно не производится, найти на разборках не удалось.',
      s: 'Отсканировали уцелевший образец с другого автомобиля коллекционера, восстановили геометрию, напечатали инженерным пластиком с фактурой под оригинальный пластик салона.',
      r: 'Деталь встала без доработки с первого раза, полное визуальное совпадение с оригиналом.' }
  ];
  var tabsBox = $('#caseTabs'), thumbs = $('#caseThumbs'), sheet = $('#caseSheet'), stage = $('#caseStage');
  function countUp(el) {
    var txt = el.textContent, m = txt.match(/^([+]?)(\d+)(.*)$/);
    if (!m || reduce || txt === '1970') return;
    var to = +m[2], t0 = performance.now(), dur = 900;
    (function step(now) { var k = clamp((now - t0) / dur, 0, 1); el.textContent = m[1] + Math.round(to * (1 - Math.pow(1 - k, 3))) + m[3]; if (k < 1) requestAnimationFrame(step); })(t0);
  }
  function showCase(i) {
    var c = CASES[i];
    $$('button', tabsBox).forEach(function (b, k) { b.setAttribute('aria-selected', k === i); });
    $$('.thumb', thumbs).forEach(function (b, k) { b.setAttribute('aria-current', k === i); });
    sheet.innerHTML =
      '<span class="hud__tab" aria-hidden="true"><i></i><i></i><i></i><b></b></span>' +
      '<div class="dossier__head"><span>//' + String(i + 1).padStart(3, '0') + '_' + c.tag + '</span><span>case</span></div>' +
      '<h3 style="font:700 var(--fs-sub)/1.15 var(--font-mono);text-transform:uppercase">' + c.name + '</h3>' +
      '<dl class="kv">' + c.kv.map(function (r) { return '<div><dt>' + r[0] + '</dt><i></i><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' +
      '<div class="dossier__text"><p><b>//задача</b>' + c.t + '</p><p><b>//решение</b>' + c.s + '</p><p><b>//результат</b>' + c.r + '</p></div>';
    stage.innerHTML =
      '<span class="dossier__dim dossier__dim--t">← модель ' + String(i + 1).padStart(2, '0') + ' →</span>' +
      '<img class="dossier__img" src="../assets/img/' + c.img + '" alt="' + c.name + '">' +
      '<div class="dossier__stats">' + c.stats.map(function (s) { return '<div class="stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('') + '</div>';
    [sheet, stage].forEach(function (el) { el.classList.remove('scan-in'); void el.offsetWidth; el.classList.add('scan-in'); });
    $$('.stat b', stage).forEach(countUp);
  }
  CASES.forEach(function (c, i) {
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab');
    b.textContent = 'case_' + String(i + 1).padStart(2, '0'); b.addEventListener('click', function () { showCase(i); }); tabsBox.appendChild(b);
    var t = document.createElement('button'); t.type = 'button'; t.className = 'thumb'; t.setAttribute('aria-label', c.name);
    t.innerHTML = '<img src="../assets/img/' + c.img + '" alt="" loading="lazy"><span>//' + String(i + 1).padStart(3, '0') + '</span>';
    t.addEventListener('click', function () { showCase(i); }); thumbs.appendChild(t);
  });
  var more = document.createElement('a'); more.href = '#order'; more.className = 'thumb'; more.style.textDecoration = 'none';
  more.innerHTML = '<span style="position:static;font-size:var(--fs-label);color:var(--orange);text-align:center">ваш<br>случай<br>&gt;&gt;</span>'; thumbs.appendChild(more);
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
    ['01', 'Отправка', 'до начала работы', 'Загружаете 3D-модель (STEP, STL), чертёж или просто фото/образец детали. Нет ничего из этого — расскажите задачу, поможем разобраться, что нужно.'],
    ['02', 'Расчёт', 'до 1 рабочего дня', 'Инженер проверяет деталь на технологичность — не просто считает объём, а смотрит, действительно ли конструкция напечатается так, как задумано.'],
    ['03', 'Согласование', 'перед началом печати', 'Присылаем расчёт с материалом, точным сроком и ценой. Если в конструкции есть уязвимое место — предупреждаем сразу, до начала печати, а не после.'],
    ['04', 'Печать', 'изготовление', 'Изготавливаем деталь и доводим её постобработкой (шлифовка, окраска, доработка посадочных мест) до состояния, готового к установке.'],
    ['05', 'Гарантия', 'если не подошла', 'Проверяем несоответствие по вашему чертежу. Если ошибка на нашей стороне — переделываем без дополнительной оплаты. Если менялось ТЗ — обсуждаем доработку отдельно, без сюрпризов в счёте.']
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
    read.innerHTML = 'этап <b>' + s[0] + '</b>/05<br>слой <b>' + (i + 1) + '</b> из 5<br>' + s[2];
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
  var LABEL = { file: 'Отправить файл на расчёт', drawing: 'Отправить чертёж на расчёт', idea: 'Отправить заявку на расчёт' };
  $$('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('#tabs button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      var idea = b.dataset.t === 'idea'; $('#drop').hidden = idea; $('#idea').hidden = !idea; $('#send').textContent = LABEL[b.dataset.t];
    });
  });
  $('#drop').addEventListener('click', function (e) { if (e.target.id !== 'file') $('#file').click(); });
  $('#file').addEventListener('change', function (e) { $('#dropText').textContent = e.target.files[0] ? e.target.files[0].name : 'Загрузить файл — перетащите сюда или нажмите'; });
  $('#lead').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, btn = $('#send'), old = btn.textContent;
    if (!$('#consent').checked) { $('#consent').focus(); return; }
    if (!f.contact.value.trim()) { f.contact.focus(); return; }
    var done = function (ok) { btn.disabled = true; btn.textContent = ok ? 'Заявка отправлена ✓' : 'Не удалось отправить'; setTimeout(function () { btn.disabled = false; btn.textContent = old; if (ok) f.reset(); }, 3500); };
    if (!LEAD_ENDPOINT) { done(true); return; }
    fetch(LEAD_ENDPOINT, { method: 'POST', body: new FormData(f) }).then(function (r) { done(r.ok); }).catch(function () { done(false); });
  });
})();
