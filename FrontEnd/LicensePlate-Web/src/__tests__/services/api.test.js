import { describe, it, expect } from "vitest";
import { buildEventsQuery } from "../../services/api.js";

describe("buildEventsQuery", () => {
  it("returns empty string with no params", () => {
    expect(buildEventsQuery()).toBe("");
    expect(buildEventsQuery({})).toBe("");
  });

  it("builds query with start date", () => {
    const qs = buildEventsQuery({ start: "2025-01-01" });
    expect(qs).toContain("start_date=2025-01-01");
  });

  it("builds query with end date", () => {
    const qs = buildEventsQuery({ end: "2025-12-31" });
    expect(qs).toContain("end_date=2025-12-31");
  });

  it("builds query with direction", () => {
    const qs = buildEventsQuery({ direction: "IN" });
    expect(qs).toContain("direction=IN");
  });

  it("excludes direction when all", () => {
    const qs = buildEventsQuery({ direction: "all" });
    expect(qs).not.toContain("direction");
  });

  it("builds query with plate query", () => {
    const qs = buildEventsQuery({ query: "กก1234" });
    expect(qs).toContain("query=");
  });

  it("builds query with limit", () => {
    const qs = buildEventsQuery({ limit: 100 });
    expect(qs).toContain("limit=100");
  });

  it("combines multiple params", () => {
    const qs = buildEventsQuery({
      start: "2025-01-01",
      end: "2025-01-31",
      direction: "OUT",
      limit: 50,
    });
    expect(qs).toContain("start_date=2025-01-01");
    expect(qs).toContain("end_date=2025-01-31");
    expect(qs).toContain("direction=OUT");
    expect(qs).toContain("limit=50");
  });
});
