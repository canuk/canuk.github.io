import { GoogleGenAI } from "https://esm.sh/@google/genai";

let ai = null;

export function initGemini(apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

const IMAGE_MODELS = {
  flash: "gemini-3.1-flash-image-preview",
  pro: "gemini-3-pro-image-preview",
};

function getModel(choice) {
  return IMAGE_MODELS[choice] || IMAGE_MODELS.flash;
}

function buildImageConfig(imageSize) {
  const config = { responseModalities: ["TEXT", "IMAGE"] };
  if (imageSize === "4K" || imageSize === "2K") {
    config.imageConfig = { imageSize };
  }
  return config;
}

function extractImage(response) {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error("No response from Gemini.");
  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart) {
    const textPart = parts.find((p) => p.text);
    throw new Error(
      textPart ? `Gemini returned text only: "${textPart.text.slice(0, 200)}"` : "No image in response."
    );
  }
  return { base64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || "image/png" };
}

export function buildPrompt({ description, perspective, weather }) {
  const persp = perspective?.trim() || "from eye level";
  const wthr = weather?.trim() || "Clear sky, bright daylight";
  return `A high-resolution, seamless 360-degree equirectangular photograph (2:1 aspect ratio), captured from an exact, stable vantage point ${persp} (approximately 5-6 feet high). This is an immersive, continuous spherical projection. There are zero stitching artifacts, and the edges flow smoothly with correct radial distortion.

Core Scene and Elevation (Midground to Horizon):
${description.trim()}

Perimeter and 360° Continuity (Closing the Loop):
The scene described above continues uninterrupted in all directions. When the viewer looks 180 degrees away from the main feature, the environment must seamlessly continue — matching terrain, structures, vegetation, and atmosphere — forming a perfect, continuous spherical horizon line.

Vertical Completion (Zenith and Nadir):
The Zenith (directly above): The view is completely filled by the sky, projecting correctly towards the apex of the sphere.
The Nadir (directly below): The ground plane is a seamless, photorealistic continuation of the immediate ground texture directly beneath the camera, forming the center of the image sphere.

Lighting: ${wthr}, casting sharp, consistent shadows that align perfectly across the entire panoramic view. Ultra-realistic texture throughout.`;
}

export async function generatePanorama(prompt, imageSize, model) {
  if (!ai) throw new Error("Set your API key first.");
  return extractImage(await ai.models.generateContent({
    model: getModel(model), contents: prompt, config: buildImageConfig(imageSize),
  }));
}

export async function editPanorama(base64, mimeType, instruction, imageSize, model) {
  if (!ai) throw new Error("Set your API key first.");
  return extractImage(await ai.models.generateContent({
    model: getModel(model),
    contents: [{ role: "user", parts: [
      { inlineData: { mimeType, data: base64 } },
      { text: `Edit this 360-degree equirectangular panorama image. ${instruction.trim()}. Keep it as a seamless equirectangular projection in 2:1 aspect ratio.` },
    ]}],
    config: buildImageConfig(imageSize),
  }));
}

export async function expandToPanorama(base64, mimeType, directions = {}, imageSize, model) {
  if (!ai) throw new Error("Set your API key first.");
  const dirParts = [];
  if (directions.left) dirParts.push(`To the left of the viewer: ${directions.left}.`);
  if (directions.right) dirParts.push(`To the right of the viewer: ${directions.right}.`);
  if (directions.behind) dirParts.push(`Behind the viewer: ${directions.behind}.`);
  const dirText = dirParts.length ? `\n\nWhen generating the surrounding environment, incorporate the following directional details:\n${dirParts.join("\n")}` : "";

  const promptText = `Use the provided image as the central frontal reference. Perform a seamless, generative out-painting of this scene to create a full, photorealistic 360-degree equirectangular panorama. The expanded image must strictly adhere to a 2:1 aspect ratio.

IMPORTANT: Do not modify, crop, reframe, or change the perspective of the original image. It must appear exactly as provided in the center of the panorama. Only generate new content around it.

Continue the visual style, lighting, and textures found in the reference image. The resulting image must include:

Left/Right Sides: The horizontal continuation of the landscape/environment, ensuring the far-left edge seamlessly stitches with the far-right edge to form a perfect loop.

Top (Zenith): A natural, distorted continuation of the sky/ceiling (matching the projection style where the very top stretches across the whole width).

Bottom (Nadir): A logical completion of the ground/floor beneath the viewer's viewpoint, ensuring the camera viewpoint feels correctly placed.${dirText}`;

  return extractImage(await ai.models.generateContent({
    model: getModel(model),
    contents: [{ role: "user", parts: [
      { inlineData: { mimeType, data: base64 } },
      { text: promptText },
    ]}],
    config: buildImageConfig(imageSize),
  }));
}

export async function overheadToPanorama(base64, mimeType, mode, additionalDetails, onProgress, imageSize, model) {
  if (!ai) throw new Error("Set your API key first.");
  const systemInstruction = mode === "satellite" ? SATELLITE_SYSTEM_PROMPT : BLUEPRINT_SYSTEM_PROMPT;
  const userText = mode === "satellite"
    ? "Analyze this satellite/aerial image and generate the narrative prompt as instructed."
    : "Analyze this floor plan/blueprint and generate the narrative prompt as instructed.";
  const detailsSuffix = additionalDetails ? `\n\nAdditional context from the user: ${additionalDetails}` : "";

  const analysisResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [
      { inlineData: { mimeType, data: base64 } },
      { text: userText + detailsSuffix },
    ]}],
    config: { systemInstruction },
  });

  const narrative = analysisResponse.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim();
  if (!narrative) throw new Error("VLM analysis produced no output.");

  if (onProgress) onProgress("Generating ground-level panorama...");
  return { ...extractImage(await ai.models.generateContent({
    model: getModel(model), contents: narrative, config: buildImageConfig(imageSize),
  })), narrative };
}

export async function improvePrompt(description) {
  if (!ai) throw new Error("Set your API key first.");
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are an expert at writing prompts for AI image generation of 360-degree equirectangular panoramas.

Take this scene description and enhance it with vivid sensory details, specific materials, textures, lighting nuances, and atmospheric elements. Keep it as a single cohesive scene description (not a prompt with instructions). Stay faithful to the original intent — don't change the setting or add elements that contradict it. Aim for 2-3 sentences.

Original: "${description}"

Return ONLY the improved description, no quotes, no preamble.`,
  });
  const text = response.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim();
  if (!text) throw new Error("No response from Gemini.");
  return text;
}

export async function annotateImage(base64, mimeType) {
  if (!ai) throw new Error("Set your API key first.");
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [
      { text: `Analyze this equirectangular panorama image. Identify 5-8 notable visual elements or points of interest.

For each element, return a JSON array of objects with:
- "name": short title (2-4 words)
- "description": one sentence description
- "x": horizontal position as percentage (0 = left edge, 100 = right edge)
- "y": vertical position as percentage (0 = top edge, 100 = bottom edge)

Return ONLY the JSON array, no markdown fences, no other text.` },
      { inlineData: { mimeType, data: base64 } },
    ]}],
  });
  const text = response.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim();
  if (!text) throw new Error("No annotation response from Gemini.");
  const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const annotations = JSON.parse(jsonStr);
  return annotations.map((a) => ({
    name: a.name, description: a.description,
    yaw: (a.x / 100) * 360 - 180, pitch: ((100 - a.y) / 100) * 180 - 90,
  }));
}

const SATELLITE_SYSTEM_PROMPT = `Objective: Translate the provided aerial/satellite map imagery into a photorealistic, eye-level (approximately 5-6 feet high), 360-degree equirectangular photosphere description. The virtual camera is positioned exactly at the center of the map image.

Task 1: Spatial Geometry Analysis
Analyze the entire image relative to the center point. Perform a semantic segmentation to classify all visible surfaces/features as:

Ground Plane (Nadir/Foreground): Surfaces directly surrounding the central coordinate. Identify specific ground textures (concrete pavers, grass, asphalt) and patterns (radiating lines, concentric circles). These features must appear surrounding the user's feet (the bottom-center of the resulting image).

Raised Structures (Buildings/Pavilions): Geometrically defined shapes with clear edges that cast distinct shadows. Use the satellite roof color as the primary material of these vertical structures.

Low-Elevation Objects: Small, numerous objects (e.g., parked cars in a lot, picnic tables, trees). Trees with bare branches indicate a dormant/winter season.

Text: Identify any prominent labels or numbers placed over structures; these are rooftop IDs and must be rendered onto the top surface of the resulting structure in the output scene.

Task 2: Generate the Narrative Prompt
Based on Task 1, construct a single, comprehensive, and high-fidelity descriptive prompt following this precise structure:

Part 1: Begin with: "A high-definition, 360-degree seamless equirectangular photograph (2:1 aspect ratio), capturing an immersive, photorealistic ground-level perspective. The viewpoint is eye-level (5-6 feet high), positioned at the exact center of the source map."

Part 2: Detail the specific texture and patterns of the ground plane identified directly at the map center, which must surround the user's feet.

Part 3: Generate the 360° environment based solely on the mapped features and their distance/angle relative to the center. Detail buildings, smaller structures, objects, and trees in their accurate mapped positions.

Part 4: Describe the entire upper view: bright, clear blue sky with wispy clouds filling the zenith sphere, and consistent direct daylight casting clean shadows matching the shadow angle implied in the map.

Output Constraint: Provide only the generated descriptive narrative prompt. Do not add any conversational filler, explanations, or JSON headers.`;

const BLUEPRINT_SYSTEM_PROMPT = `Objective: Translate the provided architectural floor plan or blueprint into a photorealistic, eye-level (approximately 5-6 feet high), 360-degree equirectangular photosphere description. The virtual camera is positioned exactly at the center of the floor plan. Imagine the building has been fully constructed and you are standing inside it.

Task 1: Spatial Layout Analysis
Analyze the entire floor plan relative to the center point. Classify all visible elements: walls & partitions, rooms & spaces, doors & openings, windows, fixtures & built-ins, and furniture.

Task 2: Generate the Narrative Prompt
Based on Task 1, construct a single, comprehensive descriptive prompt:

Part 1: Begin with: "A high-definition, 360-degree seamless equirectangular photograph (2:1 aspect ratio), capturing an immersive, photorealistic interior ground-level perspective. The viewpoint is eye-level (5-6 feet high), positioned at the exact center of the floor plan. The space is fully constructed with realistic materials, finishes, and furnishings."

Part 2: Describe the floor material/texture directly beneath the viewer's feet and the room the viewer is standing in.

Part 3: Describe what the viewer sees in each direction around the full 360 degrees — walls, doorways, windows, built-in features, furniture, and light fixtures.

Part 4: Describe ceiling height, texture, and all light sources. Include natural light from windows and artificial lighting.

Output Constraint: Provide only the generated descriptive narrative prompt. Do not add any conversational filler, explanations, or JSON headers.`;
