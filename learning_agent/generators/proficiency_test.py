"""
Proficiency Test Generator Module
==================================
Generates and conducts agent-led proficiency conversations where users
explain their architectural decisions. The agent has full context of the
user's diagram, question answers, and challenge brief.

This is NOT like multiple choice questions - the user must EXPLAIN their work.
"""

import json
import os
import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from openai import AsyncOpenAI

from utils import get_request_model, ApiKeyRequiredError, DEFAULT_MODEL


# =============================================================================
# DATA MODELS
# =============================================================================

class ChatMessage(BaseModel):
    """A single message in the proficiency test conversation."""
    role: str  # 'user' | 'assistant'
    content: str
    timestamp: str


class DiagramAuditResult(BaseModel):
    """Results from the diagram audit."""
    score: int
    correct: List[str] = []  # Services correctly placed
    missing: List[str] = []  # Services that should have been included
    suggestions: List[str] = []  # Improvement suggestions
    feedback: str = ""  # Overall feedback


class ProficiencyTestContext(BaseModel):
    """Full context the agent has access to during the proficiency test."""
    challenge_id: str
    challenge_title: str
    challenge_description: str
    challenge_brief: str
    success_criteria: List[str]
    aws_services: List[str]
    
    # User's work
    diagram_data: Optional[Dict[str, Any]] = None  # {nodes: [], edges: []}
    diagram_services: List[str] = []  # Services user placed in diagram
    diagram_audit: Optional[DiagramAuditResult] = None  # Full audit results
    diagram_score: Optional[Dict[str, Any]] = None  # Placement score breakdown
    question_answers: Optional[List[Dict]] = None  # User's answers with full question data
    
    # Business context
    company_name: str
    industry: str
    business_context: str
    
    # User context
    user_level: str = "intermediate"
    cert_code: Optional[str] = None
    
    # Previous general chat history (before proficiency test started)
    previous_chat_history: Optional[List[Dict[str, str]]] = None


class ProficiencyQuestion(BaseModel):
    """A probing question the agent will ask."""
    id: str
    question: str
    focus_area: str  # 'architecture', 'security', 'cost', 'scalability', 'compliance'
    related_services: List[str]
    expected_concepts: List[str]  # Concepts a good answer should mention


class ProficiencyTestResult(BaseModel):
    """Final result of the proficiency test."""
    test_id: str
    challenge_id: str
    chat_history: List[ChatMessage]
    questions_asked: List[str]
    score: int  # 0-100
    summary: str
    strengths: List[str]
    areas_for_improvement: List[str]
    completed_at: str


# =============================================================================
# PROMPTS
# =============================================================================

PROFICIENCY_SYSTEM_PROMPT = """You are Sophia, an AWS Solutions Architect conducting a proficiency assessment.

Your role is to verify the user truly understands their architectural decisions - they could have guessed or cheated on the questions, so you need to probe their actual understanding.

You have FULL CONTEXT of:
- The challenge they completed
- Their architecture diagram (what services they placed, what's correct, what's missing)
- The diagram audit score and feedback
- Their answers to the challenge questions (which they got right/wrong and what they chose)
- The business requirements

YOUR APPROACH:
1. Reference their SPECIFIC work - mention the exact questions they answered and services they placed
2. Ask WHY they made those specific choices - "You answered X for the question about Y - explain your reasoning"
3. Probe deeper on questions they got WRONG - they need to demonstrate they now understand
4. Ask about services they placed in the diagram - why those specific ones?
5. If they got things wrong or missing in the audit, ask about those gaps
6. After 4-6 exchanges, evaluate their proficiency

QUESTION TYPES TO ASK:
- "For the question about {topic}, you chose {their_answer}. Walk me through your reasoning."
- "I see you placed {service} in your architecture. What role does it play in meeting the {requirement}?"
- "The audit noted {missing_service} was missing. Why didn't you include it, or would you add it now?"
- "You got the question about {topic} wrong - the correct answer was {correct}. Can you explain the difference?"
- "How does your design handle {failure scenario} given the services you've placed?"

DO NOT:
- Ask generic questions unrelated to their actual work
- Give away answers
- Be condescending
- Rush through the conversation

BE:
- Specific - always reference their actual answers and diagram
- Thorough - verify they understand, not just memorized
- Encouraging when they show good understanding
- Probing when explanations are vague or incorrect
"""

PROFICIENCY_START_PROMPT = """CHALLENGE CONTEXT:
Title: {challenge_title}
Description: {challenge_description}
Business: {company_name} ({industry})
Business Context: {business_context}
Success Criteria: {success_criteria}
Required AWS Services: {aws_services}

USER'S DIAGRAM:
Services placed: {diagram_services}
Architecture structure: {diagram_structure}

DIAGRAM AUDIT RESULTS:
{diagram_audit_summary}

USER'S QUESTION ANSWERS (what they chose and whether correct):
{question_details}

USER LEVEL: {user_level}

PREVIOUS CHAT HISTORY (user's questions/discussion before this test):
{previous_chat_summary}

Start the proficiency conversation by:
1. Briefly acknowledge their work (diagram score, questions answered)
2. Pick ONE specific thing to probe first - either a question they answered (right or wrong) or a service they placed
3. Ask them to EXPLAIN their reasoning for that specific choice

Be specific - reference the actual question text or service name. Do not ask generic questions."""

PROFICIENCY_CONTINUE_PROMPT = """Continue the proficiency conversation based on the user's response.

CONTEXT (for reference):
- Challenge: {challenge_title}
- Company: {company_name}
- Their services: {diagram_services}

CONVERSATION SO FAR:
{chat_history}

USER'S LATEST RESPONSE:
{user_message}

QUESTIONS ASKED SO FAR: {questions_count}
TARGET: 4-6 probing questions before evaluation

Based on their response:
1. If they showed good understanding, acknowledge it briefly and move to the next topic
2. If they were unclear, ask a clarifying follow-up
3. If they missed key concepts, gently probe deeper

Ask your next question OR if you've asked enough (4-6 questions), indicate you're ready to evaluate by saying "Thank you for explaining your decisions. Let me provide you with your proficiency assessment..."
"""

PROFICIENCY_EVALUATE_PROMPT = """Evaluate the user's proficiency based on this conversation.

CHALLENGE CONTEXT:
Title: {challenge_title}
Company: {company_name} ({industry})
Required Services: {aws_services}
Success Criteria: {success_criteria}

USER'S ARCHITECTURE:
Services: {diagram_services}

FULL CONVERSATION:
{chat_history}

Evaluate their proficiency on a scale of 0-100 based on:
- Technical accuracy of their explanations (30%)
- Understanding of AWS service capabilities (25%)
- Ability to justify architectural decisions (25%)
- Awareness of trade-offs and best practices (20%)

Return JSON with:
{{
  "score": <0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", ...],
  "areas_for_improvement": ["<specific area 1>", "<specific area 2>", ...],
  "key_concepts_demonstrated": ["<concept 1>", "<concept 2>", ...],
  "recommendation": "<brief recommendation for next steps>"
}}

Be fair but thorough. A score of 70+ indicates solid understanding.
"""


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _extract_diagram_services(diagram_data: Optional[Dict]) -> List[str]:
    """Extract service names from diagram nodes."""
    if not diagram_data or not diagram_data.get("nodes"):
        return []
    
    services = []
    for node in diagram_data.get("nodes", []):
        node_type = node.get("type", "")
        if node_type not in ["vpc", "subnet", "availabilityZone"]:
            label = node.get("data", {}).get("label", "")
            if label and label not in services:
                services.append(label)
    return services


def _describe_diagram_structure(diagram_data: Optional[Dict]) -> str:
    """Create a text description of the diagram structure."""
    if not diagram_data or not diagram_data.get("nodes"):
        return "No diagram provided"
    
    nodes = diagram_data.get("nodes", [])
    edges = diagram_data.get("edges", [])
    
    # Count by type
    vpcs = [n for n in nodes if n.get("type") == "vpc"]
    subnets = [n for n in nodes if n.get("type") == "subnet"]
    services = [n for n in nodes if n.get("type") not in ["vpc", "subnet", "availabilityZone"]]
    
    # Identify subnet types
    public_subnets = [s for s in subnets if s.get("data", {}).get("subnetType") == "public"]
    private_subnets = [s for s in subnets if s.get("data", {}).get("subnetType") == "private"]
    
    description = f"{len(vpcs)} VPC(s), {len(public_subnets)} public subnet(s), {len(private_subnets)} private subnet(s), {len(services)} service(s), {len(edges)} connection(s)"
    
    return description


def _summarize_question_answers(answers: Optional[List[Dict]]) -> str:
    """Summarize user's question performance - just the count."""
    if not answers:
        return "No question data available"
    
    correct = sum(1 for a in answers if a.get("isCorrect", False))
    total = len(answers)
    
    return f"Answered {correct}/{total} questions correctly"


def _format_question_details(answers: Optional[List[Dict]]) -> str:
    """Format detailed question answers for the proficiency prompt."""
    if not answers:
        return "No question data available"
    
    details = []
    for i, ans in enumerate(answers, 1):
        question_text = ans.get("questionText", "Unknown question")
        user_answer = ans.get("userAnswer", "No answer")
        correct_answer = ans.get("correctAnswer", "Unknown")
        is_correct = ans.get("isCorrect", False)
        aws_services = ans.get("awsServices", [])
        
        status = "✓ CORRECT" if is_correct else "✗ WRONG"
        services_str = f" [Related: {', '.join(aws_services)}]" if aws_services else ""
        
        detail = f"Q{i}: {question_text}\n   User chose: \"{user_answer}\" {status}"
        if not is_correct:
            detail += f"\n   Correct answer was: \"{correct_answer}\""
        detail += services_str
        details.append(detail)
    
    return "\n\n".join(details)


def _format_diagram_audit(audit: Optional[Dict]) -> str:
    """Format diagram audit results for the proficiency prompt."""
    if not audit:
        return "No diagram audit performed yet"
    
    score = audit.get("score", 0)
    correct = audit.get("correct", [])
    missing = audit.get("missing", [])
    suggestions = audit.get("suggestions", [])
    feedback = audit.get("feedback", "")
    
    parts = [f"Score: {score}/100"]
    
    if correct:
        parts.append(f"Correctly placed: {', '.join(correct)}")
    if missing:
        parts.append(f"Missing services: {', '.join(missing)}")
    if suggestions:
        parts.append(f"Suggestions: {'; '.join(suggestions)}")
    if feedback:
        parts.append(f"Feedback: {feedback}")
    
    return "\n".join(parts)


def _format_chat_history(messages: List[ChatMessage]) -> str:
    """Format chat history for prompt."""
    if not messages:
        return "No messages yet"
    
    formatted = []
    for msg in messages:
        role = "User" if msg.role == "user" else "Sophia"
        formatted.append(f"{role}: {msg.content}")
    
    return "\n\n".join(formatted)


async def _chat_completion(
    messages: List[Dict],
    model: Optional[str] = None,
    json_mode: bool = False,
    temperature: float = 0.7,
) -> str:
    """Get chat completion from OpenAI."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required")
    
    model = model or get_request_model() or DEFAULT_MODEL
    client = AsyncOpenAI(api_key=key)
    
    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    
    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content


# =============================================================================
# MAIN FUNCTIONS
# =============================================================================

async def start_proficiency_test(
    context: ProficiencyTestContext,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Start a proficiency test conversation.
    
    The agent analyzes the user's work and initiates a conversation
    asking them to explain their architectural decisions.
    
    Args:
        context: Full context including diagram, answers, challenge info
        model: Optional model override
    
    Returns:
        Dict with test_id, initial_message, and context summary
    """
    test_id = str(uuid.uuid4())
    
    # Extract info from diagram
    diagram_services = context.diagram_services or _extract_diagram_services(context.diagram_data)
    diagram_structure = _describe_diagram_structure(context.diagram_data)
    
    # Format detailed question answers (not just summary)
    question_details = _format_question_details(context.question_answers)
    
    # Format diagram audit results
    diagram_audit_dict = None
    if context.diagram_audit:
        diagram_audit_dict = context.diagram_audit.model_dump() if hasattr(context.diagram_audit, 'model_dump') else context.diagram_audit
    diagram_audit_summary = _format_diagram_audit(diagram_audit_dict)
    
    # Summarize previous chat history if any
    previous_chat_summary = "No previous chat"
    if context.previous_chat_history:
        prev_msgs = []
        for msg in context.previous_chat_history:
            role = "User" if msg.get("role") == "user" else "Sophia"
            prev_msgs.append(f"{role}: {msg.get('content', '')}")
        previous_chat_summary = "\n".join(prev_msgs) if prev_msgs else "No previous chat"
    
    # Build the start prompt
    user_prompt = PROFICIENCY_START_PROMPT.format(
        challenge_title=context.challenge_title,
        challenge_description=context.challenge_description,
        company_name=context.company_name,
        industry=context.industry,
        business_context=context.business_context,
        success_criteria=", ".join(context.success_criteria),
        aws_services=", ".join(context.aws_services),
        diagram_services=", ".join(diagram_services) if diagram_services else "None placed yet",
        diagram_structure=diagram_structure,
        diagram_audit_summary=diagram_audit_summary,
        question_details=question_details,
        user_level=context.user_level,
        previous_chat_summary=previous_chat_summary,
    )
    
    messages = [
        {"role": "system", "content": PROFICIENCY_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    
    # Get initial message from agent
    initial_message = await _chat_completion(messages, model=model)
    
    return {
        "test_id": test_id,
        "initial_message": initial_message,
        "context_summary": {
            "diagram_services": diagram_services,
            "diagram_structure": diagram_structure,
            "question_summary": question_summary,
        },
        "questions_asked": 1,  # First question is in initial message
    }


async def continue_proficiency_test(
    context: ProficiencyTestContext,
    chat_history: List[ChatMessage],
    user_message: str,
    questions_asked: int = 1,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Continue the proficiency test conversation.
    
    Args:
        context: Full context
        chat_history: Previous messages
        user_message: User's latest response
        questions_asked: Number of probing questions asked so far
        model: Optional model override
    
    Returns:
        Dict with agent_response, questions_asked, and ready_to_evaluate flag
    """
    diagram_services = context.diagram_services or _extract_diagram_services(context.diagram_data)
    
    # Build continue prompt
    user_prompt = PROFICIENCY_CONTINUE_PROMPT.format(
        challenge_title=context.challenge_title,
        company_name=context.company_name,
        diagram_services=", ".join(diagram_services) if diagram_services else "None",
        chat_history=_format_chat_history(chat_history),
        user_message=user_message,
        questions_count=questions_asked,
    )
    
    messages = [
        {"role": "system", "content": PROFICIENCY_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    
    # Get response
    agent_response = await _chat_completion(messages, model=model)
    
    # Check if agent is ready to evaluate
    ready_to_evaluate = "proficiency assessment" in agent_response.lower() or questions_asked >= 5
    
    return {
        "agent_response": agent_response,
        "questions_asked": questions_asked + 1,
        "ready_to_evaluate": ready_to_evaluate,
    }


async def evaluate_proficiency_test(
    context: ProficiencyTestContext,
    chat_history: List[ChatMessage],
    model: Optional[str] = None,
) -> ProficiencyTestResult:
    """
    Evaluate the proficiency test and generate final score/summary.
    
    Args:
        context: Full context
        chat_history: Complete conversation history
        model: Optional model override
    
    Returns:
        ProficiencyTestResult with score, summary, strengths, areas for improvement
    """
    from datetime import datetime, timezone
    
    diagram_services = context.diagram_services or _extract_diagram_services(context.diagram_data)
    
    # Build evaluation prompt
    user_prompt = PROFICIENCY_EVALUATE_PROMPT.format(
        challenge_title=context.challenge_title,
        company_name=context.company_name,
        industry=context.industry,
        aws_services=", ".join(context.aws_services),
        success_criteria=", ".join(context.success_criteria),
        diagram_services=", ".join(diagram_services) if diagram_services else "None",
        chat_history=_format_chat_history(chat_history),
    )
    
    messages = [
        {"role": "system", "content": "You are evaluating a cloud architecture proficiency test. Return only valid JSON."},
        {"role": "user", "content": user_prompt},
    ]
    
    # Get evaluation
    response = await _chat_completion(messages, model=model, json_mode=True, temperature=0.3)
    evaluation = json.loads(response)
    
    # Extract questions asked from chat history
    questions_asked = []
    for msg in chat_history:
        if msg.role == "assistant" and "?" in msg.content:
            # Extract questions from agent messages
            questions_asked.append(msg.content[:200])  # First 200 chars
    
    return ProficiencyTestResult(
        test_id=str(uuid.uuid4()),
        challenge_id=context.challenge_id,
        chat_history=chat_history,
        questions_asked=questions_asked,
        score=evaluation.get("score", 0),
        summary=evaluation.get("summary", ""),
        strengths=evaluation.get("strengths", []),
        areas_for_improvement=evaluation.get("areas_for_improvement", []),
        completed_at=datetime.now(timezone.utc).isoformat(),
    )
