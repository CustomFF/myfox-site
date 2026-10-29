// myfox.in: one address for both the site and `curl -sL myfox.in | sh`.
// Browsers get the GitHub Pages site, curl/wget on the root get get.sh.

import ERROR_PAGE from "./error.html";

const SITE = "https://customff.github.io/myfox-site";
const GET_SH = "https://raw.githubusercontent.com/CustomFF/myfox/master/get.sh";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname === "www.myfox.in") {
      return Response.redirect("https://myfox.in" + url.pathname + url.search, 301);
    }
    const ua = request.headers.get("User-Agent") || "";

    if (url.pathname === "/" && /^(curl|wget)\//i.test(ua)) {
      return script();
    }
    return site(request, url);
  },
};

async function script() {
  const r = await fetch(GET_SH, { cf: { cacheTtl: 300 } }).catch(() => null);
  if (!r || !r.ok) {
    return new Response(`echo "MyFox: get.sh is unavailable (${r ? "HTTP " + r.status : "no answer"})" >&2; exit 1\n`, {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(r.body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-cache",
      vary: "User-Agent",
    },
  });
}

async function site(request, url) {
  const r = await fetch(SITE + url.pathname + url.search, {
    method: request.method,
    headers: request.headers,
    redirect: "manual",
  }).catch(() => null);
  // Pages is down: nothing can be loaded from it, so the page is built into the Worker.
  if (!r || r.status >= 500) {
    return new Response(ERROR_PAGE, {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "retry-after": "300" },
    });
  }
  const headers = new Headers(r.headers);
  // Pages redirects to its own host (/img -> /img/); keep the visitor on myfox.in.
  const location = headers.get("location");
  if (location && location.startsWith(SITE)) {
    headers.set("location", location.slice(SITE.length) || "/");
  }
  if (url.pathname === "/") headers.append("vary", "User-Agent");
  return new Response(r.body, { status: r.status, headers });
}
