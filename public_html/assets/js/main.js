/* Små forbedringer oven på statisk HTML: kursus-faner, priskalkulator, formularer. Alt virker også uden JS. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var params = new URLSearchParams(location.search);

  /* ---- Kurser: faner ---- */
  var tabs = $$('.tab[data-course]');
  if (tabs.length) {
    var panels = $$('.course');
    var select = function (id, updateHash) {
      if (!panels.some(function (p) { return p.id === id; })) id = panels[0].id;
      panels.forEach(function (p) { p.hidden = p.id !== id; });
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-course') === id;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      if (updateHash && history.replaceState) history.replaceState(null, '', '#' + id);
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t.getAttribute('data-course'), true); });
      t.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
        if (n === null) return;
        n = (n + tabs.length) % tabs.length;
        tabs[n].focus(); select(tabs[n].getAttribute('data-course'), true);
        e.preventDefault();
      });
    });
    var fromHash = function () { select(location.hash.replace('#', '')); };
    window.addEventListener('hashchange', fromHash);
    fromHash();
    if (location.hash) window.scrollTo(0, 0);
  }

  /* ---- Priser: kalkulator ---- */
  var calc = $('[data-calc]');
  if (calc) {
    var rate = Number(calc.getAttribute('data-rate')) || 500;
    var opts = $$('[data-calc-course]', calc);
    var range = $('[data-calc-range]', calc);
    var cta = $('[data-calc-cta]', calc);
    var course = opts[0].getAttribute('data-calc-course');
    var qs = params.get('kursus');
    if (qs && opts.some(function (o) { return o.getAttribute('data-calc-course') === qs; })) course = qs;
    var q = parseInt(params.get('deltagere'), 10);
    if (q >= 8 && q <= 20) range.value = q;
    var update = function () {
      var o = opts.filter(function (x) { return x.getAttribute('data-calc-course') === course; })[0];
      var n = Number(range.value);
      var per = Number(o.getAttribute('data-hours')) * rate;
      var total = per * n;
      opts.forEach(function (x) { x.setAttribute('aria-pressed', x === o ? 'true' : 'false'); });
      $('[data-calc-n]', calc).textContent = n;
      $('[data-calc-per]', calc).textContent = fmt(per);
      $('[data-calc-vat]', calc).textContent = fmt(total * 0.25);
      $('[data-calc-total]', calc).textContent = fmt(total);
      cta.href = '/kontakt/?interesse=' + course + '&deltagere=' + n;
    };
    opts.forEach(function (o) { o.addEventListener('click', function () { course = o.getAttribute('data-calc-course'); update(); }); });
    range.addEventListener('input', update);
    update();
  }

  /* ---- Formularer: fetch med JSON, ellers almindelig POST ---- */
  var wire = function (form, opts) {
    if (!window.fetch || !window.FormData) return;
    var status = $('[data-status]', form);
    var button = $('button[type="submit"]', form);
    var say = function (text, ok) { status.textContent = text; status.className = 'status ' + (ok ? 'status--ok' : 'status--error'); };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      button.disabled = true;
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok) { form.reset(); opts.done(data); } else { say(data.message || 'Noget gik galt. Prøv igen om lidt.', false); }
        })
        .catch(function () { say('Noget gik galt. Prøv igen om lidt.', false); })
        .then(function () { button.disabled = false; });
    });
  };

  var cf = $('[data-contact-form]');
  if (cf) {
    var thanks = $('[data-contact-thanks]');
    var showThanks = function (on) { thanks.hidden = !on; cf.hidden = on; if (on) thanks.scrollIntoView({ block: 'center' }); };
    var interest = params.get('interesse');
    if (interest && $('option[value="' + interest.replace(/[^a-z]/g, '') + '"]', cf)) cf.elements.interest.value = interest.replace(/[^a-z]/g, '');
    var part = parseInt(params.get('deltagere'), 10);
    if (part > 0) cf.elements.participants.value = part;
    if (params.get('sendt') === '1') showThanks(true);
    wire(cf, { done: function () { showThanks(true); } });
    $('[data-contact-reset]').addEventListener('click', function (e) {
      e.preventDefault(); showThanks(false);
      if (history.replaceState) history.replaceState(null, '', '/kontakt/');
    });
  }

  $$('[data-nl-form]').forEach(function (form) {
    var wrap = form.parentNode;
    wire(form, { done: function (d) {
      var t = $('[data-nl-thanks]', wrap);
      if (d.message) $('strong', t).textContent = d.message;
      t.hidden = false; form.hidden = true;
    } });
  });
})();
