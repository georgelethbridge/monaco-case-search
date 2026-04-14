const BACKEND_URL = "https://api-ipb9.onrender.com/monaco";

const fileInput = document.getElementById("fileInput");
const patentList = document.getElementById("patentList");
const processPoasBtn = document.getElementById("processPoasBtn");
const generateFormsBtn = document.getElementById("generateFormsBtn");
const errorDiv = document.getElementById("error");

const progressCard = document.getElementById("progressCard");
const progressTitle = document.getElementById("progressTitle");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

const resultsCard = document.getElementById("resultsCard");
const resultsMessage = document.getElementById("resultsMessage");
const downloadPoasBtn = document.getElementById("downloadPoasBtn");
const downloadFilingBtn = document.getElementById("downloadFilingBtn");

const reviewCard = document.getElementById("reviewCard");
const resultsTableBody = document.querySelector("#resultsTable tbody");

let currentJobId = null;
let currentJobType = null;
let latestJobData = null;
let pollInterval = null;

processPoasBtn.addEventListener("click", () => startJob("poas"));
generateFormsBtn.addEventListener("click", () => startJob("filing"));

downloadPoasBtn.addEventListener("click", () => {
  if (!currentJobId) return;
  window.location.href = `${BACKEND_URL}/api/jobs/${currentJobId}/download/poas`;
});

downloadFilingBtn.addEventListener("click", () => {
  if (!currentJobId) return;
  window.location.href = `${BACKEND_URL}/api/jobs/${currentJobId}/download/filing`;
});

async function startJob(jobType) {
  const file = fileInput.files[0];
  const rawList = patentList.value.trim();

  if (!file && !rawList) {
    showError("Please upload a spreadsheet or paste patent numbers.");
    return;
  }

  if (file && rawList) {
    showError("Please use either a spreadsheet upload or pasted patent numbers, not both.");
    return;
  }

  resetUI();
  currentJobType = jobType;
  progressCard.classList.remove("hidden");
  progressTitle.textContent = jobType === "poas" ? "Processing PoAs" : "Generating Forms";

  try {
    let response;

    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jobType", jobType);

      response = await fetch(`${BACKEND_URL}/api/jobs`, {
        method: "POST",
        body: formData,
      });
    } else {
      response = await fetch(`${BACKEND_URL}/api/jobs/from-list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patentNumbers: rawList,
          jobType,
        }),
      });
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Failed to create job.");
    }

    currentJobId = data.jobId;
    startPolling();
  } catch (err) {
    showError(err.message || "Failed to create job.");
  }
}

function startPolling() {
  clearExistingPoll();

  pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/jobs/${currentJobId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error checking job status.");
      }

      latestJobData = data;
      updateProgress(data);

      if (data.status === "completed") {
        clearExistingPoll();
        showResults(data);
      }

      if (data.status === "failed") {
        clearExistingPoll();
        showError(data.error || "Processing failed.");
      }
    } catch (err) {
      clearExistingPoll();
      showError(err.message || "Error checking job status.");
    }
  }, 2000);
}

function updateProgress(data) {
  const percent = Number(data.progress || 0);
  progressFill.style.width = `${percent}%`;

  if (data.status === "queued") {
    progressText.textContent = "Queued...";
    return;
  }

  if (data.status === "processing") {
    const count = Number(data.count || 0);
    const processed = Number(data.processed || 0);
    progressText.textContent = count > 0
      ? `${percent}% completed (${processed}/${count})`
      : `${percent}% completed`;
    return;
  }

  if (data.status === "completed") {
    progressText.textContent = "Completed";
  }
}

function showResults(data) {
  resultsCard.classList.remove("hidden");

  const count = Number(data.count || 0);
  const label = count === 1 ? "patent" : "patents";

  downloadPoasBtn.classList.add("hidden");
  downloadFilingBtn.classList.add("hidden");

  if (currentJobType === "poas") {
    resultsMessage.textContent = `PoAs are ready for ${count} ${label}.`;
    downloadPoasBtn.classList.remove("hidden");
    renderResultsTable(data);
  } else {
    resultsMessage.textContent = `Forms are ready for ${count} ${label}.`;
    reviewCard.classList.add("hidden");
    resultsTableBody.innerHTML = "";
    downloadFilingBtn.classList.remove("hidden");
  }
}

function renderResultsTable(data) {
  if (!data?.results?.length) {
    reviewCard.classList.add("hidden");
    resultsTableBody.innerHTML = "";
    return;
  }

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

function showError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.remove("hidden");
}

function resetUI() {
  clearExistingPoll();
  currentJobId = null;
  latestJobData = null;

  errorDiv.classList.add("hidden");
  errorDiv.textContent = "";

  progressFill.style.width = "0%";
  progressText.textContent = "Starting...";
  progressCard.classList.add("hidden");

  resultsCard.classList.add("hidden");
  resultsMessage.textContent = "";
  downloadPoasBtn.classList.add("hidden");
  downloadFilingBtn.classList.add("hidden");

  reviewCard.classList.add("hidden");
  resultsTableBody.innerHTML = "";
}

function clearExistingPoll() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
