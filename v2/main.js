/* AXIOM.tech v2 — скрипты (чистый JS, без библиотек) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Услуги: вкладки */
  var tabs = $$('.svc__tab'), panels = $$('.svc__panel');
  function openTab(i) {
    tabs.forEach(function (t, k) { t.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    panels.forEach(function (p, k) {
      var on = k === i; p.classList.toggle('is-on', on);
      var v = $('video', p); if (!v) return;
      if (on) { if (!v.src && v.dataset.src) v.src = v.dataset.src; var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); v.style.opacity = 1; }
      else v.pause();
    });
  }
  tabs.forEach(function (t, i) { t.addEventListener('click', function () { openTab(i); }); });
  openTab(0);

  /* Портфолио: раскрытие кейса */
  $$('.case__more button').forEach(function (b) {
    b.addEventListener('click', function () {
      var d = b.nextElementSibling, open = !d.classList.contains('is-open');
      d.classList.toggle('is-open', open); b.setAttribute('aria-expanded', open);
    });
  });

  /* Подсветка пункта меню */
  var links = $$('.nav a');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) links.forEach(function (a) { a.classList.toggle('is-on', a.getAttribute('href') === '#' + e.target.id); }); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(function (s) { io.observe(s); });
  }

  /* Калькулятор */
  var MAT = [['PLA / пластик (FDM)', 8], ['ABS / инженерный (FDM)', 10], ['Фотополимер (SLA)', 18], ['Нейлон (SLS)', 25], ['Металл (DMLS)', 90]];
  var sel = $('#cMat');
  MAT.forEach(function (m, i) { var o = document.createElement('option'); o.value = i; o.textContent = m[0]; sel.appendChild(o); });
  var fmt = function (n) { n = Math.round(n); return n < 10000 ? String(n) : n.toLocaleString('ru-RU'); };
  var mult = function (q) { return q >= 50 ? 0.75 : q >= 20 ? 0.85 : q >= 10 ? 0.92 : q >= 5 ? 0.97 : 1; };
  function num(el) { return Math.max(1, parseFloat(el.value) || parseFloat(el.placeholder) || 0); }
  function calc() {
    var vol = num($('#cL')) * num($('#cW')) * num($('#cH')) / 1000;
    var q = Math.max(1, parseInt($('#cQ').value, 10) || 1);
    var unit = 500 + vol * MAT[sel.value][1];
    $('#cVol').textContent = vol.toFixed(1) + ' см³';
    $('#cUnit').textContent = '≈ ' + fmt(unit) + ' ₽';
    $('#cTotal').textContent = '≈ ' + fmt(unit * q * mult(q)) + ' ₽';
  }
  ['#cMat', '#cL', '#cW', '#cH', '#cQ'].forEach(function (s) { $(s).addEventListener('input', calc); $(s).addEventListener('change', calc); });
  $('#cMinus').addEventListener('click', function () { $('#cQ').value = Math.max(1, (parseInt($('#cQ').value, 10) || 1) - 1); calc(); });
  $('#cPlus').addEventListener('click', function () { $('#cQ').value = (parseInt($('#cQ').value, 10) || 1) + 1; calc(); });
  calc();

  /* Форма: вкладки, файл, отправка (адрес приёма пока не задан) */
  var LEAD_ENDPOINT = '';
  var LABEL = { file: 'Отправить файл на расчёт >>', drawing: 'Отправить чертёж на расчёт >>', idea: 'Отправить заявку на расчёт >>' };
  $$('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('#tabs button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      var idea = b.dataset.t === 'idea';
      $('#drop').hidden = idea; $('#idea').hidden = !idea;
      $('#send').textContent = LABEL[b.dataset.t];
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

  /* Стекло: блик плывёт при прокрутке */
  var root = document.documentElement, tick = false;
  function glass() { tick = false; root.style.setProperty('--env-x', (50 + (scrollY * 0.012) % 100 * 0.9).toFixed(2) + '%'); }
  addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(glass); } }, { passive: true });
})();
