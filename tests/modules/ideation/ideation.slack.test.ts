import {
  formatMyIdeasSlackMessage,
  ideaFieldsFromText,
  looksLikeAddIdeaQuery,
  looksLikeListIdeasQuery
} from "../../../src/modules/ideation/ideation.slack";

describe("ideation slack detection", () => {
  it("detects add and list phrasing", () => {
    expect(looksLikeAddIdeaQuery("idea: campus founder night")).toBe(true);
    expect(looksLikeAddIdeaQuery("add an idea about Hyrox recap clips")).toBe(true);
    expect(looksLikeAddIdeaQuery("I have an idea we should film section D")).toBe(true);
    expect(looksLikeListIdeasQuery("my ideas")).toBe(true);
    expect(looksLikeListIdeasQuery("show me my ideas")).toBe(true);
    expect(looksLikeAddIdeaQuery("sentiment this week")).toBe(false);
    expect(looksLikeListIdeasQuery("list my pending tasks")).toBe(false);
  });

  it("parses title and description from free text", () => {
    const fields = ideaFieldsFromText("idea: Film Hyrox winners. Use student athletes as the hook.");
    expect(fields?.title).toContain("Film Hyrox winners");
    expect(fields?.description).toContain("student athletes");
  });

  it("lists only the provided ideas and explains an empty inbox", () => {
    expect(formatMyIdeasSlackMessage([])).toContain("don’t have any saved ideas");
    const text = formatMyIdeasSlackMessage([
      {
        title: "Founder night",
        description: "LinkedIn recap of campus founder night",
        createdAt: "2026-08-15T10:00:00.000Z"
      }
    ]);
    expect(text).toContain("only you can see these");
    expect(text).toContain("Founder night");
  });
});
