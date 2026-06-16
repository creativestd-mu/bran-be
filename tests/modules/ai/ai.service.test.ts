import {
  _parseQueryIntentForTests,
  _parseTimeRangeForTests
} from "../../../src/modules/ai/ai.service";
import { isVisionGuidanceQuery, parseVisionQueryHints } from "../../../src/modules/ai/ai.guidance";
import {
  isSameCalendarDayInTimezone,
  parseApiDateBoundary,
  startOfDayInTimezone,
  endOfDayInTimezone
} from "../../../src/utils/timezone";

const users = [
  { id: "user-1", name: "Amisha Sharma", email: "amisha@example.com" },
  { id: "user-2", name: "Sudeep Purwar", email: "sudeep@example.com" },
  { id: "user-3", name: "Admin", email: "admin@bran.app" }
];

const requester = users[2];

describe("AI query intent — self-referential", () => {
  it('maps "what did I do this week" to the requesting user', () => {
    const intent = _parseQueryIntentForTests("what did I do this week", users, requester);

    expect(intent.scope).toBe("user");
    expect(intent.userId).toBe("user-3");
    expect(intent.userName).toBe("Admin");
  });

  it("defaults to the requesting user when no subject is named", () => {
    const intent = _parseQueryIntentForTests("summarize this week", users, requester);

    expect(intent.scope).toBe("user");
    expect(intent.userId).toBe("user-3");
  });

  it("still resolves another person when named explicitly", () => {
    const intent = _parseQueryIntentForTests("what did Amisha do this week", users, requester);

    expect(intent.scope).toBe("user");
    expect(intent.userId).toBe("user-1");
    expect(intent.userName).toBe("Amisha Sharma");
  });

  it("still resolves team queries", () => {
    const intent = _parseQueryIntentForTests("how is the team doing this week", users, requester);

    expect(intent.scope).toBe("team");
    expect(intent.userId).toBeNull();
  });
});

describe("AI time range parsing — timezone", () => {
  it('maps "yesterday" to a single calendar day in Asia/Kolkata', () => {
    const range = _parseTimeRangeForTests("show me the task report for yesterday");
    expect(isSameCalendarDayInTimezone(range.from, range.to, "Asia/Kolkata")).toBe(true);
  });

  it("expands date-only API boundaries to one calendar day", () => {
    const from = parseApiDateBoundary("2026-06-09", "start");
    const to = parseApiDateBoundary("2026-06-09", "end");
    expect(isSameCalendarDayInTimezone(from, to, "Asia/Kolkata")).toBe(true);
    expect(from.getTime()).toBeLessThan(to.getTime());
  });

  it("uses start/end of day in the configured timezone", () => {
    const ref = new Date("2026-06-09T12:00:00.000Z");
    const start = startOfDayInTimezone(ref, "Asia/Kolkata");
    const end = endOfDayInTimezone(ref, "Asia/Kolkata");
    expect(isSameCalendarDayInTimezone(start, end, "Asia/Kolkata")).toBe(true);
  });
});

describe("AI vision guidance detection", () => {
  it("detects focus and career guidance queries", () => {
    expect(isVisionGuidanceQuery("what should I focus on this month")).toBe(true);
    expect(isVisionGuidanceQuery("how can I increase my salary by 40%")).toBe(true);
    expect(isVisionGuidanceQuery("what more should I do")).toBe(true);
  });

  it("detects team vision queries", () => {
    expect(isVisionGuidanceQuery("what is the vision of our team in one next year")).toBe(true);
  });

  it("does not flag plain performance retrospectives", () => {
    expect(isVisionGuidanceQuery("show me the task report for yesterday")).toBe(false);
  });

  it("parses one-year horizon hints", () => {
    const hints = parseVisionQueryHints("what is our team vision for the next year");
    expect(hints.maxDurationMonths).toBe(12);
    expect(hints.horizon).toBe("LONG_TERM");
  });
});
