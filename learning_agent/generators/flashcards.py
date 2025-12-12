"""
Flashcard Generator Module
==========================
Generates spaced-repetition flashcards from scenarios.

PATTERN: "Tool uses AI" - The tool pre-gathers all data, AI just formats.
- Tool fetches knowledge from DB (no AI needed)
- Tool structures content by certification/difficulty (deterministic)
- AI only formats into Q&A pairs (cheap, no hallucination)
"""

import json
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from openai import AsyncOpenAI

from config.settings import logger
from prompts import FLASHCARD_GENERATOR_PROMPT, PERSONA_FLASHCARD_PROMPT
from utils import get_request_api_key, get_request_model, ApiKeyRequiredError

DEFAULT_MODEL = "gpt-4o-mini"  # Cheaper model - AI is just formatting


class Flashcard(BaseModel):
    """Single flashcard"""
    front: str
    back: str
    difficulty: str  # easy, medium, hard
    aws_services: List[str] = []
    tags: List[str] = []


class FlashcardDeck(BaseModel):
    """Generated flashcard deck"""
    title: str
    description: str
    cards: List[Flashcard]
    total_cards: int
    difficulty_distribution: dict  # {"easy": 5, "medium": 10, "hard": 5}


# ============================================
# STRUCTURED CONTENT FOR "TOOL USES AI" PATTERN
# ============================================

class FlashcardStructuredContent(BaseModel):
    """Pre-gathered content - tool decides, AI just formats."""
    scenario_title: str
    business_context: str
    certification: str
    cert_level: str  # foundational, associate, professional, specialty
    skill_level: str  # beginner, intermediate, advanced
    aws_services: List[str]
    knowledge_facts: List[Dict[str, str]]  # [{"topic": "S3", "fact": "..."}]
    card_count: int
    difficulty_distribution: Dict[str, int]  # {"easy": 5, "medium": 10, "hard": 5}


async def _chat_json(messages: List[Dict], model: str = "gpt-4o", api_key: Optional[str] = None) -> Dict:
    """Simple JSON chat completion."""
    # Priority: explicit param > request context (no environment fallback)
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Please configure your API key in Settings."
        )
    client = AsyncOpenAI(api_key=key)
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.7,
    )
    return json.loads(response.choices[0].message.content)


async def generate_flashcards(
    scenario_title: str,
    business_context: str,
    aws_services: List[str],
    user_level: str = "intermediate",
    card_count: int = 20,
    challenges: Optional[List[dict]] = None,
    persona_context: Optional[Dict] = None,
) -> FlashcardDeck:
    """Generate flashcards for a scenario - persona-aware."""
    
    # Use persona-specific prompt if persona provided
    if persona_context:
        base_prompt = PERSONA_FLASHCARD_PROMPT.format(
            scenario_title=scenario_title,
            business_context=business_context,
            cert_name=persona_context.get("cert_name", "AWS Certification"),
            focus_areas=persona_context.get("focus_areas", ""),
            level=persona_context.get("level", "associate"),
            card_count=card_count,
        )
    else:
        base_prompt = FLASHCARD_GENERATOR_PROMPT.format(
            scenario_title=scenario_title,
            business_context=business_context,
            aws_services=", ".join(aws_services),
            user_level=user_level,
            card_count=card_count,
        )
    
    system_prompt = f"""You create educational flashcards for cloud architecture.
Return JSON with: title, description, cards (array of: front, back, difficulty, aws_services, tags)

{base_prompt}"""
    
    user_prompt = f"Generate {card_count} flashcards for: {scenario_title}"
    if persona_context:
        user_prompt += f"\nFocus on {persona_context.get('cert_name', 'AWS')} certification topics."
    if challenges:
        user_prompt += "\n\nChallenges to cover:\n"
        for c in challenges:
            user_prompt += f"- {c.get('title', '')}\n"
    
    result = await _chat_json([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ])
    
    cards = [Flashcard(**c) for c in result.get("cards", [])]
    
    return FlashcardDeck(
        title=result.get("title", f"Flashcards: {scenario_title}"),
        description=result.get("description", ""),
        cards=cards,
        total_cards=len(cards),
        difficulty_distribution={
            "easy": len([c for c in cards if c.difficulty == "easy"]),
            "medium": len([c for c in cards if c.difficulty == "medium"]),
            "hard": len([c for c in cards if c.difficulty == "hard"]),
        },
    )


async def generate_flashcards_for_service(
    service_name: str,
    user_level: str = "intermediate",
    card_count: int = 10,
    context: Optional[str] = None,
) -> FlashcardDeck:
    """Generate flashcards focused on a specific AWS service."""
    
    system_prompt = f"""Create {card_count} flashcards about AWS {service_name}.
User Level: {user_level}
{"Context: " + context if context else ""}

Return JSON with: title, description, cards (array of: front, back, difficulty, aws_services, tags)"""

    result = await _chat_json([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Generate flashcards for AWS {service_name}"},
    ])
    
    cards = [Flashcard(**c) for c in result.get("cards", [])]
    
    return FlashcardDeck(
        title=result.get("title", f"AWS {service_name} Flashcards"),
        description=result.get("description", ""),
        cards=cards,
        total_cards=len(cards),
        difficulty_distribution={
            "easy": len([c for c in cards if c.difficulty == "easy"]),
            "medium": len([c for c in cards if c.difficulty == "medium"]),
            "hard": len([c for c in cards if c.difficulty == "hard"]),
        },
    )


# ============================================
# "TOOL USES AI" PATTERN - AI is just a formatter
# ============================================

FORMAT_FLASHCARD_PROMPT = """You are formatting flashcards from pre-gathered AWS knowledge.

## IMPORTANT: Your Role
You are a FORMATTER, not a content creator. The knowledge facts below were extracted from real AWS documentation.
Your job is to:
1. Convert each knowledge fact into a clear Q&A flashcard
2. Match the difficulty to the learner's level
3. Tag with relevant AWS services

DO NOT invent facts. Use ONLY the knowledge provided below.

## Learner Context
- Target Certification: {certification}
- Certification Level: {cert_level}
- Skill Level: {skill_level}
- Scenario: {scenario_title}

## Pre-Gathered Knowledge Facts
{knowledge_facts_json}

## AWS Services to Focus On
{aws_services}

## Required Output
Create exactly {card_count} flashcards with this difficulty distribution:
- Easy: {easy_count} cards (definition/recall questions)
- Medium: {medium_count} cards (comparison/when-to-use questions)  
- Hard: {hard_count} cards (scenario/troubleshooting questions)

## Question Types by Difficulty
EASY ({cert_level} foundational):
- "What is [service/concept]?"
- "What does [feature] do?"

MEDIUM ({cert_level} practical):
- "When would you use X vs Y?"
- "How do you configure X for [use case]?"

HARD ({cert_level} advanced):
- "A company needs X, which architecture?"
- "If X fails, what should you check?"

## Output Format
Return JSON:
{{
  "title": "Deck title based on scenario",
  "description": "Brief description mentioning certification",
  "cards": [
    {{
      "front": "Question derived from knowledge fact",
      "back": "Answer from the knowledge fact + why it matters",
      "difficulty": "easy|medium|hard",
      "aws_services": ["S3", "IAM"],
      "tags": ["storage", "security"]
    }}
  ]
}}

Output ONLY valid JSON."""


async def format_flashcards(
    structured_content: FlashcardStructuredContent,
    *,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> FlashcardDeck:
    """
    FORMAT flashcards from pre-gathered knowledge.
    
    The tool has already:
    - Fetched relevant knowledge from the database
    - Determined difficulty distribution by skill level
    - Selected AWS services to focus on
    
    AI just formats the knowledge into Q&A pairs.
    """
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required for flashcard formatting.")
    
    model_name = model or get_request_model() or DEFAULT_MODEL
    
    # Build the prompt with pre-gathered content
    prompt = FORMAT_FLASHCARD_PROMPT.format(
        certification=structured_content.certification,
        cert_level=structured_content.cert_level,
        skill_level=structured_content.skill_level,
        scenario_title=structured_content.scenario_title,
        knowledge_facts_json=json.dumps(structured_content.knowledge_facts, indent=2),
        aws_services=", ".join(structured_content.aws_services),
        card_count=structured_content.card_count,
        easy_count=structured_content.difficulty_distribution.get("easy", 5),
        medium_count=structured_content.difficulty_distribution.get("medium", 10),
        hard_count=structured_content.difficulty_distribution.get("hard", 5),
    )
    
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Format the flashcards now. Use ONLY the provided knowledge facts."},
    ]
    
    client = AsyncOpenAI(api_key=key)
    response = await client.chat.completions.create(
        model=model_name,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.3,  # Lower temperature for consistent formatting
    )
    
    content = response.choices[0].message.content
    
    try:
        result = json.loads(content)
    except json.JSONDecodeError as err:
        logger.error("Flashcard format JSON parse failure: %s", err)
        raise ValueError("AI returned invalid flashcard JSON") from err
    
    # Validate cards match expected count and difficulty distribution
    cards = validate_and_fix_cards(
        result.get("cards", []),
        structured_content
    )
    
    return FlashcardDeck(
        title=result.get("title", f"Flashcards: {structured_content.scenario_title}"),
        description=result.get("description", f"Study cards for {structured_content.certification}"),
        cards=cards,
        total_cards=len(cards),
        difficulty_distribution={
            "easy": len([c for c in cards if c.difficulty == "easy"]),
            "medium": len([c for c in cards if c.difficulty == "medium"]),
            "hard": len([c for c in cards if c.difficulty == "hard"]),
        },
    )


def validate_and_fix_cards(
    ai_cards: List[Dict],
    content: FlashcardStructuredContent
) -> List[Flashcard]:
    """Ensure AI didn't hallucinate or miss cards."""
    
    cards = []
    expected_distribution = content.difficulty_distribution
    
    for card_data in ai_cards:
        try:
            # Ensure required fields exist
            card = Flashcard(
                front=card_data.get("front", ""),
                back=card_data.get("back", ""),
                difficulty=card_data.get("difficulty", "medium"),
                aws_services=card_data.get("aws_services", []),
                tags=card_data.get("tags", []),
            )
            
            # Validate difficulty is valid
            if card.difficulty not in ["easy", "medium", "hard"]:
                card.difficulty = "medium"
            
            # Ensure aws_services are from our list
            card.aws_services = [
                s for s in card.aws_services 
                if s in content.aws_services or s.upper() in [svc.upper() for svc in content.aws_services]
            ]
            
            cards.append(card)
        except Exception as e:
            logger.warning(f"Invalid card data, skipping: {e}")
            continue
    
    # Log if count doesn't match
    if len(cards) != content.card_count:
        logger.warning(
            f"Card count mismatch: expected {content.card_count}, got {len(cards)}"
        )
    
    return cards


def calculate_difficulty_distribution(
    skill_level: str,
    cert_level: str,
    card_count: int
) -> Dict[str, int]:
    """
    Calculate card difficulty distribution based on skill level.
    Tool decides this - no AI needed.
    """
    # Skill level affects overall difficulty
    skill_weights = {
        "beginner": {"easy": 0.5, "medium": 0.35, "hard": 0.15},
        "intermediate": {"easy": 0.25, "medium": 0.5, "hard": 0.25},
        "advanced": {"easy": 0.15, "medium": 0.35, "hard": 0.5},
        "expert": {"easy": 0.1, "medium": 0.3, "hard": 0.6},
    }
    
    # Cert level can shift slightly
    cert_adjustments = {
        "foundational": {"easy": 0.1, "medium": 0, "hard": -0.1},
        "associate": {"easy": 0, "medium": 0, "hard": 0},
        "professional": {"easy": -0.1, "medium": 0, "hard": 0.1},
        "specialty": {"easy": -0.1, "medium": -0.05, "hard": 0.15},
    }
    
    weights = skill_weights.get(skill_level, skill_weights["intermediate"])
    adjustments = cert_adjustments.get(cert_level, cert_adjustments["associate"])
    
    # Apply adjustments
    final_weights = {
        k: max(0.05, min(0.7, weights[k] + adjustments.get(k, 0)))
        for k in weights
    }
    
    # Normalize
    total = sum(final_weights.values())
    final_weights = {k: v / total for k, v in final_weights.items()}
    
    # Calculate counts
    distribution = {
        "easy": round(card_count * final_weights["easy"]),
        "medium": round(card_count * final_weights["medium"]),
        "hard": round(card_count * final_weights["hard"]),
    }
    
    # Ensure we hit exact count
    diff = card_count - sum(distribution.values())
    distribution["medium"] += diff
    
    return distribution


def extract_facts_from_knowledge(
    knowledge_chunks: List[Dict],
    aws_services: List[str],
    max_facts: int = 25
) -> List[Dict[str, str]]:
    """
    Extract key facts from knowledge chunks.
    Tool does this deterministically - no AI needed.
    """
    facts = []
    
    for chunk in knowledge_chunks:
        content = chunk.get("content", "")
        url = chunk.get("url", "")
        
        # Split into sentences/facts
        sentences = content.replace("\n", " ").split(". ")
        
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) < 30 or len(sentence) > 500:
                continue
            
            # Check if it mentions any of our target services
            mentioned_services = [
                svc for svc in aws_services
                if svc.lower() in sentence.lower() or svc.upper() in sentence
            ]
            
            if mentioned_services or any(kw in sentence.lower() for kw in ["aws", "cloud", "amazon"]):
                facts.append({
                    "topic": mentioned_services[0] if mentioned_services else "AWS",
                    "fact": sentence,
                    "source": url,
                })
                
                if len(facts) >= max_facts:
                    break
        
        if len(facts) >= max_facts:
            break
    
    return facts
