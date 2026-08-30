export const SLACK_INTENT_IDS = [
  "add_task",
  "list_tasks",
  "sentiment",
  "competitors",
  "pods",
  "ideas",
  "calendar",
  "review"
] as const;

export type SlackIntentId = (typeof SLACK_INTENT_IDS)[number];

export type SlackIntentDefinition = {
  id: SlackIntentId;
  label: string;
  description: string;
  examples: string[];
  /** Ideas are DM-only; others work in DM or @Bran channel. */
  dmOnly?: boolean;
};

export const SLACK_INTENT_CATALOG: SlackIntentDefinition[] = [
  {
    id: "add_task",
    label: "Add a Task",
    description:
      "Create one or more work units / tasks from the message, optionally assigned to a teammate.",
    examples: [
      "add a task for Sudeep: storage and documentation management",
      "create a task for me to finish the deck",
      "add task for everyone here: read this article",
      "log a work unit — follow up with Nagpal on Munim ji",
      "assign Dhananjay to complete Google Drive search",
      "add these tasks: 1) research video search 2) show brand to Neha"
    ]
  },
  {
    id: "list_tasks",
    label: "List Tasks",
    description: "Show open or overdue tasks for the requester or a tagged teammate.",
    examples: [
      "what are my tasks today",
      "show my open tasks",
      "list tasks for this week",
      "overdue tasks",
      "what does @Amisha have open"
    ]
  },
  {
    id: "sentiment",
    label: "Brand Sentiment",
    description: "Earned media / brand mention volume, reach, and sentiment from Meltwater.",
    examples: [
      "sentiment this week",
      "brand mentions last month",
      "press coverage yesterday",
      "how is Masters Union sentiment",
      "earned media this month"
    ]
  },
  {
    id: "competitors",
    label: "Competitor Coverage",
    description: "Competitor earned-media impact and notable coverage.",
    examples: [
      "competitor coverage this week",
      "what are competitors saying",
      "competitor sentiment last 7 days",
      "impactful competitor content"
    ]
  },
  {
    id: "pods",
    label: "Pods / Inspiration",
    description: "Pod IP, social inspiration, or recent posts from tracked pods.",
    examples: [
      "pod inspiration this week",
      "what are the pods posting",
      "show pod IP from Instagram",
      "latest pod content"
    ]
  },
  {
    id: "ideas",
    label: "Private Ideas",
    description: "Add or list the requester’s private ideas (DM only).",
    dmOnly: true,
    examples: [
      "I have an idea: searchable video clips across platforms",
      "idea: build a docs vault for Creative Studio",
      "my ideas",
      "list my ideas",
      "save this idea: Munim ji claim flow"
    ]
  },
  {
    id: "calendar",
    label: "Calendar / Book a Call",
    description: "Book a call with a teammate or show today’s calendar agenda.",
    examples: [
      "book a call with Amisha tomorrow",
      "schedule a meeting with Dhananjay",
      "what’s on my calendar today",
      "today’s agenda",
      "find a slot with Nagpal this week"
    ]
  },
  {
    id: "review",
    label: "Reviews",
    description: "Show pending review requests to act on, or status of reviews you raised.",
    examples: [
      "my reviews",
      "pending reviews",
      "list my reviews",
      "reviews waiting for me",
      "review status"
    ]
  }
];

const byId = new Map(SLACK_INTENT_CATALOG.map((entry) => [entry.id, entry]));

export function getSlackIntent(id: string): SlackIntentDefinition | undefined {
  return byId.get(id as SlackIntentId);
}

export function isSlackIntentId(value: string): value is SlackIntentId {
  return byId.has(value as SlackIntentId);
}

export function slackIntentLabel(id: string): string {
  return getSlackIntent(id)?.label ?? id;
}
