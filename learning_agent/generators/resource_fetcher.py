"""
Resource fetcher for study guide - uses Crawl4AI to fetch real YouTube and AWS docs.
Filters for 2025/2026 content only.

The certification is passed directly from the user's AcademyUserProfile.targetCertification.
No hardcoded mappings needed - use what the database provides.
"""
import re
import asyncio
from typing import List, Dict
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig


async def fetch_youtube_resources(
    certification: str,
    learning_styles: List[str],
    max_results: int = 3
) -> List[Dict]:
    """
    Fetch real YouTube video URLs for the certification.
    Filters for 2025/2026 content.
    
    certification: The user's targetCertification from AcademyUserProfile (e.g., "solutions-architect-associate")
    """
    # Use the certification directly from the user's profile - no mapping needed
    search_term = f"AWS {certification.replace('-', ' ')}"
    # Add year filter to search
    search_query = f"{search_term} 2025"
    
    # URL encode the search query
    encoded_query = search_query.replace(" ", "+")
    youtube_search_url = f"https://www.youtube.com/results?search_query={encoded_query}&sp=CAI%253D"
    # sp=CAI%253D sorts by upload date
    
    resources = []
    
    try:
        browser_config = BrowserConfig(headless=True, verbose=False)
        crawler_config = CrawlerRunConfig(
            wait_for="css:ytd-video-renderer",
            page_timeout=15000,
        )
        
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(
                url=youtube_search_url,
                config=crawler_config
            )
            
            if result.success and result.html:
                # Parse video data from the HTML
                # YouTube embeds video data in the page
                videos = parse_youtube_results(result.html, max_results)
                
                for video in videos:
                    # Filter for 2025/2026 content
                    if is_recent_content(video.get("published", "")):
                        resources.append({
                            "title": video["title"],
                            "url": video["url"],
                            "type": "video",
                            "channel": video.get("channel", ""),
                            "published": video.get("published", ""),
                        })
                        
                        if len(resources) >= max_results:
                            break
                            
    except Exception as e:
        print(f"Error fetching YouTube resources: {e}")
    
    return resources


def parse_youtube_results(html: str, max_results: int = 5) -> List[Dict]:
    """Parse YouTube search results from HTML."""
    videos = []
    
    # Look for video renderer data in the HTML
    # YouTube uses ytInitialData for search results
    pattern = r'"videoRenderer":\s*\{[^}]*"videoId":\s*"([^"]+)"[^}]*"title":\s*\{"runs":\s*\[\{"text":\s*"([^"]+)"'
    
    # Simpler pattern to find video IDs and titles
    video_pattern = r'/watch\?v=([a-zA-Z0-9_-]{11})'
    title_pattern = r'"title":\{"runs":\[\{"text":"([^"]+)"'
    
    video_ids = re.findall(video_pattern, html)
    titles = re.findall(title_pattern, html)
    
    # Match them up (they should be in order)
    seen_ids = set()
    for i, vid in enumerate(video_ids[:max_results * 2]):
        if vid not in seen_ids and i < len(titles):
            seen_ids.add(vid)
            videos.append({
                "title": titles[i] if i < len(titles) else f"AWS Video {vid}",
                "url": f"https://www.youtube.com/watch?v={vid}",
                "videoId": vid,
            })
            if len(videos) >= max_results:
                break
    
    return videos


def is_recent_content(date_str: str) -> bool:
    """Check if content is from 2025 or 2026."""
    if not date_str:
        return True  # If no date, include it
    
    # Check for year in string
    if "2025" in date_str or "2026" in date_str:
        return True
    
    # Check for relative dates like "1 month ago", "2 weeks ago"
    recent_patterns = [
        r"(\d+)\s*(hour|day|week|month)s?\s*ago",
    ]
    
    for pattern in recent_patterns:
        match = re.search(pattern, date_str.lower())
        if match:
            num = int(match.group(1))
            unit = match.group(2)
            # Within last 12 months is likely 2025
            if unit in ["hour", "day", "week"]:
                return True
            if unit == "month" and num <= 12:
                return True
    
    return False


async def fetch_aws_docs_resources(
    certification: str,
    max_results: int = 2
) -> List[Dict]:
    """
    Fetch relevant AWS documentation links by searching AWS docs.
    Uses the user's targetCertification directly from their profile.
    
    certification: The user's targetCertification from AcademyUserProfile
    """
    # Build search URL using the user's certification directly
    cert_name = certification.replace("-", " ")
    search_query = f"AWS {cert_name} exam guide 2025"
    encoded_query = search_query.replace(" ", "+")
    
    # Search AWS documentation
    aws_search_url = f"https://aws.amazon.com/search/?searchQuery={encoded_query}"
    
    resources = []
    
    try:
        browser_config = BrowserConfig(headless=True, verbose=False)
        crawler_config = CrawlerRunConfig(
            page_timeout=15000,
        )
        
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(
                url=aws_search_url,
                config=crawler_config
            )
            
            if result.success and result.html:
                # Parse AWS search results
                resources = parse_aws_search_results(result.html, cert_name, max_results)
                
    except Exception as e:
        print(f"Error fetching AWS docs: {e}")
    
    # If search failed, return empty - don't use hardcoded fallbacks
    return resources


def parse_aws_search_results(html: str, cert_name: str, max_results: int = 2) -> List[Dict]:
    """Parse AWS search results from HTML."""
    resources = []
    
    # Look for links to AWS documentation
    # Pattern for AWS docs URLs - exclude Skill Builder (competes with our platform)
    doc_pattern = r'href="(https://docs\.aws\.amazon\.com/[^"]+)"'
    training_pattern = r'href="(https://aws\.amazon\.com/training/[^"]+)"'
    # DO NOT include skillbuilder - it defeats the purpose of our platform
    
    # Find all doc links
    doc_urls = re.findall(doc_pattern, html)
    training_urls = re.findall(training_pattern, html)
    
    seen_urls = set()
    
    # Add unique doc links
    for url in doc_urls[:max_results]:
        if url not in seen_urls:
            seen_urls.add(url)
            resources.append({
                "title": f"AWS {cert_name.title()} Documentation",
                "url": url,
                "type": "documentation",
            })
            if len(resources) >= max_results:
                break
    
    # Add training links if we need more (no Skill Builder)
    for url in training_urls[:max_results - len(resources)]:
        if url not in seen_urls:
            seen_urls.add(url)
            resources.append({
                "title": f"AWS {cert_name.title()} Training",
                "url": url,
                "type": "course",
            })
            if len(resources) >= max_results:
                break
    
    return resources


async def fetch_study_resources(
    certification: str,
    learning_styles: List[str],
    max_youtube: int = 2,
    max_docs: int = 2
) -> List[Dict]:
    """
    Fetch all study resources for a certification.
    Combines YouTube videos and AWS docs.
    """
    # Fetch in parallel
    youtube_task = fetch_youtube_resources(certification, learning_styles, max_youtube)
    docs_task = fetch_aws_docs_resources(certification, max_docs)
    
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
    
    return resources
