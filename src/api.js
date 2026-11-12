
const API_BASE_URL =
  "https://rudra-bhakti-api.yadavsubba2003.workers.dev";

export async function checkBackend() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || data.status !== "healthy") {
      throw new Error("Backend health check failed");
    }

    return data;
  } catch (error) {
    console.error("Backend connection failed:", error);
    throw error;
  }
}

export { API_BASE_URL };
