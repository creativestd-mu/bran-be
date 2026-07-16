import { parseAttendanceMessage } from "../../../src/modules/attendance/attendance.parser";
import {
  classifyFlags,
  dateInIST,
  isWeekendIST,
  minutesSinceMidnightIST,
  slackTsToDate
} from "../../../src/modules/attendance/attendance.dates";

describe("parseAttendanceMessage", () => {
  it("parses comp off variants", () => {
    expect(parseAttendanceMessage("comp off")).toEqual({
      recordType: "comp_off",
      etaText: null,
      etaMinutes: null
    });
    expect(parseAttendanceMessage("compoff today")).toMatchObject({ recordType: "comp_off" });
  });

  it("parses leave and wfh", () => {
    expect(parseAttendanceMessage("sick leave")).toMatchObject({ recordType: "leave" });
    expect(parseAttendanceMessage("wfh")).toMatchObject({ recordType: "wfh" });
  });

  it("parses eta times", () => {
    expect(parseAttendanceMessage("eta 12:30")).toEqual({
      recordType: "office",
      etaText: "12:30",
      etaMinutes: 12 * 60 + 30
    });
    expect(parseAttendanceMessage("eta 1")).toEqual({
      recordType: "office",
      etaText: "13:00",
      etaMinutes: 13 * 60
    });
    expect(parseAttendanceMessage("eta 12")).toEqual({
      recordType: "office",
      etaText: "12:00",
      etaMinutes: 12 * 60
    });
    expect(parseAttendanceMessage("eta 12 pm")).toEqual({
      recordType: "office",
      etaText: "12:00",
      etaMinutes: 12 * 60
    });
    expect(parseAttendanceMessage("ETA - 1:30")).toEqual({
      recordType: "office",
      etaText: "13:30",
      etaMinutes: 13 * 60 + 30
    });
  });

  it("parses in office / office times as eta", () => {
    expect(parseAttendanceMessage("in office 12:45")).toEqual({
      recordType: "office",
      etaText: "12:45",
      etaMinutes: 12 * 60 + 45
    });
    expect(parseAttendanceMessage("In Office 1:30")).toEqual({
      recordType: "office",
      etaText: "13:30",
      etaMinutes: 13 * 60 + 30
    });
    expect(parseAttendanceMessage("office 12:45")).toEqual({
      recordType: "office",
      etaText: "12:45",
      etaMinutes: 12 * 60 + 45
    });
  });

  it("ignores unrecognized messages", () => {
    expect(parseAttendanceMessage("hello team")).toBeNull();
  });
});

describe("attendance dates / flags", () => {
  it("converts slack ts and IST date", () => {
    // 2026-07-09 10:30:00 IST = 2026-07-09 05:00:00 UTC
    const ts = String(Date.parse("2026-07-09T05:00:00.000Z") / 1000);
    const date = slackTsToDate(ts);
    expect(dateInIST(date)).toBe("2026-07-09");
    expect(minutesSinceMidnightIST(date)).toBe(10 * 60 + 30);
  });

  it("classifies on-time office submission", () => {
    const submittedAt = new Date("2026-07-09T05:00:00.000Z"); // 10:30 IST
    const flags = classifyFlags({
      submittedAt,
      etaMinutes: 12 * 60 + 30,
      recordType: "office"
    });
    expect(flags.submittedOnTime).toBe(true);
    expect(flags.isLateArrival).toBe(false);
  });

  it("treats submissions before 11:30 IST as on time", () => {
    const submittedAt = new Date("2026-07-09T05:45:00.000Z"); // 11:15 IST
    const flags = classifyFlags({
      submittedAt,
      etaMinutes: 12 * 60 + 30,
      recordType: "office"
    });
    expect(flags.submittedOnTime).toBe(true);
  });

  it("classifies late submission from 11:30 IST and late arrival", () => {
    const submittedAt = new Date("2026-07-09T06:00:00.000Z"); // 11:30 IST
    const flags = classifyFlags({
      submittedAt,
      etaMinutes: 13 * 60,
      recordType: "office"
    });
    expect(flags.submittedOnTime).toBe(false);
    expect(flags.isLateArrival).toBe(true);
  });

  it("detects weekends in IST", () => {
    expect(isWeekendIST("2026-07-11")).toBe(true); // Saturday
    expect(isWeekendIST("2026-07-09")).toBe(false); // Thursday
  });
});
