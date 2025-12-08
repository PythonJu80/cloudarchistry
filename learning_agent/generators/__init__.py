# Learning content generators
from .scenario import generate_scenario, generate_scenario_from_location, evaluate_solution, CloudScenario, Challenge, CompanyInfo
from .flashcards import generate_flashcards, generate_flashcards_for_service, FlashcardDeck, Flashcard
from .notes import generate_notes, StudyNotes
from .quiz import generate_quiz, Quiz
from .challenge_questions import generate_challenge_questions, grade_challenge_answer, ChallengeQuestions, ChallengeQuestion
from .cli_simulator import (
    simulate_cli_command, 
    get_cli_help, 
    create_session, 
    validate_cli_challenge,
    get_session_stats,
    CLISession, 
    CLIResponse,
    CLIValidationResult,
)
from .study_plan import generate_study_plan, StudyPlanContext
