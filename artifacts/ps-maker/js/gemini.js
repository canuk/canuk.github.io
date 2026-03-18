import { GoogleGenAI } from "https://esm.sh/@google/genai";

let ai = null;

/**
 * Initialize or re-initialize the Gemini client with a new API key.
 */
export function initGemini(apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

/**
 * Build the equirectangular prompt from simple fields.
 */
export function buildPrompt({ description, perspective, weather }) {
  const persp = perspective?.trim() || "from eye level";
  const wthr = weather?.trim() || "Clear sky";
  return [
    `A high-definition, 360-degree equirectangular photograph of ${description.trim()}.`,
    `The perspective is ${persp}.`,
    `A seamless, spherical projection in a 2:1 aspect ratio.`,
    `${wthr}, ultra-realistic texture.`,
  ].join("\n");
}

/**
 * Generate a panorama image using Gemini image generation.
 * Returns { base64, mimeType } on success.
 */
export async function generatePanorama(prompt) {
  if (!ai) throw new Error("Gemini not initialized — set your API key first.");

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  // Extract image part from response
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error("No response from Gemini.");

  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart) {
    const textPart = parts.find((p) => p.text);
    throw new Error(
      textPart
        ? `Gemini returned text only: "${textPart.text.slice(0, 200)}"`
        : "No image in response."
    );
  }

  return {
    base64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}

/**
 * Edit an existing panorama image using a text instruction.
 * Sends the current image + edit prompt to Gemini and returns a new image.
 * Returns { base64, mimeType } on success.
 */
export async function editPanorama(base64, mimeType, instruction) {
  if (!ai) throw new Error("Gemini not initialized — set your API key first.");

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64 } },
          {
            text: `Edit this 360-degree equirectangular panorama image. ${instruction.trim()}. Keep it as a seamless equirectangular projection in 2:1 aspect ratio.`,
          },
        ],
      },
    ],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error("No response from Gemini.");

  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart) {
    const textPart = parts.find((p) => p.text);
    throw new Error(
      textPart
        ? `Gemini returned text only: "${textPart.text.slice(0, 200)}"`
        : "No image in response."
    );
  }

  return {
    base64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}

/**
 * Improve a scene description prompt by adding rich details.
 * Returns the improved prompt string.
 */
export async function improvePrompt(description) {
  if (!ai) throw new Error("Gemini not initialized — set your API key first.");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are an expert at writing prompts for AI image generation of 360-degree equirectangular panoramas.

Take this scene description and enhance it with vivid sensory details, specific materials, textures, lighting nuances, and atmospheric elements. Keep it as a single cohesive scene description (not a prompt with instructions). Stay faithful to the original intent — don't change the setting or add elements that contradict it. Aim for 2-3 sentences.

Original: "${description}"

Return ONLY the improved description, no quotes, no preamble.`,
  });

  const text = response.candidates?.[0]?.content?.parts
    ?.find((p) => p.text)
    ?.text?.trim();

  if (!text) throw new Error("No response from Gemini.");
  return text;
}

/**
 * Annotate an equirectangular panorama image with points of interest.
 * Returns an array of { name, description, yaw, pitch }.
 */
export async function annotateImage(base64, mimeType) {
  if (!ai) throw new Error("Gemini not initialized.");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyze this equirectangular panorama image. Identify 5-8 notable visual elements or points of interest.

For each element, return a JSON array of objects with:
- "name": short title (2-4 words)
- "description": one sentence description
- "x": horizontal position as percentage (0 = left edge, 100 = right edge)
- "y": vertical position as percentage (0 = top edge, 100 = bottom edge)

Return ONLY the JSON array, no markdown fences, no other text.`,
          },
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
        ],
      },
    ],
  });

  const text = response.candidates?.[0]?.content?.parts
    ?.find((p) => p.text)
    ?.text?.trim();

  if (!text) throw new Error("No annotation response from Gemini.");

  // Strip markdown code fences if present
  const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const annotations = JSON.parse(jsonStr);

  return annotations.map((a) => ({
    name: a.name,
    description: a.description,
    yaw: (a.x / 100) * 360 - 180,
    pitch: ((100 - a.y) / 100) * 180 - 90,
  }));
}
