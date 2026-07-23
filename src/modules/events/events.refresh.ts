import { summarizeEventFromSources, isEventsAiConfigured } from "./events.ai";
import {
  buildEventAiSummary,
  eventDateRangeFromCandidates,
  updatesToSummaryCandidates
} from "./events.summary";
import { findOrgEventById, updateOrgEvent } from "./events.repository";

export async function refreshAutoEventSummary(eventId: string): Promise<void> {
  const event = await findOrgEventById(eventId);
  if (!event || event.kind !== "AUTO" || !event.updates?.length) return;

  const candidates = updatesToSummaryCandidates(event.updates);
  if (candidates.length === 0) return;

  const { startsAt, endsAt } = eventDateRangeFromCandidates(candidates);
  let aiSummary: string;
  if (isEventsAiConfigured()) {
    aiSummary = await summarizeEventFromSources(event.title, candidates);
  } else {
    aiSummary = buildEventAiSummary(candidates);
  }

  await updateOrgEvent(eventId, {
    aiSummary,
    startsAt,
    endsAt,
    aiAnalyzedAt: new Date()
  });
}
