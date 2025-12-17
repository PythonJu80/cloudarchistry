"""
Game Modes Question Generator
==============================
Generates personalized questions for game modes (Sniper Quiz, etc.)
based on user's target certification, skill level, and study needs.
"""

import json
import uuid
from typing import List, Optional, Dict
from pydantic import BaseModel
from openai import AsyncOpenAI

from prompts import CERTIFICATION_PERSONAS
from utils import get_request_api_key, get_request_model, ApiKeyRequiredError

# Map cert codes (e.g., "SAA-C03") to persona IDs
CERT_CODE_TO_PERSONA = {
    "SAA": "solutions-architect-associate",
    "SAA-C03": "solutions-architect-associate",
    "SAP": "solutions-architect-professional",
    "SAP-C02": "solutions-architect-professional",
    "DVA": "developer-associate",
    "DVA-C02": "developer-associate",
    "SOA": "sysops-associate",
    "SOA-C02": "sysops-associate",
    "DOP": "devops-professional",
    "DOP-C02": "devops-professional",
    "ANS": "advanced-networking",
    "ANS-C01": "advanced-networking",
    "SCS": "security-specialty",
    "SCS-C02": "security-specialty",
    "DBS": "database-specialty",
    "DBS-C01": "database-specialty",
    "MLS": "machine-learning",
    "MLS-C01": "machine-learning",
    "PAS": "data-analytics",
    "DAS-C01": "data-analytics",
    "CLF": "cloud-practitioner",
    "CLF-C02": "cloud-practitioner",
}


class GameQuestion(BaseModel):
    """A question for game modes"""
    id: str
    question: str
    options: List[str]  # 4 options for MCQ
    correct_index: int  # 0-3
    topic: str  # AWS service/topic area
    difficulty: str  # easy, medium, hard
    explanation: str  # Why the answer is correct
    points: int = 10


class SniperQuizQuestions(BaseModel):
    """Questions for Sniper Quiz game mode"""
    questions: List[GameQuestion]
    total_points: int
    topics_covered: List[str]


async def _chat_json(
    messages: List[Dict],
    model: Optional[str] = None,
    api_key: Optional[str] = None
) -> Dict:
    """JSON chat completion with request-scoped key support."""
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Please configure your API key in Settings."
        )
    
    model = model or get_request_model() or "gpt-4o"
    client = AsyncOpenAI(api_key=key)
    
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.8,  # Slightly higher for variety
    )
    return json.loads(response.choices[0].message.content)


SNIPER_QUIZ_PROMPT = """You are generating rapid-fire quiz questions for a "Sniper Quiz" game mode.
The user is studying for an AWS certification and needs quick, focused practice questions.

USER PROFILE:
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {focus_areas}
- Weak Topics (prioritize these): {weak_topics}
- Recently Studied: {recent_topics}

CERTIFICATION CONTEXT:
{cert_context}

Generate {question_count} multiple-choice questions that:

1. MATCH THE CERTIFICATION EXAM STYLE:
   - Use the same question patterns as the real {cert_name} exam
   - Include scenario-based questions where appropriate
   - Test practical understanding, not just memorization

2. PRIORITIZE WEAK AREAS:
   - At least 40% of questions should cover the user's weak topics
   - Mix in other certification topics for variety

3. SCALE DIFFICULTY TO SKILL LEVEL:
   - beginner: Focus on core concepts, clear correct answers, avoid edge cases
   - intermediate: Include trade-offs, "best" practices, some scenario questions
   - advanced: Complex scenarios, optimization, multi-service integration
   - expert: Edge cases, failure modes, cost optimization, architecture decisions

4. MAKE EACH QUESTION UNIQUE:
   - Don't repeat similar questions
   - Vary the AWS services covered
   - Mix question types (what/why/how/when/which)

5. ENSURE QUALITY:
   - All 4 options should be plausible (no obviously wrong answers)
   - Exactly 1 correct answer per question
   - Explanations should be educational

DIFFICULTY DISTRIBUTION for {question_count} questions:
- beginner level: 70% easy, 30% medium
- intermediate level: 30% easy, 50% medium, 20% hard
- advanced level: 20% easy, 40% medium, 40% hard
- expert level: 10% easy, 30% medium, 60% hard

Return JSON with:
{{
  "questions": [
    {{
      "id": "unique_id",
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0-3,
      "topic": "AWS Service/Topic",
      "difficulty": "easy|medium|hard",
      "explanation": "Why this is correct and others are wrong"
    }}
  ],
  "topics_covered": ["list", "of", "topics"]
}}
"""


async def generate_sniper_quiz_questions(
    # User context
    user_level: str = "intermediate",
    cert_code: Optional[str] = None,
    weak_topics: Optional[List[str]] = None,
    recent_topics: Optional[List[str]] = None,
    
    # Options
    question_count: int = 10,
    
    # API config
    api_key: Optional[str] = None,
) -> SniperQuizQuestions:
    """
    Generate personalized Sniper Quiz questions based on user profile.
    
    Args:
        user_level: User's skill level (beginner/intermediate/advanced/expert)
        cert_code: Target certification code (e.g., "SAA-C03", "DVA-C02")
        weak_topics: Topics the user struggles with (prioritized)
        recent_topics: Topics recently studied (for reinforcement)
        question_count: Number of questions to generate (default 10)
        api_key: Optional OpenAI API key
    
    Returns:
        SniperQuizQuestions with personalized questions
    """
    
    # Build cert context
    cert_name = "AWS Cloud Practitioner"  # Default
    cert_context = ""
    focus_areas = ["Core AWS Services", "Cloud Concepts", "Security", "Pricing"]
    
    # Map cert code to persona ID
    persona_id = None
    if cert_code:
        # Try direct lookup first, then strip version suffix
        upper_code = cert_code.upper()
        persona_id = CERT_CODE_TO_PERSONA.get(upper_code)
        if not persona_id:
            # Try without version (e.g., "SAA-C03" -> "SAA")
            base_code = upper_code.split("-")[0] if "-" in upper_code else upper_code
            persona_id = CERT_CODE_TO_PERSONA.get(base_code)
    
    if persona_id and persona_id in CERTIFICATION_PERSONAS:
        persona = CERTIFICATION_PERSONAS[persona_id]
        cert_name = persona.get("cert", cert_name)
        focus_areas = persona.get("focus", focus_areas)
        cert_context = f"""
This is for the {cert_name} certification.
Exam Style: {persona.get('style', 'Standard AWS exam format')}
Key Focus Areas: {', '.join(focus_areas)}
Question patterns should match the real exam."""
    
    # Handle optional lists
    weak_topics_str = ", ".join(weak_topics) if weak_topics else "None specified - cover all areas"
    recent_topics_str = ", ".join(recent_topics) if recent_topics else "General AWS topics"
    
    # Build the prompt
    system_prompt = SNIPER_QUIZ_PROMPT.format(
        user_level=user_level,
        cert_name=cert_name,
        focus_areas=", ".join(focus_areas),
        weak_topics=weak_topics_str,
        recent_topics=recent_topics_str,
        cert_context=cert_context,
        question_count=question_count,
    )
    
    user_prompt = f"""Generate {question_count} unique Sniper Quiz questions for:
- Certification: {cert_name}
- Skill Level: {user_level}
- Weak Areas to Focus: {weak_topics_str}

Make them challenging but fair, matching the real exam style."""

    result = await _chat_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        api_key=api_key,
    )
    
    # Parse questions
    questions = []
    for idx, q in enumerate(result.get("questions", [])):
        # Assign points based on difficulty and position
        base_points = {"easy": 10, "medium": 15, "hard": 20}.get(q.get("difficulty", "medium"), 10)
        position_bonus = (idx + 1)  # Later questions worth more
        points = base_points + position_bonus
        
        questions.append(GameQuestion(
            id=q.get("id", f"sniper_{uuid.uuid4().hex[:8]}"),
            question=q.get("question", ""),
            options=q.get("options", ["A", "B", "C", "D"]),
            correct_index=q.get("correct_index", 0),
            topic=q.get("topic", "AWS"),
            difficulty=q.get("difficulty", "medium"),
            explanation=q.get("explanation", ""),
            points=points,
        ))
    
    # Calculate totals
    total_points = sum(q.points for q in questions)
    topics_covered = result.get("topics_covered", list(set(q.topic for q in questions)))
    
    return SniperQuizQuestions(
        questions=questions,
        total_points=total_points,
        topics_covered=topics_covered,
    )


async def generate_speed_round_questions(
    user_level: str = "intermediate",
    cert_code: Optional[str] = None,
    topic_focus: Optional[str] = None,
    question_count: int = 20,
    api_key: Optional[str] = None,
) -> SniperQuizQuestions:
    """
    Generate rapid-fire questions for Speed Round mode.
    These are shorter, more direct questions for quick answers.
    """
    
    # Similar to sniper quiz but with shorter questions
    cert_name = "AWS"
    if cert_code:
        upper_code = cert_code.upper()
        persona_id = CERT_CODE_TO_PERSONA.get(upper_code)
        if not persona_id:
            base_code = upper_code.split("-")[0] if "-" in upper_code else upper_code
            persona_id = CERT_CODE_TO_PERSONA.get(base_code)
        if persona_id and persona_id in CERTIFICATION_PERSONAS:
            cert_name = CERTIFICATION_PERSONAS[persona_id].get("cert", "AWS")
    
    system_prompt = f"""Generate {question_count} RAPID-FIRE quiz questions for AWS certification practice.

User Level: {user_level}
Certification: {cert_name}
Topic Focus: {topic_focus or "All AWS topics"}

These are SPEED ROUND questions - they should be:
1. SHORT and DIRECT - no long scenarios
2. Test quick recall of key facts
3. Clear, unambiguous correct answers
4. 4 options each, 1 correct

Examples of good speed round questions:
- "What is the maximum size of an S3 object?"
- "Which service provides managed Kubernetes?"
- "What does RDS stand for?"

Return JSON with questions array, each having:
id, question, options (4), correct_index (0-3), topic, difficulty, explanation"""

    result = await _chat_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Generate {question_count} speed round questions."},
        ],
        api_key=api_key,
    )
    
    questions = []
    for idx, q in enumerate(result.get("questions", [])):
        questions.append(GameQuestion(
            id=q.get("id", f"speed_{uuid.uuid4().hex[:8]}"),
            question=q.get("question", ""),
            options=q.get("options", ["A", "B", "C", "D"]),
            correct_index=q.get("correct_index", 0),
            topic=q.get("topic", "AWS"),
            difficulty=q.get("difficulty", "medium"),
            explanation=q.get("explanation", ""),
            points=5 + idx,  # Speed round = fewer points per question
        ))
    
    return SniperQuizQuestions(
        questions=questions,
        total_points=sum(q.points for q in questions),
        topics_covered=list(set(q.topic for q in questions)),
    )


class HotStreakQuestions(BaseModel):
    """Questions for Hot Streak game mode"""
    questions: List[GameQuestion]
    topics_covered: List[str]


HOT_STREAK_PROMPT = """You are generating quick-fire quiz questions for a "Hot Streak" game mode.
This is a 60-second timed game where users answer as many questions as possible to build heat/temperature.

USER PROFILE:
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {focus_areas}

CERTIFICATION CONTEXT:
{cert_context}

Generate {question_count} UNIQUE quick-fire questions that:

1. ARE QUICK TO READ AND ANSWER:
   - Short, direct questions (1-2 sentences max)
   - No long scenarios - this is rapid-fire
   - Clear, unambiguous correct answers

2. MATCH THE CERTIFICATION:
   - Questions should be relevant to {cert_name}
   - Cover the key focus areas for this cert
   - Test practical knowledge, not obscure trivia

3. SCALE TO SKILL LEVEL:
   - {user_level}: Adjust complexity accordingly
   - beginner: Core concepts, clear answers
   - intermediate: Best practices, trade-offs
   - advanced/expert: Optimization, edge cases

4. ENSURE VARIETY:
   - Mix different AWS services
   - Mix question types (what/which/how/why)
   - NO REPEATED QUESTIONS

5. QUALITY:
   - All 4 options plausible
   - Exactly 1 correct answer
   - Brief but helpful explanations

IMPORTANT: Randomize which option is correct! Do NOT always put the correct answer first.
The correct_index should vary between 0, 1, 2, and 3 across questions.

Return JSON:
{{
  "questions": [
    {{
      "id": "unique_id",
      "question": "Short question text",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correct_index": 2,
      "topic": "AWS Service/Topic",
      "difficulty": "easy|medium|hard",
      "explanation": "Brief explanation"
    }}
  ],
  "topics_covered": ["list", "of", "topics"]
}}
"""


async def generate_hot_streak_questions(
    user_level: str = "intermediate",
    cert_code: Optional[str] = None,
    question_count: int = 25,
    exclude_ids: Optional[List[str]] = None,
    api_key: Optional[str] = None,
) -> HotStreakQuestions:
    """
    Generate quick-fire questions for Hot Streak game mode.
    
    Args:
        user_level: User's skill level (beginner/intermediate/advanced/expert)
        cert_code: Target certification code (e.g., "SAA-C03", "DVA-C02")
        question_count: Number of questions to generate
        exclude_ids: Question IDs to exclude (already answered)
        api_key: User's OpenAI API key
    
    Returns:
        HotStreakQuestions with quick-fire questions
    """
    
    # Build cert context
    cert_name = "AWS Cloud Practitioner"
    cert_context = ""
    focus_areas = ["Core AWS Services", "Cloud Concepts", "Security", "Pricing"]
    
    # Map cert code to persona
    persona_id = None
    if cert_code:
        upper_code = cert_code.upper()
        persona_id = CERT_CODE_TO_PERSONA.get(upper_code)
        if not persona_id:
            base_code = upper_code.split("-")[0] if "-" in upper_code else upper_code
            persona_id = CERT_CODE_TO_PERSONA.get(base_code)
    
    if persona_id and persona_id in CERTIFICATION_PERSONAS:
        persona = CERTIFICATION_PERSONAS[persona_id]
        cert_name = persona.get("cert", cert_name)
        focus_areas = persona.get("focus", focus_areas)
        cert_context = f"""
This is for the {cert_name} certification.
Exam Style: {persona.get('style', 'Standard AWS exam format')}
Key Focus Areas: {', '.join(focus_areas)}
"""
    
    # Build the prompt
    system_prompt = HOT_STREAK_PROMPT.format(
        user_level=user_level,
        cert_name=cert_name,
        focus_areas=", ".join(focus_areas),
        cert_context=cert_context,
        question_count=question_count,
    )
    
    exclude_note = ""
    if exclude_ids and len(exclude_ids) > 0:
        exclude_note = f"\n\nIMPORTANT: Generate completely NEW questions. The user has already answered {len(exclude_ids)} questions."
    
    user_prompt = f"""Generate {question_count} unique Hot Streak questions for:
- Certification: {cert_name}
- Skill Level: {user_level}

Make them quick to read and answer - this is a 60-second timed game!{exclude_note}"""

    result = await _chat_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        api_key=api_key,
    )
    
    # Parse questions
    questions = []
    for idx, q in enumerate(result.get("questions", [])):
        base_points = {"easy": 10, "medium": 15, "hard": 20}.get(q.get("difficulty", "medium"), 10)
        
        questions.append(GameQuestion(
            id=q.get("id", f"hotstreak_{uuid.uuid4().hex[:8]}"),
            question=q.get("question", ""),
            options=q.get("options", ["A", "B", "C", "D"]),
            correct_index=q.get("correct_index", 0),
            topic=q.get("topic", "AWS"),
            difficulty=q.get("difficulty", "medium"),
            explanation=q.get("explanation", ""),
            points=base_points,
        ))
    
    topics_covered = result.get("topics_covered", list(set(q.topic for q in questions)))
    
    return HotStreakQuestions(
        questions=questions,
        topics_covered=topics_covered,
    )


class TickingBombQuestions(BaseModel):
    """Questions for Ticking Bomb game mode"""
    questions: List[GameQuestion]
    topics_covered: List[str]


TICKING_BOMB_PROMPT = """You are generating quick-fire quiz questions for a "Ticking Bomb" party game.
This is a multiplayer hot-potato game where players pass a bomb around by answering questions correctly.
Questions must be FAST to read and answer - the bomb is ticking!

USER PROFILE:
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {focus_areas}

CERTIFICATION CONTEXT:
{cert_context}

Generate {question_count} UNIQUE quick-fire questions that:

1. ARE EXTREMELY QUICK TO READ AND ANSWER:
   - Maximum 1-2 short sentences
   - NO long scenarios - players have seconds to answer
   - Clear, unambiguous correct answers
   - Think "pub quiz" style - snappy and fun

2. MATCH THE CERTIFICATION:
   - Questions should be relevant to {cert_name}
   - Cover the key focus areas for this cert
   - Test practical knowledge, not obscure trivia

3. SCALE TO SKILL LEVEL:
   - {user_level}: Adjust complexity accordingly
   - beginner: Core concepts, clear answers
   - intermediate: Best practices, common patterns
   - advanced/expert: Optimization, trade-offs

4. ENSURE VARIETY:
   - Mix different AWS services
   - Mix question types (what/which/how)
   - NO REPEATED QUESTIONS
   - Make them FUN - this is a party game!

5. QUALITY:
   - All 4 options plausible but distinct
   - Exactly 1 correct answer
   - Brief explanations (shown after elimination)

IMPORTANT: Randomize which option is correct! Do NOT always put the correct answer first.
The correct_index should vary between 0, 1, 2, and 3 across questions.

Return JSON:
{{
  "questions": [
    {{
      "id": "unique_id",
      "question": "Short punchy question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 2,
      "topic": "AWS Service/Topic",
      "difficulty": "easy|medium|hard",
      "explanation": "Brief explanation"
    }}
  ],
  "topics_covered": ["list", "of", "topics"]
}}
"""


async def generate_ticking_bomb_questions(
    user_level: str = "intermediate",
    cert_code: Optional[str] = None,
    question_count: int = 30,
    api_key: Optional[str] = None,
) -> TickingBombQuestions:
    """
    Generate quick-fire questions for Ticking Bomb party game.
    
    Args:
        user_level: User's skill level (beginner/intermediate/advanced/expert)
        cert_code: Target certification code (e.g., "SAA-C03", "DVA-C02")
        question_count: Number of questions to generate (default 30 for longer games)
        api_key: User's OpenAI API key
    
    Returns:
        TickingBombQuestions with quick-fire party questions
    """
    
    # Build cert context
    cert_name = "AWS Cloud Practitioner"
    cert_context = ""
    focus_areas = ["Core AWS Services", "Cloud Concepts", "Security", "Pricing"]
    
    # Map cert code to persona
    persona_id = None
    if cert_code:
        upper_code = cert_code.upper()
        persona_id = CERT_CODE_TO_PERSONA.get(upper_code)
        if not persona_id:
            base_code = upper_code.split("-")[0] if "-" in upper_code else upper_code
            persona_id = CERT_CODE_TO_PERSONA.get(base_code)
    
    if persona_id and persona_id in CERTIFICATION_PERSONAS:
        persona = CERTIFICATION_PERSONAS[persona_id]
        cert_name = persona.get("cert", cert_name)
        focus_areas = persona.get("focus", focus_areas)
        cert_context = f"""
This is for the {cert_name} certification.
Exam Style: {persona.get('style', 'Standard AWS exam format')}
Key Focus Areas: {', '.join(focus_areas)}
"""
    
    # Build the prompt
    system_prompt = TICKING_BOMB_PROMPT.format(
        user_level=user_level,
        cert_name=cert_name,
        focus_areas=", ".join(focus_areas),
        cert_context=cert_context,
        question_count=question_count,
    )
    
    user_prompt = f"""Generate {question_count} unique Ticking Bomb questions for:
- Certification: {cert_name}
- Skill Level: {user_level}

Make them QUICK and FUN - this is a party game with a ticking bomb!
Players need to read and answer in seconds."""

    result = await _chat_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        api_key=api_key,
    )
    
    # Parse questions
    questions = []
    for idx, q in enumerate(result.get("questions", [])):
        base_points = {"easy": 10, "medium": 15, "hard": 20}.get(q.get("difficulty", "medium"), 10)
        
        questions.append(GameQuestion(
            id=q.get("id", f"bomb_{uuid.uuid4().hex[:8]}"),
            question=q.get("question", ""),
            options=q.get("options", ["A", "B", "C", "D"]),
            correct_index=q.get("correct_index", 0),
            topic=q.get("topic", "AWS"),
            difficulty=q.get("difficulty", "medium"),
            explanation=q.get("explanation", ""),
            points=base_points,
        ))
    
    topics_covered = result.get("topics_covered", list(set(q.topic for q in questions)))
    
    return TickingBombQuestions(
        questions=questions,
        topics_covered=topics_covered,
    )


# Quick test
if __name__ == "__main__":
    import asyncio
    
    async def test():
        result = await generate_sniper_quiz_questions(
            user_level="intermediate",
            cert_code="SAA-C03",
            weak_topics=["VPC", "IAM"],
            question_count=5,
        )
        print(f"Generated {len(result.questions)} questions")
        for q in result.questions:
            print(f"  - [{q.topic}] {q.question[:50]}...")
    
    asyncio.run(test())
