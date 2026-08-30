/**
 * Shared Slack intent text helpers: quotes, negation, envelope detection.
 * Used by the deterministic resolver and individual looksLike* gates.
 */

const SLACK_USER_MENTION_RE = /<@[UW][A-Z0-9]+(?:\|[^>]+)?>/gi;

export function stripSlackMentionsForIntent(text: string): string {
  return text.replace(SLACK_USER_MENTION_RE, " ").replace(/\s+/g, " ").trim();
}

/** Drop quoted / forwarded lines so they can't drive routing alone. */
export function stripQuotedSlackLines(text: string): string {
  return text
    .split(/\n/)
    .filter((line) => !/^\s*[>|│]/.test(line))
    .join("\n")
    .trim();
}

/**
 * True when a match at `matchIndex` is preceded by a short negation span
 * (don't / do not / never / not / no) within ~40 chars.
 */
export function isNegatedAt(text: string, matchIndex: number): boolean {
  if (matchIndex <= 0) return false;
  const window = text.slice(Math.max(0, matchIndex - 48), matchIndex);
  return /\b(don'?t|do\s+not|never|not|no)\b[\s,;:—-]*$/i.test(window.trimEnd());
}

/** First non-empty line after mention strip (envelope / command line). */
export function firstContentLine(text: string): string {
  const cleaned = stripQuotedSlackLines(text);
  for (const line of cleaned.split(/\n/)) {
    const trimmed = line.replace(SLACK_USER_MENTION_RE, " ").replace(/\s+/g, " ").trim();
    if (trimmed.length >= 2) return trimmed;
  }
  return stripSlackMentionsForIntent(cleaned);
}

const EXPLICIT_CREATE_ENVELOPE_RE =
  /\b((add|create|log|capture|note)\s+(a\s+|an\s+|the\s+|this\s+|these\s+|some\s+)?(new\s+)?(task|to-?do|todo|work unit|action item)s?|add\s+these|assign\b)/i;

/**
 * High-precision "this message is asking to create tasks" envelope —
 * used to suppress calendar/sentiment stealing words inside bullet bodies.
 */
export function hasExplicitTaskCreateEnvelope(text: string): boolean {
  const cleaned = stripQuotedSlackLines(text);
  if (!cleaned) return false;
  if (EXPLICIT_CREATE_ENVELOPE_RE.test(firstContentLine(cleaned))) return true;
  if (EXPLICIT_CREATE_ENVELOPE_RE.test(cleaned) && hasBulletOrNumberedBody(cleaned)) {
    return true;
  }
  return false;
}

export function hasBulletOrNumberedBody(text: string): boolean {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 3);
  if (lines.length < 2) return false;
  const taskish = lines.filter(
    (line) =>
      /^\d+[.)]\s+\S/.test(line) ||
      /^[-*•]\s+\S/.test(line) ||
      /^[A-Za-z][A-Za-z.'-]{0,40}(?:\s+[A-Za-z][A-Za-z.'-]{0,40}){0,2}\s*[-–—:]\s+\S/.test(line)
  );
  return taskish.length >= 2;
}

/** Top-level book/schedule instruction (not buried only in a task bullet). */
export function hasTopLevelBookCallInstruction(text: string): boolean {
  const cleaned = stripQuotedSlackLines(text);
  if (!cleaned) return false;
  if (hasExplicitTaskCreateEnvelope(cleaned)) return false;

  // Require a person cue ("with …" or @mention) so "fix the call flow" does not book.
  const bookRe =
    /\b(book|schedule|set\s*up|setup|arrange|fix)\b[\s\S]{0,40}\b(call|meeting|sync|catch[- ]?up|1:1|one[- ]on[- ]one)\b[\s\S]{0,60}\b(with)\b/i;
  const bookMentionRe =
    /\b(book|schedule|set\s*up|setup|arrange|fix)\b[\s\S]{0,40}\b(call|meeting|sync|catch[- ]?up|1:1|one[- ]on[- ]one)\b/i;

  const first = firstContentLine(cleaned);
  const hasMention = /<@[UW][A-Z0-9]+/i.test(text) || /@\w+/.test(cleaned);

  if (bookRe.test(first)) {
    const match = first.match(bookRe);
    if (match?.index != null && isNegatedAt(first, match.index)) return false;
    return true;
  }
  if (bookMentionRe.test(first) && hasMention) {
    const match = first.match(bookMentionRe);
    if (match?.index != null && isNegatedAt(first, match.index)) return false;
    return true;
  }

  // Single-paragraph ask without a task-create envelope.
  if (!hasBulletOrNumberedBody(cleaned)) {
    if (bookRe.test(cleaned)) {
      const match = cleaned.match(bookRe);
      if (match?.index != null && isNegatedAt(cleaned, match.index)) return false;
      return true;
    }
    if (bookMentionRe.test(cleaned) && hasMention) {
      const match = cleaned.match(bookMentionRe);
      if (match?.index != null && isNegatedAt(cleaned, match.index)) return false;
      return true;
    }
  }

  return false;
}
