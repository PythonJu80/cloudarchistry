#!/usr/bin/env python3
"""
Crawl the remaining 33 missing extended services
Run in small batches of 5 to match concurrency limit
"""

import asyncio
import httpx
import time
from typing import Dict, List

# Remaining 33 services that need to be crawled
REMAINING_SERVICES = [
    "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DAX.html",
    "https://docs.aws.amazon.com/timestream/latest/developerguide/what-is-timestream.html",
    "https://docs.aws.amazon.com/keyspaces/latest/devguide/what-is-keyspaces.html",
    "https://docs.aws.amazon.com/qldb/latest/developerguide/what-is.html",
    "https://docs.aws.amazon.com/neptune/latest/userguide/neptune-analytics-intro.html",
    "https://docs.aws.amazon.com/aws-backup/latest/devguide/whatisbackup.html",
    "https://docs.aws.amazon.com/datasync/latest/userguide/what-is-datasync.html",
    "https://docs.aws.amazon.com/snowball/latest/developer-guide/whatissnowball.html",
    "https://docs.aws.amazon.com/app-mesh/latest/userguide/what-is-app-mesh.html",
    "https://docs.aws.amazon.com/cloud-map/latest/dg/what-is-cloud-map.html",
    "https://docs.aws.amazon.com/privateca/latest/userguide/PcaWelcome.html",
    "https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html",
    "https://docs.aws.amazon.com/inspector/latest/user/what-is-inspector.html",
    "https://docs.aws.amazon.com/controltower/latest/userguide/what-is-control-tower.html",
    "https://docs.aws.amazon.com/opensearch-service/latest/developerguide/what-is.html",
    "https://docs.aws.amazon.com/msk/latest/developerguide/what-is-msk.html",
    "https://docs.aws.amazon.com/redshift/latest/mgmt/serverless-whatis.html",
    "https://docs.aws.amazon.com/databrew/latest/dg/what-is.html",
    "https://docs.aws.amazon.com/datazone/latest/userguide/what-is-datazone.html",
    "https://docs.aws.amazon.com/appsync/latest/devguide/what-is-appsync.html",
    "https://docs.aws.amazon.com/mq/latest/developer-guide/welcome.html",
    "https://docs.aws.amazon.com/amazonswf/latest/developerguide/swf-welcome.html",
    "https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes.html",
    "https://docs.aws.amazon.com/codestar/latest/userguide/welcome.html",
    "https://docs.aws.amazon.com/codeguru/latest/reviewer-ug/welcome.html",
    "https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html",
    "https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html",
    "https://docs.aws.amazon.com/servicecatalog/latest/adminguide/introduction.html",
    "https://docs.aws.amazon.com/license-manager/latest/userguide/license-manager.html",
    "https://docs.aws.amazon.com/dms/latest/userguide/Welcome.html",
    "https://docs.aws.amazon.com/mgn/latest/ug/what-is-application-migration-service.html",
    "https://docs.aws.amazon.com/transfer/latest/userguide/what-is-aws-transfer-family.html",
    "https://docs.aws.amazon.com/appstream2/latest/developerguide/what-is-appstream.html",
]

CRAWL_API_URL = "http://10.121.19.210:1027/api/crawl/smart"
STATUS_API_URL = "http://10.121.19.210:1027/api/crawl/status"
DEFAULT_TENANT_ID = "default"

# Crawl settings
DOCS_DEPTH = 5
DOCS_CONCURRENT = 30
BATCH_SIZE = 5  # Match concurrency limit
MAX_WAIT_PER_CRAWL = 2400  # 40 minutes

async def start_crawl(url: str, depth: int, concurrent: int, tenant_id: str) -> Dict:
    """Start a crawl job."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                CRAWL_API_URL,
                params={
                    "url": url,
                    "max_depth": depth,
                    "max_concurrent": concurrent,
                    "tenant_id": tenant_id,
                }
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}

async def check_status(job_id: str) -> Dict:
    """Check crawl job status."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{STATUS_API_URL}/{job_id}")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}

async def wait_for_completion(job_id: str, service_name: str, max_wait: int) -> Dict:
    """Wait for crawl to complete."""
    start_time = time.time()
    last_status_time = start_time
    
    while True:
        elapsed = int(time.time() - start_time)
        
        if elapsed >= max_wait:
            return {"success": False, "error": f"Timeout after {max_wait}s"}
        
        # Print status every 60 seconds
        if time.time() - last_status_time >= 60:
            minutes = elapsed // 60
            print(f"  [{service_name}]: {minutes}m...")
            last_status_time = time.time()
        
        status = await check_status(job_id)
        
        if not status.get("success"):
            await asyncio.sleep(5)
            continue
        
        job_status = status.get("status")
        
        if job_status == "completed":
            result = status.get("result", {})
            return {
                "success": True,
                "pages_crawled": result.get("pages_crawled", 0),
                "words_indexed": result.get("total_words", 0),
            }
        elif job_status == "failed":
            error = status.get("error", "Unknown error")
            return {"success": False, "error": error}
        
        await asyncio.sleep(5)

async def crawl_batch(urls: List[str], batch_num: int, total_batches: int):
    """Crawl a batch of URLs."""
    print(f"\n{'='*80}")
    print(f"BATCH {batch_num}/{total_batches} - {len(urls)} services")
    print(f"{'='*80}\n")
    
    # Start all crawls in batch
    jobs = []
    for i, url in enumerate(urls, 1):
        service_name = url.split('/')[-2] if '/' in url else url
        print(f"✓ [{i}/{len(urls)}] {service_name} - Starting...")
        
        result = await start_crawl(url, DOCS_DEPTH, DOCS_CONCURRENT, DEFAULT_TENANT_ID)
        
        if result.get("success"):
            job_id = result.get("job_id")
            jobs.append((job_id, service_name, url))
            print(f"  Job ID: {job_id}")
        else:
            error = result.get("error", "Unknown error")
            print(f"  ✗ Failed to start: {error}")
        
        await asyncio.sleep(1)  # Small delay between starts
    
    # Wait for all jobs to complete
    print(f"\n{'='*80}")
    print(f"Waiting for {len(jobs)} crawls to complete...")
    print(f"{'='*80}\n")
    
    results = []
    for job_id, service_name, url in jobs:
        result = await wait_for_completion(job_id, service_name, MAX_WAIT_PER_CRAWL)
        results.append((service_name, url, result))
    
    # Print summary
    print(f"\n{'='*80}")
    print(f"BATCH {batch_num} COMPLETE")
    print(f"{'='*80}")
    
    successful = sum(1 for _, _, r in results if r.get("success"))
    failed = len(results) - successful
    total_pages = sum(r.get("pages_crawled", 0) for _, _, r in results if r.get("success"))
    total_words = sum(r.get("words_indexed", 0) for _, _, r in results if r.get("success"))
    
    print(f"✅ Successful: {successful}/{len(results)}")
    print(f"❌ Failed: {failed}/{len(results)}")
    print(f"📄 Pages crawled: {total_pages:,}")
    print(f"📝 Words indexed: {total_words:,}")
    
    if failed > 0:
        print(f"\n❌ Failed services:")
        for service_name, url, result in results:
            if not result.get("success"):
                error = result.get("error", "Unknown error")
                print(f"   - {service_name}: {error}")
    
    return results

async def main():
    """Main crawl function."""
    print(f"\n{'='*80}")
    print(f"AWS REMAINING SERVICES CRAWLER")
    print(f"{'='*80}")
    print(f"Total services: {len(REMAINING_SERVICES)}")
    print(f"Batch size: {BATCH_SIZE}")
    print(f"Depth: {DOCS_DEPTH} | Concurrent: {DOCS_CONCURRENT}")
    print(f"{'='*80}\n")
    
    # Split into batches
    batches = [REMAINING_SERVICES[i:i + BATCH_SIZE] for i in range(0, len(REMAINING_SERVICES), BATCH_SIZE)]
    
    all_results = []
    for i, batch in enumerate(batches, 1):
        results = await crawl_batch(batch, i, len(batches))
        all_results.extend(results)
        
        # Wait between batches
        if i < len(batches):
            print(f"\n⏸️  Waiting 30s before next batch...\n")
            await asyncio.sleep(30)
    
    # Final summary
    print(f"\n{'='*80}")
    print(f"🎉 ALL BATCHES COMPLETE!")
    print(f"{'='*80}")
    
    successful = sum(1 for _, _, r in all_results if r.get("success"))
    failed = len(all_results) - successful
    total_pages = sum(r.get("pages_crawled", 0) for _, _, r in all_results if r.get("success"))
    total_words = sum(r.get("words_indexed", 0) for _, _, r in all_results if r.get("success"))
    
    print(f"✅ Total successful: {successful}/{len(all_results)}")
    print(f"❌ Total failed: {failed}/{len(all_results)}")
    print(f"📄 Total pages: {total_pages:,}")
    print(f"📝 Total words: {total_words:,}")

if __name__ == "__main__":
    asyncio.run(main())
