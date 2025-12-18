#!/bin/bash
# Fix the malformed URLs in aws_architecture_zips.txt

echo "Fixing architecture diagram ZIP URLs..."

# Read the page URLs we collected earlier
if [ ! -f "arch_pages.txt" ]; then
    echo "Error: arch_pages.txt not found. Please run extract_architecture_zips.sh first."
    exit 1
fi

# Extract ZIP URLs properly from each page
> aws_architecture_zips_fixed.txt
PROCESSED=0
TOTAL=$(wc -l < arch_pages.txt)

while read page_url; do
    PROCESSED=$((PROCESSED + 1))
    if [ $((PROCESSED % 10)) -eq 0 ]; then
        echo "  Processed $PROCESSED/$TOTAL pages..."
    fi
    
    # Get the base directory from page URL
    # e.g., https://docs.aws.amazon.com/architecture-diagrams/latest/knowledge-graphs-and-graphrag-with-neo4j/
    page_dir=$(dirname "$page_url")
    
    # Fetch page and extract ZIP links
    curl -sL "$page_url" | grep -o 'samples/[^"]*\.zip' | \
        while read zip_path; do
            echo "$page_dir/$zip_path"
        done >> aws_architecture_zips_fixed.txt
done < arch_pages.txt

# Remove duplicates
sort -u aws_architecture_zips_fixed.txt -o aws_architecture_zips_fixed.txt

TOTAL=$(wc -l < aws_architecture_zips_fixed.txt)
echo ""
echo "=========================================="
echo "Fixed $TOTAL architecture diagram ZIP URLs"
echo "=========================================="

# Preview first 10
echo -e "\nFirst 10 ZIP files:"
head -10 aws_architecture_zips_fixed.txt

echo -e "\nFull list saved to: aws_architecture_zips_fixed.txt"

# Replace the old file
mv aws_architecture_zips_fixed.txt aws_architecture_zips.txt
echo "Updated aws_architecture_zips.txt with correct URLs"
