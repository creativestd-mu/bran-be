import { shouldRecommendGmailReply } from "../../../src/modules/pending-replies/pending-replies.gmail";

const ownEmails = new Set(["dhananjay@mastersunion.org"]);

function message(overrides: Partial<{
  gmailMessageId: string;
  threadId: string | null;
  subject: string | null;
  fromAddress: string | null;
  toAddresses: string | null;
  snippet: string | null;
  bodyText: string | null;
  labelIds: string | null;
}> = {}) {
  return {
    gmailMessageId: "m-1",
    threadId: "t-1",
    subject: "Campaign review",
    fromAddress: "Asha <asha@agency.example>",
    toAddresses: "dhananjay@mastersunion.org",
    snippet: "Could you review the campaign deck and share feedback?",
    bodyText: null,
    labelIds: JSON.stringify(["INBOX", "CATEGORY_PRIMARY"]),
    ...overrides
  };
}

describe("Gmail pending-reply relevance", () => {
  it("keeps direct human work requests", () => {
    const latest = message();
    expect(shouldRecommendGmailReply(latest, [latest], ownEmails)).toBe(true);
  });

  it("excludes newsletters, updates, and automated mail", () => {
    const latest = message({
      fromAddress: "Product Updates <updates@vendor.example>",
      snippet: "Your weekly digest. Unsubscribe here.",
      labelIds: JSON.stringify(["INBOX", "CATEGORY_UPDATES"])
    });
    expect(shouldRecommendGmailReply(latest, [latest], ownEmails)).toBe(false);
  });

  it("excludes inbound FYI mail with no request or active thread", () => {
    const latest = message({ snippet: "FYI, the report was published this morning." });
    expect(shouldRecommendGmailReply(latest, [latest], ownEmails)).toBe(false);
  });

  it("excludes obvious closure messages even in an active thread", () => {
    const latest = message({ snippet: "Thanks!", bodyText: null });
    const sent = message({
      gmailMessageId: "m-0",
      fromAddress: "dhananjay@mastersunion.org",
      toAddresses: "asha@agency.example",
      snippet: "Here is the final deck.",
      labelIds: JSON.stringify(["SENT"])
    });
    expect(shouldRecommendGmailReply(latest, [latest, sent], ownEmails)).toBe(false);
  });

  it("keeps a human response in an active work thread without requiring a question mark", () => {
    const latest = message({ snippet: "The client moved the launch deadline to Friday." });
    const sent = message({
      gmailMessageId: "m-0",
      fromAddress: "dhananjay@mastersunion.org",
      toAddresses: "asha@agency.example",
      snippet: "Can you confirm the launch date?",
      labelIds: JSON.stringify(["SENT"])
    });
    expect(shouldRecommendGmailReply(latest, [latest, sent], ownEmails)).toBe(true);
  });

  it("excludes personal requests from consumer email accounts without work context", () => {
    const latest = message({
      subject: "Dinner",
      fromAddress: "Friend <friend@gmail.com>",
      snippet: "Can you come for dinner tomorrow?"
    });
    expect(shouldRecommendGmailReply(latest, [latest], ownEmails)).toBe(false);
  });

  it("requires the user to be a direct recipient and the message to remain in inbox", () => {
    const mailingList = message({ toAddresses: "all@lists.example" });
    const archived = message({ labelIds: JSON.stringify(["CATEGORY_PRIMARY"]) });
    expect(shouldRecommendGmailReply(mailingList, [mailingList], ownEmails)).toBe(false);
    expect(shouldRecommendGmailReply(archived, [archived], ownEmails)).toBe(false);
  });
});
