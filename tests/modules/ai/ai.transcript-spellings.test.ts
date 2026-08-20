import { correctTranscriptSpellings } from "../../../src/modules/ai/ai.transcript-spellings";

const people = [
  "Dhananjay Jain",
  "Amisha Sharma",
  "Mrittika Maitra",
  "Pratham Nagpal",
  "Naveen Kumar",
  "Neha",
  "Sudeep Purwar"
];

describe("correctTranscriptSpellings", () => {
  it("fixes teammate first and last name near-misses", () => {
    const raw =
      "Help Naqpal. Dhananjaya needs Google Drive. Reply to Mrityuka. Amit Shah needs testing.";
    const fixed = correctTranscriptSpellings(raw, people);
    expect(fixed).toContain("Nagpal");
    expect(fixed).toContain("Dhananjay");
    expect(fixed).not.toContain("Dhananjaya");
    expect(fixed).toContain("Mrittika");
    expect(fixed).toContain("Amisha");
    expect(fixed).not.toContain("Amit Shah");
  });

  it("does not rewrite common English words", () => {
    const raw = "I need to sit on brand and complete this today.";
    expect(correctTranscriptSpellings(raw, people)).toBe(raw);
  });
});
