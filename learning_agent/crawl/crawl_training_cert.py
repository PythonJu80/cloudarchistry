#!/usr/bin/env python3
"""
Script to crawl AWS Training, Certification, and Product pages at MAXIMUM DEPTH.
All URLs verified as working. Will clean database after.
"""

import asyncio
import httpx
import time
from typing import Dict

# Crawl service endpoint
CRAWL_API_URL = "http://10.121.19.210:1027/api/crawl/smart"
STATUS_API_URL = "http://10.121.19.210:1027/api/crawl/status"
DEFAULT_TENANT_ID = "default"

# Maximum depth and high concurrency for comprehensive crawling
MAX_DEPTH = 5
MAX_CONCURRENT = 20

# Verified working URLs
CRAWL_URLS = [
    # Training URLs
    "https://aws.amazon.com/training/",
    "https://aws.amazon.com/training/learn-about/",
    "https://aws.amazon.com/training/digital/",
    "https://aws.amazon.com/training/classroom/",
    "https://aws.amazon.com/training/events/",
    "https://aws.amazon.com/education/awseducate/",
    "https://aws.amazon.com/partners/training/",
    
    # Certification URLs
    "https://aws.amazon.com/certification/",
    "https://aws.amazon.com/certification/certified-cloud-practitioner/",
    
    # Documentation & Products
    "https://docs.aws.amazon.com/whitepapers/latest/aws-overview/amazon-web-services-cloud-platform.html",
    "https://aws.amazon.com/products/",
    "https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/",
]


async def start_crawl(url: str, depth: int, concurrent: int, tenant_id: str = DEFAULT_TENANT_ID) -> Dict:
    """Start a crawl job for a given URL."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            params = {
                "url": url,
                "max_depth": depth,
                "max_concurrent": concurrent,
                "tenant_id": tenant_id,
            }
            response = await client.post(CRAWL_API_URL, params=params)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"❌ Error starting crawl for {url}: {e}")
            return {"success": False, "error": str(e)}


async def check_crawl_status(job_id: str) -> Dict:
    """Check the status of a crawl job."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(f"{STATUS_API_URL}/{job_id}")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"status": "error", "error": str(e)}


async def wait_for_crawl_completion(job_id: str, url: str, max_wait_seconds: int = 1200) -> bool:
    """Wait for a crawl job to complete (20 min timeout for deep crawls)."""
    start_time = time.time()
    last_status_print = 0
    
    while time.time() - start_time < max_wait_seconds:
        status_data = await check_crawl_status(job_id)
        
        if status_data.get("status") == "completed":
            result = status_data.get("result", {})
            pages = result.get("pages_crawled", 0)
            words = result.get("total_words", 0)
            print(f"  ✅ COMPLETED: {pages} pages, {words:,} words indexed")
            return True
        elif status_data.get("status") == "failed":
            error = status_data.get("error", "Unknown error")
            print(f"  ❌ FAILED: {error}")
            return False
        
        # Print status update every 30 seconds
        elapsed = time.time() - start_time
        if elapsed - last_status_print >= 30:
            print(f"  ⏳ Still crawling... ({int(elapsed)}s elapsed)")
            last_status_print = elapsed
        
        await asyncio.sleep(5)
    
    print(f"  ⏱️  TIMEOUT after {max_wait_seconds}s")
    return False


async def main():
    """Main crawl orchestrator."""
    print("╔════════════════════════════════════════════════════════════════════════════╗")
    print("║          AWS Training & Certification Crawler - MAXIMUM DEPTH             ║")
    print("╚════════════════════════════════════════════════════════════════════════════╝")
    print(f"\n📊 Total URLs: {len(CRAWL_URLS)}")
    print(f"📊 Depth: {MAX_DEPTH} levels")
    print(f"📊 Concurrent: {MAX_CONCURRENT} pages")
    print(f"\n{'='*80}\n")
    
    start_time = time.time()
    successful = 0
    failed = 0
    
    for i, url in enumerate(CRAWL_URLS, 1):
        print(f"[{i}/{len(CRAWL_URLS)}] 🚀 Crawling: {url}")
        
        # Start crawl
        result = await start_crawl(url, MAX_DEPTH, MAX_CONCURRENT)
        
        if result.get("success") and result.get("job_id"):
            job_id = result["job_id"]
            print(f"  📋 Job ID: {job_id}")
            
            # Wait for completion
            success = await wait_for_crawl_completion(job_id, url)
            if success:
                successful += 1
            else:
                failed += 1
                
        elif result.get("rate_limit"):
            limits = result.get("rate_limit", {})
            print(f"  ⚠️  RATE LIMITED: {limits}")
            print(f"  ⏸️  Waiting 90 seconds...")
            await asyncio.sleep(90)
            failed += 1
        else:
            error = result.get("error", "Unknown error")
            print(f"  ❌ FAILED TO START: {error}")
            failed += 1
        
        # Delay between crawls
        if i < len(CRAWL_URLS):
            print(f"\n  ⏸️  Waiting 5 seconds before next crawl...\n")
            await asyncio.sleep(5)
    
    elapsed_time = time.time() - start_time
    hours = int(elapsed_time // 3600)
    minutes = int((elapsed_time % 3600) // 60)
    seconds = int(elapsed_time % 60)
    
    print(f"\n{'='*80}")
    print(f"✅ CRAWLING COMPLETE!")
    print(f"{'='*80}")
    print(f"⏱️  Total time: {hours}h {minutes}m {seconds}s")
    print(f"✅ Successful: {successful}/{len(CRAWL_URLS)}")
    print(f"❌ Failed: {failed}/{len(CRAWL_URLS)}")
    print(f"\n💡 Next: Clean the database to remove unwanted content")


if __name__ == "__main__":
    asyncio.run(main())
