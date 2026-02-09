"""
Karma Calculations - Astrology, Numerology, and Chinese Metaphysics

This module provides calculation utilities that the Agent can use or reference.
The Agent can also write its own calculations using Bash/Python when needed.
"""

from datetime import datetime, date
from typing import Optional, Dict, List, Tuple
import math


# =============================================================================
# WESTERN ASTROLOGY
# =============================================================================

ZODIAC_SIGNS = [
    ("Capricorn", "♑", "The Strategist", (12, 22), (1, 19)),
    ("Aquarius", "♒", "The Visionary", (1, 20), (2, 18)),
    ("Pisces", "♓", "The Dreamer", (2, 19), (3, 20)),
    ("Aries", "♈", "The Pioneer", (3, 21), (4, 19)),
    ("Taurus", "♉", "The Builder", (4, 20), (5, 20)),
    ("Gemini", "♊", "The Communicator", (5, 21), (6, 20)),
    ("Cancer", "♋", "The Nurturer", (6, 21), (7, 22)),
    ("Leo", "♌", "The Performer", (7, 23), (8, 22)),
    ("Virgo", "♍", "The Analyst", (8, 23), (9, 22)),
    ("Libra", "♎", "The Harmonizer", (9, 23), (10, 22)),
    ("Scorpio", "♏", "The Alchemist", (10, 23), (11, 21)),
    ("Sagittarius", "♐", "The Explorer", (11, 22), (12, 21)),
]

ZODIAC_TRAITS = {
    "Aries": {
        "element": "Fire",
        "modality": "Cardinal",
        "ruler": "Mars",
        "strengths": ["courageous", "determined", "confident", "enthusiastic"],
        "shadows": ["impatient", "moody", "short-tempered", "impulsive"],
        "life_theme": "self-assertion and pioneering new paths"
    },
    "Taurus": {
        "element": "Earth",
        "modality": "Fixed",
        "ruler": "Venus",
        "strengths": ["reliable", "patient", "practical", "devoted"],
        "shadows": ["stubborn", "possessive", "uncompromising"],
        "life_theme": "building security and enjoying sensory pleasures"
    },
    "Gemini": {
        "element": "Air",
        "modality": "Mutable",
        "ruler": "Mercury",
        "strengths": ["gentle", "affectionate", "curious", "adaptable"],
        "shadows": ["nervous", "inconsistent", "indecisive"],
        "life_theme": "communication and intellectual exploration"
    },
    "Cancer": {
        "element": "Water",
        "modality": "Cardinal",
        "ruler": "Moon",
        "strengths": ["tenacious", "highly imaginative", "loyal", "emotional"],
        "shadows": ["moody", "pessimistic", "suspicious", "manipulative"],
        "life_theme": "emotional security and nurturing others"
    },
    "Leo": {
        "element": "Fire",
        "modality": "Fixed",
        "ruler": "Sun",
        "strengths": ["creative", "passionate", "generous", "warm-hearted"],
        "shadows": ["arrogant", "stubborn", "self-centered", "lazy"],
        "life_theme": "self-expression and recognition"
    },
    "Virgo": {
        "element": "Earth",
        "modality": "Mutable",
        "ruler": "Mercury",
        "strengths": ["loyal", "analytical", "kind", "hardworking"],
        "shadows": ["worry", "overly critical", "all work no play"],
        "life_theme": "service, improvement, and practical analysis"
    },
    "Libra": {
        "element": "Air",
        "modality": "Cardinal",
        "ruler": "Venus",
        "strengths": ["cooperative", "diplomatic", "gracious", "fair-minded"],
        "shadows": ["indecisive", "avoids confrontations", "self-pity"],
        "life_theme": "relationships and harmony"
    },
    "Scorpio": {
        "element": "Water",
        "modality": "Fixed",
        "ruler": "Pluto/Mars",
        "strengths": ["resourceful", "brave", "passionate", "stubborn"],
        "shadows": ["distrusting", "jealous", "secretive", "violent"],
        "life_theme": "transformation and depth"
    },
    "Sagittarius": {
        "element": "Fire",
        "modality": "Mutable",
        "ruler": "Jupiter",
        "strengths": ["generous", "idealistic", "great sense of humor"],
        "shadows": ["promises more than can deliver", "impatient", "undiplomatic"],
        "life_theme": "expansion, philosophy, and adventure"
    },
    "Capricorn": {
        "element": "Earth",
        "modality": "Cardinal",
        "ruler": "Saturn",
        "strengths": ["responsible", "disciplined", "self-control", "good managers"],
        "shadows": ["know-it-all", "unforgiving", "condescending", "expecting worst"],
        "life_theme": "achievement and worldly success"
    },
    "Aquarius": {
        "element": "Air",
        "modality": "Fixed",
        "ruler": "Uranus/Saturn",
        "strengths": ["progressive", "original", "independent", "humanitarian"],
        "shadows": ["runs from emotional expression", "temperamental", "uncompromising"],
        "life_theme": "innovation and social change"
    },
    "Pisces": {
        "element": "Water",
        "modality": "Mutable",
        "ruler": "Neptune/Jupiter",
        "strengths": ["compassionate", "artistic", "intuitive", "gentle", "wise"],
        "shadows": ["fearful", "overly trusting", "sad", "desire to escape reality"],
        "life_theme": "transcendence and spiritual connection"
    }
}


def get_sun_sign(month: int, day: int) -> Dict:
    """Calculate sun sign from birth month and day."""
    for name, symbol, archetype, start, end in ZODIAC_SIGNS:
        start_month, start_day = start
        end_month, end_day = end

        if start_month == 12:  # Special case for Capricorn
            if (month == 12 and day >= start_day) or (month == 1 and day <= end_day):
                return {
                    "name": name,
                    "symbol": symbol,
                    "archetype": archetype,
                    **ZODIAC_TRAITS.get(name, {})
                }
        else:
            if (month == start_month and day >= start_day) or (month == end_month and day <= end_day):
                return {
                    "name": name,
                    "symbol": symbol,
                    "archetype": archetype,
                    **ZODIAC_TRAITS.get(name, {})
                }

    return {"name": "Unknown", "symbol": "?", "archetype": "Unknown"}


# =============================================================================
# NUMEROLOGY - Life Path Number
# =============================================================================

LIFE_PATH_MEANINGS = {
    1: {
        "name": "The Leader",
        "traits": ["independent", "pioneering", "ambitious", "self-motivated"],
        "shadows": ["stubborn", "selfish", "aggressive"],
        "life_theme": "Learning to stand alone and lead",
        "career_hints": ["entrepreneur", "executive", "inventor", "pioneer"]
    },
    2: {
        "name": "The Diplomat",
        "traits": ["cooperative", "sensitive", "diplomatic", "patient"],
        "shadows": ["oversensitive", "indecisive", "dependent"],
        "life_theme": "Learning partnership and balance",
        "career_hints": ["counselor", "mediator", "artist", "healer"]
    },
    3: {
        "name": "The Communicator",
        "traits": ["creative", "expressive", "social", "optimistic"],
        "shadows": ["scattered", "superficial", "moody"],
        "life_theme": "Self-expression and joy",
        "career_hints": ["writer", "artist", "entertainer", "speaker"]
    },
    4: {
        "name": "The Builder",
        "traits": ["practical", "hardworking", "trustworthy", "organized"],
        "shadows": ["rigid", "stubborn", "too serious"],
        "life_theme": "Creating lasting foundations",
        "career_hints": ["engineer", "manager", "accountant", "builder"]
    },
    5: {
        "name": "The Freedom Seeker",
        "traits": ["adventurous", "versatile", "progressive", "resourceful"],
        "shadows": ["restless", "irresponsible", "inconsistent"],
        "life_theme": "Embracing change and freedom",
        "career_hints": ["traveler", "salesperson", "journalist", "promoter"]
    },
    6: {
        "name": "The Nurturer",
        "traits": ["responsible", "loving", "protective", "healing"],
        "shadows": ["self-righteous", "interfering", "worrier"],
        "life_theme": "Service to family and community",
        "career_hints": ["teacher", "nurse", "counselor", "designer"]
    },
    7: {
        "name": "The Seeker",
        "traits": ["analytical", "introspective", "spiritual", "wise"],
        "shadows": ["aloof", "secretive", "pessimistic"],
        "life_theme": "Inner wisdom and spiritual growth",
        "career_hints": ["researcher", "analyst", "philosopher", "scientist"]
    },
    8: {
        "name": "The Achiever",
        "traits": ["ambitious", "authoritative", "successful", "material"],
        "shadows": ["workaholic", "materialistic", "domineering"],
        "life_theme": "Material mastery and power",
        "career_hints": ["business owner", "banker", "lawyer", "executive"]
    },
    9: {
        "name": "The Humanitarian",
        "traits": ["compassionate", "generous", "creative", "wise"],
        "shadows": ["moody", "aloof", "scattered"],
        "life_theme": "Universal love and completion",
        "career_hints": ["artist", "healer", "teacher", "philanthropist"]
    },
    11: {
        "name": "The Illuminator (Master Number)",
        "traits": ["intuitive", "inspirational", "visionary", "idealistic"],
        "shadows": ["nervous", "impractical", "self-doubting"],
        "life_theme": "Spiritual enlightenment and inspiration",
        "career_hints": ["spiritual teacher", "inventor", "artist", "leader"]
    },
    22: {
        "name": "The Master Builder (Master Number)",
        "traits": ["visionary", "practical", "powerful", "disciplined"],
        "shadows": ["controlling", "manipulative", "ruthless"],
        "life_theme": "Building something of lasting value for humanity",
        "career_hints": ["architect", "diplomat", "leader", "entrepreneur"]
    },
    33: {
        "name": "The Master Teacher (Master Number)",
        "traits": ["nurturing", "selfless", "devoted", "healing"],
        "shadows": ["martyr complex", "codependent"],
        "life_theme": "Uplifting humanity through compassion",
        "career_hints": ["healer", "teacher", "spiritual leader", "artist"]
    }
}


def calculate_life_path(year: int, month: int, day: int) -> Dict:
    """
    Calculate Life Path Number from birth date.

    Method: Reduce each component (year, month, day) to single digit,
    then add together and reduce again.
    Master numbers (11, 22, 33) are preserved.
    """
    def reduce(n: int) -> int:
        """Reduce to single digit, preserving master numbers."""
        while n > 9 and n not in (11, 22, 33):
            n = sum(int(d) for d in str(n))
        return n

    # Reduce each component
    year_reduced = reduce(year)
    month_reduced = reduce(month)
    day_reduced = reduce(day)

    # Sum and reduce again
    total = year_reduced + month_reduced + day_reduced
    life_path = reduce(total)

    meaning = LIFE_PATH_MEANINGS.get(life_path, LIFE_PATH_MEANINGS.get(reduce(life_path), {}))

    return {
        "number": life_path,
        "calculation": f"{month}+{day}+{year} → {month_reduced}+{day_reduced}+{year_reduced} = {total} → {life_path}",
        **meaning
    }


# =============================================================================
# CHINESE ZODIAC
# =============================================================================

CHINESE_ZODIAC = [
    ("Rat", "鼠", ["quick-witted", "resourceful", "versatile"]),
    ("Ox", "牛", ["diligent", "dependable", "strong", "determined"]),
    ("Tiger", "虎", ["brave", "competitive", "confident", "unpredictable"]),
    ("Rabbit", "兔", ["gentle", "quiet", "elegant", "alert"]),
    ("Dragon", "龙", ["confident", "intelligent", "enthusiastic", "ambitious"]),
    ("Snake", "蛇", ["wise", "enigmatic", "intuitive", "elegant"]),
    ("Horse", "马", ["animated", "active", "energetic", "independent"]),
    ("Goat", "羊", ["calm", "gentle", "creative", "sympathetic"]),
    ("Monkey", "猴", ["witty", "intelligent", "curious", "playful"]),
    ("Rooster", "鸡", ["observant", "hardworking", "confident", "courageous"]),
    ("Dog", "狗", ["loyal", "honest", "amiable", "kind"]),
    ("Pig", "猪", ["compassionate", "generous", "diligent", "sincere"])
]

CHINESE_ELEMENTS = [
    ("Wood", "木", ["growth", "creativity", "flexibility"]),
    ("Fire", "火", ["passion", "enthusiasm", "transformation"]),
    ("Earth", "土", ["stability", "practicality", "nurturing"]),
    ("Metal", "金", ["precision", "discipline", "strength"]),
    ("Water", "水", ["wisdom", "intuition", "adaptability"])
]


def get_chinese_zodiac(year: int) -> Dict:
    """
    Calculate Chinese Zodiac animal and element from birth year.

    Note: This uses the solar year for simplicity. For accuracy with
    lunar calendar, the Agent should search for the exact lunar new year date.
    """
    # Animal cycle (12 years, starting from Rat at 1900)
    animal_index = (year - 1900) % 12
    animal_name, animal_chinese, animal_traits = CHINESE_ZODIAC[animal_index]

    # Element cycle (10 years, 2 years per element, starting from Metal at 1900)
    element_index = ((year - 1900) % 10) // 2
    element_name, element_chinese, element_traits = CHINESE_ELEMENTS[element_index]

    # Yin/Yang (odd years = Yin, even years = Yang)
    yin_yang = "Yang" if year % 2 == 0 else "Yin"

    return {
        "animal": animal_name,
        "animal_chinese": animal_chinese,
        "animal_traits": animal_traits,
        "element": element_name,
        "element_chinese": element_chinese,
        "element_traits": element_traits,
        "yin_yang": yin_yang,
        "full_sign": f"{element_name} {animal_name}",
        "chinese_full": f"{element_chinese}{animal_chinese}"
    }


# =============================================================================
# AGE AND LIFE STAGE CALCULATIONS
# =============================================================================

def calculate_age(birth_date: str, reference_date: str = None) -> int:
    """Calculate age from birth date string (YYYY-MM-DD)."""
    birth = datetime.strptime(birth_date, "%Y-%m-%d")
    ref = datetime.strptime(reference_date, "%Y-%m-%d") if reference_date else datetime.now()

    age = ref.year - birth.year
    if (ref.month, ref.day) < (birth.month, birth.day):
        age -= 1

    return age


def get_key_years(birth_year: int) -> Dict[str, int]:
    """
    Calculate key life milestone years.
    These are important for life event predictions.
    """
    return {
        "age_18": birth_year + 18,  # Coming of age, college entrance
        "age_22": birth_year + 22,  # College graduation
        "age_25": birth_year + 25,  # Quarter-life transition
        "age_28": birth_year + 28,  # Saturn Return begins
        "age_29": birth_year + 29,  # Saturn Return peak
        "age_30": birth_year + 30,  # Saturn Return ends, new chapter
        "age_35": birth_year + 35,  # Mid-30s evaluation
        "age_40": birth_year + 40,  # Midlife transition begins
        "age_45": birth_year + 45,  # Midlife crisis peak
        "age_50": birth_year + 50,  # Chiron Return (healing crisis)
        "age_56": birth_year + 56,  # Second Saturn Return begins
        "age_60": birth_year + 60,  # Chinese zodiac cycle complete
    }


LIFE_STAGES = {
    (0, 6): {
        "stage": "Early Childhood",
        "themes": ["attachment", "security", "basic trust"],
        "potential_issues": ["family stability", "early health"]
    },
    (7, 12): {
        "stage": "Middle Childhood",
        "themes": ["learning", "socialization", "competence"],
        "potential_issues": ["school adjustment", "peer relationships"]
    },
    (13, 17): {
        "stage": "Adolescence",
        "themes": ["identity", "independence", "belonging"],
        "potential_issues": ["academic pressure", "identity confusion", "family conflict"]
    },
    (18, 22): {
        "stage": "Emerging Adulthood",
        "themes": ["education", "career exploration", "first love"],
        "potential_issues": ["college/career decisions", "financial independence", "relationships"]
    },
    (23, 28): {
        "stage": "Young Adulthood",
        "themes": ["career establishment", "serious relationships", "independence"],
        "potential_issues": ["career uncertainty", "relationship stability", "life direction"]
    },
    (29, 35): {
        "stage": "Early Settling",
        "themes": ["Saturn Return", "life evaluation", "commitment"],
        "potential_issues": ["career plateau", "marriage/family pressure", "purpose questioning"]
    },
    (36, 42): {
        "stage": "Middle Adulthood",
        "themes": ["achievement", "generativity", "contribution"],
        "potential_issues": ["midlife questioning", "career peak/crisis", "parenting challenges"]
    },
    (43, 50): {
        "stage": "Midlife Transition",
        "themes": ["reflection", "transformation", "authenticity"],
        "potential_issues": ["health awareness", "relationship evaluation", "meaning crisis"]
    },
    (51, 60): {
        "stage": "Late Middle Age",
        "themes": ["wisdom", "legacy", "acceptance"],
        "potential_issues": ["aging parents", "children leaving", "health concerns"]
    },
    (61, 100): {
        "stage": "Later Life",
        "themes": ["reflection", "completion", "peace"],
        "potential_issues": ["health management", "purpose in retirement", "legacy"]
    }
}


def get_life_stage(age: int) -> Dict:
    """Get current life stage information based on age."""
    for (min_age, max_age), info in LIFE_STAGES.items():
        if min_age <= age <= max_age:
            return {
                "age": age,
                "age_range": f"{min_age}-{max_age}",
                **info
            }
    return {"age": age, "stage": "Unknown"}


def get_recent_milestone_years(birth_year: int, current_year: int) -> List[Dict]:
    """
    Get milestone years in the past 10 years for prediction anchoring.
    These are statistically likely to have had significant events.
    """
    milestones = []
    key_years = get_key_years(birth_year)

    for milestone_name, milestone_year in key_years.items():
        years_ago = current_year - milestone_year
        if 0 <= years_ago <= 10:
            age_at_milestone = int(milestone_name.split("_")[1])
            milestones.append({
                "year": milestone_year,
                "years_ago": years_ago,
                "milestone": milestone_name,
                "age": age_at_milestone,
                "significance": _get_milestone_significance(milestone_name)
            })

    return sorted(milestones, key=lambda x: x["year"], reverse=True)


def _get_milestone_significance(milestone: str) -> str:
    """Get the significance of a life milestone."""
    significances = {
        "age_18": "Coming of age, major life decisions, leaving home",
        "age_22": "Education completion, entering workforce, independence",
        "age_25": "Quarter-life evaluation, career/relationship pressure",
        "age_28": "Saturn Return begins - life restructuring, questioning path",
        "age_29": "Saturn Return peak - major life changes common",
        "age_30": "New life chapter, increased responsibility",
        "age_35": "Mid-30s assessment, family/career balance",
        "age_40": "Midlife transition, achievement vs fulfillment",
        "age_45": "Midlife depth, authenticity questions",
        "age_50": "Chiron Return, healing old wounds",
        "age_56": "Second Saturn Return, wisdom integration",
        "age_60": "Full zodiac cycle, new beginning",
    }
    return significances.get(milestone, "Life transition period")


# =============================================================================
# CONVENIENCE FUNCTION FOR AGENT
# =============================================================================

def full_profile(birth_date: str, birth_place: str = None, name: str = None) -> Dict:
    """
    Generate a complete metaphysical profile from birth information.

    This is a convenience function that combines all calculations.
    The Agent can use this or calculate components individually.
    """
    year, month, day = map(int, birth_date.split("-"))
    current_year = datetime.now().year
    age = calculate_age(birth_date)

    return {
        "input": {
            "birth_date": birth_date,
            "birth_place": birth_place,
            "name": name
        },
        "demographics": {
            "age": age,
            "birth_year": year,
            "current_year": current_year
        },
        "western_astrology": get_sun_sign(month, day),
        "numerology": calculate_life_path(year, month, day),
        "chinese_zodiac": get_chinese_zodiac(year),
        "life_stage": get_life_stage(age),
        "key_years": get_key_years(year),
        "recent_milestones": get_recent_milestone_years(year, current_year)
    }


# =============================================================================
# EXAMPLE USAGE (for Agent reference)
# =============================================================================

if __name__ == "__main__":
    # Example: Generate profile for someone born March 15, 1991
    profile = full_profile("1991-03-15", "Austin, TX", "Alex")

    import json
    print(json.dumps(profile, indent=2, ensure_ascii=False))
