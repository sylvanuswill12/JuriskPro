/* JuriskPro v41 — micro-interactions : retour tactile (vibration légère) et onde au toucher.
   Aucune dépendance. Tout est coupé quand le téléphone demande « réduire les animations ». */
(function () {
  'use strict';
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function vib(ms) {
    try { if (!reduce && navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }
  window.JPFx = { vib: vib };

  /* Onde au toucher sur les boutons, les onglets du formulaire et les puces. */
  document.addEventListener('pointerdown', function (e) {
    if (reduce) return;
    var b = e.target && e.target.closest && e.target.closest('.btn,.pane-switch button,.lb-chip');
    if (!b || b.disabled) return;
    var r = b.getBoundingClientRect();
    var s = Math.max(r.width, r.height) * 1.6;
    var x = document.createElement('span');
    x.className = 'jp-rip';
    x.setAttribute('aria-hidden', 'true');
    x.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
    b.appendChild(x);
    var done = function () { if (x.parentNode) x.parentNode.removeChild(x); };
    x.addEventListener('animationend', done);
    setTimeout(done, 900);
  }, { passive: true });

  /* Vibration brève au téléchargement. */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('#dl-pdf,#dl-docx');
    if (t && !t.disabled) vib(16);
  }, true);
})();
