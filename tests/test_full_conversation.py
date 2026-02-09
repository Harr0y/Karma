#!/usr/bin/env python3
"""
Full conversation test for Karma - tests initial reading + follow-up flow.
"""

import asyncio
import sys
from pathlib import Path

# Add karma to path
sys.path.insert(0, str(Path(__file__).parent.parent / "karma"))

from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / ".env")


async def test_female_30s_beijing():
    """Test with a different persona: Female, early 30s, from Beijing."""
    from agent import create_agent

    print("=" * 70)
    print("🔮 KARMA FULL CONVERSATION TEST")
    print("=" * 70)

    # New persona: Female, 32 years old, from Beijing
    # Saturn Return would have been 2021-2023 (COVID peak)
    birth_date = "1993-03-15"
    birth_place = "Beijing, China"
    name = "小雪"
    gender = "female"

    print(f"\n📋 Test Persona:")
    print(f"   Name: {name}")
    print(f"   Gender: {gender}")
    print(f"   Birth Date: {birth_date}")
    print(f"   Birth Place: {birth_place}")
    print(f"   Current Age: 32-33")
    print(f"   Saturn Return: 2021-2023 (COVID era)")
    print()

    agent = create_agent()

    # ===== PHASE 1: INITIAL READING =====
    print("=" * 70)
    print("📖 PHASE 1: INITIAL READING")
    print("=" * 70)

    response1 = await agent.initial_reading(
        birth_date=birth_date,
        birth_place=birth_place,
        name=name,
        gender=gender,
    )

    print("\n📜 INITIAL READING:")
    print("-" * 70)
    print(response1.text)
    print("-" * 70)

    # Count words
    word_count = len(response1.text.split())
    print(f"\n📊 Word count: {word_count} (target: <250)")

    if response1.audio_files:
        print(f"\n🎙️ Audio files ({len(response1.audio_files)}):")
        for f in response1.audio_files:
            print(f"   - {f}")

    # ===== PHASE 2: USER CONFIRMS (Probe-Then-Lock) =====
    print("\n" + "=" * 70)
    print("📖 PHASE 2: USER FEEDBACK - CONFIRMATION")
    print("=" * 70)

    feedback1 = "是的，2021年确实很难，那时候我刚结婚，然后疫情封城，工作也出了问题。家里人一直催我要孩子，但我自己都还没想好。"

    print(f"\n👤 User feedback: \"{feedback1}\"")

    response2 = await agent.continue_reading(
        birth_date=birth_date,
        birth_place=birth_place,
        user_feedback=feedback1,
    )

    print("\n📜 FOLLOW-UP RESPONSE:")
    print("-" * 70)
    print(response2.text)
    print("-" * 70)

    word_count2 = len(response2.text.split())
    print(f"\n📊 Word count: {word_count2} (target: <200)")

    if response2.audio_files:
        print(f"\n🎙️ Audio files ({len(response2.audio_files)}):")
        for f in response2.audio_files:
            print(f"   - {f}")

    # ===== PHASE 3: USER DENIES (Pivot Test) =====
    print("\n" + "=" * 70)
    print("📖 PHASE 3: USER FEEDBACK - DENIAL")
    print("=" * 70)

    feedback2 = "不对，我父母身体挺好的，这个不太准"

    print(f"\n👤 User feedback: \"{feedback2}\"")

    response3 = await agent.continue_reading(
        birth_date=birth_date,
        birth_place=birth_place,
        user_feedback=feedback2,
    )

    print("\n📜 PIVOT RESPONSE:")
    print("-" * 70)
    print(response3.text)
    print("-" * 70)

    word_count3 = len(response3.text.split())
    print(f"\n📊 Word count: {word_count3} (target: <200)")

    if response3.audio_files:
        print(f"\n🎙️ Audio files ({len(response3.audio_files)}):")
        for f in response3.audio_files:
            print(f"   - {f}")

    # ===== SUMMARY =====
    print("\n" + "=" * 70)
    print("📊 TEST SUMMARY")
    print("=" * 70)
    print(f"   Initial Reading: {word_count} words {'✅' if word_count < 250 else '❌'}")
    print(f"   Follow-up 1 (Confirm): {word_count2} words {'✅' if word_count2 < 200 else '❌'}")
    print(f"   Follow-up 2 (Deny/Pivot): {word_count3} words {'✅' if word_count3 < 200 else '❌'}")

    total_audio = len(response1.audio_files) + len(response2.audio_files) + len(response3.audio_files)
    print(f"   Total audio files: {total_audio}")

    # Play audio hint
    if response1.audio_files:
        print(f"\n🎧 To listen to the initial reading audio:")
        print(f"   afplay {response1.audio_files[0]}")

    return True


async def test_male_45_shanghai():
    """Test with another persona: Male, 45 years old, from Shanghai."""
    from agent import create_agent

    print("\n" + "=" * 70)
    print("🔮 KARMA TEST: Male 45, Shanghai")
    print("=" * 70)

    # Persona: Male, 45, Shanghai - midlife, parents' health concerns
    birth_date = "1980-07-20"
    birth_place = "Shanghai, China"
    name = "王明"
    gender = "male"

    print(f"\n📋 Test Persona:")
    print(f"   Name: {name}")
    print(f"   Gender: {gender}")
    print(f"   Birth Date: {birth_date}")
    print(f"   Birth Place: {birth_place}")
    print(f"   Current Age: 45")
    print(f"   Expected probes: Parents' health, career plateau, legacy")
    print()

    agent = create_agent()

    response = await agent.initial_reading(
        birth_date=birth_date,
        birth_place=birth_place,
        name=name,
        gender=gender,
    )

    print("\n📜 READING:")
    print("-" * 70)
    print(response.text)
    print("-" * 70)

    word_count = len(response.text.split())
    print(f"\n📊 Word count: {word_count} (target: <250)")

    if response.audio_files:
        print(f"\n🎙️ Audio files: {len(response.audio_files)}")
        print(f"   🎧 Play: afplay {response.audio_files[0]}")

    return True


async def main():
    """Run full conversation tests."""
    print("\n" + "🔮" * 35)
    print("   KARMA FULL CONVERSATION TEST SUITE")
    print("🔮" * 35 + "\n")

    # Test 1: Female 30s Beijing - full conversation flow
    await test_female_30s_beijing()

    # Test 2: Male 45 Shanghai - different demographic
    await test_male_45_shanghai()

    print("\n" + "=" * 70)
    print("✅ ALL TESTS COMPLETED")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
