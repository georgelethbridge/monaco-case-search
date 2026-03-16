const BACKEND_URL = "https://monaco-reg-backend.onrender.com";

const fileInput = document.getElementById("fileInput");
const patentNumbersInput = document.getElementById("patentNumbersInput");
const generateBtn = document.getElementById("generateBtn");
const errorDiv = document.getElementById("error");

const progressCard = document.getElementById("progressCard");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

const resultsCard = document.getElementById("resultsCard");
const downloadAllBtn = document.getElementById("downloadAllBtn");

const reviewCard = document.getElementById("reviewCard");
const resultsTableBody = document.querySelector("#resultsTable tbody");

let currentJobId = null;
let pollInterval = null;
let latestJobData = null;
let autoDownloadStarted = false;

generateBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  const patentNumbersText = patentNumbersInput.value.trim();

  if (!file && !patentNumbersText) {
    showError("Please upload a file or enter at least one patent number.");
    return;
  }

  resetUI();
  progressCard.classList.remove("hidden");
  generateBtn.disabled = true;

  try {
    let response;

    if (file) {
      const formData = new FormData();
      formData.append("file", file);

      response = await fetch(`${BACKEND_URL}/api/jobs`, {
        method: "POST",
        body: formData
      });
    } else {
      response = await fetch(`${BACKEND_URL}/api/jobs/from-list`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ patentNumbers: patentNumbersText })
      });
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Failed to create job.");
    }

    currentJobId = data.jobId;
    startPolling();
  } catch (err) {
    generateBtn.disabled = false;
    showError(err.message);
  }
});

function startPolling() {
  clearInterval(pollInterval);

  pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/jobs/${currentJobId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch job status.");
      }

      updateProgress(data);

      if (data.status === "completed") {
        clearInterval(pollInterval);
        generateBtn.disabled = false;
        showResults();
        if (!autoDownloadStarted) {
          autoDownloadStarted = true;
          triggerDownloadAll();
        }
      }

      if (data.status === "failed") {
        clearInterval(pollInterval);
        generateBtn.disabled = false;
        showError(data.error || "Processing failed.");
      }
    } catch (err) {
      clearInterval(pollInterval);
      generateBtn.disabled = false;
      showError(err.message || "Error checking job status.");
    }
  }, 2000);
}

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

downloadAllBtn.addEventListener("click", triggerDownloadAll);

function triggerDownloadAll() {
  if (!currentJobId) return;
  window.location.href = `${BACKEND_URL}/api/jobs/${currentJobId}/download/all`;
}

function showError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.remove("hidden");
}

function resetUI() {
  errorDiv.classList.add("hidden");
  errorDiv.textContent = "";
  resultsCard.classList.add("hidden");
  reviewCard.classList.add("hidden");
  resultsTableBody.innerHTML = "";
  progressFill.style.width = "0%";
  progressText.textContent = "Starting...";
  latestJobData = null;
  autoDownloadStarted = false;
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
