const API_KEY = "7a5155cf3ab2412ca39c3a3a01ce68ea";
const WORKER_URL = "https://transcript-history.mohamedmostafa58113.workers.dev";
let selectedFile = null;
let transcriptionResult = null;

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const fileInfo = document.getElementById("fileInfo");
const uploadStatus = document.getElementById("uploadStatus");

// File handling event listeners
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.style.borderColor = "var(--primary)";
});

dropZone.addEventListener("dragleave", () => {
  dropZone.style.borderColor = "var(--border)";
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.style.borderColor = "var(--border)";
  handleFileUpload(e.dataTransfer.files[0]);
});

fileInput.addEventListener("change", (e) => {
  handleFileUpload(e.target.files[0]);
});

function handleFileUpload(file) {
  if (!file) return;

  selectedFile = file;

  fileInfo.style.display = "block";
  fileInfo.innerHTML = `
        <strong>File:</strong> ${escapeHtml(file.name)}<br>
        <strong>Size:</strong> ${(file.size / (1024 * 1024)).toFixed(2)} MB<br>
        <strong>Type:</strong> ${escapeHtml(file.type)}
    `;

  uploadStatus.textContent =
    "File selected. Click Process File to start transcription.";
  document.getElementById("processButton").disabled = false;
  document.getElementById("transcriptSection").style.display = "none";
}

function showSection(sectionName) {
  // Remove active class from all items
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.remove("active");
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });
  document.querySelectorAll(".sidebar-history-item").forEach((item) => {
    item.classList.remove("active");
  });

  // Add active class to selected section and nav item
  document.getElementById(`${sectionName}Section`).classList.add("active");
  event.currentTarget.classList.add("active");
  console.log(event.currentTarget.classList[0]);
  if (event.currentTarget.classList[0] == "logo") {
    document.getElementById("upload-nav").classList.add("active");
  }
  // Hide history transcript section if exists
  const historyTranscriptSection = document.getElementById(
    "historyTranscriptSection"
  );
  if (historyTranscriptSection) {
    historyTranscriptSection.classList.remove("active");
  }

  // Handle specific section behaviors
  if (sectionName === "upload") {
    document.getElementById("transcriptSection").style.display = "none";
    document.getElementById("fileInfo").style.display = "none";
    document.getElementById("uploadStatus").textContent = "";
    document.getElementById("processButton").disabled = true;
  } else if (sectionName === "dashboard") {
    console.log("Dashboard section clicked");
    loadTranscriptHistory();
  }
}

async function startTranscriptionProcess() {
  if (!selectedFile) return;

  const progressBar = document.getElementById("progressBar");
  const progressFill = document.getElementById("progressFill");
  progressBar.style.display = "block";
  progressFill.style.width = "0%";

  try {
    const uploadResult = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          progressFill.style.width = percentComplete + "%";
          uploadStatus.textContent = `Uploading: ${percentComplete.toFixed(
            1
          )}%`;
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error("Invalid response format"));
          }
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Upload failed")));
      xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

      xhr.open("POST", "https://api.assemblyai.com/v2/upload");
      xhr.setRequestHeader("Authorization", API_KEY);
      xhr.send(selectedFile);
    });

    uploadStatus.textContent = "Starting transcription...";
    progressFill.style.width = "60%";

    const transcriptionResponse = await fetch(
      "https://api.assemblyai.com/v2/transcript",
      {
        method: "POST",
        headers: {
          Authorization: API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio_url: uploadResult.upload_url,
          speaker_labels: true,
        }),
      }
    );

    progressFill.style.width = "70%";
    const transcriptionResult = await transcriptionResponse.json();
    checkTranscriptionStatus(transcriptionResult.id);
  } catch (error) {
    uploadStatus.textContent = "Error: " + error.message;
    progressBar.style.display = "none";
  }
}

async function checkTranscriptionStatus(transcriptId) {
  const progressFill = document.getElementById("progressFill");

  try {
    const response = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      {
        headers: {
          Authorization: API_KEY,
        },
      }
    );

    const result = await response.json();

    if (result.status === "completed") {
      progressFill.style.width = "100%";
      transcriptionResult = result;
      displayTranscription(result);
    } else if (result.status === "error") {
      uploadStatus.textContent = "Error: " + result.error;
      document.getElementById("progressBar").style.display = "none";
    } else {
      const processingProgress = 70 + Math.random() * 25;
      progressFill.style.width = `${processingProgress}%`;
      uploadStatus.textContent = "Processing transcription...";
      setTimeout(() => checkTranscriptionStatus(transcriptId), 3000);
    }
  } catch (error) {
    uploadStatus.textContent = "Error: " + error.message;
    document.getElementById("progressBar").style.display = "none";
  }
}

function displayTranscription(result) {
  document.getElementById("transcriptSection").style.display = "block";
  document.getElementById("progressBar").style.display = "none";
  uploadStatus.textContent = "Transcription completed!";

  const speakers = new Set(result.utterances.map((u) => u.speaker));
  const speakerExamples = document.getElementById("speakerExamples");
  speakerExamples.innerHTML = Array.from(speakers)
    .map(
      (speaker) => `
          <div class="speaker-item">
              <label>${escapeHtml(speaker)}:</label>
              <input type="text" id="${escapeHtml(
                speaker
              )}" placeholder="Enter name">
          </div>
      `
    )
    .join("");

  document.getElementById("transcription").innerHTML = result.utterances
    .map(
      (utterance) => `
          <p><strong>${escapeHtml(utterance.speaker)}:</strong> ${escapeHtml(
        utterance.text
      )}</p>
      `
    )
    .join("");

  // Try to save, but don't let it block the display
  saveTranscriptToDatabase().catch((error) => {
    console.error("Background save failed:", error);
  });
}

async function saveTranscriptToDatabase() {
  if (!transcriptionResult || !selectedFile) return;

  try {
    // Format the data according to the exact server requirements
    const data = {
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type,
      transcriptText: transcriptionResult.utterances
        .map((utterance) => `${utterance.speaker}: ${utterance.text}`)
        .join("\n"),
      created_at: new Date().toISOString(),
      // Add these additional fields that might be required
      status: "completed",
      duration: transcriptionResult.audio_duration || 0,
      language: transcriptionResult.language || "en",
      user_id: "default", // If user management is implemented
    };

    console.log("Sending data to server:", JSON.stringify(data, null, 2));

    const response = await fetch(`${WORKER_URL}/api/save-transcript`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(data),
    });

    // Log raw response for debugging
    const responseText = await response.text();
    console.log("Raw server response:", responseText);

    // Try to parse the response as JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.log("Response is not JSON:", responseText);
    }

    if (!response.ok) {
      throw new Error(
        responseData?.error || `Server error: ${response.status}`
      );
    }

    // Show success notification
    let notification =
      document.querySelector(".copy-notification") ||
      document.createElement("div");
    notification.className = "copy-notification";
    if (!notification.parentElement) {
      document.body.appendChild(notification);
    }
    showNotification(notification, "Transcript saved successfully!");

    // Refresh dashboard if active
    // if (
    //   document.getElementById("dashboardSection").classList.contains("active")
    // ) {
    //   loadTranscriptHistory();
    // }
    loadSidebarHistory();
  } catch (error) {
    console.error("Save error details:", {
      error: error.message,
      requestData: {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        transcriptLength: transcriptionResult.utterances.length,
      },
      transcriptionResult: {
        hasUtterances: Boolean(transcriptionResult.utterances),
        utterancesCount: transcriptionResult.utterances.length,
        duration: transcriptionResult.audio_duration,
      },
    });

    let notification =
      document.querySelector(".copy-notification") ||
      document.createElement("div");
    notification.className = "copy-notification";
    if (!notification.parentElement) {
      document.body.appendChild(notification);
    }
    showNotification(notification, `Failed to save: ${error.message}`);
  }
}
function validateTranscriptionData(data) {
  const requiredFields = [
    "file_name",
    "file_size",
    "file_type",
    "transcript_text",
    "created_at",
  ];

  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
  }

  if (
    typeof data.transcript_text !== "string" ||
    !data.transcript_text.trim()
  ) {
    throw new Error("Invalid transcript_text");
  }

  return true;
}
function logDataStructure(data) {
  console.log("Data structure check:", {
    hasRequiredFields: {
      file_name: Boolean(data.file_name),
      file_size: Boolean(data.file_size),
      file_type: Boolean(data.file_type),
      transcript_text: Boolean(data.transcript_text),
      created_at: Boolean(data.created_at),
    },
    fieldTypes: {
      file_name: typeof data.file_name,
      file_size: typeof data.file_size,
      file_type: typeof data.file_type,
      transcript_text: typeof data.transcript_text,
      created_at: typeof data.created_at,
    },
    sampleValues: {
      file_name: data.file_name,
      file_size: data.file_size,
      file_type: data.file_type,
      transcript_text_preview: data.transcript_text?.substring(0, 50) + "...",
      created_at: data.created_at,
    },
  });
}

async function loadTranscriptHistory() {
  const historyList = document.getElementById("historyList");
  const loadingElement = document.getElementById("historyLoading");
  const errorElement = document.getElementById("historyError");
  const emptyElement = document.getElementById("historyEmpty");

  loadingElement.style.display = "flex";
  historyList.style.display = "none";
  errorElement.style.display = "none";
  emptyElement.style.display = "none";

  try {
    const response = await fetch(`${WORKER_URL}/api/transcript-history`);
    const data = await response.json();

    loadingElement.style.display = "none";

    if (!data.results || data.results.length === 0) {
      emptyElement.style.display = "block";
      return;
    }

    historyList.style.display = "grid";
    historyList.innerHTML = data.results
      .map(
        (item) => `
        <div class="history-item card">
          <div class="history-item-header">
            <h3>${escapeHtml(item.file_name)}</h3>
            <span class="date">${new Date(
              item.created_at
            ).toLocaleString()}</span>
          </div>
          <div class="history-item-details">
            <span>Size: ${(item.file_size / (1024 * 1024)).toFixed(2)} MB</span>
            <span>Type: ${escapeHtml(item.file_type)}</span>
          </div>
          <button class="btn btn-secondary" onclick="viewTranscript(${
            item.id
          })">
            View Transcript
          </button>
        </div>
      `
      )
      .join("");
  } catch (error) {
    console.error("Error loading transcript history:", error);
    loadingElement.style.display = "none";
    errorElement.style.display = "block";
  }
}

async function viewTranscript(id) {
  try {
    const response = await fetch(`${WORKER_URL}/api/transcript/${id}`);
    if (!response.ok) throw new Error("Failed to fetch transcript");

    const transcript = await response.json();

    const modal = document.createElement("div");
    modal.className = "transcript-modal";
    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" onclick="this.closest('.transcript-modal').remove()">×</button>
        <h2>${escapeHtml(transcript.file_name)}</h2>
        <div class="transcript-content">
          ${transcript.transcript_text
            .split("\n")
            .map((line) => `<p>${escapeHtml(line)}</p>`)
            .join("")}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add("active"), 10);
  } catch (error) {
    console.error("Error viewing transcript:", error);
    alert("Failed to load transcript");
  }
}

function replaceSpeakerLabels() {
  if (!transcriptionResult) return;

  const transcription = document.getElementById("transcription");
  const updatedTranscript = transcriptionResult.utterances
    .map((utterance) => {
      const nameInput = document.getElementById(utterance.speaker);
      const speakerName =
        nameInput && nameInput.value ? nameInput.value : utterance.speaker;
      return `<p><strong>${escapeHtml(speakerName)}:</strong> ${escapeHtml(
        utterance.text
      )}</p>`;
    })
    .join("");

  transcription.innerHTML = updatedTranscript;
}

function copyToClipboard(format) {
  const transcription = document.getElementById("transcription");
  let notification = document.querySelector(".copy-notification");
  if (!notification) {
    notification = document.createElement("div");
    notification.className = "copy-notification";
    document.body.appendChild(notification);
  }

  if (format === "markdown") {
    const content = Array.from(transcription.children)
      .map((p) => {
        const strongText = p.querySelector("strong");
        const text = p.textContent.replace(strongText.textContent, "").trim();
        return `**${strongText.textContent}** ${text}`;
      })
      .join("\n\n");

    navigator.clipboard
      .writeText(content)
      .then(() => showNotification(notification, "Copied to clipboard"))
      .catch((err) => showNotification(notification, "Failed to copy: " + err));
  } else {
    navigator.clipboard
      .writeText(transcription.innerHTML)
      .then(() => showNotification(notification, "Copied to clipboard"))
      .catch((err) => showNotification(notification, "Failed to copy: " + err));
  }
}

function showNotification(notification, message) {
  notification.textContent = message;
  notification.classList.add("show");
  setTimeout(() => notification.classList.remove("show"), 2000);
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Sidebar functionality
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.getElementById("sidebar");

function toggleSidebar() {
  sidebar.classList.toggle("collapsed");
  localStorage.setItem(
    "sidebarCollapsed",
    sidebar.classList.contains("collapsed")
  );
}

sidebarToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleSidebar();
});

document.addEventListener("DOMContentLoaded", () => {
  const sidebarCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
  if (sidebarCollapsed) {
    sidebar.classList.add("collapsed");
  }
  loadSidebarHistory();
});
function validateTranscriptionData(data) {
  const required = ["file_name", "file_size", "file_type", "transcript_text"];
  const missing = required.filter((field) => !(field in data));

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  if (
    typeof data.transcript_text !== "string" ||
    data.transcript_text.length === 0
  ) {
    throw new Error("Invalid transcript_text");
  }

  return true;
}

// updates
function loadSidebarHistory() {
  const historyList = document.getElementById("sidebarHistoryList");
  console.log("Loading sidebar history...");
  fetch(`${WORKER_URL}/api/transcript-history`)
    .then((response) => response.json())
    .then((data) => {
      if (!data.results || data.results.length === 0) {
        historyList.innerHTML = `
          <div class="sidebar-history-item">
            No transcripts yet
          </div>
        `;
        return;
      }

      historyList.innerHTML = data.results
        .map(
          (item) => `
          <div class="sidebar-history-item" 
               onclick="loadTranscriptContent('${item.id}', this)">
            ${escapeHtml(item.file_name)}
          </div>
        `
        )
        .join("");
    })
    .catch((error) => {
      console.error("Error loading sidebar history:", error);
      historyList.innerHTML = `
        <div class="sidebar-history-item">
          Failed to load history
        </div>
      `;
    });
}
function loadTranscriptContent(id, element) {
  // Remove active class from all items
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.remove("active");
  });
  document.querySelectorAll(".sidebar-history-item").forEach((item) => {
    item.classList.remove("active");
  });

  // Add active class to clicked history item
  element.classList.add("active");

  // Create or get a dedicated section for history transcripts
  let historyTranscriptSection = document.getElementById(
    "historyTranscriptSection"
  );
  if (!historyTranscriptSection) {
    historyTranscriptSection = document.createElement("div");
    historyTranscriptSection.id = "historyTranscriptSection";
    historyTranscriptSection.className = "section";
    historyTranscriptSection.innerHTML = `
      <div class="container">
        <div class="speaker-mapping card">
          <h2>Speaker Names</h2>
          <div id="historySpeakerExamples"></div>
          <div class="actions">
            <button class="btn" onclick="updateHistorySpeakerLabels()">Update Speakers</button>
          </div>
        </div>
        <div class="transcript card">
          <div class="process-header">
            <h2>Transcript</h2>
            <button class="btn" onclick="copyHistoryToClipboard()">
              Copy as Markdown
            </button>
          </div>
          <div id="historyTranscription"></div>
        </div>
      </div>
    `;
    document.querySelector(".main").appendChild(historyTranscriptSection);
  }

  // Make history transcript section active and hide others
  historyTranscriptSection.classList.add("active");

  // Show loading state
  document.getElementById("historyTranscription").innerHTML = `
    <div class="processing-status">
      <div class="loading-spinner"></div>
      <span>Loading transcript...</span>
    </div>
  `;

  fetch(`${WORKER_URL}/api/transcript/${id}`)
    .then((response) => response.json())
    .then((transcript) => {
      // Store the transcript data for later use
      historyTranscriptSection.dataset.transcriptData =
        JSON.stringify(transcript);

      // Extract unique speakers from the transcript
      const speakers = new Set();
      const lines = transcript.transcript_text.split("\n");
      lines.forEach((line) => {
        const speaker = line.split(":")[0].trim();
        if (speaker) speakers.add(speaker);
      });

      // Generate speaker mapping inputs
      const speakerExamples = document.getElementById("historySpeakerExamples");
      speakerExamples.innerHTML = Array.from(speakers)
        .map(
          (speaker) => `
          <div class="speaker-item">
            <label>${escapeHtml(speaker)}:</label>
            <input type="text" id="history-${escapeHtml(speaker)}" 
                   placeholder="Enter name">
          </div>
        `
        )
        .join("");

      // Display transcript
      document.getElementById("historyTranscription").innerHTML = lines
        .map((line) => {
          const [speaker, ...textParts] = line.split(":");
          const text = textParts.join(":").trim();
          return `<p><strong>${escapeHtml(speaker)}:</strong> ${escapeHtml(
            text
          )}</p>`;
        })
        .join("");
    })
    .catch((error) => {
      console.error("Error loading transcript content:", error);
      document.getElementById("historyTranscription").innerHTML = `
        <div class="error-message">
          Failed to load transcript content. Please try again.
        </div>
      `;
    });
}

function updateHistorySpeakerLabels() {
  const historyTranscriptSection = document.getElementById(
    "historyTranscriptSection"
  );
  const transcript = JSON.parse(
    historyTranscriptSection.dataset.transcriptData
  );
  const transcription = document.getElementById("historyTranscription");

  const lines = transcript.transcript_text.split("\n");
  const updatedTranscript = lines
    .map((line) => {
      const [speaker, ...textParts] = line.split(":");
      const text = textParts.join(":").trim();
      const nameInput = document.getElementById(`history-${speaker.trim()}`);
      const speakerName =
        nameInput && nameInput.value ? nameInput.value : speaker;
      return `<p><strong>${escapeHtml(speakerName)}:</strong> ${escapeHtml(
        text
      )}</p>`;
    })
    .join("");

  transcription.innerHTML = updatedTranscript;
}

function copyHistoryToClipboard() {
  const transcription = document.getElementById("historyTranscription");
  let notification = document.querySelector(".copy-notification");
  if (!notification) {
    notification = document.createElement("div");
    notification.className = "copy-notification";
    document.body.appendChild(notification);
  }

  const content = Array.from(transcription.children)
    .map((p) => {
      const speaker =
        p.querySelector("strong")?.textContent.replace(":", "") || "";
      const text = p.textContent.replace(speaker + ":", "").trim();
      return `**${speaker}:** ${text}`;
    })
    .join("\n\n");

  navigator.clipboard
    .writeText(content)
    .then(() =>
      showNotification(notification, "Transcript copied to clipboard")
    )
    .catch((err) => showNotification(notification, "Failed to copy: " + err));
}

function showNotification(notification, message) {
  notification.textContent = message;
  notification.style.display = "block";
  notification.style.opacity = "1";

  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => {
      notification.style.display = "none";
    }, 300);
  }, 2000);
}
// Add these to your script.js file

function switchUploadMode(mode) {
  const fileZone = document.getElementById("fileUploadZone");
  const pasteZone = document.getElementById("pasteUploadZone");
  const buttons = document.querySelectorAll(".btn-group .btn");

  buttons.forEach((btn) => btn.classList.remove("active"));

  if (mode === "file") {
    fileZone.style.display = "block";
    pasteZone.style.display = "none";
    buttons[0].classList.add("active");
    document.getElementById("processButton").style.display = "block";
  } else {
    fileZone.style.display = "none";
    pasteZone.style.display = "block";
    buttons[1].classList.add("active");
    document.getElementById("processButton").style.display = "none";
  }

  // Reset states
  document.getElementById("transcriptSection").style.display = "none";
  document.getElementById("fileInfo").style.display = "none";
  document.getElementById("uploadStatus").textContent = "";
}

function processPastedTranscript() {
  const textarea = document.getElementById("transcriptPaste");
  const text = textarea.value.trim();

  if (!text) {
    uploadStatus.textContent = "Please paste some text first.";
    return;
  }

  // Split into lines and clean up empty lines
  const lines = text.split("\n").filter((line) => line.trim());

  // Initialize variables to track current speaker and collect utterances
  let currentSpeaker = null;
  let currentText = [];
  const utterances = [];

  // Process each line
  lines.forEach((line) => {
    const trimmedLine = line.trim();

    // Check if line starts with "Speaker"
    if (trimmedLine.match(/^Speaker\s+[A-Z]/i)) {
      // If we have a previous speaker and text, save it
      if (currentSpeaker && currentText.length > 0) {
        utterances.push({
          speaker: currentSpeaker,
          text: currentText.join(" ").trim(),
        });
        currentText = [];
      }
      // Update current speaker
      currentSpeaker = trimmedLine.split(/\s+/).slice(0, 2).join(" ");
    } else if (currentSpeaker) {
      // Add line to current text if we have a speaker
      currentText.push(trimmedLine);
    }
  });

  // Add final utterance if exists
  if (currentSpeaker && currentText.length > 0) {
    utterances.push({
      speaker: currentSpeaker,
      text: currentText.join(" ").trim(),
    });
  }

  // Create a transcript result object
  transcriptionResult = {
    utterances: utterances,
  };

  // Display the transcript
  displayTranscription({ utterances });

  // Save to database
  const transcriptData = {
    fileName: "Pasted Transcript",
    fileSize: text.length,
    fileType: "text/plain",
    transcriptText: utterances
      .map((u) => `${u.speaker}\n${u.text}`)
      .join("\n\n"),
    created_at: new Date().toISOString(),
    status: "completed",
    language: "en",
    user_id: "default",
  };

  // saveTranscriptToDatabase(transcriptData).catch((error) => {
  //   console.error("Failed to save pasted transcript:", error);
  // });
}
