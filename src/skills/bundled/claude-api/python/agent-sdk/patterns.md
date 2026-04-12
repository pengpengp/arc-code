# Agent Patterns (Python)

Advanced agent architectures and design patterns for building autonomous agents with Claude.

## 1. ReAct Agent (Reason + Act)

The ReAct pattern interleaves reasoning and action steps.

```python
import anthropic

client = anthropic.Anthropic()

def react_agent(query: str, max_steps: int = 20) -> str:
    system = (
        "You are a reasoning agent. For each step:\n"
        "1. Thought: Think about what to do\n"
        "2. Action: Use a tool if needed\n"
        "3. Observation: See the result\n"
        "Repeat until you can give a final Answer."
    )

    tools = [
        {
            "name": "search",
            "description": "Search for information",
            "input_schema": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
        {
            "name": "calculator",
            "description": "Perform math calculations",
            "input_schema": {
                "type": "object",
                "properties": {"expression": {"type": "string"}},
                "required": ["expression"],
            },
        },
    ]

    messages = [{"role": "user", "content": query}]

    for _ in range(max_steps):
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            tools=tools,
            messages=messages,
        )

        tool_uses = [c for c in response.content if c.type == "tool_use"]
        if not tool_uses:
            text_blocks = [c for c in response.content if c.type == "text"]
            return text_blocks[0].text if text_blocks else ""

        for tool_use in tool_uses:
            result = execute_tool(tool_use.name, tool_use.input)
            messages.append({"role": "assistant", "content": response.content})
            messages.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": result,
                }],
            })

    raise RuntimeError("Max steps exceeded")


def execute_tool(name: str, input_data: dict) -> str:
    if name == "search":
        return f"Search results for '{input_data['query']}'"
    elif name == "calculator":
        return f"Result: {eval(input_data['expression'])}"
    return f"Unknown tool: {name}"
```

## 2. Plan-and-Execute Agent

```python
import json

def plan_and_execute(goal: str) -> str:
    # Phase 1: Planning
    plan = client.messages.create(
        model="claude-opus-4-6-20260101",
        max_tokens=2048,
        system="Create a numbered list of steps. Return ONLY a JSON array.",
        messages=[{"role": "user", "content": f"Goal: {goal}"}],
    )

    steps = json.loads(plan.content[0].text)
    print("Plan:", steps)

    # Phase 2: Execution
    results = []
    for step in steps:
        result = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=f"Execute this step. Previous results: {' | '.join(results)}",
            messages=[{"role": "user", "content": f"Step: {step}"}],
        )
        results.append(result.content[0].text)

    # Phase 3: Synthesis
    final = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system="Synthesize all results into a final answer.",
        messages=[{"role": "user", "content": f"Goal: {goal}\nResults: " + "\n".join(results)}],
    )

    return final.content[0].text
```

## 3. Supervisor/Worker Agent

```python
from dataclasses import dataclass

@dataclass
class Worker:
    name: str
    description: str
    system: str

workers = [
    Worker("researcher", "Finds current information", "You are a research specialist."),
    Worker("writer", "Writes clear prose", "You are a writing specialist."),
    Worker("coder", "Writes and debugs code", "You are a coding specialist."),
]

def supervisor_agent(task: str) -> str:
    # Supervisor decides which worker to use
    worker_list = ", ".join(f"{w.name}: {w.description}" for w in workers)
    decision = client.messages.create(
        model="claude-opus-4-6-20260101",
        max_tokens=512,
        system=f"Choose the best worker. Available: {worker_list}. Respond with ONLY the worker name.",
        messages=[{"role": "user", "content": task}],
    )

    worker_name = decision.content[0].text.strip()
    worker = next((w for w in workers if w.name == worker_name), None)

    if not worker:
        raise ValueError(f"Unknown worker: {worker_name}")

    # Delegate to worker
    result = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=worker.system,
        messages=[{"role": "user", "content": task}],
    )

    return result.content[0].text
```

## 4. Reflexion Agent

```python
def reflexion_agent(task: str, max_iterations: int = 3) -> str:
    draft = ""
    feedback = ""

    for i in range(max_iterations):
        # Generate or revise
        prompt = (
            f"Revise based on feedback:\n{feedback}\n\nPrevious draft:\n{draft}"
            if feedback
            else task
        )

        draft = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system="Generate a first draft." if i == 0 else "Revise the draft.",
            messages=[{"role": "user", "content": prompt}],
        ).content[0].text

        # Self-critique
        critique = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system="Critique this output. List specific improvements. If good enough, say 'APPROVED'.",
            messages=[{"role": "user", "content": draft}],
        )

        feedback = critique.content[0].text
        if "APPROVED" in feedback:
            break

    return draft
```

## 5. Multi-Agent Debate

```python
from concurrent.futures import ThreadPoolExecutor

def debate_agent(question: str) -> str:
    perspectives = [
        "Answer from an optimistic perspective.",
        "Answer from a skeptical perspective.",
        "Answer from a practical perspective.",
    ]

    # Each agent gives their answer in parallel
    def get_response(system: str) -> str:
        result = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": question}],
        )
        return result.content[0].text

    with ThreadPoolExecutor() as executor:
        responses = list(executor.map(get_response, perspectives))

    # Synthesizer
    synthesis = client.messages.create(
        model="claude-opus-4-6-20260101",
        max_tokens=2048,
        system="Synthesize these perspectives into the best possible answer.",
        messages=[{"role": "user", "content": "\n\n".join(
            f"Perspective {i+1}: {r}" for i, r in enumerate(responses)
        )}],
    )

    return synthesis.content[0].text
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
6. Use parallel execution -- when agents are independent, run them concurrently with ThreadPoolExecutor
