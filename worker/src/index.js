// myfox.in: one address for both the site and `curl -sL myfox.in | sh`.
// Browsers get the GitHub Pages site, curl/wget on the root get the banner script,
// which then fetches get.sh from /get.

import ERROR_PAGE from "./error.html";
import BANNER from "./banner.txt";

const SITE = "https://customff.github.io/myfox-site";
const GET_SH = "https://raw.githubusercontent.com/CustomFF/myfox/master/get.sh";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "www.myfox.in") {
      return Response.redirect("https://myfox.in" + url.pathname + url.search, 301);
    }
    const ua = request.headers.get("User-Agent") || "";

    const tool = ua.match(/^(curl|wget)\//i);
    // One point per request, no IP: banner = the script was downloaded, run = it ran and asked for get.sh.
    const count = (kind) => env.INSTALLS?.writeDataPoint({
      indexes: [kind],
      blobs: [tool[1].toLowerCase(), request.cf?.country || ""],
      doubles: [1],
    });
    if (tool && url.pathname === "/") {
      count("banner");
      return script();
    }
    if (tool && url.pathname === "/get") {
      count("run");
      return getSh();
    }
    return site(request, url);
  },
};

// Read without `| sh` it is a page to look at: the banner as comments and one line that runs get.sh.
function script() {
  const banner = BANNER.trimEnd().split("\n").map((l) => ("# " + l).trimEnd()).join("\n");
  return new Response(`#!/bin/sh\n${banner}\n#\n\ncurl -fsSL https://myfox.in/get | sh -s -- "$@"\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-cache",
      vary: "User-Agent",
    },
  });
}

// get.sh from GitHub through myfox.in, so a run is counted apart from a look at the banner.
async function getSh() {
  const r = await fetch(GET_SH).catch(() => null);
  if (!r || !r.ok) return new Response("get.sh is unavailable\n", { status: 502 });
  return new Response(r.body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache" },
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
