#!/bin/bash

# Update artifacts/index.html with all HTML files in the artifacts directory
# Usage: ./scripts/update-artifacts-index.sh (can be run from any directory)

# Get the project root (parent of scripts directory)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ARTIFACTS_DIR="$PROJECT_ROOT/artifacts"
INDEX_FILE="$ARTIFACTS_DIR/index.html"

# Build the list of tools
tools_html=""
for file in "$ARTIFACTS_DIR"/*.html; do
    filename=$(basename "$file")

    # Skip index.html
    [[ "$filename" == "index.html" ]] && continue

    # Extract title from <title> tag (portable sed approach)
    title=$(sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p' "$file" | head -1)
    [[ -z "$title" ]] && title="${filename%.html}"

    # Extract description from meta tag if present
    description=$(sed -n 's/.*<meta name="description" content="\([^"]*\)".*/\1/p' "$file" | head -1)
    [[ -z "$description" ]] && description="Standalone HTML tool"

    tools_html+="          <a href=\"$filename\" class=\"list-group-item list-group-item-action d-flex justify-content-between align-items-center\">
            <div>
              <h5 class=\"mb-1\">$title</h5>
              <p class=\"mb-0 text-secondary small\">$description</p>
            </div>
            <i class=\"fa-solid fa-arrow-right text-secondary\"></i>
          </a>
"
done

# Generate the index.html
cat > "$INDEX_FILE" << 'HEADER'
---
layout: default
title: Tools & Artifacts
---

<div class="container my-5">
  <div class="row">
    <div class="col-lg-8 mx-auto">
      <h1 class="display-4 mb-4">Tools & Artifacts</h1>
      <p class="lead text-secondary mb-5">
        A collection of useful HTML tools and utilities. Each tool is a standalone HTML file that can be used directly in your browser.
      </p>
      <div class="card card-modern p-4">
        <h3 class="h5 mb-3">Available Tools</h3>
        <div class="list-group list-group-flush">
HEADER

# Append the tools
echo -n "$tools_html" >> "$INDEX_FILE"

# Append the footer
cat >> "$INDEX_FILE" << 'FOOTER'
        </div>
      </div>
    </div>
  </div>
</div>
FOOTER

echo "Updated $INDEX_FILE with $(echo "$tools_html" | grep -c 'list-group-item-action') tools"
