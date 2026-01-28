---
layout: post
title: "Paying Down Comprehension Debt with Claude Code"
date: 2026-01-26
description: "Four custom commands I built to help me actually understand the code I'm shipping."
reading_time: 4
---

I've been writing about [comprehension debt](/blog/2026/01/27/comprehension-debt.html)—the gap between what you're using and what you actually understand. It's easy to talk about the problem. Harder to actually do something about it.

So I built some tools.

I use [Claude Code](https://docs.anthropic.com/en/docs/claude-code) as my AI coding assistant. It's fast. It's good. And it makes it *very* easy to accumulate comprehension debt. The code works, I move on, and somewhere along the way I stop being able to explain what I built.

Claude Code supports custom commands—saved prompts you can invoke with a slash. So I created four commands specifically designed to help me pay down comprehension debt as I work.

---

## The Commands

### `/recap`

**When:** End of session, before I walk away.

This is the "wait, what did we just do?" command. I run it before I close my laptop, before I switch contexts, before I forget.

```
Summarize what we built or changed this session. Help me understand it 
well enough that I could explain it to someone else.

1. What changed, in plain language?
2. What were the key decisions, and why?
3. Anything I should know before I walk away—gotchas, assumptions 
   you made, things left incomplete?

Keep it concise. I want the "need to know," not the "nice to know."
```

---

### `/checkpoint`

**When:** Mid-project, when I'm feeling lost or before going deeper.

This is the "am I still following?" command. I use it when a project is getting complex and I want to make sure I understand the foundation before we add more layers.

```
Pause. I want to make sure I understand where we are before we continue.

1. What's the current state of what we're building?
2. What's the approach we're taking, and why this approach over 
   alternatives?
3. Is there anything so far that I should understand better before 
   we go further?

Be honest if I'm accumulating comprehension debt I should pay down now.
```

---

### `/explain [file or feature]`

**When:** I don't understand a specific piece.

This is the deep dive. When there's a file or feature that's a black box to me, I use this to open it up.

```
Explain $ARGUMENTS to me like I need to maintain it myself.

1. What does it do, in plain language?
2. How does it work—walk me through the logic?
3. What are the key things I'd need to understand to debug it if 
   something broke?
4. Any hidden complexity or "here be dragons" areas?
```

---

### `/audit`

**When:** Whole project review—I've been away, or it's grown too big.

This is the nuclear option. When a project has gotten away from me and I need to get my arms around the whole thing.

```
Give me a comprehension audit of this project. I want to understand the 
full picture well enough to take responsibility for it.

1. What does this project do, at a high level?
2. What's the architecture—how do the pieces fit together?
3. What are the 3-5 most important things to understand?
4. Where are the areas of hidden complexity or risk?
5. What assumptions were made that I never explicitly confirmed?
6. If this broke in production, where would I start looking?

Be thorough. I'd rather know what I don't know.
```

---

## How to Set These Up

Claude Code looks for custom commands in `~/.claude/commands/` (global) or `.claude/commands/` (project-specific).

Create a markdown file for each command:

```bash
mkdir -p ~/.claude/commands
```

Then create `recap.md`, `checkpoint.md`, `explain.md`, and `audit.md` with the prompts above.

Once they're in place, you can run them like any slash command:
- `/recap`
- `/checkpoint`
- `/explain auth.js`
- `/audit`

---

## The Habit

The commands are only useful if I actually use them. So I'm trying to build habits:

- **Before I close a project for the day:** `/recap`
- **When things feel complex:** `/checkpoint`
- **When I'm about to ship:** `/audit`

I'm not consistent yet. The temptation to just move on is strong. But having the commands there lowers the friction. It takes five seconds to type `/recap` instead of just closing the terminal.

Five seconds to know what I'm responsible for.

---

*This is part of a series on comprehension debt. Start with [Comprehension Debt](/blog/2026/01/27/comprehension-debt.html), then read [Calibrating Comprehension Debt](/blog/2026/01/28/calibrating-comprehension-debt.html) and [Comprehension Debt in Practice](/blog/2026/01/29/comprehension-debt-in-practice.html).*
