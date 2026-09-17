import test from "node:test";
import assert from "node:assert/strict";
import {
  compactCvInstruction,
  compactProfileEvidence,
  type ExtractedProfileEvidence,
} from "../lib/services/profileEvidence";

test("CV evidence compaction removes duplicates and preserves academic typing", () => {
  const input: ExtractedProfileEvidence[] = [
    {
      category: "Expérience",
      fact: "Triactis — Analyste M&A | Exécution de mandats de cession.",
      type: "DIRECT",
    },
    {
      category: "Expérience",
      fact: "  Triactis — Analyste M&A | Exécution de mandats de cession.  ",
      type: "DIRECT",
    },
    {
      category: "Formation",
      fact: "Université Côte d’Azur — cursus académique.",
      type: "ACADEMIC",
    },
  ];

  const result = compactProfileEvidence(input);
  assert.equal(result.length, 2);
  assert.equal(result[0].type, "DIRECT");
  assert.equal(result[1].type, "ACADEMIC");
});

test("CV evidence compaction enforces a hard reviewable limit", () => {
  const input: ExtractedProfileEvidence[] = Array.from({ length: 60 }, (_, i) => ({
    category: "Compétence" as const,
    fact: `Compétence explicite ${i}`,
    type: "DIRECT" as const,
  }));
  assert.equal(compactProfileEvidence(input).length, 40);
});

test("CV extraction instruction asks for grouped evidence rather than micro-facts", () => {
  assert.match(compactCvInstruction, /20 à 35 preuves/i);
  assert.match(compactCvInstruction, /3 à 6 preuves maximum/i);
  assert.match(compactCvInstruction, /N'utilise pas TRANSFERABLE/i);
});
