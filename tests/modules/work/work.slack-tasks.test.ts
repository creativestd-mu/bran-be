import {
  classifyWorkUnitsForTaskList,
  looksLikeTaskListQuery,
  parseTaskListDateRangeHeuristic
} from "../../../src/modules/work/work.slack-tasks";

describe("Slack task list query", () => {
  const now = new Date("2026-08-13T08:30:00.000Z"); // 14:00 IST on Thu 13 Aug 2026

  it("detects list-tasks phrasing and ignores attendance", () => {
    expect(looksLikeTaskListQuery("<@U123> list my pending tasks")).toBe(true);
    expect(looksLikeTaskListQuery("<@U123|bran> what do I have yesterday")).toBe(true);
    expect(looksLikeTaskListQuery("what do I have today")).toBe(true);
    expect(looksLikeTaskListQuery("show my tasks from 23rd june to 25th july")).toBe(true);
    expect(looksLikeTaskListQuery("wfh")).toBe(false);
    expect(looksLikeTaskListQuery("eta 12:30")).toBe(false);
    expect(looksLikeTaskListQuery("yes")).toBe(false);
  });

  it("defaults relative phrases to IST calendar ranges", () => {
    const yesterday = parseTaskListDateRangeHeuristic("list my tasks yesterday", now);
    expect(yesterday?.label).toContain("12 Aug 2026");

    const lastMonth = parseTaskListDateRangeHeuristic("pending tasks last month", now);
    expect(lastMonth?.label).toContain("1 Jul 2026");
    expect(lastMonth?.label).toContain("31 Jul 2026");

    const nth = parseTaskListDateRangeHeuristic("tasks for 27th of last month", now);
    expect(nth?.label).toContain("27 Jul 2026");
    expect(nth?.from.toISOString().startsWith("2026-07-26") || nth?.from.toISOString().startsWith("2026-07-27")).toBe(
      true
    );

    const range = parseTaskListDateRangeHeuristic(
      "show my tasks from 23rd june to 25th july",
      now
    );
    expect(range?.label).toContain("23 Jun 2026");
    expect(range?.label).toContain("25 Jul 2026");
  });

  it("splits pending vs completed for the requested window", () => {
    const from = new Date("2026-08-13T00:00:00.000+05:30");
    const to = new Date("2026-08-13T23:59:59.999+05:30");
    const userId = "user-1";

    const { pending, completed } = classifyWorkUnitsForTaskList({
      userId,
      from,
      to,
      includeOverdue: true,
      includeUndatedOpen: true,
      units: [
        {
          id: "open-today",
          title: "Complete xyzabc task",
          status: "OPEN",
          userId,
          closedAt: null,
          nextDueAt: from,
          firstDueAt: from,
          steps: [
            {
              description: "Complete xyzabc task",
              done: false,
              deadline: from,
              assigneeId: userId
            }
          ]
        },
        {
          id: "closed-today",
          title: "Ship notes",
          status: "CLOSED",
          userId,
          closedAt: from,
          nextDueAt: null,
          firstDueAt: from,
          steps: [
            {
              description: "Ship notes",
              done: true,
              deadline: from,
              assigneeId: userId
            }
          ]
        }
      ]
    });

    expect(pending.map((item) => item.title)).toEqual(["Complete xyzabc task"]);
    expect(completed.map((item) => item.title)).toEqual(["Ship notes"]);
  });
});
