// myfox.in: one address for the site, `curl -sL myfox.in | sh` and `irm myfox.in | iex`.
// Browsers get the GitHub Pages site, curl/wget on the root get the banner script,
// which then fetches get.sh from /get, PowerShell on the root gets get.ps1.

import ERROR_PAGE from "./error.html";
import BANNER from "./banner.txt";

const SITE = "https://customff.github.io/myfox-site";
const GET_SH = "https://raw.githubusercontent.com/CustomFF/myfox/master/get.sh";
const GET_PS1 = "https://raw.githubusercontent.com/CustomFF/myfox/master/get.ps1";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "www.myfox.in") {
      return Response.redirect("https://myfox.in" + url.pathname + url.search, 301);
    }
    const ua = request.headers.get("User-Agent") || "";

    const tool = ua.match(/^(curl|wget)\//i);
    // banner = the script was downloaded, run = it ran and asked for get.sh.
    if (tool && url.pathname === "/") {
      count(env, request, "banner", tool[1].toLowerCase());
      return script();
    }
    if (tool && url.pathname === "/get") {
      count(env, request, "run", tool[1].toLowerCase());
      return fromGitHub(GET_SH);
    }
    // Both send a Mozilla/5.0 User-Agent ending in WindowsPowerShell/5.1 or PowerShell/7.
    if (url.pathname === "/" && /PowerShell\//i.test(ua)) {
      count(env, request, "banner", "powershell");
      return fromGitHub(GET_PS1, { vary: "User-Agent" });
    }
    return site(request, url, env);
  },
};

// One point per request. The network owner and the full User-Agent tell bots on hosting from people at home.
function count(env, request, kind, what, extra = []) {
  env.INSTALLS?.writeDataPoint({
    indexes: [kind],
    blobs: [
      what,
      request.cf?.country || "",
      request.headers.get("CF-Connecting-IP") || "",
      request.cf?.asOrganization || "",
      request.headers.get("User-Agent") || "",
      ...extra,
    ],
    doubles: [1],
  });
}

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

// An install script from GitHub through myfox.in, so that its download is counted.
async function fromGitHub(script, extra = {}) {
  const headers = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache", ...extra };
  const r = await fetch(script).catch(() => null);
  if (!r || !r.ok) return new Response("The install script is unavailable\n", { status: 502, headers });
  return new Response(r.body, { headers });
}

async function site(request, url, env) {
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
  // Page views, counted here rather than by a script in the page, so blockers don't hide them.
  // Pictures, styles and scripts are not pages: only requests for HTML are counted.
  const html = (request.headers.get("Accept") || "").includes("text/html") || (r.headers.get("content-type") || "").startsWith("text/html");
  if (request.method === "GET" && html) {
    count(env, request, "page", url.pathname, [request.headers.get("Referer") || "", String(r.status)]);
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
