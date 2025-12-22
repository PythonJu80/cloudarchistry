#!/usr/bin/env python3
"""
Find which of the 33 extended service URLs are actually missing from the database
"""

import asyncio
from prisma import Prisma

# The 33 URLs we want to check
EXTENDED_URLS = [
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

async def main():
    db = Prisma()
    await db.connect()
    
    print("\nChecking which URLs are in the database...\n")
    print("="*80)
    
    found = []
    missing = []
    
    for url in EXTENDED_URLS:
        service_name = url.split('/')[-2] if '/' in url else url
        
        # Check if URL exists (exact match or as prefix)
        count = await db.academyknowledgechunk.count(
            where={
                "url": {
                    "startswith": url
                }
            }
        )
        
        if count > 0:
            print(f"✅ {service_name}: {count} chunks")
            found.append((service_name, url, count))
        else:
            print(f"❌ {service_name}: NOT FOUND")
            missing.append((service_name, url))
    
    await db.disconnect()
    
    print("\n" + "="*80)
    print(f"\nSummary:")
    print(f"  ✅ Found: {len(found)}/{len(EXTENDED_URLS)}")
    print(f"  ❌ Missing: {len(missing)}/{len(EXTENDED_URLS)}")
    
    if missing:
        print(f"\n{'='*80}")
        print("Missing URLs to crawl:")
        print("="*80)
        for service_name, url in missing:
            print(f"{service_name}: {url}")

if __name__ == "__main__":
    asyncio.run(main())
