// Shared deterministic comparison-pair picker.
// Used by generate-compare.mjs (renders the pages) AND generate-seo.mjs
// (interlinks strain pages + sitemap) so both agree without a build-order
// dependency.
//
// Anchors are the curated data-rich strains (sourced terpene profiles). Each
// anchor is paired with its most similar strains — people compare lookalikes
// ("Gelato vs Gelato 41"), not random matchups. Pairs are deduped on an
// alphabetical slug so A-vs-B and B-vs-A never both exist.

export function comparisonPairs(strains) {
  const anchors = strains.filter(
    (s) => (s.terpenes || []).length && (s.effects || []).length >= 3,
  );
  const seen = new Set();
  const pairs = [];

  for (const a of anchors) {
    const candidates = strains
      .filter((b) => b.id !== a.id && (b.effects || []).length >= 3 && b.genetics)
      .map((b) => {
        const shared = (b.effects || []).filter((e) => (a.effects || []).includes(e)).length;
        const richBonus = (b.terpenes || []).length ? 2 : 0;
        const typeBonus = b.type === a.type ? 1 : 0;
        return { b, score: shared * 2 + richBonus + typeBonus };
      })
      .filter((x) => x.score >= 6)
      .sort((x, y) => y.score - x.score || x.b.name.localeCompare(y.b.name))
      .slice(0, 2);

    for (const { b } of candidates) {
      const [x, y] = [a, b].sort((p, q) => p.id.localeCompare(q.id));
      const slug = `${x.id}-vs-${y.id}`;
      if (seen.has(slug)) continue;
      seen.add(slug);
      pairs.push({ a: x, b: y, slug });
    }
  }
  return pairs;
}

/** Map of strainId -> [{ slug, other }] for "head-to-head" links on strain pages. */
export function comparisonsByStrain(pairs) {
  const map = new Map();
  for (const p of pairs) {
    for (const [self, other] of [[p.a, p.b], [p.b, p.a]]) {
      if (!map.has(self.id)) map.set(self.id, []);
      map.get(self.id).push({ slug: p.slug, other });
    }
  }
  return map;
}
