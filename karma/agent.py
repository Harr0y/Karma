"""
Karma Agent - Claude Agent SDK wrapper for mystical life pattern analysis.

This is a THIN wrapper around Claude Code's agentic capabilities.
Claude decides: write code, search web, use MCPs. No pre-built tools.
"""

import os
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List
from dataclasses import dataclass
import re

from dotenv import load_dotenv
from claude_agent_sdk import ClaudeAgentOptions

try:
    from karma.core import UserSessionStore, ClaudeTurnRunner, TTSService, PromptBuilder
except ImportError:
    from core import UserSessionStore, ClaudeTurnRunner, TTSService, PromptBuilder

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
        self.store = UserSessionStore(Path(__file__).parent / "users")
        self.audio_service = TTSService(logger)
        self.prompt_builder = PromptBuilder()

        # Get model from environment
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")

        # Load system prompt snapshot (runtime uses dynamic user-scoped prompt)
        self.system_prompt = self._load_system_prompt()

        self.runner = ClaudeTurnRunner(
            logger=logger,
            option_builder=self._build_options,
            save_agent_file=self.store.save_agent_file,
            log_to_session=self.store.log_to_session,
        )

    def _get_user_dir(self, user_id: str) -> Path:
        """Get or create user directory."""
        return self.store.get_user_dir(user_id)

    def _get_files_dir(self, user_id: str) -> Path:
        """Get or create user files directory for code/artifacts."""
        return self.store.get_files_dir(user_id)

    def _get_sessions_dir(self, user_id: str) -> Path:
        """Get or create user sessions directory."""
        return self.store.get_sessions_dir(user_id)

    def _get_audio_dir(self, user_id: str) -> Path:
        """Get or create user audio directory for TTS output."""
        return self.store.get_audio_dir(user_id)

    def _create_session_log(self, user_id: str) -> Path:
        """Create a new session log file with timestamp."""
        return self.store.create_session_log(user_id)

    def _log_to_session(self, session_path: Path, message: str):
        """Write a log entry to the session file."""
        self.store.log_to_session(session_path, message)

    def _save_agent_file(self, user_id: str, file_path: str, content: str):
        """Save a file created by the agent to the user's files directory."""
        saved_path = self.store.save_agent_file(user_id, file_path, content)
        logger.debug(f"💾 Saved agent file: {saved_path.name}")
        return saved_path

    def _save_conversation(self, user_id: str, role: str, content: str):
        """Append conversation entry to user's conversation history."""
        self.store.save_conversation(user_id, role, content)

    def _save_profile(self, user_id: str, profile: dict):
        """Save user profile information."""
        self.store.save_profile(user_id, profile)

    def _load_profile(self, user_id: str) -> dict:
        """Load user profile information."""
        return self.store.load_profile(user_id)

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
        return self.store.load_history(user_id, limit=limit)

    def _build_followup_prompt(
        self,
        user_id: str,
        user_feedback: str,
    ) -> str:
        """Build follow-up prompt via prompt builder."""
        history = self._load_history(user_id)
        return self.prompt_builder.build_followup_prompt(history=history, user_feedback=user_feedback)

    def _build_options(self, user_id: str) -> ClaudeAgentOptions:
        """Build Claude SDK options with user-scoped dynamic system prompt."""
        dynamic_system_prompt = self._load_system_prompt(user_id)
        return ClaudeAgentOptions(
            tools={"type": "preset", "preset": "claude_code"},
            system_prompt=dynamic_system_prompt,
        )

    def _start_session_log(self, session_path: Path, header_lines: List[str]):
        """Write a standard session header block."""
        self._log_to_session(session_path, "=" * 60)
        for line in header_lines:
            self._log_to_session(session_path, line)
        self._log_to_session(session_path, "=" * 60)
        self._log_to_session(session_path, "")

    async def _execute_query(
        self,
        user_id: str,
        prompt: str,
        session_path: Path,
        query_log_title: str,
        response_log_title: str,
    ) -> str:
        """Execute a Claude query and return merged assistant text."""
        return await self.runner.execute_query(
            user_id=user_id,
            prompt=prompt,
            session_path=session_path,
            query_log_title=query_log_title,
            response_log_title=response_log_title,
        )

    async def _generate_audio_files(
        self,
        text: str,
        output_dir: Path,
        prefix: str,
    ) -> List[Path]:
        """Generate TTS audio if text is non-empty."""
        return await self.audio_service.generate(text=text, output_dir=output_dir, prefix=prefix)

    async def initial_reading(
        self,
        birth_date: str,
        birth_place: str,
        name: Optional[str] = None,
        gender: Optional[str] = None,
    ) -> ReadingResponse:
        """
        Generate an initial life pattern reading with voice.

        Args:
            birth_date: Birth date in YYYY-MM-DD format
            birth_place: Birth place (city, country)
            name: Optional name for greeting
            gender: Optional gender ('male', 'female', or None for unknown)
        """
        user_id = self.generate_user_id(birth_date, birth_place)

        # Ensure audio directory exists
        audio_dir = self._get_audio_dir(user_id)

        # Save profile
        profile = {
            "birth_date": birth_date,
            "birth_place": birth_place,
            "name": name,
            "gender": gender,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._save_profile(user_id, profile)

        greeting = f"{name}" if name else "seeker"
        user_prompt = self.prompt_builder.build_initial_prompt(
            birth_date=birth_date,
            birth_place=birth_place,
            name=name,
            gender=gender,
        )

        # Create session log file
        session_path = self._create_session_log(user_id)
        self._start_session_log(
            session_path,
            [
                f"SESSION START: {datetime.now().isoformat()}",
                f"USER: {greeting if name else 'friend'}",
                f"BORN: {birth_date}",
                f"BIRTH PLACE: {birth_place}",
            ],
        )
        reading = await self._execute_query(
            user_id=user_id,
            prompt=user_prompt,
            session_path=session_path,
            query_log_title=f"📤 SENDING QUERY TO CLAUDE (session: {session_path.name})",
            response_log_title="📥 FULL RESPONSE RECEIVED",
        )

        # Final session log entry
        self._log_to_session(session_path, "=" * 60)
        self._log_to_session(session_path, "FINAL READING:")
        self._log_to_session(session_path, reading)
        self._log_to_session(session_path, "=" * 60)
        self._log_to_session(session_path, f"SESSION END: {datetime.now().isoformat()}")

        # Save conversation
        self._save_conversation(user_id, "assistant", reading)
        self._save_conversation(user_id, "user", f"Initial request: birth_date={birth_date}, birth_place={birth_place}")

        audio_files = await self._generate_audio_files(
            text=reading,
            output_dir=audio_dir,
            prefix="reading",
        )

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

        # Ensure audio directory exists
        audio_dir = self._get_audio_dir(user_id)

        # Build follow-up prompt (strategy inferred by prompt policy)
        follow_up_prompt = self._build_followup_prompt(
            user_id=user_id,
            user_feedback=user_feedback,
        )

        # Create session log file
        session_path = self._create_session_log(user_id)
        self._start_session_log(
            session_path,
            [
                f"FOLLOW-UP SESSION START: {datetime.now().isoformat()}",
                f"USER FEEDBACK: {user_feedback[:200]}{'...' if len(user_feedback) > 200 else ''}",
            ],
        )
        response = await self._execute_query(
            user_id=user_id,
            prompt=follow_up_prompt,
            session_path=session_path,
            query_log_title=f"📤 SENDING FOLLOW-UP QUERY (session: {session_path.name})",
            response_log_title="📥 FOLLOW-UP RESPONSE RECEIVED",
        )

        # Final session log entry
        self._log_to_session(session_path, "=" * 60)
        self._log_to_session(session_path, "FINAL RESPONSE:")
        self._log_to_session(session_path, response)
        self._log_to_session(session_path, "=" * 60)
        self._log_to_session(session_path, f"SESSION END: {datetime.now().isoformat()}")

        # Save conversation
        self._save_conversation(user_id, "user", user_feedback)
        self._save_conversation(user_id, "assistant", response)

        audio_files = await self._generate_audio_files(
            text=response,
            output_dir=audio_dir,
            prefix="followup",
        )

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
    gender: Optional[str] = None,
) -> ReadingResponse:
    """Synchronous wrapper for initial_reading."""
    return asyncio.run(create_agent().initial_reading(birth_date, birth_place, name, gender))


def continue_reading_sync(
    birth_date: str,
    birth_place: str,
    user_feedback: str,
) -> ReadingResponse:
    """Synchronous wrapper for continue_reading."""
    return asyncio.run(create_agent().continue_reading(birth_date, birth_place, user_feedback))
