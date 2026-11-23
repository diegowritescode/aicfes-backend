# 26. A reference item is identified by its stem

**Status** — accepted

Recorded retroactively.

## Context

The reference bank holds 2,374 items extracted from the official
booklets (`scripts/README.md:28,42`). Loading them costs one embedding
request per batch of sixty-four, so the loader has to be safe to re-run:
an interrupted load must resume rather than pay twice
(`cargar-referencia.ts:8-9`). That needs an identity for an item.

**`fuente` + `numero`.** The obvious key, since every extracted item
carries both (`cargar-referencia.ts:19-20`), and wrong. Booklet
numbering is not unique across the corpus — the same number appears in
many files and reprints — so the 2,374 items collapse to 1,223 distinct
keys. Each later item silently overwrote an earlier one.

That is not a hypothesis. The local verifier keyed its verdict file
that way, and after judging 221 items the file held 74, with those
verdicts attributed to the wrong questions (commit `064fe56`). It was
caught only because the progress counter and the file disagreed.

**The stem.** A question is identified by what it asks. Two items with
the same stem are the same item however they are numbered.

## Decision

Items are keyed by a SHA-256 hash of the normalised stem. Normalising
lowercases, strips accents and punctuation, and collapses whitespace
(`cargar-referencia.ts:30-38`), so the same question reprinted with
different typography hashes the same.

The database enforces it rather than trusting the script: `hash` is
`@unique` on `ItemReferencia` (`schema.prisma:493`), created as a unique
index by the migration
(`prisma/migrations/20260113240000_banco_referencia/migration.sql:17`),
and the insert carries
`ON CONFLICT (hash) DO NOTHING` (`cargar-referencia.ts:106`).

The loader checks the hashes of a batch against the table *before*
asking for embeddings, so a resumed run skips what it already has
without spending (`cargar-referencia.ts:64-79`).

`fuente` and `numero` are still stored (`schema.prisma:479-480`). They
are provenance — which booklet, which number — and useful in a warning
when an insert fails (`cargar-referencia.ts:117`). They are simply not
identity.

The local verifier was corrected the same way, keying its verdict file
by a hash of the stem (`scripts/verificar-banco-local.mjs:107`).

## Consequences

Re-running the loader is free and idempotent. 2,374 items produce 2,374
rows, and an interrupted load resumes.

Deduplication now happens across the whole corpus rather than per file,
which is a side benefit: a question reprinted in three booklets is
stored once. The counts in `scripts/README.md:44-50` are of extracted
items, not of rows, and will diverge from the table if the corpus
contains reprints.

The hash is over the stem alone, not the options. Two items with
identical wording but different answer choices would be treated as one
and only the first stored. That has not been observed, but nothing
prevents it.

The two hashes are computed differently and are not interchangeable.
The loader hashes the *normalised* stem at full length
(`cargar-referencia.ts:67`); the verifier hashes the raw stem and
truncates to sixteen hex characters
(`verificar-banco-local.mjs:107`). Each is internally consistent, so
nothing is broken, but a verdict file cannot be joined to the table by
key.

Changing `normalise` changes every hash, which would make the whole bank
look new and reload it at full cost. The function is effectively frozen
once a bank has been loaded, and nothing in the code says so.
