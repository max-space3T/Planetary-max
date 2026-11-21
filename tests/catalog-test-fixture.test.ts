import { describe, expect, it } from "vitest";
import { CATALOG_MIGRATIONS, SAMPLE_ARTWORK_FIXTURES } from "../catalog-test-fixture";

describe("Catalog test fixture", () => {
  it("contains migration 0002 with access_token and sample rows", () => {
    const mig0002 = CATALOG_MIGRATIONS.find(
      (m) => m.id === "0002_add_artworks_access_token"
    );
    expect(mig0002).toBeDefined();
    expect(mig0002?.sql).toMatch(/access_token/i);
    expect(SAMPLE_ARTWORK_FIXTURES).toHaveLength(2);
  });
});
