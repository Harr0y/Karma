"""
Astrology and mystical calculation tools.
These tools provide the "cosmic framework" for cold readings.
"""

import datetime
from typing import Dict, List, Tuple, Optional
from enum import Enum


class Zodiac(Enum):
    """Western zodiac signs with mystical attributes"""
    ARIES = ("Aries", "♈", "The Warrior", "Fire", "Bold, pioneering, impulsive")
    TAURUS = ("Taurus", "♉", "The Builder", "Earth", "Steadfast, sensual, stubborn")
    GEMINI = ("Gemini", "♊", "The Messenger", "Air", "Curious, adaptable, scattered")
    CANCER = ("Cancer", "♋", "The Nurturer", "Water", "Deep feeling, protective, moody")
    LEO = ("Leo", "♌", "The King", "Fire", "Creative, proud, demanding")
    VIRGO = ("Virgo", "♍", "The Analyst", "Earth", "Detail-oriented, service-oriented, critical")
    LIBRA = ("Libra", "♎", "The Diplomat", "Air", "Harmony-seeking, indecisive, charming")
    SCORPIO = ("Scorpio", "♏", "The Alchemist", "Water", "Intense, transformative, secretive")
    SAGITTARIUS = ("Sagittarius", "♐", "The Explorer", "Fire", "Adventurous, philosophical, blunt")
    CAPRICORN = ("Capricorn", "♑", "The Strategist", "Earth", "Ambitious, disciplined, reserved")
    AQUARIUS = ("Aquarius", "♒", "The Visionary", "Air", "Innovative, detached, unpredictable")
    PISCES = ("Pisces", "♓", "The Dreamer", "Water", "Intuitive, compassionate, escapist")


class LifePathNumber(Enum):
    """Numerology life path numbers with cold reading templates"""
    ONE = ("1", "The Leader", "independent, ambitious, struggles with authority")
    TWO = ("2", "The Peacemaker", "cooperative, sensitive, puts others first")
    THREE = ("3", "The Creator", "expressive, creative, avoids confrontation")
    FOUR = ("4", "The Builder", "practical, hardworking, resistant to change")
    FIVE = ("5", "The Freedom Seeker", "adventurous, restless, fears commitment")
    SIX = ("6", "The Nurturer", "responsible, family-oriented, self-sacrificing")
    SEVEN = ("7", "The Seeker", "analytical, spiritual, often misunderstood")
    EIGHT = ("8", "The Power House", "material success focused, workaholic tendencies")
    NINE = ("9", "The Humanitarian", "idealistic, giving, difficulty letting go")


class ChineseZodiac(Enum):
    """Chinese zodiac with generational timing implications"""
    RAT = ("Rat", "opportunistic, clever, anxiety about resources")
    OX = ("Ox", "reliable, stubborn, bears burdens quietly")
    TIGER = ("Tiger", "bold, unpredictable, dramatic life events")
    RABBIT = ("Rabbit", "gentle, diplomatic, avoids direct conflict")
    DRAGON = ("Dragon", "charismatic, high expectations, prone to disappointment")
    SNAKE = ("Snake", "wise, secretive, trusts few people")
    HORSE = ("Horse", "free-spirited, movement-oriented, restless")
    GOAT = ("Goat", "creative, anxious, needs support systems")
    MONKEY = ("Monkey", "clever, mischievous, unconventional path")
    ROOSTER = ("Rooster", "proud, observant, critical of self and others")
    DOG = ("Dog", "loyal, anxious, justice-oriented, trusts wrong people")
    PIG = ("Pig", "generous, indulgent, taken advantage of")


def calculate_zodiac(birth_date: str) -> Dict:
    """
    Calculate Western zodiac sign from birth date.

    Args:
        birth_date: Date in YYYY-MM-DD format

    Returns:
        Dict with zodiac information and cold reading hooks
    """
    date_obj = datetime.datetime.strptime(birth_date, "%Y-%m-%d")
    month, day = date_obj.month, date_obj.day

    # Zodiac date boundaries
    if (month == 3 and day >= 21) or (month == 4 and day <= 19):
        sign = Zodiac.ARIES
    elif (month == 4 and day >= 20) or (month == 5 and day <= 20):
        sign = Zodiac.TAURUS
    elif (month == 5 and day >= 21) or (month == 6 and day <= 20):
        sign = Zodiac.GEMINI
    elif (month == 6 and day >= 21) or (month == 7 and day <= 22):
        sign = Zodiac.CANCER
    elif (month == 7 and day >= 23) or (month == 8 and day <= 22):
        sign = Zodiac.LEO
    elif (month == 8 and day >= 23) or (month == 9 and day <= 22):
        sign = Zodiac.VIRGO
    elif (month == 9 and day >= 23) or (month == 10 and day <= 22):
        sign = Zodiac.LIBRA
    elif (month == 10 and day >= 23) or (month == 11 and day <= 21):
        sign = Zodiac.SCORPIO
    elif (month == 11 and day >= 22) or (month == 12 and day <= 21):
        sign = Zodiac.SAGITTARIUS
    elif (month == 12 and day >= 22) or (month == 1 and day <= 19):
        sign = Zodiac.CAPRICORN
    elif (month == 1 and day >= 20) or (month == 2 and day <= 18):
        sign = Zodiac.AQUARIUS
    else:
        sign = Zodiac.PISCES

    name, symbol, archetype, element, traits = sign.value

    # Cold reading templates per sign
    cold_reading_hooks = {
        Zodiac.ARIES: [
            "You often feel like you're fighting battles alone - others don't see the effort you put in.",
            "Your biggest opportunities have tended to come with unexpected complications.",
            "You've had to learn patience the hard way - things haven't unfolded on your timeline.",
        ],
        Zodiac.TAURUS: [
            "You value stability but life has forced you to adapt more than you'd like.",
            "Financial matters have been a recurring source of stress or reconsideration.",
            "You're often the one others rely on, but who supports you?",
        ],
        Zodiac.GEMINI: [
            "You have many different sides - some people only see one version of you.",
            "Communication has been both your strength and a source of misunderstanding.",
            "You feel pulled in different directions, never fully able to commit to just one path.",
        ],
        Zodiac.CANCER: [
            "You feel things deeply but often keep it inside - others don't realize how much you carry.",
            "Home and family situations have undergone significant changes that affected you profoundly.",
            "You give emotional support freely but don't always receive it in return.",
        ],
        Zodiac.LEO: [
            "You're meant to shine but often feel unrecognized or underappreciated.",
            "Creative expression is important to you but you've had to compromise.",
            "Pride has sometimes kept you from asking for help when you needed it.",
        ],
        Zodiac.VIRGO: [
            "You're often harder on yourself than anyone else would be.",
            "Details that matter to you get overlooked by others, frustrating you.",
            "Service to others has been a theme, sometimes at your own expense.",
        ],
        Zodiac.LIBRA: [
            "You seek harmony but often find yourself in the middle of others' conflicts.",
            "Decision-making has been a struggle - you can see all sides clearly.",
            "Relationships have taught you your biggest life lessons.",
        ],
        Zodiac.SCORPIO: [
            "You've experienced significant transformations - you're not the same person you were.",
            "Trust issues have developed from experiences where others betrayed your confidence.",
            "You feel things intensely and often alone in your depth.",
        ],
        Zodiac.SAGITTARIUS: [
            "Freedom is essential to you but circumstances have often felt limiting.",
            "You've searched for meaning in many places - haven't quite found what you're looking for.",
            "Travel or relocation has played a role in your life journey.",
        ],
        Zodiac.CAPRICORN: [
            "You've worked harder than most people realize for what you have.",
            "Career ambitions haven't unfolded the way you originally planned.",
            "Authority figures have been both mentors and obstacles.",
        ],
        Zodiac.AQUARIUS: [
            "You've always felt a bit different from others, like you don't quite fit in.",
            "Your ideas are often ahead of their time - others catch up later.",
            "You value your independence but sometimes feel isolated.",
        ],
        Zodiac.PISCES: [
            "You often know things without knowing how you know them - intuition guides you.",
            "You absorb the emotions of people around you, which can be draining.",
            "Escapism has been a coping mechanism when reality feels too heavy.",
        ],
    }

    return {
        "sign": name,
        "symbol": symbol,
        "archetype": archetype,
        "element": element,
        "traits": traits,
        "cold_reading_hooks": cold_reading_hooks.get(sign, []),
        "date_string": date_obj.strftime("%B %d"),
    }


def calculate_life_path_number(birth_date: str) -> Dict:
    """
    Calculate numerology life path number from birth date.

    Args:
        birth_date: Date in YYYY-MM-DD format

    Returns:
        Dict with life path number and cold reading templates
    """
    date_obj = datetime.datetime.strptime(birth_date, "%Y-%m-%d")
    date_str = date_obj.strftime("%Y%m%d")

    # Sum all digits
    total = sum(int(d) for d in date_str)

    # Reduce to single digit (unless 11, 22, 33 - master numbers)
    while total > 9 and total not in (11, 22, 33):
        total = sum(int(d) for d in str(total))

    # Map to life path numbers (1-9)
    if total > 9:
        total = sum(int(d) for d in str(total))

    try:
        lpn = LifePathNumber(total)
    except ValueError:
        lpn = LifePathNumber.ONE

    number, archetype, traits = lpn.value

    # Cold reading templates per life path number
    cold_reading_templates = {
        1: [
            "independent but often feel you must do everything alone",
            "struggle with authority - prefer to lead but haven't always had the opportunity",
            "your biggest successes have come when you trusted your own instincts",
        ],
        2: [
            "sensitive to others' needs but often neglect your own",
            "relationships have been your greatest teachers - often through difficulty",
            "you delay decisions because you can see all perspectives clearly",
        ],
        3: [
            "expressive but often feel misunderstood",
            "creative projects have brought both joy and frustration",
            "you avoid confrontation even when it's necessary",
        ],
        4: [
            "hardworking but feel your efforts aren't always recognized",
            "you value stability but life has required constant adaptation",
            "practical matters often fall on your shoulders",
        ],
        5: [
            "crave freedom but circumstances have often felt restrictive",
            "you've had multiple jobs or lived in different places",
            "commitment has been a recurring theme to work through",
        ],
        6: [
            "responsible - often the one others depend on",
            "family or relationship obligations have shaped your path significantly",
            "you give so much to others that you sometimes forget yourself",
        ],
        7: [
            "seek deeper meaning but often feel others don't understand your questions",
            "solitude is necessary for you but sometimes leads to isolation",
            "you've had to learn to trust your intuition over others' opinions",
        ],
        8: [
            "material success has been important but elusive at times",
            "work has often taken priority over other parts of life",
            "you've experienced significant financial ups and downs",
        ],
        9: [
            "idealistic but reality has often fallen short of your vision",
            "you give freely but don't always receive in kind",
            "letting go of the past has been one of your biggest challenges",
        ],
    }

    return {
        "number": number,
        "archetype": archetype,
        "traits": traits,
        "cold_reading_templates": cold_reading_templates.get(total, []),
        "is_master_number": total in (11, 22, 33),
    }


def calculate_chinese_zodiac(birth_date: str) -> Dict:
    """
    Calculate Chinese zodiac sign from birth year.

    Args:
        birth_date: Date in YYYY-MM-DD format

    Returns:
        Dict with Chinese zodiac and generational timing info
    """
    date_obj = datetime.datetime.strptime(birth_date, "%Y-%m-%d")
    year = date_obj.year

    # Chinese zodiac is based on the year of the Chinese New Year
    # Approximate by checking early January
    if date_obj.month == 1 and date_obj.day < 20:
        year -= 1

    zodiac_year = (year - 1900) % 12

    zodiacs = [
        ChineseZodiac.RAT,      # 1900, 1912, 1924...
        ChineseZodiac.OX,       # 1901, 1913, 1925...
        ChineseZodiac.TIGER,    # 1902, 1914, 1926...
        ChineseZodiac.RABBIT,   # 1903, 1915, 1927...
        ChineseZodiac.DRAGON,   # 1904, 1916, 1928...
        ChineseZodiac.SNAKE,    # 1905, 1917, 1929...
        ChineseZodiac.HORSE,    # 1906, 1918, 1930...
        ChineseZodiac.GOAT,     # 1907, 1919, 1931...
        ChineseZodiac.MONKEY,   # 1908, 1920, 1932...
        ChineseZodiac.ROOSTER,  # 1909, 1921, 1933...
        ChineseZodiac.DOG,      # 1910, 1922, 1934...
        ChineseZodiac.PIG,      # 1911, 1923, 1935...
    ]

    zodiac = zodiacs[zodiac_year]
    name, traits = zodiac.value

    # Elemental cycle (5 elements × 12 signs = 60 year cycle)
    elements = ["Metal", "Water", "Wood", "Fire", "Earth"]
    element_index = (year - 1900) % 10 // 2
    element = elements[element_index]

    return {
        "animal": name,
        "element": element,
        "full_designation": f"{element} {name}",
        "traits": traits,
        "birth_year": year,
    }


def calculate_birth_chart(birth_date: str, birth_place: str = "") -> Dict:
    """
    Generate a complete birth chart with all mystical calculations.

    Args:
        birth_date: Date in YYYY-MM-DD format
        birth_place: Birth location (affects interpretation)

    Returns:
        Complete birth chart for cold reading framework
    """
    zodiac_info = calculate_zodiac(birth_date)
    life_path = calculate_life_path_number(birth_date)
    chinese_zodiac = calculate_chinese_zodiac(birth_date)

    # Calculate sun/moon/rising "positions" (simplified for cold reading)
    date_obj = datetime.datetime.strptime(birth_date, "%Y-%m-%d")
    day_of_year = date_obj.timetuple().tm_yday
    year_progress = day_of_year / 365

    # Moon sign based on a pseudo-calculation
    moon_signs = list(Zodiac)
    moon_index = (day_of_year * 2) % 12
    moon_sign = moon_signs[int(moon_index)]

    # Rising sign based on "birth time" (we'll estimate since we don't have time)
    rising_index = (int(birth_place[-3:] if birth_place and len(birth_place) >= 3 else "0") % 12) if birth_place else 0
    rising_sign = moon_signs[rising_index]

    return {
        "sun_sign": zodiac_info,
        "moon_sign": {
            "sign": moon_sign.value[0],
            "symbol": moon_sign.value[1],
            "interpretation": "emotional nature, inner self",
            "traits": moon_sign.value[4],
        },
        "rising_sign": {
            "sign": rising_sign.value[0],
            "symbol": rising_sign.value[1],
            "interpretation": "outer personality, how others see you",
            "traits": rising_sign.value[4],
        },
        "life_path_number": life_path,
        "chinese_zodiac": chinese_zodiac,
        "birth_date_formatted": date_obj.strftime("%B %d, %Y"),
        "day_of_week": date_obj.strftime("%A"),
    }


def get_planetary_positions(birth_date: str) -> Dict[str, str]:
    """
    Get pseudo-planetary positions for mystical framing.

    These are simplified calculations designed to create
    impressive-looking "data" for the cold reading frame.

    Args:
        birth_date: Date in YYYY-MM-DD format

    Returns:
        Dict of planetary positions and interpretations
    """
    date_obj = datetime.datetime.strptime(birth_date, "%Y-%m-%d")

    # Pseudo-calculate positions based on date
    day_of_year = date_obj.timetuple().tm_year

    planets = [
        ("Mercury", "communication, thinking"),
        ("Venus", "love, values, attraction"),
        ("Mars", "action, desire, conflict"),
        ("Jupiter", "expansion, luck, philosophy"),
        ("Saturn", "discipline, limitations, lessons"),
    ]

    positions = {}
    for i, (planet, domain) in enumerate(planets):
        # Generate a semi-random but deterministic position
        position_degree = (day_of_year * (i + 1) * 7) % 30
        sign_index = (day_of_year + i * 50) % 12
        sign = list(Zodiac)[sign_index]

        # Retrograde calculation (about 1/3 of the time)
        is_retrograde = ((day_of_year + i * 73) % 3) == 0

        positions[planet] = {
            "degree": position_degree,
            "sign": sign.value[0],
            "symbol": sign.value[1],
            "domain": domain,
            "is_retrograde": is_retrograde,
            "interpretation": f"Your {planet} in {sign.value[0]}{' (retrograde)' if is_retrograde else ''} suggests themes around {domain}."
        }

    return positions
