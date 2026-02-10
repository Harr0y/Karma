"""Claude SDK query runner shared by different turn types."""

import json
from pathlib import Path
from typing import Callable

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


class ClaudeTurnRunner:
    """Runs Claude queries and handles stream logging/output merging."""

    def __init__(
        self,
        logger,
        option_builder: Callable[[str], ClaudeAgentOptions],
        save_agent_file: Callable[[str, str, str], Path],
        log_to_session: Callable[[Path, str], None],
    ):
        self.logger = logger
        self.option_builder = option_builder
        self.save_agent_file = save_agent_file
        self.log_to_session = log_to_session

    def _log_assistant_block(
        self,
        session_path: Path,
        user_id: str,
        block,
        block_index: int,
    ) -> str:
        block_type = type(block).__name__
        self.logger.debug(f"   Block #{block_index}: {block_type}")
        self.log_to_session(session_path, f"    Block #{block_index}: {block_type}")

        if isinstance(block, TextBlock):
            text_preview = block.text[:200] + ("..." if len(block.text) > 200 else "")
            self.logger.info(f"✍️  TEXT: {text_preview}")
            self.log_to_session(session_path, f"      TEXT: {block.text}")
            return block.text

        if isinstance(block, ToolUseBlock):
            self.logger.info(f"🔧 TOOL CALL: {block.name}")
            self.logger.debug(f"   Input: {block.input}")
            self.log_to_session(session_path, f"      TOOL: {block.name}")
            self.log_to_session(session_path, f"      INPUT: {json.dumps(block.input, indent=2)}")

            if block.name == "Write" and "file_path" in block.input:
                file_path = block.input.get("file_path", "")
                content = block.input.get("content", "")
                if content:
                    saved_path = self.save_agent_file(user_id, file_path, content)
                    self.log_to_session(session_path, f"      SAVED TO: {saved_path}")

        return ""

    async def execute_query(
        self,
        user_id: str,
        prompt: str,
        session_path: Path,
        query_log_title: str,
        response_log_title: str,
    ) -> str:
        self.logger.info("=" * 60)
        self.logger.info(query_log_title)
        self.logger.info("=" * 60)
        self.logger.debug(f"Prompt:\n{prompt}")
        self.logger.info("=" * 60)

        options = self.option_builder(user_id)
        response_text = ""
        message_count = 0

        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)

            async for message in client.receive_response():
                message_count += 1
                msg_type = type(message).__name__
                self.logger.debug(f"📥 MESSAGE #{message_count}: {msg_type}")
                self.log_to_session(session_path, f"[{msg_type}] Message #{message_count}")

                if isinstance(message, SystemMessage):
                    self.logger.debug("   (System message)")
                    self.log_to_session(session_path, f"  [System message - {message.subtype}]")

                elif isinstance(message, AssistantMessage):
                    self.logger.debug(f"   Content blocks: {len(message.content)}")
                    self.log_to_session(session_path, f"  Content blocks: {len(message.content)}")
                    for i, block in enumerate(message.content):
                        response_text += self._log_assistant_block(session_path, user_id, block, i)

                elif isinstance(message, UserMessage):
                    self.logger.debug("   UserMessage (tool result)")
                    self.log_to_session(session_path, "  [Tool Result]")
                    if hasattr(message, "content") and message.content:
                        for block in message.content:
                            if hasattr(block, "text"):
                                result_preview = block.text[:200] + ("..." if len(block.text) > 200 else "")
                                self.log_to_session(session_path, f"    {result_preview}")

                elif isinstance(message, ResultMessage):
                    self.logger.debug("   ✅ ResultMessage - stream complete")
                    self.log_to_session(session_path, "  [Stream Complete]")
                    self.log_to_session(session_path, "")
                    break

        self.logger.info("=" * 60)
        self.logger.info(response_log_title)
        self.logger.info("=" * 60)
        self.logger.debug(f"Complete response:\n{response_text}")
        self.logger.info("=" * 60)
        return response_text
