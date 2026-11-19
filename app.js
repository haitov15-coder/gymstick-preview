// Gymstick, the second design: the prototype's behaviour. A classic script on purpose, so the pages also
// work when opened straight from the disk. Buying and the cart are demonstrations.
(function () {
  'use strict';

  // The five real kits and their resistance ranges, from the product poster.
  var LEVELS = {
    light: { name: 'Light', colour: 'ירוק', hex: '#3fae40', kg: '1–10', shots: [['ready-bag.webp', 'מתאמנת נושאת על הכתף תיק Gymstick ירוק ומזרן אימון']] },
    medium: { name: 'Medium', colour: 'כחול', hex: '#1f5fd0', kg: '1–15', shots: [['move-lunge.webp', 'מתאמנת במכרע רחב, מוט Gymstick כחול על הכתפיים']] },
    strong: { name: 'Strong', colour: 'שחור', hex: '#1c1b1a', kg: '1–20', shots: [['hero-curl.webp', 'מאמן מכופף מרפקים עם מוט Gymstick שחור, הגומיות מתוחות אל כפות הרגליים']] },
    extra: { name: 'Extra Strong', colour: 'כסוף', hex: '#a9adb2', kg: '1–25', shots: [] },
    super: { name: 'Super Strong', colour: 'זהב', hex: '#b99547', kg: '1–30', shots: [] }
  };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* storage is off: the demo still runs */ } }
  };
  var swapImage = function (img, src, alt) {
    if (!img || img.getAttribute('src') === src) { if (img) img.alt = alt; return; }
    img.classList.add('is-swapping');
    var next = new Image();
    next.onload = next.onerror = function () { img.src = src; img.alt = alt; img.classList.remove('is-swapping'); };
    next.src = src;
  };

  // ---- draft marks: shown by default, one button hides them to see the clean design ----
  var draftBtn = $('[data-draft-toggle]');
  var setDraft = function (hidden) {
    document.documentElement.classList.toggle('no-draft', hidden);
    if (draftBtn) {
      draftBtn.setAttribute('aria-pressed', String(hidden));
      draftBtn.textContent = hidden ? 'הצגת סימוני הטיוטה' : 'הסתרת סימוני הטיוטה';
    }
    store.set('gs-draft-hidden', hidden ? '1' : '0');
  };
  if (draftBtn) {
    draftBtn.addEventListener('click', function () { setDraft(!document.documentElement.classList.contains('no-draft')); });
    // ?draft=off opens the page without the marks, for sharing a clean view
    if (/[?&]draft=off/.test(location.search) || store.get('gs-draft-hidden') === '1') setDraft(true);
  }

  // ---- the phone menu: a panel under the header, closed by a choice, Escape or a second press ----
  var menuBtn = $('[data-menu]');
  var setMenu = function (open) {
    document.documentElement.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'סגירת התפריט' : 'תפריט');
  };
  if (menuBtn) {
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    $$('#nav a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); } });
  }

  // ---- the cart (a demonstration: a count that lasts for the visit, and a line that says so) ----
  var cartBtn = $('[data-cart]');
  var cartCount = $('[data-cart-count]');
  var cartStatus = $('[data-cart-status]');
  var statusTimer;
  var count = parseInt(store.get('gs-cart') || '0', 10) || 0;
  var paintCart = function () {
    if (!cartCount) return;
    cartCount.textContent = count;
    cartCount.setAttribute('data-count', count);
    cartBtn.setAttribute('aria-label', 'סל הקניות, ' + count + ' פריטים');
  };
  var say = function (text) {
    if (!cartStatus) return;
    $('p', cartStatus).textContent = text;
    cartStatus.hidden = false;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { cartStatus.hidden = true; }, 6000);
  };
  paintCart();
  if (cartBtn) {
    cartBtn.addEventListener('click', function () {
      say(count ? 'בסל ' + count + ' פריטים. זו הדגמה: עדיין אין תהליך תשלום.' : 'הסל ריק. זו הדגמה: עדיין אין תהליך תשלום.');
    });
  }

  // ---- the hero's film. It runs in a loop on every screen (the upright cut on an upright screen) and
  // starts without sound, because browsers start nothing else on their own; its two buttons stop it and
  // turn the sound on. It rests while the hero is off the screen. A visitor whose system asks for less
  // motion gets the still picture, and the film only if they press play. ----
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var heroFilm = $('.hero__video');
  var heroPlay = $('[data-hero-play]');
  var heroSound = $('[data-hero-sound]');
  if (heroFilm && heroPlay && heroSound) {
    var heroStopped = calm;   // the visitor's own choice, kept apart from the pauses the page makes
    var heroSeen = true;
    var uprightScreen = window.matchMedia('(max-aspect-ratio: 4/5)');
    var heroCut = function () { return uprightScreen.matches ? heroFilm.dataset.tall : heroFilm.dataset.wide; };
    var syncHero = function () {
      if (heroStopped || !heroSeen || document.hidden) {
        if (heroFilm.getAttribute('src')) heroFilm.pause();
      } else {
        if (!heroFilm.getAttribute('src')) heroFilm.src = heroCut();
        if (heroFilm.paused) {
          var started = heroFilm.play();
          if (started && started.catch) started.catch(function () {
            // a start with sound that the browser refuses falls back to a silent one
            if (!heroFilm.muted) { heroFilm.muted = true; syncHero(); }
          });
        }
      }
      heroPlay.textContent = heroStopped ? 'הפעלה' : 'עצירה';
      heroSound.textContent = heroFilm.muted ? 'הפעלת קול' : 'השתקה';
    };
    heroPlay.addEventListener('click', function () { heroStopped = !heroStopped; syncHero(); });
    heroSound.addEventListener('click', function () {
      heroFilm.muted = !heroFilm.muted;
      if (!heroFilm.muted) heroStopped = false;   // asking for the sound also asks for the film
      syncHero();
    });
    // a start the browser refused (a hidden or sleeping window) is tried again when the film can play,
    // when the page is seen again, and on the first touch
    heroFilm.addEventListener('canplay', syncHero);
    document.addEventListener('visibilitychange', syncHero);
    window.addEventListener('pointerdown', syncHero, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { heroSeen = entries[0].isIntersecting; syncHero(); }, { threshold: 0.15 }).observe(heroFilm);
    }
    // a turned phone or a reshaped window changes the cut; both cuts share one clock, so the film goes on
    // from the same moment
    var recut = function () {
      if (!heroFilm.getAttribute('src') || heroFilm.getAttribute('src') === heroCut()) return;
      var at = heroFilm.currentTime;
      heroFilm.addEventListener('loadedmetadata', function () { heroFilm.currentTime = at; }, { once: true });
      heroFilm.src = heroCut();
      syncHero();
    };
    if (uprightScreen.addEventListener) uprightScreen.addEventListener('change', recut); else uprightScreen.addListener(recut);
    $('[data-hero-controls]').hidden = false;
    syncHero();
  }
  // ---- the exercise library: one filter, by the part of the body ----
  var filters = $('[data-filters]');
  if (filters) {
    var cards = $$('[data-vids] > li');
    var countLine = $('[data-filter-count]');
    filters.addEventListener('change', function () {
      var area = filters.elements['f-area'].value;
      var shown = 0;
      cards.forEach(function (card) {
        var ok = area === 'all' || card.dataset.area === area;
        card.hidden = !ok;
        if (ok) shown += 1;
      });
      countLine.textContent = shown === 1 ? 'מוצגת הדגמה אחת' : 'מוצגות ' + shown + ' הדגמות';
    });
  }

  // ---- the maker's videos: a card plays its video in a window on the page. YouTube's player needs a page
  // with a web address, so when the page is opened as a file the card's own link opens YouTube instead. ----
  var vids = $$('a[data-yt]');
  if (vids.length && /^https?:$/.test(location.protocol) && window.HTMLDialogElement) {
    var player = document.createElement('dialog');
    player.className = 'player';
    player.setAttribute('aria-labelledby', 'player-title');
    player.innerHTML = '<div class="player__bar"><h2 class="player__title" id="player-title"></h2>' +
      '<button class="player__close" type="button">סגירה</button></div>' +
      '<div class="player__frame"></div><p class="player__note">סרטון הדרכה של Gymstick, מוצג דרך יוטיוב.</p>';
    document.body.appendChild(player);
    var playerTitle = $('.player__title', player);
    var playerFrame = $('.player__frame', player);
    // closing by the button, by Escape or by a click outside all end here, and the video stops
    player.addEventListener('close', function () { playerFrame.textContent = ''; });
    player.addEventListener('click', function (ev) { if (ev.target === player) player.close(); });
    $('.player__close', player).addEventListener('click', function () { player.close(); });
    vids.forEach(function (link) {
      link.addEventListener('click', function (ev) {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return; // a new tab asked for on purpose
        ev.preventDefault();
        var name = $('.vid__title', link).textContent;
        var frame = document.createElement('iframe');
        frame.title = name;
        frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        frame.allowFullscreen = true;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.src = 'https://www.youtube-nocookie.com/embed/' + link.dataset.yt + '?autoplay=1&rel=0&playsinline=1';
        playerTitle.textContent = name;
        playerFrame.textContent = '';
        playerFrame.appendChild(frame);
        player.showModal();
      });
    });
  }

  // ---- choosing a kit on the home page ----
  var kits = $('[data-kits]');
  if (kits) {
    var paintKit = function (id) {
      var L = LEVELS[id];
      if (!L) return;
      $('[data-kit-name]', kits).textContent = L.name;
      $('[data-kit-kg]', kits).textContent = L.kg;
      $('[data-kit-colour]', kits).textContent = L.colour;
      $('[data-kit-link]', kits).href = 'product.html?level=' + id;
      swapImage($('[data-kit-img]', kits), 'img/kit-' + id + '-angle.webp', 'ערכת Gymstick Original בדרגת ' + L.name + ', בצבע ' + L.colour);
    };
    kits.addEventListener('change', function (e) { if (e.target.name === 'kit') paintKit(e.target.value); });
  }

  // ---- the product page ----
  var buy = $('[data-buy]');
  if (buy) {
    var stage = $('[data-gallery-img]');
    var thumbs = $('[data-thumbs]');
    var counter = $('[data-gallery-count]');
    var current = 'medium';
    var slides = [];
    var at = 0;

    var show = function (i) {
      at = (i + slides.length) % slides.length;
      var s = slides[at];
      stage.classList.toggle('is-cover', !!s.cover);
      swapImage(stage, s.src, s.alt);
      counter.textContent = (at + 1) + ' / ' + slides.length;
      $$('.thumb', thumbs).forEach(function (t, k) { t.setAttribute('aria-current', String(k === at)); });
    };
    var buildGallery = function (id) {
      var L = LEVELS[id];
      slides = [
        { src: 'img/kit-' + id + '-angle.webp', alt: 'ערכת Gymstick Original בדרגת ' + L.name + ', בצבע ' + L.colour + ': המוט, הגומיות והלולאות' },
        { src: 'img/kit-' + id + '-flat.webp', alt: 'המוט בדרגת ' + L.name + ' מהצד, לכל אורכו, עם שתי הגומיות' },
        { src: 'img/detail-lock.webp', alt: 'כפתור הנעילה שמחבר את שני חלקי המוט (מצולם בערכה הכחולה)' },
        { src: 'img/detail-loop.webp', alt: 'הלולאה לכף הרגל בקצה הגומייה (מצולמת בערכה הכחולה)' }
      ].concat(L.shots.map(function (s) { return { src: 'img/' + s[0], alt: s[1], cover: true }; }));
      thumbs.innerHTML = '';
      slides.forEach(function (s, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'thumb';
        b.setAttribute('aria-label', 'תמונה ' + (i + 1) + ' מתוך ' + slides.length);
        var im = document.createElement('img');
        im.src = s.src; im.alt = ''; im.loading = 'lazy';
        b.appendChild(im);
        b.addEventListener('click', function () { show(i); });
        thumbs.appendChild(b);
      });
      show(0);
    };
    var paintLevel = function (id) {
      var L = LEVELS[id];
      if (!L) return;
      current = id;
      $$('[data-level-name]').forEach(function (el) { el.textContent = L.name; });
      $$('[data-level-kg]').forEach(function (el) { el.textContent = L.kg; });
      $$('[data-level-colour]').forEach(function (el) { el.textContent = L.colour; });
      var radio = $('input[name="level"][value="' + id + '"]', buy);
      if (radio) radio.checked = true;
      buildGallery(id);
      try { history.replaceState(null, '', 'product.html?level=' + id); } catch (e) { /* opened from the disk in a strict browser */ }
    };
    buy.addEventListener('change', function (e) { if (e.target.name === 'level') paintLevel(e.target.value); });
    $('[data-gallery-prev]').addEventListener('click', function () { show(at - 1); });
    $('[data-gallery-next]').addEventListener('click', function () { show(at + 1); });
    $('[data-gallery]').addEventListener('keydown', function (e) {
      // right to left: the left arrow goes on, the right arrow goes back
      if (e.key === 'ArrowLeft') show(at + 1);
      if (e.key === 'ArrowRight') show(at - 1);
    });

    // quantity
    var qtyOut = $('[data-qty]');
    var qty = 1;
    var setQty = function (n) { qty = Math.min(9, Math.max(1, n)); qtyOut.textContent = qty; };
    $('[data-qty-less]').addEventListener('click', function () { setQty(qty - 1); });
    $('[data-qty-more]').addEventListener('click', function () { setQty(qty + 1); });

    // add to cart (a demonstration)
    var buyStatus = $('[data-buy-status]');
    var add = function () {
      count += qty;
      store.set('gs-cart', String(count));
      paintCart();
      var line = 'נוספו לסל ' + qty + ' × ערכת ⁨' + LEVELS[current].name + '⁩. זו הדגמה: עדיין אין תהליך תשלום.';
      buyStatus.textContent = line;
      say(line);
    };
    $$('[data-add]').forEach(function (b) { b.addEventListener('click', add); });

    // the fixed buy bar on a phone: only while the main button is off the screen
    var bar = $('[data-buybar]');
    var mainBtn = $('[data-add-main]');
    if (bar && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        bar.classList.toggle('is-on', !entries[0].isIntersecting);
      }, { threshold: 0 }).observe(mainBtn);
    }

    var fromUrl = (location.search.match(/[?&]level=([a-z]+)/) || [])[1];
    paintLevel(LEVELS[fromUrl] ? fromUrl : 'medium');
  }
})();
