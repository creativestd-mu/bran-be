type ProjectSummary = { id: string; name: string };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score how well a project name matches a candidate string.
 * Returns a value in [0, 1]. Higher is a better match.
 */
function scoreProjectMatch(projectName: string, candidate: string): number {
  const normProject = normalize(projectName);
  const normCandidate = normalize(candidate);

  if (!normProject || !normCandidate) return 0;

  // Exact match
  if (normProject === normCandidate) return 1;

  // One fully contains the other
  if (normCandidate.includes(normProject)) return 0.9;
  if (normProject.includes(normCandidate)) return 0.85;

  // Word-level overlap: fraction of project-name words found in the candidate
  const projectWords = normProject.split(" ").filter(Boolean);
  const candidateWords = new Set(normCandidate.split(" ").filter(Boolean));
  const matchedWords = projectWords.filter((w) => candidateWords.has(w)).length;

  if (matchedWords === 0) return 0;

  return (matchedWords / projectWords.length) * 0.8;
}

/**
 * Find the best-matching project for a given text hint.
 * Returns the project whose name scores highest above the threshold, or null.
 */
function findBestMatch(
  hint: string,
  projects: ProjectSummary[],
  threshold = 0.6
): ProjectSummary | null {
  if (!hint.trim() || projects.length === 0) return null;

  let best: { project: ProjectSummary; score: number } | null = null;

  for (const project of projects) {
    const score = scoreProjectMatch(project.name, hint);
    if (score >= threshold && (!best || score > best.score)) {
      best = { project, score };
    }
  }

  return best?.project ?? null;
}

/**
 * Scan a block of text for any project name that appears in it.
 * Returns the first project whose name is found verbatim (case-insensitive).
 */
function scanTextForProject(
  text: string,
  projects: ProjectSummary[]
): ProjectSummary | null {
  const normText = normalize(text);

  // Sort longer names first so a more specific name wins over a shorter prefix
  const sorted = [...projects].sort((a, b) => b.name.length - a.name.length);

  for (const project of sorted) {
    const normName = normalize(project.name);
    if (normName && normText.includes(normName)) {
      return project;
    }
  }

  return null;
}

/**
 * Resolve a project ID from an AI-extracted work unit.
 *
 * Resolution order:
 * 1. If the LLM returned a `projectName`, fuzzy-match it against the project list.
 * 2. Scan the work unit title and context for any project name mention.
 * 3. Scan the full transcript for any project name mention.
 * 4. Return null if nothing matches.
 */
export function resolveProjectIdFromExtraction(params: {
  projectName?: string | null;
  title: string;
  context: string;
  transcript: string;
  projects: ProjectSummary[];
}): string | null {
  const { projectName, title, context, transcript, projects } = params;

  if (projects.length === 0) return null;

  // 1. LLM-provided project name hint
  if (projectName) {
    const match = findBestMatch(projectName, projects);
    if (match) return match.id;
  }

  // 2. Scan title + context
  const titleContextMatch = scanTextForProject(`${title} ${context}`, projects);
  if (titleContextMatch) return titleContextMatch.id;

  // 3. Scan full transcript
  const transcriptMatch = scanTextForProject(transcript, projects);
  if (transcriptMatch) return transcriptMatch.id;

  return null;
}
