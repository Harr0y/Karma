"""Persistence and session store for Karma users."""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict


class UserSessionStore:
    """Handles user profile, conversation, files, and session logs."""

    def __init__(self, users_dir: Path):
        self.users_dir = users_dir
        self.users_dir.mkdir(exist_ok=True)

    def get_user_dir(self, user_id: str) -> Path:
        user_dir = self.users_dir / user_id
        user_dir.mkdir(exist_ok=True)
        return user_dir

    def get_files_dir(self, user_id: str) -> Path:
        files_dir = self.get_user_dir(user_id) / "files"
        files_dir.mkdir(exist_ok=True)
        return files_dir

    def get_sessions_dir(self, user_id: str) -> Path:
        sessions_dir = self.get_user_dir(user_id) / "sessions"
        sessions_dir.mkdir(exist_ok=True)
        return sessions_dir

    def get_audio_dir(self, user_id: str) -> Path:
        audio_dir = self.get_user_dir(user_id) / "audio"
        audio_dir.mkdir(exist_ok=True)
        return audio_dir

    def create_session_log(self, user_id: str) -> Path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return self.get_sessions_dir(user_id) / f"session_{timestamp}.log"

    def log_to_session(self, session_path: Path, message: str):
        with open(session_path, "a", encoding="utf-8") as f:
            f.write(message + "\n")

    def save_agent_file(self, user_id: str, file_path: str, content: str) -> Path:
        files_dir = self.get_files_dir(user_id)
        filename = Path(file_path).name
        user_file_path = files_dir / filename
        with open(user_file_path, "w", encoding="utf-8") as f:
            f.write(content)
        return user_file_path

    def save_conversation(self, user_id: str, role: str, content: str):
        conv_path = self.get_user_dir(user_id) / "conversation.jsonl"
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "role": role,
            "content": content,
        }
        with open(conv_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")

    def save_profile(self, user_id: str, profile: Dict):
        profile_path = self.get_user_dir(user_id) / "profile.json"

        existing = {}
        if profile_path.exists():
            with open(profile_path, "r", encoding="utf-8") as f:
                existing = json.load(f)

        existing.update(profile)
        existing["updated_at"] = datetime.now(timezone.utc).isoformat()

        with open(profile_path, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2)

    def load_profile(self, user_id: str) -> Dict:
        profile_path = self.get_user_dir(user_id) / "profile.json"
        if not profile_path.exists():
            return {}

        with open(profile_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def load_history(self, user_id: str, limit: int = 5) -> str:
        conv_path = self.get_user_dir(user_id) / "conversation.jsonl"
        if not conv_path.exists():
            return ""

        history = []
        with open(conv_path, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    entry = json.loads(line)
                    role = "ORACLE" if entry["role"] == "assistant" else "USER"
                    history.append(f"{role}: {entry['content']}")
                except Exception:
                    continue

        return "\n\n".join(history[-limit:])
