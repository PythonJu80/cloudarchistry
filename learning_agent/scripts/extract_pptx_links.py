#!/usr/bin/env python3
"""
Extract all PowerPoint (.pptx) download links from AWS documentation.
This script crawls the AWS sitemap and finds all .pptx file URLs.
"""

import requests
import xml.etree.ElementTree as ET
from urllib.parse import urljoin
import json
import sys


def parse_sitemap_index(sitemap_index_url):
    """Parse sitemap index and return list of sitemap URLs."""
    print(f"Fetching sitemap index: {sitemap_index_url}")
    resp = requests.get(sitemap_index_url)
    sitemap_urls = []
    
    if resp.status_code == 200:
        try:
            tree = ET.fromstring(resp.content)
            sitemap_urls = [loc.text for loc in tree.findall('.//{*}sitemap/{*}loc')]
            print(f"Found {len(sitemap_urls)} sitemaps")
        except Exception as e:
            print(f"Error parsing sitemap index: {e}")
    
    return sitemap_urls


def parse_sitemap(sitemap_url):
    """Parse a sitemap and return list of URLs."""
    resp = requests.get(sitemap_url)
    urls = []
    
    if resp.status_code == 200:
        try:
            tree = ET.fromstring(resp.content)
            urls = [loc.text for loc in tree.findall('.//{*}loc')]
        except Exception as e:
            print(f"Error parsing sitemap {sitemap_url}: {e}")
    
    return urls


def extract_pptx_links_from_page(page_url):
    """Extract all .pptx links from a page."""
    pptx_links = []
    
    try:
        resp = requests.get(page_url, timeout=10)
        if resp.status_code == 200:
            content = resp.text.lower()
            # Find all .pptx links in the HTML
            import re
            # Match href="..." or href='...' containing .pptx
            pattern = r'href=["\']([^"\']*\.pptx[^"\']*)["\']'
            matches = re.findall(pattern, content, re.IGNORECASE)
            
            for match in matches:
                # Convert relative URLs to absolute
                absolute_url = urljoin(page_url, match)
                if absolute_url not in pptx_links:
                    pptx_links.append(absolute_url)
    except Exception as e:
        print(f"Error fetching {page_url}: {e}", file=sys.stderr)
    
    return pptx_links


def find_all_pptx_links(sitemap_index_url, max_sitemaps=None, max_pages_per_sitemap=None):
    """
    Find all PowerPoint download links from AWS documentation.
    
    Args:
        sitemap_index_url: URL of the sitemap index
        max_sitemaps: Maximum number of sitemaps to process (None = all)
        max_pages_per_sitemap: Maximum pages to check per sitemap (None = all)
    
    Returns:
        List of .pptx download URLs
    """
    all_pptx_links = []
    
    # Get all sitemaps
    sitemap_urls = parse_sitemap_index(sitemap_index_url)
    
    if max_sitemaps:
        sitemap_urls = sitemap_urls[:max_sitemaps]
    
    # Process each sitemap
    for i, sitemap_url in enumerate(sitemap_urls):
        print(f"\nProcessing sitemap {i+1}/{len(sitemap_urls)}: {sitemap_url}")
        
        # Get all page URLs from this sitemap
        page_urls = parse_sitemap(sitemap_url)
        
        if max_pages_per_sitemap:
            page_urls = page_urls[:max_pages_per_sitemap]
        
        print(f"  Found {len(page_urls)} pages to check")
        
        # Check each page for .pptx links
        for j, page_url in enumerate(page_urls):
            if (j + 1) % 10 == 0:
                print(f"  Checked {j+1}/{len(page_urls)} pages, found {len(all_pptx_links)} .pptx files so far")
            
            pptx_links = extract_pptx_links_from_page(page_url)
            
            if pptx_links:
                print(f"  Found {len(pptx_links)} .pptx links on {page_url}")
                for link in pptx_links:
                    if link not in all_pptx_links:
                        all_pptx_links.append(link)
    
    return all_pptx_links


def main():
    """Main function."""
    sitemap_index_url = "https://docs.aws.amazon.com/sitemap_index.xml"
    
    # For testing, limit to first 5 sitemaps and 10 pages each
    # Remove these limits for full scan
    print("Starting PowerPoint link extraction from AWS documentation...")
    print("This may take a while...\n")
    
    # Full scan (will take a long time!)
    # pptx_links = find_all_pptx_links(sitemap_index_url)
    
    # Quick test scan (first 10 sitemaps, 20 pages each)
    pptx_links = find_all_pptx_links(
        sitemap_index_url,
        max_sitemaps=10,
        max_pages_per_sitemap=20
    )
    
    print(f"\n{'='*60}")
    print(f"RESULTS: Found {len(pptx_links)} PowerPoint files")
    print(f"{'='*60}\n")
    
    # Save to file
    output_file = "aws_pptx_links.json"
    with open(output_file, 'w') as f:
        json.dump({
            "total_count": len(pptx_links),
            "links": pptx_links
        }, f, indent=2)
    
    print(f"Results saved to: {output_file}")
    
    # Also save as plain text list
    txt_file = "aws_pptx_links.txt"
    with open(txt_file, 'w') as f:
        for link in pptx_links:
            f.write(f"{link}\n")
    
    print(f"Plain text list saved to: {txt_file}")
    
    # Print first 10 links as preview
    if pptx_links:
        print("\nFirst 10 PowerPoint files found:")
        for i, link in enumerate(pptx_links[:10], 1):
            print(f"{i}. {link}")
    else:
        print("\nNo PowerPoint files found in the scanned pages.")
        print("Try increasing max_sitemaps and max_pages_per_sitemap for a more thorough scan.")


if __name__ == "__main__":
    main()
