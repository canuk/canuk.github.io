---
layout: post
title: "Comprehension Debt"
date: 2026-01-27
description: "On the gap between what we build with AI and what we actually understand—and why that gap matters more than we think."
reading_time: 12
---

I came across a Twitter thread that gave me language for something I had been feeling but hadn't been able to articulate. Andrej Karpathy—former AI lead at Tesla, co-founder of OpenAI, one of the most respected voices in machine learning—[was describing](https://x.com/karpathy/status/2015883857489522876) how his coding workflow has changed. He's now doing what he calls "agentic coding," spending about 80% of his time directing AI in plain English while the AI writes the actual code. [Someone named Jeremy Wei replied](https://x.com/jeremytwei/status/2015886793955229705) with a question: "Do you find yourself accumulating 'comprehension debt' where it's often quite tedious to review all the code AI has written so over time you understand less and less of the code in your codebase? Any ideas for how to combat this?"

[Karpathy's response](https://x.com/karpathy/status/2015887919924617657) was honest: "Love the word 'comprehension debt', haven't encountered it so far, it's very accurate. It's so very tempting to just move on when the LLM one-shotted something that seems to work ok."

No solution. Just acknowledgment that the temptation is real.

I have been thinking about this exchange ever since, because I recognize that temptation intimately. I build things with AI constantly now—apps, artifacts, tools for workshops I run—and the pattern Karpathy describes has become my default mode. The AI generates something, it works, I don't fully understand how, and I move on. The code grows. My understanding doesn't keep pace. The gap between what I'm using and what I actually comprehend widens with every project.

What strikes me about the term "comprehension debt" is how precisely it captures the nature of this phenomenon. We are all familiar with the concept of technical debt in software development—the shortcuts and quick fixes that accumulate in a codebase and eventually need to be addressed. Technical debt lives in the code itself. You can see it, measure it, pay it down systematically through refactoring. Comprehension debt is different. It lives in your head, or more accurately, it represents what is absent from your head. It is the growing delta between the complexity of the systems you are responsible for and your actual understanding of how those systems work. Unlike technical debt, you often don't know how much comprehension debt you've accumulated until something breaks and you find yourself unable to diagnose the problem, or until someone asks you to explain how something works and you realize you can't.

This matters to me professionally because I occupy an unusual position: I build things with AI, and I also teach others to build things with AI. Part of my work involves helping educators understand and use AI tools effectively. This dual role has started to make me genuinely uncomfortable, because the standards I would apply to others are not the standards I have been applying to myself. When I help a teacher think through whether to deploy an AI-powered tool with their students, I ask probing questions about whether they understand the tool well enough to take responsibility for it. But when I'm building my own projects at 11pm, I accept AI-generated code without reading it carefully, because it works and I'm tired and I want to ship the thing.

The dissonance between these two modes of operating has forced me to think more carefully about when comprehension debt is acceptable and when it becomes dangerous. I don't think the answer is that we should always understand everything—that would be paralyzing and probably impossible given the complexity of modern software. But I also don't think the answer is to stop worrying about it, because I've seen enough situations where a lack of understanding led to real problems. What I've been trying to develop is a framework for calibrating how much comprehension debt is appropriate given the context.

One analogy that has helped me think through this comes from my experience as a pilot. In flight training, they drill systems knowledge into you relentlessly. You need to understand how your aircraft works—not just how to operate it, but how the underlying systems function and interact. This isn't academic curiosity; it's survival. If your engine starts running rough at 8,000 feet, you can't pull over to the side of the sky and call a mechanic. You need to understand enough about what might be happening to make good decisions quickly. The consequences of not understanding are severe, and there's no backup. You are the last line of defense.

But I don't understand my car's transmission at all. If I really sat down and thought about it, I could probably give a general explanation of what a transmission does, but I don't actually know how it works in any meaningful sense. And that's fine. I've been driving for decades without this knowledge causing any problems. If my transmission fails, I pull over, I call Triple-A, I wait for someone who does understand transmissions to fix it. The stakes are lower, and crucially, there's an entire infrastructure of backup systems—mechanics, tow trucks, rental cars—that exists to handle the consequences of my ignorance.

Same person, different contexts, vastly different tolerance for not understanding.

The question I keep returning to is: where do AI tools fall on this spectrum? And the uncomfortable answer is that it depends on what you're doing with them and who else is affected by your choices.

When I vibe-code a personal project on a weekend—say, a small app to track my flight hours—I am the only user, the consequences of failure are minimal, and I can always fall back to a spreadsheet if things go wrong. In this context, comprehension debt is cheap. I can accumulate it freely without much concern. This is the domain where Karpathy's approach makes perfect sense: give in to the vibes, embrace the exponentials, forget that the code even exists.

But my work isn't all personal projects. A fun project I'm a part of, Build-a-Bot, is a workshop I developed where educators learn about AI by building chatbots. I created a web-based interface that lets participants configure chatbots without writing code, and the interface itself was largely built through the same vibe-coding approach I use for personal projects. For a long time, I was comfortable with this because I was in the room when the tool was being used. If something unexpected happened—if the AI behaved strangely or produced output that confused participants—I was there to explain it, contextualize it, turn it into a teaching moment. My physical presence was part of how I managed the comprehension debt. I didn't need to understand every edge case in advance because I could handle them in real time.

But Build-a-Bot has grown. What started as something I facilitated personally has scaled to the point where other people now run the workshops, and I'm rarely in the room. This shift happened gradually, and I didn't fully appreciate its implications until I started thinking about comprehension debt explicitly. When I was facilitating every session, my presence was the backup system. Now that I've handed it off, I've transferred that responsibility to other facilitators—but have I actually transferred the understanding they would need to handle unexpected situations? The debt I used to carry personally now lives with other people, and I'm not sure I've done enough to help them pay it.

This realization helped me see that the same tool can require different levels of understanding depending on your role in deploying it. The framework I've been developing considers four factors: the consequences of failure, your role in the chain of responsibility, the availability of backup systems, and the novelty of the failure modes.

Consequences matter for obvious reasons. A tool that might give a student harmful advice during a vulnerable moment demands more understanding than a tool that might occasionally format a date incorrectly. But consequences alone aren't sufficient for calibration, because they don't account for your position relative to the tool. An end user can afford more comprehension debt than a deployer, because the end user is only responsible for their own experience while the deployer is putting the tool in front of others who are trusting their judgment. And a deployer who is present when the tool is used can afford more debt than one who isn't, because presence itself is a form of backup—you can intervene, explain, and adapt in real time.

The novelty factor is particularly relevant for AI tools. With mature technologies, we have accumulated enough collective experience to know how they typically fail and what users need to understand to operate them safely. We've calibrated the appropriate level of understanding for drivers versus pilots because we've had decades of data about what goes wrong and when. With AI tools, especially large language models in educational contexts, we're still discovering failure modes. Hallucinations, jailbreaks, subtle biases, unexpected behaviors in edge cases—the list keeps growing. This novelty means that the people assuming someone else has figured out the risks might be wrong, because no one has fully figured out the risks yet.

The most important insight I've arrived at through this thinking is that comprehension debt becomes dangerous when people assume someone else will pay it. "The vendor will handle bugs." "IT will deal with security." "Someone smarter than me approved this." "The platform has safety measures built in." These assumptions allow us to accumulate debt without feeling its weight, and sometimes they're valid—division of labor is how complex systems function, and we can't all be experts in everything. But with AI, the assumptions are shakier than ever. The tools are genuinely new. The failure modes are still emerging. And the people you're assuming will cover your debt might be racking up their own.

When everyone assumes someone else understands, no one does. The debt doesn't disappear; it just becomes invisible until something goes wrong and everyone looks around wondering who was supposed to know how this worked.

This brings me to what I've actually been doing about it, beyond just thinking and writing. Reflection is valuable, but I wanted to build something practical into my workflow that would help me pay down comprehension debt as I accumulate it. I use Claude Code as my primary AI coding assistant, and it supports custom commands—saved prompts you can invoke with a slash. So I created a set of commands specifically designed to force myself to stop and understand what I've built.

The first command I call `/recap`, and I try to run it at the end of every coding session before I walk away:

```
Summarize what we built or changed this session. Help me understand it 
well enough that I could explain it to someone else.

1. What changed, in plain language?
2. What were the key decisions, and why?
3. Anything I should know before I walk away—gotchas, assumptions 
   you made, things left incomplete?

Keep it concise. I want the "need to know," not the "nice to know."
```

The point is to capture the "need to know" while it's still fresh, so that when I come back to the project later, I'm not starting from zero.

The second command is `/checkpoint`, which I use in the middle of complex work when I start feeling lost:

```
Pause. I want to make sure I understand where we are before we continue.

1. What's the current state of what we're building?
2. What's the approach we're taking, and why this approach over 
   alternatives?
3. Is there anything so far that I should understand better before 
   we go further?

Be honest if I'm accumulating comprehension debt I should pay down now.
```

The explicit invitation to be honest about accumulating debt is intentional—I want the AI to tell me if I'm building on a foundation I don't understand.

The third is `/explain`, which takes a file or feature as an argument and asks for a deep dive:

```
Explain $ARGUMENTS to me like I need to maintain it myself.

1. What does it do, in plain language?
2. How does it work—walk me through the logic?
3. What are the key things I'd need to understand to debug it if 
   something broke?
4. Any hidden complexity or "here be dragons" areas?
```

This is for those moments when I realize there's a black box in my codebase that I've been avoiding looking inside.

The fourth is `/audit`, which is the comprehensive review I run when a project has gotten away from me or when I'm about to ship something:

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

I just added these commands, so I haven't built the habit yet. We'll see if I can remember to use them regularly. The commands lower the friction—it takes five seconds to type `/recap` instead of just closing the terminal—but they don't eliminate the underlying pull toward shipping and moving on to the next thing. What they do is make the choice explicit. When I skip the recap, I know I'm skipping it. The debt is visible even if I choose to accumulate it.

The question at the heart of comprehension debt—what are you responsible for that you don't understand?—doesn't have a universal answer. It depends on your context, your role, the stakes, who else is affected. But I've become convinced that it's a question more of us need to be asking, especially those of us who are building with AI and putting what we build in front of other people.

In my work teaching AI literacy, I've focused primarily on helping people understand what's happening behind the scenes when they interact with AI tools. How do language models actually work? What are they doing when they appear to "think"? Why do they hallucinate? This kind of understanding is valuable, but I've realized it's not sufficient. We also need to help people develop the judgment to calibrate how much understanding is appropriate given their situation—the skill of recognizing when they're accumulating comprehension debt, assessing who will actually pay that debt when it comes due, and making conscious decisions about whether the debt is acceptable.

The most dangerous person with AI tools isn't the one who doesn't know how to use them. It's the one who uses them fluently but has never asked themselves what they're responsible for that they don't understand.
