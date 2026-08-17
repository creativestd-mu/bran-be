import {
  deriveMeetingTitle,
  generateBookingCandidateSlots,
  mergeBusyIntervals,
  overlapsBusy,
  pickFreeBookingSlots
} from "../../../src/modules/meetings/meetings.booking";
import {
  looksLikeBookCallQuery,
  looksLikeCalendarAgendaQuery
} from "../../../src/modules/meetings/meetings.booking.slack";

describe("calendar booking slots", () => {
  it("generates weekday 12–19 IST half-hour candidates after now", () => {
    // Wednesday 13 Aug 2026 10:00 IST = 04:30 UTC
    const now = new Date("2026-08-13T04:30:00.000Z");
    const slots = generateBookingCandidateSlots(now, { searchDays: 2 });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((slot) => slot.start > now)).toBe(true);
    expect(slots[0].label).toMatch(/IST/);
  });

  it("filters busy intervals and picks free slots", () => {
    const now = new Date("2026-08-13T04:30:00.000Z");
    const candidates = generateBookingCandidateSlots(now, { searchDays: 1 }).slice(0, 6);
    expect(candidates.length).toBeGreaterThan(2);

    const busy = mergeBusyIntervals([
      { start: candidates[0].start, end: candidates[0].end },
      { start: candidates[1].start, end: candidates[2].end }
    ]);

    expect(overlapsBusy(candidates[0].start, candidates[0].end, busy)).toBe(true);
    const free = pickFreeBookingSlots(candidates, busy, 3);
    expect(free.length).toBeGreaterThan(0);
    expect(free[0].start.getTime()).toBe(candidates[3].start.getTime());
  });

  it("derives Name <> Name when no topic, else uses context", () => {
    expect(
      deriveMeetingTitle({
        text: "book a call with Dhananjay",
        requesterName: "Ada",
        targetName: "Dhananjay"
      })
    ).toBe("Ada <> Dhananjay");

    expect(
      deriveMeetingTitle({
        text: "schedule a meeting with Dhananjay about Bran launch",
        requesterName: "Ada",
        targetName: "Dhananjay"
      })
    ).toMatch(/Bran/i);
  });
});

describe("calendar slack intents", () => {
  it("detects book and agenda phrasing", () => {
    expect(looksLikeBookCallQuery("<@U1> book a call with Dhananjay")).toBe(true);
    expect(looksLikeBookCallQuery("schedule a meeting with Pratham about carousel")).toBe(true);
    expect(looksLikeBookCallQuery("tasks for today")).toBe(false);

    expect(looksLikeCalendarAgendaQuery("what's on my calendar today")).toBe(true);
    expect(looksLikeCalendarAgendaQuery("my meetings today")).toBe(true);
    expect(looksLikeCalendarAgendaQuery("book a call with Ada")).toBe(false);
  });
});
