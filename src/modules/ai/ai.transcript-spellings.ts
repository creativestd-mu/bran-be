const STOPWORDS = new Set(
  [
    "a",
    "an",
    "the",
    "and",
    "or",
    "to",
    "for",
    "of",
    "in",
    "on",
    "at",
    "by",
    "my",
    "me",
    "i",
    "we",
    "you",
    "he",
    "she",
    "it",
    "is",
    "are",
    "was",
    "be",
    "need",
    "needs",
    "today",
    "so",
    "that",
    "this",
    "with",
    "from",
    "all",
    "do",
    "did",
    "will",
    "would",
    "can",
    "just",
    "also",
    "then",
    "now",
    "okay",
    "yeah",
    "uh",
    "um",
    "ka",
    "ji"
  ].map((word) => word.toLowerCase())
);

export type SpellingTarget = {
  canonical: string;
  key: string;
};

function collapse(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const next = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    next[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min(prev[j] + 1, next[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = next[j];
  }
  return prev[b.length];
}

function maxEdits(length: number): number {
  if (length <= 4) return 1;
  if (length <= 7) return 1;
  return 2;
}

export function spellingTargetsFromNames(names: string[]): SpellingTarget[] {
  const seen = new Set<string>();
  const out: SpellingTarget[] = [];

  const add = (canonical: string) => {
    const key = collapse(canonical);
    if (key.length < 3 || seen.has(key)) return;
    seen.add(key);
    out.push({ canonical, key });
  };

  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name) continue;
    add(name);
    const parts = name.split(" ").filter(Boolean);
    if (parts[0] && parts[0].length >= 3) add(parts[0]);
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      if (last.length >= 4) add(last);
    }
  }

  return out;
}

function bestTarget(windowKey: string, targets: SpellingTarget[]): SpellingTarget | null {
  if (!windowKey) return null;
  const exact = targets.filter((target) => target.key === windowKey);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const allowed = maxEdits(Math.max(windowKey.length, 3));
  const fuzzy = targets
    .map((target) => ({ target, distance: editDistance(windowKey, target.key) }))
    .filter(({ target, distance }) => {
      if (distance === 0 || distance > allowed) return false;
      const longest = Math.max(windowKey.length, target.key.length);
      return distance / longest <= 0.34;
    })
    .sort((a, b) => a.distance - b.distance || a.target.key.length - b.target.key.length);

  if (fuzzy.length === 0) return null;
  if (fuzzy.length > 1 && fuzzy[0].distance === fuzzy[1].distance) return null;
  return fuzzy[0].target;
}

/**
 * Replace near-miss spoken names with Bran spellings. Leaves common English alone.
 */
export function correctTranscriptSpellings(transcript: string, names: string[]): string {
  if (!transcript.trim() || names.length === 0) return transcript;

  const targets = spellingTargetsFromNames(names);
  if (targets.length === 0) return transcript;

  const parts = transcript.split(/([A-Za-z][A-Za-z']*)/);
  const words: Array<{ index: number; text: string }> = [];
  for (let i = 0; i < parts.length; i += 1) {
    if (/^[A-Za-z][A-Za-z']*$/.test(parts[i])) {
      words.push({ index: i, text: parts[i] });
    }
  }

  const used = new Set<number>();
  for (let w = 0; w < words.length; w += 1) {
    if (used.has(w)) continue;
    const first = words[w];
    const firstNorm = first.text.toLowerCase();
    if (STOPWORDS.has(firstNorm)) continue;

    const second = words[w + 1];
    const secondUsable =
      second &&
      !used.has(w + 1) &&
      !STOPWORDS.has(second.text.toLowerCase()) &&
      parts.slice(first.index + 1, second.index).join("").trim() === "";

    if (secondUsable) {
      const two = bestTarget(collapse(`${first.text}${second.text}`), targets);
      if (two && two.key !== collapse(`${first.text}${second.text}`)) {
        parts[first.index] = two.canonical;
        for (let i = first.index + 1; i <= second.index; i += 1) parts[i] = "";
        used.add(w);
        used.add(w + 1);
        continue;
      }
    }

    const one = bestTarget(collapse(first.text), targets);
    if (one && one.key !== collapse(first.text)) {
      parts[first.index] = one.canonical;
      used.add(w);
    }
  }

  return parts.join("");
}
