import sys
import os
import asyncio
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from karma.agent import KarmaAgent

async def test_initial_reading_prompt():
    print("🧪 Testing Initial Reading Prompt Generation...")

    agent = KarmaAgent()

    # Mock data
    birth_date = "1990-01-01"
    birth_place = "Shanghai, China"
    name = "TestUser"

    # Mock ClaudeSDKClient
    with patch('karma.agent.ClaudeSDKClient') as mock_client_cls:
        # Create a mock instance
        mock_instance = MagicMock()
        # Ensure __aenter__ returns the mock instance (for 'async with')
        mock_instance.__aenter__.return_value = mock_instance
        mock_instance.__aexit__.return_value = None

        # Make query an async method
        mock_instance.query = AsyncMock()

        # Make receive_response an async iterator
        async def async_iter():
            yield MagicMock()
        mock_instance.receive_response.return_value.__aiter__ = lambda x: async_iter()

        mock_client_cls.return_value = mock_instance

        # Run the method
        await agent.initial_reading(birth_date, birth_place, name)

        # Get the call args
        call_args = mock_instance.query.call_args
        if not call_args:
            print("❌ Client.query was not called!")
            return

        prompt = call_args[0][0]

        # Verify Key Elements
        checks = {
            "Phase 1: Investigation": "PHASE 1: THE INVESTIGATION",
            "Phase 2: Synthesis": "PHASE 2: THE SYNTHESIS",
            "Geography Instruction": "Geography & Vibe",
            "History Instruction": "Historical Context",
            "Jianghu Techniques": "Two-Way Block",
            "Critical Instructions": "DO NOT reveal you searched"
        }

        all_passed = True
        for name, text in checks.items():
            if text in prompt:
                print(f"✅ Found {name}")
            else:
                print(f"❌ Missing {name}")
                all_passed = False

        if all_passed:
            print("\n✨ Prompt structure verified successfully!")
            print("\nPreview of Prompt Start:")
            print("-" * 40)
            print(prompt[:500] + "...")
            print("-" * 40)
        else:
            print("\n⚠️ Prompt verification failed.")

if __name__ == "__main__":
    asyncio.run(test_initial_reading_prompt())
