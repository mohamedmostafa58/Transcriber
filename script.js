const API_KEY = "7a5155cf3ab2412ca39c3a3a01ce68ea";
let selectedFile = null;
let transcriptionResult = null;

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const fileInfo = document.getElementById("fileInfo");
const uploadStatus = document.getElementById("uploadStatus");

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
        <strong>File:</strong> ${file.name}<br>
        <strong>Size:</strong> ${(file.size / (1024 * 1024)).toFixed(2)} MB<br>
        <strong>Type:</strong> ${file.type}
    `;

  uploadStatus.textContent =
    "File selected. Click Process File to start transcription.";
  document.getElementById("processButton").disabled = false;
  document.getElementById("transcriptSection").style.display = "none";
}

function showSection(sectionName) {
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.remove("active");
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  document.getElementById(`${sectionName}Section`).classList.add("active");
  event.currentTarget.classList.add("active");
}

async function startTranscriptionProcess() {
  if (!selectedFile) return;

  const progressBar = document.getElementById("progressBar");
  const progressFill = document.getElementById("progressFill");
  progressBar.style.display = "block";
  progressFill.style.width = "0%";

  try {
    // Upload file with progress tracking
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

      xhr.addEventListener("error", () => {
        reject(new Error("Upload failed"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload aborted"));
      });

      xhr.open("POST", "https://api.assemblyai.com/v2/upload");
      xhr.setRequestHeader("Authorization", API_KEY);

      const formData = new FormData();
      formData.append("file", selectedFile);
      xhr.send(selectedFile);
    });

    // Start transcription
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

// Update the checkTranscriptionStatus function to show progress from 70% to 100%
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
      // Calculate progress between 70% and 95% while processing
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
                    <label>${speaker}:</label>
                    <input type="text" id="${speaker}" placeholder="Enter name">
                </div>
            `
    )
    .join("");

  document.getElementById("transcription").innerHTML = result.utterances
    .map(
      (utterance) => `
                <p><strong>${utterance.speaker}:</strong> ${utterance.text}</p>
            `
    )
    .join("");
}

function replaceSpeakerLabels() {
  if (!transcriptionResult) return;

  const transcription = document.getElementById("transcription");
  const updatedTranscript = transcriptionResult.utterances
    .map((utterance) => {
      const nameInput = document.getElementById(utterance.speaker);
      const speakerName =
        nameInput && nameInput.value ? nameInput.value : utterance.speaker;
      return `<p><strong>${speakerName}:</strong> ${utterance.text}</p>`;
    })
    .join("");

  transcription.innerHTML = updatedTranscript;
}

function copyToClipboard(format) {
  const transcription = document.getElementById("transcription");

  // Create notification element if it doesn't exist
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

  setTimeout(() => {
    notification.classList.remove("show");
  }, 2000);
}
//responsivenss
// Sidebar toggle functionality
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.getElementById("sidebar");
const main = document.querySelector(".main");

function toggleSidebar() {
  sidebar.classList.toggle("collapsed");
  // Save state to localStorage
  localStorage.setItem(
    "sidebarCollapsed",
    sidebar.classList.contains("collapsed")
  );
}

sidebarToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleSidebar();
});

// Restore sidebar state on page load
document.addEventListener("DOMContentLoaded", () => {
  const sidebarCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
  if (sidebarCollapsed) {
    sidebar.classList.add("collapsed");
  }
});

// Handle window resize
// window.addEventListener("resize", () => {
//   if (window.innerWidth <= 768) {
//     sidebar.classList.remove("collapsed");
//   }
// });
