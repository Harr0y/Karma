"""
Location and demographic analysis tools.
These provide contextual hints for more targeted cold readings.
"""

import re
from typing import Dict, List, Optional, Tuple


# US ZIP code regional patterns for demographic inference
# These are simplified archetypes for cold reading purposes
REGIONAL_ARCHETYPES = {
    # Northeast
    "0": {
        "region": "Northeast (New England)",
        "archetype": "traditional, values education, resistant to change",
        "economic_context": "higher cost of living, pressure to achieve",
        "family_patterns": "close family ties, obligation-heavy",
    },
    "1": {
        "region": "Northeast (Mid-Atlantic)",
        "archetype": "ambitious, fast-paced, work-focused",
        "economic_context": "competitive, high pressure",
        "family_patterns": "achievement-oriented, judgmental",
    },
    # South
    "2": {
        "region": "Mid-Atlantic (DC/MD/VA)",
        "archetype": "politically aware, transient population",
        "economic_context": "government-adjacent, stable but competitive",
        "family_patterns": "scattered due to mobility",
    },
    "3": {
        "region": "Southeast",
        "archetype": "relationship-focused, hospitable, traditional values",
        "economic_context": "lower cost, slower pace",
        "family_patterns": "extended family nearby, obligation to please",
    },
    "4": {
        "region": "South Central",
        "archetype": "practical, hardworking, religious or spiritual",
        "economic_context": "blue-collar, economic uncertainty",
        "family_patterns": "loyal but complicated dynamics",
    },
    "5": {
        "region": "South Central",
        "archetype": "resilient, community-oriented",
        "economic_context": "economic challenges, resourceful",
        "family_patterns": "relied on in difficult times",
    },
    "6": {
        "region": "Midwest",
        "archetype": "practical, reliable, understated",
        "economic_context": "middle-class decline, economic anxiety",
        "family_patterns": "stable expectations, pressure to conform",
    },
    "7": {
        "region": "Midwest/Central",
        "archetype": "grounded, straightforward, suspicious of pretense",
        "economic_context": "agricultural/industrial, fluctuating",
        "family_patterns": "hardworking, not emotionally expressive",
    },
    # West
    "8": {
        "region": "Mountain West",
        "archetype": "independent, nature-oriented, seeks freedom",
        "economic_context": "outdoor economy, transient population",
        "family_patterns": "distance from family, self-reliant",
    },
    "9": {
        "region": "West Coast",
        "archetype": "consciousness-seeking, non-traditional, open-minded",
        "economic_context": "tech/entertainment, high cost, inequality",
        "family_patterns": "chosen family, distance from origin",
    },
}


# City-specific archetypes for major metropolitan areas
CITY_ARCHETYPES = {
    # Tech hubs
    "san francisco": {
        "primary_industry": "tech",
        "vibes": ["overworked", "overpaid but broke", "transient", "searching for meaning"],
        "relationship_patterns": "dating fatigue, commitment issues, high standards",
        "career_patterns": "job hopping, impostor syndrome, burnout",
    },
    "seattle": {
        "primary_industry": "tech",
        "vibes": ["reserved", "outdoorsy", "socially awkward", "politically correct"],
        "relationship_patterns": "passive, avoidant, slow to commit",
        "career_patterns": "stable but unfulfilling, microsoft/amazon culture",
    },
    "austin": {
        "primary_industry": "tech/creative",
        "vibes": ["trying to be cool", "transplants vs locals", "rapidly changing"],
        "relationship_patterns": "keeping options open, fear of missing out",
        "career_patterns": "side hustles, startup dreams vs corporate reality",
    },
    "new york": {
        "primary_industry": "finance/media/professional",
        "vibes": ["ambitious", "tired", "never enough", "always comparing"],
        "relationship_patterns": "transactional, commitment issues, too many options",
        "career_patterns": "grind culture, never satisfied, big fish small pond anxiety",
    },
    "los angeles": {
        "primary_industry": "entertainment/creative",
        "vibes": ["image-conscious", "seeking validation", "what have you done lately"],
        "relationship_patterns": "flaky, networking disguised as connection",
        "career_patterns": "hustle, rejection, close but no cigar",
    },
    "chicago": {
        "primary_industry": "diverse corporate",
        "vibes": ["practical", "hardworking", "second-city syndrome", "real"],
        "relationship_patterns": "genuine but guarded, weather-dependent isolation",
        "career_patterns": "stable, underrated, passed over for coastal opportunities",
    },
    "washington": {
        "primary_industry": "government/politics",
        "vibes": ["climb the ladder", "who you know", "transient", "burnout"],
        "relationship_patterns": "networking dating, power couple pressure",
        "career_patterns": "meritocracy myth, it's who you know, prestige over fulfillment",
    },
    "boston": {
        "primary_industry": "education/healthcare/biotech",
        "vibes": ["intellectual", "cold exterior", "proving intelligence", "legacy pressure"],
        "relationship_patterns": "slow to warm, education-status dating",
        "career_patterns": "academic pressure, overqualified for current role",
    },
    "miami": {
        "primary_industry": "tourism/finance",
        "vibes": ["superficial", "appearance-focused", "transient", "always party"],
        "relationship_patterns": "attraction-first, substance questions",
        "career_patterns": "hustle, service industry burnout, who you know",
    },
    "denver": {
        "primary_industry": "outdoor/tech",
        "vibes": ["healthy lifestyle", "transplants", "escaping something"],
        "relationship_patterns": "activity-based, commitment-phobic",
        "career_patterns": "remote work, leaving corporate for mountains",
    },
    "atlanta": {
        "primary_industry": "corporate/entertainment",
        "vibes": ["hustle culture", "church influence", "gentrifying", "family pressure"],
        "relationship_patterns": "marriage-minded, traditional expectations",
        "career_patterns": "climbing, proving yourself, family comparisons",
    },
}


def extract_zip_code(location: str) -> Optional[str]:
    """
    Extract ZIP code from location string.

    Args:
        location: Location string that may contain ZIP code

    Returns:
        ZIP code if found, None otherwise
    """
    # Match 5-digit ZIP code
    zip_match = re.search(r'\b(\d{5})\b', location)
    if zip_match:
        return zip_match.group(1)
    return None


def extract_city_name(location: str) -> Optional[str]:
    """
    Extract city name from location string.

    Args:
        location: Location string

    Returns:
        Lowercase city name if recognized, None otherwise
    """
    location_lower = location.lower()

    # Check for known cities
    for city in CITY_ARCHETYPES.keys():
        if city in location_lower:
            return city

    # Remove ZIP code if present
    city_only = re.sub(r'\b\d{5}\b', '', location).strip()
    if city_only:
        return city_only.lower()

    return None


def get_location_archetype(location: str) -> Dict:
    """
    Get demographic and cultural archetype for a location.

    Args:
        location: ZIP code, city name, or general location

    Returns:
        Archetype information for cold reading tailoring
    """
    zip_code = extract_zip_code(location)
    city = extract_city_name(location)

    result = {
        "raw_input": location,
        "zip_code": zip_code,
        "city": city,
    }

    # ZIP code analysis
    if zip_code:
        first_digit = zip_code[0]
        if first_digit in REGIONAL_ARCHETYPES:
            result["regional_archetype"] = REGIONAL_ARCHETYPES[first_digit]

    # City-specific analysis
    if city and city in CITY_ARCHETYPES:
        result["city_archetype"] = CITY_ARCHETYPES[city]

    # Generate cold reading hooks based on location
    result["cold_reading_hooks"] = generate_location_hooks(result)

    return result


def generate_location_hooks(archetype_data: Dict) -> List[str]:
    """
    Generate location-specific cold reading statements.

    Args:
        archetype_data: Archetype information from get_location_archetype

    Returns:
        List of cold reading statements tailored to location
    """
    hooks = []

    city = archetype_data.get("city")

    # City-specific hooks
    if city and city in CITY_ARCHETYPES:
        city_data = CITY_ARCHETYPES[city]
        hooks.extend([
            f"Being in {city.title()} adds pressure - there's always someone doing 'better'.",
            city_data["relationship_patterns"],
            city_data["career_patterns"],
        ])

    # Regional hooks
    regional = archetype_data.get("regional_archetype")
    if regional:
        hooks.extend([
            f"The {regional['region']} culture you're from shaped your expectations.",
            regional["family_patterns"],
        ])

    # General location hooks (always applicable)
    hooks.extend([
        "Where you live doesn't quite feel like 'home' yet - there's displacement.",
        "You've considered moving, or have moved, seeking somewhere that fits better.",
    ])

    return hooks


def analyze_location(location: str) -> Dict:
    """
    Comprehensive location analysis for cold reading.

    Args:
        location: User's location input

    Returns:
        Complete location analysis
    """
    return {
        "location": location,
        "archetype": get_location_archetype(location),
        "interpretation": generate_location_interpretation(location),
    }


def generate_location_interpretation(location: str) -> str:
    """
    Generate a mystical-sounding location interpretation.

    Args:
        location: Location string

    Returns:
        Mystical interpretation text
    """
    city = extract_city_name(location)
    zip_code = extract_zip_code(location)

    interpretations = []

    if city:
        interpretations.append(f"The energy of {city.title()} carries themes of ambition and transience - you're meant to be passing through, not staying forever.")

    if zip_code:
        # Pseudo-calculate something mystical from the ZIP
        zip_sum = sum(int(d) for d in zip_code)
        interpretations.append(f"Your location number vibration is {zip_sum}, indicating {'stability through movement' if zip_sum % 2 == 0 else 'change through stillness'}.")

    if not interpretations:
        interpretations.append("Your birthplace carries the energy of new beginnings - you're meant to chart your own path, not follow expectations.")

    return " ".join(interpretations)


def infer_demographics(birth_date: str, birth_place: str) -> Dict:
    """
    Infer demographic information for targeted cold reading.

    This combines birth year and location to make educated guesses
    about generational cohort, economic context, etc.

    Args:
        birth_date: Date in YYYY-MM-DD format
        birth_place: Birth location

    Returns:
        Demographic inference for cold reading tailoring
    """
    import datetime

    birth = datetime.datetime.strptime(birth_date, "%Y-%m-%d")
    year = birth.year

    # Generational cohort
    if 1946 <= year <= 1964:
        cohort = "Boomer"
        cohort_themes = ["questioning authority", "seeking meaning", "disappointed children", "retirement anxiety"]
    elif 1965 <= year <= 1980:
        cohort = "Gen X"
        cohort_themes = ["latchkey independence", "skepticism", "middle generation squeeze", "xennial nostalgia"]
    elif 1981 <= year <= 1996:
        cohort = "Millennial"
        cohort_themes = ["delayed milestones", "economic setbacks", "student debt", "housing crisis impact"]
    elif 1997 <= year <= 2012:
        cohort = "Gen Z"
        cohort_themes = ["digital native", "climate anxiety", "mental health awareness", "economic uncertainty"]
    else:
        cohort = "younger generation"
        cohort_themes = ["post-pandemic formation", "rapid technological change", "uncertain future"]

    # Location archetype
    location_archetype = get_location_archetype(birth_place)

    return {
        "generational_cohort": cohort,
        "cohort_themes": cohort_themes,
        "location_archetype": location_archetype,
        "economic_context": get_economic_context(year),
    }


def get_economic_context(birth_year: int) -> Dict:
    """
    Get economic context for someone born in a given year.

    This helps frame career and financial cold readings.

    Args:
        birth_year: Year of birth

    Returns:
        Economic context information
    """
    # Entering workforce (~22 years old)
    work_force_year = birth_year + 22

    if 2008 <= work_force_year <= 2010:
        return {
            "period": "Great Recession",
            "impact": "entered workforce during crisis - delayed start, lower lifetime earnings",
            "theme": "economic anxiety, delayed milestones",
        }
    elif 2020 <= work_force_year <= 2022:
        return {
            "period": "COVID pandemic",
            "impact": "disrupted early career, remote work shifts",
            "theme": "uncertain beginning, unconventional path",
        }
    elif 1995 <= work_force_year <= 2000:
        return {
            "period": "Dot-com boom/bust",
            "impact": "early optimism, then crash - cynicism about markets",
            "theme": "boom and bust cycles learned early",
        }
    elif 2001 <= work_force_year <= 2007:
        return {
            "period": "Post-9/11 recovery",
            "impact": "cautious optimism, then 2008 crash",
            "theme": "setbacks just as things were building",
        }
    else:
        return {
            "period": "general economic cycles",
            "impact": "normal economic ups and downs",
            "theme": "external forces affecting plans",
        }
