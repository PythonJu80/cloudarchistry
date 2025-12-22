"""
OpenAI service helpers.
"""
import json
from typing import List, Dict, Optional
from config.openai_config import get_async_openai
from prompts import SKILL_DETECTOR_PROMPT

# System default model for learning agent - hardcoded to ensure consistency
# Users pay monthly subscription, so we control the model used
SYSTEM_DEFAULT_MODEL = "gpt-4.1"


async def async_chat_completion(
    messages: List[Dict[str, str]],
    model: str = "gpt-4.1",
    temperature: float = 0.9,
    response_format: Optional[Dict] = None,
    api_key: Optional[str] = None,
) -> str:
    """
    Async chat completion wrapper.
    
    Note: Model is hardcoded to gpt-4.1 by default.
    This ensures all learning agent operations use the platform's chosen model.
    User preferred models are ignored for consistency.
    """
    client = get_async_openai(api_key)
    
    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format:
        kwargs["response_format"] = response_format
    
    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content


async def async_chat_completion_json(
    messages: List[Dict[str, str]],
    model: str = "gpt-4.1",
    temperature: float = 0.9,
    api_key: Optional[str] = None,
) -> Dict:
    """
    Chat completion that returns JSON.
    
    Note: Model is hardcoded to gpt-4.1 by default.
    """
    content = await async_chat_completion(
        messages=messages,
        model=model,
        temperature=temperature,
        response_format={"type": "json_object"},
        api_key=api_key,
    )
    return json.loads(content)


async def detect_skill_level(message: str, api_key: Optional[str] = None) -> str:
    """
    Detect user's skill level from their message.
    
    Uses SYSTEM_DEFAULT_MODEL (gpt-4.1) for consistency.
    """
    try:
        response = await async_chat_completion(
            messages=[
                {"role": "system", "content": SKILL_DETECTOR_PROMPT},
                {"role": "user", "content": message},
            ],
            model=SYSTEM_DEFAULT_MODEL,
            temperature=0.3,
            api_key=api_key,
        )
        level = response.strip().lower()
        if level in ["beginner", "intermediate", "advanced", "expert"]:
            return level
        return "intermediate"
    except Exception:
        return "intermediate"
