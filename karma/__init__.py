"""
Karma - Mystical Life Pattern Analysis

A cold reading application wrapped in mystical symbolism.
Built with claude-agent-sdk.
"""

__version__ = "0.1.0"
__author__ = "Karma Project"

# Lazy imports to avoid loading SDK at import time
__all__ = ["KarmaAgent", "create_agent", "initial_reading_sync", "continue_reading_sync"]


def __getattr__(name):
    """Lazy import for agent classes."""
    if name in ("KarmaAgent", "create_agent", "initial_reading_sync", "continue_reading_sync"):
        from .agent import KarmaAgent, create_agent, initial_reading_sync, continue_reading_sync
        if name == "KarmaAgent":
            return KarmaAgent
        if name == "create_agent":
            return create_agent
        if name == "initial_reading_sync":
            return initial_reading_sync
        if name == "continue_reading_sync":
            return continue_reading_sync
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
