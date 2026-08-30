import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mentor_sync_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Every backend error response is {"error": "..."} (see backend/handlers/errors.go), so pull
// that out consistently instead of each page re-deriving a message from a caught error.
export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(err)) {
    const backendMessage = err.response?.data?.error;
    if (typeof backendMessage === "string" && backendMessage) return backendMessage;
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export default api;
