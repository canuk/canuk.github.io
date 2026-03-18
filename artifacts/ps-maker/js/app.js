import {
  initGemini,
  buildPrompt,
  generatePanorama,
  editPanorama,
  annotateImage,
  improvePrompt,
} from "./gemini.js";
import {
  loadPanorama,
  addMarkers,
  addMarker,
  removeMarker,
  rebuildMarkers,
  panTo,
  destroyViewer,
  startFollowingCenter,
  stopFollowingCenter,
  getCenterCoords,
} from "./viewer.js";

// --- DOM refs ---
const btnGenerate = document.getElementById("btn-generate");
const btnClear = document.getElementById("btn-clear");
const btnSettings = document.getElementById("btn-settings");
const btnTheme = document.getElementById("btn-theme");
const themeIcon = document.getElementById("theme-icon");
const btnSaveKey = document.getElementById("btn-save-key");
const apiKeyInput = document.getElementById("api-key-input");
const modeSimple = document.getElementById("mode-simple");
const modeAdvanced = document.getElementById("mode-advanced");
const simpleFields = document.getElementById("simple-fields");
const advancedFields = document.getElementById("advanced-fields");
const sceneDescription = document.getElementById("scene-description");
const fullPrompt = document.getElementById("full-prompt");
const viewerPlaceholder = document.getElementById("viewer-placeholder");
const viewerLoading = document.getElementById("viewer-loading");
const loadingStatus = document.getElementById("loading-status");
const viewerToolbar = document.getElementById("viewer-toolbar");
const btnDownload = document.getElementById("btn-download");
const btnSaveScene = document.getElementById("btn-save-scene");
const annotationsPanel = document.getElementById("annotations-panel");
const annotationChips = document.getElementById("annotation-chips");
const btnAddAnnotation = document.getElementById("btn-add-annotation");
const editDialog = document.getElementById("edit-dialog");
const editName = document.getElementById("edit-name");
const editDescription = document.getElementById("edit-description");
const btnDeleteAnnotation = document.getElementById("btn-delete-annotation");
const btnDoneEdit = document.getElementById("btn-done-edit");
const repositionBanner = document.getElementById("reposition-banner");
const btnCancelReposition = document.getElementById("btn-cancel-reposition");
const btnDoneReposition = document.getElementById("btn-done-reposition");
const repositionCrosshair = document.getElementById("reposition-crosshair");
const viewerWrapper = document.getElementById("viewer-wrapper");
const errorToastEl = document.getElementById("error-toast");
const errorToastBody = document.getElementById("error-toast-body");

// Dropdown refs
const perspectiveBtn = document.getElementById("perspective-btn");
const perspectiveValue = document.getElementById("perspective-value");
const perspectiveMenu = document.getElementById("perspective-menu");
const customPerspective = document.getElementById("custom-perspective");
const weatherBtn = document.getElementById("weather-btn");
const weatherValue = document.getElementById("weather-value");
const weatherMenu = document.getElementById("weather-menu");
const customWeather = document.getElementById("custom-weather");

const btnImprove = document.getElementById("btn-improve");
const editBar = document.getElementById("edit-bar");
const editBarInput = document.getElementById("edit-bar-input");
const btnEditSend = document.getElementById("btn-edit-send");
const autoAnnotateToggle = document.getElementById("auto-annotate");

const apiKeyModal = new bootstrap.Modal(
  document.getElementById("api-key-modal")
);
const errorToast = new bootstrap.Toast(errorToastEl);

// --- State ---
let isGenerating = false;
let currentAnnotations = [];
let selectedAnnotationIndex = -1;
let isRepositioning = false;
let repositionOriginal = null;
let currentImageDataUrl = null;
let currentBase64 = null;
let currentMimeType = null;
let selectedPerspective = "from eye level";
let selectedWeather = "Clear sky, bright daylight";

// --- Init ---
function init() {
  const savedTheme = localStorage.getItem("ps-theme") || "light";
  applyTheme(savedTheme);

  const savedKey = localStorage.getItem("gemini-api-key");
  if (savedKey) {
    initGemini(savedKey);
  } else {
    apiKeyModal.show();
  }

  // Core listeners
  btnSaveKey.addEventListener("click", saveApiKey);
  apiKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveApiKey();
  });
  btnSettings.addEventListener("click", () => {
    apiKeyInput.value = localStorage.getItem("gemini-api-key") || "";
    apiKeyModal.show();
  });
  btnTheme.addEventListener("click", toggleTheme);
  btnGenerate.addEventListener("click", handleGenerate);
  btnClear.addEventListener("click", handleClear);
  btnImprove.addEventListener("click", handleImprovePrompt);
  btnEditSend.addEventListener("click", handleEditPanorama);
  editBarInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleEditPanorama();
  });
  modeSimple.addEventListener("change", updatePromptMode);
  modeAdvanced.addEventListener("change", updatePromptMode);

  // Save/download
  btnDownload.addEventListener("click", handleDownloadImage);
  btnSaveScene.addEventListener("click", handleSaveScene);

  // Annotation editing
  btnAddAnnotation.addEventListener("click", handleAddAnnotation);
  btnDeleteAnnotation.addEventListener("click", handleDeleteAnnotation);
  btnDoneEdit.addEventListener("click", closeEditDialog);
  btnCancelReposition.addEventListener("click", cancelReposition);
  btnDoneReposition.addEventListener("click", confirmReposition);
  editName.addEventListener("input", handleEditorInput);
  editDescription.addEventListener("input", handleEditorInput);

  // Close edit dialog when clicking outside (but not during reposition)
  document.addEventListener("mousedown", (e) => {
    if (isRepositioning) return;
    if (selectedAnnotationIndex >= 0 && !editDialog.contains(e.target) &&
        !e.target.closest(".annotation-chip") && !e.target.closest(".chip-action-btn")) {
      closeEditDialog();
    }
  });

  // Dropdown handlers
  initDropdown(perspectiveMenu, perspectiveValue, customPerspective, perspectiveBtn,
    (val, label) => { selectedPerspective = val; updateDropdownIcon(perspectiveBtn, label); });
  initDropdown(weatherMenu, weatherValue, customWeather, weatherBtn,
    (val, label) => { selectedWeather = val; updateDropdownIcon(weatherBtn, label); });

  customPerspective.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.value.trim()) {
      e.preventDefault();
      selectedPerspective = e.target.value.trim();
      perspectiveValue.textContent = e.target.value.trim();
      clearActiveOption(perspectiveMenu);
      bootstrap.Dropdown.getInstance(perspectiveBtn)?.hide();
      e.target.value = "";
    }
  });

  customWeather.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.value.trim()) {
      e.preventDefault();
      selectedWeather = e.target.value.trim();
      weatherValue.textContent = e.target.value.trim();
      clearActiveOption(weatherMenu);
      bootstrap.Dropdown.getInstance(weatherBtn)?.hide();
      e.target.value = "";
    }
  });

  [customPerspective, customWeather].forEach(input => {
    input.addEventListener("click", (e) => e.stopPropagation());
  });

  // Example cards
  document.querySelectorAll(".example-card").forEach(card => {
    card.addEventListener("click", () => {
      sceneDescription.value = card.dataset.description;
      selectedPerspective = card.dataset.perspective;
      perspectiveValue.textContent = card.dataset.perspectiveLabel;
      selectedWeather = card.dataset.weather;
      weatherValue.textContent = card.dataset.weatherLabel;

      if (card.dataset.preloadedImage) {
        loadPreloadedImage(card.dataset.preloadedImage, card.dataset.preloadedScene);
      } else {
        sceneDescription.focus();
      }
    });
  });
}

// --- Load a preloaded example image from disk ---
async function loadPreloadedImage(imagePath, scenePath) {
  closeEditDialog();
  showLoading("Loading example...");
  viewerPlaceholder.classList.add("d-none");

  try {
    // Load image
    const imgResponse = await fetch(imagePath);
    const blob = await imgResponse.blob();
    const mimeType = blob.type || "image/png";

    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(blob);
    });

    currentBase64 = base64;
    currentMimeType = mimeType;
    currentImageDataUrl = `data:${mimeType};base64,${base64}`;

    loadPanorama(currentImageDataUrl);
    hideLoading();
    viewerToolbar.classList.remove("d-none");
    editBar.classList.remove("d-none");

    currentAnnotations = [];
    selectedAnnotationIndex = -1;

    // Load annotations from scene JSON file if provided
    if (scenePath) {
      try {
        const sceneResponse = await fetch(scenePath);
        const scene = await sceneResponse.json();
        if (scene.annotations && scene.annotations.length) {
          currentAnnotations = scene.annotations;
          addMarkers(currentAnnotations);
          annotationsPanel.classList.remove("d-none");
          renderAnnotationChips();
          return;
        }
      } catch (e) {
        console.warn("Failed to load scene annotations:", e);
      }
    }

    // Fall back to AI annotation if no scene file
    if (autoAnnotateToggle.checked) {
      annotationsPanel.classList.remove("d-none");
      annotateInBackground(base64, mimeType);
    } else {
      annotationsPanel.classList.add("d-none");
    }
  } catch (err) {
    hideLoading();
    showError("Failed to load example image.");
    console.error("Preload error:", err);
  }
}

// --- Theme ---
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-bs-theme", theme);
  themeIcon.className = theme === "dark" ? "bi bi-sun" : "bi bi-moon-stars";
  localStorage.setItem("ps-theme", theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
}

// --- Dropdown helpers ---
function initDropdown(menu, valueEl, customInput, btn, onSelect) {
  menu.addEventListener("click", (e) => {
    const option = e.target.closest(".select-option");
    if (!option) return;
    menu.querySelectorAll(".select-option").forEach(o => o.classList.remove("active"));
    option.classList.add("active");
    valueEl.textContent = option.textContent.trim();
    onSelect(option.dataset.value, option.textContent.trim());
    if (customInput) customInput.value = "";
  });
}

function clearActiveOption(menu) {
  menu.querySelectorAll(".select-option").forEach(o => o.classList.remove("active"));
}

function updateDropdownIcon(btn, label) {
  const iconMap = {
    "Eye level": "bi-person-standing", "Bird's eye": "bi-arrow-down-circle",
    "Low angle": "bi-arrow-up-circle", "Drone (50m)": "bi-send",
    "Indoor": "bi-house", "Underwater": "bi-water",
    "Clear sky": "bi-sun", "Golden hour": "bi-sunset",
    "Blue hour": "bi-moon-stars", "Overcast": "bi-cloud",
    "Rainy": "bi-cloud-rain-heavy", "Snowy": "bi-snow2",
    "Foggy": "bi-cloud-fog2", "Starry night": "bi-stars",
    "Neon nights": "bi-lightbulb",
  };
  const icon = btn.querySelector(".select-icon");
  const newClass = iconMap[label];
  if (icon && newClass) icon.className = `bi ${newClass} select-icon`;
}

// --- API Key ---
function saveApiKey() {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  localStorage.setItem("gemini-api-key", key);
  initGemini(key);
  apiKeyModal.hide();
}

// --- Prompt mode toggle ---
function updatePromptMode() {
  const isSimple = modeSimple.checked;
  simpleFields.classList.toggle("d-none", !isSimple);
  advancedFields.classList.toggle("d-none", isSimple);
}

// --- Get the current prompt ---
function getCurrentPrompt() {
  if (modeAdvanced.checked) return fullPrompt.value.trim();
  const desc = sceneDescription.value.trim();
  if (!desc) return null;
  return buildPrompt({ description: desc, perspective: selectedPerspective, weather: selectedWeather });
}

// --- Improve prompt ---
async function handleImprovePrompt() {
  const desc = sceneDescription.value.trim();
  if (!desc) { showError("Write a scene description first."); return; }

  const apiKey = localStorage.getItem("gemini-api-key");
  if (!apiKey) { apiKeyModal.show(); return; }

  btnImprove.disabled = true;
  btnImprove.querySelector(".btn-improve-label").classList.add("d-none");
  btnImprove.querySelector(".btn-improve-spinner").classList.remove("d-none");

  try {
    const improved = await improvePrompt(desc);
    sceneDescription.value = improved;
    // Auto-resize textarea to fit content
    sceneDescription.style.height = "auto";
    sceneDescription.style.height = sceneDescription.scrollHeight + "px";
  } catch (err) {
    showError(err.message || "Failed to improve prompt.");
    console.error("Improve prompt error:", err);
  } finally {
    btnImprove.disabled = false;
    btnImprove.querySelector(".btn-improve-label").classList.remove("d-none");
    btnImprove.querySelector(".btn-improve-spinner").classList.add("d-none");
  }
}

// --- Edit panorama ---
async function handleEditPanorama() {
  const instruction = editBarInput.value.trim();
  if (!instruction) return;
  if (!currentBase64 || !currentMimeType) {
    showError("Generate a panorama first.");
    return;
  }

  const apiKey = localStorage.getItem("gemini-api-key");
  if (!apiKey) { apiKeyModal.show(); return; }

  isGenerating = true;
  btnEditSend.disabled = true;
  btnGenerate.disabled = true;
  editBarInput.disabled = true;
  closeEditDialog();
  showLoading("Applying edit...");

  try {
    const { base64, mimeType } = await editPanorama(currentBase64, currentMimeType, instruction);
    currentBase64 = base64;
    currentMimeType = mimeType;
    currentImageDataUrl = `data:${mimeType};base64,${base64}`;

    showLoading("Loading viewer...");
    loadPanorama(currentImageDataUrl);
    hideLoading();

    // Re-add existing markers
    if (currentAnnotations.length) {
      rebuildMarkers(currentAnnotations);
    }

    editBarInput.value = "";
  } catch (err) {
    hideLoading();
    showError(err.message || "Edit failed. Please try again.");
    console.error("Edit error:", err);
  } finally {
    isGenerating = false;
    btnEditSend.disabled = false;
    btnGenerate.disabled = false;
    editBarInput.disabled = false;
  }
}

// --- Generate flow ---
async function handleGenerate() {
  if (isGenerating) return;
  const apiKey = localStorage.getItem("gemini-api-key");
  if (!apiKey) { apiKeyModal.show(); return; }

  const prompt = getCurrentPrompt();
  if (!prompt) { showError("Please describe a scene first."); return; }

  isGenerating = true;
  btnGenerate.disabled = true;
  closeEditDialog();
  showLoading("Generating panorama...");

  try {
    const { base64, mimeType } = await generatePanorama(prompt);
    currentBase64 = base64;
    currentMimeType = mimeType;
    currentImageDataUrl = `data:${mimeType};base64,${base64}`;

    showLoading("Loading viewer...");
    viewerPlaceholder.classList.add("d-none");
    loadPanorama(currentImageDataUrl);
    hideLoading();
    viewerToolbar.classList.remove("d-none");
    editBar.classList.remove("d-none");

    currentAnnotations = [];
    selectedAnnotationIndex = -1;

    if (autoAnnotateToggle.checked) {
      annotationsPanel.classList.remove("d-none");
      annotateInBackground(base64, mimeType);
    } else {
      annotationsPanel.classList.add("d-none");
    }
  } catch (err) {
    hideLoading();
    showError(err.message || "Generation failed. Please try again.");
    console.error("Generation error:", err);
  } finally {
    isGenerating = false;
    btnGenerate.disabled = false;
  }
}

// --- Annotation (non-blocking) ---
async function annotateInBackground(base64, mimeType) {
  annotationsPanel.classList.remove("d-none");
  annotationChips.innerHTML =
    '<div class="annotations-loading"></div><div class="annotations-loading"></div><div class="annotations-loading"></div>';

  try {
    const annotations = await annotateImage(base64, mimeType);
    currentAnnotations = annotations;
    addMarkers(annotations);
    renderAnnotationChips();
  } catch (err) {
    console.warn("Annotation failed:", err);
    currentAnnotations = [];
    renderAnnotationChips();
  }
}

// ==============================================
// Annotation Chips — hover icons, edit dialog
// ==============================================

function renderAnnotationChips() {
  annotationChips.innerHTML = "";
  currentAnnotations.forEach((a, i) => {
    const chip = document.createElement("button");
    chip.className = "annotation-chip" + (i === selectedAnnotationIndex ? " selected" : "");
    chip.title = a.description;

    chip.innerHTML = `
      <span class="chip-number">${i + 1}</span>
      ${escapeHtml(a.name)}
      <span class="chip-actions">
        <span class="chip-action-btn" data-action="edit" data-index="${i}" title="Edit"><i class="bi bi-pencil"></i></span>
        <span class="chip-action-btn" data-action="move" data-index="${i}" title="Move"><i class="bi bi-arrows-move"></i></span>
      </span>
    `;

    // Clicking the chip body pans to the annotation
    chip.addEventListener("click", (e) => {
      // Don't pan if an action button was clicked
      if (e.target.closest(".chip-action-btn")) return;
      panTo(a.yaw, a.pitch);
    });

    annotationChips.appendChild(chip);
  });

  // Delegate action button clicks
  annotationChips.querySelectorAll(".chip-action-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      const action = btn.dataset.action;

      if (action === "edit") {
        openEditDialog(idx, btn);
      } else if (action === "move") {
        startReposition(idx);
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Edit dialog ---
function openEditDialog(index, anchorEl) {
  selectedAnnotationIndex = index;
  const a = currentAnnotations[index];

  editName.value = a.name;
  editDescription.value = a.description;
  editDialog.classList.remove("d-none");

  // Position the dialog near the chip, clamped to viewport
  const chipRect = anchorEl.closest(".annotation-chip").getBoundingClientRect();
  const dialogWidth = 320;
  const dialogHeight = 200; // approximate

  let left = chipRect.left;
  let top = chipRect.bottom + 8;

  // Clamp horizontally
  if (left + dialogWidth > window.innerWidth - 16) {
    left = window.innerWidth - dialogWidth - 16;
  }
  if (left < 16) left = 16;

  // If dialog would go below viewport, show above the chip instead
  if (top + dialogHeight > window.innerHeight - 16) {
    top = chipRect.top - dialogHeight - 8;
  }
  // Final clamp
  if (top < 16) top = 16;

  editDialog.style.left = `${left}px`;
  editDialog.style.top = `${top}px`;

  renderAnnotationChips();
  editName.focus();
}

function closeEditDialog() {
  cancelReposition();
  editDialog.classList.add("d-none");
  selectedAnnotationIndex = -1;
  renderAnnotationChips();
}

function handleEditorInput() {
  if (selectedAnnotationIndex < 0) return;
  const a = currentAnnotations[selectedAnnotationIndex];
  a.name = editName.value.trim() || "Untitled";
  a.description = editDescription.value.trim();
  addMarker(a, selectedAnnotationIndex);
  // Update chip text without losing focus
  const chips = annotationChips.querySelectorAll(".annotation-chip");
  if (chips[selectedAnnotationIndex]) {
    const numberSpan = chips[selectedAnnotationIndex].querySelector(".chip-number");
    const actionsSpan = chips[selectedAnnotationIndex].querySelector(".chip-actions");
    // Rebuild chip inner content
    chips[selectedAnnotationIndex].childNodes.forEach(node => {
      if (node !== numberSpan && node !== actionsSpan && node.nodeType === Node.TEXT_NODE) {
        node.textContent = ` ${a.name} `;
      }
    });
  }
}

// --- Reposition (pan-to-place) ---
function startReposition(index) {
  if (index !== undefined) {
    selectedAnnotationIndex = index;
    renderAnnotationChips();
  }
  if (selectedAnnotationIndex < 0) return;

  // Close edit dialog if open (don't reset selectedAnnotationIndex)
  editDialog.classList.add("d-none");

  const a = currentAnnotations[selectedAnnotationIndex];
  repositionOriginal = { yaw: a.yaw, pitch: a.pitch };

  isRepositioning = true;
  repositionBanner.classList.remove("d-none");
  repositionCrosshair.classList.remove("d-none");
  editBar.classList.add("d-none");

  // Pan to current position, then start following view center
  panTo(a.yaw, a.pitch);
  startFollowingCenter(selectedAnnotationIndex, a);
}

function confirmReposition() {
  if (!isRepositioning || selectedAnnotationIndex < 0) return;

  stopFollowingCenter();

  // Read final position from the annotation (updated by the rAF loop)
  const a = currentAnnotations[selectedAnnotationIndex];
  addMarker(a, selectedAnnotationIndex);

  isRepositioning = false;
  repositionOriginal = null;
  repositionBanner.classList.add("d-none");
  repositionCrosshair.classList.add("d-none");
  editBar.classList.remove("d-none");
  renderAnnotationChips();
}

function cancelReposition() {
  if (!isRepositioning) {
    // Just hide UI if not repositioning
    repositionBanner.classList.add("d-none");
    repositionCrosshair.classList.add("d-none");
    return;
  }

  stopFollowingCenter();

  // Restore original position
  if (selectedAnnotationIndex >= 0 && repositionOriginal) {
    const a = currentAnnotations[selectedAnnotationIndex];
    a.yaw = repositionOriginal.yaw;
    a.pitch = repositionOriginal.pitch;
    addMarker(a, selectedAnnotationIndex);
  }

  isRepositioning = false;
  repositionOriginal = null;
  repositionBanner.classList.add("d-none");
  repositionCrosshair.classList.add("d-none");
  editBar.classList.remove("d-none");
  renderAnnotationChips();
}

// --- Add new annotation ---
function handleAddAnnotation() {
  if (!currentImageDataUrl) {
    showError("Generate a panorama first.");
    return;
  }

  annotationsPanel.classList.remove("d-none");

  const newAnnotation = {
    name: "New Point",
    description: "",
    yaw: 0,
    pitch: 0,
  };

  currentAnnotations.push(newAnnotation);
  const idx = currentAnnotations.length - 1;
  addMarker(newAnnotation, idx);
  renderAnnotationChips();

  // Enter reposition mode so user places it immediately
  startReposition(idx);
}

// --- Delete annotation ---
function handleDeleteAnnotation() {
  if (selectedAnnotationIndex < 0) return;
  currentAnnotations.splice(selectedAnnotationIndex, 1);
  closeEditDialog();
  rebuildMarkers(currentAnnotations);
  renderAnnotationChips();
}

// --- Download image ---
function handleDownloadImage() {
  if (!currentImageDataUrl) return;
  const link = document.createElement("a");
  link.href = currentImageDataUrl;
  const ext = currentMimeType?.includes("png") ? "png" : "jpeg";
  link.download = `photosphere_${Date.now()}.${ext}`;
  link.click();
}

// --- Save scene JSON ---
function handleSaveScene() {
  if (!currentImageDataUrl) return;
  const scene = {
    version: 1,
    createdAt: new Date().toISOString(),
    prompt: getCurrentPrompt(),
    image: { dataUrl: currentImageDataUrl, mimeType: currentMimeType },
    annotations: currentAnnotations,
  };
  const blob = new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `photosphere_scene_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// --- Clear ---
function handleClear() {
  destroyViewer();
  currentAnnotations = [];
  selectedAnnotationIndex = -1;
  currentImageDataUrl = null;
  currentBase64 = null;
  currentMimeType = null;

  annotationsPanel.classList.add("d-none");
  editDialog.classList.add("d-none");
  annotationChips.innerHTML = "";
  viewerToolbar.classList.add("d-none");
  editBar.classList.add("d-none");
  editBarInput.value = "";
  viewerPlaceholder.classList.remove("d-none");

  sceneDescription.value = "";
  fullPrompt.value = "";

  selectedPerspective = "from eye level";
  selectedWeather = "Clear sky, bright daylight";
  perspectiveValue.textContent = "Eye level";
  weatherValue.textContent = "Clear sky";

  perspectiveMenu.querySelectorAll(".select-option").forEach((o, i) => {
    o.classList.toggle("active", i === 0);
  });
  weatherMenu.querySelectorAll(".select-option").forEach((o, i) => {
    o.classList.toggle("active", i === 0);
  });
}

// --- UI helpers ---
function showLoading(message) {
  viewerLoading.classList.remove("d-none");
  loadingStatus.textContent = message;
}

function hideLoading() {
  viewerLoading.classList.add("d-none");
}

function showError(message) {
  errorToastBody.textContent = message;
  errorToast.show();
}

// --- Start ---
init();
