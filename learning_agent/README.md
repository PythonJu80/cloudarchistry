# CloudAcademy Learning Agent

AI-powered scenario generator for cloud architecture training.

## What It Does

1. **Receives a location/company** from the CloudAcademy world map
2. **Researches the business** via Brave web search
3. **Generates realistic cloud architecture scenarios** based on what that company actually does
4. **Provides coaching** through interactive chat

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/research` | POST | Research a company |
| `/generate-scenario` | POST | Generate a training scenario |
| `/chat` | POST | Interactive coaching chat |

## Environment Variables

```bash
# Required
OPENAI_API_KEY=your-openai-api-key
BRAVE_API_KEY=your-brave-api-key

# Optional
PORT=1027
```

## Running Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn agent:app --host 0.0.0.0 --port 1027 --reload
```

## Docker

```bash
# Build
docker build -t cloud-academy-agent .

# Run
docker run -p 1027:1027 \
  -e OPENAI_API_KEY=your-key \
  -e BRAVE_API_KEY=your-key \
  cloud-academy-agent
```

## Example Usage

### Research a Company

```bash
curl -X POST http://localhost:1027/research \
  -H "Content-Type: application/json" \
  -d '{"company_name": "Netflix", "industry": "Media & Streaming"}'
```

### Generate a Scenario

```bash
curl -X POST http://localhost:1027/generate-scenario \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "HSBC",
    "industry": "Banking & Finance",
    "user_level": "advanced"
  }'
```

### Chat with Coach

```bash
curl -X POST http://localhost:1027/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How should I design the VPC for a banking application?",
    "scenario_id": "abc123"
  }'
```

## Architecture

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  CloudAcademy   │────▶│  Learning Agent  │────▶│  Brave Search   │
│   (Frontend)    │     │   (This API)     │     │   (Web Data)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │   OpenAI GPT-4   │
                        │  (AI Reasoning)  │
                        └──────────────────┘
```

## Agents

1. **Research Agent** (GPT-4o-mini) - Analyzes company information
2. **Scenario Agent** (GPT-4o) - Generates training scenarios
3. **Coach Agent** (GPT-4o) - Provides learning guidance
