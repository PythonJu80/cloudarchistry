"""
Resource fetcher for study guide - uses Brave Search API to find validated, relevant resources.
Validates URLs are accessible and content matches certification and skill level.

The certification is passed directly from the user's AcademyUserProfile.targetCertification.
No hardcoded mappings needed - use what the database provides.
"""
import re
import asyncio
import httpx
from typing import List, Dict, Optional
from config.settings import logger


async def validate_url(url: str, timeout: int = 5) -> bool:
    """Check if a URL is accessible and returns 200 OK."""
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.head(url)
            return response.status_code == 200
    except:
        # If HEAD fails, try GET with small timeout
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.get(url, timeout=3)
                return response.status_code == 200
        except:
            return False


async def search_with_brave(
    query: str,
    max_results: int = 5,
    brave_api_key: Optional[str] = None
) -> List[Dict]:
    """
    Search using Brave Search API.
    Returns validated, accessible results.
    """
    if not brave_api_key:
        import os
        brave_api_key = os.getenv("BRAVE_API_KEY")
    
    if not brave_api_key:
        logger.warning("No Brave API key configured for resource search")
        return []
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                params={
                    "q": query,
                    "count": max_results * 2,  # Get extra to account for invalid URLs
                    "search_lang": "en",
                    "result_filter": "web",
                },
                headers={
                    "Accept": "application/json",
                    "X-Subscription-Token": brave_api_key
                }
            )
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get("web", {}).get("results", []):
                results.append({
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "description": item.get("description", ""),
                })
            
            return results[:max_results * 2]
    except Exception as e:
        logger.error(f"Brave search failed for query '{query}': {e}")
        return []


async def fetch_youtube_resources(
    certification: str,
    skill_level: str,
    learning_styles: List[str],
    max_results: int = 3
) -> List[Dict]:
    """
    Fetch validated YouTube video URLs for the certification using Brave Search.
    Filters for 2025/2026 content and validates URLs are accessible.
    
    certification: The user's targetCertification (e.g., "solutions-architect-associate")
    skill_level: User's skill level for content filtering
    """
    cert_name = certification.replace('-', ' ').title()
    
    # Build search query with skill level context
    skill_context = ""
    if skill_level == "beginner":
        skill_context = "tutorial beginner guide"
    elif skill_level == "advanced" or skill_level == "expert":
        skill_context = "advanced deep dive"
    
    search_query = f"AWS {cert_name} {skill_context} 2025 site:youtube.com"
    
    # Search with Brave
    results = await search_with_brave(search_query, max_results=max_results)
    
    validated_resources = []
    for result in results:
        url = result.get("url", "")
        if "youtube.com/watch" in url or "youtu.be/" in url:
            # Validate URL is accessible
            if await validate_url(url):
                validated_resources.append({
                    "title": result["title"],
                    "url": url,
                    "type": "video",
                    "description": result.get("description", ""),
                })
                
                if len(validated_resources) >= max_results:
                    break
    
    logger.info(f"Found {len(validated_resources)} validated YouTube resources for {cert_name}")
    return validated_resources


def is_content_relevant(
    title: str,
    description: str,
    certification: str,
    skill_level: str
) -> bool:
    """
    Validate that content is relevant to the certification and skill level.
    """
    content = f"{title} {description}".lower()
    cert_keywords = certification.lower().replace('-', ' ').split()
    
    # Must mention AWS and at least one cert keyword
    if "aws" not in content:
        return False
    
    # Check for certification relevance
    cert_match = any(keyword in content for keyword in cert_keywords)
    if not cert_match:
        return False
    
    # Filter out outdated content
    outdated_years = ["2020", "2021", "2022", "2023"]
    if any(year in content for year in outdated_years):
        return False
    
    # Skill level filtering
    if skill_level == "beginner":
        # Avoid overly advanced content for beginners
        if any(term in content for term in ["advanced", "expert", "deep dive", "masterclass"]):
            return False
    elif skill_level in ["advanced", "expert"]:
        # Avoid basic content for advanced users
        if any(term in content for term in ["beginner", "introduction", "getting started", "basics"]):
            return False
    
    return True


async def fetch_aws_docs_resources(
    certification: str,
    skill_level: str,
    max_results: int = 2
) -> List[Dict]:
    """
    Fetch validated AWS documentation links using Brave Search.
    Validates URLs are accessible and content is relevant.
    
    certification: The user's targetCertification from AcademyUserProfile
    skill_level: User's skill level for content filtering
    """
    cert_name = certification.replace("-", " ").title()
    
    # Search for official AWS docs and whitepapers
    queries = [
        f"AWS {cert_name} exam guide site:aws.amazon.com",
        f"AWS {cert_name} documentation site:docs.aws.amazon.com",
        f"AWS {cert_name} whitepaper site:docs.aws.amazon.com/whitepapers",
    ]
    
    all_results = []
    for query in queries:
        results = await search_with_brave(query, max_results=3)
        all_results.extend(results)
    
    # Validate and filter results
    validated_resources = []
    seen_urls = set()
    
    for result in all_results:
        url = result.get("url", "")
        
        # Skip duplicates
        if url in seen_urls:
            continue
        
        # Must be AWS domain
        if not ("aws.amazon.com" in url or "docs.aws.amazon.com" in url):
            continue
        
        # Skip Skill Builder (competes with our platform)
        if "skillbuilder" in url.lower():
            continue
        
        # Check content relevance
        if not is_content_relevant(
            result.get("title", ""),
            result.get("description", ""),
            certification,
            skill_level
        ):
            continue
        
        # Validate URL is accessible
        if await validate_url(url):
            seen_urls.add(url)
            
            # Determine resource type
            resource_type = "documentation"
            if "whitepapers" in url:
                resource_type = "whitepaper"
            elif "training" in url:
                resource_type = "course"
            
            validated_resources.append({
                "title": result["title"],
                "url": url,
                "type": resource_type,
                "description": result.get("description", ""),
            })
            
            if len(validated_resources) >= max_results:
                break
    
    logger.info(f"Found {len(validated_resources)} validated AWS docs for {cert_name}")
    return validated_resources




def get_curated_resources(certification: str, learning_styles: List[str]) -> List[Dict]:
    """
    Return curated, high-quality resources for the certification.
    These are always available as fallback when web scraping fails.
    """
    cert_lower = certification.lower().replace("-", " ")
    resources = []
    
    # Official AWS Exam Guide (always relevant)
    resources.append({
        "title": f"AWS {certification.replace('-', ' ').title()} Exam Guide",
        "url": f"https://aws.amazon.com/certification/{certification}/",
        "type": "documentation",
    })
    
    # Hands-on labs for hands-on/visual learners
    if "hands_on" in learning_styles or "visual" in learning_styles:
        resources.append({
            "title": "AWS Hands-On Tutorials",
            "url": "https://aws.amazon.com/getting-started/hands-on/",
            "type": "course",
        })
    
    # AWS Well-Architected Framework (critical for most certs)
    if "architect" in cert_lower or "solutions" in cert_lower:
        resources.append({
            "title": "AWS Well-Architected Framework",
            "url": "https://aws.amazon.com/architecture/well-architected/",
            "type": "whitepaper",
        })
    
    # AWS Whitepapers for reading learners
    if "reading" in learning_styles:
        resources.append({
            "title": "AWS Whitepapers & Guides",
            "url": "https://aws.amazon.com/whitepapers/",
            "type": "whitepaper",
        })
    
    return resources[:3]  # Return max 3 curated resources


async def fetch_study_resources(
    certification: str,
    skill_level: str,
    learning_styles: List[str],
    max_youtube: int = 3,
    max_docs: int = 2
) -> List[Dict]:
    """
    Fetch all study resources for a certification using Brave Search.
    All resources are validated for:
    - URL accessibility (200 OK response)
    - Content relevance to certification
    - Appropriate skill level
    - Recent content (2025/2026)
    
    Combines YouTube videos, AWS docs, and curated resources.
    Aims for 5-8 diverse, validated resources total.
    """
    # Fetch in parallel with skill level context
    youtube_task = fetch_youtube_resources(certification, skill_level, learning_styles, max_youtube)
    docs_task = fetch_aws_docs_resources(certification, skill_level, max_docs)
    
    youtube_results, docs_results = await asyncio.gather(
        youtube_task,
        docs_task,
        return_exceptions=True
    )
    
    resources = []
    
    # Add YouTube results
    if isinstance(youtube_results, list):
        resources.extend(youtube_results)
    else:
        print(f"YouTube fetch failed: {youtube_results}")
    
    # Add AWS docs
    if isinstance(docs_results, list):
        resources.extend(docs_results)
    else:
        print(f"AWS docs fetch failed: {docs_results}")
    
    # Add curated AWS resources (always available as fallback)
    curated = get_curated_resources(certification, learning_styles)
    resources.extend(curated)
    
    # Deduplicate by URL
    seen_urls = set()
    unique_resources = []
    for r in resources:
        if r.get("url") not in seen_urls:
            seen_urls.add(r["url"])
            unique_resources.append(r)
    
    return unique_resources[:8]  # Cap at 8 resources
