#!/usr/bin/env python3
"""
Extract AWS service IDs from the TypeScript aws-services.ts file
and generate a list for crawl presets.
"""
import re
import json

# Read the TypeScript file
ts_file = "/home/kingju/Documents/cloudmigrate-saas/cloud-academy/src/lib/aws-services.ts"

with open(ts_file, 'r') as f:
    content = f.read()

# Extract all service IDs using regex
# Pattern: id: "service-name",
pattern = r'id:\s*"([^"]+)",'
service_ids = re.findall(pattern, content)

# Remove duplicates while preserving order
seen = set()
unique_services = []
for service_id in service_ids:
    if service_id not in seen:
        seen.add(service_id)
        unique_services.append(service_id)

print(f"Found {len(unique_services)} unique AWS services:")
print(json.dumps(unique_services, indent=2))

# Generate Python list for crawl_presets.py
print("\n\n# For crawl_presets.py:")
print(f"SYSTEM_SERVICES = {unique_services}")
