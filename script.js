const BACKEND_URL = "https://monaco-reg-backend.onrender.com";

const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const errorDiv = document.getElementById("error");

const progressCard = document.getElementById("progressCard");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

const resultsCard = document.getElementById("resultsCard");
const downloadPoasBtn = document.getElementById("downloadPoasBtn");
const downloadFilingBtn = document.getElementById("downloadFilingBtn");

let currentJobId = null;
let pollInterval = null;

uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) {
    showError("Please select a spreadsheet file.");
    return;
  }

  resetUI();
  progressCard.classList.remove("hidden");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${BACKEND_URL}/api/jobs`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error("Failed to create job.");
    }

    const data = await response.json();
    currentJobId = data.jobId;

    startPolling();

  } catch (err) {
    showError(err.message);
  }
});

function startPolling() {
  pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/jobs/${currentJobId}`);
      const data = await response.json();

      updateProgress(data);

      if (data.status === "completed") {
        clearInterval(pollInterval);
        showResults();
      }

      if (data.status === "failed") {
        clearInterval(pollInterval);
        showError("Processing failed.");
      }

    } catch (err) {
      clearInterval(pollInterval);
      showError("Error checking job status.");
    }
  }, 2000);
}

function updateProgress(data) {
  const percent = data.progress || 0;
  progressFill.style.width = percent + "%";
  progressText.textContent = `${percent}% completed`;
}

function showResults() {
  resultsCard.classList.remove("hidden");
}

downloadPoasBtn.addEventListener("click", () => {
  window.location.href = `${BACKEND_URL}/api/jobs/${currentJobId}/download/poas`;
});

downloadFilingBtn.addEventListener("click", () => {
  window.location.href = `${BACKEND_URL}/api/jobs/${currentJobId}/download/filing`;
});

function showError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.remove("hidden");
}

function resetUI() {
  errorDiv.classList.add("hidden");
  resultsCard.classList.add("hidden");
  progressFill.style.width = "0%";
  progressText.textContent = "Starting...";
}

const reviewCard = document.getElementById("reviewCard");
const resultsTableBody = document.querySelector("#resultsTable tbody");

let latestJobData = null;

function updateProgress(data) {
  latestJobData = data;
  const percent = data.progress || 0;
  progressFill.style.width = percent + "%";
  progressText.textContent = `${percent}% completed`;
}

function showResults() {
  resultsCard.classList.remove("hidden");
  renderResultsTable(latestJobData);
}

function renderResultsTable(data) {
  if (!data?.results) return;

  resultsTableBody.innerHTML = "";
  for (const r of data.results) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.epNumber)}</td>
      <td>${escapeHtml(r.applicantName || "")}</td>
      <td>${escapeHtml(r.applicantAddress || "")}</td>
      <td>${escapeHtml(r.status)}${r.error ? " (" + escapeHtml(r.error) + ")" : ""}</td>
    `;
    resultsTableBody.appendChild(tr);
  }

  reviewCard.classList.remove("hidden");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
