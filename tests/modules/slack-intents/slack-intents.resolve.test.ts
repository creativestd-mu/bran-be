import { looksLikeBookCallQuery } from "../../../src/modules/meetings/meetings.booking.slack";
import {
  resolveDeterministicSlackIntents
} from "../../../src/modules/slack-intents/slack-intents.resolve";
import {
  hasExplicitTaskCreateEnvelope,
  hasTopLevelBookCallInstruction,
  stripQuotedSlackLines
} from "../../../src/modules/slack-intents/slack-intents.text";
import { looksLikeCreateWorkQuery } from "../../../src/modules/work/work.slack-tasks";
import { looksLikeCompetitorQuery } from "../../../src/modules/competitor-content/competitor-content.slack";
import { looksLikeSentimentQuery } from "../../../src/modules/sentiment/sentiment.slack";
import { looksLikePodQuery } from "../../../src/modules/pods/pods.slack";
import { parseAttendanceMessage } from "../../../src/modules/attendance/attendance.parser";

const SUDEEP_TASK_DUMP = [
  "<@UBRAN> <@UDHAN> Add tasks:",
  "• Set up a call with Mishra regarding Windsor, we will show him the whole tool",
  "• Set up a call between Arun and SuperBrain kids regarding their content plan",
  "• Post the Bran Review system demo video on Slack",
  "• Ask Ayushi if Gdrive search is working for her",
  "• Set up a Demo call with Varchasvi for Carousel Maker"
].join("\n");

describe("slack intent text helpers", () => {
  it("detects explicit task-create envelopes", () => {
    expect(hasExplicitTaskCreateEnvelope(SUDEEP_TASK_DUMP)).toBe(true);
    expect(hasExplicitTaskCreateEnvelope("book a call with Ada")).toBe(false);
  });

  it("ignores quoted lines for routing text", () => {
    expect(stripQuotedSlackLines("> add a task for everyone\nshow my tasks")).toBe(
      "show my tasks"
    );
  });

  it("requires top-level book instruction", () => {
    expect(hasTopLevelBookCallInstruction("book a call with Dhananjay")).toBe(true);
    expect(hasTopLevelBookCallInstruction(SUDEEP_TASK_DUMP)).toBe(false);
    expect(hasTopLevelBookCallInstruction("fix the call flow in the script")).toBe(false);
  });
});

describe("calendar vs task create collision", () => {
  it("does not treat Add tasks dumps as calendar booking", () => {
    expect(looksLikeCreateWorkQuery(SUDEEP_TASK_DUMP)).toBe(true);
    expect(looksLikeBookCallQuery(SUDEEP_TASK_DUMP)).toBe(false);

    const resolved = resolveDeterministicSlackIntents(SUDEEP_TASK_DUMP);
    expect(resolved.mode).toBe("single");
    if (resolved.mode === "single") {
      expect(resolved.intent).toBe("add_task");
    }
  });

  it("still books when the message is a real calendar ask", () => {
    expect(looksLikeBookCallQuery("<@U1> book a call with Dhananjay")).toBe(true);
    const resolved = resolveDeterministicSlackIntents("book a call with Amisha tomorrow");
    expect(resolved.mode).toBe("single");
    if (resolved.mode === "single") {
      expect(resolved.intent).toBe("calendar");
    }
  });
});

describe("deterministic resolver compounds", () => {
  it("flags genuine multi-intent messages as compound", () => {
    const resolved = resolveDeterministicSlackIntents(
      "show sentiment this week and list my tasks"
    );
    expect(resolved.mode).toBe("compound");
    if (resolved.mode === "compound") {
      expect(resolved.intents).toEqual(expect.arrayContaining(["sentiment", "list_tasks"]));
    }
  });
});

describe("narrowed detector guards", () => {
  it("does not treat competitive strategy talk as competitor coverage", () => {
    expect(looksLikeCompetitorQuery("We need a competitive edge on the deck")).toBe(false);
    expect(looksLikeCompetitorQuery("competitor coverage this week")).toBe(true);
  });

  it("requires brand anchor for bare press coverage", () => {
    expect(looksLikeSentimentQuery("press coverage of the campus launch")).toBe(false);
    expect(looksLikeSentimentQuery("Masters Union press coverage")).toBe(true);
    expect(looksLikeSentimentQuery("sentiment this week")).toBe(true);
  });

  it("does not treat bare inspirations as pod query", () => {
    expect(looksLikePodQuery("inspirations for the campaign brief")).toBe(false);
    expect(looksLikePodQuery("pod inspiration this week")).toBe(true);
  });

  it("ignores negated leave / leave me phrasing for attendance", () => {
    expect(parseAttendanceMessage("please don't leave me off the list")).toBeNull();
    expect(parseAttendanceMessage("not wfh today")).toBeNull();
    expect(parseAttendanceMessage("leave")).toMatchObject({ recordType: "leave" });
  });

  it("ignores Note:/FYI: colon prose as task create", () => {
    expect(looksLikeCreateWorkQuery("Note: see sentiment dashboard")).toBe(false);
    expect(looksLikeCreateWorkQuery("don't add a task for John")).toBe(false);
  });
});
