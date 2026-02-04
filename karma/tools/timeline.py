"""
Timeline and life stage analysis tools.
These provide the temporal framework for cold readings.
"""

import datetime
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class LifeStage:
    """Life stage with associated cold reading themes"""
    name: str
    age_range: Tuple[int, int]
    themes: List[str]
    typical_events: List[str]
    energy_reading: str


# Life stage definitions with cold reading templates
LIFE_STAGES = {
    "early_adult": LifeStage(
        name="Early Adulthood",
        age_range=(18, 27),
        themes=[
            "identity formation",
            "first serious relationship",
            "career direction uncertainty",
            "leaving family home",
            "finding your place in the world"
        ],
        typical_events=[
            "first significant job",
            "first heartbreak or serious relationship",
            "relocation",
            "educational decisions",
            "questioning chosen path"
        ],
        energy_reading="exploration, confusion, first major life decisions"
    ),
    "saturn_return": LifeStage(
        name="Saturn Return",
        age_range=(28, 32),
        themes=[
            "career reassessment",
            "relationship commitment decisions",
            "first major identity crisis",
            "pressure to 'have it figured out'",
            "shedding inauthentic paths"
        ],
        typical_events=[
            "career change or advancement",
            "marriage or significant relationship milestone",
            "home purchase",
            "questioning life direction",
            "letting go of old patterns"
        ],
        energy_reading="pressure, transformation, maturation"
    ),
    "mid_building": LifeStage(
        name="Building Phase",
        age_range=(33, 42),
        themes=[
            "career establishment",
            "family building",
            "financial pressures",
            "work-life balance struggles",
            "ambition vs. fulfillment"
        ],
        typical_events=[
            "career plateau or advancement",
            "parenthood or deciding against it",
            "relationship evolution or ending",
            "increased responsibility",
            "questioning 'is this it?'"
        ],
        energy_reading="responsibility, ambition, some stagnation"
    ),
    "mid_transition": LifeStage(
        name="Midlife Transition",
        age_range=(43, 52),
        themes=[
            "meaning crisis",
            "career plateau or change",
            "relationship reevaluation",
            "aging parents",
            "mortality awareness"
        ],
        typical_events=[
            "major career shift",
            "divorce or marriage renewal",
            "empty nest",
            "health wake-up call",
            "rediscovering lost dreams"
        ],
        energy_reading="transition, questioning, liberation"
    ),
    "mastery": LifeStage(
        name="Mastery Phase",
        age_range=(53, 65),
        themes=[
            "mentoring others",
            "legacy considerations",
            "second act career",
            "relationship quality over quantity",
            "authenticity over achievement"
        ],
        typical_events=[
            "retirement planning",
            "grandparenthood",
            "career simplification or pivot",
            "relationship deepening",
            "letting go of ambition"
        ],
        energy_reading="wisdom, release, authenticity"
    ),
    "wisdom": LifeStage(
        name="Wisdom Years",
        age_range=(66, 100),
        themes=[
            "reflection",
            "simplification",
            "legacy",
            "acceptance",
            "peace"
        ],
        typical_events=[
            "retirement",
            "loss of contemporaries",
            "health management",
            "life review",
            "transmitting wisdom"
        ],
        energy_reading="reflection, acceptance, completion"
    ),
}


def calculate_age(birth_date: str) -> int:
    """
    Calculate current age from birth date.

    Args:
        birth_date: Date in YYYY-MM-DD format

    Returns:
        Current age
    """
    birth = datetime.datetime.strptime(birth_date, "%Y-%m-%d")
    today = datetime.datetime.now()
    age = today.year - birth.year

    # Adjust if birthday hasn't occurred yet this year
    if (today.month, today.day) < (birth.month, birth.day):
        age -= 1

    return age


def get_life_stage(birth_date: str) -> Dict:
    """
    Determine current life stage and associated themes.

    Args:
        birth_date: Date in YYYY-MM-DD format

    Returns:
        Life stage information with cold reading hooks
    """
    age = calculate_age(birth_date)

    # Determine life stage
    current_stage = None
    for stage_key, stage in LIFE_STAGES.items():
        if stage.age_range[0] <= age <= stage.age_range[1]:
            current_stage = stage
            break

    if current_stage is None:
        if age < 18:
            current_stage = LIFE_STAGES["early_adult"]  # Default for young users
        else:
            current_stage = LIFE_STAGES["wisdom"]  # Default for older users

    # Calculate years into current stage
    years_into_stage = age - current_stage.age_range[0]
    stage_progress = years_into_stage / (current_stage.age_range[1] - current_stage.age_range[0])

    return {
        "current_age": age,
        "stage_name": current_stage.name,
        "stage_key": stage_key if current_stage else "unknown",
        "years_into_stage": years_into_stage,
        "stage_progress": round(stage_progress * 100),
        "themes": current_stage.themes,
        "typical_events": current_stage.typical_events,
        "energy_reading": current_stage.energy_reading,
        "cold_reading_openers": generate_stage_specific_openers(age, current_stage),
    }


def generate_stage_specific_openers(age: int, stage: LifeStage) -> List[str]:
    """
    Generate age-appropriate cold reading openers.

    Args:
        age: Current age
        stage: LifeStage object

    Returns:
        List of cold reading statements tailored to this age
    """
    openers = []

    if 18 <= age <= 27:
        openers.extend([
            f"At {age}, you're probably still figuring out what you really want - not what others expect.",
            "This is a confusing time. You've probably changed directions more than once.",
            "Relationships in this period have been intense but also unstable.",
        ])
    elif 28 <= age <= 32:
        openers.extend([
            f"Your late 20s brought a crisis of direction - what you thought you wanted no longer fits.",
            "The pressure to have things 'figured out' has been intense.",
            "You shed parts of your old life that no longer felt authentic.",
        ])
    elif 33 <= age <= 42:
        openers.extend([
            "You've built something real, but you wonder if it's what you actually wanted.",
            "Responsibility has accumulated - sometimes it feels like too much.",
            "The question 'is this all there is?' has crossed your mind.",
        ])
    elif 43 <= age <= 52:
        openers.extend([
            "You're aware that time isn't infinite anymore. This changes how you make decisions.",
            "Paths that once felt right now feel constraining.",
            "You're being called to live more authentically, even if it means change.",
        ])
    elif age >= 53:
        openers.extend([
            "Achievement matters less now. You're interested in meaning.",
            "You've done what was expected. Now it's time for what you actually want.",
            "Letting go of old ambitions is both freeing and strange.",
        ])

    return openers


def generate_critical_years(birth_date: str, count: int = 6) -> List[Dict]:
    """
    Generate critical years for cold reading predictions.

    These years are chosen using multiple systems to create
    high-probability "hits" through coverage.

    Args:
        birth_date: Date in YYYY-MM-DD format
        count: Number of critical years to generate

    Returns:
        List of critical years with interpretations
    """
    birth = datetime.datetime.strptime(birth_date, "%Y-%m-%d")
    current_year = datetime.datetime.now().year
    age = calculate_age(birth_date)

    critical_years = []

    # Method 1: Saturn return ages (29-30, 58-59)
    saturn_return_1 = birth.year + 29
    saturn_return_2 = birth.year + 58

    # Method 2: Nodal cycle (every 18.6 years, roughly 19)
    nodal_1 = birth.year + 19
    nodal_2 = birth.year + 38
    nodal_3 = birth.year + 57

    # Method 3: Jupiter returns (every 12 years)
    jupiter_returns = [birth.year + i * 12 for i in range(1, 7)]

    # Method 4: Personal year cycles (numerology)
    personal_year_critical = []
    for offset in range(1, min(age, 50)):
        test_year = birth.year + offset
        # Personal year number
        year_sum = sum(int(d) for d in str(test_year))
        birth_sum = sum(int(d) for d in birth.strftime("%Y%m%d"))
        personal_year = (year_sum + birth_sum) % 9 or 9
        # Personal years 1 and 9 are transition points
        if personal_year in (1, 9):
            personal_year_critical.append(test_year)

    # Method 5: Chinese zodiac year (your sign returns every 12 years - ben ming nian)
    # In Chinese astrology, your zodiac year is considered challenging
    chinese_zodiac_year = birth.year
    while chinese_zodiac_year < current_year:
        chinese_zodiac_year += 12

    # Method 6: Recent universal years (Covid years, etc.)
    universal_critical = [2020, 2021, 2022, 2023, 2024]

    # Compile all critical years
    all_critical = set()
    all_critical.update([saturn_return_1, saturn_return_2])
    all_critical.update([nodal_1, nodal_2, nodal_3])
    all_critical.update(jupiter_returns)
    all_critical.update(personal_year_critical[:10])
    all_critical.update(universal_critical)

    # Filter to past years only and sort
    past_critical = [y for y in all_critical if birth.year < y < current_year]
    past_critical.sort(reverse=True)

    # Take the most recent ones
    selected_years = past_critical[:count]

    # Generate interpretations for each year
    year_types = {
        saturn_return_1: "identity crisis, career questioning",
        saturn_return_2: "major life reassessment, health wake-up",
        nodal_1: "relationship changes, emotional awakening",
        nodal_2: "power dynamics, career transformation",
        nodal_3: "wisdom through loss, spiritual opening",
    }

    for year in selected_years:
        years_ago = current_year - year
        age_at_time = year - birth.year

        # Determine theme
        if year in year_types:
            theme = year_types[year]
        elif year in [2020, 2021, 2022]:
            theme = "disruption, plans cancelled, isolation"
        elif year in [2023, 2024]:
            theme = "gradual recovery, rebuilding, uncertainty"
        elif year in jupiter_returns:
            theme = "expansion followed by contraction, overextension"
        elif year in personal_year_critical:
            theme = "transition, endings and beginnings"
        else:
            theme = "significant change, course correction"

        # Age-based theme refinement
        if age_at_time < 22:
            age_theme = "educational decisions, first jobs, family expectations"
        elif age_at_time < 28:
            age_theme = "relationship intensity, career exploration"
        elif age_at_time < 35:
            age_theme = "commitment decisions, career establishment"
        elif age_at_time < 45:
            age_theme = "achievement pressure, relationship evolution"
        else:
            age_theme = "meaning questions, life restructuring"

        critical_years.append({
            "year": year,
            "years_ago": years_ago,
            "age_at_time": age_at_time,
            "theme": theme,
            "age_theme": age_theme,
            "time_reference": f"{year}-{year+2}" if years_ago > 3 else str(year),
            "interpretation": f"{'Around' if years_ago > 3 else 'In'} {year} (when you were {age_at_time}), there were shifts related to {theme}."
        })

    return critical_years


def analyze_period_energy(birth_date: str, start_year: int, end_year: int) -> Dict:
    """
    Analyze the energetic quality of a specific time period.

    This provides interpretive material for cold reading.

    Args:
        birth_date: Date in YYYY-MM-DD format
        start_year: Start of period
        end_year: End of period

    Returns:
        Period analysis with themes and suggestions
    """
    birth = datetime.datetime.strptime(birth_date, "%Y-%m-%d")
    age_at_start = start_year - birth.year
    age_at_end = end_year - birth.year

    # Determine if this was a challenging period
    period_keywords = []

    # Universal themes
    if 2020 <= end_year <= 2022:
        period_keywords.extend(["disruption", "uncertainty", "plans changed", "isolation"])
    if 2023 <= end_year <= 2024:
        period_keywords.extend(["rebuilding", "caution", "gradual progress"])

    # Life stage themes
    if 22 <= age_at_end <= 27:
        period_keywords.extend(["exploration", "confusion", "first major decisions"])
    elif 28 <= age_at_end <= 32:
        period_keywords.extend(["pressure", "transformation", "shedding old self"])
    elif 33 <= age_at_end <= 42:
        period_keywords.extend(["building", "responsibility", "some stagnation"])
    elif 43 <= age_at_end <= 52:
        period_keywords.extend(["reevaluation", "transition", "authenticity pull"])

    return {
        "period": f"{start_year}-{end_year}",
        "age_range": f"{age_at_start}-{age_at_end}",
        "keywords": period_keywords,
        "suggested_reading": f"This period involved themes of {', '.join(period_keywords[:3])}.",
    }


def get_transit_predictions(birth_date: str, looking_ahead_years: int = 2) -> List[Dict]:
    """
    Generate forward-looking predictions based on "transits".

    These are intentionally vague but framed astrologically.

    Args:
        birth_date: Date in YYYY-MM-DD format
        looking_ahead_years: How many years to predict

    Returns:
        List of upcoming transits with interpretations
    """
    current_year = datetime.datetime.now().year
    birth = datetime.datetime.strptime(birth_date, "%Y-%m-%d")
    age = calculate_age(birth_date)

    predictions = []

    for offset in range(1, looking_ahead_years + 1):
        year = current_year + offset
        age_then = age + offset

        # Generate a prediction based on age and year
        if 28 <= age_then <= 32 or 58 <= age_then <= 62:
            theme = "Saturn return - major life restructuring"
            advice = "let go of what no longer serves you"
        elif age_then % 12 == 0:
            theme = "Jupiter return - expansion and opportunity"
            advice = "say yes to new opportunities, but avoid overextension"
        elif year % 4 == 0:
            theme = "Election year - collective uncertainty, personal clarity needed"
            advice = "focus on what you can control"
        else:
            theme = "gradual progress, internal processing"
            advice = "trust your timing, even when it feels slow"

        predictions.append({
            "year": year,
            "age": age_then,
            "theme": theme,
            "advice": advice,
            "energy": "transformative" if "restructuring" in theme.lower() else "expansive" if "expansion" in theme.lower() else "steady"
        })

    return predictions
