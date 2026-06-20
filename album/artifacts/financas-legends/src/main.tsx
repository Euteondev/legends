import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/firebase";

// Inject x-user-id header on every fetch so the API can identify the caller
const _originalFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const saved = localStorage.getItem("auth_user");
  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (user?.id) {
        const headers = new Headers((init as RequestInit).headers);
        headers.set("x-user-id", String(user.id));
        init = { ...(init as RequestInit), headers };
      }
    } catch {
      // ignore parse errors
    }
  }
  return _originalFetch(input, init as RequestInit);
};

createRoot(document.getElementById("root")!).render(<App />);
