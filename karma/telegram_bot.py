#!/usr/bin/env python3
"""
Karma Telegram Bot - Mystical Life Pattern Analysis via Telegram

A Telegram bot interface for the Karma cold-reading system.
Users start with /start to provide birth information, then receive
personalized "life readings" wrapped in mystical symbolism.

Usage:
    python telegram_bot.py

Environment variables required in .env:
    - TELEGRAM_BOT_TOKEN: Your Telegram bot token from @BotFather
    - ANTHROPIC_AUTH_TOKEN: Anthropic API token
    - ANTHROPIC_BASE_URL: API endpoint
    - ANTHROPIC_MODEL: Model to use
"""

import os
import sys
import asyncio
import logging
from pathlib import Path
from typing import Optional, Dict, List
from pathlib import Path
import re

from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    ConversationHandler,
    filters,
)

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

try:
    from karma.agent import KarmaAgent, create_agent, ReadingResponse
except ImportError:
    from agent import KarmaAgent, create_agent, ReadingResponse

# Load environment variables from project root
_project_root = Path(__file__).parent.parent
load_dotenv(_project_root / ".env")

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Conversation states
BIRTH_DATE, BIRTH_PLACE, NAME = range(3)

# Store active sessions
user_sessions: Dict[int, Dict] = {}


def remove_audio_markers(text: str) -> str:
    """Remove [AUDIO_FILES: ...] markers from text."""
    return re.sub(r'\[AUDIO_FILES:[^\]]+\]', '', text).strip()


def clean_reading_text(text: str) -> str:
    """Clean up agent output - remove technical notes, markers, and formatting noise."""
    # Remove AUDIO_FILES markers
    text = re.sub(r'\[AUDIO_FILES:[^\]]+\]', '', text)

    # Remove Agent's internal monologue/thinking process (more comprehensive)
    text = re.sub(r'I\'ll begin.*?(?=\n\n|\n\n|\n\nListen|\n\nThe)', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'I\'ll proceed.*?(?=\n\n|\n\n|\n\nListen|\n\nThe)', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'I need to proceed.*?(?=\n\n|\n\n|\n\nListen|\n\nThe)', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'Let me work.*?(?=\n\n|\n\n|\n\nListen|\n\nThe)', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'Now I\'ll generate.*?(?=\n\n|\n\n|\n\nListen|\n\nThe)', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'Based on my investigation.*?(?=\n\n|\n\n|\n\nListen|\n\nThe)', '', text, flags=re.DOTALL | re.IGNORECASE)

    # Remove TECHNICAL NOTE sections
    text = re.sub(r'\*?\*?\[?TECHNICAL NOTE\]?\*?\*?:?.*?(?=\n\n|\Z)', '', text, flags=re.DOTALL | re.IGNORECASE)

    # Remove horizontal lines (═══ or ─── or ***)
    text = re.sub(r'[═─]{3,}', '', text)
    text = re.sub(r'\*{3,}', '', text)

    # Remove "THE READING BEGINS" / "THE READING" headers
    text = re.sub(r'\*?\*?THE READING( BEGINS)?\*?\*?', '', text, flags=re.IGNORECASE)

    # Remove markdown bold markers
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)

    # Clean up excessive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Clean up leading/trailing whitespace
    text = text.strip()

    return text


async def send_voice_messages(update, audio_files: List[Path]):
    """Send multiple voice messages in sequence."""
    for i, audio_path in enumerate(audio_files):
        try:
            # Send voice action
            await update.message.chat.send_action("record_voice")

            # Small delay between messages for natural pacing
            if i > 0:
                await asyncio.sleep(0.5)

            # Send as voice message (shows waveform in Telegram)
            with open(audio_path, 'rb') as audio_file:
                caption = f"Part {i+1}/{len(audio_files)}" if len(audio_files) > 1 else None
                await update.message.reply_voice(
                    voice=audio_file,
                    caption=caption
                )

        except Exception as e:
            logger.error(f"Failed to send voice {audio_path}: {e}")
            # Fallback: try as audio file
            try:
                with open(audio_path, 'rb') as audio_file:
                    await update.message.reply_audio(audio=audio_file)
            except Exception as e2:
                logger.error(f"Failed to send audio fallback: {e2}")


def validate_date(date_str: str) -> bool:
    """Validate date string format and basic sanity."""
    try:
        from datetime import datetime
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        if date_obj.year < 1900 or date_obj.year > datetime.now().year:
            return False
        return True
    except ValueError:
        return False


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Start the conversation and collect user information.

    This is the entry point for new users. It guides them through
    providing their birth date, birth place, and optional name.
    """
    user_id = update.effective_user.id

    # Check if user already has a session
    if user_id in user_sessions:
        session = user_sessions[user_id]
        if session.get("birth_date") and session.get("birth_place"):
            await update.message.reply_text(
                f"✦ Welcome back, {session.get('name', 'seeker')}. ✦\n\n"
                "Your patterns are already recorded.\n"
                "Share what's on your mind, and I'll read what's hidden."
            )
            return ConversationHandler.END

    await update.message.reply_text(
        "                    ◈\n"
        "           ✧  ·  ˚  ✦  ˚  ·  ✧\n"
        "      ─────────────────────────────\n\n"
        "              𝕶 𝕬 𝕽 𝕸 𝕬\n"
        "           ᴛʜᴇ ᴘᴀᴛᴛᴇʀɴ ʀᴇᴀᴅᴇʀ\n\n"
        "      ─────────────────────────────\n"
        "           ✧  ·  ˚  ✦  ˚  ·  ✧\n\n"
        "  ❝ What you call coincidence,\n"
        "         I call destiny writing its first draft. ❞\n\n"
        "  I see what you hide from yourself.\n"
        "  The desires you've never spoken.\n"
        "  The 3 AM thoughts that keep you awake.\n\n"
        "  Are you ready?\n\n"
        "      ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n\n"
        "  📅  Enter your birth date\n"
        "       Format: YYYY-MM-DD\n"
        "       Example: 1991-03-15"
    )

    return BIRTH_DATE


async def get_birth_date(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle birth date input."""
    date_str = update.message.text.strip()

    if not validate_date(date_str):
        await update.message.reply_text(
            "  ⚠️  The format seems off.\n\n"
            "  Please use YYYY-MM-DD\n"
            "  Example: 1991-03-15"
        )
        return BIRTH_DATE

    user_id = update.effective_user.id
    if user_id not in user_sessions:
        user_sessions[user_id] = {}
    user_sessions[user_id]["birth_date"] = date_str

    await update.message.reply_text(
        f"  ✧ {date_str} ✧\n\n"
        "  The stars were aligned in a particular way\n"
        "  on that day...\n\n"
        "      ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n\n"
        "  📍  Where did you enter this world?\n\n"
        "       City, State or ZIP code\n"
        "       Example: Austin, TX"
    )

    return BIRTH_PLACE


async def get_birth_place(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle birth place input."""
    birth_place = update.message.text.strip()

    if not birth_place:
        await update.message.reply_text(
            "  ⚠️  I need a location to read your patterns.\n\n"
            "  City, State or ZIP code:"
        )
        return BIRTH_PLACE

    user_id = update.effective_user.id
    user_sessions[user_id]["birth_place"] = birth_place

    await update.message.reply_text(
        f"  ✧ {birth_place} ✧\n\n"
        "  The land remembers everyone\n"
        "  who was born upon it...\n\n"
        "      ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n\n"
        "  ✨  One last thing — your name.\n\n"
        "       Or type /skip if you prefer\n"
        "       to remain anonymous."
    )

    return NAME


async def get_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle optional name input."""
    name = update.message.text.strip()

    user_id = update.effective_user.id
    user_sessions[user_id]["name"] = name if name else None

    await send_initial_reading(update, context)

    return ConversationHandler.END


async def skip_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Skip the optional name step."""
    user_id = update.effective_user.id
    user_sessions[user_id]["name"] = None

    await send_initial_reading(update, context)

    return ConversationHandler.END


async def send_initial_reading(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Generate and send the initial reading with voice messages.

    This is the core function that uses the KarmaAgent to generate
    a personalized reading based on the user's birth information.
    """
    user_id = update.effective_user.id
    session = user_sessions[user_id]

    # Send typing action for better UX
    await update.message.chat.send_action("typing")

    # Send a waiting message
    waiting_msg = await update.message.reply_text(
        "  ◈ ─────────────────────── ◈\n\n"
        "     Channeling the patterns...\n\n"
        "  ◈ ─────────────────────── ◈"
    )

    try:
        agent = create_agent()
        response = await agent.initial_reading(
            birth_date=session["birth_date"],
            birth_place=session["birth_place"],
            name=session.get("name"),
        )

        # Delete waiting message
        await waiting_msg.delete()

        # Send text response (clean audio markers and technical notes)
        clean_text = clean_reading_text(response.text)
        if clean_text:
            # Telegram message length limit is 4096 characters
            MAX_TEXT_LENGTH = 4000  # Leave some buffer
            if len(clean_text) > MAX_TEXT_LENGTH:
                # Truncate with ellipsis
                clean_text = clean_text[:MAX_TEXT_LENGTH-3] + "..."
            await update.message.reply_text(
                f"{clean_text}",
                parse_mode="Markdown"
            )

        # Send voice messages in order
        if response.audio_files:
            await send_voice_messages(update, response.audio_files)

    except Exception as e:
        logger.error(f"Error generating reading: {e}")
        await waiting_msg.delete()
        await update.message.reply_text(
            "⚠️ The patterns are unclear right now. Please try again in a moment."
        )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle follow-up messages from users with voice output.

    After the initial reading, users can continue the conversation
    by sharing feedback or asking questions.
    """
    user_id = update.effective_user.id
    user_input = update.message.text.strip()

    # Check if user has a session
    if user_id not in user_sessions:
        await update.message.reply_text(
            "✦ I don't have your patterns yet.\n\n"
            "Start with /begin to reveal what's hidden."
        )
        return

    session = user_sessions[user_id]
    if not session.get("birth_date") or not session.get("birth_place"):
        await update.message.reply_text(
            "✦ Your patterns are incomplete.\n\n"
            "Start with /begin to reveal what's hidden."
        )
        return

    # Send typing action
    await update.message.chat.send_action("typing")

    # Handle exit commands
    if user_input.lower() in ("quit", "exit", "end", "bye", "goodbye"):
        await update.message.reply_text(
            "✦ The patterns have been revealed.\n"
            "What you do with them is up to you. ✦\n\n"
            "Farewell, seeker."
        )
        # Optionally keep the session for later
        return

    try:
        agent = create_agent()
        response = await agent.continue_reading(
            birth_date=session["birth_date"],
            birth_place=session["birth_place"],
            user_feedback=user_input,
        )

        # Send text response (clean audio markers and technical notes)
        clean_text = clean_reading_text(response.text)
        if clean_text:
            # Telegram message length limit is 4096 characters
            MAX_TEXT_LENGTH = 4000  # Leave some buffer
            if len(clean_text) > MAX_TEXT_LENGTH:
                clean_text = clean_text[:MAX_TEXT_LENGTH-3] + "..."
            await update.message.reply_text(f"✦\n\n{clean_text}\n\n✦")

        # Send voice messages in order
        if response.audio_files:
            await send_voice_messages(update, response.audio_files)

    except Exception as e:
        logger.error(f"Error in follow-up: {e}")
        await update.message.reply_text(
            "⚠️ The patterns are obscured. Please try again."
        )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show help message."""
    help_text = (
        "✦ KARMA - Pattern Reading ✦\n\n"
        "Commands:\n"
        "/begin - Start a new reading or restart your session\n"
        "/clear - Clear your saved patterns\n"
        "/help - Show this help message\n\n"
        "After providing your birth information, simply type your "
        "questions or share what's on your mind."
    )
    await update.message.reply_text(help_text)


async def begin_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start or restart a reading session."""
    user_id = update.effective_user.id

    await update.message.reply_text(
        "✦ Let us begin anew...\n\n"
        "I'll need your birth information once more.\n\n"
        "📅 Your birth date (YYYY-MM-DD):"
    )

    # Clear existing session
    if user_id in user_sessions:
        del user_sessions[user_id]

    return BIRTH_DATE


async def clear_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Clear user session."""
    user_id = update.effective_user.id

    if user_id in user_sessions:
        del user_sessions[user_id]
        await update.message.reply_text(
            "✦ Your patterns have been cleared.\n\n"
            "Use /begin to start anew."
        )
    else:
        await update.message.reply_text(
            "✦ No patterns found to clear.\n\n"
            "Use /begin to start your journey."
        )


async def cancel_conversation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel the current conversation."""
    await update.message.reply_text(
        "✦ The reading has been paused.\n\n"
        "Use /begin when you're ready to continue."
    )
    return ConversationHandler.END


def main():
    """Start the bot."""
    # Get bot token from environment
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.error(
            "TELEGRAM_BOT_TOKEN not found in environment variables.\n"
            "Please add it to your .env file.\n"
            "Get a token from @BotFather on Telegram."
        )
        sys.exit(1)

    # Create application
    application = Application.builder().token(token).build()

    # Add conversation handler for initial setup
    conversation_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start_command)],
        states={
            BIRTH_DATE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_birth_date)],
            BIRTH_PLACE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_birth_place)],
            NAME: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, get_name),
                CommandHandler("skip", skip_name),
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel_conversation)],
    )

    application.add_handler(conversation_handler)

    # Add other command handlers
    application.add_handler(CommandHandler("begin", begin_command))
    application.add_handler(CommandHandler("clear", clear_command))
    application.add_handler(CommandHandler("help", help_command))

    # Add message handler for follow-up conversations
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    # Start the bot
    logger.info("✦ KARMA Telegram Bot is starting...")
    logger.info("✦ Polling for messages...")

    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
