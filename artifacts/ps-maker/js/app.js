import {
  initGemini,
  buildPrompt,
  generatePanorama,
  editPanorama,
  expandToPanorama,
  overheadToPanorama,
  annotateImage,
  improvePrompt,
} from "./gemini.js";
import { saveToHistory, getHistory, getHistoryEntry, deleteHistoryEntry } from "./history.js";
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
const btnTheme = document.getElementById("btn-theme");
const themeIcon = document.getElementById("theme-icon");
const btnHistory = document.getElementById("btn-history");
const historyPanel = document.getElementById("history-panel");
const historyList = document.getElementById("history-list");
const btnHistoryClose = document.getElementById("btn-history-close");
const btnSettings = document.getElementById("btn-settings");
const btnSaveKey = document.getElementById("btn-save-key");
const apiKeyInput = document.getElementById("api-key-input");
const modeGenerate = document.getElementById("mode-generate");
const modeExpand = document.getElementById("mode-expand");
const modeOverhead = document.getElementById("mode-overhead");
const simpleFields = document.getElementById("simple-fields");
const expandFields = document.getElementById("expand-fields");
const overheadFields = document.getElementById("overhead-fields");
const sceneDescription = document.getElementById("scene-description");
const btnGenerateLabel = document.getElementById("btn-generate-label");
const btnGenerateIcon = document.getElementById("btn-generate-icon");
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

const apiKeyModal = new bootstrap.Modal(document.getElementById("api-key-modal"));
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
const size2k = document.getElementById("size-2k");
const size4k = document.getElementById("size-4k");
const sizeCost = document.getElementById("size-cost");
const modelFlash = document.getElementById("model-flash");
const modelPro = document.getElementById("model-pro");
const modelCost = document.getElementById("model-cost");

function getSelectedImageSize() {
  return size4k.checked ? "4K" : "2K";
}

function getSelectedModel() {
  return modelPro.checked ? "pro" : "flash";
}

// Token / cost display refs
const costEstimate = document.getElementById("cost-estimate");
const costInfoLink = document.getElementById("cost-info-link");
const annotateCost = document.getElementById("annotate-cost");
const expandTokenBadge = document.getElementById("expand-token-badge");
const expandTokenCount = document.getElementById("expand-token-count");
const overheadTokenBadge = document.getElementById("overhead-token-badge");
const overheadTokenCount = document.getElementById("overhead-token-count");

// Expand mode state
let expandImage = null; // { base64, mimeType } or null
const expandSlot = document.getElementById("expand-slot-front");
const expandInput = document.getElementById("expand-input-front");
const expandThumb = document.getElementById("expand-thumb-front");
const expandPreview = document.getElementById("expand-preview-front");
const expandPromptEl = document.getElementById("expand-prompt-front");
const expandClearBtn = document.getElementById("expand-clear-front");
const expandDescLeft = document.getElementById("expand-desc-left");
const expandDescRight = document.getElementById("expand-desc-right");
const expandDescBehind = document.getElementById("expand-desc-behind");

// Overhead mode state
let overheadImage = null; // { base64, mimeType } or null
const subSatellite = document.getElementById("sub-satellite");
const subBlueprint = document.getElementById("sub-blueprint");
const overheadSlot = document.getElementById("overhead-slot");
const overheadInput = document.getElementById("overhead-input");
const overheadThumb = document.getElementById("overhead-thumb");
const overheadPreview = document.getElementById("overhead-preview");
const overheadPromptEl = document.getElementById("overhead-prompt");
const overheadClearBtn = document.getElementById("overhead-clear");
const overheadPromptIcon = document.getElementById("overhead-prompt-icon");
const overheadPromptLabel = document.getElementById("overhead-prompt-label");
const overheadDetails = document.getElementById("overhead-details");

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

  // API key listeners
  btnSaveKey.addEventListener("click", saveApiKey);
  apiKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveApiKey();
  });
  btnSettings.addEventListener("click", () => {
    apiKeyInput.value = localStorage.getItem("gemini-api-key") || "";
    apiKeyModal.show();
  });

  // History
  btnHistory.addEventListener("click", toggleHistory);
  btnHistoryClose.addEventListener("click", () => historyPanel.classList.add("d-none"));
  btnTheme.addEventListener("click", toggleTheme);
  btnGenerate.addEventListener("click", handleGenerate);
  btnClear.addEventListener("click", handleClear);
  btnImprove.addEventListener("click", handleImprovePrompt);
  btnEditSend.addEventListener("click", handleEditPanorama);
  editBarInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleEditPanorama();
  });
  modeGenerate.addEventListener("change", () => { updatePromptMode(); estimateCost(); });
  modeExpand.addEventListener("change", () => { updatePromptMode(); estimateCost(); });
  modeOverhead.addEventListener("change", () => { updatePromptMode(); estimateCost(); });
  sceneDescription.addEventListener("input", estimateCost);
  autoAnnotateToggle.addEventListener("change", estimateCost);
  size2k.addEventListener("change", estimateCost);
  size4k.addEventListener("change", estimateCost);
  modelFlash.addEventListener("change", estimateCost);
  modelPro.addEventListener("change", estimateCost);

  // Ensure correct defaults on page reload (browsers can remember radio state)
  size2k.checked = true;
  modelFlash.checked = true;

  // Overhead sub-mode toggle
  subSatellite.addEventListener("change", updateOverheadSubMode);
  subBlueprint.addEventListener("change", updateOverheadSubMode);

  // Overhead mode: upload handlers
  overheadSlot.addEventListener("click", (e) => {
    if (e.target.closest(".expand-slot-clear")) return;
    overheadInput.click();
  });
  overheadInput.addEventListener("change", (e) => {
    if (e.target.files[0]) processOverheadImage(e.target.files[0]);
  });
  overheadSlot.addEventListener("dragover", (e) => {
    e.preventDefault();
    overheadSlot.classList.add("drag-over");
  });
  overheadSlot.addEventListener("dragleave", () => {
    overheadSlot.classList.remove("drag-over");
  });
  overheadSlot.addEventListener("drop", (e) => {
    e.preventDefault();
    overheadSlot.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) processOverheadImage(file);
  });
  overheadClearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    clearOverheadImage();
  });

  // Expand mode: single photo upload handlers
  expandSlot.addEventListener("click", (e) => {
    if (e.target.closest(".expand-slot-clear")) return;
    expandInput.click();
  });
  expandInput.addEventListener("change", (e) => {
    if (e.target.files[0]) processExpandImage(e.target.files[0]);
  });
  expandSlot.addEventListener("dragover", (e) => {
    e.preventDefault();
    expandSlot.classList.add("drag-over");
  });
  expandSlot.addEventListener("dragleave", () => {
    expandSlot.classList.remove("drag-over");
  });
  expandSlot.addEventListener("drop", (e) => {
    e.preventDefault();
    expandSlot.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) processExpandImage(file);
  });
  expandClearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    clearExpandImage();
  });

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

  estimateCost();
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
  const isGenerate = modeGenerate.checked;
  const isExpand = modeExpand.checked;
  const isOverhead = modeOverhead.checked;
  simpleFields.classList.toggle("d-none", !isGenerate);
  expandFields.classList.toggle("d-none", !isExpand);
  overheadFields.classList.toggle("d-none", !isOverhead);
  if (isGenerate) {
    btnGenerateIcon.className = "bi bi-stars";
    btnGenerateLabel.textContent = "Generate Photosphere";
  } else if (isExpand) {
    btnGenerateIcon.className = "bi bi-arrows-fullscreen";
    btnGenerateLabel.textContent = "Expand to 360\u00B0";
  } else {
    updateOverheadButtonLabel();
  }
}

function updateOverheadSubMode() {
  const isSatellite = subSatellite.checked;
  overheadPromptIcon.className = isSatellite ? "bi bi-geo-alt" : "bi bi-rulers";
  overheadPromptLabel.textContent = isSatellite
    ? "Upload a satellite or aerial image"
    : "Upload a floor plan or blueprint";
  overheadDetails.placeholder = isSatellite
    ? "e.g. Suburban neighborhood, summer, late afternoon..."
    : "e.g. Modern kitchen, hardwood floors, granite countertops...";
  updateOverheadButtonLabel();
}

function updateOverheadButtonLabel() {
  if (subSatellite.checked) {
    btnGenerateIcon.className = "bi bi-geo-alt";
    btnGenerateLabel.textContent = "Create from Satellite";
  } else {
    btnGenerateIcon.className = "bi bi-rulers";
    btnGenerateLabel.textContent = "Create from Blueprint";
  }
}

// --- Get the current prompt ---
function getCurrentPrompt() {
  if (modeExpand.checked) return "(expand mode)";
  if (modeOverhead.checked) return "(overhead mode)";
  const desc = sceneDescription.value.trim();
  if (!desc) return null;
  return buildPrompt({ description: desc, perspective: selectedPerspective, weather: selectedWeather });
}

// --- Improve prompt ---
async function handleImprovePrompt() {
  const desc = sceneDescription.value.trim();
  if (!desc) { showError("Write a scene description first."); return; }



  btnImprove.disabled = true;
  btnImprove.querySelector(".btn-improve-icon").classList.add("d-none");
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
    btnImprove.querySelector(".btn-improve-icon").classList.remove("d-none");
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



  isGenerating = true;
  btnEditSend.disabled = true;
  btnGenerate.disabled = true;
  editBarInput.disabled = true;
  closeEditDialog();
  showLoading("Applying edit...");

  try {
    const { base64, mimeType } = await editPanorama(currentBase64, currentMimeType, instruction, getSelectedImageSize(), getSelectedModel());
    currentBase64 = base64;
    currentMimeType = mimeType;
    currentImageDataUrl = `data:${mimeType};base64,${base64}`;

    showLoading("Loading viewer...");
    loadPanorama(currentImageDataUrl, currentAnnotations.length ? currentAnnotations : null);
    hideLoading();

    saveCurrentToHistory(instruction, "edit");
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
  if (modeExpand.checked) return handleExpand();
  if (modeOverhead.checked) return handleOverhead();



  const prompt = getCurrentPrompt();
  if (!prompt) { showError("Please describe a scene first."); return; }

  isGenerating = true;
  btnGenerate.disabled = true;
  closeEditDialog();
  showLoading("Generating panorama...");

  try {
    const { base64, mimeType } = await generatePanorama(prompt, getSelectedImageSize(), getSelectedModel());
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
    saveCurrentToHistory(prompt, "generate");

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

// --- Expand flow ---
async function handleExpand() {


  if (!expandImage) {
    showError("Upload a photo to expand.");
    return;
  }

  isGenerating = true;
  btnGenerate.disabled = true;
  closeEditDialog();
  showLoading("Expanding to 360\u00B0 panorama...");

  try {
    const directions = {
      left: expandDescLeft.value.trim() || undefined,
      right: expandDescRight.value.trim() || undefined,
      behind: expandDescBehind.value.trim() || undefined,
    };

    const { base64, mimeType } = await expandToPanorama(
      expandImage.base64, expandImage.mimeType, directions, getSelectedImageSize(), getSelectedModel()
    );
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
    saveCurrentToHistory("(expand)", "expand");

    if (autoAnnotateToggle.checked) {
      annotationsPanel.classList.remove("d-none");
      annotateInBackground(base64, mimeType);
    } else {
      annotationsPanel.classList.add("d-none");
    }
  } catch (err) {
    hideLoading();
    showError(err.message || "Expand failed. Please try again.");
    console.error("Expand error:", err);
  } finally {
    isGenerating = false;
    btnGenerate.disabled = false;
  }
}

// --- Expand image processing ---
function processExpandImage(file) {
  if (!file.type.startsWith("image/")) {
    showError("Please upload an image file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const { base64, mimeType, width, height } = resizeImage(img, 1024);
      expandImage = { base64, mimeType, width, height };

      expandThumb.src = `data:${mimeType};base64,${base64}`;
      expandPreview.classList.remove("d-none");
      expandPromptEl.classList.add("d-none");
      expandSlot.classList.add("filled");
      showTokenBadge(expandTokenBadge, expandTokenCount, width, height);
      estimateCost();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function clearExpandImage() {
  expandImage = null;
  expandInput.value = "";
  expandPreview.classList.add("d-none");
  expandPromptEl.classList.remove("d-none");
  expandSlot.classList.remove("filled");
  hideTokenBadge(expandTokenBadge);
  estimateCost();
}

// --- Overhead flow ---
async function handleOverhead() {


  if (!overheadImage) {
    showError(subSatellite.checked
      ? "Upload a satellite or aerial image."
      : "Upload a floor plan or blueprint.");
    return;
  }

  const subMode = subSatellite.checked ? "satellite" : "blueprint";
  const details = overheadDetails.value.trim() || undefined;

  isGenerating = true;
  btnGenerate.disabled = true;
  closeEditDialog();
  showLoading(subMode === "satellite"
    ? "Analyzing satellite imagery..."
    : "Analyzing blueprint...");

  try {
    const { base64, mimeType } = await overheadToPanorama(
      overheadImage.base64, overheadImage.mimeType,
      subMode, details,
      (msg) => showLoading(msg), getSelectedImageSize(), getSelectedModel()
    );
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
    saveCurrentToHistory(details || `(${subMode})`, `overhead-${subMode}`);

    if (autoAnnotateToggle.checked) {
      annotationsPanel.classList.remove("d-none");
      annotateInBackground(base64, mimeType);
    } else {
      annotationsPanel.classList.add("d-none");
    }
  } catch (err) {
    hideLoading();
    showError(err.message || "Conversion failed. Please try again.");
    console.error("Overhead error:", err);
  } finally {
    isGenerating = false;
    btnGenerate.disabled = false;
  }
}

// --- Overhead image processing ---
function processOverheadImage(file) {
  if (!file.type.startsWith("image/")) {
    showError("Please upload an image file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const { base64, mimeType, width, height } = resizeImage(img, 1024);
      overheadImage = { base64, mimeType, width, height };

      overheadThumb.src = `data:${mimeType};base64,${base64}`;
      overheadPreview.classList.remove("d-none");
      overheadPromptEl.classList.add("d-none");
      overheadSlot.classList.add("filled");
      showTokenBadge(overheadTokenBadge, overheadTokenCount, width, height);
      estimateCost();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function clearOverheadImage() {
  overheadImage = null;
  overheadInput.value = "";
  overheadPreview.classList.add("d-none");
  overheadPromptEl.classList.remove("d-none");
  overheadSlot.classList.remove("filled");
  hideTokenBadge(overheadTokenBadge);
  estimateCost();
}

function resizeImage(img, maxWidth) {
  const canvas = document.createElement("canvas");
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > maxWidth) {
    h = h * (maxWidth / w);
    w = maxWidth;
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  return {
    base64: dataUrl.split(",")[1],
    mimeType: "image/jpeg",
    width: Math.round(w),
    height: Math.round(h),
  };
}

// --- Token counting & cost estimation ---
// Gemini image token formula: ≤384px both sides = 258 tokens, else 768px tiles × 258 each
function countImageTokens(w, h) {
  if (w <= 384 && h <= 384) return 258;
  return Math.ceil(w / 768) * Math.ceil(h / 768) * 258;
}

// Pricing (per token) — Flash vs Pro
const PRICE = {
  flash: {
    input:      0.50 / 1e6,  // gemini-3.1-flash input
    outputImg:  60.0 / 1e6,  // image output
    outputTxt:   3.0 / 1e6,  // text output
  },
  pro: {
    input:      2.00 / 1e6,  // gemini-3-pro input
    outputImg: 134.0 / 1e6,  // image output ($0.134/img ÷ ~1000 tokens)
    outputTxt:  12.0 / 1e6,  // text output
  },
  flash25Input:  0.30 / 1e6, // gemini-2.5-flash input (for VLM/annotation)
  flash25Output: 2.50 / 1e6, // gemini-2.5-flash output
};
// Output image tokens by size (from Gemini pricing page)
const OUTPUT_TOKENS_BY_SIZE = { "2K": 1680, "4K": 2520 };

// Annotation cost: output image sent to gemini-2.5-flash + ~100 token prompt, ~300 token JSON response
const ANNOTATE_OUTPUT_TOKENS = 300;

function getAnnotateCost(outputTokens) {
  return (outputTokens + 100) * PRICE.flash25Input + ANNOTATE_OUTPUT_TOKENS * PRICE.flash25Output;
}

function estimateCost() {
  const isGenerate = modeGenerate.checked;
  const isExpand = modeExpand.checked;
  const isOverhead = modeOverhead.checked;
  const willAnnotate = autoAnnotateToggle.checked;
  const imgSize = getSelectedImageSize();
  const mdl = getSelectedModel();
  const p = PRICE[mdl];
  const outputImageTokens = OUTPUT_TOKENS_BY_SIZE[imgSize];

  let cost = 0;
  const outputImgCost = outputImageTokens * p.outputImg;

  // Show per-unit costs
  sizeCost.textContent = `~$${outputImgCost.toFixed(3)}/img`;
  modelCost.textContent = mdl === "pro" ? "$2.00/1M in" : "$0.50/1M in";

  if (isGenerate) {
    const promptTokens = Math.ceil((sceneDescription.value.length || 50) / 4) + 80;
    cost = promptTokens * p.input + outputImgCost;
  } else if (isExpand) {
    const imgTokens = expandImage ? countImageTokens(expandImage.width, expandImage.height) : 258;
    const promptTokens = 200;
    cost = (imgTokens + promptTokens) * p.input + outputImgCost;
  } else if (isOverhead) {
    const imgTokens = overheadImage ? countImageTokens(overheadImage.width, overheadImage.height) : 258;
    // Step 1: VLM analysis (gemini-2.5-flash)
    const step1Input = (imgTokens + 500) * PRICE.flash25Input;
    const step1Output = 800 * PRICE.flash25Output;
    // Step 2: Image generation (selected model)
    const step2Input = 800 * p.input;
    cost = step1Input + step1Output + step2Input + outputImgCost;
  }

  const annotateCostVal = getAnnotateCost(outputImageTokens);
  if (willAnnotate) cost += annotateCostVal;

  costEstimate.textContent = `~$${cost.toFixed(3)} est.`;
  costEstimate.classList.remove("d-none");
  costInfoLink.classList.remove("d-none");
  updateAnnotateCostDisplay(willAnnotate, annotateCostVal);
}

function updateAnnotateCostDisplay(enabled, costVal) {
  if (enabled) {
    annotateCost.textContent = `~$${(costVal || 0.001).toFixed(4)}/run`;
    annotateCost.style.opacity = "0.6";
  } else {
    annotateCost.textContent = "off";
    annotateCost.style.opacity = "0.35";
  }
}

function showTokenBadge(badge, countEl, width, height) {
  const tokens = countImageTokens(width, height);
  countEl.textContent = `${tokens.toLocaleString()} tokens`;
  badge.classList.remove("d-none");
}

function hideTokenBadge(badge) {
  badge.classList.add("d-none");
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
        <span class="chip-action-btn" data-action="edit" data-index="${i}" title="Edit"><i class="bi bi-pencil" aria-hidden="true"></i></span>
        <span class="chip-action-btn" data-action="move" data-index="${i}" title="Move"><i class="bi bi-arrows-move" aria-hidden="true"></i></span>
        <span class="chip-action-btn chip-delete-btn" data-action="delete" data-index="${i}" title="Delete"><i class="bi bi-trash3" aria-hidden="true"></i></span>
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
      } else if (action === "delete") {
        currentAnnotations.splice(idx, 1);
        rebuildMarkers(currentAnnotations);
        renderAnnotationChips();
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
  clearExpandImage();
  expandDescLeft.value = "";
  expandDescRight.value = "";
  expandDescBehind.value = "";
  clearOverheadImage();
  overheadDetails.value = "";

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

// --- History ---
function saveCurrentToHistory(prompt, mode) {
  if (!currentImageDataUrl) return;
  saveToHistory({
    imageDataUrl: currentImageDataUrl,
    mimeType: currentMimeType,
    prompt: prompt || "",
    mode: mode || "generate",
    imageSize: getSelectedImageSize(),
    model: getSelectedModel(),
    annotations: currentAnnotations || [],
  }).catch(err => console.warn("History save failed:", err));
}

async function toggleHistory() {
  historyPanel.classList.toggle("d-none");
  if (!historyPanel.classList.contains("d-none")) {
    await renderHistory();
    historyPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function renderHistory() {
  try {
    const entries = await getHistory();
    if (!entries.length) {
      historyList.innerHTML = '<p style="color:var(--text-secondary);font-size:0.8rem;padding:1rem;text-align:center;">No history yet</p>';
      return;
    }
    historyList.innerHTML = entries.map(e => `
      <div class="history-item" data-id="${e.id}">
        <img class="history-thumb" src="${e.imageDataUrl}" alt="Photosphere">
        <div class="history-info">
          <span class="history-mode">${escapeHtml(e.mode)}${e.imageSize === "4K" ? ' <span class="badge-4k">4K</span>' : ''}${e.model === "pro" ? ' <span class="badge-pro">PRO</span>' : ''}</span>
          <span class="history-date">${new Date(e.createdAt).toLocaleString()}</span>
          <span class="history-prompt">${escapeHtml(e.prompt || '')}</span>
        </div>
        <div class="history-actions">
          <button class="history-load-btn" title="Load into viewer" aria-label="Load this photosphere"><i class="bi bi-eye" aria-hidden="true"></i></button>
          <button class="history-download-btn" title="Download image" aria-label="Download image"><i class="bi bi-download" aria-hidden="true"></i></button>
          <button class="history-delete-btn" title="Delete" aria-label="Delete this entry"><i class="bi bi-trash3" aria-hidden="true"></i></button>
        </div>
      </div>
    `).join('');

    // Load into viewer
    historyList.querySelectorAll('.history-load-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.closest('.history-item').dataset.id);
        loadHistoryEntry(id);
      });
    });

    // Click thumbnail to load too
    historyList.querySelectorAll('.history-thumb').forEach(thumb => {
      thumb.style.cursor = 'pointer';
      thumb.addEventListener('click', async () => {
        const id = parseInt(thumb.closest('.history-item').dataset.id);
        loadHistoryEntry(id);
      });
    });

    // Download
    historyList.querySelectorAll('.history-download-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.closest('.history-item').dataset.id);
        const entry = await getHistoryEntry(id);
        if (!entry) return;
        const link = document.createElement("a");
        link.href = entry.imageDataUrl;
        const ext = entry.mimeType?.includes("png") ? "png" : "jpeg";
        link.download = `photosphere_${id}.${ext}`;
        link.click();
      });
    });

    // Delete
    historyList.querySelectorAll('.history-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.closest('.history-item').dataset.id);
        await deleteHistoryEntry(id);
        await renderHistory();
      });
    });
  } catch (err) {
    console.warn("Failed to load history:", err);
  }
}

async function loadHistoryEntry(id) {
  const entry = await getHistoryEntry(id);
  if (!entry) return;
  currentImageDataUrl = entry.imageDataUrl;
  currentBase64 = entry.imageDataUrl.split(',')[1];
  currentMimeType = entry.mimeType;
  currentAnnotations = entry.annotations || [];
  selectedAnnotationIndex = -1;
  viewerPlaceholder.classList.add("d-none");
  loadPanorama(currentImageDataUrl, currentAnnotations.length ? currentAnnotations : null);
  viewerToolbar.classList.remove("d-none");
  editBar.classList.remove("d-none");
  if (currentAnnotations.length) {
    annotationsPanel.classList.remove("d-none");
    renderAnnotationChips();
  } else {
    annotationsPanel.classList.add("d-none");
  }
  historyPanel.classList.add("d-none");
  document.getElementById("viewer-wrapper").scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- Start ---
init();
