import {
  TASK_REMINDER_MAX_SHOWN,
  buildPendingTasksReminderMessage,
  nextTaskReminderAt,
  reminderUsesChecklistAction,
  toReminderTaskListItems
} from "../../../src/modules/work/work.task-reminder";
import {
  SLACK_WORK_COMPLETE_ACTION,
  parseSlackTaskListMeta
} from "../../../src/modules/work/work.slack-tasks";

describe("work.task-reminder", () => {
  it("schedules the next 10:00 IST slot after the current time", () => {
    const atSlot = new Date("2026-09-25T04:30:00.000Z");
    expect(nextTaskReminderAt(atSlot, 10).toISOString()).toBe("2026-09-26T04:30:00.000Z");

    const morning = new Date("2026-09-25T03:00:00.000Z");
    expect(nextTaskReminderAt(morning, 10).toISOString()).toBe("2026-09-25T04:30:00.000Z");
  });

  it("includes weekends (everyday)", () => {
    const fridayAfternoon = new Date("2026-09-25T05:00:00.000Z");
    expect(nextTaskReminderAt(fridayAfternoon, 10).toISOString()).toBe(
      "2026-09-26T04:30:00.000Z"
    );
  });

  it("sends an interactive checklist (max 10) with Bran overflow link", () => {
    const pending = Array.from({ length: 10 }, (_, i) => ({
      id: `wu-${i + 1}`,
      title: `Task ${i + 1}`,
      status: "pending" as const,
      dueAt: new Date("2026-09-26T12:00:00.000Z"),
      closedAt: null,
      overdue: false,
      steps: []
    }));

    const { blocks } = buildPendingTasksReminderMessage({
      userId: "user-1",
      name: "Daisy Kataria",
      pending,
      totalCount: 12,
      appUrl: "https://bran.cohesivity.app"
    });

    const body = JSON.stringify(blocks);
    expect(body).toContain(SLACK_WORK_COMPLETE_ACTION);
    expect(body).toContain("checkboxes");
    expect(body).toContain("wu-1");
    expect(body).toContain("wu-10");
    expect(body).not.toContain("wu-11");
    expect(body).toContain("Pending (12)");
    expect(body).toContain("…and 2 more.");
    expect(body).toContain("https://bran.cohesivity.app/work|Open all in Bran");
    expect(body).not.toContain("*Completed");
    expect(body).toContain("Check a box to mark that task done");

    const meta = parseSlackTaskListMeta(blocks[0]?.block_id as string);
    expect(meta).toMatchObject({
      userId: "user-1",
      includeOverdue: true,
      pendingCap: TASK_REMINDER_MAX_SHOWN,
      mode: "reminder"
    });
    expect(reminderUsesChecklistAction()).toBe(SLACK_WORK_COMPLETE_ACTION);
  });

  it("links a short checklist to Bran without overflow", () => {
    const { blocks, text } = buildPendingTasksReminderMessage({
      userId: "user-2",
      name: "Pratham",
      pending: toReminderTaskListItems(
        [
          {
            id: "wu-a",
            title: "Ship reminder",
            nextDueAt: new Date("2026-09-26T12:00:00.000Z"),
            firstDueAt: null,
            createdAt: new Date("2026-09-20T12:00:00.000Z")
          }
        ],
        new Date("2026-09-25T12:00:00.000Z")
      ),
      totalCount: 1,
      appUrl: "https://bran.cohesivity.app"
    });

    expect(text).toContain("1 pending task");
    const body = JSON.stringify(blocks);
    expect(body).toContain("checkboxes");
    expect(body).toContain("Open tasks in Bran");
    expect(body).not.toContain("more.");
  });
});
