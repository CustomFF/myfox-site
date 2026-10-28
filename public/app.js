(function () {
  var root = document.documentElement;
  var BASE = "curl -sL myfox.in | sh";
  var dark = window.matchMedia("(prefers-color-scheme: dark)");

  function store(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  function theme() { return root.dataset.theme || (dark.matches ? "dark" : "light"); }

  // Before / after screenshots follow the page language and theme.
  // Each slider takes its pictures from the folder in data-dir.
  var compares = Array.prototype.slice.call(document.querySelectorAll(".compare"));
  function syncShots() {
    compares.forEach(function (c) {
      var name = c.dataset.dir + root.dataset.lang + "-" + theme() + "-";
      c.querySelector(".before").src = name + "before.webp";
      c.querySelector(".after").src = name + "after.webp";
    });
    document.querySelectorAll("img[data-part]").forEach(function (img) {
      img.src = "img/parts/" + img.dataset.part + "-" + root.dataset.lang + "-" + theme() + (img.dataset.k ? "-" + img.dataset.k : "") + ".webp";
    });
  }
  function slider(c) {
    var input = c.querySelector("input");
    var tagL = c.querySelector(".tag.l"), tagR = c.querySelector(".tag.r");
    var side = c.closest("[data-side]");
    function sync() {
      var x = Number(input.value);
      c.style.setProperty("--x", x + "%");
      if (side) side.dataset.side = x >= 50 ? "before" : "after";
      // A label fades out once its side is too narrow to hold it.
      tagL.style.opacity = Math.max(0, Math.min(1, (x - 8) / 10));
      tagR.style.opacity = Math.max(0, Math.min(1, (92 - x) / 10));
    }
    input.addEventListener("input", sync);
    sync();
    return sync;
  }
  var syncs = compares.map(slider);
  var range = document.getElementById("compare-range");
  var syncRange = syncs[compares.indexOf(document.getElementById("compare"))];

  // One peek on load, so it is clear the picture moves.
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var touched = false;
    range.addEventListener("pointerdown", function () { touched = true; });
    var start = null, from = Number(range.value);
    setTimeout(function () {
      requestAnimationFrame(function step(t) {
        if (touched) return;
        if (start === null) start = t;
        var k = Math.min((t - start) / 1600, 1);
        range.value = from - 22 * Math.sin(Math.PI * k);
        syncRange();
        if (k < 1) requestAnimationFrame(step);
      });
    }, 700);
  }

  document.getElementById("lang-btn").addEventListener("click", function () {
    var lang = root.dataset.lang === "ru" ? "en" : "ru";
    root.dataset.lang = lang; root.lang = lang;
    store("lang", lang);
    syncShots();
  });
  document.getElementById("theme-btn").addEventListener("click", function () {
    var next = theme() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    store("theme", next);
    syncShots();
  });
  dark.addEventListener("change", syncShots);
  syncShots();

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
  // Sections turn vertically; the slides of a group (the demo) turn sideways.
  var sections = Array.prototype.slice.call(track.children);
  function place() {
    var p = pages[at];
    var group = p.closest(".sp-group");
    var sec = sections.indexOf(group || p);
    track.style.transform = deckQuery.matches ? "translateY(" + (-100 * sec) + "%)" : "";
    document.querySelectorAll(".sp-group").forEach(function (g) {
      var strip = g.querySelector(".strip");
      var own = Array.prototype.slice.call(strip.children);
      var k = g === group ? own.indexOf(p) : (sections.indexOf(g) < sec ? own.length - 1 : 0);
      strip.style.transform = deckQuery.matches ? "translateX(" + (-100 * k) + "%)" : "";
      g.querySelector(".side.prev").disabled = g === group && k === 0;
      g.querySelector(".side.next").disabled = g === group && k === own.length - 1;
    });
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
    if (!deckQuery.matches || t0 === null || e.target.closest(".compare")) { t0 = null; return; }
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
