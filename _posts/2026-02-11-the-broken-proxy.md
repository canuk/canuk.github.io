---
layout: post
title: "The Broken Proxy"
date: 2026-02-11
description: "AI didn't break education. It broke the assumption that a strong product means a strong learning process. That's not a crisis — it's a design opportunity."
reading_time: 7
---

The essay used to mean something. Not just the final product — the polished paragraphs, the properly formatted citations — but everything it represented: the research, the synthesis, the structured thinking, the hours of wrestling an idea into shape. For decades, we assessed the artifact because we trusted it reflected the process. A strong paper meant a student had done strong work. That assumption held for a long time.

It doesn't anymore.

## The Assumption

Education's fundamental goal is learning, and learning is a process. It happens in the struggle — the false starts, the restructured outlines, the moment a concept finally clicks into place.

But we've never had a great way to evaluate the process directly. So we've always evaluated learning by its *products*: essays, problem sets, lab reports, research papers, final presentations. The product was our proxy for the process.

And the core assumption underneath all of it: **a strong product is indicative of a strong learning process.**

This framing comes from Mehran Sahami, who laid it out in a lightning talk at the [AI+Education Summit](https://acceleratelearning.stanford.edu/ai-education-summit/) at Stanford in February 2026. It's one of those ideas that feels obvious the moment someone says it out loud — and then you realize how much of our entire assessment infrastructure is built on top of it.

For most of educational history, this was a reasonable bet. If a student turned in a well-researched paper, they probably did the research. If a student solved a complex problem set, they probably understood the underlying concepts. The proxy wasn't perfect, but it was good enough.

## The Break

Generative AI broke the proxy.

Not by making students lazier or less capable — but by severing the link between the quality of the product and the quality of the process that produced it. A student can now generate a polished essay without doing the research. A developer can ship working code without understanding the architecture. The artifact is no longer a reliable signal of what someone learned.

And it gets worse. AI doesn't just weaken the proxy — it can *invert* it. Perry et al. (2022) found that participants who used AI coding assistants [wrote significantly less secure code](https://arxiv.org/abs/2211.03622) but were *more likely to believe their code was secure*. The tool created false confidence. The product didn't just fail to reflect the process — it actively misled people about what they understood.

I feel this personally. I build things with AI coding assistants every day. I've shipped prototypes, built workshop tools, automated workflows. And I know firsthand how easy it is to produce something that looks solid while understanding only 60% of what's under the hood. The output passes every test. But if you asked me to rebuild it from scratch without the assistant? Different story.

That gap between what the product looks like and what the builder actually knows — that's the broken proxy in action.

## The Wrong Response

The instinct, understandably, is to detect and prevent. AI detectors. Proctoring software. Bans on ChatGPT. Policies that treat any AI involvement as academic dishonesty.

This frames AI as a cheating tool and turns education into a policing problem. And it's a losing game — detection will always lag behind capability. The tools get better faster than the detectors do.

We've been here before. When calculators first showed up in classrooms, there was real panic. Students won't learn arithmetic! They'll become dependent! And for a while, some schools did ban them. But eventually, educators made a smarter move: they redesigned what they were assessing. The goal shifted from "can you compute this by hand?" to "can you set up the problem correctly and interpret the result?" The calculator didn't disappear — it became part of the curriculum.

The parallel isn't perfect, though. Guilherme Lichand made a sharp point at the same Summit: calculators automate *one* component of mathematical problem-solving. GenAI can automate *all* components of a writing or coding task — research, drafting, editing, even reflection. The scale of disruption is categorically different. Which means the response has to be, too.

## The Right Question

The question isn't "how do we catch students using AI?" It's: **how do we make the learning process visible again?**

This is a design problem, not a policing problem.

Mehran offered a second insight that stuck with me: we should treat generative AI as a *curricular topic*, not just a tool decision. The question of "should students use ChatGPT on this assignment?" is the wrong level of analysis. Instead, AI literacy should be scaffolded across the curriculum — starting with the basics of how these systems work, progressing to recognizing bias and hallucinations, and eventually reaching expert-level usage where students can critically evaluate and direct AI outputs.

That progression matters. You can't use a tool well if you don't understand what it's doing — and you definitely can't assess whether a tool helped or hurt your learning if you don't have a framework for thinking about it.

Hari Subramonyam demonstrated something that pointed toward a different model entirely. His [Situated Physics Brushes](https://depts.washington.edu/cssl/) work lets students interact with physics concepts through creative, hands-on making — using AI as a medium rather than a shortcut. His frame: organize learning around what students *create*, not what they *know*. "Creation is where knowledge becomes structured and usable." When the creative process itself is the learning experience, the proxy problem dissolves — because you're no longer evaluating a detached artifact. You're watching the learning happen.

## So What?

**For educators:** The artifacts you're assessing may not mean what they used to. That's not a crisis — it's an invitation to redesign. The best responses I've seen don't ban AI or ignore it. They make the process the point: oral defenses of written work, iterative portfolios with visible revision history, collaborative problem-solving where the thinking is the deliverable.

**For builders:** If you're building ed-tech tools, you're either helping make the learning process visible or you're making the proxy problem worse. Every tool that generates a polished output without surfacing the process is widening the gap. Every tool that makes thinking, iteration, and metacognition visible is part of the solution. Choose accordingly.

As Isabelle Hau framed it in the Summit's opening: "This is a design choice, not a predetermined outcome." The technology doesn't decide what happens to learning. We do.

## The Opportunity

The proxy is broken. We're not going to fix it by taping it back together — by building better detectors or writing stricter policies.

The opportunity is to build something better: assessment and learning experiences where the process *is* the point. Where we stop inferring learning from artifacts and start designing for visible thinking. Where AI becomes part of how students learn, not something they use to bypass learning.

This is exactly the kind of problem I'm working on at Stanford's [Accelerator for Learning](https://acceleratelearning.stanford.edu/) — helping educators and researchers figure out what it looks like to teach and build in a world where the old assumptions no longer hold.

The proxy is broken. Good. Let's build what comes next.

---

*This post was inspired by talks at the [2026 AI+Education Summit](https://acceleratelearning.stanford.edu/ai-education-summit/) at Stanford, particularly Mehran Sahami's framing of the proxy problem. Thanks to the many speakers whose ideas shaped my thinking here, including Hari Subramonyam, Guilherme Lichand, and Isabelle Hau.*

**References:**
- Perry, N., Srivastava, M., Kumar, D., & Boneh, D. (2022). [Do Users Write More Insecure Code with AI Assistants?](https://arxiv.org/abs/2211.03622) arXiv preprint.
- Sahami, M. (2026). Lightning talk, AI+Education Summit, Stanford University.
- Subramonyam, H. (2026). Situated Physics Brushes demo, AI+Education Summit, Stanford University.
- Lichand, G. (2026). AI+Education Summit, Stanford University.
- Hau, I. (2026). Opening remarks, AI+Education Summit, Stanford University.
