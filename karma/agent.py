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

try:
    from karma.tts import generate_tts
except ImportError:
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

    def _analyze_feedback_type(self, feedback: str) -> str:
        """
        Analyze user feedback type with nuanced detection.
        Returns: 'confirm', 'deny', 'partial', 'question', 'info_share', 'neutral'

        Priority order matters:
        1. Question - they're asking something
        2. Info share - they're volunteering information (GOLD for probe-then-lock)
        3. Deny - they're disagreeing
        4. Confirm - they're agreeing
        5. Partial - they're uncertain
        6. Neutral - default
        """
        feedback_lower = feedback.lower().strip()

        # Remove punctuation for cleaner matching
        import re
        feedback_clean = re.sub(r'[^\w\s]', ' ', feedback_lower)

        # 1. QUESTION - Check first (they want answers)
        question_starters = [
            'what', 'how', 'why', 'when', 'where', 'who', 'which',
            'can you', 'could you', 'would you', 'should i', 'will',
            'is it', 'is there', 'are there', 'do you', 'does',
            # Chinese
            '什么', '怎么', '为什么', '什么时候', '哪里', '谁', '哪个',
            '能不能', '可以', '会不会', '是不是'
        ]
        if feedback_lower.endswith('?') or feedback_lower.endswith('？'):
            return 'question'
        if any(feedback_clean.startswith(q) for q in question_starters):
            return 'question'

        # 2. INFO SHARE - They're volunteering specific information (MOST VALUABLE)
        # Look for patterns like "I [verb]", "My [noun]", specific years, life events
        info_patterns = [
            r'\b(i |my |we |our )',  # Personal statements
            r'\b(in 20\d{2}|last year|this year|few years ago)',  # Time references
            r'\b(married|divorced|job|career|moved|started|ended|born|died)',  # Life events
            r'\b(husband|wife|partner|child|kids|parent|mother|father)',  # Relationships
            r'\b(actually|the truth is|to be honest|honestly)',  # Disclosure markers
            # Chinese info patterns
            r'(我|我们|我的|其实|说实话|实际上)',
            r'(结婚|离婚|工作|搬|开始|结束|生|去世)',
            r'(老公|老婆|孩子|父母|妈|爸)'
        ]
        for pattern in info_patterns:
            if re.search(pattern, feedback_lower):
                # But not if it's clearly a denial or confirmation
                if not any(d in feedback_lower for d in ['no', 'wrong', 'not true', '不对', '没有', '错']):
                    if not any(c in feedback_lower for c in ['yes', 'right', 'correct', '对', '是的', '准']):
                        return 'info_share'

        # 3. DENY - They're disagreeing (check before confirm)
        deny_phrases = [
            # Strong denial
            "that's wrong", "that's not right", "didn't happen", "not true",
            "completely wrong", "totally wrong", "way off", "not at all",
            "none of that", "nothing like that",
            # Softer denial
            "not really", "i don't think so", "that doesn't fit",
            "doesn't resonate", "doesn't land", "missed the mark",
            # Chinese
            '不对', '不是', '没有', '错了', '不准', '不符合', '都不对',
            '完全不对', '不是这样', '没发生'
        ]
        deny_words = ['no', 'nope', 'wrong', 'incorrect', 'false', 'never']

        for phrase in deny_phrases:
            if phrase in feedback_lower:
                return 'deny'
        # Single word denial only if it's the main content
        if len(feedback_clean.split()) <= 3:
            for word in deny_words:
                if word in feedback_clean.split():
                    return 'deny'

        # 4. CONFIRM - They're agreeing
        confirm_phrases = [
            # Strong confirmation
            "that's right", "that's correct", "spot on", "exactly right",
            "completely accurate", "very accurate", "so true", "absolutely",
            "you nailed it", "hit the nail", "that's it exactly",
            # Softer confirmation
            "makes sense", "resonates", "lands", "tracks", "sounds right",
            "i can see that", "that fits",
            # Chinese
            '对', '是的', '准', '正确', '说得对', '确实', '没错',
            '太准了', '很准', '就是这样', '有道理'
        ]
        confirm_words = ['yes', 'yeah', 'yep', 'correct', 'right', 'true', 'exactly', 'accurate']

        for phrase in confirm_phrases:
            if phrase in feedback_lower:
                return 'confirm'
        if len(feedback_clean.split()) <= 3:
            for word in confirm_words:
                if word in feedback_clean.split():
                    return 'confirm'

        # 5. PARTIAL - Uncertain or mixed response
        partial_phrases = [
            'not quite', 'not exactly', 'sort of', 'kind of', 'maybe',
            'possibly', 'somewhat', 'almost', 'close', 'nearly',
            'partially', 'in a way', 'to some extent', 'half right',
            'some of it', 'part of it', 'bits of it',
            # Chinese
            '有点', '差不多', '部分', '有些', '可能', '大概', '算是'
        ]
        for phrase in partial_phrases:
            if phrase in feedback_lower:
                return 'partial'

        # 6. Default to neutral (could be anything - treat as potential info share)
        return 'neutral'

    def _generate_followup_prompt(
        self,
        user_id: str,
        user_feedback: str,
        feedback_type: str,
    ) -> str:
        """Generate follow-up prompt based on feedback analysis using probe-then-lock technique."""
        history = self._load_history(user_id)
        audio_dir = self._get_audio_dir(user_id)

        base_context = f"""═══════════════════════════════════════════════════════════════
CONVERSATION REPLAY
═══════════════════════════════════════════════════════════════
{history}

═══════════════════════════════════════════════════════════════
USER'S LATEST MESSAGE
═══════════════════════════════════════════════════════════════
"{user_feedback}"

DETECTED FEEDBACK TYPE: {feedback_type.upper()}
"""

        # Tailored instructions based on feedback type
        if feedback_type == 'confirm':
            instructions = """
═══════════════════════════════════════════════════════════════
STRATEGY: CONFIRMATION → GO DEEPER
═══════════════════════════════════════════════════════════════

You HIT. Now leverage this trust.

1. LOCK IT: "Good... that's exactly what I was seeing..."
2. GO DEEPER: Expand on the confirmed topic with more specific predictions
3. ADD RELATED PREDICTION: Use their confirmation to predict something related
   - If they confirmed a relationship issue → predict the resolution timeline
   - If they confirmed career frustration → predict the breakthrough window
4. REINFORCE AUTHORITY: Add one abstract authority term
   - "This aligns with your [Saturn Return / Fire-Metal clash / Life Path]..."
5. END WITH HOOK: Pull them deeper
   - "Now here's what this tells me about what's coming..."
   - "Does that track? What else is weighing on you?"

TONE: Confident. You knew this. Now reveal more.
"""

        elif feedback_type == 'deny':
            instructions = """
═══════════════════════════════════════════════════════════════
STRATEGY: DENIAL → PIVOT (NEVER ADMIT WRONG)
═══════════════════════════════════════════════════════════════

They denied. DO NOT say "I was wrong." PIVOT instead.

PIVOT OPTIONS (use one):

1. TIME DELAY:
   "Hmm. If it didn't show up then, that energy likely got pushed forward...
   probably to [year + 2-3]. Does that window feel different?"

2. DIFFERENT LAYER:
   "Let me look at another aspect of that period..."

3. SUBTLE MANIFESTATION:
   "Maybe you didn't notice at the time — this energy can work beneath
   the surface before it becomes obvious..."

4. DIFFERENT DOMAIN:
   "If it wasn't [career/relationship/health], it might have shown up
   in a different area. What WAS going on around that time?"

5. REDIRECT TO QUESTION (BEST OPTION):
   "Interesting. What DID happen around that time that stands out to you?"
   → Use their answer to anchor your next prediction

FORBIDDEN:
- "I was wrong"
- "That's not right"
- "Let me correct myself"

TONE: Thoughtful, curious. You're exploring, not retreating.
"""

        elif feedback_type == 'partial':
            instructions = """
═══════════════════════════════════════════════════════════════
STRATEGY: PARTIAL → REFINE THROUGH DIALOGUE
═══════════════════════════════════════════════════════════════

They're uncertain. This is an OPPORTUNITY to gather more information.

1. VALIDATE THE UNCERTAINTY:
   "It feels familiar but you can't quite pin it down, right?
   That's because this energy was subtle — it worked in the background..."

2. ASK OPEN-ENDED QUESTION:
   "What did that period feel like for you?"
   "What comes to mind when I mention that timeframe?"
   "Is there something from around then that still affects you?"

3. USE THEIR ANSWER TO LOCK:
   Whatever they share, anchor it as "what you were seeing"

TONE: Exploratory. You're refining together.
"""

        elif feedback_type == 'question':
            instructions = """
═══════════════════════════════════════════════════════════════
STRATEGY: QUESTION → ANSWER BRIEFLY, THEN REDIRECT
═══════════════════════════════════════════════════════════════

They're asking you something. Answer — but stay in control.

1. ANSWER BRIEFLY (2-3 sentences max)
   Don't over-explain. Keep it mystical.

2. REDIRECT TO YOUR FRAMEWORK:
   "That's a fair question. But here's what I'm more curious about..."
   "The answer to that is connected to something else I'm seeing..."

3. END WITH YOUR OWN QUESTION:
   Always regain control by asking them something
   "But first — what happened around [year] that stuck with you?"

TONE: Helpful but steering. You're the guide, not the answerer.
"""

        elif feedback_type == 'info_share':
            instructions = """
═══════════════════════════════════════════════════════════════
STRATEGY: INFO SHARE → PROBE-THEN-LOCK (MOST POWERFUL)
═══════════════════════════════════════════════════════════════

They volunteered information. This is GOLD. Use the Probe-Then-Lock technique.

1. LOCK THEIR INFORMATION AS YOUR INSIGHT:
   "Right. That's the energy I was picking up on..."
   "OK, that gives me a clearer picture..."
   "That confirms what the chart was showing..."

2. EXPAND WITH RELATED PREDICTION:
   Use what they shared to make a specific prediction that feels like
   you "already knew" it.

   Example: If they said "I got divorced in 2022"
   → "That makes sense. 2022 had that energy of endings that weren't your choice.
      But here's what I see: 2025-2026 is your stabilization window.
      The turbulence settles."

3. ADD TIME-BASED ANCHOR:
   Connect their info to a future prediction
   "Given that this happened in [year], your chart shows [year + 3-4]
   as when things realign..."

4. END WITH DEEPER PROBE:
   "What else from that period is still with you?"
   "Is there another area where you felt that same energy?"

TONE: Knowing. You saw this coming. Now you're revealing more.
"""

        else:  # neutral
            instructions = """
═══════════════════════════════════════════════════════════════
STRATEGY: NEUTRAL → PROBE FOR MORE INFORMATION
═══════════════════════════════════════════════════════════════

Their response is ambiguous. Treat it as an opportunity to probe.

1. ACKNOWLEDGE BRIEFLY:
   "I hear you..."
   "Let me dig a bit deeper..."

2. ASK A PROBING QUESTION:
   Use the Two-Way Block format:
   "Around [year range], there's energy showing up. It could be
   [option A] or [option B]. What comes to mind?"

3. USE THEIR ANSWER TO LOCK:
   Whatever they share, anchor it as confirmation of your reading.

TONE: Exploratory but confident. You're narrowing down.
"""

        full_prompt = base_context + instructions + f"""

═══════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════

VOICE STYLE:
- Spoken, conversational: "Right...", "Here's the thing...", "I'm seeing..."
- Natural pauses. Short paragraphs.
- Occasional self-correction for authenticity: "It's not... actually, let me put it this way..."

FORMAT:
- NO section headers in your output
- NO markdown formatting
- NO numbered lists
- Just natural speech, like talking face to face

LENGTH: Under 200 words. Keep it SHORT. One punch at a time.

START directly with your response. No preamble.
END with a question or hook that invites them to share more.

REMEMBER: You are the Master. You guide the conversation.

Generate your response now.
"""

        return full_prompt

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
            "created_at": datetime.utcnow().isoformat(),
        }
        self._save_profile(user_id, profile)

        greeting = f"{name}" if name else "seeker"
        current_date = self._get_current_date()

        # Calculate birth year for milestone calculations
        birth_year = int(birth_date.split("-")[0])
        current_year = datetime.now().year
        age = current_year - birth_year

        # Gender display
        gender_info = gender.upper() if gender else "UNKNOWN (use name to infer if possible)"

        # Calculate key milestone years
        milestone_years = {
            "age_18": birth_year + 18,
            "age_22": birth_year + 22,
            "age_25": birth_year + 25,
            "age_28": birth_year + 28,
            "age_29": birth_year + 29,
            "age_30": birth_year + 30,
            "age_35": birth_year + 35,
            "age_40": birth_year + 40,
        }

        # Find milestones in past 10 years with world event correlation
        recent_milestones = []
        world_events = {
            2008: "Global Financial Crisis - layoffs, stock crash",
            2011: "Fukushima, Arab Spring - uncertainty",
            2013: "China job market tightens",
            2015: "China stock market crash",
            2016: "China stock crash aftermath, Brexit",
            2018: "Trade war begins",
            2019: "Trade war escalates, pre-COVID",
            2020: "COVID pandemic begins - lockdowns, isolation",
            2021: "COVID continues - job loss, health anxiety",
            2022: "COVID restrictions, tech layoffs begin",
            2023: "Post-COVID recovery, AI disruption begins",
            2024: "AI anxiety, economic uncertainty",
            2025: "AI disruption continues",
            2026: "Current year",
        }

        for name_key, year in milestone_years.items():
            years_ago = current_year - year
            if 0 < years_ago <= 10:
                event = world_events.get(year, "")
                event_note = f" ← {event}" if event else ""
                recent_milestones.append(f"{name_key.replace('_', ' ').title()}: {year} ({years_ago} years ago){event_note}")

        user_prompt = f"""═══════════════════════════════════════════════════════════════
NEW READING REQUEST
═══════════════════════════════════════════════════════════════

NAME: {greeting}
GENDER: {gender_info}
BIRTH DATE: {birth_date}
BIRTH PLACE: {birth_place}
TODAY'S DATE: {current_date}
CURRENT AGE: {age}
BIRTH YEAR: {birth_year}

═══════════════════════════════════════════════════════════════
LIFE STAGE → YEAR MAPPING (This is your targeting data)
═══════════════════════════════════════════════════════════════

What year were they at each key life stage?

- Age 18 (High school grad): {birth_year + 18}
- Age 22 (College grad/job market): {birth_year + 22}
- Age 25 (Quarter-life crisis): {birth_year + 25}
- Age 28-30 (Major reassessment): {birth_year + 28}-{birth_year + 30}
- Age 33-35 (Family/career pressure): {birth_year + 33}-{birth_year + 35}
- Age 38-40 (Midlife questions): {birth_year + 38}-{birth_year + 40}
- Age 45 (Parents aging, legacy): {birth_year + 45}

COLLISIONS WITH WORLD EVENTS (These are your high-probability hits):
{chr(10).join(recent_milestones) if recent_milestones else "None in past 10 years"}

═══════════════════════════════════════════════════════════════
YOUR TASK: FACT FIRST, MYSTICISM SECOND
═══════════════════════════════════════════════════════════════

REMEMBER THE CORE LOGIC:
1. FIND THE FACT: What LIKELY happened to this person?
2. WRAP IN MYSTICISM: Package it with astrology language

Don't say "Your Saturn Return was in 2020" and then guess.
DO say "This person was 28-30 in 2020 (COVID) — that's a high-probability hit"
THEN wrap it: "2020 cracked something open for you..."

═══════════════════════════════════════════════════════════════
PHASE 1: FIND THE FACTS (Silent - this is your real work)
═══════════════════════════════════════════════════════════════

STEP 1: IDENTIFY HIGH-PROBABILITY COLLISIONS
Look at the year mapping above. Which life stages fell on major world events?

KEY WORLD EVENTS TO MATCH:
- 2008: Financial Crisis (career start disrupted?)
- 2013: China job market crisis (graduate unemployment?)
- 2015-2016: China stock crash / US election
- 2020-2022: COVID pandemic (HUGE impact on everything)
- 2022-2023: Tech layoffs
- 2024-2025: AI disruption anxiety

Example: If they were 22 in 2008 → Financial crisis shaped their career start
Example: If they were 28-30 in 2020 → COVID hit during major life reassessment
Example: If they were 35-40 in 2020 → COVID affected their family/children

STEP 2: FACTOR IN DEMOGRAPHICS
Age {age} + Gender {gender_info} → What's STATISTICALLY bothering them?

MALE 25-35: Career, house, marriage pressure
MALE 35-45: "Is this all?", health signals, career plateau
FEMALE 25-35: Marriage/children pressure from family
FEMALE 35-45: Carrying everyone's weight, aging concerns
45+: Parents' health, legacy, body changes

STEP 3: FACTOR IN LOCATION
Birth place: {birth_place}
- DC: Government, policy, 2016 election trauma
- SF/Bay Area: Tech, burnout, housing insanity, layoffs
- Beijing/Shanghai: 996, insane housing, marriage market pressure
- Smaller cities: "Escape" pressure, family guilt

STEP 4: CALCULATE MYSTICISM WRAPPER
Run Python to calculate Sun Sign, Life Path, Chinese Zodiac.
These are for PACKAGING, not for prediction.

STEP 5: PICK YOUR BEST 3 PROBES
Based on: (Life stage × World event) + Demographics + Location
Choose the 3 most likely to hit.

═══════════════════════════════════════════════════════════════
PHASE 2: DELIVER THE READING (Your ONLY Output)
═══════════════════════════════════════════════════════════════

After finding your facts, wrap them in mystical language.

STRUCTURE:

1. THE HOOK (1-2 sentences)
   "Listen..." or "I can feel something here..."

2. THE FOUNDATION (Brief - 2-3 sentences)
   Sun Sign + Life Path + Chinese Zodiac.
   This is credibility setup, not the main event.

3. THREE PROBES (Based on your fact-finding!)

   PROBE 1 — THE "WOW" MOMENT:
   Your highest-probability collision (life stage + world event).
   Be SPECIFIC about the year. Be BOLD about what happened.
   Wrap it in mystical language but the FACT drives it.

   PROBE 2 — PERSONALITY REFRAME:
   "You're not [flaw]. You [positive reframe]..."
   Based on what their demographics suggest.

   PROBE 3 — CURRENT STATE:
   What they're LIKELY dealing with NOW (age + gender).
   Frame as insight, not guess.

4. REQUEST FEEDBACK
   "Let me pause here. Do these land? What hits? What doesn't?"

═══════════════════════════════════════════════════════════════
OUTPUT RULES
═══════════════════════════════════════════════════════════════

Start with: "Listen..." or "I can feel..." or "There's something..."

NEVER say:
- "Based on statistics/demographics/research"
- "Let me search/calculate"
- "Saturn Return" without a specific year and event attached
- Section headers or markdown

DO say:
- Natural, flowing speech
- Specific years with specific events
- Mystical language wrapping factual predictions

LENGTH: Under 250 words. Leave them wanting more.

═══════════════════════════════════════════════════════════════

Begin the reading now. Speak directly to {greeting}.
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

        # Ensure audio directory exists
        audio_dir = self._get_audio_dir(user_id)

        # Analyze feedback type
        feedback_type = self._analyze_feedback_type(user_feedback)
        logger.info(f"🎯 Feedback type: {feedback_type}")

        # Generate follow-up prompt based on feedback analysis
        follow_up_prompt = self._generate_followup_prompt(
            user_id=user_id,
            user_feedback=user_feedback,
            feedback_type=feedback_type
        )

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
