(function () {
  'use strict';

  // Nav scroll + mobile menu
  var nav = document.getElementById('nav');
  var navToggle = document.getElementById('navToggle');
  var navMobile = document.getElementById('navMobile');
  var iconMenu = document.getElementById('iconMenu');
  var iconClose = document.getElementById('iconClose');

  function updateNavScroll() {
    if (window.scrollY > 50) nav.classList.add('nav-scrolled');
    else nav.classList.remove('nav-scrolled');
  }
  window.addEventListener('scroll', updateNavScroll);
  updateNavScroll();

  if (navToggle && navMobile) {
    navToggle.addEventListener('click', function () {
      var open = navMobile.classList.toggle('open');
      if (iconMenu && iconClose) {
        iconMenu.style.display = open ? 'none' : 'block';
        iconClose.style.display = open ? 'block' : 'none';
      }
    });
    navMobile.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navMobile.classList.remove('open');
        if (iconMenu && iconClose) {
          iconMenu.style.display = 'block';
          iconClose.style.display = 'none';
        }
      });
    });
  }

  // Quote form steps
  var quoteStep1 = document.getElementById('quoteStep1');
  var quoteStep2 = document.getElementById('quoteStep2');
  var quoteStep3 = document.getElementById('quoteStep3');
  var quoteDone = document.getElementById('quoteDone');
  var quoteProgress = document.getElementById('quoteProgress');
  var quoteZip = document.getElementById('quoteZip');
  var quoteName = document.getElementById('quoteName');
  var quotePhone = document.getElementById('quotePhone');
  var btnContinue1 = document.getElementById('btnContinue1');
  var btnSubmit = document.getElementById('btnSubmit');
  var roofBtns = document.querySelectorAll('.quote-roof-btn');

  function showStep(step) {
    [quoteStep1, quoteStep2, quoteStep3, quoteDone].forEach(function (el) {
      if (!el) return;
      el.setAttribute('data-hidden', 'true');
    });
    var progressSpans = quoteProgress ? quoteProgress.querySelectorAll('span') : [];
    progressSpans.forEach(function (s, i) { s.classList.toggle('active', i < step); });
    if (step === 1 && quoteStep1) quoteStep1.removeAttribute('data-hidden');
    if (step === 2 && quoteStep2) quoteStep2.removeAttribute('data-hidden');
    if (step === 3 && quoteStep3) quoteStep3.removeAttribute('data-hidden');
    if (step === 4 && quoteDone) quoteDone.removeAttribute('data-hidden');
  }

  if (quoteZip && btnContinue1) {
    quoteZip.addEventListener('input', function () {
      btnContinue1.disabled = quoteZip.value.replace(/\D/g, '').length < 5;
    });
    btnContinue1.addEventListener('click', function () {
      if (quoteZip.value.replace(/\D/g, '').length >= 5) showStep(2);
    });
  }

  if (roofBtns.length) {
    roofBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        roofBtns.forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        showStep(3);
      });
    });
  }

  if (btnSubmit) {
    btnSubmit.addEventListener('click', function () {
      if (!quoteName || !quotePhone) return;
      if (!quoteName.value.trim() || !quotePhone.value.trim()) return;
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Sending...';
      setTimeout(function () {
        showStep(4);
      }, 1200);
    });
  }

  // Process line fill on scroll
  var processLineFill = document.getElementById('processLineFill');
  var processSection = document.getElementById('process');
  if (processLineFill && processSection) {
    function updateProcessLine() {
      var rect = processSection.getBoundingClientRect();
      var viewH = window.innerHeight;
      var start = viewH * 0.8;
      var end = rect.height * 0.6;
      var progress = rect.top < start ? Math.min(1, (start - rect.top) / (rect.height * 0.6)) : 0;
      processLineFill.style.transform = 'scaleY(' + progress + ')';
    }
    window.addEventListener('scroll', updateProcessLine);
    window.addEventListener('resize', updateProcessLine);
    updateProcessLine();
  }

  // Optional: count-up for stats when in view
  var statValues = document.querySelectorAll('.why-stat-value[data-count]');
  function animateValue(el, target, duration) {
    var start = 0;
    var startTime = null;
    function step(now) {
      if (!startTime) startTime = now;
      var progress = Math.min((now - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var val = Math.round(eased * target);
      el.textContent = val + (el.dataset.suffix || '+');
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function checkStats() {
    statValues.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 100 && !el.dataset.animated) {
        el.dataset.animated = '1';
        var target = parseInt(el.dataset.count, 10) || 0;
        animateValue(el, target, 2000);
      }
    });
  }
  window.addEventListener('scroll', checkStats);
  checkStats();
})();
