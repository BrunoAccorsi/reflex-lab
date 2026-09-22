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
    title: "Model selector",
    eyebrow: "03 / SELECT",
    accent: "gold",
    description:
      "Route a prompt to the model whose documented strengths best fit the work.",
    simulatedAction:
      "Recommend a model for the prompt; no provider request is made by this selector.",
    fields: [
      {
        id: "prompt",
        type: "multiline",
        label: "Prompt to route",
        description: "The task or request that needs a model.",
        required: true,
      },
      {
        id: "constraints",
        type: "multiline",
        label: "Requirements and constraints",
        description:
          "Latency, budget, context, tools, and output requirements.",
        required: true,
      },
    ],
    sampleState: {
      prompt:
        "Review a large TypeScript monorepo, identify the root cause of a production regression, implement the fix, and verify it with tests.",
      constraints:
        "The task may require multiple tool calls and careful code review. Correctness matters more than latency, but avoid the highest-cost model unless its extra depth is justified.",
    },
    questions: [
      {
        id: "model",
        label: "Best-fit model",
        kind: "choice",
        target: staticTarget,
        instructions:
          "Which model best matches the prompt, constraints, and documented capability profile?",
        criteria: {
          claudeOpus:
            "Complex reasoning, deep coding, long-horizon agentic work, code review, and enterprise workflows where quality matters more than speed.",
          claudeFable:
            "The most demanding long-running or autonomous work across many steps, applications, or very large contexts; accept slower latency and highest cost.",
          gptAstra:
            "Hardest end-to-end reasoning, computer use, browsing, software engineering, research, or professional artifact work where broad tools and judgment matter.",
          gptSol:
            "Complex professional reasoning and coding with tools; a strong general-purpose choice when Astra-level breadth is unnecessary.",
          claudeSonnet:
            "The best speed-and-intelligence balance for fast coding, agentic tasks, document work, vision, and everyday production workloads.",
          gptLuna:
            "Cost-sensitive, high-volume workloads where throughput and low per-token cost matter more than frontier reasoning depth.",
          grok46:
            "Coding, agentic tasks, and knowledge work with long context, structured outputs, tool use, or image inputs.",
        },
      },
      scoreQuestion("reasoning", "Reasoning depth required", "reasoning depth"),
      scoreQuestion(
        "agentic",
        "Coding and agentic complexity",
        "coding and agentic complexity",
      ),
      scoreQuestion(
        "context",
        "Context and multimodal complexity",
        "context and multimodal complexity",
      ),
      scoreQuestion(
        "efficiency",
        "Speed and cost sensitivity",
        "speed and cost sensitivity",
      ),
    ],
    policy: {
      metrics: [
        {
          id: "confidence",
          label: "Model match confidence",
          source: {
            questionId: "model",
            signal: "confidence",
            aggregation: "average",
          },
          weight: 1,
          invert: false,
        },
        {
          id: "reasoning",
          label: "Reasoning depth",
          source: {
            questionId: "reasoning",
            signal: "score",
            aggregation: "average",
          },
          weight: 1.2,
          invert: false,
        },
        {
          id: "agentic",
          label: "Coding and agentic complexity",
          source: {
            questionId: "agentic",
            signal: "score",
            aggregation: "average",
          },
          weight: 1.2,
          invert: false,
        },
        {
          id: "context",
          label: "Context and multimodal complexity",
          source: {
            questionId: "context",
            signal: "score",
            aggregation: "average",
          },
          weight: 1,
          invert: false,
        },
        {
          id: "efficiency",
          label: "Speed and cost sensitivity",
          source: {
            questionId: "efficiency",
            signal: "score",
            aggregation: "average",
          },
          weight: 0.8,
          invert: false,
        },
      ],
      rules: [
        {
          id: "review-uncertain",
          label: "Review uncertain model matches",
          all: [
            {
              type: "metric",
              metricId: "confidence",
              operator: "lt",
              value: 0.55,
            },
          ],
          outcome: "review",
          recommendation:
            "Compare the top candidates and review the routing constraints before choosing a model.",
        },
        {
          id: "claude-opus",
          label: "Route to Claude Opus",
          all: [
            {
              type: "selectedChoice",
              questionId: "model",
              operator: "eq",
              value: "claudeOpus",
            },
          ],
          outcome: "review",
          recommendation:
            "Use Claude Opus for deep reasoning, code review, or complex agentic work where quality takes priority.",
        },
        {
          id: "claude-fable",
          label: "Route to Claude Fable",
          all: [
            {
              type: "selectedChoice",
              questionId: "model",
              operator: "eq",
              value: "claudeFable",
            },
          ],
          outcome: "review",
          recommendation:
            "Use Claude Fable for the longest, most autonomous workflows and the largest reasoning-heavy tasks.",
        },
        {
          id: "gpt-astra",
          label: "Route to GPT Astra",
          all: [
            {
              type: "selectedChoice",
              questionId: "model",
              operator: "eq",
              value: "gptAstra",
            },
          ],
          outcome: "review",
          recommendation:
            "Use GPT Astra when the task needs frontier end-to-end reasoning, computer use, browsing, or professional artifacts.",
        },
        {
          id: "gpt-sol",
          label: "Route to GPT Sol",
          all: [
            {
              type: "selectedChoice",
              questionId: "model",
              operator: "eq",
              value: "gptSol",
            },
          ],
          outcome: "review",
          recommendation:
            "Use GPT Sol for complex professional reasoning and coding when a strong generalist is sufficient.",
        },
        {
          id: "claude-sonnet",
          label: "Route to Claude Sonnet",
          all: [
            {
              type: "selectedChoice",
              questionId: "model",
              operator: "eq",
              value: "claudeSonnet",
            },
          ],
          outcome: "review",
          recommendation:
            "Use Claude Sonnet for a fast, capable balance across coding, agentic, document, and vision workloads.",
        },
        {
          id: "gpt-luna",
          label: "Route to GPT Luna",
          all: [
            {
              type: "selectedChoice",
              questionId: "model",
              operator: "eq",
              value: "gptLuna",
            },
          ],
          outcome: "review",
          recommendation:
            "Use GPT Luna for cost-sensitive, high-volume workloads where throughput is the priority.",
        },
        {
          id: "grok-46",
          label: "Route to Grok 4.6",
          all: [
            {
              type: "selectedChoice",
              questionId: "model",
              operator: "eq",
              value: "grok46",
            },
          ],
          outcome: "review",
          recommendation:
            "Use Grok 4.6 for coding, agentic knowledge work, long context, structured outputs, or image inputs.",
        },
      ],
      fallback: {
        outcome: "review",
        recommendation:
          "Review the prompt and constraints before selecting a model.",
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
