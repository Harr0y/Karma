import json
import tempfile
import unittest
from pathlib import Path

from karma.agent import KarmaAgent
from karma.core.prompt_builder import PromptBuilder
from karma.core.store import UserSessionStore


class PromptBuilderContractTests(unittest.TestCase):
    def test_initial_prompt_contains_contract_and_inputs(self):
        builder = PromptBuilder()
        prompt = builder.build_initial_prompt(
            birth_date="1991-03-15",
            birth_place="Austin, TX",
            name="Jordan",
            gender="male",
        )

        self.assertIn("NEW READING REQUEST", prompt)
        self.assertIn("NAME: Jordan", prompt)
        self.assertIn("BIRTH DATE: 1991-03-15", prompt)
        self.assertIn("BIRTH PLACE: Austin, TX", prompt)
        self.assertIn("Section headers or markdown", prompt)
        self.assertIn("LENGTH: Under 250 words", prompt)

    def test_followup_prompt_contains_context_and_contract(self):
        builder = PromptBuilder()
        prompt = builder.build_followup_prompt(
            history="ORACLE: test history",
            user_feedback="this landed",
        )

        self.assertIn("CONVERSATION REPLAY", prompt)
        self.assertIn("ORACLE: test history", prompt)
        self.assertIn("\"this landed\"", prompt)
        self.assertIn("Do NOT label or expose internal strategy.", prompt)
        self.assertIn("LENGTH: Under 200 words", prompt)


class UserSessionStoreTests(unittest.TestCase):
    def test_profile_and_history_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = UserSessionStore(Path(tmp) / "users")
            user_id = "u1"

            store.save_profile(user_id, {"name": "Alice"})
            profile = store.load_profile(user_id)
            self.assertEqual(profile["name"], "Alice")
            self.assertIn("updated_at", profile)

            store.save_conversation(user_id, "assistant", "hello")
            store.save_conversation(user_id, "user", "world")
            history = store.load_history(user_id, limit=5)
            self.assertIn("ORACLE: hello", history)
            self.assertIn("USER: world", history)

            session_log = store.create_session_log(user_id)
            store.log_to_session(session_log, "line1")
            self.assertTrue(session_log.exists())
            self.assertIn("line1", session_log.read_text(encoding="utf-8"))


class AgentFlowWithoutSDKTests(unittest.IsolatedAsyncioTestCase):
    async def test_initial_and_followup_flow_without_external_calls(self):
        with tempfile.TemporaryDirectory() as tmp:
            agent = KarmaAgent()
            agent.store = UserSessionStore(Path(tmp) / "users")

            async def fake_execute_query(**kwargs):
                return "stubbed response"

            async def fake_generate_audio_files(**kwargs):
                return []

            agent._execute_query = fake_execute_query  # type: ignore[method-assign]
            agent._generate_audio_files = fake_generate_audio_files  # type: ignore[method-assign]

            initial = await agent.initial_reading(
                birth_date="1991-03-15",
                birth_place="Austin, TX",
                name="Jordan",
                gender="male",
            )
            self.assertEqual(initial.text, "stubbed response")
            self.assertEqual(initial.audio_files, [])

            user_id = agent.generate_user_id("1991-03-15", "Austin, TX")
            conv_path = agent.store.get_user_dir(user_id) / "conversation.jsonl"
            self.assertTrue(conv_path.exists())
            initial_lines = [json.loads(line) for line in conv_path.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(len(initial_lines), 2)

            follow = await agent.continue_reading(
                birth_date="1991-03-15",
                birth_place="Austin, TX",
                user_feedback="go deeper",
            )
            self.assertEqual(follow.text, "stubbed response")
            self.assertEqual(follow.audio_files, [])

            all_lines = [json.loads(line) for line in conv_path.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(len(all_lines), 4)
            self.assertEqual(all_lines[-2]["role"], "user")
            self.assertEqual(all_lines[-1]["role"], "assistant")


if __name__ == "__main__":
    unittest.main()
