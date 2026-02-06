import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from karma.agent import KarmaAgent

async def run_simulation():
    print("🎭 NEW USER SIMULATION: Zhang Wei (Female, Shanghai)")
    print("=" * 60)

    agent = KarmaAgent()

    # New User Profile: A different persona
    # 张薇，女，1988年3月15日，上海出生
    # 背景：金融行业，单身，35岁，事业有成但感情空白
    birth_date = "1988-03-15"
    birth_place = "Shanghai, China"
    name = "Zhang Wei"

    # Round 1: Initial Reading
    print(f"\n🔮 ROUND 1: Initial Reading")
    print(f"   Born: {birth_date} in {birth_place}")
    print("-" * 60)

    reading = await agent.initial_reading(birth_date, birth_place, name)
    print(f"\n[KARMA]:\n{reading}\n")

    # Round 2: User confirms career success but asks about love
    feedback_1 = "是的，我在金融行业做了10年，现在是VP。但我35岁了，还是单身，家里一直催婚。我想问问感情。"
    print(f"\n👤 USER: \"{feedback_1}\"")
    print("-" * 60)

    response_2 = await agent.continue_reading(birth_date, birth_place, feedback_1)
    print(f"\n[KARMA]:\n{response_2}\n")

    # Round 3: User pushes back / challenges
    feedback_2 = "可是我觉得我性格没问题啊？是不是就是命不好？"
    print(f"\n👤 USER: \"{feedback_2}\"")
    print("-" * 60)

    response_3 = await agent.continue_reading(birth_date, birth_place, feedback_2)
    print(f"\n[KARMA]:\n{response_3}\n")

    print("=" * 60)
    print("🎭 SIMULATION COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_simulation())
