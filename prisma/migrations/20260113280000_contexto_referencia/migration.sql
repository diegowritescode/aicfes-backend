-- The shared passage an ICFES question depends on. One text is printed
-- above several questions, and the extractor used to discard it, so a
-- stem like "la palabra hurtaban puede sustituirse por" arrived with
-- nothing to read. Nullable: plenty of items are self-contained.
ALTER TABLE "ItemReferencia" ADD COLUMN "contexto" TEXT;

-- True when the stimulus is a picture we could not read out of the PDF.
-- Marking it keeps a known-incomplete item out of the examples the
-- generator learns from, instead of letting it look complete.
ALTER TABLE "ItemReferencia" ADD COLUMN "necesitaFigura" BOOLEAN NOT NULL DEFAULT false;
