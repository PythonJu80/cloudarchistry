#!/usr/bin/env python3
"""
Script to crawl all AWS documentation and certification pages.
This will systematically crawl AWS services and certification content.
"""

import asyncio
import httpx
import time
from typing import List, Dict

# Crawl service endpoint
CRAWL_API_URL = "http://10.121.19.210:1027/api/crawl/smart"
STATUS_API_URL = "http://10.121.19.210:1027/api/crawl/status"

# Default tenant ID for crawling
DEFAULT_TENANT_ID = "default"


# AWS URLs to crawl with their recommended depths
CRAWL_TARGETS = [
    # PHASE 1: AWS Certifications (High Priority)
    {
        "urls": [
            "https://aws.amazon.com/certification/",
            "https://aws.amazon.com/certification/certified-cloud-practitioner/",
            "https://aws.amazon.com/certification/certified-solutions-architect-associate/",
            "https://aws.amazon.com/certification/certified-solutions-architect-professional/",
            "https://aws.amazon.com/certification/certified-developer-associate/",
            "https://aws.amazon.com/certification/certified-sysops-admin-associate/",
            "https://aws.amazon.com/certification/certified-devops-engineer-professional/",
            "https://aws.amazon.com/certification/certified-security-specialty/",
            "https://aws.amazon.com/certification/certified-database-specialty/",
            "https://aws.amazon.com/certification/certified-data-analytics-specialty/",
            "https://aws.amazon.com/certification/certified-machine-learning-specialty/",
        ],
        "depth": 3,
        "concurrent": 10,
        "phase": "Certifications"
    },
    
    # PHASE 2: AWS Training
    {
        "urls": [
            "https://aws.amazon.com/training/",
        ],
        "depth": 3,
        "concurrent": 10,
        "phase": "Training"
    },
    
    # PHASE 3: Core Compute Services
    {
        "urls": [
            "https://docs.aws.amazon.com/lambda/latest/dg/welcome.html",
            "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html",
            "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html",
            "https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html",
        ],
        "depth": 4,
        "concurrent": 15,
        "phase": "Compute Services"
    },
    
    # PHASE 4: Storage Services
    {
        "urls": [
            "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html",
            "https://docs.aws.amazon.com/AmazonEFS/latest/ug/whatisefs.html",
            "https://docs.aws.amazon.com/ebs/latest/userguide/what-is-ebs.html",
        ],
        "depth": 5,
        "concurrent": 15,
        "phase": "Storage Services"
    },
    
    # PHASE 5: Database Services
    {
        "urls": [
            "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html",
            "https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/WhatIs.html",
            "https://docs.aws.amazon.com/redshift/latest/mgmt/welcome.html",
        ],
        "depth": 5,
        "concurrent": 15,
        "phase": "Database Services"
    },
    
    # PHASE 6: Networking Services
    {
        "urls": [
            "https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html",
            "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/Welcome.html",
            "https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/what-is-load-balancing.html",
            "https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html",
            "https://docs.aws.amazon.com/cloudfront/latest/developerguide/Introduction.html",
        ],
        "depth": 4,
        "concurrent": 15,
        "phase": "Networking Services"
    },
    
    # PHASE 7: Security & Identity
    {
        "urls": [
            "https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html",
            "https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html",
            "https://docs.aws.amazon.com/kms/latest/developerguide/overview.html",
            "https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html",
        ],
        "depth": 5,
        "concurrent": 15,
        "phase": "Security & Identity"
    },
    
    # PHASE 8: Monitoring & Management
    {
        "urls": [
            "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html",
            "https://docs.aws.amazon.com/cloudtrail/latest/userguide/cloudtrail-user-guide.html",
            "https://docs.aws.amazon.com/systems-manager/latest/userguide/what-is-systems-manager.html",
        ],
        "depth": 4,
        "concurrent": 15,
        "phase": "Monitoring & Management"
    },
    
    # PHASE 9: Application Integration
    {
        "urls": [
            "https://docs.aws.amazon.com/sns/latest/dg/welcome.html",
            "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html",
            "https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html",
            "https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html",
        ],
        "depth": 4,
        "concurrent": 15,
        "phase": "Application Integration"
    },
    
    # PHASE 10: Infrastructure as Code
    {
        "urls": [
            "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html",
            "https://docs.aws.amazon.com/cdk/v2/guide/home.html",
        ],
        "depth": 5,
        "concurrent": 15,
        "phase": "Infrastructure as Code"
    },
    
    # PHASE 11: Analytics & Streaming
    {
        "urls": [
            "https://docs.aws.amazon.com/kinesis/latest/dev/introduction.html",
            "https://docs.aws.amazon.com/athena/latest/ug/what-is.html",
            "https://docs.aws.amazon.com/glue/latest/dg/what-is-glue.html",
        ],
        "depth": 4,
        "concurrent": 15,
        "phase": "Analytics & Streaming"
    },
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
            print(f"❌ Error checking status for job {job_id}: {e}")
            return {"status": "error", "error": str(e)}


async def wait_for_crawl_completion(job_id: str, url: str, max_wait_seconds: int = 600) -> bool:
    """Wait for a crawl job to complete."""
    start_time = time.time()
    
    while time.time() - start_time < max_wait_seconds:
        status_data = await check_crawl_status(job_id)
        
        if status_data.get("status") == "completed":
            result = status_data.get("result", {})
            pages = result.get("pages_crawled", 0)
            words = result.get("total_words", 0)
            print(f"  ✅ Completed: {pages} pages, {words:,} words indexed")
            return True
        elif status_data.get("status") == "failed":
            error = status_data.get("error", "Unknown error")
            print(f"  ❌ Failed: {error}")
            return False
        
        # Still running
        await asyncio.sleep(5)
    
    print(f"  ⏱️  Timeout after {max_wait_seconds}s")
    return False


async def crawl_phase(phase_config: Dict, tenant_id: str = DEFAULT_TENANT_ID):
    """Crawl all URLs in a phase."""
    phase_name = phase_config["phase"]
    urls = phase_config["urls"]
    depth = phase_config["depth"]
    concurrent = phase_config["concurrent"]
    
    print(f"\n{'='*80}")
    print(f"🚀 PHASE: {phase_name}")
    print(f"{'='*80}")
    print(f"URLs: {len(urls)} | Depth: {depth} | Concurrent: {concurrent}\n")
    
    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}] Crawling: {url}")
        
        # Start crawl
        result = await start_crawl(url, depth, concurrent, tenant_id)
        
        if result.get("success") and result.get("job_id"):
            job_id = result["job_id"]
            print(f"  📋 Job ID: {job_id}")
            
            # Wait for completion
            await wait_for_crawl_completion(job_id, url)
        elif result.get("rate_limit"):
            limits = result.get("rate_limit", {})
            print(f"  ⚠️  Rate limited: {limits}")
            print(f"  ⏸️  Waiting 60 seconds before continuing...")
            await asyncio.sleep(60)
        else:
            error = result.get("error", "Unknown error")
            print(f"  ❌ Failed to start: {error}")
        
        # Small delay between crawls to avoid overwhelming the service
        if i < len(urls):
            await asyncio.sleep(2)


async def main():
    """Main crawl orchestrator."""
    print("╔════════════════════════════════════════════════════════════════════════════╗")
    print("║                    AWS Documentation Crawler                               ║")
    print("║                    Crawling AWS Services & Certifications                  ║")
    print("╚════════════════════════════════════════════════════════════════════════════╝")
    
    total_urls = sum(len(phase["urls"]) for phase in CRAWL_TARGETS)
    print(f"\n📊 Total URLs to crawl: {total_urls}")
    print(f"📊 Total phases: {len(CRAWL_TARGETS)}")
    
    start_time = time.time()
    
    # Crawl each phase sequentially
    for phase_config in CRAWL_TARGETS:
        await crawl_phase(phase_config)
    
    elapsed_time = time.time() - start_time
    hours = int(elapsed_time // 3600)
    minutes = int((elapsed_time % 3600) // 60)
    seconds = int(elapsed_time % 60)
    
    print(f"\n{'='*80}")
    print(f"✅ ALL CRAWLING COMPLETE!")
    print(f"{'='*80}")
    print(f"⏱️  Total time: {hours}h {minutes}m {seconds}s")
    print(f"📚 Total URLs crawled: {total_urls}")


if __name__ == "__main__":
    asyncio.run(main())
