
export const API_BASE_URL =
  "https://rudra-bhakti-api.yadavsubba2003.workers.dev";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
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
      sceneCount
    })
  });
}

export async function generateSceneImage({
  scenePrompt,
  characterBible,
  references = [],
  seed
}) {
  return request("/generate", {
    method: "POST",
    body: JSON.stringify({
      scenePrompt,
      characterBible,
      references,
      ...(seed !== undefined ? { seed } : {})
    })
  });
}

export async function fileToDataUrl(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Please select a valid image.");
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Only PNG, JPEG and WebP images are supported.");
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Each reference image must be under 2 MB.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read image."));

    reader.readAsDataURL(file);
  });
}
