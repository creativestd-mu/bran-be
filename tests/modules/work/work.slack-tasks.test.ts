import {
  buildDirectedSlackCreateFallback,
  classifyWorkUnitsForTaskList,
  encodeSlackTaskListMeta,
  formatSlackTaskListBlocks,
  formatSlackTaskListMessage,
  looksLikeChannelMassAssignQuery,
  looksLikeCreateWorkQuery,
  looksLikeSlackDmTaskCreate,
  looksLikeTaskListQuery,
  parseSlackTaskListMeta,
  parseTaskListDateRangeHeuristic,
  resolveTaskListSubject,
  SLACK_WORK_COMPLETE_ACTION
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
    expect(looksLikeTaskListQuery("add a task for Dhananjay to follow up")).toBe(false);
  });

  it("detects DM text that should create work units", () => {
    expect(looksLikeCreateWorkQuery("add a task for Dhananjay to follow up with the vendor")).toBe(
      true
    );
    expect(looksLikeCreateWorkQuery("Assign Dhananjay: sit with Arun tomorrow")).toBe(true);
    expect(looksLikeCreateWorkQuery("Dhananjay should send the Meltwater recap")).toBe(true);
    expect(looksLikeCreateWorkQuery("tasks for today")).toBe(false);
    expect(looksLikeCreateWorkQuery("my tasks yesterday")).toBe(false);
    expect(looksLikeSlackDmTaskCreate("Follow up with the vendor today and send the recap")).toBe(
      true
    );
    expect(looksLikeSlackDmTaskCreate("thanks")).toBe(false);
    expect(looksLikeSlackDmTaskCreate("wfh")).toBe(false);
  });

  it("treats add-these / numbered assignee dumps as create, not list", () => {
    const dump = [
      "Add these for tasks today",
      "1. Pratham - Muneem Ji x Bran",
      "2. Abhishek - Work on Perf Dashboard",
      "3. Take contact from Pragya for Scratch Magazine"
    ].join("\n");

    expect(looksLikeCreateWorkQuery(dump)).toBe(true);
    expect(looksLikeSlackDmTaskCreate(dump)).toBe(true);
    expect(looksLikeTaskListQuery(dump)).toBe(false);

    expect(looksLikeCreateWorkQuery("Add these tasks for today\n1. A - do x\n2. B - do y")).toBe(
      true
    );
    expect(looksLikeTaskListQuery("Add these tasks for today\n1. A - do x\n2. B - do y")).toBe(
      false
    );
    expect(looksLikeTaskListQuery("tasks for today")).toBe(true);
  });

  it("detects channel mass-assign phrasing", () => {
    expect(
      looksLikeChannelMassAssignQuery(
        "Add a task for everyone in this group to read the quoted article"
      )
    ).toBe(true);
    expect(looksLikeChannelMassAssignQuery("create a task for everybody here: review the deck")).toBe(
      true
    );
    expect(looksLikeChannelMassAssignQuery("assign this to the whole channel")).toBe(true);
    expect(looksLikeChannelMassAssignQuery("add a task for Dhananjay to follow up")).toBe(false);
    expect(looksLikeChannelMassAssignQuery("everyone is going to lunch")).toBe(false);
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
      includeOverdue: false,
      units: [
        {
          id: "open-today",
          title: "Complete xyzabc task",
          status: "OPEN",
          userId,
          closedAt: null,
          createdAt: from,
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
          id: "overdue-june",
          title: "Sit with Arun",
          status: "OPEN",
          userId,
          closedAt: null,
          createdAt: from,
          nextDueAt: new Date("2026-06-09T00:00:00.000+05:30"),
          firstDueAt: new Date("2026-06-09T00:00:00.000+05:30"),
          steps: [
            {
              description: "Meet with Arun",
              done: false,
              deadline: new Date("2026-06-09T00:00:00.000+05:30"),
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
          createdAt: from,
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
        },
        {
          id: "closed-today-due-last-week",
          title: "Old task finished today",
          status: "CLOSED",
          userId,
          closedAt: from,
          createdAt: from,
          nextDueAt: null,
          firstDueAt: new Date("2026-08-01T00:00:00.000+05:30"),
          steps: [
            {
              description: "Old task",
              done: true,
              deadline: new Date("2026-08-01T00:00:00.000+05:30"),
              assigneeId: userId
            }
          ]
        }
      ]
    });

    expect(pending.map((item) => item.title)).toEqual(["Complete xyzabc task"]);
    expect(completed.map((item) => item.title)).toEqual(["Ship notes"]);
  });

  it("treats a task with no deadline as due the day it was created", () => {
    const from = new Date("2026-08-14T00:00:00.000+05:30");
    const to = new Date("2026-08-14T23:59:59.999+05:30");
    const userId = "user-1";

    const { pending } = classifyWorkUnitsForTaskList({
      userId,
      from,
      to,
      includeOverdue: false,
      units: [
        {
          id: "undated-today",
          title: "Follow up with vendor",
          status: "OPEN",
          userId,
          closedAt: null,
          createdAt: new Date("2026-08-14T09:00:00.000+05:30"),
          nextDueAt: null,
          firstDueAt: null,
          steps: [
            {
              description: "Follow up with vendor",
              done: false,
              deadline: null,
              assigneeId: userId
            }
          ]
        },
        {
          id: "undated-yesterday",
          title: "Old undated task",
          status: "OPEN",
          userId,
          closedAt: null,
          createdAt: new Date("2026-08-13T09:00:00.000+05:30"),
          nextDueAt: null,
          firstDueAt: null,
          steps: [
            {
              description: "Old undated task",
              done: false,
              deadline: null,
              assigneeId: userId
            }
          ]
        }
      ]
    });

    expect(pending.map((item) => item.title)).toEqual(["Follow up with vendor"]);
    expect(pending[0]?.dueAt?.toISOString()).toBe("2026-08-14T14:30:00.000Z");
  });

  it("uses a tagged teammate and asks for a tag when only a name is typed", () => {
    const bot = "UBOT";
    const requester = "USUDEEP";

    expect(
      resolveTaskListSubject("<@UBOT> Dhananjay's tasks for today", {
        requesterSlackId: requester,
        botUserId: bot
      })
    ).toEqual({ kind: "named_untagged", name: "Dhananjay" });

    expect(
      resolveTaskListSubject("<@UBOT> tasks for Dhananjay", {
        requesterSlackId: requester,
        botUserId: bot
      })
    ).toEqual({ kind: "named_untagged", name: "Dhananjay" });

    expect(
      resolveTaskListSubject("<@UBOT> <@UDHAN> tasks for today", {
        requesterSlackId: requester,
        botUserId: bot
      })
    ).toEqual({ kind: "tagged", slackUserIds: ["UDHAN"] });

    expect(
      resolveTaskListSubject("<@UBOT> my tasks for today", {
        requesterSlackId: requester,
        botUserId: bot
      })
    ).toEqual({ kind: "self" });

    expect(
      resolveTaskListSubject("<@UBOT> tasks for today", {
        requesterSlackId: requester,
        botUserId: bot
      })
    ).toEqual({ kind: "self" });

    expect(
      resolveTaskListSubject("<@UBOT> today's tasks", {
        requesterSlackId: requester,
        botUserId: bot
      })
    ).toEqual({ kind: "self" });
  });

  it("labels someone else's list with their name", () => {
    const from = new Date("2026-08-14T00:00:00.000+05:30");
    const to = new Date("2026-08-14T23:59:59.999+05:30");
    const yours = formatSlackTaskListMessage({
      range: { from, to, label: "today (14 Aug 2026, IST)" },
      pending: [],
      completed: []
    });
    const theirs = formatSlackTaskListMessage({
      range: { from, to, label: "today (14 Aug 2026, IST)" },
      pending: [],
      completed: [],
      ownerName: "Dhananjay Jain"
    });

    expect(yours).toContain("*Your tasks by due date · today (14 Aug 2026, IST)*");
    expect(theirs).toContain("*Dhananjay Jain's tasks by due date · today (14 Aug 2026, IST)*");
  });

  it("builds a Slack checklist and round-trips list metadata", () => {
    const from = new Date("2026-08-14T00:00:00.000+05:30");
    const to = new Date("2026-08-14T23:59:59.999+05:30");
    const { blocks } = formatSlackTaskListBlocks({
      range: { from, to, label: "today (14 Aug 2026, IST)" },
      pending: [
        {
          id: "unit-1",
          title: "Follow up with vendor",
          status: "pending",
          dueAt: from,
          closedAt: null,
          overdue: false,
          steps: []
        }
      ],
      completed: [],
      listUserId: "user-1",
      includeOverdue: false
    });

    const meta = parseSlackTaskListMeta(blocks[0]?.block_id as string);
    expect(meta).toEqual({
      fromMs: from.getTime(),
      toMs: to.getTime(),
      userId: "user-1",
      includeOverdue: false
    });
    expect(encodeSlackTaskListMeta(meta!)).toBe(blocks[0]?.block_id);
    expect(JSON.stringify(blocks)).toContain(SLACK_WORK_COMPLETE_ACTION);
    expect(JSON.stringify(blocks)).toContain("unit-1");
    expect(JSON.stringify(blocks)).toContain("checkboxes");
  });

  it("renders a read-only list (no checkboxes) when interactive is false", () => {
    const from = new Date("2026-08-14T00:00:00.000+05:30");
    const to = new Date("2026-08-14T23:59:59.999+05:30");
    const { blocks } = formatSlackTaskListBlocks({
      range: { from, to, label: "today (14 Aug 2026, IST)" },
      pending: [
        {
          id: "unit-2",
          title: "Ask Pratham for xyz",
          status: "pending",
          dueAt: from,
          closedAt: null,
          overdue: false,
          steps: []
        }
      ],
      completed: [],
      ownerName: "Dhananjay Jain",
      listUserId: "user-2",
      includeOverdue: false,
      interactive: false
    });

    const serialized = JSON.stringify(blocks);
    expect(serialized).not.toContain("checkboxes");
    expect(serialized).not.toContain(SLACK_WORK_COMPLETE_ACTION);
    expect(serialized).not.toContain("Check a box");
    expect(serialized).toContain("Ask Pratham for xyz");
    expect(serialized).toContain("Dhananjay Jain");
  });
});

describe("buildDirectedSlackCreateFallback", () => {
  it("defaults title, assignee, and context from add-for-about phrasing", () => {
    const unit = buildDirectedSlackCreateFallback(
      "add something for Sudeep about the docs vault",
      new Date("2026-08-21T12:00:00.000+05:30")
    );
    expect(unit).not.toBeNull();
    expect(unit!.title.toLowerCase()).toContain("docs vault");
    expect(unit!.assigneeName).toBe("Sudeep");
    expect(unit!.context.toLowerCase()).toContain("docs vault");
    expect(unit!.status).toBe("OPEN");
    expect(unit!.steps).toHaveLength(1);
  });

  it("uses colon body as title when present", () => {
    const unit = buildDirectedSlackCreateFallback("add task for Amisha: finish brand deck");
    expect(unit!.title.toLowerCase()).toContain("finish brand deck");
    expect(unit!.assigneeName).toBe("Amisha");
  });

  it("returns null for empty text", () => {
    expect(buildDirectedSlackCreateFallback("  ")).toBeNull();
  });
});
