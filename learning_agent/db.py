"""
Database Integration for Learning Agent
========================================
Connects to PostgreSQL via asyncpg for storing scenarios, progress, and learning content.
"""

import os
import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import asyncpg

logger = logging.getLogger("cloud-academy-db")

# Database connection pool
_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """Get or create database connection pool."""
    global _pool
    if _pool is None:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise ValueError("DATABASE_URL not set")
        
        # Convert prisma-style URL to asyncpg format if needed
        if database_url.startswith("postgresql://"):
            database_url = database_url
        
        _pool = await asyncpg.create_pool(
            database_url,
            min_size=2,
            max_size=10,
        )
        logger.info("Database pool created")
    return _pool


async def close_pool():
    """Close database connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("Database pool closed")


# =============================================================================
# SCENARIOS
# =============================================================================

async def save_scenario(
    location_id: str,
    scenario_data: dict,
    company_info: Optional[dict] = None,
    generated_by: str = "learning_agent",
) -> str:
    """Save a generated scenario to the database."""
    pool = await get_pool()
    
    scenario_id = scenario_data.get("id")
    
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO "AcademyScenario" (
                id, "locationId", title, description, "businessContext",
                difficulty, "technicalRequirements", "complianceRequirements",
                constraints, "learningObjectives", tags, "estimatedMinutes",
                "maxPoints", "targetLevel", "companyInfo", "generatedBy",
                "isActive", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                "updatedAt" = NOW()
        """,
            scenario_id,
            location_id,
            scenario_data.get("scenario_title", ""),
            scenario_data.get("scenario_description", ""),
            scenario_data.get("business_context", ""),
            scenario_data.get("difficulty", "intermediate"),
            json.dumps(scenario_data.get("technical_requirements", [])),
            json.dumps(scenario_data.get("compliance_requirements", [])),
            json.dumps(scenario_data.get("constraints", [])),
            json.dumps(scenario_data.get("learning_objectives", [])),
            json.dumps(scenario_data.get("tags", [])),
            scenario_data.get("estimated_total_time_minutes", 60),
            sum(c.get("points", 100) for c in scenario_data.get("challenges", [])),
            scenario_data.get("difficulty", "intermediate"),
            json.dumps(company_info) if company_info else None,
            generated_by,
            True,
            datetime.now(timezone.utc),
        )
        
        # Save challenges
        for idx, challenge in enumerate(scenario_data.get("challenges", [])):
            await conn.execute("""
                INSERT INTO "AcademyChallenge" (
                    id, "scenarioId", title, description, difficulty,
                    "orderIndex", points, "bonusPoints", hints,
                    "successCriteria", "awsServices", "estimatedMinutes",
                    "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    "updatedAt" = NOW()
            """,
                challenge.get("id"),
                scenario_id,
                challenge.get("title", ""),
                challenge.get("description", ""),
                challenge.get("difficulty", "intermediate"),
                idx,
                challenge.get("points", 100),
                0,
                json.dumps(challenge.get("hints", [])),
                json.dumps(challenge.get("success_criteria", [])),
                json.dumps(challenge.get("aws_services_relevant", [])),
                challenge.get("estimated_time_minutes", 15),
                datetime.now(timezone.utc),
            )
    
    logger.info(f"Saved scenario {scenario_id} with {len(scenario_data.get('challenges', []))} challenges")
    return scenario_id


async def get_scenario(scenario_id: str) -> Optional[dict]:
    """Get a scenario by ID."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM "AcademyScenario" WHERE id = $1
        """, scenario_id)
        
        if not row:
            return None
        
        # Get challenges
        challenges = await conn.fetch("""
            SELECT * FROM "AcademyChallenge" 
            WHERE "scenarioId" = $1 
            ORDER BY "orderIndex"
        """, scenario_id)
        
        return {
            "id": row["id"],
            "scenario_title": row["title"],
            "scenario_description": row["description"],
            "business_context": row["businessContext"],
            "difficulty": row["difficulty"],
            "technical_requirements": json.loads(row["technicalRequirements"]) if row["technicalRequirements"] else [],
            "compliance_requirements": json.loads(row["complianceRequirements"]) if row["complianceRequirements"] else [],
            "constraints": json.loads(row["constraints"]) if row["constraints"] else [],
            "learning_objectives": json.loads(row["learningObjectives"]) if row["learningObjectives"] else [],
            "tags": json.loads(row["tags"]) if row["tags"] else [],
            "company_info": json.loads(row["companyInfo"]) if row["companyInfo"] else None,
            "challenges": [
                {
                    "id": c["id"],
                    "title": c["title"],
                    "description": c["description"],
                    "difficulty": c["difficulty"],
                    "points": c["points"],
                    "hints": json.loads(c["hints"]) if c["hints"] else [],
                    "success_criteria": json.loads(c["successCriteria"]) if c["successCriteria"] else [],
                    "aws_services_relevant": json.loads(c["awsServices"]) if c["awsServices"] else [],
                }
                for c in challenges
            ],
        }


# =============================================================================
# FLASHCARDS
# =============================================================================

async def save_flashcard_deck(
    deck_data: dict,
    generated_by: str = "ai",
    scenario_id: str = None,
    profile_id: str = None,
    certification_code: str = None,
    deck_type: str = "certification",
) -> str:
    """Save a flashcard deck - supports both scenario-based and certification-based."""
    pool = await get_pool()
    
    import uuid
    deck_id = str(uuid.uuid4())
    
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO "FlashcardDeck" (
                id, "scenarioId", "profileId", "certificationCode", "deckType",
                title, description, "generatedBy",
                "totalCards", "isActive", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
        """,
            deck_id,
            scenario_id,
            profile_id,
            certification_code,
            deck_type,
            deck_data.get("title", "Flashcards"),
            deck_data.get("description", ""),
            generated_by,
            len(deck_data.get("cards", [])),
            True,
            datetime.now(timezone.utc),
        )
        
        # Save cards
        for idx, card in enumerate(deck_data.get("cards", [])):
            card_id = str(uuid.uuid4())
            await conn.execute("""
                INSERT INTO "Flashcard" (
                    id, "deckId", front, back, "frontType", "backType",
                    tags, difficulty, "awsServices", "orderIndex", "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
            """,
                card_id,
                deck_id,
                card.get("front", ""),
                card.get("back", ""),
                "text",
                "text",
                json.dumps(card.get("tags", [])),
                card.get("difficulty", "medium"),
                json.dumps(card.get("aws_services", [])),
                idx,
                datetime.now(timezone.utc),
            )
    
    logger.info(f"Saved flashcard deck {deck_id} with {len(deck_data.get('cards', []))} cards")
    return deck_id


async def get_flashcard_deck(deck_id: str) -> Optional[dict]:
    """Get a flashcard deck with all cards."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM "FlashcardDeck" WHERE id = $1
        """, deck_id)
        
        if not row:
            return None
        
        cards = await conn.fetch("""
            SELECT * FROM "Flashcard" 
            WHERE "deckId" = $1 
            ORDER BY "orderIndex"
        """, deck_id)
        
        return {
            "id": row["id"],
            "scenario_id": row["scenarioId"],
            "title": row["title"],
            "description": row["description"],
            "total_cards": row["totalCards"],
            "cards": [
                {
                    "id": c["id"],
                    "front": c["front"],
                    "back": c["back"],
                    "difficulty": c["difficulty"],
                    "aws_services": json.loads(c["awsServices"]) if c["awsServices"] else [],
                    "tags": json.loads(c["tags"]) if c["tags"] else [],
                }
                for c in cards
            ],
        }


async def get_flashcard_decks_for_scenario(scenario_id: str) -> List[dict]:
    """Get all flashcard decks for a scenario."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, title, description, "totalCards", "createdAt"
            FROM "FlashcardDeck" 
            WHERE "scenarioId" = $1 AND "isActive" = true
            ORDER BY "createdAt" DESC
        """, scenario_id)
        
        return [
            {
                "id": row["id"],
                "title": row["title"],
                "description": row["description"],
                "total_cards": row["totalCards"],
                "created_at": row["createdAt"].isoformat(),
            }
            for row in rows
        ]


async def get_user_flashcard_progress(profile_id: str, deck_id: str) -> Optional[dict]:
    """Get user's progress on a flashcard deck."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM "FlashcardUserProgress" 
            WHERE "profileId" = $1 AND "deckId" = $2
        """, profile_id, deck_id)
        
        if not row:
            return None
        
        # Get individual card progress
        card_progress = await conn.fetch("""
            SELECT fp.*, f.front, f.back, f.difficulty
            FROM "FlashcardProgress" fp
            JOIN "Flashcard" f ON fp."cardId" = f.id
            WHERE fp."userProgressId" = $1
            ORDER BY fp."nextReviewAt" ASC NULLS LAST
        """, row["id"])
        
        return {
            "id": row["id"],
            "cards_studied": row["cardsStudied"],
            "cards_mastered": row["cardsMastered"],
            "total_reviews": row["totalReviews"],
            "current_streak": row["currentStreak"],
            "last_studied_at": row["lastStudiedAt"].isoformat() if row["lastStudiedAt"] else None,
            "card_progress": [
                {
                    "card_id": cp["cardId"],
                    "front": cp["front"],
                    "status": cp["status"],
                    "ease_factor": cp["easeFactor"],
                    "interval": cp["interval"],
                    "next_review_at": cp["nextReviewAt"].isoformat() if cp["nextReviewAt"] else None,
                    "total_reviews": cp["totalReviews"],
                    "correct_count": cp["correctCount"],
                }
                for cp in card_progress
            ],
        }


async def update_flashcard_progress(
    profile_id: str,
    deck_id: str,
    card_id: str,
    quality: int,  # 0-5 (SM-2 algorithm: 0=complete blackout, 5=perfect)
) -> dict:
    """Update spaced repetition progress for a flashcard."""
    pool = await get_pool()
    import uuid
    from datetime import timedelta
    
    async with pool.acquire() as conn:
        # Get or create user progress
        user_progress = await conn.fetchrow("""
            SELECT * FROM "FlashcardUserProgress" 
            WHERE "profileId" = $1 AND "deckId" = $2
        """, profile_id, deck_id)
        
        if not user_progress:
            progress_id = str(uuid.uuid4())
            await conn.execute("""
                INSERT INTO "FlashcardUserProgress" (
                    id, "profileId", "deckId", "cardsStudied", "cardsMastered",
                    "totalReviews", "lastStudiedAt", "currentStreak", "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, 0, 0, 0, NOW(), 0, NOW(), NOW())
            """, progress_id, profile_id, deck_id)
        else:
            progress_id = user_progress["id"]
        
        # Get or create card progress
        card_progress = await conn.fetchrow("""
            SELECT * FROM "FlashcardProgress" 
            WHERE "userProgressId" = $1 AND "cardId" = $2
        """, progress_id, card_id)
        
        now = datetime.now(timezone.utc)
        
        if not card_progress:
            # New card - initialize SM-2 values
            ease_factor = 2.5
            interval = 1
            repetitions = 0
            card_progress_id = str(uuid.uuid4())
        else:
            card_progress_id = card_progress["id"]
            ease_factor = card_progress["easeFactor"]
            interval = card_progress["interval"]
            repetitions = card_progress["repetitions"]
        
        # SM-2 Algorithm
        if quality >= 3:
            # Correct response
            if repetitions == 0:
                interval = 1
            elif repetitions == 1:
                interval = 6
            else:
                interval = int(interval * ease_factor)
            repetitions += 1
        else:
            # Incorrect - reset
            repetitions = 0
            interval = 1
        
        # Update ease factor
        ease_factor = max(1.3, ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
        
        # Determine status
        if repetitions == 0:
            status = "learning"
        elif interval >= 21:
            status = "mastered"
        else:
            status = "review"
        
        next_review = now + timedelta(days=interval)
        
        # Upsert card progress
        if not card_progress:
            await conn.execute("""
                INSERT INTO "FlashcardProgress" (
                    id, "userProgressId", "cardId", "easeFactor", "interval",
                    "repetitions", status, "nextReviewAt", "lastReviewAt",
                    "totalReviews", "correctCount", "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, NOW(), NOW())
            """, card_progress_id, progress_id, card_id, ease_factor, interval,
                repetitions, status, next_review, now, 1 if quality >= 3 else 0)
        else:
            await conn.execute("""
                UPDATE "FlashcardProgress" SET
                    "easeFactor" = $1, "interval" = $2, "repetitions" = $3,
                    status = $4, "nextReviewAt" = $5, "lastReviewAt" = $6,
                    "totalReviews" = "totalReviews" + 1,
                    "correctCount" = "correctCount" + $7,
                    "updatedAt" = NOW()
                WHERE id = $8
            """, ease_factor, interval, repetitions, status, next_review, now,
                1 if quality >= 3 else 0, card_progress_id)
        
        # Update user progress stats
        await conn.execute("""
            UPDATE "FlashcardUserProgress" SET
                "totalReviews" = "totalReviews" + 1,
                "lastStudiedAt" = NOW(),
                "updatedAt" = NOW()
            WHERE id = $1
        """, progress_id)
        
        return {
            "card_id": card_id,
            "status": status,
            "ease_factor": ease_factor,
            "interval": interval,
            "next_review_at": next_review.isoformat(),
        }


async def get_cards_due_for_review(profile_id: str, deck_id: str, limit: int = 20) -> List[dict]:
    """Get flashcards due for review (spaced repetition)."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        # Get user progress ID
        user_progress = await conn.fetchrow("""
            SELECT id FROM "FlashcardUserProgress" 
            WHERE "profileId" = $1 AND "deckId" = $2
        """, profile_id, deck_id)
        
        if not user_progress:
            # No progress yet - return first cards from deck
            cards = await conn.fetch("""
                SELECT id, front, back, difficulty, "awsServices", tags
                FROM "Flashcard" 
                WHERE "deckId" = $1
                ORDER BY "orderIndex"
                LIMIT $2
            """, deck_id, limit)
        else:
            # Get cards due for review + new cards
            cards = await conn.fetch("""
                SELECT f.id, f.front, f.back, f.difficulty, f."awsServices", f.tags,
                       fp.status, fp."nextReviewAt"
                FROM "Flashcard" f
                LEFT JOIN "FlashcardProgress" fp ON f.id = fp."cardId" 
                    AND fp."userProgressId" = $1
                WHERE f."deckId" = $2
                AND (fp.id IS NULL OR fp."nextReviewAt" <= NOW())
                ORDER BY fp."nextReviewAt" ASC NULLS FIRST
                LIMIT $3
            """, user_progress["id"], deck_id, limit)
        
        return [
            {
                "id": c["id"],
                "front": c["front"],
                "back": c["back"],
                "difficulty": c["difficulty"],
                "aws_services": json.loads(c["awsServices"]) if c["awsServices"] else [],
                "status": c.get("status", "new"),
            }
            for c in cards
        ]


# =============================================================================
# STUDY NOTES
# =============================================================================

async def save_study_notes(
    scenario_id: str,
    notes_data: dict,
    generated_by: str = "ai",
) -> str:
    """Save study notes."""
    pool = await get_pool()
    
    import uuid
    notes_id = str(uuid.uuid4())
    
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO "StudyNotes" (
                id, "scenarioId", title, content, sections,
                "generatedBy", "awsServices", version, "isActive", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
        """,
            notes_id,
            scenario_id,
            notes_data.get("title", "Study Notes"),
            notes_data.get("content", ""),
            json.dumps([
                {"id": s.get("id"), "title": s.get("title"), "level": s.get("level")}
                for s in notes_data.get("sections", [])
            ]),
            generated_by,
            json.dumps(notes_data.get("aws_services", [])),
            1,
            True,
            datetime.now(timezone.utc),
        )
    
    logger.info(f"Saved study notes {notes_id}")
    return notes_id


async def get_study_notes(notes_id: str) -> Optional[dict]:
    """Get study notes by ID."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM "StudyNotes" WHERE id = $1
        """, notes_id)
        
        if not row:
            return None
        
        return {
            "id": row["id"],
            "scenario_id": row["scenarioId"],
            "title": row["title"],
            "content": row["content"],
            "sections": json.loads(row["sections"]) if row["sections"] else [],
            "aws_services": json.loads(row["awsServices"]) if row["awsServices"] else [],
            "version": row["version"],
            "created_at": row["createdAt"].isoformat(),
        }


async def get_study_notes_for_scenario(scenario_id: str) -> List[dict]:
    """Get all study notes for a scenario."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, title, version, "createdAt"
            FROM "StudyNotes" 
            WHERE "scenarioId" = $1 AND "isActive" = true
            ORDER BY "createdAt" DESC
        """, scenario_id)
        
        return [
            {
                "id": row["id"],
                "title": row["title"],
                "version": row["version"],
                "created_at": row["createdAt"].isoformat(),
            }
            for row in rows
        ]


async def get_user_notes_progress(profile_id: str, notes_id: str) -> Optional[dict]:
    """Get user's progress on study notes."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM "StudyNotesProgress" 
            WHERE "profileId" = $1 AND "notesId" = $2
        """, profile_id, notes_id)
        
        if not row:
            return None
        
        # Get annotations
        annotations = await conn.fetch("""
            SELECT * FROM "StudyAnnotation"
            WHERE "progressId" = $1
            ORDER BY "createdAt" DESC
        """, row["id"])
        
        return {
            "id": row["id"],
            "read_progress": row["readProgress"],
            "completed_sections": json.loads(row["completedSections"]) if row["completedSections"] else [],
            "time_spent_minutes": row["timeSpentMinutes"],
            "last_read_at": row["lastReadAt"].isoformat() if row["lastReadAt"] else None,
            "annotations": [
                {
                    "id": a["id"],
                    "section_id": a["sectionId"],
                    "type": a["type"],
                    "content": a["content"],
                    "selection_text": a["selectionText"],
                    "created_at": a["createdAt"].isoformat(),
                }
                for a in annotations
            ],
        }


async def update_notes_progress(
    profile_id: str,
    notes_id: str,
    read_progress: float,
    completed_sections: List[str],
    time_spent_minutes: int = 0,
) -> str:
    """Update user's progress on study notes."""
    pool = await get_pool()
    import uuid
    
    async with pool.acquire() as conn:
        # Upsert progress
        row = await conn.fetchrow("""
            SELECT id FROM "StudyNotesProgress" 
            WHERE "profileId" = $1 AND "notesId" = $2
        """, profile_id, notes_id)
        
        if row:
            await conn.execute("""
                UPDATE "StudyNotesProgress" SET
                    "readProgress" = $1,
                    "completedSections" = $2,
                    "timeSpentMinutes" = "timeSpentMinutes" + $3,
                    "lastReadAt" = NOW(),
                    "updatedAt" = NOW()
                WHERE id = $4
            """, read_progress, json.dumps(completed_sections), time_spent_minutes, row["id"])
            return row["id"]
        else:
            progress_id = str(uuid.uuid4())
            await conn.execute("""
                INSERT INTO "StudyNotesProgress" (
                    id, "profileId", "notesId", "readProgress", "completedSections",
                    "timeSpentMinutes", "lastReadAt", "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
            """, progress_id, profile_id, notes_id, read_progress, 
                json.dumps(completed_sections), time_spent_minutes)
            return progress_id


async def add_annotation(
    progress_id: str,
    section_id: str,
    annotation_type: str,  # highlight, note, bookmark
    content: str,
    selection_text: Optional[str] = None,
) -> str:
    """Add an annotation to study notes."""
    pool = await get_pool()
    import uuid
    
    annotation_id = str(uuid.uuid4())
    
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO "StudyAnnotation" (
                id, "progressId", "sectionId", type, content,
                "selectionText", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        """, annotation_id, progress_id, section_id, annotation_type, 
            content, selection_text)
    
    return annotation_id


# =============================================================================
# QUIZZES
# =============================================================================

async def save_quiz(
    scenario_id: str,
    quiz_data: dict,
    generated_by: str = "ai",
) -> str:
    """Save a quiz."""
    pool = await get_pool()
    
    import uuid
    quiz_id = str(uuid.uuid4())
    
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO "Quiz" (
                id, "scenarioId", title, description, "quizType",
                "passingScore", "questionCount", "generatedBy",
                "isActive", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
        """,
            quiz_id,
            scenario_id,
            quiz_data.get("title", "Quiz"),
            quiz_data.get("description", ""),
            "standard",
            quiz_data.get("passing_score", 70),
            len(quiz_data.get("questions", [])),
            generated_by,
            True,
            datetime.now(timezone.utc),
        )
        
        # Save questions
        for idx, q in enumerate(quiz_data.get("questions", [])):
            q_id = q.get("id", str(uuid.uuid4()))
            await conn.execute("""
                INSERT INTO "QuizQuestion" (
                    id, "quizId", question, "questionType", options,
                    explanation, difficulty, points, "awsServices",
                    tags, "orderIndex", "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
            """,
                q_id,
                quiz_id,
                q.get("question", ""),
                q.get("question_type", "multiple_choice"),
                json.dumps([
                    {"id": o.get("id"), "text": o.get("text"), "isCorrect": o.get("is_correct")}
                    for o in q.get("options", [])
                ]),
                q.get("explanation", ""),
                q.get("difficulty", "medium"),
                q.get("points", 10),
                json.dumps(q.get("aws_services", [])),
                json.dumps(q.get("tags", [])),
                idx,
                datetime.now(timezone.utc),
            )
    
    logger.info(f"Saved quiz {quiz_id} with {len(quiz_data.get('questions', []))} questions")
    return quiz_id


async def get_quiz(quiz_id: str) -> Optional[dict]:
    """Get a quiz with all questions."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM "Quiz" WHERE id = $1
        """, quiz_id)
        
        if not row:
            return None
        
        questions = await conn.fetch("""
            SELECT * FROM "QuizQuestion" 
            WHERE "quizId" = $1 
            ORDER BY "orderIndex"
        """, quiz_id)
        
        return {
            "id": row["id"],
            "scenario_id": row["scenarioId"],
            "title": row["title"],
            "description": row["description"],
            "quiz_type": row["quizType"],
            "passing_score": row["passingScore"],
            "question_count": row["questionCount"],
            "questions": [
                {
                    "id": q["id"],
                    "question": q["question"],
                    "question_type": q["questionType"],
                    "options": json.loads(q["options"]) if q["options"] else [],
                    "explanation": q["explanation"],
                    "difficulty": q["difficulty"],
                    "points": q["points"],
                    "aws_services": json.loads(q["awsServices"]) if q["awsServices"] else [],
                    "tags": json.loads(q["tags"]) if q["tags"] else [],
                }
                for q in questions
            ],
        }


async def get_quizzes_for_scenario(scenario_id: str) -> List[dict]:
    """Get all quizzes for a scenario."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, title, description, "questionCount", "passingScore", "createdAt"
            FROM "Quiz" 
            WHERE "scenarioId" = $1 AND "isActive" = true
            ORDER BY "createdAt" DESC
        """, scenario_id)
        
        return [
            {
                "id": row["id"],
                "title": row["title"],
                "description": row["description"],
                "question_count": row["questionCount"],
                "passing_score": row["passingScore"],
                "created_at": row["createdAt"].isoformat(),
            }
            for row in rows
        ]


async def save_quiz_attempt(
    profile_id: str,
    quiz_id: str,
    answers: List[dict],  # [{"question_id": str, "selected_options": [str], "free_text": str}]
    score: int,
    passed: bool,
    time_spent_seconds: int,
) -> str:
    """Save a quiz attempt."""
    pool = await get_pool()
    import uuid
    
    attempt_id = str(uuid.uuid4())
    
    async with pool.acquire() as conn:
        # Get question count
        quiz = await conn.fetchrow("""
            SELECT "questionCount" FROM "Quiz" WHERE id = $1
        """, quiz_id)
        
        correct_count = len([a for a in answers if a.get("is_correct", False)])
        
        await conn.execute("""
            INSERT INTO "QuizAttempt" (
                id, "profileId", "quizId", score, passed,
                "questionsAnswered", "correctAnswers", "timeSpentSeconds",
                "completedAt", "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        """, attempt_id, profile_id, quiz_id, score, passed,
            len(answers), correct_count, time_spent_seconds)
        
        # Save individual answers
        for answer in answers:
            answer_id = str(uuid.uuid4())
            await conn.execute("""
                INSERT INTO "QuizAnswer" (
                    id, "attemptId", "questionId", "selectedOptions",
                    "freeTextAnswer", "isCorrect", "pointsEarned", "createdAt"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            """, answer_id, attempt_id, answer["question_id"],
                json.dumps(answer.get("selected_options", [])),
                answer.get("free_text"),
                answer.get("is_correct", False),
                answer.get("points_earned", 0))
    
    logger.info(f"Saved quiz attempt {attempt_id}: {score}% ({'passed' if passed else 'failed'})")
    return attempt_id


async def get_quiz_attempts(profile_id: str, quiz_id: str) -> List[dict]:
    """Get all attempts for a quiz by a user."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM "QuizAttempt"
            WHERE "profileId" = $1 AND "quizId" = $2
            ORDER BY "completedAt" DESC
        """, profile_id, quiz_id)
        
        return [
            {
                "id": row["id"],
                "score": row["score"],
                "passed": row["passed"],
                "questions_answered": row["questionsAnswered"],
                "correct_answers": row["correctAnswers"],
                "time_spent_seconds": row["timeSpentSeconds"],
                "completed_at": row["completedAt"].isoformat(),
            }
            for row in rows
        ]


async def get_quiz_attempt_details(attempt_id: str) -> Optional[dict]:
    """Get detailed results of a quiz attempt."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        attempt = await conn.fetchrow("""
            SELECT * FROM "QuizAttempt" WHERE id = $1
        """, attempt_id)
        
        if not attempt:
            return None
        
        answers = await conn.fetch("""
            SELECT qa.*, qq.question, qq.explanation, qq.options
            FROM "QuizAnswer" qa
            JOIN "QuizQuestion" qq ON qa."questionId" = qq.id
            WHERE qa."attemptId" = $1
            ORDER BY qq."orderIndex"
        """, attempt_id)
        
        return {
            "id": attempt["id"],
            "quiz_id": attempt["quizId"],
            "score": attempt["score"],
            "passed": attempt["passed"],
            "questions_answered": attempt["questionsAnswered"],
            "correct_answers": attempt["correctAnswers"],
            "time_spent_seconds": attempt["timeSpentSeconds"],
            "completed_at": attempt["completedAt"].isoformat(),
            "answers": [
                {
                    "question_id": a["questionId"],
                    "question": a["question"],
                    "selected_options": json.loads(a["selectedOptions"]) if a["selectedOptions"] else [],
                    "correct_options": [o["id"] for o in json.loads(a["options"]) if o.get("isCorrect")],
                    "free_text_answer": a["freeTextAnswer"],
                    "is_correct": a["isCorrect"],
                    "points_earned": a["pointsEarned"],
                    "explanation": a["explanation"],
                }
                for a in answers
            ],
        }


async def get_user_quiz_stats(profile_id: str) -> dict:
    """Get overall quiz statistics for a user."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        stats = await conn.fetchrow("""
            SELECT 
                COUNT(*) as total_attempts,
                COUNT(CASE WHEN passed THEN 1 END) as passed_count,
                AVG(score) as avg_score,
                SUM("timeSpentSeconds") as total_time,
                MAX(score) as best_score
            FROM "QuizAttempt"
            WHERE "profileId" = $1
        """, profile_id)
        
        return {
            "total_attempts": stats["total_attempts"] or 0,
            "passed_count": stats["passed_count"] or 0,
            "pass_rate": (stats["passed_count"] / stats["total_attempts"] * 100) if stats["total_attempts"] else 0,
            "avg_score": float(stats["avg_score"]) if stats["avg_score"] else 0,
            "total_time_minutes": (stats["total_time"] or 0) // 60,
            "best_score": stats["best_score"] or 0,
        }


# =============================================================================
# USER PROFILE & PROGRESS
# =============================================================================

async def get_user_profile(user_id: str, tenant_id: str) -> Optional[dict]:
    """Get or create academy user profile."""
    pool = await get_pool()
    import uuid
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM "AcademyUserProfile"
            WHERE "userId" = $1 AND "tenantId" = $2
        """, user_id, tenant_id)
        
        if not row:
            # Create new profile
            profile_id = str(uuid.uuid4())
            await conn.execute("""
                INSERT INTO "AcademyUserProfile" (
                    id, "userId", "tenantId", "displayName", level,
                    "totalPoints", "currentStreak", "preferences",
                    "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, '', 1, 0, 0, '{}', NOW(), NOW())
            """, profile_id, user_id, tenant_id)
            
            return {
                "id": profile_id,
                "user_id": user_id,
                "level": 1,
                "total_points": 0,
                "current_streak": 0,
                "preferences": {},
            }
        
        return {
            "id": row["id"],
            "user_id": row["userId"],
            "display_name": row["displayName"],
            "level": row["level"],
            "total_points": row["totalPoints"],
            "current_streak": row["currentStreak"],
            "longest_streak": row["longestStreak"],
            "preferences": json.loads(row["preferences"]) if row["preferences"] else {},
            "last_active_at": row["lastActiveAt"].isoformat() if row["lastActiveAt"] else None,
        }


async def update_user_points(profile_id: str, points: int, source: str) -> dict:
    """Add points to user and check for level up."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        # Get current profile
        profile = await conn.fetchrow("""
            SELECT * FROM "AcademyUserProfile" WHERE id = $1
        """, profile_id)
        
        new_total = profile["totalPoints"] + points
        
        # Calculate level (simple formula: level = sqrt(points / 100) + 1)
        import math
        new_level = int(math.sqrt(new_total / 100)) + 1
        leveled_up = new_level > profile["level"]
        
        await conn.execute("""
            UPDATE "AcademyUserProfile" SET
                "totalPoints" = $1,
                level = $2,
                "lastActiveAt" = NOW(),
                "updatedAt" = NOW()
            WHERE id = $3
        """, new_total, new_level, profile_id)
        
        return {
            "points_added": points,
            "total_points": new_total,
            "level": new_level,
            "leveled_up": leveled_up,
        }


async def list_scenarios_for_location(location_id: str) -> List[dict]:
    """List all scenarios for a location."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, title, description, difficulty, "estimatedMinutes",
                   "maxPoints", "targetLevel", "createdAt"
            FROM "AcademyScenario"
            WHERE "locationId" = $1 AND "isActive" = true
            ORDER BY "createdAt" DESC
        """, location_id)
        
        return [
            {
                "id": row["id"],
                "title": row["title"],
                "description": row["description"],
                "difficulty": row["difficulty"],
                "estimated_minutes": row["estimatedMinutes"],
                "max_points": row["maxPoints"],
                "target_level": row["targetLevel"],
                "created_at": row["createdAt"].isoformat(),
            }
            for row in rows
        ]


async def get_challenge_progress(profile_id: str, challenge_id: str) -> Optional[dict]:
    """Get user's progress on a specific challenge."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT cp.*, c.title, c.description, c.points
            FROM "ChallengeProgress" cp
            JOIN "AcademyChallenge" c ON cp."challengeId" = c.id
            WHERE cp."profileId" = $1 AND cp."challengeId" = $2
        """, profile_id, challenge_id)
        
        if not row:
            return None
        
        return {
            "id": row["id"],
            "challenge_id": row["challengeId"],
            "challenge_title": row["title"],
            "status": row["status"],
            "points_earned": row["pointsEarned"],
            "attempts": row["attempts"],
            "time_spent_minutes": row["timeSpentMinutes"],
            "started_at": row["startedAt"].isoformat() if row["startedAt"] else None,
            "completed_at": row["completedAt"].isoformat() if row["completedAt"] else None,
        }


async def update_challenge_progress(
    profile_id: str,
    challenge_id: str,
    status: str,  # not_started, in_progress, completed, failed
    points_earned: int = 0,
    time_spent_minutes: int = 0,
) -> str:
    """Update user's progress on a challenge."""
    pool = await get_pool()
    import uuid
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT id FROM "ChallengeProgress"
            WHERE "profileId" = $1 AND "challengeId" = $2
        """, profile_id, challenge_id)
        
        now = datetime.now(timezone.utc)
        
        if row:
            await conn.execute("""
                UPDATE "ChallengeProgress" SET
                    status = $1,
                    "pointsEarned" = GREATEST("pointsEarned", $2),
                    attempts = attempts + 1,
                    "timeSpentMinutes" = "timeSpentMinutes" + $3,
                    "completedAt" = CASE WHEN $1 = 'completed' THEN $4 ELSE "completedAt" END,
                    "updatedAt" = $4
                WHERE id = $5
            """, status, points_earned, time_spent_minutes, now, row["id"])
            return row["id"]
        else:
            progress_id = str(uuid.uuid4())
            await conn.execute("""
                INSERT INTO "ChallengeProgress" (
                    id, "profileId", "challengeId", status, "pointsEarned",
                    attempts, "timeSpentMinutes", "startedAt", "completedAt",
                    "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, $7, $7)
            """, progress_id, profile_id, challenge_id, status, points_earned,
                time_spent_minutes, now, now if status == "completed" else None)
            return progress_id


# =============================================================================
# COACHING SESSIONS
# =============================================================================

async def save_coaching_message(
    session_id: str,
    role: str,
    content: str,
    metadata: Optional[dict] = None,
) -> str:
    """Save a coaching chat message."""
    pool = await get_pool()
    
    import uuid
    message_id = str(uuid.uuid4())
    
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO "CoachingMessage" (
                id, "sessionId", role, content, "contentType", metadata, "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        """,
            message_id,
            session_id,
            role,
            content,
            "text",
            json.dumps(metadata or {}),
            datetime.now(timezone.utc),
        )
        
        # Update session message count
        await conn.execute("""
            UPDATE "CoachingSession" 
            SET "messageCount" = "messageCount" + 1,
                "lastMessageAt" = NOW(),
                "updatedAt" = NOW()
            WHERE id = $1
        """, session_id)
    
    return message_id


async def create_coaching_session(
    session_id: str,
    scenario_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> str:
    """Create a new coaching session."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO "CoachingSession" (
                id, "profileId", "scenarioId", title, status,
                "messageCount", "startedAt", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $7)
        """,
            session_id,
            user_id,  # profileId
            scenario_id,
            "Coaching Session",
            "active",
            0,
            datetime.now(timezone.utc),
        )
    
    return session_id


async def get_session_history(session_id: str, limit: int = 50) -> List[dict]:
    """Get chat history for a session."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM "CoachingMessage"
            WHERE "sessionId" = $1
            ORDER BY "createdAt" DESC
            LIMIT $2
        """, session_id, limit)
        
        return [
            {
                "role": row["role"],
                "content": row["content"],
                "created_at": row["createdAt"].isoformat(),
            }
            for row in reversed(rows)
        ]


# =============================================================================
# AWS SERVICE REFERENCE (kept for backwards compatibility)
# =============================================================================

async def get_aws_service_reference(service_name: str) -> Optional[dict]:
    """Get reference info for an AWS service."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM "AWSServiceReference"
            WHERE "serviceName" = $1 OR "serviceCode" = $1
        """, service_name)
        
        if not row:
            return None
        
        return {
            "service_name": row["serviceName"],
            "full_name": row["fullName"],
            "category": row["category"],
            "short_description": row["shortDescription"],
            "use_cases": json.loads(row["useCases"]) if row["useCases"] else [],
            "on_prem_equivalents": json.loads(row["onPremEquivalents"]) if row["onPremEquivalents"] else [],
            "migration_category": row["migrationCategory"],
            "docs_url": row["docsUrl"],
        }


async def get_migration_pattern(source_type: str, target_service: str) -> Optional[dict]:
    """Get a migration pattern."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM "MigrationPattern"
            WHERE "sourceType" = $1 AND "targetService" = $2
            AND "isActive" = true
        """, source_type, target_service)
        
        if not row:
            return None
        
        return {
            "name": row["name"],
            "source_type": row["sourceType"],
            "target_service": row["targetService"],
            "description": row["fullDescription"],
            "steps": json.loads(row["steps"]) if row["steps"] else [],
            "complexity": row["complexity"],
            "estimated_hours": row["estimatedHours"],
            "aws_services": json.loads(row["awsServices"]) if row["awsServices"] else [],
        }


# =============================================================================
# KNOWLEDGE CRAWLING - Mirrors crawl4ai schema
# =============================================================================

async def ensure_knowledge_source(
    source_id: str,
    summary: Optional[str] = None,
    word_count: int = 0,
    title: Optional[str] = None,
    category: Optional[str] = None,
    aws_services: Optional[List[str]] = None,
    tags: Optional[List[str]] = None,
) -> str:
    """Ensure a knowledge source exists (upsert). Mirrors crawl4ai sources table."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO "AcademyKnowledgeSource" (
                id, summary, "totalWordCount", title, category,
                "awsServices", tags, "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                summary = COALESCE(EXCLUDED.summary, "AcademyKnowledgeSource".summary),
                "totalWordCount" = COALESCE(EXCLUDED."totalWordCount", "AcademyKnowledgeSource"."totalWordCount"),
                title = COALESCE(EXCLUDED.title, "AcademyKnowledgeSource".title),
                "updatedAt" = NOW()
        """,
            source_id,
            summary,
            word_count,
            title,
            category,
            json.dumps(aws_services or []),
            json.dumps(tags or []),
        )
    
    logger.info(f"Ensured knowledge source: {source_id}")
    return source_id


async def add_knowledge_chunk(
    url: str,
    chunk_number: int,
    content: str,
    metadata: dict,
    source_id: str,
    embedding: Optional[List[float]] = None,
) -> int:
    """Add a knowledge chunk. Mirrors crawl4ai crawled_pages table."""
    pool = await get_pool()
    
    # Format embedding for pgvector
    embedding_str = None
    if embedding:
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
    
    async with pool.acquire() as conn:
        result = await conn.fetchrow("""
            INSERT INTO "AcademyKnowledgeChunk" (
                url, "chunkNumber", content, metadata, "sourceId", embedding, "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())
            ON CONFLICT (url, "chunkNumber") DO UPDATE SET
                content = EXCLUDED.content,
                metadata = EXCLUDED.metadata,
                embedding = EXCLUDED.embedding
            RETURNING id
        """, url, chunk_number, content, json.dumps(metadata), source_id, embedding_str)
        
        return result["id"]


async def add_knowledge_chunks_batch(
    chunks: List[dict],  # [{"url": str, "chunk_number": int, "content": str, "metadata": dict, "source_id": str, "embedding": List[float]}]
) -> int:
    """Add multiple knowledge chunks in batch."""
    pool = await get_pool()
    count = 0
    
    async with pool.acquire() as conn:
        for chunk in chunks:
            embedding_str = None
            if chunk.get("embedding"):
                embedding_str = "[" + ",".join(str(x) for x in chunk["embedding"]) + "]"
            
            try:
                await conn.execute("""
                    INSERT INTO "AcademyKnowledgeChunk" (
                        url, "chunkNumber", content, metadata, "sourceId", embedding, "createdAt"
                    ) VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())
                    ON CONFLICT (url, "chunkNumber") DO UPDATE SET
                        content = EXCLUDED.content,
                        metadata = EXCLUDED.metadata,
                        embedding = EXCLUDED.embedding
                """, 
                    chunk["url"],
                    chunk["chunk_number"],
                    chunk["content"],
                    json.dumps(chunk.get("metadata", {})),
                    chunk["source_id"],
                    embedding_str,
                )
                count += 1
            except Exception as e:
                logger.error(f"Error adding chunk {chunk['url']} #{chunk['chunk_number']}: {e}")
    
    logger.info(f"Added {count} knowledge chunks")
    return count


async def search_knowledge_chunks(
    query_embedding: List[float],
    limit: int = 10,
    source_filter: Optional[str] = None,
) -> List[dict]:
    """Search knowledge chunks by vector similarity. Mirrors crawl4ai match_crawled_pages."""
    pool = await get_pool()
    
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
    
    async with pool.acquire() as conn:
        if source_filter:
            rows = await conn.fetch("""
                SELECT id, url, "chunkNumber", content, metadata, "sourceId",
                       1 - (embedding <=> $1::vector) as similarity
                FROM "AcademyKnowledgeChunk"
                WHERE "sourceId" = $3
                ORDER BY embedding <=> $1::vector
                LIMIT $2
            """, embedding_str, limit, source_filter)
        else:
            rows = await conn.fetch("""
                SELECT id, url, "chunkNumber", content, metadata, "sourceId",
                       1 - (embedding <=> $1::vector) as similarity
                FROM "AcademyKnowledgeChunk"
                ORDER BY embedding <=> $1::vector
                LIMIT $2
            """, embedding_str, limit)
        
        return [
            {
                "id": row["id"],
                "url": row["url"],
                "chunk_number": row["chunkNumber"],
                "content": row["content"],
                "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
                "source_id": row["sourceId"],
                "similarity": float(row["similarity"]),
            }
            for row in rows
        ]


async def get_knowledge_sources(limit: int = 50) -> List[dict]:
    """List all knowledge sources."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT s.id, s.summary, s."totalWordCount", s.title, s.category,
                   s."awsServices", s.tags, s."createdAt",
                   COUNT(c.id) as chunk_count
            FROM "AcademyKnowledgeSource" s
            LEFT JOIN "AcademyKnowledgeChunk" c ON s.id = c."sourceId"
            GROUP BY s.id
            ORDER BY s."createdAt" DESC
            LIMIT $1
        """, limit)
        
        return [
            {
                "id": row["id"],
                "summary": row["summary"],
                "total_word_count": row["totalWordCount"],
                "title": row["title"],
                "category": row["category"],
                "aws_services": json.loads(row["awsServices"]) if row["awsServices"] else [],
                "tags": json.loads(row["tags"]) if row["tags"] else [],
                "chunk_count": row["chunk_count"],
                "created_at": row["createdAt"].isoformat(),
            }
            for row in rows
        ]


async def delete_knowledge_source(source_id: str) -> bool:
    """Delete a knowledge source and its chunks (CASCADE)."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        result = await conn.execute("""
            DELETE FROM "AcademyKnowledgeSource" WHERE id = $1
        """, source_id)
        
        return "DELETE 1" in result


# =============================================================================
# CRAWL4AI COMPATIBILITY FUNCTIONS
# These functions match the interface expected by utils.py
# =============================================================================

async def save_crawled_page(
    url: str,
    chunk_number: int,
    content: str,
    source_id: str,
    metadata: Dict[str, Any] = None,
    embedding: List[float] = None,
    tenant_id: str = None,  # Ignored - no tenant isolation for agent knowledge
) -> int:
    """Save a crawled page chunk. Maps to AcademyKnowledgeChunk."""
    pool = await get_pool()
    
    embedding_str = None
    if embedding:
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
    
    async with pool.acquire() as conn:
        # Ensure source exists first
        await conn.execute("""
            INSERT INTO "AcademyKnowledgeSource" (id, "createdAt", "updatedAt")
            VALUES ($1, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
        """, source_id)
        
        result = await conn.fetchrow("""
            INSERT INTO "AcademyKnowledgeChunk" (url, "chunkNumber", content, metadata, "sourceId", embedding, "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())
            ON CONFLICT (url, "chunkNumber") DO UPDATE SET
                content = EXCLUDED.content,
                metadata = EXCLUDED.metadata,
                embedding = EXCLUDED.embedding
            RETURNING id
        """, url, chunk_number, content, json.dumps(metadata or {}), source_id, embedding_str)
        
        return result["id"]


async def search_crawled_pages(
    embedding: List[float],
    limit: int = 10,
    source_id: str = None,
    tenant_id: str = None,  # Ignored
    metadata_filter: Dict[str, Any] = None,  # Not implemented yet
) -> List[Dict[str, Any]]:
    """Search crawled pages by vector similarity. Maps to AcademyKnowledgeChunk."""
    pool = await get_pool()
    
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
    
    async with pool.acquire() as conn:
        if source_id:
            rows = await conn.fetch("""
                SELECT id, url, "chunkNumber" as chunk_number, content, metadata, "sourceId" as source_id,
                       1 - (embedding <=> $1::vector) as similarity
                FROM "AcademyKnowledgeChunk"
                WHERE "sourceId" = $3
                ORDER BY embedding <=> $1::vector
                LIMIT $2
            """, embedding_str, limit, source_id)
        else:
            rows = await conn.fetch("""
                SELECT id, url, "chunkNumber" as chunk_number, content, metadata, "sourceId" as source_id,
                       1 - (embedding <=> $1::vector) as similarity
                FROM "AcademyKnowledgeChunk"
                ORDER BY embedding <=> $1::vector
                LIMIT $2
            """, embedding_str, limit)
        
        return [dict(row) for row in rows]


async def ensure_source(
    source_id: str,
    summary: str = None,
    word_count: int = 0,
    tenant_id: str = None,
) -> None:
    """Ensure a source exists. Maps to AcademyKnowledgeSource."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO "AcademyKnowledgeSource" (id, summary, "totalWordCount", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                summary = COALESCE(EXCLUDED.summary, "AcademyKnowledgeSource".summary),
                "totalWordCount" = GREATEST("AcademyKnowledgeSource"."totalWordCount", EXCLUDED."totalWordCount"),
                "updatedAt" = NOW()
        """, source_id, summary, word_count)


# =============================================================================
# LEARNER JOURNEY REPORTS
# =============================================================================

async def get_learner_journey_data(profile_id: str) -> Dict[str, Any]:
    """Get comprehensive learning journey data for a user."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        # Get user profile
        profile = await conn.fetchrow("""
            SELECT id, "displayName", "skillLevel", "totalPoints", "currentLevel", 
                   "totalTimeMinutes", "createdAt"
            FROM "AcademyUserProfile"
            WHERE id = $1
        """, profile_id)
        
        if not profile:
            return None
        
        # Get scenario attempts
        scenarios = await conn.fetch("""
            SELECT sa.id, sa."scenarioId", sa.status, sa.score, sa."startedAt", sa."completedAt",
                   sa."challengesCompleted", sa."totalChallenges"
            FROM "ScenarioAttempt" sa
            WHERE sa."profileId" = $1
            ORDER BY sa."startedAt" DESC
            LIMIT 20
        """, profile_id)
        
        # Get quiz stats
        quiz_stats = await conn.fetchrow("""
            SELECT COUNT(*) as total_quizzes,
                   AVG(score) as avg_score,
                   SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count
            FROM "QuizAttempt"
            WHERE "profileId" = $1
        """, profile_id)
        
        # Get flashcard progress
        flashcard_stats = await conn.fetchrow("""
            SELECT COUNT(DISTINCT "deckId") as decks_studied,
                   SUM("cardsReviewed") as total_cards_reviewed,
                   AVG("masteryPercentage") as avg_mastery
            FROM "FlashcardUserProgress"
            WHERE "profileId" = $1
        """, profile_id)
        
        # Get coaching sessions
        coaching = await conn.fetch("""
            SELECT id, title, "messageCount", "startedAt", "lastMessageAt"
            FROM "CoachingSession"
            WHERE "profileId" = $1
            ORDER BY "startedAt" DESC
            LIMIT 10
        """, profile_id)
        
        return {
            "profile": dict(profile),
            "scenarios": [dict(s) for s in scenarios],
            "quiz_stats": dict(quiz_stats) if quiz_stats else {},
            "flashcard_stats": dict(flashcard_stats) if flashcard_stats else {},
            "coaching_sessions": [dict(c) for c in coaching],
        }


async def get_learner_strengths_weaknesses(profile_id: str) -> Dict[str, Any]:
    """Analyze learner's strengths and weaknesses based on quiz/challenge performance."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        # Get quiz performance by topic/service
        quiz_by_topic = await conn.fetch("""
            SELECT 
                jsonb_array_elements_text(qa.answers->'aws_services') as service,
                AVG((qa.answers->>'score')::float) as avg_score,
                COUNT(*) as attempts
            FROM "QuizAttempt" qa
            WHERE qa."profileId" = $1
            AND qa.answers IS NOT NULL
            GROUP BY service
            ORDER BY avg_score ASC
        """, profile_id)
        
        # Get challenge completion by service
        challenge_by_service = await conn.fetch("""
            SELECT 
                cp."challengeId",
                cp.status,
                cp.score,
                cp."attemptCount"
            FROM "ChallengeProgress" cp
            WHERE cp."profileId" = $1
        """, profile_id)
        
        # Identify weak areas (low scores)
        weak_areas = [dict(q) for q in quiz_by_topic if q["avg_score"] and q["avg_score"] < 70]
        
        # Identify strong areas (high scores)
        strong_areas = [dict(q) for q in quiz_by_topic if q["avg_score"] and q["avg_score"] >= 80]
        
        return {
            "weak_areas": weak_areas[:5],
            "strong_areas": strong_areas[:5],
            "challenge_progress": [dict(c) for c in challenge_by_service],
        }


async def save_journey_report(
    profile_id: str,
    report_type: str,
    content: str,
    summary: str,
    metadata: Dict[str, Any] = None,
) -> str:
    """Save a generated learning journey report."""
    pool = await get_pool()
    
    import uuid
    report_id = str(uuid.uuid4())
    
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO "AcademyKnowledgeChunk" (
                url, "chunkNumber", content, metadata, "sourceId", "createdAt"
            ) VALUES ($1, 0, $2, $3, $4, NOW())
        """, 
            f"journey-report://{profile_id}/{report_id}",
            content,
            json.dumps({
                "report_id": report_id,
                "profile_id": profile_id,
                "report_type": report_type,
                "summary": summary,
                **(metadata or {})
            }),
            f"journey-reports-{profile_id}"
        )
    
    return report_id


async def get_journey_reports(profile_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Get saved journey reports for a user."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT url, content, metadata, "createdAt"
            FROM "AcademyKnowledgeChunk"
            WHERE url LIKE $1
            ORDER BY "createdAt" DESC
            LIMIT $2
        """, f"journey-report://{profile_id}/%", limit)
        
        reports = []
        for row in rows:
            meta = json.loads(row["metadata"]) if row["metadata"] else {}
            reports.append({
                "report_id": meta.get("report_id"),
                "report_type": meta.get("report_type"),
                "summary": meta.get("summary"),
                "content": row["content"],
                "created_at": row["createdAt"].isoformat() if row["createdAt"] else None,
            })
        
        return reports


# =============================================================================
# TENANT/USER AI CONFIGURATION
# =============================================================================

async def get_tenant_ai_config(tenant_id: str) -> Optional[Dict[str, Any]]:
    """Get tenant's AI configuration (OpenAI key, preferred model)."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT id, name, "openaiApiKey", "preferredModel"
            FROM "Tenant"
            WHERE id = $1
        """, tenant_id)
        
        if not row:
            return None
        
        return {
            "tenant_id": row["id"],
            "tenant_name": row["name"],
            "openai_api_key": row["openaiApiKey"],
            "preferred_model": row.get("preferredModel", "gpt-4.1"),
        }


async def get_user_ai_config(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user's AI configuration from AcademyUserProfile."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT id, "displayName", "openaiApiKey", "preferredModel", "skillLevel"
            FROM "AcademyUserProfile"
            WHERE id = $1
        """, user_id)
        
        if not row:
            return None
        
        return {
            "user_id": row["id"],
            "display_name": row["displayName"],
            "openai_api_key": row["openaiApiKey"],
            "preferred_model": row.get("preferredModel", "gpt-4.1"),
            "skill_level": row["skillLevel"],
        }


async def update_tenant_ai_config(
    tenant_id: str,
    openai_api_key: Optional[str] = None,
    preferred_model: Optional[str] = None,
) -> bool:
    """Update tenant's AI configuration."""
    pool = await get_pool()
    
    updates = []
    params = [tenant_id]
    param_idx = 2
    
    if openai_api_key is not None:
        updates.append(f'"openaiApiKey" = ${param_idx}')
        params.append(openai_api_key)
        param_idx += 1
    
    if preferred_model is not None:
        updates.append(f'"preferredModel" = ${param_idx}')
        params.append(preferred_model)
        param_idx += 1
    
    if not updates:
        return False
    
    updates.append('"updatedAt" = NOW()')
    
    async with pool.acquire() as conn:
        result = await conn.execute(f"""
            UPDATE "Tenant"
            SET {', '.join(updates)}
            WHERE id = $1
        """, *params)
        
        return "UPDATE 1" in result


async def update_user_ai_config(
    user_id: str,
    openai_api_key: Optional[str] = None,
    preferred_model: Optional[str] = None,
) -> bool:
    """Update user's AI configuration in AcademyUserProfile."""
    pool = await get_pool()
    
    updates = []
    params = [user_id]
    param_idx = 2
    
    if openai_api_key is not None:
        updates.append(f'"openaiApiKey" = ${param_idx}')
        params.append(openai_api_key)
        param_idx += 1
    
    if preferred_model is not None:
        updates.append(f'"preferredModel" = ${param_idx}')
        params.append(preferred_model)
        param_idx += 1
    
    if not updates:
        return False
    
    updates.append('"updatedAt" = NOW()')
    
    async with pool.acquire() as conn:
        result = await conn.execute(f"""
            UPDATE "AcademyUserProfile"
            SET {', '.join(updates)}
            WHERE id = $1
        """, *params)
        
        return "UPDATE 1" in result


async def get_user_persona(user_id: str) -> Optional[str]:
    """Get user's active learning persona."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT settings->>'activePersona' as persona
            FROM "AcademyUserProfile"
            WHERE id = $1
        """, user_id)
        
        if row and row["persona"]:
            return row["persona"]
        return None


async def update_user_persona(user_id: str, persona_id: str) -> bool:
    """Update user's active learning persona in settings JSON."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        result = await conn.execute("""
            UPDATE "AcademyUserProfile"
            SET settings = jsonb_set(
                COALESCE(settings, '{}')::jsonb,
                '{activePersona}',
                to_jsonb($2::text)
            ),
            "updatedAt" = NOW()
            WHERE id = $1
        """, user_id, persona_id)
        
        return "UPDATE 1" in result
