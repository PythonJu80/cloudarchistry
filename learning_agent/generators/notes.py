"""
Study Notes Generator Module
============================
Generates comprehensive study notes from scenarios.

PATTERN: "Tool uses AI" - The tool pre-gathers all data, AI just formats.
- Tool fetches knowledge from DB (no AI needed)
- Tool structures content by certification/topic (deterministic)
- AI only formats into readable study notes (cheap, no hallucination)
"""

import json
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from openai import AsyncOpenAI

from config.settings import logger
from prompts import NOTES_GENERATOR_PROMPT, PERSONA_NOTES_PROMPT, CERTIFICATION_PERSONAS
from utils import get_request_api_key, get_request_model, ApiKeyRequiredError

DEFAULT_MODEL = "gpt-4o-mini"  # Cheaper model - AI is just formatting


# Valid user levels
VALID_USER_LEVELS = ["beginner", "intermediate", "advanced", "expert"]
VALID_CERT_CODES = list(CERTIFICATION_PERSONAS.keys())


class NotesValidationError(Exception):
    """Raised when notes generation parameters are invalid"""
    pass


def validate_notes_params(user_level: str, cert_code: str) -> None:
    """
    Validate that user_level and cert_code are provided and valid.
    
    Args:
        user_level: User skill level ('beginner', 'intermediate', 'advanced', 'expert')
        cert_code: AWS certification persona ID (e.g., 'solutions-architect-associate')
    
    Raises:
        NotesValidationError: If parameters are missing or invalid
    """
    if not user_level:
        raise NotesValidationError(
            "user_level is required. Study notes must be user-level specific. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if not cert_code:
        raise NotesValidationError(
            "cert_code is required. Study notes must be certification-specific. "
            f"Valid cert codes: {', '.join(VALID_CERT_CODES)}"
        )
    
    if user_level not in VALID_USER_LEVELS:
        raise NotesValidationError(
            f"Invalid user_level '{user_level}'. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if cert_code not in VALID_CERT_CODES:
        raise NotesValidationError(
            f"Invalid cert_code '{cert_code}'. "
            f"Valid cert codes: {', '.join(VALID_CERT_CODES)}"
        )


class NotesSection(BaseModel):
    """Section within study notes"""
    id: str
    title: str
    level: int  # 1 = h1, 2 = h2, etc.
    content: str
    aws_services: List[str] = []


class StudyNotes(BaseModel):
    """Generated study notes"""
    title: str
    summary: str  # Executive summary
    content: str  # Full markdown content
    sections: List[NotesSection]
    aws_services: List[str]
    estimated_read_time_minutes: int
    key_takeaways: List[str]


# ============================================
# STRUCTURED CONTENT FOR "TOOL USES AI" PATTERN
# ============================================

class NotesStructuredContent(BaseModel):
    """Pre-gathered content - tool decides, AI just formats."""
    scenario_title: str
    business_context: str
    certification: str
    cert_level: str  # foundational, associate, professional, specialty
    skill_level: str  # beginner, intermediate, advanced
    aws_services: List[str]
    knowledge_chunks: List[Dict[str, str]]  # [{"topic": "S3", "content": "...", "source": "..."}]
    technical_requirements: List[str]
    compliance_requirements: List[str]
    challenges: List[Dict[str, str]]  # [{"title": "...", "description": "..."}]


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


async def generate_notes(
    scenario_title: str,
    business_context: str,
    technical_requirements: List[str],
    compliance_requirements: List[str],
    aws_services: List[str],
    user_level: str,
    cert_code: str,
    challenges: Optional[List[dict]] = None,
) -> StudyNotes:
    """
    Generate study notes for a scenario.
    
    IMPORTANT: Both user_level and cert_code are REQUIRED.
    Each study guide must be certification-specific and user-level specific.
    
    Args:
        scenario_title: Title of the scenario
        business_context: Business context description
        technical_requirements: List of technical requirements
        compliance_requirements: List of compliance requirements
        aws_services: List of AWS services covered
        user_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        cert_code: Certification persona ID (REQUIRED, e.g., 'solutions-architect-associate')
        challenges: Optional list of challenges to cover
    
    Returns:
        StudyNotes tailored to cert and level
    
    Raises:
        NotesValidationError: If user_level or cert_code are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_notes_params(user_level, cert_code)
    
    # Get certification context (cert_code is now required and validated)
    if cert_code not in CERTIFICATION_PERSONAS:
        raise NotesValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    persona_context = {
        "cert_name": persona["cert"],
        "focus_areas": ", ".join(persona["focus"]),
        "level": persona["level"],
    }
    
    # Use persona-specific prompt (always, since cert_code is required)
    base_prompt = PERSONA_NOTES_PROMPT.format(
        scenario_title=scenario_title,
        business_context=business_context,
        aws_services=", ".join(aws_services),
        cert_name=persona_context["cert_name"],
        focus_areas=persona_context["focus_areas"],
        level=persona_context["level"],
    )
    
    system_prompt = f"""You are an expert technical writer creating study guides.
Return JSON with: title, summary, content (markdown), sections (array of: id, title, level, content, aws_services), aws_services, key_takeaways

{base_prompt}"""
    
    user_prompt = f"Generate study notes for: {scenario_title}"
    user_prompt += f"\nFocus on {persona_context['cert_name']} certification exam topics."
    if challenges:
        user_prompt += "\n\nChallenges:\n"
        for c in challenges:
            user_prompt += f"- {c.get('title', '')}\n"
    
    result = await _chat_json([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ])
    
    content = result.get("content", "")
    word_count = len(content.split())
    
    return StudyNotes(
        title=result.get("title", scenario_title),
        summary=result.get("summary", ""),
        content=content,
        sections=[NotesSection(**s) for s in result.get("sections", [])],
        aws_services=result.get("aws_services", aws_services),
        estimated_read_time_minutes=max(1, word_count // 200),
        key_takeaways=result.get("key_takeaways", []),
    )


async def generate_service_deep_dive(
    service_name: str,
    user_level: str,
    cert_code: str,
    use_case: Optional[str] = None,
) -> StudyNotes:
    """
    Generate a deep-dive study guide for a specific AWS service.
    
    IMPORTANT: Both user_level and cert_code are REQUIRED.
    
    Args:
        service_name: AWS service name
        user_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        cert_code: Certification persona ID (REQUIRED)
        use_case: Optional specific use case
    
    Returns:
        StudyNotes tailored to cert and level
    
    Raises:
        NotesValidationError: If user_level or cert_code are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_notes_params(user_level, cert_code)
    
    # Get certification context
    if cert_code not in CERTIFICATION_PERSONAS:
        raise NotesValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    cert_name = persona["cert"]
    focus_areas = ", ".join(persona["focus"])
    
    system_prompt = f"""Create a comprehensive study guide for AWS {service_name}.

User Profile:
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {focus_areas}
{"Use Case: " + use_case if use_case else ""}

Focus on {cert_name} exam-relevant knowledge about {service_name}.

Return JSON with: title, summary, content (markdown), sections, aws_services, key_takeaways"""

    result = await _chat_json([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Generate deep-dive for AWS {service_name}"},
    ])
    
    content = result.get("content", "")
    
    return StudyNotes(
        title=result.get("title", f"AWS {service_name} Deep Dive"),
        summary=result.get("summary", ""),
        content=content,
        sections=[NotesSection(**s) for s in result.get("sections", [])],
        aws_services=result.get("aws_services", [service_name]),
        estimated_read_time_minutes=max(1, len(content.split()) // 200),
        key_takeaways=result.get("key_takeaways", []),
    )


async def generate_migration_guide(
    source_system: str,
    target_service: str,
    user_level: str,
    cert_code: str,
    constraints: Optional[List[str]] = None,
) -> StudyNotes:
    """
    Generate a migration-focused study guide.
    
    IMPORTANT: Both user_level and cert_code are REQUIRED.
    
    Args:
        source_system: Source system name
        target_service: Target AWS service
        user_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        cert_code: Certification persona ID (REQUIRED)
        constraints: Optional list of constraints
    
    Returns:
        StudyNotes tailored to cert and level
    
    Raises:
        NotesValidationError: If user_level or cert_code are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_notes_params(user_level, cert_code)
    
    # Get certification context
    if cert_code not in CERTIFICATION_PERSONAS:
        raise NotesValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    cert_name = persona["cert"]
    focus_areas = ", ".join(persona["focus"])
    
    system_prompt = f"""Create a migration study guide: {source_system} → AWS {target_service}

User Profile:
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {focus_areas}
{"Constraints: " + ", ".join(constraints) if constraints else ""}

Focus on {cert_name} exam-relevant migration patterns.

Return JSON with: title, summary, content (markdown), sections, aws_services, key_takeaways"""

    result = await _chat_json([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Generate migration guide: {source_system} to AWS {target_service}"},
    ])
    
    content = result.get("content", "")
    
    return StudyNotes(
        title=result.get("title", f"Migration: {source_system} → {target_service}"),
        summary=result.get("summary", ""),
        content=content,
        sections=[NotesSection(**s) for s in result.get("sections", [])],
        aws_services=result.get("aws_services", [target_service]),
        estimated_read_time_minutes=max(1, len(content.split()) // 200),
        key_takeaways=result.get("key_takeaways", []),
    )


async def generate_notes_for_certification(
    cert_code: str,
    user_level: str,
    telemetry: Optional[Dict] = None,
) -> Dict:
    """
    Generate study notes from certification + telemetry + skill level.
    
    IMPORTANT: Both cert_code and user_level are REQUIRED.
    
    Args:
        cert_code: Certification persona ID (REQUIRED, e.g., 'solutions-architect-associate')
        user_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        telemetry: Optional user progress telemetry
    
    Returns:
        Dict with study notes data
    
    Raises:
        NotesValidationError: If user_level or cert_code are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_notes_params(user_level, cert_code)
    import random
    
    # Get certification context (cert_code is now required and validated)
    if cert_code not in CERTIFICATION_PERSONAS:
        raise NotesValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    cert_name = persona["cert"]
    focus_areas = persona["focus"]
    
    # Build telemetry context
    telemetry_context = ""
    if telemetry:
        telemetry_context = f"""
User Progress:
- Skill Level: {telemetry.get('skillLevel', 'intermediate')}
- Challenges Completed: {telemetry.get('challengesCompleted', 0)}
- Scenarios Completed: {telemetry.get('scenariosCompleted', 0)}
- Total Points: {telemetry.get('totalPoints', 0)}
- Level: {telemetry.get('level', 1)}
"""
    
    selected_focus = random.sample(focus_areas, min(3, len(focus_areas)))
    
    # Use the existing PERSONA_NOTES_PROMPT
    base_prompt = PERSONA_NOTES_PROMPT.format(
        cert_name=cert_name,
        scenario_title=f"{cert_name} Practice",
        business_context="Certification exam preparation",
        aws_services=', '.join(selected_focus[:5]),
        focus_areas=', '.join(selected_focus),
        level=user_level,
    )
    
    system_prompt = f"""{base_prompt}
{telemetry_context}

Return a JSON object with these fields:
- title: A descriptive title for the study notes
- summary: A 2-3 sentence summary of what the notes cover
- content: The FULL study notes content in markdown format (at least 500 words with headers, bullet points, code examples where relevant)
- sections: Array of section objects with id, title, level, content, aws_services
- aws_services: Array of AWS service names covered
- key_takeaways: Array of 3-5 key points to remember

The content field MUST contain actual detailed study material, not placeholder text."""

    result = await _chat_json([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Generate study notes for {cert_name}"},
    ])
    
    if not result.get("title"):
        result["title"] = f"{cert_name} Study Notes"
    if not result.get("summary"):
        result["summary"] = f"AI-generated study notes for {cert_name} certification"
    
    return result


# ============================================
# "TOOL USES AI" PATTERN - AI is just a formatter
# ============================================

FORMAT_NOTES_PROMPT = """You are formatting study notes from pre-gathered AWS knowledge.

## IMPORTANT: Your Role
You are a FORMATTER, not a content creator. The knowledge below was extracted from real AWS documentation.
Your job is to:
1. Organize the knowledge into a coherent study guide
2. Structure with clear sections and headings
3. Highlight key takeaways for exam prep
4. Format in clean markdown

DO NOT invent facts. Use ONLY the knowledge provided below.

## Learner Context
- Target Certification: {certification}
- Certification Level: {cert_level}
- Skill Level: {skill_level}
- Scenario: {scenario_title}
- Business Context: {business_context}

## Technical Requirements
{technical_requirements}

## Compliance Requirements
{compliance_requirements}

## Challenges to Cover
{challenges_json}

## Pre-Gathered AWS Knowledge
{knowledge_chunks_json}

## AWS Services to Focus On
{aws_services}

## Output Format
Return JSON:
{{
  "title": "Study notes title based on scenario",
  "summary": "Executive summary (2-3 sentences) mentioning certification relevance",
  "content": "Full markdown content with ## headings, bullet points, code examples",
  "sections": [
    {{
      "id": "section-1",
      "title": "Section title",
      "level": 2,
      "content": "Section content in markdown",
      "aws_services": ["S3", "IAM"]
    }}
  ],
  "aws_services": ["S3", "EC2", "IAM"],
  "key_takeaways": [
    "Key point 1 for exam prep",
    "Key point 2 for exam prep",
    "Key point 3 for exam prep"
  ]
}}

## Guidelines
1. Create 4-6 logical sections based on the knowledge
2. Include practical examples where the knowledge supports it
3. Highlight exam-relevant concepts for {certification}
4. Add "Pro Tips" or "Exam Notes" callouts where appropriate
5. Keep language appropriate for {skill_level} level

Output ONLY valid JSON."""


async def format_notes(
    structured_content: NotesStructuredContent,
    *,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> StudyNotes:
    """
    FORMAT study notes from pre-gathered knowledge.
    
    The tool has already:
    - Fetched relevant knowledge from the database
    - Gathered technical and compliance requirements
    - Identified challenges to cover
    
    AI just organizes and formats the knowledge into readable notes.
    """
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required for notes formatting.")
    
    model_name = model or get_request_model() or DEFAULT_MODEL
    
    # Format challenges for prompt
    challenges_text = "\n".join(
        f"- {c.get('title', '')}: {c.get('description', '')}"
        for c in structured_content.challenges
    ) if structured_content.challenges else "None specified"
    
    # Build the prompt with pre-gathered content
    prompt = FORMAT_NOTES_PROMPT.format(
        certification=structured_content.certification,
        cert_level=structured_content.cert_level,
        skill_level=structured_content.skill_level,
        scenario_title=structured_content.scenario_title,
        business_context=structured_content.business_context,
        technical_requirements="\n".join(f"- {r}" for r in structured_content.technical_requirements) or "None specified",
        compliance_requirements="\n".join(f"- {r}" for r in structured_content.compliance_requirements) or "None specified",
        challenges_json=challenges_text,
        knowledge_chunks_json=json.dumps(structured_content.knowledge_chunks, indent=2),
        aws_services=", ".join(structured_content.aws_services),
    )
    
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Format the study notes now. Use ONLY the provided knowledge."},
    ]
    
    client = AsyncOpenAI(api_key=key)
    response = await client.chat.completions.create(
        model=model_name,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.3,  # Lower temperature for consistent formatting
    )
    
    content_str = response.choices[0].message.content
    
    try:
        result = json.loads(content_str)
    except json.JSONDecodeError as err:
        logger.error("Notes format JSON parse failure: %s", err)
        raise ValueError("AI returned invalid notes JSON") from err
    
    # Validate and create notes
    content = result.get("content", "")
    sections = validate_and_fix_sections(result.get("sections", []), structured_content)
    
    return StudyNotes(
        title=result.get("title", f"Study Notes: {structured_content.scenario_title}"),
        summary=result.get("summary", f"Study guide for {structured_content.certification}"),
        content=content,
        sections=sections,
        aws_services=result.get("aws_services", structured_content.aws_services),
        estimated_read_time_minutes=max(1, len(content.split()) // 200),
        key_takeaways=result.get("key_takeaways", [])[:5],  # Limit to 5 takeaways
    )


def validate_and_fix_sections(
    ai_sections: List[Dict],
    content: NotesStructuredContent
) -> List[NotesSection]:
    """Ensure AI didn't hallucinate or create invalid sections."""
    
    sections = []
    
    for idx, s_data in enumerate(ai_sections):
        try:
            section = NotesSection(
                id=s_data.get("id", f"section-{idx+1}"),
                title=s_data.get("title", f"Section {idx+1}"),
                level=s_data.get("level", 2),
                content=s_data.get("content", ""),
                aws_services=s_data.get("aws_services", []),
            )
            
            # Validate level
            if section.level < 1 or section.level > 4:
                section.level = 2
            
            # Ensure aws_services are from our list
            section.aws_services = [
                s for s in section.aws_services 
                if s in content.aws_services or s.upper() in [svc.upper() for svc in content.aws_services]
            ]
            
            sections.append(section)
        except Exception as e:
            logger.warning(f"Invalid section data, skipping: {e}")
            continue
    
    return sections


def extract_notes_content_from_knowledge(
    knowledge_chunks: List[Dict],
    aws_services: List[str],
    max_chunks: int = 20
) -> List[Dict[str, str]]:
    """
    Extract and organize content from knowledge chunks for study notes.
    Tool does this deterministically - no AI needed.
    """
    organized_content = []
    seen_topics = set()
    
    for chunk in knowledge_chunks:
        content = chunk.get("content", "")
        url = chunk.get("url", "")
        
        # Skip very short chunks
        if len(content) < 100:
            continue
        
        # Check which services are mentioned
        mentioned_services = [
            svc for svc in aws_services
            if svc.lower() in content.lower() or svc.upper() in content
        ]
        
        topic = mentioned_services[0] if mentioned_services else "AWS General"
        
        # Avoid too much content on same topic
        topic_count = sum(1 for c in organized_content if c.get("topic") == topic)
        if topic_count >= 3:
            continue
        
        organized_content.append({
            "topic": topic,
            "content": content[:1500],  # Limit content length
            "source": url,
            "services": mentioned_services,
        })
        
        if len(organized_content) >= max_chunks:
            break
    
    return organized_content


def determine_notes_structure(
    aws_services: List[str],
    certification: str,
    challenges: List[Dict]
) -> List[str]:
    """
    Determine the section structure for notes.
    Tool decides this - no AI needed.
    """
    sections = ["Overview"]
    
    # Add sections for key services (up to 4)
    for service in aws_services[:4]:
        sections.append(f"{service} Deep Dive")
    
    # Add architecture section if multiple services
    if len(aws_services) > 2:
        sections.append("Architecture Patterns")
    
    # Add certification-specific section
    sections.append(f"{certification} Exam Tips")
    
    # Add challenges section if any
    if challenges:
        sections.append("Challenge Walkthrough")
    
    sections.append("Key Takeaways")
    
    return sections
