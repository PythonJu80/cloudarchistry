"""
Resource fetcher for study guide - uses existing Crawl4AI crawler.
Fetches diverse resources: YouTube, AWS docs, blogs, courses, community content.
"""
from typing import List, Dict
from config.settings import logger
import re
import asyncio

from crawl.context import get_context
from crawl4ai import CrawlerRunConfig, CacheMode


async def fetch_study_resources(
    certification: str,
    skill_level: str,
    learning_styles: List[str],
    max_resources: int = 8
) -> List[Dict]:
    """
    Fetch diverse learning resources for a certification.
    Searches multiple sources: YouTube, AWS docs, blogs, courses, community.
    """
    resources = []
    cert_name = certification.replace('-', ' ')
    cert_title = cert_name.title()
    
    try:
        ctx = await get_context()
        crawler = ctx.crawler
        run_config = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, stream=False)
        
        logger.info(f"Fetching diverse resources for {cert_name}, level: {skill_level}, styles: {learning_styles}")
        
        # Tailor search queries based on skill level
        level_terms = {
            "beginner": ["beginner", "introduction", "basics", "getting started", "from scratch"],
            "intermediate": ["deep dive", "hands on", "practical", "real world"],
            "advanced": ["advanced", "expert", "professional", "in depth", "architecture patterns"],
        }
        level_modifiers = level_terms.get(skill_level.lower(), level_terms["intermediate"])
        
        # Run multiple searches in parallel for speed
        search_tasks = []
        
        # 1. YouTube - varied search queries tailored to skill level
        youtube_queries = [
            f"AWS {cert_name} certification {level_modifiers[0]} course 2024",
            f"AWS {cert_name} exam tips {skill_level}",
            f"AWS {cert_name} {level_modifiers[1]} tutorial",
        ]
        for query in youtube_queries[:2]:  # Limit to 2 YouTube searches
            search_tasks.append(_fetch_youtube_videos(crawler, run_config, query, cert_title, max_per_query=2))
        
        # 2. AWS official resources
        search_tasks.append(_fetch_aws_resources(crawler, run_config, certification, cert_title))
        
        # 3. Blog/article search tailored to skill level
        blog_queries = [
            f"AWS {cert_name} {skill_level} study guide",
            f"AWS {cert_name} exam preparation {level_modifiers[0]}",
        ]
        for query in blog_queries[:1]:
            search_tasks.append(_fetch_blog_resources(crawler, run_config, query, cert_title))
        
        # 4. Community resources (Reddit, dev.to)
        search_tasks.append(_fetch_community_resources(crawler, run_config, cert_name, cert_title, skill_level))
        
        # 5. Free course platforms
        search_tasks.append(_fetch_course_resources(crawler, run_config, cert_name, cert_title, skill_level))
        
        # Execute all searches in parallel
        results = await asyncio.gather(*search_tasks, return_exceptions=True)
        
        # Flatten results
        for result in results:
            if isinstance(result, list):
                resources.extend(result)
            elif isinstance(result, Exception):
                logger.warning(f"Search task failed: {result}")
        
        # Deduplicate by URL
        seen_urls = set()
        unique_resources = []
        for r in resources:
            if r["url"] not in seen_urls:
                seen_urls.add(r["url"])
                unique_resources.append(r)
        
        logger.info(f"Total unique resources fetched: {len(unique_resources)}")
        return unique_resources[:max_resources]
        
    except Exception as e:
        logger.error(f"Resource fetching failed: {type(e).__name__}: {e}")
        return []


async def _fetch_youtube_videos(crawler, config, query: str, cert_title: str, max_per_query: int = 2) -> List[Dict]:
    """Fetch YouTube videos for a search query."""
    resources = []
    try:
        search_url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
        result = await crawler.arun(url=search_url, config=config)
        
        if result.success and result.html:
            # Extract video IDs and titles
            video_pattern = r'/watch\?v=([a-zA-Z0-9_-]{11})'
            video_ids = re.findall(video_pattern, result.html)
            
            # Try to extract titles from the HTML
            title_pattern = r'title="([^"]{10,100})"[^>]*aria-label'
            titles = re.findall(title_pattern, result.html)
            
            seen_ids = set()
            for i, video_id in enumerate(video_ids):
                if video_id not in seen_ids and len(resources) < max_per_query:
                    seen_ids.add(video_id)
                    # Use extracted title or generate one
                    title = titles[i] if i < len(titles) else f"{cert_title} Tutorial"
                    # Clean up title
                    title = title[:80] + "..." if len(title) > 80 else title
                    resources.append({
                        "title": title,
                        "url": f"https://www.youtube.com/watch?v={video_id}",
                        "type": "video",
                        "description": f"Video: {query}"
                    })
    except Exception as e:
        logger.warning(f"YouTube search failed for '{query}': {e}")
    
    return resources


async def _fetch_aws_resources(crawler, config, certification: str, cert_title: str) -> List[Dict]:
    """Fetch AWS official resources: cert page, exam guide, whitepapers."""
    resources = []
    try:
        cert_url = f"https://aws.amazon.com/certification/{certification}/"
        result = await crawler.arun(url=cert_url, config=config)
        
        if result.success and result.html:
            # Main certification page
            resources.append({
                "title": f"AWS {cert_title} - Official Certification Page",
                "url": cert_url,
                "type": "documentation",
                "description": "Official AWS certification details, exam info, and registration"
            })
            
            # Extract exam guide PDF
            guide_pattern = r'href="(https://[^"]*exam[^"]*guide[^"]*\.pdf)"'
            guide_matches = re.findall(guide_pattern, result.html, re.IGNORECASE)
            if guide_matches:
                resources.append({
                    "title": f"{cert_title} Exam Guide (PDF)",
                    "url": guide_matches[0],
                    "type": "whitepaper",
                    "description": "Official exam guide with domains, objectives, and weightings"
                })
            
            # Extract sample questions PDF
            sample_pattern = r'href="(https://[^"]*sample[^"]*question[^"]*\.pdf)"'
            sample_matches = re.findall(sample_pattern, result.html, re.IGNORECASE)
            if sample_matches:
                resources.append({
                    "title": f"{cert_title} Sample Questions (PDF)",
                    "url": sample_matches[0],
                    "type": "whitepaper",
                    "description": "Official sample exam questions from AWS"
                })
            
            # AWS Skill Builder link
            if "skillbuilder" in result.html.lower() or "skill builder" in result.html.lower():
                resources.append({
                    "title": "AWS Skill Builder - Free Training",
                    "url": "https://skillbuilder.aws/",
                    "type": "course",
                    "description": "Free official AWS training courses and learning paths"
                })
                
    except Exception as e:
        logger.warning(f"AWS resources fetch failed: {e}")
    
    return resources


async def _fetch_blog_resources(crawler, config, query: str, cert_title: str) -> List[Dict]:
    """Fetch blog articles via DuckDuckGo search."""
    resources = []
    try:
        # Use DuckDuckGo HTML search (doesn't require JS)
        search_url = f"https://html.duckduckgo.com/html/?q={query.replace(' ', '+')}"
        result = await crawler.arun(url=search_url, config=config)
        
        if result.success and result.html:
            # Extract result links and titles
            # DuckDuckGo HTML format: <a class="result__a" href="...">title</a>
            link_pattern = r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)</a>'
            matches = re.findall(link_pattern, result.html)
            
            from urllib.parse import unquote
            
            for url, title in matches[:6]:
                # Skip ads (duckduckgo.com/y.js are ads)
                if 'duckduckgo.com/y.js' in url or 'ad_provider' in url:
                    continue
                # Skip unwanted domains
                if any(skip in url.lower() for skip in ['amazon.com/dp', 'udemy.com', 'coursera.org', 'linkedin.com/learning']):
                    continue
                # Clean URL (DuckDuckGo wraps URLs with uddg parameter)
                if 'uddg=' in url:
                    url_match = re.search(r'uddg=([^&]+)', url)
                    if url_match:
                        url = unquote(url_match.group(1))
                
                # Only add if we have a clean URL
                if url.startswith('http') and 'duckduckgo' not in url:
                    resources.append({
                        "title": title.strip()[:80],
                        "url": url,
                        "type": "article",
                        "description": f"Blog/article about {cert_title} preparation"
                    })
                    if len(resources) >= 3:
                        break
                
    except Exception as e:
        logger.warning(f"Blog search failed for '{query}': {e}")
    
    return resources


async def _fetch_community_resources(crawler, config, cert_name: str, cert_title: str, skill_level: str = "intermediate") -> List[Dict]:
    """Fetch community resources from Reddit, dev.to, etc."""
    resources = []
    
    # Reddit search - include skill level for more relevant results
    try:
        search_term = f"{cert_name} {skill_level}".replace(' ', '+')
        reddit_url = f"https://www.reddit.com/r/AWSCertifications/search/?q={search_term}&restrict_sr=1&sort=top&t=year"
        result = await crawler.arun(url=reddit_url, config=config)
        
        if result.success and result.html:
            # Extract post links
            post_pattern = r'href="(/r/AWSCertifications/comments/[^"]+)"'
            posts = re.findall(post_pattern, result.html)
            
            if posts:
                resources.append({
                    "title": f"r/AWSCertifications - {cert_title} ({skill_level.title()}) Discussions",
                    "url": f"https://www.reddit.com/r/AWSCertifications/search/?q={search_term}&restrict_sr=1&sort=top",
                    "type": "community",
                    "description": "Reddit community discussions, study tips, and exam experiences"
                })
    except Exception as e:
        logger.warning(f"Reddit search failed: {e}")
    
    # Dev.to search
    try:
        devto_url = f"https://dev.to/search?q=AWS+{cert_name.replace(' ', '+')}"
        result = await crawler.arun(url=devto_url, config=config)
        
        if result.success and result.html:
            # Check if there are articles
            if 'crayons-story' in result.html or 'article' in result.html.lower():
                resources.append({
                    "title": f"Dev.to - AWS {cert_title} Articles",
                    "url": devto_url,
                    "type": "article",
                    "description": "Developer community articles and tutorials"
                })
    except Exception as e:
        logger.warning(f"Dev.to search failed: {e}")
    
    return resources


async def _fetch_course_resources(crawler, config, cert_name: str, cert_title: str, skill_level: str = "intermediate") -> List[Dict]:
    """Fetch free course resources tailored to skill level."""
    resources = []
    
    # Skill-level appropriate course search
    level_course_terms = {
        "beginner": "beginner introduction",
        "intermediate": "complete course",
        "advanced": "advanced professional",
    }
    course_term = level_course_terms.get(skill_level.lower(), "complete course")
    
    # FreeCodeCamp YouTube (known good content)
    try:
        fcc_url = f"https://www.youtube.com/results?search_query=freecodecamp+AWS+{cert_name.replace(' ', '+')}+{course_term.replace(' ', '+')}"
        result = await crawler.arun(url=fcc_url, config=config)
        
        if result.success and result.html:
            video_pattern = r'/watch\?v=([a-zA-Z0-9_-]{11})'
            video_ids = re.findall(video_pattern, result.html)
            
            if video_ids:
                resources.append({
                    "title": f"freeCodeCamp - AWS {cert_title} Full Course",
                    "url": f"https://www.youtube.com/watch?v={video_ids[0]}",
                    "type": "course",
                    "description": "Free comprehensive course from freeCodeCamp"
                })
    except Exception as e:
        logger.warning(f"FreeCodeCamp search failed: {e}")
    
    # AWS Skill Builder (always relevant)
    resources.append({
        "title": "AWS Skill Builder - Official Free Training",
        "url": f"https://explore.skillbuilder.aws/learn/course/external/view/elearning/134/aws-cloud-practitioner-essentials",
        "type": "course",
        "description": "Free official AWS training with hands-on labs"
    })
    
    return resources
