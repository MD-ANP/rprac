// public/js/api.js
const API_BASE_URL = "/api";

async function apiGet(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json"
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = data.error || data.message || "Eroare la comunicarea cu serverul.";
    throw new Error(msg);
  }

  return data;
}

async function apiPost(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body || {})
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = data.error || data.message || "Eroare la comunicarea cu serverul.";
    const err = new Error(msg);
    err.details = data;
    throw err;
  }

  return data;
}

// Expose globally (no bundler)
window.prisonApi = {
  get: apiGet,
  post: apiPost
};
