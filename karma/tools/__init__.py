"""
Karma Tools - Mystical calculation and analysis tools
"""

from .astrology import (
    calculate_zodiac,
    calculate_life_path_number,
    calculate_chinese_zodiac,
    calculate_birth_chart,
    get_planetary_positions
)

from .timeline import (
    calculate_age,
    get_life_stage,
    generate_critical_years,
    analyze_period_energy,
    get_transit_predictions
)

from .demographics import (
    analyze_location,
    get_location_archetype,
    infer_demographics
)

__all__ = [
    # Astrology tools
    "calculate_zodiac",
    "calculate_life_path_number",
    "calculate_chinese_zodiac",
    "calculate_birth_chart",
    "get_planetary_positions",

    # Timeline tools
    "calculate_age",
    "get_life_stage",
    "generate_critical_years",
    "analyze_period_energy",
    "get_transit_predictions",

    # Demographics tools
    "analyze_location",
    "get_location_archetype",
    "infer_demographics",
]
