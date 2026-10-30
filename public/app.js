(function () {
  var root = document.documentElement;
  var BASE = "curl -sL myfox.in | sh";
  var dark = window.matchMedia("(prefers-color-scheme: dark)");

  // A choice is remembered only when it differs from the system; picking the system
  // value again forgets it, and the page follows the system from then on.
  function store(key, value, system) {
    try {
      if (value === system) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) {}
  }
  function systemLang() { return /^ru|^uk|^be|^kk/i.test(navigator.language || "") ? "ru" : "en"; }
  function systemTheme() { return dark.matches ? "dark" : "light"; }
  function theme() { return root.dataset.theme || systemTheme(); }

  // Screenshots follow the page language and theme.
  function syncShots() {
    var tail = root.dataset.lang + "-" + theme();
    document.querySelectorAll("img[data-hero]").forEach(function (img) {
      img.src = "img/" + tail + "-" + img.dataset.hero + ".webp";
    });
    document.querySelectorAll("img[data-part]").forEach(function (img) {
      img.src = "img/parts/" + img.dataset.part + "-" + tail + (img.dataset.k ? "-" + img.dataset.k : "") + ".webp";
    });
  }

  function markLang() {
    var d = document.querySelector('meta[name="description"]');
    d.content = root.dataset.lang === "ru"
      ? "MyFox — инструментарий для установки и сопровождения официального Firefox с MyFox tweaks."
      : "MyFox is a toolkit for installing and maintaining the official Firefox with MyFox tweaks.";
  }
  markLang();

  // The language and theme buttons open menus, as on the MyFox toolbar; the current item is checked.
  function markMenus() {
    document.querySelectorAll(".menu [data-lang]").forEach(function (b) {
      b.setAttribute("aria-checked", String(b.dataset.lang === root.dataset.lang));
    });
    document.querySelectorAll(".menu [data-theme]").forEach(function (b) {
      b.setAttribute("aria-checked", String(b.dataset.theme === theme()));
    });
  }
  function closeMenus() {
    document.querySelectorAll(".pop > .tbtn").forEach(function (b) {
      b.setAttribute("aria-expanded", "false");
      b.nextElementSibling.hidden = true;
    });
  }
  document.querySelectorAll(".pop > .tbtn").forEach(function (btn) {
    var menu = btn.nextElementSibling;
    btn.addEventListener("click", function () {
      var open = menu.hidden;
      closeMenus();
      if (!open) return;
      markMenus();
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      (menu.querySelector('[aria-checked="true"]') || menu.firstElementChild).focus();
    });
    // Inside a menu the arrows move between its items and do not turn slides.
    menu.addEventListener("keydown", function (e) {
      var items = Array.prototype.slice.call(menu.children);
      var i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
      } else if (e.key === "Escape") {
        closeMenus(); btn.focus();
      } else if (e.key !== "Enter" && e.key !== " " && e.key !== "Tab") return;
      if (e.key !== "Tab") e.preventDefault();
      if (e.key === "Enter" || e.key === " ") document.activeElement.click();
      e.stopPropagation();
    });
  });
  addEventListener("pointerdown", function (e) { if (!e.target.closest(".pop")) closeMenus(); });
  addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenus(); });
  document.querySelectorAll(".menu [data-lang]").forEach(function (b) {
    b.addEventListener("click", function () {
      var lang = b.dataset.lang;
      root.dataset.lang = lang; root.lang = lang;
      store("lang", lang, systemLang());
      markLang();
      syncShots();
      closeMenus();
    });
  });
  document.querySelectorAll(".menu [data-theme]").forEach(function (b) {
    b.addEventListener("click", function () {
      var next = b.dataset.theme;
      if (next === systemTheme()) delete root.dataset.theme;
      else root.dataset.theme = next;
      store("theme", next, systemTheme());
      syncShots();
      closeMenus();
    });
  });
  dark.addEventListener("change", syncShots);
  syncShots();

  // Before / after: the handle follows the range under it; the label of a side that is
  // hidden behind the edge goes away. On load the handle swings once, to show it moves.
  document.querySelectorAll(".cmp").forEach(function (c) {
    var input = c.querySelector("input");
    function sync() {
      var x = Number(input.value);
      c.style.setProperty("--x", x + "%");
      c.dataset.edge = x < 12 ? "l" : x > 88 ? "r" : "";
    }
    input.addEventListener("input", sync);
    sync();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var touched = false, t0 = null;
    input.addEventListener("pointerdown", function () { touched = true; });
    setTimeout(function () {
      requestAnimationFrame(function step(t) {
        if (touched) return;
        if (t0 === null) t0 = t;
        var k = Math.min((t - t0) / 1800, 1);
        input.value = 50 + 22 * Math.sin(2 * Math.PI * k);
        sync();
        if (k < 1) requestAnimationFrame(step);
      });
    }, 900);
  });

  // Install mode switches the command everywhere it is shown.
  var modes = document.querySelectorAll("#install .mode");
  modes.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var args = btn.dataset.args;
      modes.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      document.querySelectorAll("#install .js-cmd").forEach(function (c) { c.textContent = BASE + args; });
      document.querySelectorAll(".mode-note").forEach(function (n) { n.hidden = n.dataset.mode !== args; });
    });
  });

  document.querySelectorAll(".copy").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var code = btn.parentNode.querySelector(".js-cmd");
      var label = btn.innerHTML;
      function done() {
        btn.innerHTML = '<span lang="ru">Скопировано</span><span lang="en">Copied</span>';
        setTimeout(function () { btn.innerHTML = label; }, 2000);
      }
      function select() {
        var r = document.createRange(); r.selectNodeContents(code);
        var s = getSelection(); s.removeAllRanges(); s.addRange(r);
      }
      if (navigator.clipboard) navigator.clipboard.writeText(code.textContent).then(done, select);
      else select();
    });
  });

  // Deck: on a big enough screen every slide fills the window, and the wheel,
  // the keys and a swipe turn slides. On a small screen it is a plain page.
  var deckQuery = matchMedia("(min-width: 900px) and (min-height: 560px)");
  var track = document.querySelector(".track");
  var pages = Array.prototype.slice.call(document.querySelectorAll(".sp"));
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var pager = document.querySelector(".pager");
  var at = 0, locked = false;
  var dots = pages.map(function (_, i) {
    var b = document.createElement("button");
    b.type = "button"; b.setAttribute("aria-label", String(i + 1));
    b.addEventListener("click", function () { go(i); });
    pager.appendChild(b);
    return b;
  });
  function mark(i) {
    var nav = pages[i].dataset.nav;
    document.getElementById("deck").dataset.section = nav;
    tabs.forEach(function (t) { t.classList.toggle("is-active", t.getAttribute("href") === "#" + nav); });
    dots.forEach(function (d, k) { d.setAttribute("aria-current", String(k === i)); });
    document.querySelector(".urlbar .path").textContent = nav === "top" ? "" : "/#" + nav;
  }
  // Sections turn vertically; the slides of a group (the demo) turn sideways,
  // the slides of a stack (the first section) dissolve one into the next.
  var sections = Array.prototype.slice.call(track.children);
  var shownSec = null, swapTimer = null;
  function place() {
    var p = pages[at];
    var group = p.closest(".sp-group");
    var sec = sections.indexOf(p.closest(".sp-group, .sp-stack") || p);
    var shift = deckQuery.matches ? "translateY(" + (-100 * sec) + "%)" : "";
    // Into and out of the opening stack the page does not slide: it dissolves the same way.
    var dissolve = deckQuery.matches && shownSec !== null && shownSec !== sec &&
      (sections[shownSec].matches(".sp-stack") || sections[sec].matches(".sp-stack"));
    shownSec = sec;
    clearTimeout(swapTimer);
    if (dissolve) {
      track.classList.add("swap");
      swapTimer = setTimeout(function () {
        track.style.transition = "none";
        track.style.transform = shift;
        void track.offsetHeight;
        track.style.transition = "";
        track.classList.remove("swap");
      }, 400);
    } else {
      track.classList.remove("swap");
      track.style.transform = shift;
    }
    document.querySelectorAll(".sp-stack").forEach(function (st) {
      var own = Array.prototype.slice.call(st.querySelectorAll(".sp"));
      var k = st.contains(p) ? own.indexOf(p) : (sections.indexOf(st) < sec ? own.length - 1 : 0);
      own.forEach(function (l, j) { l.classList.toggle("is-on", j === k); });
    });
    document.querySelectorAll(".sp-group").forEach(function (g) {
      var strip = g.querySelector(".strip");
      var own = Array.prototype.slice.call(strip.children);
      var k = g === group ? own.indexOf(p) : (sections.indexOf(g) < sec ? own.length - 1 : 0);
      strip.style.transform = deckQuery.matches ? "translateX(" + (-100 * k) + "%)" : "";
      own.forEach(function (l, j) { l.classList.toggle("is-on", j === k); });
    });
    // The arrows turn slides everywhere; they stop at the first and the last slide.
    document.querySelectorAll(".side.prev").forEach(function (b) { b.disabled = at === 0; });
    document.querySelectorAll(".side.next").forEach(function (b) { b.disabled = at === pages.length - 1; });
  }
  function go(i) {
    at = Math.max(0, Math.min(pages.length - 1, i));
    if (deckQuery.matches) place();
    else pages[at].scrollIntoView({ behavior: "smooth" });
    mark(at);
  }
  document.querySelectorAll(".side").forEach(function (b) {
    b.addEventListener("click", function () { go(at + (b.classList.contains("next") ? 1 : -1)); });
  });
  function step(dir) {
    if (locked) return;
    locked = true;
    setTimeout(function () { locked = false; }, 750);
    go(at + dir);
  }
  function setMode() {
    root.classList.toggle("deck-on", deckQuery.matches);
    place();
  }
  // Focus can scroll a clipped box; slides that do not scroll stay put.
  document.querySelectorAll(".sp, .sp-group, .deck").forEach(function (el) {
    el.addEventListener("scroll", function () {
      if (getComputedStyle(el).overflowY === "auto") return;
      el.scrollTop = 0; el.scrollLeft = 0;
    });
  });
  deckQuery.addEventListener("change", setMode);

  // When nothing happens for a while, the arrows blink to show the way on.
  var idleTimer = null;
  function awake() {
    root.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { root.classList.add("idle"); }, 4000);
  }
  ["wheel", "keydown", "pointerdown", "pointermove", "touchstart"].forEach(function (t) {
    addEventListener(t, awake, { passive: true });
  });
  awake();
  setMode();

  // A slide that scrolls inside (install) scrolls first, and turns at its edge.
  function scrollsInside(el, dir) {
    var box = el.closest(".sp");
    if (!box || getComputedStyle(box).overflowY !== "auto") return false;
    if (box.scrollHeight <= box.clientHeight + 1) return false;
    return dir > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 0;
  }
  addEventListener("wheel", function (e) {
    if (!deckQuery.matches) return;
    var horiz = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (horiz && !pages[at].closest(".sp-group")) return;
    var d = horiz ? e.deltaX : e.deltaY;
    var dir = d > 0 ? 1 : -1;
    if (scrollsInside(e.target, dir)) return;
    e.preventDefault();
    if (Math.abs(d) > 4) step(dir);
  }, { passive: false });
  addEventListener("keydown", function (e) {
    if (!deckQuery.matches || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    var dir = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (!dir && pages[at].closest(".sp-group")) dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (e.key === "Home") { go(0); e.preventDefault(); return; }
    if (e.key === "End") { go(pages.length - 1); e.preventDefault(); return; }
    if (!dir || scrollsInside(document.activeElement || document.body, dir)) return;
    e.preventDefault();
    step(dir);
  });
  var t0 = null;
  addEventListener("touchstart", function (e) { t0 = e.touches[0]; }, { passive: true });
  addEventListener("touchend", function (e) {
    if (!deckQuery.matches || t0 === null) { t0 = null; return; }
    var t1 = e.changedTouches[0];
    var dx = t0.clientX - t1.clientX, dy = t0.clientY - t1.clientY; t0 = null;
    var horiz = Math.abs(dx) > Math.abs(dy);
    if (horiz && !pages[at].closest(".sp-group")) return;
    var d = horiz ? dx : dy;
    if (Math.abs(d) > 50 && (horiz || !scrollsInside(e.target, d > 0 ? 1 : -1))) step(d > 0 ? 1 : -1);
  }, { passive: true });

  tabs.forEach(function (t) {
    t.addEventListener("click", function (e) {
      var nav = t.getAttribute("href").slice(1);
      var i = pages.findIndex(function (p) { return p.dataset.nav === nav; });
      if (i < 0) return;
      e.preventDefault();
      go(i);
    });
  });

  // On a plain page the slide in view marks its tab.
  addEventListener("scroll", function () {
    if (deckQuery.matches) return;
    var i = 0;
    pages.forEach(function (p, k) { if (p.getBoundingClientRect().top <= 120) i = k; });
    at = i; mark(i);
  }, { passive: true });

  var start = pages.findIndex(function (p) { return "#" + p.id === location.hash; });
  go(start > 0 ? start : 0);
})();
