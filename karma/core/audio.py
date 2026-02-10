"""Audio generation service abstraction for Karma."""

from pathlib import Path
from typing import List

try:
    from karma.tts import generate_tts
except ImportError:
    from tts import generate_tts


class TTSService:
    """Thin wrapper around TTS generation with centralized logging."""

    def __init__(self, logger):
        self.logger = logger

    async def generate(self, text: str, output_dir: Path, prefix: str) -> List[Path]:
        if not text.strip():
            return []

        self.logger.info("🎙️ Generating TTS audio via MiniMax API...")
        audio_files = await generate_tts(
            text=text,
            output_dir=output_dir,
            prefix=prefix,
        )
        self.logger.info(f"🎙️ Generated {len(audio_files)} audio file(s)")
        return audio_files
