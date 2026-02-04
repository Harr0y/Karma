# Karma - Mystical Life Pattern Analysis

A "cold reading" application wrapped in mystical symbolism. Uses astrology, numerology, and psychological profiling techniques to generate compelling "life readings."

## What This Is

This is a demonstration of how cold reading techniques - the same methods used by fortune tellers, psychics, and astrologers - can be systematized and wrapped in mystical symbolism to create compelling "readings" that feel personally relevant.

## What This Is NOT

- This is NOT actually predicting the future
- This is NOT based on any supernatural or paranormal phenomenon
- This is NOT a substitute for professional psychological or life advice

## The Techniques

Karma uses several well-known cold reading techniques:

1. **Barnum Statements** - Universally true statements that feel personal ("You've worked harder than others realize")
2. **Time Range Covering** - Using broad time windows instead of specific dates
3. **Hedging** - Covering multiple possibilities ("Either a relationship began, ended, or transformed")
4. **Age-Calibrated Targeting** - Using life stage themes common to people at certain ages
5. **The Pivot** - Adapting based on user feedback, gracefully handling misses

## Installation

```bash
# Install dependencies (requires claude-agent-sdk)
pip install -r requirements.txt

# The SDK reads credentials from your .env file
# Make sure your .env contains:
# ANTHROPIC_AUTH_TOKEN=your-token
# ANTHROPIC_BASE_URL=https://your-api-endpoint
# ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

## Usage

### Command Line Interface

```bash
python main.py
```

You'll be prompted for:
- Birth date (YYYY-MM-DD format)
- Birth place (ZIP code or city name)
- Your name (optional)

The system will then generate an initial reading and invite you to continue the conversation.

### Programmatic Usage

```python
import asyncio
from karma import create_agent

async def main():
    agent = create_agent()

    # Generate initial reading
    reading = await agent.initial_reading(
        birth_date="1991-03-15",
        birth_place="Austin, TX",
        name="Jordan"
    )
    print(reading)

    # Continue with feedback
    follow_up = await agent.continue_reading(
        birth_date="1991-03-15",
        birth_place="Austin, TX",
        user_feedback="That was surprisingly accurate!"
    )
    print(follow_up)

asyncio.run(main())
```

Or use the synchronous wrappers:

```python
from karma import initial_reading_sync, continue_reading_sync

reading = initial_reading_sync(
    birth_date="1991-03-15",
    birth_place="Austin, TX",
    name="Jordan"
)
print(reading)
```

## Project Structure

```
karma/
├── main.py              # CLI entry point
├── agent.py             # Claude SDK wrapper
├── tools/               # Mystical calculation tools
│   ├── astrology.py     # Zodiac, numerology, birth charts
│   ├── timeline.py      # Life stages, critical years
│   └── demographics.py  # Location-based archetypes
├── prompts/
│   └── system.txt       # System prompt with cold reading framework
├── users/               # User data directory (created at runtime)
└── requirements.txt
```

## User Data

Each user gets a directory under `users/{user_id}/` containing:

- `profile.json` - Basic user information
- `conversation.jsonl` - Full conversation history
- `insights.json` - Inferred preferences and patterns

User IDs are generated as a hash of birth date and birth place for consistency.

## The Mystical Framework

The system presents itself as "pattern recognition" rather than fortune telling. It uses:

- **Western Astrology**: Sun, moon, and rising signs
- **Numerology**: Life path numbers
- **Chinese Zodiac**: Animal and elemental signs
- **Planetary Positions**: Pseudo-calculated for effect

All of these provide a framework for the cold reading - they feel specific and personal, but the actual insights come from universal human experiences.

## Example Output

```
🌟 KARMA - Life Pattern Analysis 🌟

═══════════════════════════════════════
YOUR COSMIC BLUEPRINT
═══════════════════════════════════════
Sun Sign: Pisces ♓ (The Dreamer)
Moon Sign: Scorpio ♏ (The Alchemist)
Rising Sign: Capricorn ♑ (The Strategist)
Life Path Number: 7 (The Seeker)

Your pattern suggests someone who processes the world deeply,
often feeling things before understanding them logically...

═══════════════════════════════════════
PAST PATTERN RECOGNITION
═══════════════════════════════════════

📌 Around 2016-2018, there was a significant shift in your
    personal life - possibly a relationship that either began
    or transformed in an important way...

📌 Your career path hasn't followed a straight line. There's
    a sense that your biggest opportunities didn't quite land
    as expected...

📌 You tend to give more than you receive in relationships...
    not just romantic, but professional too.

✨ How accurate does this feel to you?
```

## Ethical Considerations

This project is intended for educational and entertainment purposes only. It demonstrates:

1. How cold reading techniques work
2. The psychology behind why people find meaning in vague statements
3. How AI can be used to generate compelling "readings"

If you use this system with others, please:
- Be transparent that it's for entertainment
- Don't make important life decisions based on the readings
- Don't use it to manipulate or exploit vulnerable people

## License

MIT License - See LICENSE file for details.
