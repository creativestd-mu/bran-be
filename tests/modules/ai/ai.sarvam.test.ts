import { shouldFallbackToSarvamBatch } from "../../../src/modules/ai/ai.sarvam";

describe("Sarvam batch fallback", () => {
  it("falls back when REST rejects audio over 30 seconds", () => {
    expect(
      shouldFallbackToSarvamBatch("Audio duration exceeds the maximum limit of 30 seconds")
    ).toBe(true);
  });

  it("falls back on the v2.5 prompt/decoder budget error", () => {
    expect(
      shouldFallbackToSarvamBatch(
        "Prompt is too long (695 tokens). Maximum decoder sequence length is 228 tokens (prompt + output combined)."
      )
    ).toBe(true);
  });

  it("does not fall back on auth or quota errors", () => {
    expect(shouldFallbackToSarvamBatch("Sarvam API key is invalid or unauthorised")).toBe(false);
    expect(shouldFallbackToSarvamBatch("Sarvam quota exceeded. Try again later.")).toBe(false);
  });
});
