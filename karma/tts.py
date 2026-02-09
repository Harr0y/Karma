"""
MiniMax TTS API Client - Direct API integration for voice synthesis.

Handles text-to-speech conversion using MiniMax's T2A v2 API.
Supports automatic text segmentation for long content.
"""

import os
import asyncio
import aiohttp
import logging
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from dotenv import load_dotenv

# Load environment variables
_project_root = Path(__file__).parent.parent
load_dotenv(_project_root / ".env")

logger = logging.getLogger("KARMA.TTS")


class MinimaxTTS:
    """MiniMax Text-to-Speech client using T2A v2 API."""

    # Default voice settings for mystical oracle persona
    DEFAULT_VOICE_ID = "Charming_Lady"  # 
    DEFAULT_SPEED = 0.95  # 
    DEFAULT_VOL = 1.0
    DEFAULT_PITCH = 0

    # Segmentation settings
    MAX_CHARS_PER_SEGMENT = 500  # 更长的分段，减少语音条数（约80-90秒）

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_host: Optional[str] = None,
    ):
        """Initialize the TTS client."""
        self.api_key = api_key or os.getenv("MINIMAX_API_KEY")
        self.api_host = api_host or os.getenv("MINIMAX_API_HOST", "https://api.minimax.chat")

        if not self.api_key:
            raise ValueError("MINIMAX_API_KEY is required")

        # API endpoint for T2A v2
        self.api_url = f"{self.api_host}/v1/t2a_v2"

    def _segment_text(self, text: str) -> List[str]:
        """
        Split text into segments suitable for TTS.

        Each segment should be under MAX_CHARS_PER_SEGMENT characters.
        Tries to split on sentence boundaries (。！？.!?) for natural pauses.
        """
        if len(text) <= self.MAX_CHARS_PER_SEGMENT:
            return [text]

        segments = []
        current_segment = ""

        # Split on sentence boundaries
        sentence_endings = "。！？.!?\n"

        i = 0
        while i < len(text):
            char = text[i]
            current_segment += char

            # Check if we hit a sentence boundary
            if char in sentence_endings:
                # If segment is getting long, save it
                if len(current_segment) >= self.MAX_CHARS_PER_SEGMENT * 0.7:
                    segments.append(current_segment.strip())
                    current_segment = ""

            # Force split if segment is too long
            if len(current_segment) >= self.MAX_CHARS_PER_SEGMENT:
                # Try to find last good break point
                break_points = [
                    current_segment.rfind("，"),
                    current_segment.rfind(","),
                    current_segment.rfind("、"),
                    current_segment.rfind(" "),
                ]
                break_point = max(bp for bp in break_points if bp > 0) if any(bp > 0 for bp in break_points) else -1

                if break_point > len(current_segment) * 0.5:
                    segments.append(current_segment[:break_point + 1].strip())
                    current_segment = current_segment[break_point + 1:]
                else:
                    segments.append(current_segment.strip())
                    current_segment = ""

            i += 1

        # Add remaining text
        if current_segment.strip():
            segments.append(current_segment.strip())

        return segments

    async def synthesize(
        self,
        text: str,
        output_path: Path,
        voice_id: Optional[str] = None,
        speed: Optional[float] = None,
    ) -> bool:
        """
        Synthesize speech from text and save to file.

        Args:
            text: Text to convert to speech
            output_path: Path to save the audio file
            voice_id: Voice to use (default: female-tianmei)
            speed: Speech speed multiplier (default: 1.0)

        Returns:
            True if successful, False otherwise
        """
        voice_id = voice_id or self.DEFAULT_VOICE_ID
        speed = speed or self.DEFAULT_SPEED

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": "speech-01-turbo",
            "text": text,
            "stream": False,
            "voice_setting": {
                "voice_id": voice_id,
                "speed": speed,
                "vol": self.DEFAULT_VOL,
                "pitch": self.DEFAULT_PITCH,
            },
            "audio_setting": {
                "sample_rate": 32000,
                "bitrate": 128000,
                "format": "mp3",
            },
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.api_url,
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=60),
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"TTS API error: {response.status} - {error_text}")
                        return False

                    result = await response.json()

                    # Check for API errors
                    if result.get("base_resp", {}).get("status_code", 0) != 0:
                        logger.error(f"TTS API error: {result.get('base_resp', {})}")
                        return False

                    # Get audio data (hex encoded in MiniMax T2A v2 API)
                    audio_data = result.get("data", {}).get("audio")
                    if not audio_data:
                        # Try alternate response structure
                        audio_data = result.get("audio_file")

                    if not audio_data:
                        logger.error(f"No audio data in response: {list(result.keys())}")
                        return False

                    # MiniMax returns hex-encoded audio data
                    try:
                        audio_bytes = bytes.fromhex(audio_data)
                    except ValueError:
                        # Fallback to base64 if hex decode fails
                        import base64
                        audio_bytes = base64.b64decode(audio_data)

                    # Ensure directory exists
                    output_path.parent.mkdir(parents=True, exist_ok=True)

                    with open(output_path, "wb") as f:
                        f.write(audio_bytes)

                    logger.info(f"🎙️ Saved audio: {output_path}")
                    return True

        except asyncio.TimeoutError:
            logger.error("TTS API timeout")
            return False
        except Exception as e:
            logger.error(f"TTS synthesis error: {e}")
            return False

    async def synthesize_segments(
        self,
        text: str,
        output_dir: Path,
        prefix: str = "reading",
        voice_id: Optional[str] = None,
    ) -> List[Path]:
        """
        Synthesize speech from text, automatically segmenting if needed.

        Args:
            text: Text to convert to speech
            output_dir: Directory to save audio files
            prefix: Filename prefix (default: "reading")
            voice_id: Voice to use

        Returns:
            List of paths to generated audio files
        """
        segments = self._segment_text(text)
        logger.info(f"🎙️ TTS: {len(segments)} segment(s) to synthesize")

        output_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        audio_files = []

        for i, segment in enumerate(segments):
            if not segment.strip():
                continue

            # Generate filename
            suffix = f"_{i+1:03d}" if len(segments) > 1 else ""
            filename = f"{prefix}_{timestamp}{suffix}.mp3"
            output_path = output_dir / filename

            logger.debug(f"  Segment {i+1}: {len(segment)} chars -> {filename}")

            success = await self.synthesize(
                text=segment,
                output_path=output_path,
                voice_id=voice_id,
            )

            if success:
                audio_files.append(output_path)
            else:
                logger.warning(f"  Failed to synthesize segment {i+1}")

        return audio_files


async def generate_tts(
    text: str,
    output_dir: Path,
    prefix: str = "reading",
) -> List[Path]:
    """
    Convenience function to generate TTS audio files.

    Args:
        text: Text to convert to speech
        output_dir: Directory to save audio files
        prefix: Filename prefix

    Returns:
        List of paths to generated audio files
    """
    try:
        tts = MinimaxTTS()
        return await tts.synthesize_segments(text, output_dir, prefix)
    except Exception as e:
        logger.error(f"TTS generation failed: {e}")
        return []
