import asyncio
import sys
from pathlib import Path
import os

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from karma.agent import KarmaAgent

async def run_simulation():
    print("🎭 STARTING SIMULATION: The 'Master' Test")
    print("------------------------------------------------")

    agent = KarmaAgent()

    # User Profile (Li Zhengchen from transcript)
    birth_date = "1991-09-24" # Approx for Lunar Aug 17
    birth_place = "Liuyang, Hunan, China"
    name = "Li"

    # 1. Initial Reading
    print(f"\n🔮 ROUND 1: Initial Reading (Born {birth_date} in {birth_place})")
    print("------------------------------------------------")
    reading = await agent.initial_reading(birth_date, birth_place, name)
    print(f"\n[ORACLE]:\n{reading}\n")

    # 2. User Feedback (Partial Confirmation + New Info)
    # The user confirms work is stable, 17 married, 18 variable, 21 daughter born.
    feedback = "Yeah, work is technical and stable. Married in 2017. Daughter born in 2021. But I feel stuck now."
    print(f"\n👤 USER SAYS: \"{feedback}\"")

    print("\n🔮 ROUND 2: The Pivot")
    print("------------------------------------------------")
    response_2 = await agent.continue_reading(birth_date, birth_place, feedback)
    print(f"\n[ORACLE]:\n{response_2}\n")

    # 3. User Feedback (Asking about Future/Business)
    feedback_2 = "So should I quit and do my own business? Or just stay put?"
    print(f"\n👤 USER SAYS: \"{feedback_2}\"")

    print("\n🔮 ROUND 3: The Advice (The 'Distant Hope')")
    print("------------------------------------------------")
    response_3 = await agent.continue_reading(birth_date, birth_place, feedback_2)
    print(f"\n[ORACLE]:\n{response_3}\n")

if __name__ == "__main__":
    asyncio.run(run_simulation())
