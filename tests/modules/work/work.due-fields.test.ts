import { deadlineOrSameDay, parseDeadlineToIso } from "../../../src/modules/work/work.extraction";
import { implicitWorkDeadline, isWorkDeadlineOverdue, workDeadlineAtEndOfDay } from "../../../src/modules/work/work.due-fields";

describe("work deadline end of day (8 PM IST)", () => {
  const tz = "Asia/Kolkata";

  it("snaps date-only deadlines to 20:00 IST", () => {
    const iso = parseDeadlineToIso("2026-08-14");
    expect(iso).toBe(workDeadlineAtEndOfDay(new Date("2026-08-14T12:00:00.000Z"), tz).toISOString());
    expect(iso).toBe("2026-08-14T14:30:00.000Z");
  });

  it("is not overdue before 8 PM IST on the due day", () => {
    const dueMidnightIst = new Date("2026-08-13T18:30:00.000Z");
    const onePmIst = new Date("2026-08-14T07:31:00.000Z");
    expect(isWorkDeadlineOverdue(dueMidnightIst, onePmIst, tz)).toBe(false);
  });

  it("defaults a missing deadline to 20:00 IST that same day", () => {
    const now = new Date("2026-08-14T07:31:00.000Z");
    expect(deadlineOrSameDay(null, now)).toBe("2026-08-14T14:30:00.000Z");
    expect(deadlineOrSameDay("", now)).toBe("2026-08-14T14:30:00.000Z");
    expect(deadlineOrSameDay("2026-08-20", now)).toBe("2026-08-20T14:30:00.000Z");
    expect(implicitWorkDeadline(null, now, tz).toISOString()).toBe("2026-08-14T14:30:00.000Z");
  });

  it("is overdue after 8 PM IST on the due day", () => {
    const dueMidnightIst = new Date("2026-08-13T18:30:00.000Z");
    const eightOhOnePmIst = new Date("2026-08-14T14:31:00.000Z");
    expect(isWorkDeadlineOverdue(dueMidnightIst, eightOhOnePmIst, tz)).toBe(true);
  });
});
