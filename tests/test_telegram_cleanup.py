import unittest

from karma.telegram_bot import clean_reading_text, format_telegram_text


class TelegramCleanupTests(unittest.TestCase):
    def test_clean_removes_audio_markers_and_technical_lines(self):
        raw = (
            "[AUDIO_FILES: a.mp3]\n"
            "I'll begin by checking your chart.\n"
            "════════════════════\n"
            "**Listen...** this lands.\n"
        )
        cleaned = clean_reading_text(raw)
        self.assertNotIn("[AUDIO_FILES", cleaned)
        self.assertNotIn("I'll begin", cleaned)
        self.assertNotIn("════════", cleaned)
        self.assertIn("Listen...", cleaned)

    def test_format_truncates(self):
        text = "x" * 100
        out = format_telegram_text(text, limit=20)
        self.assertEqual(len(out), 20)
        self.assertTrue(out.endswith("..."))


if __name__ == "__main__":
    unittest.main()
