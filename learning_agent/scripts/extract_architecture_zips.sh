#!/bin/bash
# Extract all architecture diagram ZIP files (containing PowerPoint) from AWS documentation

echo "Extracting architecture diagram ZIP download links from AWS documentation..."

# Get all architecture-diagrams sitemaps
echo "Finding architecture diagram sitemaps..."
curl -s "https://docs.aws.amazon.com/sitemap_index.xml" | \
  grep -o '<loc>[^<]*architecture-diagrams[^<]*</loc>' | \
  sed 's/<loc>//g' | sed 's/<\/loc>//g' > arch_sitemaps.txt

SITEMAP_COUNT=$(wc -l < arch_sitemaps.txt)
echo "Found $SITEMAP_COUNT architecture diagram sitemaps"

# Extract all page URLs from architecture sitemaps
echo "Extracting page URLs from sitemaps..."
> arch_pages.txt
while read sitemap; do
  curl -s "$sitemap" | grep -o '<loc>[^<]*</loc>' | \
    sed 's/<loc>//g' | sed 's/<\/loc>//g' >> arch_pages.txt
done < arch_sitemaps.txt

PAGE_COUNT=$(wc -l < arch_pages.txt)
echo "Found $PAGE_COUNT architecture diagram pages"

# Extract ZIP download links from each page
echo "Extracting ZIP download links from pages..."
> aws_architecture_zips.txt
PROCESSED=0
while read page_url; do
  PROCESSED=$((PROCESSED + 1))
  if [ $((PROCESSED % 10)) -eq 0 ]; then
    echo "  Processed $PROCESSED/$PAGE_COUNT pages..."
  fi
  
  # Fetch page and extract ZIP links
  curl -sL "$page_url" | grep -o 'href="[^"]*\.zip"' | \
    sed 's/href="//g' | sed 's/"//g' | \
    while read zip_link; do
      # Convert relative URLs to absolute
      if [[ $zip_link == http* ]]; then
        echo "$zip_link"
      elif [[ $zip_link == /* ]]; then
        echo "https://docs.aws.amazon.com$zip_link"
      else
        # Relative path - need to construct from page URL
        page_dir=$(dirname "$page_url")
        echo "$page_dir/$zip_link"
      fi
    done >> aws_architecture_zips.txt
done < arch_pages.txt

# Remove duplicates
sort -u aws_architecture_zips.txt -o aws_architecture_zips.txt

# Cleanup temp files
rm arch_sitemaps.txt arch_pages.txt

TOTAL=$(wc -l < aws_architecture_zips.txt)
echo ""
echo "=========================================="
echo "Found $TOTAL architecture diagram ZIP files"
echo "=========================================="

# Preview first 10
echo -e "\nFirst 10 ZIP files:"
head -10 aws_architecture_zips.txt

echo -e "\nFull list saved to: aws_architecture_zips.txt"
echo "Each ZIP contains an editable PowerPoint diagram"

# Optional: Download all files
echo ""
read -p "Do you want to download all $TOTAL ZIP files? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    mkdir -p aws_architecture_diagrams
    cd aws_architecture_diagrams
    
    echo "Downloading $TOTAL ZIP files..."
    cat ../aws_architecture_zips.txt | xargs -n 1 -P 5 wget -q --show-progress
    
    echo ""
    echo "Download complete! Files saved to: aws_architecture_diagrams/"
    echo ""
    echo "Extracting PowerPoint files from ZIPs..."
    for zip_file in *.zip; do
        unzip -q -o "$zip_file" "*.pptx" 2>/dev/null
    done
    
    PPTX_COUNT=$(find . -name "*.pptx" | wc -l)
    echo "Extracted $PPTX_COUNT PowerPoint files"
    
    # Move all PPTX files to root of directory
    find . -name "*.pptx" -exec mv {} . \; 2>/dev/null
    
    # Clean up empty directories and zip files
    find . -type d -empty -delete 2>/dev/null
    
    echo "All PowerPoint files are now in: aws_architecture_diagrams/"
fi
