FROM python:3.12-slim

ARG PORT=1027

WORKDIR /app

# Install system dependencies including curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Copy the MCP server files
COPY . .

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app

# Install packages directly to the system (no virtual environment)
RUN uv pip install --system -e .

# Run crawl4ai-setup as root but set PLAYWRIGHT_BROWSERS_PATH so browsers go to shared location
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
RUN mkdir -p /opt/playwright-browsers && \
    crawl4ai-setup && \
    chmod -R 755 /opt/playwright-browsers

USER appuser

EXPOSE ${PORT}

# Command to run the agent with gunicorn for production
CMD ["gunicorn", "-c", "gunicorn.conf.py", "crawl4ai_mcp:app"]
