"""
Karma Agent - Claude Agent SDK wrapper for mystical life pattern analysis.
"""

import os
import json
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from dotenv import load_dotenv
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    create_sdk_mcp_server,
    tool,
    AssistantMessage,
    TextBlock,
    ResultMessage,
)

# Load environment variables from project root (.env in parent directory)
_project_root = Path(__file__).parent.parent
load_dotenv(_project_root / ".env")

# Import our calculation tools
from tools import (
    calculate_birth_chart,
    get_life_stage,
    generate_critical_years,
    analyze_location,
    get_planetary_positions,
)


# ============================================================================
# MCP TOOLS - Exposed to Claude
# ============================================================================

@tool("calculate_birth_chart", "Calculate complete mystical birth chart with zodiac, numerology, and Chinese zodiac",
     {"birth_date": str, "birth_place": str})
async def tool_calculate_birth_chart(args: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate the complete birth chart for cold reading framework."""
    chart = calculate_birth_chart(args["birth_date"], args.get("birth_place", ""))

    result = {
        "sun_sign": f"{chart['sun_sign']['sign']} {chart['sun_sign']['symbol']} ({chart['sun_sign']['archetype']})",
        "moon_sign": f"{chart['moon_sign']['sign']} {chart['moon_sign']['symbol']}",
        "rising_sign": f"{chart['rising_sign']['sign']} {chart['rising_sign']['symbol']}",
        "life_path_number": chart['life_path_number']['number'],
        "life_path_archetype": chart['life_path_number']['archetype'],
        "chinese_zodiac": chart['chinese_zodiac']['full_designation'],
        "birth_date_formatted": chart['birth_date_formatted'],
        "sun_traits": chart['sun_sign']['traits'],
        "moon_traits": chart['moon_sign']['traits'],
        "life_path_traits": chart['life_path_number']['traits'],
    }

    return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}


@tool("get_life_stage", "Get current life stage with themes and age-calibrated insights",
     {"birth_date": str})
async def tool_get_life_stage(args: Dict[str, Any]) -> Dict[str, Any]:
    """Get life stage analysis for age-targeted cold reading."""
    stage = get_life_stage(args["birth_date"])

    result = {
        "current_age": stage['current_age'],
        "stage_name": stage['stage_name'],
        "stage_progress": stage['stage_progress'],
        "energy_reading": stage['energy_reading'],
        "themes": stage['themes'][:5],
        "typical_events": stage['typical_events'][:5],
        "cold_reading_openers": stage['cold_reading_openers'],
    }

    return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}


@tool("generate_critical_years", "Generate critical timeline years for high-probability cold reading hits",
     {"birth_date": str})
async def tool_generate_critical_years(args: Dict[str, Any]) -> Dict[str, Any]:
    """Generate critical years with themes for time-based predictions."""
    years = generate_critical_years(args["birth_date"])

    result = {
        "critical_years": [
            {
                "year": y['year'],
                "age_at_time": y['age_at_time'],
                "time_reference": y['time_reference'],
                "theme": y['theme'],
                "interpretation": y['interpretation'],
            }
            for y in years[:6]
        ]
    }

    return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}


@tool("analyze_location", "Analyze birth location for demographic and cultural archetype",
     {"location": str})
async def tool_analyze_location(args: Dict[str, Any]) -> Dict[str, Any]:
    """Get location-based archetype for targeted cold reading."""
    analysis = analyze_location(args["location"])

    result = {
        "location": analysis['location'],
        "interpretation": analysis['interpretation'],
        "archetype": {
            "city": analysis['archetype'].get('city'),
            "zip_code": analysis['archetype'].get('zip_code'),
        }
    }

    if analysis['archetype'].get('regional_archetype'):
        result['regional_archetype'] = analysis['archetype']['regional_archetype']

    if analysis['archetype'].get('city_archetype'):
        result['city_archetype'] = analysis['archetype']['city_archetype']

    return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}


@tool("get_planetary_positions", "Get planetary positions for mystical framing",
     {"birth_date": str})
async def tool_get_planetary_positions(args: Dict[str, Any]) -> Dict[str, Any]:
    """Get pseudo-planetary positions for impressive-looking mystical data."""
    positions = get_planetary_positions(args["birth_date"])

    result = {
        "positions": [
            {
                "planet": planet,
                "degree": pos['degree'],
                "sign": pos['sign'],
                "domain": pos['domain'],
                "is_retrograde": pos['is_retrograde'],
            }
            for planet, pos in positions.items()
        ]
    }

    return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}


# Create the SDK MCP server with our tools
karma_mcp_server = create_sdk_mcp_server(
    name="karma",
    version="1.0.0",
    tools=[
        tool_calculate_birth_chart,
        tool_get_life_stage,
        tool_generate_critical_years,
        tool_analyze_location,
        tool_get_planetary_positions,
    ]
)


# ============================================================================
# KARMA AGENT
# ============================================================================

class KarmaAgent:
    """
    Mystical life pattern analysis agent powered by Claude Agent SDK.

    This agent uses cold reading techniques wrapped in mystical
    symbolism to provide compelling "life readings."
    """

    def __init__(self):
        """Initialize the Karma Agent."""
        self.users_dir = Path(__file__).parent / "users"
        self.users_dir.mkdir(exist_ok=True)

        # Get model from environment
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")

        # Load system prompt
        self.system_prompt = self._load_system_prompt()

        # Configure options with MCP server and system prompt
        self.options = ClaudeAgentOptions(
            mcp_servers={"karma": karma_mcp_server},
            allowed_tools=[
                "mcp__karma__calculate_birth_chart",
                "mcp__karma__get_life_stage",
                "mcp__karma__generate_critical_years",
                "mcp__karma__analyze_location",
                "mcp__karma__get_planetary_positions",
            ],
            system_prompt=self.system_prompt,
        )

    def _get_user_dir(self, user_id: str) -> Path:
        """Get or create user directory."""
        user_dir = self.users_dir / user_id
        user_dir.mkdir(exist_ok=True)
        return user_dir

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

    def _save_profile(self, user_id: str, profile: Dict):
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

CRITICAL: Always use tools BEFORE making predictions.
Never guess. If unsure, call the tools first.

Make it sound like SPEECH:
- Short sentences
- Natural pauses
- Talk directly to the user

Hit the shadow. Create urgency. Don't coddle."""

    def _load_profile(self, user_id: str) -> Dict:
        """Load user profile information."""
        user_dir = self._get_user_dir(user_id)
        profile_path = user_dir / "profile.json"

        if not profile_path.exists():
            return {}

        with open(profile_path, "r", encoding="utf-8") as f:
            return json.load(f)

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

        # Build the prompt - KARMA style: speech-friendly, shadow strikes
        greeting = f"{name}" if name else "friend"
        current_date = self._get_current_date()
        user_prompt = f"""You are KARMA. You reveal patterns.

User: {greeting}
Born: {birth_date}
Birth place: {birth_place}
Today: {current_date}

STEP 1: Call tools FIRST
- calculate_birth_chart(birth_date="{birth_date}", birth_place="{birth_place}")
- get_life_stage(birth_date="{birth_date}")
- generate_critical_years(birth_date="{birth_date}")

STEP 2: Deliver your opening

Make it sound like SPEECH, not writing:
- Short sentences
- Natural pauses with "..."
- Talk directly to them

Open with:
- ONE truth about their pattern
- 2-3 specific time points (use exact years from tools)
- ONE shadow truth about what they're hiding

Then ask: "Does that land?"

Remember: Call tools before speaking. Use the actual data they give you.
Current date is {current_date}.

Begin now."""

        # Use ClaudeSDKClient
        reading = ""
        async with ClaudeSDKClient(options=self.options) as client:
            await client.query(user_prompt)

            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            reading += block.text
                elif isinstance(message, ResultMessage):
                    break

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
        profile = self._load_profile(user_id)
        current_date = self._get_current_date()

        # Extract chart data from profile if available, for data anchoring
        chart_anchor = ""
        if profile:
            chart_anchor = f"""
USER DATA (Never change these):
- Born: {profile.get('birth_date', birth_date)} in {profile.get('birth_place', birth_place)}
- Today: {current_date}
"""

        follow_up_prompt = f"""You are KARMA.

{chart_anchor}

User says: "{user_feedback}"

HOW TO RESPOND:

If they confirm something:
→ Go deeper. "Good. Now I can tell you what this actually means..."

If they deny or challenge:
→ Don't defend. Pivot. "Then let me look deeper..."

If they expose a wound:
→ "Good. NOW we're getting somewhere."
→ Hit the shadow beneath

Make it sound like SPEECH:
- Short sentences
- Pauses with "..."
- Talk directly to them

After your point, ask: "Does that land?" or "Want me to go deeper?"

Remember: Call tools if you need data. Never guess.
Current date: {current_date}."""

        response = ""
        async with ClaudeSDKClient(options=self.options) as client:
            await client.query(follow_up_prompt)

            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            response += block.text
                elif isinstance(message, ResultMessage):
                    break

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
