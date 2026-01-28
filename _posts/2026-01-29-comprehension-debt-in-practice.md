---
layout: post
title: "Comprehension Debt in Practice"
date: 2026-01-29
description: "Applying the framework to real scenarios—including what I've learned running Build-a-Bot workshops."
reading_time: 6
---

I've spent the last two posts developing a framework for thinking about comprehension debt—the gap between what you use and what you understand, and how to decide when that gap is acceptable.

Now I want to make it concrete. Here are some scenarios I've actually encountered, and how I'd think through them using the framework.

---

## Scenario 1: The Weekend Project

**Situation**: I want to build a small app to track my flight hours. It's just for me. I use Claude to generate most of the code. It works. I don't fully understand how the date parsing logic handles edge cases.

**Running the framework**:
- Consequences: Low. If it breaks, I'm mildly annoyed.
- Role: End user. I'm the only one using this.
- Backup: High. Worst case, I go back to a spreadsheet.
- Novelty: Low. Date parsing is well-understood, even if I don't understand it.

**Verdict**: Debt is fine. Move on.

This is vibe-coding territory. The whole point is that you *don't* need to understand everything for low-stakes personal projects. Accumulate that debt freely.

---

## Scenario 2: The Workshop Tool

**Situation**: I'm running Build-a-Bot, a workshop where educators learn about AI by building chatbots. I've created a web-based interface that lets participants configure chatbots without writing code. The interface itself was largely vibe-coded.

**Running the framework**:
- Consequences: Medium. Participants are adults, not students. But they're forming mental models about how AI works based on what they experience. If the tool behaves unexpectedly, it could create misconceptions.
- Role: Deployer. I'm putting this in front of people and implicitly saying "this is how it works."
- Backup: Present. I'm in the room. If something weird happens, I can explain it, contextualize it, use it as a teaching moment.
- Novelty: Medium-high. LLM behavior is still surprising even to me sometimes.

**Verdict**: Moderate debt tolerance, but I need to stay close.

This is why I run these workshops in person when possible. I need to be there when the tool does something unexpected—not to prevent it, but to make sense of it with participants. My presence is part of how I pay down the debt.

---

## Scenario 3: The Workshop Tool (Scaled)

**Situation**: Build-a-Bot has grown. It started with me facilitating every session. Now other people run it, and I'm rarely in the room.

**Running the framework**:
- Consequences: Still medium. Same participants, same risks of misconceptions.
- Role: Builder and trainer. I'm not the one deploying anymore—facilitators are. But they're deploying based on my training and my tool.
- Backup: Low. I'm not there. Facilitators are on their own when something weird happens.
- Novelty: Still medium-high.

**Verdict**: Lower debt tolerance than when I was in the room myself.

This is the part I didn't fully anticipate. When I was facilitating every session, my presence was part of how I managed the debt. If the tool did something unexpected, I could explain it, contextualize it, turn it into a teaching moment.

Now that I've handed it off, I've transferred that responsibility to facilitators—but have I transferred the understanding they need? I've had to get much more intentional about documentation, facilitator training, and anticipating failure modes. The debt I could carry personally now lives with other people.

Scenarios 2 and 3 are the same tool at different stages. The framework helped me see that scaling changed my debt tolerance, even though the tool itself didn't change.

---

## Scenario 4: The Recommendation

**Situation**: A colleague asks me, "What AI tool should we use for student feedback on writing?" I've played with a few options. One seems good. I recommend it.

**Running the framework**:
- Consequences: Potentially high. This could affect how students experience feedback on their writing—a sensitive area.
- Role: Recommender. I'm not deploying it myself, but my endorsement carries weight.
- Backup: Low. I won't be there when it's used. I'm outsourcing deployment to someone else.
- Novelty: High. AI feedback on student writing is new territory with lots of unknowns.

**Verdict**: Lower debt tolerance than I initially thought.

Here's the trap: I feel like I'm just making a recommendation. Low stakes for me. But my colleague might deploy it based on my endorsement, assuming I've vetted it. I'm implicitly transferring my debt to them—without telling them.

If I recommend something, I should be clear about what I actually know:
- "I've tested this for about an hour, and it seemed reasonable."
- "I haven't tried it with struggling writers or English language learners."
- "You should probably test it yourself before deploying widely."

That's not being unhelpful. That's being honest about where the comprehension debt lives.

---

## The Meta-Lesson

Working through these scenarios, I notice something: the framework isn't just about *me* deciding how much to understand. It's about being honest about where the debt sits and who's going to pay it.

Comprehension debt doesn't disappear when you hand something off. It transfers.

When I give a tool to facilitators without documentation, I'm transferring debt to them.

When a teacher deploys a chatbot she doesn't fully understand, she's transferring debt to her students.

When I recommend a tool without caveats, I'm transferring debt to my colleague.

The responsible move isn't always "understand more." Sometimes it's "be honest about what you don't understand, and make sure the next person knows what they're taking on."

---

## Where I'm Still Figuring Things Out

I don't have this all solved. Some open questions I'm sitting with:

- How do you teach this calibration skill? Can you, or does it only come from experience?
- What does "understanding enough" actually look like for different roles? Can we make that concrete?
- How do we build tools that make comprehension debt more visible—so people know what they're taking on?

If you're thinking about this stuff too, I'd love to hear from you. I'm still very much in the working-it-out phase.

---

*This is the third post in a series on comprehension debt. The first two are [Comprehension Debt](/blog/2026/01/27/comprehension-debt.html) and [Calibrating Comprehension Debt](/blog/2026/01/28/calibrating-comprehension-debt.html).*
