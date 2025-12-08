"""
Study Plan Generator
====================
Produces SMART, timeline-driven study plans grounded in learner telemetry.
"""

from __future__ import annotations

import json
from typing import List, Optional, Dict, Any

from openai import AsyncOpenAI
from pydantic import BaseModel

from config.settings import logger
from prompts import STUDY_PLAN_GENERATOR_PROMPT
from utils import (
    ApiKeyRequiredError,
    get_request_api_key,
    get_request_model,
)

DEFAULT_STUDY_PLAN_MODEL = "gpt-4o-mini"


class StudyPlanContext(BaseModel):
    """Inputs required to generate a personalized study plan."""

    target_exam: Optional[str] = None
    time_horizon: str
    study_hours_per_week: int
    confidence_level: str
    weak_areas: List[str] = []
    focus_domains: List[str] = []
    preferred_formats: List[str] = []
    learner_notes: Optional[str] = None
    telemetry_summary: str


async def generate_study_plan(
    context: StudyPlanContext,
    *,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate a SMART study plan leveraging OpenAI.

    Returns a JSON-serializable dict ready to persist in StudyPlan.planOutput.
    """

    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required for study plan generation.")

    model_name = model or get_request_model() or DEFAULT_STUDY_PLAN_MODEL

    prompt = STUDY_PLAN_GENERATOR_PROMPT.format(
        target_exam=context.target_exam or "Not specified",
        time_horizon=context.time_horizon,
        study_hours_per_week=context.study_hours_per_week,
        confidence_level=context.confidence_level,
        weak_areas=", ".join(context.weak_areas) if context.weak_areas else "Not specified",
        focus_domains=", ".join(context.focus_domains) if context.focus_domains else "Not specified",
        preferred_formats=", ".join(context.preferred_formats) if context.preferred_formats else "Not specified",
        learner_notes=context.learner_notes or "None provided",
        telemetry_summary=context.telemetry_summary or "No telemetry available",
    )

    messages = [
        {"role": "system", "content": prompt},
        {
            "role": "user",
            "content": "Create the SMART study plan JSON now. Do not include any prose outside JSON.",
        },
    ]

    client = AsyncOpenAI(api_key=key)

    response = await client.chat.completions.create(
        model=model_name,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    content = response.choices[0].message.content

    try:
        plan = json.loads(content)
    except json.JSONDecodeError as err:
        logger.error("Study plan JSON parse failure: %s", err)
        raise ValueError("Agent returned invalid study plan JSON") from err

    return plan
