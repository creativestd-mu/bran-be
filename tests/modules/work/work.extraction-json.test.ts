import { parseLlmWorkUnitsJson } from "../../../src/modules/work/work.extraction";

describe("parseLlmWorkUnitsJson", () => {
  it("parses a clean workUnits object", () => {
    const parsed = parseLlmWorkUnitsJson(
      JSON.stringify({
        workUnits: [{ title: "Help Nagpal claim Munimji", context: "claim the link" }]
      })
    ) as { workUnits: Array<{ title: string }> };

    expect(parsed.workUnits).toHaveLength(1);
    expect(parsed.workUnits[0].title).toBe("Help Nagpal claim Munimji");
  });

  it("strips markdown fences", () => {
    const parsed = parseLlmWorkUnitsJson(
      '```json\n{"workUnits":[{"title":"Finish Karauzal"}]}\n```'
    ) as { workUnits: Array<{ title: string }> };

    expect(parsed.workUnits[0].title).toBe("Finish Karauzal");
  });

  it("recovers a truncated workUnits array", () => {
    const parsed = parseLlmWorkUnitsJson(
      '{"workUnits":[{"title":"Google Drive search","context":"Dhananjay"},{"title":"Show Bran to Neha","context":"demo"'
    ) as { workUnits: Array<{ title: string }> };

    expect(parsed.workUnits).toHaveLength(1);
    expect(parsed.workUnits[0].title).toBe("Google Drive search");
  });
});
