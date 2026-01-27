---
layout: post
title: "Calibrating Comprehension Debt"
date: 2026-01-28
description: "A framework for deciding how much you need to understand something to be responsible for it."
reading_time: 5
---

In my [last post](/blog/2026/01/27/comprehension-debt.html), I introduced the idea of comprehension debt—the gap between what you're using and what you actually understand. I ended with a question: *What are you responsible for that you don't understand?*

But that question needs a follow-up: *How do you decide how much understanding is enough?*

I've been thinking about this a lot. Not in the abstract, but practically—because I work with educators who are building AI tools, and "how much do I need to understand this?" is a question they're facing right now, often without realizing it.

Here's where I've landed so far.

---

## The Four Factors

When I think about how much comprehension debt is acceptable, four things seem to matter:

**1. Consequences of failure**

What happens if this thing breaks or behaves unexpectedly?

If I vibe-code a script to rename files on my computer and it goes haywire, I'm annoyed. Maybe I lose an afternoon restoring from backup. Low consequences.

If an educator deploys a chatbot that gives a student harmful advice during a vulnerable moment, that's a different magnitude entirely.

The higher the consequences, the less debt you can afford.

**2. Your role in the chain**

Are you the end user, the deployer, or the builder?

An end user can afford more debt. If I use Google Docs, I don't need to understand how collaborative editing works at a technical level. That's Google's job.

But if I'm the one putting a tool in front of other people—especially people who trust my judgment—I've moved up the responsibility chain. The deployer carries debt the end user doesn't.

**3. Availability of backup**

When something goes wrong, who else can help?

This is why I can afford not to understand my car's transmission. If it fails, there's a whole infrastructure of mechanics, tow trucks, and roadside assistance. I'm not the last line of defense.

In a cockpit at 8,000 feet, I am. So I'd better understand the aircraft's systems.

When you're deploying AI tools in contexts where you're the expert in the room—like a classroom—you may be more alone than you think.

**4. Novelty of failure modes**

How well do we understand what can go wrong?

We've had cars for over a century. We know how transmissions fail. We've calibrated what drivers need to know.

We've had large language models in widespread use for about two years. We're still discovering failure modes. Hallucinations, jailbreaks, subtle biases, unexpected behaviors in edge cases—the list keeps growing.

When failure modes are well-understood, you can outsource understanding more safely. When they're still emerging, debt gets riskier.

---

## A Quick Calibration

Here's a rough heuristic I've been using:

| Factor | Lower debt tolerance | Higher debt tolerance |
|--------|---------------------|----------------------|
| Consequences | Real harm possible | Inconvenience at worst |
| Your role | Deployer/recommender | End user |
| Backup | You're the expert in the room | Support systems exist |
| Novelty | Failure modes still emerging | Well-understood technology |

If you're on the left side of most of these, you probably need to understand more than you currently do.

If you're on the right side, maybe the debt is acceptable.

Most interesting situations are mixed. That's where judgment comes in.

---

## The Educator's Dilemma

Here's why this is tricky for educators building AI tools:

- **Consequences**: Potentially high. Students are a vulnerable population. Bad advice, inappropriate content, or reinforced misconceptions can do real harm.
- **Role**: Deployer. You're putting this in front of students, often with implicit endorsement.
- **Backup**: Limited. You're probably the most technically knowledgeable person in the room. If something weird happens, students will look to you.
- **Novelty**: High. These tools are new. We're all still figuring out how they fail.

By this framework, educators should have *low* tolerance for comprehension debt when it comes to AI tools they deploy with students.

And yet.

The tools are so easy to build. The results are so impressive. The temptation to just move on when it works is so strong.

I feel it too.

---

## What This Doesn't Mean

I'm not saying educators need to understand transformer architectures or be able to read Python. That's not the kind of understanding I'm talking about.

The understanding that matters is more like:

- What can this tool do that I didn't intend?
- What kinds of inputs might produce harmful outputs?
- What am I assuming about how students will use this?
- Who do I think is handling the risks I'm not thinking about? Are they actually?

That's comprehension at the level of *responsibility*, not implementation.

---

## The Question to Sit With

Before you deploy that AI tool—before you share that chatbot with students or recommend that platform to colleagues—try asking:

**If this fails in a way I didn't anticipate, am I prepared to be the one who explains what happened?**

If the answer is no, you might be carrying more debt than you can afford.

---

*Next up: I'll walk through some specific scenarios where this framework applies—including some from my own work with Build-a-Bot.*
