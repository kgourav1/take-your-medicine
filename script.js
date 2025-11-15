// ===================================
// Take Your Medicine - Main Script
// ===================================

// Storage key
const STORAGE_KEY = "takeYourMedicineApp";

// Medicine timings
const MEDICINE_TIMES = [
  { label: "Breakfast", time: "10:00", display: "10:00 AM" },
  { label: "Lunch", time: "15:00", display: "3:00 PM" },
  { label: "Dinner", time: "21:00", display: "9:00 PM" },
];

// Water reminder times (every 2 hours from 9 AM to 10 PM)
const WATER_TIMES = [
  "09:00",
  "11:00",
  "13:00",
  "15:00",
  "17:00",
  "19:00",
  "21:00",
];

// Sound URLs (using CC0 public domain sounds)
const SOUNDS = {
  taken:
    "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE",
  due: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA",
  water:
    "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4",
};

// Global state
let appData;

let updateInterval = null;

// ===================================
// Initialization
// ===================================

function init() {
  if (!appData.userName) {
    showScreen("onboarding");
    document.getElementById("bottomNav").style.display = "none";
    document.getElementById("onboarding").style.display = "flex";
  } else {
    showScreen("home");
    updateHome();
    updateMedicinesList();
    updateFullList();
    updateSettings();

    // Start real-time updates
    updateInterval = setInterval(() => {
      updateHome();
      updateCurrentTime();
      checkReminders();
    }, 1000);
  }

  updateCurrentTime();
}

// ===================================
// Data Management
// ===================================

function loadData() {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored) {
    try {
      appData = JSON.parse(stored);
      if (!appData.settings)
        appData.settings = { waterReminder: true, soundEnabled: true };
      if (!appData.history) appData.history = {};
      return; // use existing data
    } catch (e) {
      console.error("Error loading data:", e);
    }
  } else {
    appData = getDefaultAppData();
  }
}

async function loadPrefillData(name) {
  try {
    const response = await fetch(`prefills/${name}.json`);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error("Prefill load error", e);
    return null;
  }
}

function mergePrefill(prefill) {
  if (!prefill) return;

  // Username – only if empty
  if (!appData.userName && prefill.userName) {
    appData.userName = prefill.userName;
  }

  // Settings – fill only missing keys
  if (prefill.settings) {
    appData.settings = {
      ...prefill.settings,
      ...appData.settings, // user overrides prefill
    };
  }

  // Medicines – add only new ones (matching by name)
  if (prefill.medicines?.length) {
    prefill.medicines.forEach((pf) => {
      const exists = appData.medicines.some(
        (m) => m.name.toLowerCase() === pf.name.toLowerCase()
      );
      if (!exists) appData.medicines.push(pf);
    });
  }

  saveData();
}

function getPrefillName() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("profile")) return params.get("profile").toLowerCase();

  const parts = window.location.pathname.split("/");
  return parts[parts.length - 1].toLowerCase();
}

function getDefaultAppData() {
  return {
    userName: "",
    medicines: [],
    settings: { waterReminder: true, soundEnabled: true },
    history: {},
  };
}

function saveData() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (e) {
    console.error("Error saving data:", e);
    showToast("Error saving data");
  }
}

function getTodayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(today.getDate()).padStart(2, "0")}`;
}

// ===================================
// Onboarding
// ===================================

function completeOnboarding() {
  const userName = document.getElementById("userName").value.trim();

  if (!userName) {
    showToast("Please enter your name");
    return;
  }

  appData.userName = userName;
  saveData();

  document.getElementById("bottomNav").style.display = "flex";
  document.getElementById("onboarding").style.display = "none";
  showScreen("home");
  updateHome();

  // Start updates
  updateInterval = setInterval(() => {
    updateHome();
    updateCurrentTime();
    checkReminders();
  }, 1000);
}

// ===================================
// Screen Management
// ===================================

function switchScreen(screenName) {
  const screens = document.querySelectorAll(".screen");
  screens.forEach((screen) => {
    screen.classList.remove("active");
  });

  document.getElementById(screenName).classList.add("active");

  // Update nav
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item, index) => {
    item.classList.remove("active");
  });

  const navMap = { home: 0, addMedicine: 1, fullList: 2, settings: 3 };
  navItems[navMap[screenName]]?.classList.add("active");

  // Update content
  if (screenName === "home") {
    updateHome();
  } else if (screenName === "addMedicine") {
    updateMedicinesList();
  } else if (screenName === "fullList") {
    updateFullList();
  } else if (screenName === "settings") {
    updateSettings();
  }
}

function showScreen(screenName) {
  const screens = document.querySelectorAll(".screen");
  screens.forEach((screen) => {
    screen.classList.remove("active");
  });
  document.getElementById(screenName).classList.add("active");
}

// ===================================
// Home Screen
// ===================================

function updateHome() {
  document.getElementById("userNameDisplay").textContent = appData.userName;

  const upcomingEvent = getNextEvent();
  const upcomingCard = document.getElementById("upcomingCard");

  if (upcomingEvent) {
    const isOverdue = upcomingEvent.countdown < 0;
    const isMedicine = upcomingEvent.type === "medicine";

    upcomingCard.className = `upcoming-card ${upcomingEvent.type}`;
    if (isOverdue) {
      upcomingCard.classList.add("overdue");
    }

    upcomingCard.innerHTML = `
      <div class="upcoming-header">
        <div class="upcoming-title">${upcomingEvent.title}</div>
        <div class="upcoming-type">${
          upcomingEvent.type === "medicine" ? "💊 Medicine" : "💧 Water"
        }</div>
      </div>
      <div class="upcoming-time">⏰ ${upcomingEvent.displayTime}</div>
      ${
        isMedicine
          ? `
        <div class="upcoming-details">
          <div class="detail-item">🍽️ ${upcomingEvent.mealRelation}</div>
          <div class="detail-item">📅 ${upcomingEvent.daysLeft} days left</div>
        </div>
      `
          : ""
      }
      <div class="countdown ${isOverdue ? "overdue" : ""}">
        <div class="countdown-label">${
          isOverdue ? "OVERDUE BY" : "Time Remaining"
        }</div>
        <div class="countdown-time">${formatCountdown(
          Math.abs(upcomingEvent.countdown)
        )}</div>
      </div>
      ${
        isMedicine
          ? `
        <div class="upcoming-actions">
          <button class="btn btn-success" onclick="markAsTaken('${upcomingEvent.medicineId}', '${upcomingEvent.time}')">
            ✓ Taken
          </button>
        </div>
      `
          : `
        <div class="upcoming-actions">
          <button class="btn btn-primary" onclick="dismissWaterReminder()">
            ✓ Done
          </button>
        </div>
      `
      }
    `;
  } else {
    upcomingCard.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✨</div>
        <p>No upcoming medicines!</p>
        <p style="font-size: 14px; margin-top: 10px;">Add medicines to get started</p>
      </div>
    `;
  }

  updateStats();
}

function updateStats() {
  const today = getTodayKey();
  let taken = 0;
  let pending = 0;

  appData.medicines.forEach((med) => {
    if (med.daysLeft > 0) {
      med.timings.forEach((time) => {
        const status = getMedicineStatus(med.id, time);
        if (status === "taken") {
          taken++;
        } else {
          const medTime = parseTime(time);
          const now = new Date();
          const todayMedTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            medTime.hours,
            medTime.minutes
          );

          if (now >= todayMedTime) {
            pending++;
          }
        }
      });
    }
  });

  document.getElementById("todayTaken").textContent = taken;
  document.getElementById("todayPending").textContent = pending;
}

function updateCurrentTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const timeElement = document.getElementById("currentTime");
  if (timeElement) {
    timeElement.textContent = `${dateStr} • ${timeStr}`;
  }
}

// ===================================
// Core Functions
// ===================================

function getNextEvent() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let closestEvent = null;
  let minDiff = Infinity;

  // Check medicines
  appData.medicines.forEach((med) => {
    if (med.daysLeft > 0) {
      med.timings.forEach((time) => {
        const status = getMedicineStatus(med.id, time);
        if (status !== "taken") {
          const medTime = parseTime(time);
          const medMinutes = medTime.hours * 60 + medTime.minutes;
          const diff = medMinutes - currentMinutes;

          if (Math.abs(diff) < Math.abs(minDiff)) {
            minDiff = diff;
            const timeLabel = MEDICINE_TIMES.find((t) => t.time === time);
            closestEvent = {
              type: "medicine",
              title: med.name,
              time: time,
              displayTime: timeLabel ? timeLabel.display : time,
              mealRelation:
                med.mealRelation === "before" ? "Before meal" : "After meal",
              daysLeft: med.daysLeft,
              countdown: diff * 60,
              medicineId: med.id,
            };
          }
        }
      });
    }
  });

  // Check water reminders
  if (appData.settings.waterReminder) {
    WATER_TIMES.forEach((time) => {
      const waterTime = parseTime(time);
      const waterMinutes = waterTime.hours * 60 + waterTime.minutes;
      const diff = waterMinutes - currentMinutes;

      // Only show if within 5 minutes or overdue by less than 30 minutes
      if (diff >= -30 && diff <= 5) {
        if (Math.abs(diff) < Math.abs(minDiff)) {
          minDiff = diff;
          closestEvent = {
            type: "water",
            title: "💧 Drink Water",
            time: time,
            displayTime: formatTime(time),
            countdown: diff * 60,
          };
        }
      }
    });
  }

  return closestEvent;
}

function checkReminders() {
  const event = getNextEvent();
  if (event && event.countdown <= 0 && event.countdown >= -60) {
    if (event.type === "medicine") {
      playSound("due");
    } else if (event.type === "water") {
      playSound("water");
    }
  }
}

function markAsTaken(medicineId, time) {
  const today = getTodayKey();
  const key = `${medicineId}_${time}_${today}`;

  if (!appData.history[today]) {
    appData.history[today] = {};
  }

  appData.history[today][key] = "taken";
  saveData();

  playSound("taken");
  showToast("✓ Medicine marked as taken!");
  updateHome();
  updateFullList();
}

function dismissWaterReminder() {
  playSound("taken");
  showToast("✓ Great! Stay hydrated!");
  updateHome();
}

function getMedicineStatus(medicineId, time) {
  const today = getTodayKey();
  const key = `${medicineId}_${time}_${today}`;

  if (appData.history[today] && appData.history[today][key]) {
    return appData.history[today][key];
  }

  return "pending";
}

function updateDaysLeft() {
  const today = getTodayKey();
  const lastUpdate = appData.lastDayUpdate;

  if (lastUpdate !== today) {
    appData.medicines.forEach((med) => {
      if (med.daysLeft > 0) {
        med.daysLeft--;
      }
    });
    appData.lastDayUpdate = today;
    saveData();
  }
}

// ===================================
// Add Medicine
// ===================================

function addMedicine() {
  const name = document.getElementById("medicineName").value.trim();
  const breakfast = document.getElementById("timingBreakfast").checked;
  const lunch = document.getElementById("timingLunch").checked;
  const dinner = document.getElementById("timingDinner").checked;
  const mealRelation = document.querySelector(
    'input[name="mealRelation"]:checked'
  ).value;
  const days = parseInt(document.getElementById("medicineDays").value);

  if (!name) {
    showToast("Please enter medicine name");
    return;
  }

  if (!breakfast && !lunch && !dinner) {
    showToast("Please select at least one timing");
    return;
  }

  if (!days || days < 1) {
    showToast("Please enter valid number of days");
    return;
  }

  const timings = [];
  if (breakfast) timings.push("10:00");
  if (lunch) timings.push("15:00");
  if (dinner) timings.push("21:00");

  const medicine = {
    id: Date.now().toString(),
    name,
    timings,
    mealRelation,
    daysLeft: days,
    totalDays: days,
    createdAt: new Date().toISOString(),
  };

  appData.medicines.push(medicine);
  saveData();

  // Clear form
  document.getElementById("medicineName").value = "";
  document.getElementById("timingBreakfast").checked = false;
  document.getElementById("timingLunch").checked = false;
  document.getElementById("timingDinner").checked = false;
  document.getElementById("medicineDays").value = "";

  showToast("✓ Medicine added successfully!");
  updateMedicinesList();
  updateFullList();
}

function updateMedicinesList() {
  const container = document.getElementById("medicinesList");

  if (appData.medicines.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💊</div>
        <p>No medicines added yet</p>
      </div>
    `;
    return;
  }

  container.innerHTML =
    '<h3 style="margin-bottom: 15px;">Your Medicines</h3>' +
    appData.medicines
      .filter((med) => med.daysLeft > 0)
      .map((med) => {
        const timingLabels = med.timings
          .map((t) => {
            const label = MEDICINE_TIMES.find((mt) => mt.time === t);
            return label ? label.label : t;
          })
          .join(", ");

        return `
        <div class="medicine-item">
          <div class="medicine-info">
            <h4>${med.name}</h4>
            <div class="medicine-meta">
              ${timingLabels} • ${
          med.mealRelation === "before" ? "Before" : "After"
        } meal • ${med.daysLeft} days left
            </div>
          </div>
          <div class="medicine-actions">
            <button class="icon-btn" onclick="deleteMedicine('${
              med.id
            }')" title="Delete">🗑️</button>
          </div>
        </div>
      `;
      })
      .join("");
}

function deleteMedicine(id) {
  if (confirm("Are you sure you want to delete this medicine?")) {
    appData.medicines = appData.medicines.filter((med) => med.id !== id);
    saveData();
    showToast("Medicine deleted");
    updateMedicinesList();
    updateFullList();
    updateHome();
  }
}

// ===================================
// Full List
// ===================================

function updateFullList() {
  const container = document.getElementById("fullListContainer");
  const activeMedicines = appData.medicines.filter((med) => med.daysLeft > 0);

  if (activeMedicines.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p>No active medicines</p>
        <p style="font-size: 14px; margin-top: 10px;">Add medicines to see them here</p>
      </div>
    `;
    return;
  }

  container.innerHTML = activeMedicines
    .map((med) => {
      const scheduleHTML = med.timings
        .map((time) => {
          const timeLabel = MEDICINE_TIMES.find((t) => t.time === time);
          const status = getMedicineStatus(med.id, time);

          return `
        <div class="schedule-item">
          <div>
            <div class="schedule-time">${
              timeLabel ? timeLabel.display : time
            }</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
              ${med.mealRelation === "before" ? "Before" : "After"} meal
            </div>
          </div>
          <span class="schedule-status ${status}">
            ${status === "taken" ? "✓ Taken" : "⏳ Pending"}
          </span>
        </div>
      `;
        })
        .join("");

      return `
      <div class="medicine-card">
        <div class="medicine-card-header">
          <div class="medicine-name">${med.name}</div>
          <div class="medicine-days">${med.daysLeft} days</div>
        </div>
        <div class="medicine-schedule">
          ${scheduleHTML}
        </div>
      </div>
    `;
    })
    .join("");
}

// ===================================
// Settings
// ===================================

function updateSettings() {
  document.getElementById("settingsUserName").textContent = appData.userName;
  document.getElementById("waterReminderToggle").checked =
    appData.settings.waterReminder;
  document.getElementById("soundToggle").checked =
    appData.settings.soundEnabled;
  document.getElementById("totalMedicines").textContent =
    appData.medicines.filter((m) => m.daysLeft > 0).length;
}

function changeUserName() {
  const newName = prompt("Enter new name:", appData.userName);
  if (newName && newName.trim()) {
    appData.userName = newName.trim();
    saveData();
    updateSettings();
    updateHome();
    showToast("Name updated!");
  }
}

function toggleWaterReminder() {
  appData.settings.waterReminder = document.getElementById(
    "waterReminderToggle"
  ).checked;
  saveData();
  showToast(
    appData.settings.waterReminder
      ? "Water reminders enabled"
      : "Water reminders disabled"
  );
}

function toggleSound() {
  appData.settings.soundEnabled =
    document.getElementById("soundToggle").checked;
  saveData();
  showToast(
    appData.settings.soundEnabled ? "Sounds enabled" : "Sounds disabled"
  );
}

function resetApp() {
  if (
    confirm("Are you sure you want to reset all data? This cannot be undone.")
  ) {
    if (confirm("This will delete all your medicines and history. Continue?")) {
      window.localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  }
}

// ===================================
// Utility Functions
// ===================================

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours, minutes };
}

function formatTime(timeStr) {
  const { hours, minutes } = parseTime(timeStr);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatCountdown(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function playSound(type) {
  if (!appData.settings.soundEnabled) return;

  try {
    const audio = new Audio(SOUNDS[type]);
    audio.volume = 0.3;
    audio.play().catch((e) => console.log("Audio play failed:", e));
  } catch (e) {
    console.log("Audio error:", e);
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// ===================================
// Initialize on load
// ===================================

window.addEventListener("DOMContentLoaded", async () => {
  loadData();
  updateDaysLeft();

  const prefillName = getPrefillName();

  if (prefillName) {
    const prefill = await loadPrefillData(prefillName);
    mergePrefill(prefill);
  }

  init();
});

// Update days at midnight
setInterval(() => {
  updateDaysLeft();
}, 60000); // Check every minute
