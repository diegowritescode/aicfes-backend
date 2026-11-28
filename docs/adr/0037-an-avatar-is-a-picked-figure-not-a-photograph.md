# 37. An avatar is a picked figure, not a photograph

Date: 2026-11-27

## Status

Accepted

## Context

A learner could not change how they appear. The avatar was two
initials on one of eight colours, both derived from the alias by a
hash — stable, offline, and nobody's choice. Diego asked for photo
upload, and when offered the options, picked it.

The question that changed the answer was not technical. Storage is
free at this scale: a WebP at 512×512 and quality 80 is about 25 KB,
so the entire Colombian ICFES cohort of ~490,000 learners would be
20 GB, against 63 GB free on the VPS. Processing is a solved problem
— `sharp` crops, resizes and strips EXIF in a few lines, and stripping
EXIF is not optional, because a phone photograph carries the GPS
coordinates of where it was taken and these accounts belong to
minors.

What does not shrink is the obligation. A photograph uploaded by a
16-year-old, visible to a stranger who found them through alias
search, has to be looked at by a person before it publishes. That is
not a feature to build once; it is a standing duty with no end date,
and the product has one maintainer. Review-after-publish is not a
weaker version of it — it means the window in which a photograph of a
child is visible to strangers is however long it takes somebody to
open the queue.

So the real options were: no choice at all, photographs with a
permanent moderation duty, or a choice with nothing to moderate.

## Decision

**A learner picks one of 24 drawn figures and one of 8 colours.**

The figures ship inside the app as SVG paths — animals, objects and
symbols, about 12 KB for the whole set. 24 × 8 is 192 distinct
avatars.

The database stores a slug (`zorro`) and a colour index, not a URL
and not an image. `src/duelos/model/avatares.ts` is the authority on
which slugs exist, and the column is validated against it on write:
the column is free text, and a client is not a source of truth. A
rejected slug is a rejection, never a silent fallback to a figure of
our choosing.

`null` is a value and not an absence. It means «my initials», which
is what every account had before these columns existed and what every
account keeps until it picks.

**No human faces, no flags, no religious symbols.** A face invites
«which one looks like me», which has no honest answer without a
skin-tone axis per figure; the other two start fights in a product for
teenagers. `avatar-sin-fotos.test.ts` pins this.

## Consequences

Nothing uploads, nothing is stored, nothing needs review. There is no
moderation queue for avatars because every possible avatar already
shipped in the binary.

The avatar works offline and never fails to load, which matters on a
profile screen where a missing image reads as a broken account.

A figure added to the server and not to the app — or the reverse — is
drift between two lists in two repositories, which is the pair most
likely to diverge. `figuras-de-avatar.test.ts` reads the server's file
and compares the sets; it was verified by introducing a slug on one
side and watching it fail.

**What this costs:** a learner who wanted their own face cannot have
it. 24 figures is not 190 countries' worth of self-expression, and
somebody will ask. The answer is not «never» — it is that photographs
arrive with the moderation duty attached, and that duty is the
feature, not the upload.

**If this is revisited**, the order is: strip EXIF server-side first,
then review-before-publish, then the upload. Not the other way
around. And `avatar-sin-fotos.test.ts` has to be deleted
deliberately, which is the point of it existing.
