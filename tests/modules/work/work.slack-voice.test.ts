import { slackVoiceMessageIsAddressedToBot } from "../../../src/modules/work/work.slack-voice";

describe("slack voice addressing", () => {
  it("accepts DMs without a bot mention", () => {
    expect(
      slackVoiceMessageIsAddressedToBot({
        isDm: true,
        text: "",
        botUserId: "UBOT"
      })
    ).toBe(true);
  });

  it("accepts channel audio only when Bran is mentioned", () => {
    expect(
      slackVoiceMessageIsAddressedToBot({
        isDm: false,
        text: "assign these to Dhananjay",
        botUserId: "UBOT"
      })
    ).toBe(false);

    expect(
      slackVoiceMessageIsAddressedToBot({
        isDm: false,
        text: "<@UBOT> assign these to Dhananjay",
        botUserId: "UBOT"
      })
    ).toBe(true);

    expect(
      slackVoiceMessageIsAddressedToBot({
        isDm: false,
        eventType: "app_mention",
        text: "create these tasks",
        botUserId: "UBOT"
      })
    ).toBe(true);
  });
});
