import { formatTranscriptionPrompt } from "../../../src/modules/ai/ai.transcription-context";

describe("transcription STT prompt", () => {
  it("includes people, pods, verticals, projects, and custom keywords", () => {
    const prompt = formatTranscriptionPrompt({
      people: ["Dhananjay"],
      verticals: ["Growth"],
      pods: ["Fiction"],
      projects: ["Bran"],
      keywords: ["Masters' Union", "Meltwater"]
    });

    expect(prompt).toMatch(/people: Dhananjay/);
    expect(prompt).toMatch(/verticals: Growth/);
    expect(prompt).toMatch(/pods: Fiction/);
    expect(prompt).toMatch(/projects: Bran/);
    expect(prompt).toMatch(/custom keywords: Masters' Union, Meltwater/);
    expect(prompt).toMatch(/Prefer these exact spellings/);
  });

  it("appends extra caller text and dedupes case-insensitively", () => {
    const prompt = formatTranscriptionPrompt(
      {
        people: ["Ada", "ada"],
        verticals: [],
        pods: [],
        projects: [],
        keywords: []
      },
      "Meeting transcript with speaker names when available."
    );

    expect(prompt).toMatch(/people: Ada/);
    expect(prompt.match(/Ada/g)?.length).toBe(1);
    expect(prompt).toMatch(/Meeting transcript with speaker names/);
  });

  it("returns only extra when org lists are empty", () => {
    expect(
      formatTranscriptionPrompt(
        { people: [], verticals: [], pods: [], projects: [], keywords: [] },
        " just speakers "
      )
    ).toBe("just speakers");
  });
});
