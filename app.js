/* ─── État ───────────────────────────────────────────────────────────── */
let slides        = [];
let current       = 0;
let transitioning = false;
let autoTimer     = null;

const AUTO_DELAY = 5000; /* ms entre chaque slide automatique */

/* ─── Init ───────────────────────────────────────────────────────────── */
async function init() {
  try {
    const res = await fetch('slides.json');
    slides = await res.json();
  } catch (e) {
    console.error('Impossible de charger slides.json', e);
    return;
  }

  if (!slides.length) return;

  const container = document.getElementById('slides-container');

  /* Créer les slides */
  slides.forEach((slide, i) => {
    const el = document.createElement('div');
    el.className = 'slide' + (i === 0 ? ' active' : '');
    el.style.backgroundImage = `url('${slide.image}')`;
    container.appendChild(el);
  });

  /* Afficher la légende initiale */
  updateCaption(0, false);

  /* Démarrer l'avance automatique */
  startAuto();

  /* ─── Écouteurs ──────────────────────────────────────────────────── */

  /* Clic sur les zones gauche / droite + flèches visibles */
  document.getElementById('nav-prev').addEventListener('click',   () => { resetAuto(); navigate(-1); });
  document.getElementById('nav-next').addEventListener('click',   () => { resetAuto(); navigate(1);  });
  document.getElementById('arrow-prev').addEventListener('click', () => { resetAuto(); navigate(-1); });
  document.getElementById('arrow-next').addEventListener('click', () => { resetAuto(); navigate(1);  });

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { resetAuto(); navigate(-1); }
    if (e.key === 'ArrowRight') { resetAuto(); navigate(1);  }
  });

  /* Swipe tactile */
  let touchStartX = 0;
  document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 48) { resetAuto(); navigate(dx < 0 ? 1 : -1); }
  }, { passive: true });

  /* Clavier */
}

/* ─── Navigation ─────────────────────────────────────────────────────── */
function navigate(dir) {
  if (transitioning || slides.length <= 1) return;
  transitioning = true;

  const slideEls = document.querySelectorAll('.slide');

  /* Sortie de l'ancienne slide */
  slideEls[current].classList.remove('active');

  /* Calcul du nouvel index (boucle infinie) */
  current = (current + dir + slides.length) % slides.length;

  /* Entrée de la nouvelle slide */
  slideEls[current].classList.add('active');

  /* Mise à jour légende */
  updateCaption(current, true);

  /* Dévérouiller après la transition CSS (0.9s) */
  setTimeout(() => { transitioning = false; }, 900);
}

/* ─── Légende ────────────────────────────────────────────────────────── */
function updateCaption(index, animate) {
  const captionEl = document.getElementById('caption');
  const data      = slides[index];
  const line1     = (data.caption && data.caption[0]) || '';
  const line2     = (data.caption && data.caption[1]) || '';

  if (animate) {
    /* Fade out, swap texte, fade in */
    captionEl.classList.remove('visible');
    setTimeout(() => {
      setCaption(line1, line2);
      captionEl.classList.add('visible');
    }, 220);
  } else {
    setCaption(line1, line2);
    /* Petit délai pour que la transition CSS s'initialise */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => captionEl.classList.add('visible'));
    });
  }
}

function setCaption(line1, line2) {
  document.getElementById('caption-line1').textContent = line1;
  document.getElementById('caption-line2').textContent = line2;
}

/* ─── Slideshow automatique ──────────────────────────────────────────── */
function startAuto() {
  if (slides.length <= 1) return;
  autoTimer = setInterval(() => navigate(1), AUTO_DELAY);
}

function resetAuto() {
  clearInterval(autoTimer);
  startAuto(); /* repart de zéro après une action manuelle */
}

/* ─── Lancement ──────────────────────────────────────────────────────── */
init();
