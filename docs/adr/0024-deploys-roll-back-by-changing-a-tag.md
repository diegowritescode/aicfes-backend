# 24. Deploys roll back by changing a tag

**Status** — accepted

Recorded retroactively.

## Context

CI builds an image on every push to main. Something has to decide which
image production runs, and how to undo that choice.

**Deploy automatically on green.** Rejected for a product with one
maintainer and no staging environment: a test suite that passes is not
the same as a release someone looked at, and an automatic deploy makes
every merge a production event.

**Mutable tag (`:latest`).** Rejected. A tag that moves cannot answer
"what is running?" and cannot answer "what do I go back to?".

## Decision

CI publishes each image under its commit SHA and also updates
`:latest` (`release.yml:40-42`). Production pins the SHA in
`deploy/.env` via `AICFES_API_TAG`, and the compose file requires it:
`${AICFES_API_TAG:?set AICFES_API_TAG in deploy/.env}`
(`compose.yml:33`). A deploy with no tag set fails loudly instead of
guessing.

Deploying is editing that variable and running `docker compose up -d`.
Rolling back is editing it to the previous SHA.

The API and the web are separate images with separate tags
(`AICFES_API_TAG`, `AICFES_WEB_TAG`, `compose.yml:33,83`), so either can
move without the other. The web image is built in a different
repository.

Older SHAs stay in the registry, which is what makes a rollback
possible: the image to go back to still exists.

## Consequences

Deploying is manual, which is the point. There is no path from a merge
to production that does not pass through someone typing a SHA.

Rolling back the code is one line and a restart. **It does not roll
back the schema.** Migrations are forward-only
([ADR 2](0002-migrations-are-the-source-of-truth.md)), so a rollback
past a migration leaves the old code facing a newer database. A
migration that removes or renames anything therefore needs two deploys:
add, migrate, and only then remove.

`:latest` exists and nothing should use it in production. It is there
for convenience in development, and it is exactly the tag that makes a
rollback impossible if someone pins it.

There is no record in the repository of which SHA is running. That
lives in `deploy/.env` on the server, and `grep AICFES_API_TAG .env` is
the only way to find out — which is why the runbook starts with that
command.
