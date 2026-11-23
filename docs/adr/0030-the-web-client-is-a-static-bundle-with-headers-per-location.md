# 30. The web client is a static bundle, with headers set per location

**Status** — accepted

Recorded retroactively.

The code this records lives in the `aicfes-frontend` repository, on
`main`. Line references below are to that repository.

## Context

The web client is a Vite build: HTML, hashed JS and CSS, no server-side
rendering. Something has to serve those files, decide what may be
cached, tell the browser where the API is, and set the security headers.

**A Node server alongside the bundle.** It would let the API origin be a
runtime variable, which is the one real advantage. The cost is a Node
process to run, patch and monitor in order to return files that never
change, plus an application-level dependency on the path of every asset
request.

**Static files behind nginx.** Chosen. No application process, and
nginx already does caching, compression and header rules.

## Decision

A two-stage image: `node:22-alpine` builds, and
`nginxinc/nginx-unprivileged:1.27-alpine` serves the result
(`Dockerfile:3,14-17`). Running unprivileged has a consequence worth
naming — nginx cannot write under `/var`, so every temporary path is
redirected to `/tmp` (`nginx.conf:19-25`).

**The API origin is baked in at build time.** `VITE_API_URL` is an
`ARG`, promoted to `ENV` for the build (`Dockerfile:10-11`), because a
static bundle has no server to read configuration from
(`Dockerfile:8-9`). The image is therefore per-environment, not
per-deploy.

**Caching splits by what the name promises.** Hashed assets under
`/assets/` never change under the same name, so they are held a year;
the entry document must not be, so it is `no-cache`
(`nginx.conf:39-44,47-52`). Unknown paths fall back to `index.html`
because a single-page app serves its own routes
(`nginx.conf:47-51`).

**The security headers live in an include, repeated per location.**
They began in the `server` block, which is where they belong by
instinct and where nginx discards them: an `add_header` in a nested
block drops every header inherited from its parent. Both locations
declared `Cache-Control`, so **none** of the security headers reached
any response (commit `3b89550`). They now sit in
`security-headers.conf`, which is `include`d inside each `location`
(`nginx.conf:42,50`) and carries a comment saying why it is duplicated
(`security-headers.conf:1-3`). Every `add_header` is `always`, so the
headers are present on error responses too.

The set is `X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options` and a content security policy
(`security-headers.conf:4-7`). The policy pins `connect-src` to
`'self'` plus `https://aicfes-backend.deviego.xyz`, so the app can call
its API and nothing else. That pinning has a sharp edge: the host was
once `aicfes-api`, and because the CSP names it, a stale value there
would have the browser block every call the app makes — which is what
commit `bfeac72` corrected.

Verification was against the running container, not the config: all
four headers present, the app and its client-side routes still served
(commit `3b89550`).

## Consequences

Nothing runs to serve the client. The image is a web server and a
directory of files, so there is no application process to compromise,
restart or keep patched.

`style-src` allows `'unsafe-inline'` (`security-headers.conf:7`), which
is a real weakening of the policy — it is the one directive in the set
that does not hold. Why it was granted could not be verified: no commit
message or comment in either repository explains it, so whether it is
required by the build output or was simply the path of least resistance
is unknown. Anyone tightening it should test rather than assume.

Because the API origin is compiled in, promoting a build between
environments is not possible — staging and production are different
images from the same commit, and `VITE_API_URL` must be passed at build
time or the bundle calls the wrong host. There is no runtime override
and no startup check that the value was set.

The header include is duplicated by necessity, so a new `location` that
forgets to include it serves no security headers at all, exactly as the
`server` block did. Nothing fails; the headers are just missing. This is
the nginx rule, not a mistake in the config, and it is the reason the
comment sits in the file rather than in this document alone.

Two header sets can also drift: `Cache-Control` is declared per location
(`nginx.conf:44,52`) while the rest come from the include, so a reader
has to look in two files to know what a response carries. The
`/healthz` location deliberately has neither (`nginx.conf:33-37`).
