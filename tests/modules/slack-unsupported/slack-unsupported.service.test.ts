import { formatUnsupportedSlackReply } from "../../../src/modules/slack-unsupported/slack-unsupported.service";

describe("unsupported Slack reply copy", () => {
  it("explains mass-assign only works in channels", () => {
    const reply = formatUnsupportedSlackReply("mass_assign_dm");
    expect(reply).toMatch(/channel/i);
    expect(reply).toMatch(/everyone/i);
    expect(reply).not.toMatch(/logged this/i);
  });

  it("explains over-cap mass assign", () => {
    const reply = formatUnsupportedSlackReply("mass_assign_over_cap");
    expect(reply).toMatch(/too many/i);
  });

  it("gives a generic unsupported reply and notes logging", () => {
    const reply = formatUnsupportedSlackReply("no_handler");
    expect(reply).toMatch(/don.t support that request yet/i);
    expect(reply).toMatch(/logged this/i);
    expect(reply).toMatch(/listing\/creating tasks/i);
  });
});
