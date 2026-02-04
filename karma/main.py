#!/usr/bin/env python3
"""
Karma - Mystical Life Pattern Analysis CLI

A command-line interface for generating cold-reading based
"life readings" wrapped in mystical symbolism.

Usage:
    python main.py
    (follow the prompts)
"""

import os
import sys
import asyncio
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from agent import KarmaAgent, create_agent

# Load environment variables from project root (.env in parent directory)
_project_root = Path(__file__).parent.parent
load_dotenv(_project_root / ".env")


def print_banner():
    """Print the welcome banner."""
    print()
    print(" ╔═══════════════════════════════════════════════════════════════╗")
    print(" ║                                                               ║")
    print(" ║      ✦ KARMA - Pattern Reading ✦                            ║")
    print(" ║                                                               ║")
    print(" ║      Reveal what you hide from yourself                       ║")
    print(" ║                                                               ║")
    print(" ╚═══════════════════════════════════════════════════════════════╝")
    print()


def print_divider():
    """Print a visual divider."""
    print("═════════════════════════════════════════════════════════════════")


def get_user_input() -> dict:
    """
    Collect user information for the reading.

    Returns:
        dict with birth_date, birth_place, and optional name
    """
    print_divider()
    print("To reveal your patterns, provide:")
    print_divider()
    print()

    # Get birth date
    while True:
        birth_date = input("📅 Birth Date (YYYY-MM-DD): ").strip()
        if validate_date(birth_date):
            break
        print("   Invalid format. Please use YYYY-MM-DD (e.g., 1991-03-15)")

    print()

    # Get birth place
    while True:
        birth_place = input(f"📍 Birth Place (ZIP Code or City, State): ").strip()
        if birth_place:
            break
        print("   Please enter a location.")

    print()

    # Get name (optional)
    name = input("✨ Your Name (optional, press Enter to skip): ").strip() or None

    print()
    print_divider()

    return {
        "birth_date": birth_date,
        "birth_place": birth_place,
        "name": name,
    }


def validate_date(date_str: str) -> bool:
    """
    Validate date string format and basic sanity.

    Args:
        date_str: Date string in YYYY-MM-DD format

    Returns:
        True if valid, False otherwise
    """
    try:
        from datetime import datetime

        date_obj = datetime.strptime(date_str, "%Y-%m-%d")

        # Basic sanity checks
        if date_obj.year < 1900 or date_obj.year > datetime.now().year:
            return False

        return True
    except ValueError:
        return False


def display_reading(reading: str):
    """Display the reading with nice formatting."""
    print()
    print_divider()
    print()
    print(reading)
    print()
    print_divider()
    print()


async def continue_session(agent: KarmaAgent, birth_date: str, birth_place: str):
    """
    Continue an interactive session with the agent.

    Args:
        agent: KarmaAgent instance
        birth_date: User's birth date
        birth_place: User's birth place
    """
    print("💬 Continue your conversation (or 'quit' to exit):")
    print()

    while True:
        try:
            user_input = input("You: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ("quit", "exit", "q", "bye"):
                print()
                print("✦ The patterns have been revealed. ✦")
                print()
                break

            # Get follow-up reading
            response = await agent.continue_reading(birth_date, birth_place, user_input)

            print()
            print(f"ORACLE: {response}")
            print()
            print_divider()
            print()

        except KeyboardInterrupt:
            print()
            print()
            print("✦ Reading interrupted. The patterns remain. ✦")
            print()
            break
        except Exception as e:
            print()
            print(f"An error occurred: {e}")
            print("Please try again or type 'quit' to exit.")
            print()


async def main_async():
    """Async main entry point."""
    print_banner()

    # Get user input
    user_info = get_user_input()

    # Create agent and generate reading
    try:
        print("🔮 Reading your patterns...")
        print()

        agent = create_agent()
        reading = await agent.initial_reading(
            birth_date=user_info["birth_date"],
            birth_place=user_info["birth_place"],
            name=user_info["name"],
        )

        display_reading(reading)

        # Offer to continue
        print()
        choice = input("Continue? (y/n): ").strip().lower()
        if choice in ("y", "yes", "yeah", "sure"):
            print()
            await continue_session(agent, user_info["birth_date"], user_info["birth_place"])
        else:
            print()
            print("✦ Your patterns are revealed. What you do with them is up to you. ✦")
            print()

    except KeyboardInterrupt:
        print()
        print()
        print("✦ Reading cancelled. ✦")
        print()
        sys.exit(0)
    except Exception as e:
        print()
        print(f"⚠️  An error occurred while generating your reading: {e}")
        print()
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    """Main CLI entry point - wrapper for async main."""
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
