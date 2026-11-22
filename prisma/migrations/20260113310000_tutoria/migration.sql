-- A conversation about one question the learner got wrong.
-- Keyed on learner and item rather than session: failing the same
-- question twice must reopen the same thread, so the tutor answers
-- knowing what was already tried. Starting over would reproduce the
-- explanation that did not work the first time.
CREATE TABLE "Tutoria" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "opcionElegida" TEXT NOT NULL,
    -- The learner's own account of why they chose it, asked for before
    -- the tutor says anything.
    "defensa" TEXT,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tutoria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tutoria_userId_itemId_key" ON "Tutoria"("userId", "itemId");
CREATE INDEX "Tutoria_userId_idx" ON "Tutoria"("userId");

ALTER TABLE "Tutoria" ADD CONSTRAINT "Tutoria_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TutoriaMensaje" (
    "id" TEXT NOT NULL,
    "tutoriaId" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TutoriaMensaje_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TutoriaMensaje_tutoriaId_idx" ON "TutoriaMensaje"("tutoriaId");

ALTER TABLE "TutoriaMensaje" ADD CONSTRAINT "TutoriaMensaje_tutoriaId_fkey"
    FOREIGN KEY ("tutoriaId") REFERENCES "Tutoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
