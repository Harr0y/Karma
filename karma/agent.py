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
from typing import Optional, List
from dataclasses import dataclass
import re

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

from tts import generate_tts

# Load environment variables from project root (.env in parent directory)
_project_root = Path(__file__).parent.parent
load_dotenv(_project_root / ".env")

# Configure debug logging (controlled by KARMA_DEBUG env var, defaults to True)
DEBUG_MODE = os.getenv("KARMA_DEBUG", "true").lower() in ("true", "1", "yes", "on")
LOG_LEVEL = logging.DEBUG if DEBUG_MODE else logging.INFO


@dataclass
class ReadingResponse:
    """Structured response containing text and audio files."""
    text: str
    audio_files: List[Path]


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

    def _get_audio_dir(self, user_id: str) -> Path:
        """Get or create user audio directory for TTS output."""
        audio_dir = self._get_user_dir(user_id) / "audio"
        audio_dir.mkdir(exist_ok=True)
        return audio_dir

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

    def _load_system_prompt(self, user_id: str = None) -> str:
        """Load the system prompt from file with audio directory placeholder."""
        prompt_path = Path(__file__).parent / "prompts" / "system.txt"
        try:
            prompt = prompt_path.read_text(encoding="utf-8")

            # Replace audio directory placeholder if user_id provided
            if user_id:
                audio_dir = self._get_audio_dir(user_id)
                prompt = prompt.replace("{audio_dir}", str(audio_dir))

            return prompt
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

    def _extract_audio_files(self, text: str, user_id: str) -> List[Path]:
        """Extract audio file paths from response text."""
        audio_dir = self._get_audio_dir(user_id)

        # Pattern: [AUDIO_FILES: file1.mp3, file2.mp3]
        pattern = r'\[AUDIO_FILES:\s*([^\]]+)\]'
        match = re.search(pattern, text)

        if not match:
            return []

        files_str = match.group(1)
        file_names = [f.strip() for f in files_str.split(',')]

        audio_files = []
        for name in file_names:
            # Handle both full paths and just filenames
            if name.startswith('/'):
                path = Path(name)
            else:
                path = audio_dir / name

            if path.exists():
                audio_files.append(path)
            else:
                # Try to find in audio_dir by matching partial name
                for f in audio_dir.glob("*.mp3"):
                    if name in f.name:
                        audio_files.append(f)
                        break

        return audio_files

    def generate_user_id(self, birth_date: str, birth_place: str) -> str:
        """Generate a consistent user ID from birth information."""
        import hashlib
        data = f"{birth_date}|{birth_place}".lower().strip()
        return hashlib.md5(data.encode()).hexdigest()[:16]

    def _load_history(self, user_id: str, limit: int = 5) -> str:
        """Load recent conversation history."""
        user_dir = self._get_user_dir(user_id)
        conv_path = user_dir / "conversation.jsonl"

        if not conv_path.exists():
            return ""

        history = []
        with open(conv_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    try:
                        entry = json.loads(line)
                        role = "ORACLE" if entry["role"] == "assistant" else "USER"
                        content = entry["content"]
                        history.append(f"{role}: {content}")
                    except:
                        continue

        return "\n\n".join(history[-limit:])

    async def initial_reading(
        self,
        birth_date: str,
        birth_place: str,
        name: Optional[str] = None,
    ) -> ReadingResponse:
        """
        Generate an initial life pattern reading with voice.
        """
        user_id = self.generate_user_id(birth_date, birth_place)

        # Ensure audio directory exists
        audio_dir = self._get_audio_dir(user_id)

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

        user_prompt = f"""A SOUL AWAITS YOUR READING:

USER: {greeting}
BORN: {birth_date} in {birth_place}
TODAY: {current_date}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR TASK - COMPLETE IN SILENCE, THEN SPEAK:

Step 1 (SILENT - Don't describe this): Use WebSearch and Bash tools to find:
- The energy/vibe of "{birth_place}"
- Major events when they turned 18, 21, and 28
- Calculate: Age, Sun Sign, Moon Sign, Life Path Number, Chinese Zodiac

Step 2 (YOUR ONLY OUTPUT): Deliver the mystical reading.

START YOUR RESPONSE IMMEDIATELY with:
"Listen..." or "I see..." or similar.

NEVER write these phrases:
❌ "I need to gather intelligence"
❌ "Let me search" / "Let me calculate"
❌ "I'll begin" / "I'll proceed"
❌ "Based on my research" / "I found that"

YOUR OUTPUT = THE READING. NOTHING BEFORE IT.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

End by asking: "Does this sound right to you?"

Begin NOW. Speak directly.
After writing your reading, you MUST generate voice audio using `text_to_audio` tool.
Split into segments of ~150-180 Chinese characters each.
Save to: {audio_dir}
End with: [AUDIO_FILES: file1.mp3, file2.mp3, ...]
"""

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

        # Update system prompt with user-specific audio path
        dynamic_system_prompt = self._load_system_prompt(user_id)

        # Create options with dynamic prompt
        options = ClaudeAgentOptions(
            tools={"type": "preset", "preset": "claude_code"},
            system_prompt=dynamic_system_prompt,
        )

        reading = ""
        message_count = 0
        async with ClaudeSDKClient(options=options) as client:
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

        # Generate TTS audio using MiniMax API directly
        audio_files = []
        if reading.strip():
            logger.info("🎙️ Generating TTS audio via MiniMax API...")
            audio_files = await generate_tts(
                text=reading,
                output_dir=audio_dir,
                prefix="reading",
            )
            logger.info(f"🎙️ Generated {len(audio_files)} audio file(s)")

        return ReadingResponse(text=reading, audio_files=audio_files)

    async def continue_reading(
        self,
        birth_date: str,
        birth_place: str,
        user_feedback: str,
    ) -> ReadingResponse:
        """
        Continue a reading based on user feedback with voice.
        """
        user_id = self.generate_user_id(birth_date, birth_place)
        current_date = self._get_current_date()

        # Ensure audio directory exists
        audio_dir = self._get_audio_dir(user_id)

        # Load history
        history = self._load_history(user_id)

        follow_up_prompt = f"""CONTEXT REPLAY:
{history}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

USER FEEDBACK (Latest): "{user_feedback}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR MISSION: ADJUST AND GUIDE
You are the "Master". You don't just react; you GUIDE.

1.  **Analyze the Feedback**:
    -   Did they confirm? -> "Good. I knew it." -> Go deeper.
    -   Did they deny? -> "Let me look closer..." -> Pivot using "Two-Way Block".
    -   Did they ask about career/love? -> Use "Distant Hope" (Success is in 2028).

2.  **Voice Style**:
    -   Keep it spoken. "Right...", "Okay, I see...", "Here's the thing..."
    -   Don't be perfect. Be real.

3.  **The "Hook"**:
    -   Always end with a question that leads them to reveal more.
    -   "Does that ring a bell?"
    -   "You know what I mean?"

Respond now. Keep the mystical frame.

AUDIO OUTPUT REMINDER:
After writing your response, you MUST generate voice audio using `text_to_audio` tool.
Split into segments of ~150-180 Chinese characters each.
Save to: {audio_dir}
End with: [AUDIO_FILES: file1.mp3, file2.mp3, ...]
"""

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

        # Update system prompt with user-specific audio path
        dynamic_system_prompt = self._load_system_prompt(user_id)

        # Create options with dynamic prompt
        options = ClaudeAgentOptions(
            tools={"type": "preset", "preset": "claude_code"},
            system_prompt=dynamic_system_prompt,
        )

        response = ""
        message_count = 0
        async with ClaudeSDKClient(options=options) as client:
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

        # Generate TTS audio using MiniMax API directly
        audio_files = []
        if response.strip():
            logger.info("🎙️ Generating TTS audio via MiniMax API...")
            audio_files = await generate_tts(
                text=response,
                output_dir=audio_dir,
                prefix="followup",
            )
            logger.info(f"🎙️ Generated {len(audio_files)} audio file(s)")

        return ReadingResponse(text=response, audio_files=audio_files)


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
) -> ReadingResponse:
    """Synchronous wrapper for initial_reading."""
    return asyncio.run(create_agent().initial_reading(birth_date, birth_place, name))


def continue_reading_sync(
    birth_date: str,
    birth_place: str,
    user_feedback: str,
) -> ReadingResponse:
    """Synchronous wrapper for continue_reading."""
    return asyncio.run(create_agent().continue_reading(birth_date, birth_place, user_feedback))
