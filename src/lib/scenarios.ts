import { z } from "zod";

export const scenarioIdSchema = z.enum([
  "support-triage",
  "inbox-organization",
  "download-organization",
  "github-triage",
  "computer-use",
]);

export type ScenarioId = z.infer<typeof scenarioIdSchema>;
export type QuestionKind = "choice" | "score" | "boolean";

export type ScenarioField = {
  id: string;
  label: string;
  description: string;
  multiline?: boolean;
};

export type ScenarioQuestion = {
  id: string;
  label: string;
  kind: QuestionKind;
  options?: readonly string[];
};

export type Scenario = {
  id: ScenarioId;
  title: string;
  eyebrow: string;
  description: string;
  accent: "coral" | "sky" | "lavender" | "moss" | "ink";
  fields: readonly ScenarioField[];
  sample: Record<string, string>;
  questions: readonly ScenarioQuestion[];
  simulatedAction: string;
};

export const scenarios: readonly Scenario[] = [
  {
    id: "support-triage",
    title: "Support-ticket triage",
    eyebrow: "01 / ROUTE",
    description: "Route a customer issue to the team most likely to resolve it quickly.",
    accent: "coral",
    fields: [
      { id: "ticket", label: "Ticket text", description: "The latest customer message.", multiline: true },
      { id: "context", label: "Account context", description: "Optional context from the support system.", multiline: true },
    ],
    sample: {
      ticket: "I was charged twice for my subscription and need one of the payments reversed.",
      context: "Customer has an active Pro plan. Two identical charges posted within five minutes.",
    },
    questions: [
      { id: "team", label: "Which team should handle this ticket?", kind: "choice", options: ["billing", "technical", "account", "general"] },
      { id: "urgency", label: "How urgent is the issue?", kind: "score" },
      { id: "refund", label: "Does the customer request a refund?", kind: "boolean" },
    ],
    simulatedAction: "Create a routed support task for the winning team.",
  },
  {
    id: "inbox-organization",
    title: "Email and notification organization",
    eyebrow: "02 / PRIORITIZE",
    description: "Decide where a noisy message belongs before it interrupts the day.",
    accent: "sky",
    fields: [
      { id: "message", label: "Message preview", description: "Subject and body excerpt.", multiline: true },
      { id: "sender", label: "Sender profile", description: "Who sent it and how often.", multiline: true },
    ],
    sample: {
      message: "Your weekly product digest is ready. See the five updates the team shipped this week.",
      sender: "notifications@product.example · recurring weekly digest · no direct reply expected",
    },
    questions: [
      { id: "destination", label: "Where should this message go?", kind: "choice", options: ["inbox", "archive", "read-later", "unsubscribe"] },
      { id: "importance", label: "How important is this message?", kind: "score" },
      { id: "action", label: "Does this message require a reply?", kind: "boolean" },
    ],
    simulatedAction: "Apply the winning label and move the message to its destination.",
  },
  {
    id: "download-organization",
    title: "Download and document organization",
    eyebrow: "03 / FILE",
    description: "Classify a downloaded file and choose a safe filing destination.",
    accent: "lavender",
    fields: [
      { id: "filename", label: "Filename", description: "Name and extension of the downloaded file." },
      { id: "source", label: "Download source", description: "The page or application that created it.", multiline: true },
    ],
    sample: {
      filename: "2026-Q3-invoice-ACME.pdf",
      source: "Downloaded from the billing portal after renewing a software subscription.",
    },
    questions: [
      { id: "folder", label: "Which folder should receive this file?", kind: "choice", options: ["finance", "work", "personal", "review"] },
      { id: "sensitivity", label: "How sensitive is this document?", kind: "score" },
      { id: "rename", label: "Should the file be renamed to a standard format?", kind: "boolean" },
    ],
    simulatedAction: "Move the file into the winning folder with the suggested naming policy.",
  },
  {
    id: "github-triage",
    title: "GitHub issue triage",
    eyebrow: "04 / LABEL",
    description: "Prioritize an issue and suggest the engineering area that owns it.",
    accent: "moss",
    fields: [
      { id: "issue", label: "Issue body", description: "The issue title and description.", multiline: true },
      { id: "repository", label: "Repository context", description: "Team ownership and recent release context.", multiline: true },
    ],
    sample: {
      issue: "Checkout fails with a 500 after a customer changes the billing country. Reproduced in production.",
      repository: "web-app · checkout squad owns payments and tax integrations · release freeze starts Friday",
    },
    questions: [
      { id: "label", label: "Which label best describes this issue?", kind: "choice", options: ["bug", "feature", "documentation", "question"] },
      { id: "priority", label: "How severe is the issue?", kind: "score" },
      { id: "escalate", label: "Should this issue be escalated immediately?", kind: "boolean" },
    ],
    simulatedAction: "Add the winning labels and place the issue in the suggested triage queue.",
  },
  {
    id: "computer-use",
    title: "Simulated computer-use action selection",
    eyebrow: "05 / ACT",
    description: "Choose the next safe UI action without controlling a real browser or computer.",
    accent: "ink",
    fields: [
      { id: "screen", label: "Screen state", description: "What is visible in the simulated application.", multiline: true },
      { id: "goal", label: "User goal", description: "The outcome the user asked for.", multiline: true },
    ],
    sample: {
      screen: "A settings form is open. The Save button is enabled. A warning says changes affect all workspace members.",
      goal: "Save the change only after confirming the destructive scope is understood.",
    },
    questions: [
      { id: "action", label: "What should the assistant do next?", kind: "choice", options: ["click-save", "ask-confirmation", "inspect-details", "stop"] },
      { id: "risk", label: "How risky is the next action?", kind: "score" },
      { id: "reversible", label: "Is the next action safely reversible?", kind: "boolean" },
    ],
    simulatedAction: "Record the selected action in the simulator; no real computer control is performed.",
  },
];

export const scenarioRegistry = scenarios.reduce((registry, scenario) => {
  registry[scenario.id] = scenario;
  return registry;
}, {} as Record<ScenarioId, Scenario>);

export function getScenario(id: ScenarioId): Scenario {
  return scenarioRegistry[id];
}
