#!/usr/bin/env python3
"""
Test script for Karma reading functionality.
"""

import asyncio
import sys
from pathlib import Path

# Add karma to path
sys.path.insert(0, str(Path(__file__).parent.parent / "karma"))

from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / ".env")


async def test_initial_reading():
    """Test the initial reading with the new research-based approach."""
    from agent import create_agent

    print("=" * 60)
    print("🔮 KARMA TEST: Initial Reading")
    print("=" * 60)

    # Test case: Someone born in 1991 in Liuyang, Hunan (from the chat logs)
    birth_date = "1991-09-25"  # Approximate date for 农历八月十七
    birth_place = "Liuyang, Hunan, China"
    name = "Test User"
    gender = "male"  # Added gender for strategic targeting

    print(f"\n📋 Test Input:")
    print(f"   Name: {name}")
    print(f"   Gender: {gender}")
    print(f"   Birth Date: {birth_date}")
    print(f"   Birth Place: {birth_place}")
    print()

    agent = create_agent()

    print("🔄 Generating reading (this will use tools to research)...")
    print("-" * 60)

    try:
        response = await agent.initial_reading(
            birth_date=birth_date,
            birth_place=birth_place,
            name=name,
            gender=gender,
        )

        print("\n" + "=" * 60)
        print("📜 READING OUTPUT:")
        print("=" * 60)
        print(response.text)
        print("=" * 60)

        if response.audio_files:
            print(f"\n🎙️ Audio files generated: {len(response.audio_files)}")
            for f in response.audio_files:
                print(f"   - {f}")

        return True

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_calculations():
    """Test the calculations module."""
    print("=" * 60)
    print("🧮 KARMA TEST: Calculations Module")
    print("=" * 60)

    try:
        from calculations import full_profile, get_sun_sign, calculate_life_path, get_chinese_zodiac

        # Test with the same birth date
        birth_date = "1991-09-25"
        birth_place = "Liuyang, Hunan"
        name = "Test"

        profile = full_profile(birth_date, birth_place, name)

        print(f"\n📋 Profile for {birth_date}:")
        print(f"\n   Age: {profile['demographics']['age']}")
        print(f"\n   🌟 Western Astrology:")
        print(f"      Sun Sign: {profile['western_astrology']['name']} {profile['western_astrology']['symbol']}")
        print(f"      Archetype: {profile['western_astrology']['archetype']}")
        print(f"      Element: {profile['western_astrology'].get('element', 'N/A')}")

        print(f"\n   🔢 Numerology:")
        print(f"      Life Path: {profile['numerology']['number']} - {profile['numerology']['name']}")
        print(f"      Calculation: {profile['numerology']['calculation']}")

        print(f"\n   🐉 Chinese Zodiac:")
        print(f"      Sign: {profile['chinese_zodiac']['full_sign']}")
        print(f"      Chinese: {profile['chinese_zodiac']['chinese_full']}")
        print(f"      Yin/Yang: {profile['chinese_zodiac']['yin_yang']}")

        print(f"\n   📅 Life Stage:")
        print(f"      Stage: {profile['life_stage']['stage']}")
        print(f"      Themes: {profile['life_stage']['themes']}")

        print(f"\n   🎯 Recent Milestones (Past 10 years):")
        for m in profile['recent_milestones']:
            print(f"      - {m['milestone'].replace('_', ' ').title()}: {m['year']} ({m['years_ago']} years ago)")
            print(f"        Significance: {m['significance']}")

        return True

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all tests."""
    print("\n" + "🔮" * 30)
    print("   KARMA TEST SUITE")
    print("🔮" * 30 + "\n")

    # Test calculations first (doesn't need API)
    calc_ok = await test_calculations()

    print("\n")

    # Then test full reading (needs API)
    reading_ok = await test_initial_reading()

    print("\n" + "=" * 60)
    print("📊 TEST RESULTS:")
    print("=" * 60)
    print(f"   Calculations: {'✅ PASS' if calc_ok else '❌ FAIL'}")
    print(f"   Initial Reading: {'✅ PASS' if reading_ok else '❌ FAIL'}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
