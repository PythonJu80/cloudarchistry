"""
AWS CLI Simulator Generator Module
===================================
AI-powered AWS CLI sandbox that simulates realistic AWS CLI responses.
Context-aware of the current challenge - teaches CLI commands while
the user practices in a safe, sandboxed environment.

This is NOT executing real AWS commands - it's an AI tutor that responds
AS IF it were AWS, with realistic outputs tailored to the learning scenario.
"""

import json
import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from openai import AsyncOpenAI

from prompts import CERTIFICATION_PERSONAS
from utils import get_request_api_key, get_request_model, ApiKeyRequiredError


# Valid user levels
VALID_USER_LEVELS = ["beginner", "intermediate", "advanced", "expert"]
VALID_CERT_CODES = list(CERTIFICATION_PERSONAS.keys())


class CLIValidationError(Exception):
    """Raised when CLI simulator parameters are invalid"""
    pass


def validate_cli_params(user_level: str, cert_code: str) -> None:
    """
    Validate that user_level and cert_code are provided and valid.
    
    Args:
        user_level: User skill level ('beginner', 'intermediate', 'advanced', 'expert')
        cert_code: AWS certification persona ID (e.g., 'solutions-architect-associate')
    
    Raises:
        CLIValidationError: If parameters are missing or invalid
    """
    if not user_level:
        raise CLIValidationError(
            "user_level is required. CLI simulation must be user-level specific. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if not cert_code:
        raise CLIValidationError(
            "cert_code is required. CLI simulation must be certification-specific. "
            f"Valid cert codes: {', '.join(VALID_CERT_CODES)}"
        )
    
    if user_level not in VALID_USER_LEVELS:
        raise CLIValidationError(
            f"Invalid user_level '{user_level}'. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if cert_code not in VALID_CERT_CODES:
        raise CLIValidationError(
            f"Invalid cert_code '{cert_code}'. "
            f"Valid cert codes: {', '.join(VALID_CERT_CODES)}"
        )


# =============================================================================
# AWS CLI CHEATSHEET - Reference for the AI
# =============================================================================

AWS_CLI_CHEATSHEET = """
# AWS CLI CHEATSHEET - Common Commands Reference

## STS (Security Token Service)
aws sts get-caller-identity  # Verify credentials, show account/user info

## IAM (Identity & Access Management)
aws iam list-users
aws iam list-users --output text | cut -f 6  # Just usernames
aws iam get-user
aws iam list-access-keys
aws iam create-user --user-name <name>
aws iam delete-user --user-name <name>
aws iam list-groups
aws iam create-group --group-name <name>
aws iam add-user-to-group --group-name <name> --user-name <user>
aws iam list-policies
aws iam attach-group-policy --group-name <name> --policy-arn <arn>
aws iam get-account-password-policy
aws iam update-account-password-policy --minimum-password-length 12 --require-symbols --require-numbers

## S3 (Simple Storage Service)
aws s3 ls  # List buckets
aws s3 ls s3://bucket-name  # List objects in bucket
aws s3 mb s3://bucket-name  # Make bucket
aws s3 rb s3://bucket-name  # Remove bucket
aws s3 cp file.txt s3://bucket/  # Upload file
aws s3 cp s3://bucket/file.txt .  # Download file
aws s3 sync ./local s3://bucket/  # Sync directory
aws s3 rm s3://bucket/file.txt  # Delete object
aws s3api create-bucket --bucket <name> --acl public-read-write
aws s3api get-bucket-acl --bucket <name>
aws s3api put-bucket-acl --acl private --bucket <name>

## EC2 (Elastic Compute Cloud)
aws ec2 describe-instances
aws ec2 describe-instances --filters Name=instance-state-name,Values=running
aws ec2 describe-vpcs
aws ec2 describe-subnets
aws ec2 describe-security-groups
aws ec2 describe-key-pairs
aws ec2 create-key-pair --key-name <name>
aws ec2 create-vpc --cidr-block 10.0.0.0/16
aws ec2 create-subnet --vpc-id <id> --cidr-block 10.0.1.0/24
aws ec2 create-security-group --group-name <name> --description "<desc>" --vpc-id <id>
aws ec2 authorize-security-group-ingress --group-id <id> --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 run-instances --image-id ami-xxx --instance-type t2.micro --key-name <key> --security-group-ids <sg>
aws ec2 start-instances --instance-ids <id>
aws ec2 stop-instances --instance-ids <id>
aws ec2 terminate-instances --instance-ids <id>

## RDS (Relational Database Service)
aws rds describe-db-instances
aws rds create-db-instance --db-instance-identifier <name> --db-instance-class db.t3.micro --engine mysql --master-username admin --master-user-password <pass>
aws rds delete-db-instance --db-instance-identifier <name> --skip-final-snapshot
aws rds describe-db-snapshots
aws rds create-db-snapshot --db-instance-identifier <name> --db-snapshot-identifier <snap-name>

## Lambda
aws lambda list-functions
aws lambda get-function --function-name <name>
aws lambda create-function --function-name <name> --runtime python3.9 --handler index.handler --role <arn> --zip-file fileb://function.zip
aws lambda invoke --function-name <name> output.json
aws lambda update-function-code --function-name <name> --zip-file fileb://function.zip

## CloudFormation
aws cloudformation list-stacks
aws cloudformation describe-stacks
aws cloudformation create-stack --stack-name <name> --template-body file://template.yaml
aws cloudformation update-stack --stack-name <name> --template-body file://template.yaml
aws cloudformation delete-stack --stack-name <name>
aws cloudformation describe-stack-events --stack-name <name>

## CloudWatch
aws logs describe-log-groups
aws logs create-log-group --log-group-name <name>
aws logs describe-log-streams --log-group-name <name>
aws logs get-log-events --log-group-name <name> --log-stream-name <stream>
aws cloudwatch list-metrics
aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name CPUUtilization --dimensions Name=InstanceId,Value=<id> --start-time <time> --end-time <time> --period 300 --statistics Average

## ELB (Elastic Load Balancing)
aws elbv2 describe-load-balancers
aws elbv2 create-load-balancer --name <name> --subnets <subnet-ids> --security-groups <sg-ids>
aws elbv2 describe-target-groups
aws elbv2 create-target-group --name <name> --protocol HTTP --port 80 --vpc-id <vpc-id>
aws elbv2 register-targets --target-group-arn <arn> --targets Id=<instance-id>

## Route53
aws route53 list-hosted-zones
aws route53 list-resource-record-sets --hosted-zone-id <id>
aws route53 change-resource-record-sets --hosted-zone-id <id> --change-batch file://changes.json

## SNS/SQS
aws sns list-topics
aws sns create-topic --name <name>
aws sns publish --topic-arn <arn> --message "Hello"
aws sqs list-queues
aws sqs create-queue --queue-name <name>
aws sqs send-message --queue-url <url> --message-body "Hello"
aws sqs receive-message --queue-url <url>

## DynamoDB
aws dynamodb list-tables
aws dynamodb describe-table --table-name <name>
aws dynamodb create-table --table-name <name> --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST
aws dynamodb put-item --table-name <name> --item '{"id":{"S":"1"},"name":{"S":"test"}}'
aws dynamodb get-item --table-name <name> --key '{"id":{"S":"1"}}'
aws dynamodb scan --table-name <name>

## ECS/ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
aws ecr describe-repositories
aws ecr create-repository --repository-name <name>
aws ecs list-clusters
aws ecs describe-clusters --clusters <name>
aws ecs list-services --cluster <name>
aws ecs list-tasks --cluster <name>

## Secrets Manager / Parameter Store
aws secretsmanager list-secrets
aws secretsmanager get-secret-value --secret-id <name>
aws secretsmanager create-secret --name <name> --secret-string '{"key":"value"}'
aws ssm get-parameter --name <name>
aws ssm put-parameter --name <name> --value <value> --type SecureString
"""


# =============================================================================
# MODELS
# =============================================================================

class CLIResponse(BaseModel):
    """Response from the CLI simulator"""
    command: str
    output: str
    exit_code: int  # 0 = success, non-zero = error
    explanation: Optional[str] = None  # Teaching moment
    next_steps: Optional[List[str]] = None  # Suggested follow-up commands
    is_dangerous: bool = False
    warning: Optional[str] = None
    
    # Validation for challenge objectives
    is_correct_for_challenge: bool = True  # Was this the right command for the objective?
    objective_completed: Optional[str] = None  # Which objective this command completed
    points_earned: int = 0  # Points for this command
    
    # Service tracking
    aws_service: Optional[str] = None  # Which AWS service was used (ec2, s3, etc.)
    command_type: Optional[str] = None  # describe, create, delete, etc.


class CLISession(BaseModel):
    """Tracks a CLI learning session"""
    session_id: str
    challenge_id: Optional[str] = None
    commands_executed: List[Dict[str, Any]] = []  # [{ command, timestamp, exitCode, isCorrect, service }]
    resources_created: Dict[str, Any] = {}  # Simulated AWS resources
    current_region: str = "us-east-1"
    current_account: str = "123456789012"
    
    # Progress tracking
    correct_commands: int = 0
    total_commands: int = 0
    current_streak: int = 0
    best_streak: int = 0
    objectives_completed: List[str] = []
    points_earned: int = 0


class CLIValidationResult(BaseModel):
    """Result of validating CLI commands against challenge objectives"""
    is_complete: bool = False
    score: int = 0  # 0-100
    objectives_met: List[str] = []
    objectives_missing: List[str] = []
    correct_commands: List[str] = []
    incorrect_commands: List[str] = []
    feedback: str = ""
    suggestions: List[str] = []


# =============================================================================
# SIMULATOR PROMPT
# =============================================================================

CLI_SIMULATOR_PROMPT = """You are an AWS CLI Simulator and Tutor for Cloud Academy.

You simulate realistic AWS CLI responses in a SANDBOXED environment - no real AWS resources are affected.
Your job is to:
1. Return realistic AWS CLI output for commands
2. Teach the user about AWS services as they practice
3. Be context-aware of their current learning challenge
4. Track "simulated" resources they create during the session

USER PROFILE:
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {focus_areas}

CURRENT CHALLENGE CONTEXT (REQUIRED):
{challenge_context}

COMPANY CONTEXT:
- Company: {company_name}
- Industry: {industry}
- Business Scenario: {business_context}

SIMULATED AWS ENVIRONMENT:
- Account ID: {account_id}
- Region: {region}
- Resources Created This Session: {session_resources}

AWS CLI REFERENCE:
{cli_cheatsheet}

RULES:
1. Return REALISTIC AWS CLI JSON/text output - make it look exactly like real AWS
2. Generate realistic resource IDs (vpc-xxx, i-xxx, sg-xxx, etc.)
3. If they create a resource, remember it and reference it in future commands
4. For describe/list commands, include resources relevant to their challenge
5. Include helpful teaching moments in the 'explanation' field
6. Suggest relevant next commands in 'next_steps'
7. For dangerous commands (delete, terminate), set is_dangerous=true and warn them
8. If the command has syntax errors, return a realistic AWS CLI error message
9. Tailor examples to their company/industry context when relevant
10. ADAPT to user's skill level ({user_level}):
    - beginner: More explanation, simpler commands, guide them step-by-step
    - intermediate: Balanced guidance, introduce best practices
    - advanced: Minimal hand-holding, focus on optimization
    - expert: Peer-level, discuss edge cases and trade-offs
11. FOCUS on {cert_name} exam-relevant commands and patterns
12. Emphasize certification focus areas: {focus_areas}

CHALLENGE OBJECTIVES (if applicable):
{challenge_objectives}

RESPONSE FORMAT (JSON):
{{
    "command": "the command they ran",
    "output": "realistic AWS CLI output (JSON or text)",
    "exit_code": 0,
    "explanation": "Brief teaching moment about this command/service",
    "next_steps": ["suggested command 1", "suggested command 2"],
    "is_dangerous": false,
    "warning": null,
    "resources_created": {{"resource_type": "resource_id"}},
    
    // Validation fields - IMPORTANT for tracking progress
    "is_correct_for_challenge": true,  // Does this command help complete the challenge?
    "objective_completed": "created_vpc",  // Which objective this completes (null if none)
    "points_earned": 10,  // Points for this command (0-20 based on relevance)
    "aws_service": "ec2",  // The AWS service used
    "command_type": "create"  // describe, create, update, delete, list
}}

SCORING RULES:
- Correct command for challenge objective: 10-20 points
- Valid AWS command but not for objective: 5 points
- Syntax error or invalid command: 0 points
- Using hints reduces points by 25%

For errors, use exit_code > 0 and format output like real AWS CLI errors.
"""


# =============================================================================
# MAIN FUNCTIONS
# =============================================================================

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
        temperature=0.7,
    )
    return json.loads(response.choices[0].message.content)


async def simulate_cli_command(
    command: str,
    session: CLISession,
    challenge_context: Dict,
    user_level: str,
    cert_code: str,
    company_name: str,
    industry: str,
    business_context: str,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> CLIResponse:
    """
    Simulate an AWS CLI command and return realistic output.
    
    IMPORTANT: user_level, cert_code, and challenge_context are REQUIRED.
    CLI commands must be tailored to the specific challenge the user is working on.
    
    Args:
        command: The AWS CLI command to simulate
        session: Current CLI session with state
        challenge_context: Current challenge info (REQUIRED: title, description, aws_services)
        user_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        cert_code: Certification persona ID (REQUIRED, e.g., 'solutions-architect-associate')
        company_name: Company name for context (REQUIRED)
        industry: Industry for context (REQUIRED)
        business_context: Business scenario description (REQUIRED)
        api_key: Optional OpenAI API key
        model: Optional model override
        
    Returns:
        CLIResponse with realistic output and teaching content
    
    Raises:
        CLIValidationError: If user_level or cert_code are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_cli_params(user_level, cert_code)
    
    if not challenge_context:
        raise CLIValidationError(
            "challenge_context is required. CLI commands must be tailored to the specific "
            "challenge/scenario the user is working on."
        )
    
    # Get certification context (cert_code is now required and validated)
    if cert_code not in CERTIFICATION_PERSONAS:
        raise CLIValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    cert_name = persona["cert"]
    focus_areas = ", ".join(persona["focus"])
    
    # Build challenge context string (challenge_context is now required)
    challenge_str = f"""
Challenge: {challenge_context.get('title', 'Unknown')}
Description: {challenge_context.get('description', '')}
Relevant AWS Services: {', '.join(challenge_context.get('aws_services', []))}
Success Criteria: {', '.join(challenge_context.get('success_criteria', []))}
"""
    
    # Build objectives from success criteria
    objectives = challenge_context.get('success_criteria', [])
    challenge_objectives = "\n".join(f"- {obj}" for obj in objectives) if objectives else "Complete the challenge"
    
    # Fetch current AWS knowledge from database
    from utils import fetch_knowledge_for_generation
    aws_services = challenge_context.get('aws_services', [])
    topic = f"AWS CLI {' '.join(aws_services[:3])} commands"
    knowledge_context = await fetch_knowledge_for_generation(
        cert_code=cert_code,
        topic=topic,
        limit=5,
        api_key=api_key
    )
    
    # Build session resources string
    resources_str = json.dumps(session.resources_created, indent=2) if session.resources_created else "{}"
    
    # Build the system prompt
    system_prompt = CLI_SIMULATOR_PROMPT.format(
        user_level=user_level,
        cert_name=cert_name,
        focus_areas=focus_areas,
        challenge_context=challenge_str,
        challenge_objectives=challenge_objectives,
        company_name=company_name,
        industry=industry,
        business_context=business_context,
        account_id=session.current_account,
        region=session.current_region,
        session_resources=resources_str,
        cli_cheatsheet=AWS_CLI_CHEATSHEET,
    )
    
    # Include command history for context
    history_context = ""
    if session.commands_executed:
        recent = session.commands_executed[-5:]  # Last 5 commands
        history_context = f"\n\nRecent commands in this session:\n" + "\n".join(f"$ {cmd}" for cmd in recent)
    
    user_prompt = f"""Simulate this AWS CLI command:

$ {command}
{history_context}

{knowledge_context}

Return realistic AWS CLI output. If they're creating resources, generate realistic IDs.
If the command relates to their challenge, tailor the output to be educational."""

    result = await _chat_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        model=model,
        api_key=api_key,
    )
    
    # Update session with any created resources
    if result.get("resources_created"):
        session.resources_created.update(result["resources_created"])
    
    # Extract validation info
    exit_code = result.get("exit_code", 0)
    is_correct = result.get("is_correct_for_challenge", exit_code == 0)
    points = result.get("points_earned", 0)
    objective = result.get("objective_completed")
    aws_service = result.get("aws_service")
    
    # Update session progress
    session.total_commands += 1
    if is_correct and exit_code == 0:
        session.correct_commands += 1
        session.current_streak += 1
        session.best_streak = max(session.best_streak, session.current_streak)
    else:
        session.current_streak = 0
    
    if objective and objective not in session.objectives_completed:
        session.objectives_completed.append(objective)
    
    session.points_earned += points
    
    # Add command to history with metadata
    from datetime import datetime
    session.commands_executed.append({
        "command": command,
        "timestamp": datetime.now().isoformat(),
        "exitCode": exit_code,
        "isCorrect": is_correct,
        "service": aws_service,
        "points": points,
        "objective": objective,
    })
    
    return CLIResponse(
        command=command,
        output=result.get("output", ""),
        exit_code=exit_code,
        explanation=result.get("explanation"),
        next_steps=result.get("next_steps"),
        is_dangerous=result.get("is_dangerous", False),
        warning=result.get("warning"),
        is_correct_for_challenge=is_correct,
        objective_completed=objective,
        points_earned=points,
        aws_service=aws_service,
        command_type=result.get("command_type"),
    )


async def get_cli_help(
    topic: str,
    user_level: str,
    cert_code: str,
    challenge_context: Dict,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict:
    """
    Get contextual CLI help for a topic.
    
    IMPORTANT: user_level, cert_code, and challenge_context are REQUIRED.
    Help must be tailored to the user's certification and current challenge.
    
    Args:
        topic: AWS service or command to get help for (e.g., "ec2", "s3 cp", "vpc")
        user_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        cert_code: Certification persona ID (REQUIRED)
        challenge_context: Current challenge for tailored examples (REQUIRED)
        api_key: Optional OpenAI API key
        model: Optional model override
        
    Returns:
        Dict with help content, examples, and tips
    
    Raises:
        CLIValidationError: If user_level or cert_code are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_cli_params(user_level, cert_code)
    
    if not challenge_context:
        raise CLIValidationError(
            "challenge_context is required. CLI help must be tailored to the current challenge."
        )
    
    # Get certification context
    if cert_code not in CERTIFICATION_PERSONAS:
        raise CLIValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    cert_name = persona["cert"]
    focus_areas = ", ".join(persona["focus"])
    
    challenge_str = f"""
The user is working on this challenge:
- {challenge_context.get('title', '')}
- {challenge_context.get('description', '')}
- AWS Services: {', '.join(challenge_context.get('aws_services', []))}
Tailor examples to this context and their certification focus ({cert_name})."""

    system_prompt = f"""You are an AWS CLI tutor. Provide helpful, practical guidance.

User Profile:
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {focus_areas}

{challenge_str}

AWS CLI Reference:
{AWS_CLI_CHEATSHEET}

Return JSON with:
- topic: the topic they asked about
- summary: 2-3 sentence overview
- common_commands: list of most useful commands with descriptions
- examples: practical examples (tailored to their challenge if provided)
- tips: pro tips for this service/command
- gotchas: common mistakes to avoid
"""

    result = await _chat_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Help me understand: {topic}"},
        ],
        model=model or "gpt-4o-mini",  # Faster for help
        api_key=api_key,
    )
    
    return result


def create_session(
    challenge_id: Optional[str] = None,
    region: str = "us-east-1",
) -> CLISession:
    """Create a new CLI simulator session."""
    return CLISession(
        session_id=str(uuid.uuid4()),
        challenge_id=challenge_id,
        commands_executed=[],
        resources_created={},
        current_region=region,
        current_account="123456789012",
        correct_commands=0,
        total_commands=0,
        current_streak=0,
        best_streak=0,
        objectives_completed=[],
        points_earned=0,
    )


async def validate_cli_challenge(
    session: CLISession,
    challenge_context: Dict,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> CLIValidationResult:
    """
    Validate if the user's CLI commands completed the challenge objectives.
    
    Args:
        session: The CLI session with command history
        challenge_context: Challenge info with success_criteria
        
    Returns:
        CLIValidationResult with score and feedback
    """
    
    success_criteria = challenge_context.get('success_criteria', [])
    commands_run = [cmd.get('command', '') if isinstance(cmd, dict) else cmd 
                    for cmd in session.commands_executed]
    
    system_prompt = f"""You are evaluating a user's AWS CLI practice session.

CHALLENGE: {challenge_context.get('title', 'Unknown')}
DESCRIPTION: {challenge_context.get('description', '')}
REQUIRED AWS SERVICES: {', '.join(challenge_context.get('aws_services', []))}

SUCCESS CRITERIA (what they needed to accomplish):
{chr(10).join(f'- {c}' for c in success_criteria)}

COMMANDS THE USER RAN:
{chr(10).join(f'$ {cmd}' for cmd in commands_run)}

RESOURCES CREATED IN SESSION:
{json.dumps(session.resources_created, indent=2)}

Evaluate their CLI session and return JSON:
{{
    "is_complete": true/false,  // Did they meet ALL success criteria?
    "score": 0-100,  // Overall score
    "objectives_met": ["list of criteria they completed"],
    "objectives_missing": ["list of criteria they missed"],
    "correct_commands": ["commands that were correct for the challenge"],
    "incorrect_commands": ["commands that were wrong or unnecessary"],
    "feedback": "Constructive feedback on their CLI skills",
    "suggestions": ["What they should try next time"]
}}

Be encouraging but honest. Focus on learning."""

    result = await _chat_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Evaluate my CLI session."},
        ],
        model=model,
        api_key=api_key,
    )
    
    return CLIValidationResult(
        is_complete=result.get("is_complete", False),
        score=result.get("score", 0),
        objectives_met=result.get("objectives_met", []),
        objectives_missing=result.get("objectives_missing", []),
        correct_commands=result.get("correct_commands", []),
        incorrect_commands=result.get("incorrect_commands", []),
        feedback=result.get("feedback", ""),
        suggestions=result.get("suggestions", []),
    )


def get_session_stats(session: CLISession) -> Dict:
    """Get statistics from a CLI session for progress tracking."""
    return {
        "session_id": session.session_id,
        "challenge_id": session.challenge_id,
        "total_commands": session.total_commands,
        "correct_commands": session.correct_commands,
        "accuracy": round(session.correct_commands / max(session.total_commands, 1) * 100, 1),
        "current_streak": session.current_streak,
        "best_streak": session.best_streak,
        "objectives_completed": session.objectives_completed,
        "points_earned": session.points_earned,
        "resources_created": session.resources_created,
        "commands_run": session.commands_executed,
    }
