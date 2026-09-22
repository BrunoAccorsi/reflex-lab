import type {
  ExperimentDefinitionV1,
  QuestionDefinition,
} from "@/lib/experiments";

const staticTarget = { type: "static" as const };
const recordsTarget = (fieldId: string) => ({
  type: "records" as const,
  fieldId,
});
const levels = (noun: string) => [
  {
    label: "Very low",
    description: `Almost no ${noun} is supported by the evidence.`,
  },
  {
    label: "Low",
    description: `Limited ${noun} is supported by the evidence.`,
  },
  {
    label: "Moderate",
    description: `Mixed or moderate ${noun} is supported by the evidence.`,
  },
  {
    label: "High",
    description: `Strong ${noun} is supported by the evidence.`,
  },
  {
    label: "Very high",
    description: `Exceptional ${noun} is supported by the evidence.`,
  },
];
const scoreQuestion = (
  id: string,
  label: string,
  noun: string,
  target: QuestionDefinition["target"] = staticTarget,
) => ({
  id,
  label,
  kind: "score" as const,
  target,
  instructions: `${label} Use only the supplied evidence and select the closest ordered level.`,
  levels: levels(noun),
});
const noulQuestion = (
  id: string,
  label: string,
  yes: string,
  no: string,
  target: QuestionDefinition["target"] = staticTarget,
) => ({
  id,
  label,
  kind: "noul" as const,
  target,
  instructions: label,
  criteria: { true: yes, false: no },
});

export const rawDefinitions: ExperimentDefinitionV1[] = [
  {
    version: 1,
    id: "support-orchestration",
    title: "Support orchestration",
    eyebrow: "01 / ROUTE",
    accent: "coral",
    description:
      "Turn a customer message into a transparent route, escalation, and follow-up policy.",
    simulatedAction:
      "Create a simulated route, copy secondary teams, or hold for human clarification.",
    fields: [
      {
        id: "ticket",
        type: "multiline",
        label: "Ticket text",
        description: "The latest customer message.",
        required: true,
      },
      {
        id: "context",
        type: "multiline",
        label: "Account context",
        description: "Plan, history, and operational context.",
        required: true,
      },
    ],
    sampleState: {
      ticket:
        "I was charged twice and need one payment reversed today. This is my second message.",
      context:
        "Active Pro plan. Two identical charges posted five minutes apart. No credentials were included.",
    },
    questions: [
      {
        id: "topic",
        label: "Primary topic",
        kind: "choice",
        target: staticTarget,
        instructions: "Which team owns the primary issue?",
        criteria: {
          billing: "Charges, invoices, refunds, or payment methods.",
          technical: "Product behavior, defects, or integrations.",
          account: "Identity, access, plan, or profile changes.",
          general: "No specialist category is clearly supported.",
        },
      },
      {
        id: "resolution",
        label: "Requested resolution",
        kind: "choice",
        target: staticTarget,
        instructions: "What resolution is the customer asking for?",
        criteria: {
          refund: "Return a payment or reverse a charge.",
          troubleshoot: "Diagnose or fix product behavior.",
          explain: "Provide information or an explanation.",
          change: "Modify account, plan, or settings.",
        },
      },
      {
        id: "tone",
        label: "Customer tone",
        kind: "choice",
        target: staticTarget,
        instructions: "Which tone is most evident?",
        criteria: {
          calm: "Neutral and factual.",
          concerned: "Worried or seeking reassurance.",
          frustrated: "Dissatisfied or repeating an unresolved request.",
          hostile: "Threatening or abusive language.",
        },
      },
      scoreQuestion("urgency", "Operational urgency", "urgency"),
      noulQuestion(
        "humanEscalation",
        "Does this require human escalation?",
        "Policy, exception, or customer harm requires a person.",
        "A standard automated workflow can safely continue.",
      ),
      noulQuestion(
        "repeatContact",
        "Is this a repeat contact?",
        "The state says the customer contacted support before about this issue.",
        "No repeat contact is supported.",
      ),
      noulQuestion(
        "credentialRisk",
        "Are sensitive credentials exposed?",
        "Passwords, tokens, full payment details, or secrets appear.",
        "No sensitive credentials appear.",
      ),
    ],
    policy: {
      metrics: [
        {
          id: "urgency",
          label: "Urgency",
          source: {
            questionId: "urgency",
            signal: "score",
            aggregation: "average",
          },
          weight: 1,
          invert: false,
        },
        {
          id: "escalation",
          label: "Human escalation",
          source: {
            questionId: "humanEscalation",
            signal: "noul",
            aggregation: "average",
          },
          weight: 1.2,
          invert: false,
        },
        {
          id: "repeat",
          label: "Repeat contact",
          source: {
            questionId: "repeatContact",
            signal: "noul",
            aggregation: "average",
          },
          weight: 0.6,
          invert: false,
        },
        {
          id: "credential",
          label: "Credential exposure",
          source: {
            questionId: "credentialRisk",
            signal: "noul",
            aggregation: "average",
          },
          weight: 1.5,
          invert: false,
        },
      ],
      rules: [
        {
          id: "protect-secrets",
          label: "Protect exposed credentials",
          all: [
            {
              type: "metric",
              metricId: "credential",
              operator: "gte",
              value: 0.55,
            },
          ],
          outcome: "stop",
          recommendation:
            "Stop automation and send the ticket to the security-aware support queue.",
        },
        {
          id: "escalate",
          label: "Escalate complex or urgent cases",
          all: [
            {
              type: "metric",
              metricId: "escalation",
              operator: "gte",
              value: 0.65,
            },
          ],
          outcome: "review",
          recommendation:
            "Route to the selected team and require a human owner.",
        },
        {
          id: "billing-route",
          label: "Automate standard billing route",
          all: [
            {
              type: "selectedChoice",
              questionId: "topic",
              operator: "eq",
              value: "billing",
            },
            {
              type: "metric",
              metricId: "credential",
              operator: "lt",
              value: 0.55,
            },
          ],
          outcome: "act",
          recommendation:
            "Route to Billing and attach the requested-resolution signal.",
        },
      ],
      fallback: {
        outcome: "review",
        recommendation:
          "Route to the selected team and ask an agent to verify the resolution.",
      },
    },
  },
  {
    version: 1,
    id: "tool-safety",
    title: "Tool-call safety gate",
    eyebrow: "02 / GUARD",
    accent: "ink",
    description:
      "Combine action selection, ordered risk, and explicit safety checks before simulated execution.",
    simulatedAction:
      "Record proceed, confirm, or stop; no real tool or computer action is performed.",
    fields: [
      {
        id: "screen",
        type: "multiline",
        label: "Observed state",
        description: "What is visible in the application.",
        required: true,
      },
      {
        id: "goal",
        type: "multiline",
        label: "User goal",
        description: "The authorized outcome.",
        required: true,
      },
    ],
    sampleState: {
      screen:
        "A workspace settings form is open. Save affects all members and there is no undo notice.",
      goal: "Save only after confirming the workspace-wide impact is understood.",
    },
    questions: [
      {
        id: "action",
        label: "Next safe action",
        kind: "choice",
        target: staticTarget,
        instructions: "Choose the safest useful next action.",
        criteria: {
          proceed:
            "The requested action is authorized, bounded, and safe to execute.",
          confirm: "A material consequence needs explicit confirmation.",
          inspect: "More state must be inspected before deciding.",
          stop: "The action should not proceed.",
        },
      },
      scoreQuestion("risk", "Action risk", "risk"),
      noulQuestion(
        "authorized",
        "Is the action explicitly authorized?",
        "The user clearly authorized this exact action and scope.",
        "Authorization is absent, ambiguous, or narrower.",
      ),
      noulQuestion(
        "destructive",
        "Can the action cause destructive impact?",
        "It can delete, overwrite, publish, pay, or materially change shared state.",
        "It is read-only or safely non-destructive.",
      ),
      noulQuestion(
        "reversible",
        "Is the action readily reversible?",
        "A reliable undo or recovery path is clear.",
        "Recovery is missing, uncertain, or costly.",
      ),
      noulQuestion(
        "scopeClear",
        "Is the affected scope clear?",
        "The exact target and blast radius are explicit.",
        "The target or blast radius is ambiguous.",
      ),
    ],
    policy: {
      metrics: [
        {
          id: "risk",
          label: "Risk",
          source: {
            questionId: "risk",
            signal: "score",
            aggregation: "average",
          },
          weight: 1.2,
          invert: false,
        },
        {
          id: "authorization",
          label: "Authorization",
          source: {
            questionId: "authorized",
            signal: "noul",
            aggregation: "average",
          },
          weight: 1,
          invert: false,
        },
        {
          id: "destructive",
          label: "Destructiveness",
          source: {
            questionId: "destructive",
            signal: "noul",
            aggregation: "average",
          },
          weight: 1.3,
          invert: false,
        },
        {
          id: "reversibility",
          label: "Reversibility",
          source: {
            questionId: "reversible",
            signal: "noul",
            aggregation: "average",
          },
          weight: 0.8,
          invert: false,
        },
        {
          id: "scope",
          label: "Scope clarity",
          source: {
            questionId: "scopeClear",
            signal: "noul",
            aggregation: "average",
          },
          weight: 1,
          invert: false,
        },
      ],
      rules: [
        {
          id: "stop-unauthorized",
          label: "Stop unauthorized action",
          all: [
            {
              type: "metric",
              metricId: "authorization",
              operator: "lt",
              value: 0.6,
            },
          ],
          outcome: "stop",
          recommendation:
            "Stop because authorization is not sufficiently supported.",
        },
        {
          id: "confirm-destructive",
          label: "Confirm destructive action",
          all: [
            {
              type: "metric",
              metricId: "destructive",
              operator: "gte",
              value: 0.55,
            },
            {
              type: "metric",
              metricId: "reversibility",
              operator: "lt",
              value: 0.65,
            },
          ],
          outcome: "review",
          recommendation:
            "Ask for explicit confirmation before the simulated action.",
        },
        {
          id: "proceed",
          label: "Proceed when bounded",
          all: [
            {
              type: "metric",
              metricId: "authorization",
              operator: "gte",
              value: 0.6,
            },
            { type: "metric", metricId: "scope", operator: "gte", value: 0.65 },
            { type: "metric", metricId: "risk", operator: "lt", value: 0.55 },
          ],
          outcome: "act",
          recommendation: "Proceed with the selected simulated action.",
        },
      ],
      fallback: {
        outcome: "review",
        recommendation:
          "Inspect details or ask for confirmation before proceeding.",
      },
    },
  },
  {
    version: 1,
    id: "opportunity-scorecard",
    title: "Opportunity scorecard",
    eyebrow: "03 / SCORE",
    accent: "gold",
    description:
      "Compose several ordered judgments into an editable, inspectable opportunity score.",
    simulatedAction:
      "Place the opportunity in an explore, validate, or pursue band.",
    fields: [
      {
        id: "opportunity",
        type: "multiline",
        label: "Opportunity brief",
        description: "Problem, audience, and proposed solution.",
        required: true,
      },
      {
        id: "evidence",
        type: "multiline",
        label: "Available evidence",
        description: "Research, demand, constraints, and estimates.",
        required: true,
      },
    ],
    sampleState: {
      opportunity:
        "Add team-level usage budgets and alerts for growing accounts.",
      evidence:
        "18 interviews; 11 teams track spend manually. Two enterprise renewals cite cost controls. Estimated six engineering weeks.",
    },
    questions: [
      scoreQuestion("impact", "Potential customer impact", "customer impact"),
      scoreQuestion("evidence", "Evidence strength", "evidence strength"),
      scoreQuestion("fit", "Strategic fit", "strategic fit"),
      scoreQuestion("effort", "Implementation effort", "implementation effort"),
      scoreQuestion("risk", "Delivery and adoption risk", "risk"),
    ],
    policy: {
      metrics: [
        {
          id: "impact",
          label: "Impact",
          source: {
            questionId: "impact",
            signal: "score",
            aggregation: "average",
          },
          weight: 1.5,
          invert: false,
        },
        {
          id: "evidence",
          label: "Evidence",
          source: {
            questionId: "evidence",
            signal: "score",
            aggregation: "average",
          },
          weight: 1.3,
          invert: false,
        },
        {
          id: "fit",
          label: "Strategic fit",
          source: {
            questionId: "fit",
            signal: "score",
            aggregation: "average",
          },
          weight: 1.2,
          invert: false,
        },
        {
          id: "effort",
          label: "Low effort",
          source: {
            questionId: "effort",
            signal: "score",
            aggregation: "average",
          },
          weight: 0.9,
          invert: true,
        },
        {
          id: "risk",
          label: "Low risk",
          source: {
            questionId: "risk",
            signal: "score",
            aggregation: "average",
          },
          weight: 0.8,
          invert: true,
        },
      ],
      rules: [
        {
          id: "pursue",
          label: "Pursue strong opportunities",
          all: [
            {
              type: "metric",
              metricId: "impact",
              operator: "gte",
              value: 0.65,
            },
            {
              type: "metric",
              metricId: "evidence",
              operator: "gte",
              value: 0.55,
            },
          ],
          outcome: "act",
          recommendation:
            "Move the opportunity into discovery and delivery planning.",
        },
        {
          id: "validate",
          label: "Validate weak evidence",
          all: [
            {
              type: "metric",
              metricId: "evidence",
              operator: "lt",
              value: 0.55,
            },
          ],
          outcome: "review",
          recommendation:
            "Run a focused validation step before committing capacity.",
        },
      ],
      fallback: {
        outcome: "review",
        recommendation:
          "Keep the opportunity in exploration and resolve the weakest score.",
      },
    },
  },
  {
    version: 1,
    id: "candidate-matching",
    title: "Candidate-role matching",
    eyebrow: "04 / MATCH",
    accent: "lavender",
    description:
      "Compare the same evidence-based fit questions across candidates without automating a hiring decision.",
    simulatedAction:
      "Rank evidence for recruiter review; never hire or reject automatically.",
    fields: [
      {
        id: "role",
        type: "multiline",
        label: "Role requirements",
        description: "Outcomes, skills, and constraints.",
        required: true,
      },
      {
        id: "candidates",
        type: "records",
        label: "Candidates",
        description: "Evidence summaries for comparison.",
        required: true,
        minItems: 2,
        maxItems: 6,
        recordLabelField: "name",
        columns: [
          { id: "name", label: "Name", multiline: false },
          { id: "evidence", label: "Evidence", multiline: true },
        ],
      },
    ],
    sampleState: {
      role: "Senior product engineer: TypeScript, systems design, cross-functional delivery, and mentoring.",
      candidates: [
        {
          name: "Alex",
          evidence:
            "Led TypeScript platform migration; mentored four engineers; limited product discovery examples.",
        },
        {
          name: "Jordan",
          evidence:
            "Shipped three cross-functional products; strong customer discovery; moderate systems design depth.",
        },
      ],
    },
    questions: [
      scoreQuestion(
        "skillsFit",
        "Required-skills fit",
        "skills fit",
        recordsTarget("candidates"),
      ),
      scoreQuestion(
        "outcomesFit",
        "Outcome evidence",
        "outcome evidence",
        recordsTarget("candidates"),
      ),
      scoreQuestion(
        "collaborationFit",
        "Collaboration evidence",
        "collaboration evidence",
        recordsTarget("candidates"),
      ),
      noulQuestion(
        "evidenceSufficient",
        "Is the evidence sufficient for the claimed fit?",
        "Specific, relevant evidence supports the assessment.",
        "Evidence is missing, vague, or not comparable.",
        recordsTarget("candidates"),
      ),
    ],
    policy: {
      metrics: [
        {
          id: "skills",
          label: "Skills fit",
          source: {
            questionId: "skillsFit",
            signal: "score",
            aggregation: "average",
          },
          weight: 1.3,
          invert: false,
        },
        {
          id: "outcomes",
          label: "Outcome evidence",
          source: {
            questionId: "outcomesFit",
            signal: "score",
            aggregation: "average",
          },
          weight: 1.3,
          invert: false,
        },
        {
          id: "collaboration",
          label: "Collaboration",
          source: {
            questionId: "collaborationFit",
            signal: "score",
            aggregation: "average",
          },
          weight: 1,
          invert: false,
        },
        {
          id: "evidence",
          label: "Evidence sufficiency",
          source: {
            questionId: "evidenceSufficient",
            signal: "noul",
            aggregation: "average",
          },
          weight: 1.4,
          invert: false,
        },
      ],
      rules: [
        {
          id: "human-review",
          label: "Require human review",
          all: [
            { type: "metric", metricId: "evidence", operator: "gte", value: 0 },
          ],
          outcome: "review",
          recommendation:
            "Review the ranked evidence with a recruiter and structured interview panel.",
        },
      ],
      fallback: {
        outcome: "review",
        recommendation: "Collect comparable evidence before further review.",
      },
    },
    ranking: {
      fieldId: "candidates",
      label: "Candidate evidence ranking",
      metrics: ["skills", "outcomes", "collaboration", "evidence"],
    },
  },
  {
    version: 1,
    id: "response-audit",
    title: "Response quality audit",
    eyebrow: "05 / AUDIT",
    accent: "sky",
    description:
      "Audit a drafted response with independent probabilistic checks and explicit release rules.",
    simulatedAction: "Pass, hold for review, or block the drafted response.",
    fields: [
      {
        id: "request",
        type: "multiline",
        label: "Original request",
        description: "What the response must satisfy.",
        required: true,
      },
      {
        id: "response",
        type: "multiline",
        label: "Drafted response",
        description: "The response being audited.",
        required: true,
      },
      {
        id: "sources",
        type: "multiline",
        label: "Grounding context",
        description: "Allowed source material or facts.",
        required: true,
      },
    ],
    sampleState: {
      request: "Summarize the incident and provide safe next steps.",
      response:
        "The outage was caused by an expired certificate. Rotate it, restart the gateway, and notify customers.",
      sources:
        "Incident note: gateway certificate expired at 09:14 UTC. Rotation restored traffic at 09:31 UTC. Customer notice is pending approval.",
    },
    questions: [
      noulQuestion(
        "coverage",
        "Does the response cover the request?",
        "All requested parts are materially addressed.",
        "One or more requested parts are missing.",
      ),
      noulQuestion(
        "grounded",
        "Is the response grounded in the supplied context?",
        "Material claims are supported by the context.",
        "Material claims lack support.",
      ),
      noulQuestion(
        "contradiction",
        "Does the response contradict the context?",
        "At least one material claim conflicts with the context.",
        "No material contradiction is present.",
      ),
      noulQuestion(
        "unsupported",
        "Does the response contain unsupported claims?",
        "A factual claim is not supported by the context.",
        "Claims are supported or clearly qualified.",
      ),
      noulQuestion(
        "sensitive",
        "Does the response expose sensitive data?",
        "Secrets, credentials, private identifiers, or restricted data appear.",
        "No sensitive data appears.",
      ),
      noulQuestion(
        "unsafe",
        "Does the response recommend an unsafe action?",
        "An action could cause material harm without safeguards.",
        "Recommended actions are appropriately bounded and safe.",
      ),
    ],
    policy: {
      metrics: [
        {
          id: "coverage",
          label: "Coverage",
          source: {
            questionId: "coverage",
            signal: "noul",
            aggregation: "average",
          },
          weight: 1,
          invert: false,
        },
        {
          id: "grounding",
          label: "Grounding",
          source: {
            questionId: "grounded",
            signal: "noul",
            aggregation: "average",
          },
          weight: 1.2,
          invert: false,
        },
        {
          id: "contradiction",
          label: "Contradiction risk",
          source: {
            questionId: "contradiction",
            signal: "noul",
            aggregation: "average",
          },
          weight: 1.5,
          invert: false,
        },
        {
          id: "unsupported",
          label: "Unsupported-claim risk",
          source: {
            questionId: "unsupported",
            signal: "noul",
            aggregation: "average",
          },
          weight: 1.2,
          invert: false,
        },
        {
          id: "sensitive",
          label: "Sensitive-data risk",
          source: {
            questionId: "sensitive",
            signal: "noul",
            aggregation: "average",
          },
          weight: 2,
          invert: false,
        },
        {
          id: "unsafe",
          label: "Unsafe-action risk",
          source: {
            questionId: "unsafe",
            signal: "noul",
            aggregation: "average",
          },
          weight: 2,
          invert: false,
        },
      ],
      rules: [
        {
          id: "block-sensitive",
          label: "Block sensitive or unsafe output",
          all: [
            {
              type: "metric",
              metricId: "sensitive",
              operator: "gte",
              value: 0.5,
            },
          ],
          outcome: "stop",
          recommendation: "Block release and remove sensitive material.",
        },
        {
          id: "block-unsafe",
          label: "Block unsafe action",
          all: [
            { type: "metric", metricId: "unsafe", operator: "gte", value: 0.5 },
          ],
          outcome: "stop",
          recommendation:
            "Block release and add safeguards or remove the action.",
        },
        {
          id: "pass",
          label: "Pass grounded coverage",
          all: [
            {
              type: "metric",
              metricId: "coverage",
              operator: "gte",
              value: 0.7,
            },
            {
              type: "metric",
              metricId: "grounding",
              operator: "gte",
              value: 0.7,
            },
            {
              type: "metric",
              metricId: "unsupported",
              operator: "lt",
              value: 0.4,
            },
          ],
          outcome: "act",
          recommendation: "Pass the response for simulated release.",
        },
      ],
      fallback: {
        outcome: "review",
        recommendation: "Hold the response for a focused quality review.",
      },
    },
  },
  {
    version: 1,
    id: "github-prioritization",
    title: "GitHub backlog prioritization",
    eyebrow: "06 / RANK",
    accent: "moss",
    description:
      "Apply the same urgency, impact, and readiness rubric across several issues and rank the result.",
    simulatedAction:
      "Produce a reviewable issue leaderboard without changing GitHub.",
    fields: [
      {
        id: "repository",
        type: "multiline",
        label: "Repository context",
        description: "Goals, ownership, and release constraints.",
        required: true,
      },
      {
        id: "issues",
        type: "records",
        label: "Issues",
        description: "Issues to compare with one rubric.",
        required: true,
        minItems: 2,
        maxItems: 8,
        recordLabelField: "title",
        columns: [
          { id: "title", label: "Title", multiline: false },
          { id: "body", label: "Issue body", multiline: true },
        ],
      },
    ],
    sampleState: {
      repository:
        "Checkout team. Production reliability is the current goal; release freeze begins Friday.",
      issues: [
        {
          title: "500 after billing-country change",
          body: "Reproduced in production for 14 customers; checkout is blocked.",
        },
        {
          title: "Add saved filters",
          body: "Requested by three internal users; design is ready.",
        },
        {
          title: "Clarify tax docs",
          body: "Documentation is stale after the last release.",
        },
      ],
    },
    questions: [
      scoreQuestion(
        "impact",
        "User and business impact",
        "impact",
        recordsTarget("issues"),
      ),
      scoreQuestion(
        "urgency",
        "Time urgency",
        "urgency",
        recordsTarget("issues"),
      ),
      scoreQuestion(
        "readiness",
        "Implementation readiness",
        "readiness",
        recordsTarget("issues"),
      ),
      noulQuestion(
        "production",
        "Is production currently affected?",
        "The issue describes active production impact.",
        "No active production impact is supported.",
        recordsTarget("issues"),
      ),
      noulQuestion(
        "blocked",
        "Are users blocked from a core workflow?",
        "Users cannot complete a core workflow.",
        "A workaround exists or the workflow is non-core.",
        recordsTarget("issues"),
      ),
    ],
    policy: {
      metrics: [
        {
          id: "impact",
          label: "Impact",
          source: {
            questionId: "impact",
            signal: "score",
            aggregation: "average",
          },
          weight: 1.5,
          invert: false,
        },
        {
          id: "urgency",
          label: "Urgency",
          source: {
            questionId: "urgency",
            signal: "score",
            aggregation: "average",
          },
          weight: 1.4,
          invert: false,
        },
        {
          id: "readiness",
          label: "Readiness",
          source: {
            questionId: "readiness",
            signal: "score",
            aggregation: "average",
          },
          weight: 0.7,
          invert: false,
        },
        {
          id: "production",
          label: "Production impact",
          source: {
            questionId: "production",
            signal: "noul",
            aggregation: "average",
          },
          weight: 1.4,
          invert: false,
        },
        {
          id: "blocked",
          label: "Workflow blocked",
          source: {
            questionId: "blocked",
            signal: "noul",
            aggregation: "average",
          },
          weight: 1.3,
          invert: false,
        },
      ],
      rules: [
        {
          id: "expedite",
          label: "Expedite production blockers",
          all: [
            {
              type: "metric",
              metricId: "production",
              operator: "gte",
              value: 0.65,
            },
            {
              type: "metric",
              metricId: "blocked",
              operator: "gte",
              value: 0.65,
            },
          ],
          outcome: "act",
          recommendation:
            "Move the top production blocker into expedited triage.",
        },
        {
          id: "review",
          label: "Review high-impact work",
          all: [
            { type: "metric", metricId: "impact", operator: "gte", value: 0.6 },
          ],
          outcome: "review",
          recommendation:
            "Review the ranked top issues in the next triage session.",
        },
      ],
      fallback: {
        outcome: "review",
        recommendation: "Keep the ranked list for normal backlog triage.",
      },
    },
    ranking: {
      fieldId: "issues",
      label: "Issue priority ranking",
      metrics: ["impact", "urgency", "readiness", "production", "blocked"],
    },
  },
];
