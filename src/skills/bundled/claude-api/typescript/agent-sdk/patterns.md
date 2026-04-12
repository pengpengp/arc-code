# Agent Patterns (TypeScript)

Advanced agent architectures and design patterns for building autonomous agents with Claude.

## 1. ReAct Agent (Reason + Act)

The ReAct pattern interleaves reasoning and action steps, allowing the agent to think before acting and reflect on results.

```typescript
async function reactAgent(query: string): Promise<string> {
  const system = `You are a reasoning agent. For each step:
1. Thought: Think about what to do
2. Action: Use a tool if needed
3. Observation: See the result
Repeat until you can give a final Answer.`;

  const tools = [
    { name: "search", description: "Search for information", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "calculator", description: "Perform math calculations", input_schema: { type: "object", properties: { expression: { type: "string" } }, required: ["expression"] } },
  ];

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: query },
  ];

  for (let i = 0; i < 20; i++) { // Max steps
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      tools,
      messages,
    });

    const toolUses = response.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    if (toolUses.length === 0) {
      return response.content.find((c): c is Anthropic.TextBlock => c.type === "text")?.text ?? "";
    }

    for (const tu of toolUses) {
      const result = await executeTool(tu.name, tu.input);
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: tu.id, content: result }] });
    }
  }

  throw new Error("Max steps exceeded");
}
```

## 2. Plan-and-Execute Agent

Separates planning from execution for complex multi-step tasks.

```typescript
async function planAndExecute(goal: string): Promise<string> {
  // Phase 1: Planning with Opus
  const plan = await client.messages.create({
    model: "claude-opus-4-6-20260101",
    max_tokens: 2048,
    system: "Create a numbered list of steps needed to accomplish the goal.",
    messages: [{ role: "user", content: `Goal: ${goal}` }],
  });

  const steps = JSON.parse(plan.content[0].text);
  console.log("Plan:", steps);

  // Phase 2: Execution with Sonnet
  const results: string[] = [];
  for (const step of steps) {
    const result = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: `Execute this step. Previous results: ${results.join(" | ")}`,
      messages: [{ role: "user", content: `Step: ${step}` }],
    });
    results.push(result.content[0].text);
  }

  // Phase 3: Synthesis
  const final = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: "Synthesize all results into a final answer.",
    messages: [{ role: "user", content: `Goal: ${goal}\nResults: ${results.join("\n")}` }],
  });

  return final.content[0].text;
}
```

## 3. Supervisor/Worker Agent

A supervisor agent delegates tasks to specialized worker agents.

```typescript
interface Worker {
  name: string;
  description: string;
  system: string;
}

const workers: Worker[] = [
  { name: "researcher", description: "Finds current information", system: "You are a research specialist." },
  { name: "writer", description: "Writes clear prose", system: "You are a writing specialist." },
  { name: "coder", description: "Writes and debugs code", system: "You are a coding specialist." },
];

async function supervisorAgent(task: string): Promise<string> {
  // Supervisor decides which worker to use
  const decision = await client.messages.create({
    model: "claude-opus-4-6-20260101",
    max_tokens: 512,
    system: "Choose the best worker. Respond with ONLY the worker name.",
    messages: [{ role: "user", content: task }],
  });

  const workerName = decision.content[0].text.trim();
  const worker = workers.find(w => w.name === workerName);

  if (!worker) {
    throw new Error(`Unknown worker: ${workerName}`);
  }

  // Delegate to worker
  const result = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: worker.system,
    messages: [{ role: "user", content: task }],
  });

  return result.content[0].text;
}
```

## 4. Reflexion Agent

The agent critiques its own output and iterates to improve quality.

```typescript
async function reflexionAgent(task: string, maxIterations = 3): Promise<string> {
  let draft = "";
  let feedback = "";

  for (let i = 0; i < maxIterations; i++) {
    // Generate or revise
    const prompt = feedback
      ? `Revise based on feedback:\n${feedback}\n\nPrevious draft:\n${draft}`
      : task;

    draft = (await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: i === 0 ? "Generate a first draft." : "Revise the draft.",
      messages: [{ role: "user", content: prompt }],
    })).content[0].text;

    // Self-critique
    const critique = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: "Critique this output. List specific improvements needed. If good enough, say 'APPROVED'.",
      messages: [{ role: "user", content: draft }],
    });

    feedback = critique.content[0].text;
    if (feedback.includes("APPROVED")) break;
  }

  return draft;
}
```

## 5. Multi-Agent Debate

Multiple agents with different perspectives debate to reach the best answer.

```typescript
async function debateAgent(question: string): Promise<string> {
  const perspectives = [
    "Answer from an optimistic perspective.",
    "Answer from a skeptical perspective.",
    "Answer from a practical, implementation-focused perspective.",
  ];

  // Each agent gives their answer
  const responses = await Promise.all(
    perspectives.map(async (system) => {
      const result = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: question }],
      });
      return result.content[0].text;
    })
  );

  // Synthesizer picks the best synthesis
  const synthesis = await client.messages.create({
    model: "claude-opus-4-6-20260101",
    max_tokens: 2048,
    system: "Synthesize these perspectives into the best possible answer.",
    messages: [{ role: "user", content: responses.map((r, i) => `Perspective ${i + 1}: ${r}`).join("\n\n") }],
  });

  return synthesis.content[0].text;
}
```

## Choosing a Pattern

| Pattern | Best For | Complexity | Cost |
|---|---|---|---|
| ReAct | Research, Q&A | Low | Medium |
| Plan-and-Execute | Complex multi-step | Medium | High |
| Supervisor/Worker | Heterogeneous tasks | Medium | Medium |
| Reflexion | Quality-critical output | Low-Medium | Medium-High |
| Multi-Agent Debate | Open-ended, nuanced questions | High | High |

## Tips

1. Start simple -- begin with the basic loop pattern, add complexity only when needed
2. Set step limits -- always cap agent iterations to prevent runaway costs
3. Use the right model -- Opus for planning, Sonnet for execution, Haiku for simple classification
4. Monitor token usage -- track input/output tokens to control costs
5. Cache when possible -- system prompts and tool definitions are good cache candidates
