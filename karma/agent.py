"""
Karma Agent - Claude Agent SDK wrapper for mystical life pattern analysis.

This is a THIN wrapper around Claude Code's agentic capabilities.
Claude decides: write code, search web, use MCPs. No pre-built tools.
"""

import os
import json
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    TextBlock,
    ResultMessage,
    ToolUseBlock,
    UserMessage,
    SystemMessage,
)

# Load environment variables from project root (.env in parent directory)
_project_root = Path(__file__).parent.parent
load_dotenv(_project_root / ".env")

# Configure debug logging (controlled by KARMA_DEBUG env var, defaults to True)
DEBUG_MODE = os.getenv("KARMA_DEBUG", "true").lower() in ("true", "1", "yes", "on")
LOG_LEVEL = logging.DEBUG if DEBUG_MODE else logging.INFO

logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("KARMA")
logger.setLevel(LOG_LEVEL)


class KarmaAgent:
    """
    KARMA - Mystical life pattern analysis.

    This is a THIN wrapper. Claude Code does the heavy lifting:
    - Writes code to calculate astrological data
    - Searches web for information
    - Uses available MCP servers
    - Never guesses - always verifies
    """

    def __init__(self):
        """Initialize the Karma Agent."""
        self.users_dir = Path(__file__).parent / "users"
        self.users_dir.mkdir(exist_ok=True)

        # Get model from environment
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")

        # Load system prompt
        self.system_prompt = self._load_system_prompt()

        # Configure options - Use full claude_code preset (includes web search, all tools)
        self.options = ClaudeAgentOptions(
            tools={"type": "preset", "preset": "claude_code"},
            system_prompt=self.system_prompt,
        )

    def _get_user_dir(self, user_id: str) -> Path:
        """Get or create user directory."""
        user_dir = self.users_dir / user_id
        user_dir.mkdir(exist_ok=True)
        return user_dir

    def _get_files_dir(self, user_id: str) -> Path:
        """Get or create user files directory for code/artifacts."""
        files_dir = self._get_user_dir(user_id) / "files"
        files_dir.mkdir(exist_ok=True)
        return files_dir

    def _get_sessions_dir(self, user_id: str) -> Path:
        """Get or create user sessions directory."""
        sessions_dir = self._get_user_dir(user_id) / "sessions"
        sessions_dir.mkdir(exist_ok=True)
        return sessions_dir

    def _create_session_log(self, user_id: str) -> Path:
        """Create a new session log file with timestamp."""
        sessions_dir = self._get_sessions_dir(user_id)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_path = sessions_dir / f"session_{timestamp}.log"
        return session_path

    def _log_to_session(self, session_path: Path, message: str):
        """Write a log entry to the session file."""
        with open(session_path, "a", encoding="utf-8") as f:
            f.write(message + "\n")

    def _save_agent_file(self, user_id: str, file_path: str, content: str):
        """Save a file created by the agent to the user's files directory."""
        files_dir = self._get_files_dir(user_id)

        # Extract filename from the agent's file path
        filename = Path(file_path).name

        # Save to user's files directory
        user_file_path = files_dir / filename
        with open(user_file_path, "w", encoding="utf-8") as f:
            f.write(content)

        logger.debug(f"💾 Saved agent file: {filename}")

        return user_file_path

    def _save_conversation(self, user_id: str, role: str, content: str):
        """Append conversation entry to user's conversation history."""
        user_dir = self._get_user_dir(user_id)
        conv_path = user_dir / "conversation.jsonl"

        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "role": role,
            "content": content,
        }

        with open(conv_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")

    def _save_profile(self, user_id: str, profile: dict):
        """Save user profile information."""
        user_dir = self._get_user_dir(user_id)
        profile_path = user_dir / "profile.json"

        existing = {}
        if profile_path.exists():
            with open(profile_path, "r", encoding="utf-8") as f:
                existing = json.load(f)

        existing.update(profile)
        existing["updated_at"] = datetime.utcnow().isoformat()

        with open(profile_path, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2)

    def _load_profile(self, user_id: str) -> dict:
        """Load user profile information."""
        user_dir = self._get_user_dir(user_id)
        profile_path = user_dir / "profile.json"

        if not profile_path.exists():
            return {}

        with open(profile_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _load_system_prompt(self) -> str:
        """Load the system prompt from file."""
        prompt_path = Path(__file__).parent / "prompts" / "system.txt"
        try:
            return prompt_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return self._get_default_system_prompt()

    def _get_default_system_prompt(self) -> str:
        """Fallback system prompt if file not found."""
        return """You are KARMA. You reveal patterns.

CRITICAL: Never guess astrological data. WRITE CODE to calculate it.
When you need zodiac signs, life path numbers, or ages - write Python code.

Make it sound like SPEECH:
- Short sentences
- Natural pauses
- Talk directly to the user

Hit the shadow. Create urgency. Don't coddle."""

    def _get_current_date(self) -> str:
        """Get current date in readable format."""
        return datetime.now().strftime("%B %d, %Y")

    def generate_user_id(self, birth_date: str, birth_place: str) -> str:
        """Generate a consistent user ID from birth information."""
        import hashlib
        data = f"{birth_date}|{birth_place}".lower().strip()
        return hashlib.md5(data.encode()).hexdigest()[:16]

    async def initial_reading(
        self,
        birth_date: str,
        birth_place: str,
        name: Optional[str] = None,
    ) -> str:
        """
        Generate an initial life pattern reading.

        Args:
            birth_date: Date in YYYY-MM-DD format
            birth_place: Birth location (ZIP code or city)
            name: Optional user name for personalization

        Returns:
            The generated reading text
        """
        user_id = self.generate_user_id(birth_date, birth_place)

        # Save profile
        profile = {
            "birth_date": birth_date,
            "birth_place": birth_place,
            "name": name,
            "user_id": user_id,
            "created_at": datetime.utcnow().isoformat(),
        }
        self._save_profile(user_id, profile)

        greeting = f"{name}" if name else "friend"
        current_date = self._get_current_date()

        user_prompt = f"""You are KARMA. You reveal patterns.

USER: {greeting}
BORN: {birth_date}
BIRTH PLACE: {birth_place}
TODAY: {current_date}

YOUR TASK:
Generate a mystical life pattern reading.

HOW TO APPROACH:

1. GATHER DATA - WRITE CODE to calculate:
   - Zodiac sign (from birth date)
   - Life path number (numerology)
   - Chinese zodiac (from birth year)
   - Current age
   - Critical life years

   DO NOT GUESS. Write Python code to get accurate data.

2. DELIVER YOUR READING

   Write for SPEECH, not writing:
   - Short sentences
   - Natural pauses with "..."
   - Talk directly to "you"
   - No numbered lists
   - No headers
   - No technical jargon

3. OPEN WITH IMPACT

   - ONE truth from their pattern
   - 2-3 specific time points
   - ONE shadow truth about what they're hiding

   End with: "Does that land?"

MISSING DATA RULES:
- NO birth time = NO Rising sign (don't mention it)
- Uncertain Moon = say "Moon was transitioning signs that day"

Current date: {current_date}.

Begin now."""

        # Create session log file
        session_path = self._create_session_log(user_id)

        logger.info("=" * 60)
        logger.info(f"📤 SENDING QUERY TO CLAUDE (session: {session_path.name})")
        logger.info("=" * 60)
        logger.debug(f"Query prompt:\n{user_prompt}")
        logger.info("=" * 60)

        # Log to session file
        self._log_to_session(session_path, "=" * 60)
        self._log_to_session(session_path, f"SESSION START: {datetime.now().isoformat()}")
        self._log_to_session(session_path, f"USER: {greeting if name else 'friend'}")
        self._log_to_session(session_path, f"BORN: {birth_date}")
        self._log_to_session(session_path, f"BIRTH PLACE: {birth_place}")
        self._log_to_session(session_path, "=" * 60)
        self._log_to_session(session_path, "")

        reading = ""
        message_count = 0
        async with ClaudeSDKClient(options=self.options) as client:
            await client.query(user_prompt)

            async for message in client.receive_response():
                message_count += 1
                msg_type = type(message).__name__
                logger.debug(f"📥 MESSAGE #{message_count}: {msg_type}")

                # Log to session file
                self._log_to_session(session_path, f"[{msg_type}] Message #{message_count}")

                if isinstance(message, SystemMessage):
                    # System prompt
                    logger.debug(f"   (System message)")
                    self._log_to_session(session_path, f"  [System message - {message.subtype}]")

                elif isinstance(message, AssistantMessage):
                    logger.debug(f"   Content blocks: {len(message.content)}")
                    self._log_to_session(session_path, f"  Content blocks: {len(message.content)}")

                    for i, block in enumerate(message.content):
                        block_type = type(block).__name__
                        logger.debug(f"   Block #{i}: {block_type}")
                        self._log_to_session(session_path, f"    Block #{i}: {block_type}")

                        if isinstance(block, TextBlock):
                            text_preview = block.text[:200] + ('...' if len(block.text) > 200 else '')
                            logger.info(f"✍️  TEXT: {text_preview}")
                            self._log_to_session(session_path, f"      TEXT: {block.text}")
                            reading += block.text

                        elif isinstance(block, ToolUseBlock):
                            logger.info(f"🔧 TOOL CALL: {block.name}")
                            logger.debug(f"   Input: {block.input}")

                            # Log tool call to session
                            self._log_to_session(session_path, f"      TOOL: {block.name}")
                            self._log_to_session(session_path, f"      INPUT: {json.dumps(block.input, indent=2)}")

                            # Save files created by agent
                            if block.name == "Write" and "file_path" in block.input:
                                file_path = block.input.get("file_path", "")
                                content = block.input.get("content", "")
                                if content:
                                    saved_path = self._save_agent_file(user_id, file_path, content)
                                    self._log_to_session(session_path, f"      SAVED TO: {saved_path}")

                elif isinstance(message, UserMessage):
                    # Tool result
                    logger.debug(f"   UserMessage (tool result)")
                    self._log_to_session(session_path, f"  [Tool Result]")
                    if hasattr(message, 'content') and message.content:
                        for block in message.content:
                            if hasattr(block, 'text'):
                                result_preview = block.text[:200] + ('...' if len(block.text) > 200 else '')
                                self._log_to_session(session_path, f"    {result_preview}")

                elif isinstance(message, ResultMessage):
                    logger.debug("   ✅ ResultMessage - stream complete")
                    self._log_to_session(session_path, f"  [Stream Complete]")
                    self._log_to_session(session_path, "")
                    break

        logger.info("=" * 60)
        logger.info("📥 FULL RESPONSE RECEIVED")
        logger.info("=" * 60)
        logger.debug(f"Complete reading:\n{reading}")
        logger.info("=" * 60)

        # Final session log entry
        self._log_to_session(session_path, "=" * 60)
        self._log_to_session(session_path, "FINAL READING:")
        self._log_to_session(session_path, reading)
        self._log_to_session(session_path, "=" * 60)
        self._log_to_session(session_path, f"SESSION END: {datetime.now().isoformat()}")

        # Save conversation
        self._save_conversation(user_id, "assistant", reading)
        self._save_conversation(user_id, "user", f"Initial request: birth_date={birth_date}, birth_place={birth_place}")

        return reading

    async def continue_reading(
        self,
        birth_date: str,
        birth_place: str,
        user_feedback: str,
    ) -> str:
        """
        Continue a reading based on user feedback.

        Args:
            birth_date: Date in YYYY-MM-DD format
            birth_place: Birth location
            user_feedback: User's response to the previous reading

        Returns:
            The follow-up reading text
        """
        user_id = self.generate_user_id(birth_date, birth_place)
        current_date = self._get_current_date()

        follow_up_prompt = f"""You are KARMA. You reveal patterns.

USER BORN: {birth_date} in {birth_place}
TODAY: {current_date}

USER SAYS: "{user_feedback}"

HOW TO RESPOND:

If they confirm something:
→ Go deeper. "Good. Now I can tell you what this actually means..."

If they deny or challenge:
→ Don't defend. Pivot. "Then let me look deeper..."

If they expose a wound:
→ "Good. NOW we're getting somewhere."
→ Hit the shadow beneath

WRITE FOR VOICE:
- Short sentences
- Pauses with "..." where you'd naturally pause speaking
- Talk directly to "you"
- No numbered lists
- No headers
- No technical jargon

End with: "Does that land?" or "Want me to go deeper?"

REMEMBER:
- Never guess data. Write code if you need to calculate something.
- Current date: {current_date}."""

        # Create session log file
        session_path = self._create_session_log(user_id)

        logger.info("=" * 60)
        logger.info(f"📤 SENDING FOLLOW-UP QUERY (session: {session_path.name})")
        logger.info("=" * 60)
        logger.debug(f"User feedback: {user_feedback[:100]}{'...' if len(user_feedback) > 100 else ''}")
        logger.debug(f"Follow-up prompt:\n{follow_up_prompt}")
        logger.info("=" * 60)

        # Log to session file
        self._log_to_session(session_path, "=" * 60)
        self._log_to_session(session_path, f"FOLLOW-UP SESSION START: {datetime.now().isoformat()}")
        self._log_to_session(session_path, f"USER FEEDBACK: {user_feedback[:200]}{'...' if len(user_feedback) > 200 else ''}")
        self._log_to_session(session_path, "=" * 60)
        self._log_to_session(session_path, "")

        response = ""
        message_count = 0
        async with ClaudeSDKClient(options=self.options) as client:
            await client.query(follow_up_prompt)

            async for message in client.receive_response():
                message_count += 1
                msg_type = type(message).__name__
                logger.debug(f"📥 MESSAGE #{message_count}: {msg_type}")

                # Log to session file
                self._log_to_session(session_path, f"[{msg_type}] Message #{message_count}")

                if isinstance(message, AssistantMessage):
                    logger.debug(f"   Content blocks: {len(message.content)}")
                    self._log_to_session(session_path, f"  Content blocks: {len(message.content)}")

                    for i, block in enumerate(message.content):
                        block_type = type(block).__name__
                        logger.debug(f"   Block #{i}: {block_type}")
                        self._log_to_session(session_path, f"    Block #{i}: {block_type}")

                        if isinstance(block, TextBlock):
                            text_preview = block.text[:200] + ('...' if len(block.text) > 200 else '')
                            logger.info(f"✍️  TEXT: {text_preview}")
                            self._log_to_session(session_path, f"      TEXT: {block.text}")
                            response += block.text

                        elif isinstance(block, ToolUseBlock):
                            logger.info(f"🔧 TOOL CALL: {block.name}")
                            logger.debug(f"   Input: {block.input}")

                            # Log tool call to session
                            self._log_to_session(session_path, f"      TOOL: {block.name}")
                            self._log_to_session(session_path, f"      INPUT: {json.dumps(block.input, indent=2)}")

                            # Save files created by agent
                            if block.name == "Write" and "file_path" in block.input:
                                file_path = block.input.get("file_path", "")
                                content = block.input.get("content", "")
                                if content:
                                    saved_path = self._save_agent_file(user_id, file_path, content)
                                    self._log_to_session(session_path, f"      SAVED TO: {saved_path}")

                elif isinstance(message, UserMessage):
                    # Tool result
                    logger.debug(f"   UserMessage (tool result)")
                    self._log_to_session(session_path, f"  [Tool Result]")
                    if hasattr(message, 'content') and message.content:
                        for block in message.content:
                            if hasattr(block, 'text'):
                                result_preview = block.text[:200] + ('...' if len(block.text) > 200 else '')
                                self._log_to_session(session_path, f"    {result_preview}")

                elif isinstance(message, ResultMessage):
                    logger.debug("   ✅ ResultMessage - stream complete")
                    self._log_to_session(session_path, f"  [Stream Complete]")
                    self._log_to_session(session_path, "")
                    break

        logger.info("=" * 60)
        logger.info("📥 FOLLOW-UP RESPONSE RECEIVED")
        logger.info("=" * 60)
        logger.debug(f"Complete response:\n{response}")
        logger.info("=" * 60)

        # Final session log entry
        self._log_to_session(session_path, "=" * 60)
        self._log_to_session(session_path, "FINAL RESPONSE:")
        self._log_to_session(session_path, response)
        self._log_to_session(session_path, "=" * 60)
        self._log_to_session(session_path, f"SESSION END: {datetime.now().isoformat()}")

        # Save conversation
        self._save_conversation(user_id, "user", user_feedback)
        self._save_conversation(user_id, "assistant", response)

        return response


def create_agent() -> KarmaAgent:
    """
    Factory function to create a KarmaAgent instance.

    Returns:
        Configured KarmaAgent instance
    """
    return KarmaAgent()


# ============================================================================
# CONVENIENCE SYNC FUNCTIONS
# ============================================================================

def initial_reading_sync(
    birth_date: str,
    birth_place: str,
    name: Optional[str] = None,
) -> str:
    """Synchronous wrapper for initial_reading."""
    return asyncio.run(create_agent().initial_reading(birth_date, birth_place, name))


def continue_reading_sync(
    birth_date: str,
    birth_place: str,
    user_feedback: str,
) -> str:
    """Synchronous wrapper for continue_reading."""
    return asyncio.run(create_agent().continue_reading(birth_date, birth_place, user_feedback))
