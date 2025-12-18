#!/bin/bash
# Download all PowerPoint files from AWS architecture diagrams

echo "Extracting all .pptx links from AWS architecture diagrams..."

# First, get all architecture-diagrams sitemaps
echo "Finding architecture diagram sitemaps..."
curl -s "https://docs.aws.amazon.com/sitemap_index.xml" | \
  grep -o '<loc>[^<]*architecture-diagrams[^<]*</loc>' | \
  sed 's/<loc>//g' | sed 's/<\/loc>//g' > arch_sitemaps.txt

SITEMAP_COUNT=$(wc -l < arch_sitemaps.txt)
echo "Found $SITEMAP_COUNT architecture diagram sitemaps"

# Extract .pptx links from each architecture sitemap
> aws_pptx_links.txt
while read sitemap; do
  echo "Processing: $sitemap"
  curl -s "$sitemap" | grep -o '<loc>[^<]*\.pptx[^<]*</loc>' | \
    sed 's/<loc>//g' | sed 's/<\/loc>//g' >> aws_pptx_links.txt
done < arch_sitemaps.txt

# Remove duplicates
sort -u aws_pptx_links.txt -o aws_pptx_links.txt
rm arch_sitemaps.txt

TOTAL=$(wc -l < aws_pptx_links.txt)
echo "Found $TOTAL PowerPoint files"

# Preview first 10
echo -e "\nFirst 10 files:"
head -10 aws_pptx_links.txt

echo -e "\nFull list saved to: aws_pptx_links.txt"

# Optional: Download all files
read -p "Do you want to download all $TOTAL files? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    mkdir -p aws_powerpoints
    cd aws_powerpoints
    
    echo "Downloading $TOTAL PowerPoint files..."
    cat ../aws_pptx_links.txt | xargs -n 1 -P 5 wget -q --show-progress
    
    echo "Download complete! Files saved to: aws_powerpoints/"
fi
