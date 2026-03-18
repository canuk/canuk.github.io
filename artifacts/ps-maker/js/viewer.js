let viewer = null;
let hotspotIds = [];
let _followRafId = null;
let _followIndex = null;

/**
 * Load or replace the panorama in the Pannellum viewer.
 */
export function loadPanorama(imageDataUrl) {
  if (viewer) {
    viewer.destroy();
    viewer = null;
  }
  hotspotIds = [];
  stopFollowingCenter();

  viewer = pannellum.viewer("panorama-container", {
    type: "equirectangular",
    panorama: imageDataUrl,
    autoLoad: true,
    showControls: true,
    compass: true,
    hotSpotDebug: false,
    hfov: 100,
  });

  return viewer;
}

/**
 * Add annotation hotspots to the current viewer.
 */
export function addMarkers(annotations) {
  if (!viewer) return;
  annotations.forEach((a, i) => {
    const id = `hotspot-${i}`;
    viewer.addHotSpot({
      id,
      pitch: a.pitch,
      yaw: a.yaw,
      type: "info",
      text: `${a.name}: ${a.description}`,
    });
    hotspotIds.push(id);
  });
}

/**
 * Add a single marker. Returns the hotspot id.
 */
export function addMarker(annotation, index) {
  if (!viewer) return null;
  const id = `hotspot-${index}`;
  // Remove if exists
  try { viewer.removeHotSpot(id); } catch {}
  viewer.addHotSpot({
    id,
    pitch: annotation.pitch,
    yaw: annotation.yaw,
    type: "info",
    text: `${annotation.name}: ${annotation.description}`,
  });
  if (!hotspotIds.includes(id)) hotspotIds.push(id);
  return id;
}

/**
 * Remove a single marker by index.
 */
export function removeMarker(index) {
  if (!viewer) return;
  const id = `hotspot-${index}`;
  try { viewer.removeHotSpot(id); } catch {}
  hotspotIds = hotspotIds.filter((h) => h !== id);
}

/**
 * Clear all hotspots.
 */
export function clearMarkers() {
  if (!viewer) return;
  hotspotIds.forEach((id) => {
    try { viewer.removeHotSpot(id); } catch {}
  });
  hotspotIds = [];
}

/**
 * Re-sync all markers from an annotations array.
 */
export function rebuildMarkers(annotations) {
  clearMarkers();
  addMarkers(annotations);
}

/**
 * Pan the viewer to a specific yaw/pitch with animation.
 */
export function panTo(yaw, pitch) {
  if (!viewer) return;
  viewer.lookAt(pitch, yaw, undefined, true);
}

/**
 * Start a rAF loop that moves the hotspot at `hotspotIndex` to follow
 * the current view center (yaw/pitch). The annotation object is updated
 * in place so callers can read the final position.
 */
export function startFollowingCenter(hotspotIndex, annotation) {
  stopFollowingCenter();
  if (!viewer) return;

  _followIndex = hotspotIndex;
  let lastYaw = null;
  let lastPitch = null;

  function tick() {
    if (!viewer) return;
    const yaw = viewer.getYaw();
    const pitch = viewer.getPitch();
    if (yaw !== lastYaw || pitch !== lastPitch) {
      lastYaw = yaw;
      lastPitch = pitch;
      annotation.yaw = yaw;
      annotation.pitch = pitch;
      const id = `hotspot-${hotspotIndex}`;
      try { viewer.removeHotSpot(id); } catch {}
      viewer.addHotSpot({
        id,
        pitch,
        yaw,
        type: "info",
        text: `${annotation.name}: ${annotation.description}`,
      });
    }
    _followRafId = requestAnimationFrame(tick);
  }

  _followRafId = requestAnimationFrame(tick);
}

/**
 * Stop the follow-center rAF loop.
 */
export function stopFollowingCenter() {
  if (_followRafId !== null) {
    cancelAnimationFrame(_followRafId);
    _followRafId = null;
  }
  _followIndex = null;
}

/**
 * Return the current view center coordinates.
 */
export function getCenterCoords() {
  if (!viewer) return { yaw: 0, pitch: 0 };
  return { yaw: viewer.getYaw(), pitch: viewer.getPitch() };
}

/**
 * Destroy the viewer and clean up.
 */
export function destroyViewer() {
  stopFollowingCenter();
  if (viewer) {
    viewer.destroy();
    viewer = null;
  }
  hotspotIds = [];
}

/**
 * Check if a viewer is currently active.
 */
export function isViewerActive() {
  return viewer !== null;
}
