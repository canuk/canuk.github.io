#!/bin/bash

# Update artifacts/index.html with card grid layout and auto-generated thumbnails
# Usage: ./scripts/update-artifacts-index.sh (can be run from any directory)
# Prerequisites: pip install shot-scraper && shot-scraper install

set -e

# Get the project root (parent of scripts directory)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ARTIFACTS_DIR="$PROJECT_ROOT/artifacts"
THUMBNAILS_DIR="$ARTIFACTS_DIR/thumbnails"
INDEX_FILE="$ARTIFACTS_DIR/index.html"

# Create thumbnails directory if it doesn't exist
mkdir -p "$THUMBNAILS_DIR"

# Check if shot-scraper is available
if ! command -v shot-scraper &> /dev/null; then
    echo "Warning: shot-scraper not found. Skipping thumbnail generation."
    echo "Install with: pip install shot-scraper && shot-scraper install"
    SKIP_THUMBNAILS=true
else
    SKIP_THUMBNAILS=false
fi

# Generate thumbnails for each HTML file
echo "Checking thumbnails..."
for file in "$ARTIFACTS_DIR"/*.html; do
    filename=$(basename "$file")

    # Skip index.html
    [[ "$filename" == "index.html" ]] && continue

    basename_no_ext="${filename%.html}"
    thumbnail="$THUMBNAILS_DIR/${basename_no_ext}.webp"

    if [[ "$SKIP_THUMBNAILS" == "true" ]]; then
        continue
    fi

    # Generate thumbnail if it doesn't exist or is older than source
    if [[ ! -f "$thumbnail" ]] || [[ "$file" -nt "$thumbnail" ]]; then
        echo "Generating thumbnail for $filename..."
        shot-scraper "$file" -o "$thumbnail" --width 800 --height 600 --quality 80 2>/dev/null || {
            echo "  Warning: Failed to generate thumbnail for $filename"
        }
    fi
done

# Build the card grid HTML
echo "Building index..."
cards_html=""
for file in "$ARTIFACTS_DIR"/*.html; do
    filename=$(basename "$file")

    # Skip index.html
    [[ "$filename" == "index.html" ]] && continue

    basename_no_ext="${filename%.html}"
    thumbnail="thumbnails/${basename_no_ext}.webp"
    thumbnail_path="$THUMBNAILS_DIR/${basename_no_ext}.webp"

    # Extract title from <title> tag
    title=$(sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p' "$file" | head -1)
    [[ -z "$title" ]] && title="${basename_no_ext}"

    # Extract description from meta tag if present
    description=$(sed -n 's/.*<meta name="description" content="\([^"]*\)".*/\1/p' "$file" | head -1)
    [[ -z "$description" ]] && description="Standalone HTML tool"

    # Get last modified date
    if [[ "$(uname)" == "Darwin" ]]; then
        last_edited=$(stat -f "%Sm" -t "%b %d, %Y" "$file")
    else
        last_edited=$(date -r "$file" "+%b %d, %Y")
    fi

    # Check if thumbnail exists for image or placeholder
    if [[ -f "$thumbnail_path" ]]; then
        img_html="<img src=\"$thumbnail\" class=\"card-img-top\" alt=\"$title preview\">"
    else
        img_html="<div class=\"card-img-top bg-secondary d-flex align-items-center justify-content-center\" style=\"height: 180px;\"><i class=\"bi bi-code-slash fs-1 text-white opacity-50\"></i></div>"
    fi

    cards_html+="      <div class=\"col\">
        <a href=\"$filename\" class=\"card card-modern h-100 text-decoration-none\">
          $img_html
          <div class=\"card-body\">
            <h5 class=\"card-title\">$title</h5>
            <p class=\"card-text text-secondary small\">$description</p>
          </div>
          <div class=\"card-footer bg-transparent border-0 text-secondary small\">
            Last edited: $last_edited
          </div>
        </a>
      </div>
"
done

# Count tools
tool_count=$(echo "$cards_html" | grep -c '<div class="col">' || echo "0")

# Generate the index.html
cat > "$INDEX_FILE" << 'HEADER'
---
layout: default
title: Tools & Artifacts
---

<div class="container my-5">
  <h1 class="display-4 mb-3">Tools & Artifacts</h1>
  <p class="lead text-secondary mb-5">
    A collection of useful HTML tools and utilities. Each tool is a standalone file that runs directly in your browser.
  </p>

  <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
HEADER

# Append the cards
echo -n "$cards_html" >> "$INDEX_FILE"

# Append the footer
cat >> "$INDEX_FILE" << 'FOOTER'
  </div>
</div>

<style>
  .card-modern {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .card-modern:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0,0,0,0.15);
  }
  .card-modern .card-img-top {
    height: 180px;
    object-fit: cover;
    object-position: top;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }
  .card-modern .card-title {
    color: var(--text-primary, #1e293b);
  }
</style>
FOOTER

echo "Updated $INDEX_FILE with $tool_count tools"
