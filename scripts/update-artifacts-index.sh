#!/bin/bash

# Update artifacts/index.html with card grid layout, auto-generated thumbnails, tags, search, and sort
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

# Collect all unique tags
echo "Collecting tags..."
all_tags=""
for file in "$ARTIFACTS_DIR"/*.html; do
    filename=$(basename "$file")
    [[ "$filename" == "index.html" ]] && continue

    tags=$(sed -n 's/.*<meta name="tags" content="\([^"]*\)".*/\1/p' "$file" | head -1)
    if [[ -n "$tags" ]]; then
        all_tags="$all_tags,$tags"
    fi
done

# Get unique sorted tags
unique_tags=$(echo "$all_tags" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | grep -v '^$' | sort -u | tr '\n' ',' | sed 's/,$//')

# Build tag filter buttons
tag_buttons='<button class="btn btn-sm btn-primary me-1 mb-1" data-tag="all">All</button>'
IFS=',' read -ra TAG_ARRAY <<< "$unique_tags"
for tag in "${TAG_ARRAY[@]}"; do
    tag=$(echo "$tag" | sed 's/^ *//;s/ *$//')
    [[ -z "$tag" ]] && continue
    tag_buttons="$tag_buttons"'
      <button class="btn btn-sm btn-outline-secondary me-1 mb-1" data-tag="'"$tag"'">'"$tag"'</button>'
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

    # Extract tags
    tags=$(sed -n 's/.*<meta name="tags" content="\([^"]*\)".*/\1/p' "$file" | head -1)
    tags_normalized=$(echo "$tags" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | tr '\n' ',' | sed 's/,$//')

    # Get last modified date (for display and sorting)
    if [[ "$(uname)" == "Darwin" ]]; then
        last_edited=$(stat -f "%Sm" -t "%b %d, %Y" "$file")
        # ISO date for sorting
        date_sort=$(stat -f "%Sm" -t "%Y-%m-%d" "$file")
    else
        last_edited=$(date -r "$file" "+%b %d, %Y")
        date_sort=$(date -r "$file" "+%Y-%m-%d")
    fi

    # Check if thumbnail exists for image or placeholder
    if [[ -f "$thumbnail_path" ]]; then
        img_html="<img src=\"$thumbnail\" class=\"card-img-top\" alt=\"$title preview\">"
    else
        img_html="<div class=\"card-img-top bg-secondary d-flex align-items-center justify-content-center\" style=\"height: 180px;\"><i class=\"bi bi-code-slash fs-1 text-white opacity-50\"></i></div>"
    fi

    # Build tag badges HTML
    tag_badges=""
    if [[ -n "$tags" ]]; then
        IFS=',' read -ra TAGS <<< "$tags"
        for t in "${TAGS[@]}"; do
            t=$(echo "$t" | sed 's/^ *//;s/ *$//')
            [[ -z "$t" ]] && continue
            tag_badges="$tag_badges<span class=\"badge bg-secondary me-1 tag-badge\" data-tag=\"$t\">$t</span>"
        done
    fi

    cards_html+="      <div class=\"col artifact-card\" data-tags=\"$tags_normalized\" data-title=\"$title\" data-description=\"$description\" data-date=\"$date_sort\">
        <a href=\"$filename\" class=\"card card-modern h-100 text-decoration-none\">
          $img_html
          <div class=\"card-body\">
            <h5 class=\"card-title\">$title</h5>
            <p class=\"card-text text-secondary small\">$description</p>
            <div class=\"mt-2\">$tag_badges</div>
          </div>
          <div class=\"card-footer bg-transparent border-0 text-secondary small\">
            Last edited: $last_edited
          </div>
        </a>
      </div>
"
done

# Count tools
tool_count=$(echo "$cards_html" | grep -c '<div class="col artifact-card"' || echo "0")

# Generate the index.html
cat > "$INDEX_FILE" << 'HEADER'
---
layout: default
title: Artifacts
---

<div class="container my-5">
  <h1 class="display-4 mb-3">Artifacts</h1>
  <p class="lead text-secondary mb-4">
    A collection of artifacts created with AI Coding Assistants. Each tool is a standalone file that runs directly in your browser.
  </p>

  <!-- Search and Sort Controls -->
  <div class="row mb-3 g-2">
    <div class="col-md-6">
      <div class="input-group">
        <span class="input-group-text"><i class="bi bi-search"></i></span>
        <input type="search" id="searchInput" class="form-control" placeholder="Search artifacts...">
      </div>
    </div>
    <div class="col-md-3">
      <select id="sortSelect" class="form-select">
        <option value="name-asc">Name (A-Z)</option>
        <option value="name-desc">Name (Z-A)</option>
        <option value="date-desc">Newest First</option>
        <option value="date-asc">Oldest First</option>
      </select>
    </div>
  </div>

  <!-- Tag Filters -->
  <div class="mb-4" id="tagFilters">
HEADER

# Append tag buttons
echo "    $tag_buttons" >> "$INDEX_FILE"

cat >> "$INDEX_FILE" << 'MIDDLE'
  </div>

  <!-- No Results Message -->
  <div id="noResults" class="text-center text-secondary py-5" style="display: none;">
    <i class="bi bi-search fs-1 mb-3 d-block"></i>
    <p>No artifacts match your search.</p>
  </div>

  <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4" id="artifactGrid">
MIDDLE

# Append the cards
echo -n "$cards_html" >> "$INDEX_FILE"

# Append the footer with styles and JavaScript
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
  .tag-badge {
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .tag-badge:hover {
    background-color: #0d6efd !important;
  }
  .artifact-card {
    transition: opacity 0.3s ease;
  }
  .artifact-card.hidden {
    display: none !important;
  }
  #tagFilters .btn.active {
    background-color: #0d6efd;
    border-color: #0d6efd;
    color: white;
  }
</style>

<script>
(function() {
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const tagFilters = document.getElementById('tagFilters');
  const grid = document.getElementById('artifactGrid');
  const noResults = document.getElementById('noResults');
  const cards = Array.from(document.querySelectorAll('.artifact-card'));

  let currentTag = 'all';
  let currentSearch = '';

  // Read initial state from URL
  function readURLState() {
    const params = new URLSearchParams(window.location.search);
    const tag = params.get('tag');
    const search = params.get('q');
    const sort = params.get('sort');

    if (tag) {
      currentTag = tag;
      updateTagButtons();
    }
    if (search) {
      currentSearch = search;
      searchInput.value = search;
    }
    if (sort) {
      sortSelect.value = sort;
    }
  }

  // Update URL with current state
  function updateURL() {
    const params = new URLSearchParams();
    if (currentTag !== 'all') params.set('tag', currentTag);
    if (currentSearch) params.set('q', currentSearch);
    if (sortSelect.value !== 'name-asc') params.set('sort', sortSelect.value);

    const newURL = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;

    history.replaceState(null, '', newURL);
  }

  // Update tag button active states
  function updateTagButtons() {
    tagFilters.querySelectorAll('[data-tag]').forEach(btn => {
      btn.classList.remove('active', 'btn-primary', 'btn-outline-secondary');
      if (btn.dataset.tag === currentTag) {
        btn.classList.add('active', 'btn-primary');
      } else {
        btn.classList.add('btn-outline-secondary');
      }
    });
  }

  // Filter and sort cards
  function filterAndSort() {
    const searchLower = currentSearch.toLowerCase();
    let visibleCount = 0;

    cards.forEach(card => {
      const title = (card.dataset.title || '').toLowerCase();
      const description = (card.dataset.description || '').toLowerCase();
      const tags = (card.dataset.tags || '').toLowerCase();

      const matchesSearch = !currentSearch ||
        title.includes(searchLower) ||
        description.includes(searchLower);

      const matchesTag = currentTag === 'all' ||
        tags.split(',').map(t => t.trim()).includes(currentTag);

      if (matchesSearch && matchesTag) {
        card.classList.remove('hidden');
        visibleCount++;
      } else {
        card.classList.add('hidden');
      }
    });

    // Sort visible cards
    const sortValue = sortSelect.value;
    const visibleCards = cards.filter(c => !c.classList.contains('hidden'));

    visibleCards.sort((a, b) => {
      switch (sortValue) {
        case 'name-asc':
          return (a.dataset.title || '').localeCompare(b.dataset.title || '');
        case 'name-desc':
          return (b.dataset.title || '').localeCompare(a.dataset.title || '');
        case 'date-desc':
          return (b.dataset.date || '').localeCompare(a.dataset.date || '');
        case 'date-asc':
          return (a.dataset.date || '').localeCompare(b.dataset.date || '');
        default:
          return 0;
      }
    });

    // Reorder in DOM
    visibleCards.forEach(card => grid.appendChild(card));

    // Also move hidden cards to end
    cards.filter(c => c.classList.contains('hidden')).forEach(card => grid.appendChild(card));

    // Show/hide no results message
    noResults.style.display = visibleCount === 0 ? 'block' : 'none';

    updateURL();
  }

  // Event: Tag filter buttons
  tagFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tag]');
    if (btn) {
      currentTag = btn.dataset.tag;
      updateTagButtons();
      filterAndSort();
    }
  });

  // Event: Tag badges on cards
  document.addEventListener('click', (e) => {
    const badge = e.target.closest('.tag-badge');
    if (badge) {
      e.preventDefault();
      e.stopPropagation();
      currentTag = badge.dataset.tag;
      updateTagButtons();
      filterAndSort();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Event: Search input
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.trim();
    filterAndSort();
  });

  // Event: Sort select
  sortSelect.addEventListener('change', filterAndSort);

  // Initialize
  readURLState();
  filterAndSort();
})();
</script>
FOOTER

echo "Updated $INDEX_FILE with $tool_count tools"
