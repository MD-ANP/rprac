// public/js/api.js
const API_BASE_URL = "/api";

function getAuthHeaders() {
  const headers = {
    "Accept": "application/json"
  };
  
  // Retrieve the User ID from the browser session
  const userId = sessionStorage.getItem("prison.userId");
  if (userId) {
    headers["X-User-Id"] = userId;
  }
  
  return headers;
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "same-origin",
    headers: getAuthHeaders() // <--- Now includes X-User-Id
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = data.error || data.message || "Eroare la comunicarea cu serverul.";
    throw new Error(msg);
  }

  return data;
}

async function apiPost(path, body) {
  const headers = getAuthHeaders();
  headers["Content-Type"] = "application/json"; // Add content type for POST

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: headers,
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
  post: apiPost,
  // Add to window.prisonApi
  del: async (path) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Delete failed");
    return data;
}
};