
export const API_BASE_URL =
  "https://rudra-bhakti-api.yadavsubba2003.workers.dev";

const MAX_MODEL_IMAGE_SIZE = 510;

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(
      data.error || `Request failed (${response.status})`
    );
  }

  return data;
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      reject(new Error("Invalid image data."));
      return;
    }

    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () => {
      reject(new Error("Could not load image data."));
    };

    image.src = dataUrl;
  });
}

function drawImageCover(context, image, x, y, width, height) {
  const scale = Math.max(
    width / image.naturalWidth,
    height / image.naturalHeight
  );

  const sourceWidth = width / scale;
  const sourceHeight = height / scale;

  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height
  );
}

/**
 * Combines all active style references into one 510x510 image.
 * This leaves separate model-input slots for the master background
 * and previous generated scene.
 */
export async function createStyleBoard(references = []) {
  const activeReferences = references.filter(Boolean);

  if (activeReferences.length === 0) {
    return null;
  }

  const images = await Promise.all(
    activeReferences.map(loadImage)
  );

  const size = MAX_MODEL_IMAGE_SIZE;
  const canvas = document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare the style reference board.");
  }

  context.fillStyle = "#171725";
  context.fillRect(0, 0, size, size);

  if (images.length === 1) {
    drawImageCover(context, images[0], 0, 0, size, size);
  } else {
    const tileSize = size / 2;

    images.slice(0, 4).forEach((image, index) => {
      const x = (index % 2) * tileSize;
      const y = Math.floor(index / 2) * tileSize;

      drawImageCover(
        context,
        image,
        x,
        y,
        tileSize,
        tileSize
      );
    });
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

/**
 * Resizes a model reference while preserving its aspect ratio.
 * Both dimensions remain below the FLUX 512px input limit.
 */
export async function prepareModelReference(dataUrl) {
  if (!dataUrl) return null;

  const image = await loadImage(dataUrl);

  const scale = Math.min(
    1,
    MAX_MODEL_IMAGE_SIZE / image.naturalWidth,
    MAX_MODEL_IMAGE_SIZE / image.naturalHeight
  );

  const width = Math.max(
    1,
    Math.floor(image.naturalWidth * scale)
  );

  const height = Math.max(
    1,
    Math.floor(image.naturalHeight * scale)
  );

  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not resize a model reference image.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.92);
}

/**
 * Places a transparent generated foreground over the exact
 * master background image supplied for this Reel.
 */
export async function compositeSceneWithBackground(
  cutoutDataUrl,
  masterBackgroundDataUrl
) {
  const [foreground, background] = await Promise.all([
    loadImage(cutoutDataUrl),
    loadImage(masterBackgroundDataUrl),
  ]);

  const width = background.naturalWidth;
  const height = background.naturalHeight;

  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not composite the scene layers.");
  }

  context.drawImage(background, 0, 0, width, height);
  context.drawImage(foreground, 0, 0, width, height);

  return canvas.toDataURL("image/png");
}

export async function checkBackend() {
  const data = await request("/health");

  if (data.status !== "healthy") {
    throw new Error("Backend is not healthy.");
  }

  if (data.aiBinding !== true) {
    throw new Error("Workers AI binding is not connected.");
  }

  return data;
}

export async function planStory(story, sceneCount = 5) {
  return request("/story/plan", {
    method: "POST",
    body: JSON.stringify({
      story,
      sceneCount,
    }),
  });
}

/**
 * Generates a separate reusable studio-gradient background.
 */
export async function generateMasterBackground({
  styleBoard,
} = {}) {
  const preparedStyleBoard =
    await prepareModelReference(styleBoard);

  const data = await request("/background", {
    method: "POST",
    body: JSON.stringify({
      styleBoard: preparedStyleBoard,
    }),
  });

  const masterBackgroundDataUrl =
    data.masterBackgroundDataUrl || data.imageDataUrl;

  if (!masterBackgroundDataUrl) {
    throw new Error(
      "The AI backend did not return a master background."
    );
  }

  return {
    ...data,
    masterBackgroundDataUrl,
  };
}

/**
 * Generates one scene using separate references for:
 * 1. Combined style references
 * 2. Master studio background
 * 3. Previous generated scene
 *
 * New Worker responses can return a transparent cutout.
 * The cutout is composited over the original master background.
 */
export async function generateSceneImage({
  scenePrompt,
  characterBible,
  references = [],
  styleBoard,
  masterBackground,
  previousScene,
  seed,
}) {
  const activeStyleBoard =
    styleBoard || await createStyleBoard(references);

  const [
    preparedStyleBoard,
    preparedBackground,
    preparedPreviousScene,
  ] = await Promise.all([
    prepareModelReference(activeStyleBoard),
    prepareModelReference(masterBackground),
    prepareModelReference(previousScene),
  ]);

  const modelReferences = [
    preparedStyleBoard,
    preparedBackground,
    preparedPreviousScene,
  ].filter(Boolean);

  const data = await request("/generate", {
    method: "POST",
    body: JSON.stringify({
      scenePrompt,
      characterBible,

      // Named references keep their separate purposes.
      styleBoard: preparedStyleBoard,
      masterBackground: preparedBackground,
      previousScene: preparedPreviousScene,

      // Ordered image inputs for the FLUX model.
      references: modelReferences,

      ...(seed !== undefined ? { seed } : {}),
    }),
  });

  if (
    data.cutoutDataUrl &&
    masterBackground
  ) {
    const imageDataUrl = await compositeSceneWithBackground(
      data.cutoutDataUrl,
      masterBackground
    );

    return {
      ...data,
      imageDataUrl,
    };
  }

  // Backward compatibility while the Worker is being updated.
  return data;
}

export async function fileToDataUrl(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Please select a valid image.");
  }

  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  ) {
    throw new Error("Only PNG, JPEG and WebP images are supported.");
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error(
      "Each reference image must be under 2 MB."
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);

    reader.onerror = () => {
      reject(new Error("Could not read image."));
    };

    reader.readAsDataURL(file);
  });
}
