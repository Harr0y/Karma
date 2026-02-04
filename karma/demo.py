#!/usr/bin/env python3
"""
Demo script for Karma - shows a sample interaction without API calls.
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))


def demo_reading():
    """Display a sample reading without making API calls."""

    sample_reading = """
 🌟 KARMA - Life Pattern Analysis 🌟

Based on your birth energy signature...

Birth Date: March 15, 1991
Birth Location: Austin, TX

═══════════════════════════════════════
YOUR COSMIC BLUEPRINT
═══════════════════════════════════════

Sun Sign: Pisces ♓ (The Dreamer)
   The mystic of the zodiac, you process the world through
   feeling and intuition. You often know things without
   knowing how you know them.

Moon Sign: Scorpio ♏ (The Alchemist)
   Your emotional nature runs deep and intense. You feel
   things more profoundly than others realize, and you've
   learned to protect your vulnerability.

Rising Sign: Capricorn ♑ (The Strategist)
   Others see you as composed, competent, and in control.
   This outward success often masks the complexity within.

Life Path Number: 7 (The Seeker)
   Your journey is one of deeper meaning. You're not satisfied
   with surface explanations - you need to understand WHY.

Chinese Zodiac: Metal Goat
   Creative, sensitive, and occasionally anxious. You thrive
   with support systems and have learned resilience through
   challenges.

═══════════════════════════════════════
PAST PATTERN RECOGNITION
═══════════════════════════════════════

Looking at your life trajectory, I sense several patterns:

📌 Around 2016-2018, there was a significant shift in your
   personal life. Either a relationship began, ended, or
   transformed in an important way. The energy suggests this
   wasn't something you chose - it happened TO you, and you're
   still processing the ripple effects...

📌 Your career path hasn't followed a straight line. There's
   a sense that your biggest opportunities didn't quite land
   as expected. You've had to adapt, pivot, sometimes settle.
   Others may see your achievements and think you've "made it,"
   but you know how much effort it took for results that feel...
   smaller than you hoped.

📌 The period from 2020-2022 was particularly challenging.
   Plans you made didn't survive reality. Something important
   was delayed, cancelled, or lost. You're still rebuilding
   from that disruption.

📌 In relationships, you tend to give more than you receive.
   This isn't just romantic - it's a pattern. Friends, family,
   coworkers... people make promises that don't materialize,
   and you're often the one who adapts to make things work.

═══════════════════════════════════════
Before I continue deeper into your patterns...
═══════════════════════════════════════

✨ How accurate does this feel to you?

   • What resonated with your experience?
   • What didn't land?
   • What would you add or clarify?

Your feedback helps me refine the pattern reading.
"""

    print()
    print(sample_reading)
    print()


def demo_follow_up():
    """Show a sample follow-up based on positive feedback."""

    follow_up = """
I'm glad that landed for you. These patterns are quite consistent
once you know how to read them.

Let me look closer at one thread I sensed...

═══════════════════════════════════════
DEEPER PATTERN: THE GIVER'S DILEMMA
═══════════════════════════════════════

Your pattern shows a classic dynamic: you're the "reliable one."
The person others call when they need help. The one who shows up.
The one who makes things work.

And this... has been both your greatest strength AND your greatest
limitation.

The energy suggests:
   • You've been in situations where you gave 80% while others
     gave 20% - and you stayed because "someone had to"
   • People have made promises to you that didn't materialize.
     Sometimes explicitly ("I'll pay you back"), sometimes
     implicitly ("we're in this together")
   • You've learned to expect disappointment, but part of you
     still hopes "this time will be different"

Here's what the pattern reveals for your path forward:

The energies of late 2024 through 2025 support a REBALANCING.
This isn't about becoming selfish - it's about reciprocity.

The question for you to consider:
   "What would change if I gave only as much as I receive?"

Not as a threat. Not as a punishment. But as an experiment.

═══════════════════════════════════════

Does this deeper pattern resonate? And if so - where in your
life do you most need this rebalancing right now?
"""

    print()
    print(follow_up)
    print()


def main():
    """Run the demo."""
    print()
    print(" ╔═══════════════════════════════════════════════════════════════╗")
    print(" ║                                                               ║")
    print(" ║      ✦ KARMA - Demo Mode ✦                                  ║")
    print(" ║                                                               ║")
    print(" ║      Sample readings without API calls                        ║")
    print(" ║                                                               ║")
    print(" ╚═══════════════════════════════════════════════════════════════╝")
    print()

    demo_reading()

    print("─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─")
    print()
    print("Imagine the user responded with:")
    print()
    print("  \"Wow, that was surprisingly accurate! Especially the part")
    print("   about giving more than I receive. How did you know?\"")
    print()
    print("─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─")
    print()

    demo_follow_up()

    print("─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─")
    print()
    print("To run the full version with Claude Agent SDK:")
    print()
    print("  1. Ensure your .env file has ANTHROPIC_AUTH_TOKEN set")
    print("  2. Run: python main.py")
    print()


if __name__ == "__main__":
    main()
