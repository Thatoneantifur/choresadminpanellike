// ----------------------------------------------------
// FIREBASE SETUP AND INITIALIZATION
// ----------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, updateDoc, deleteDoc, 
    onSnapshot, collection, query, where, 
    addDoc, getDoc, serverTimestamp, setLogLevel
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Set Firebase Debug Logging
setLogLevel('Debug');

// Mandated Global Variables for Firebase
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-task-tracker-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db;
let auth;
let userId = null;
let userDocRef = null;

// --- State Variables ---
let flexTimeBalance = 60; 
let screenTimeDebt = 0; 
const DAILY_REWARD = 30;
let currentTasks = [];

// --- NEW: Audio Setup ---
const audioFiles = {
    success: 'access_granted.mp3',
    added: 'task_added.mp3',
    deduct: 'deduction.mp3',
    error: 'error.mp3',
    sent: 'request_sent.mp3' // A more neutral sound
};

function playSound(soundName) {
    if (audioFiles[soundName]) {
        const audio = new Audio(`audio/${audioFiles[soundName]}`);
        audio.play().catch(error => console.error(`Error playing sound "${soundName}":`, error));
    }
}

// --- Utility Functions ---
// MODIFIED: Added an optional soundName parameter to trigger audio
const showPopup = (title, message, color = 'var(--neon-green)', soundName = null) => {
    document.getElementById('popupTitle').textContent = title;
    document.getElementById('popupMessage').textContent = message;
    document.getElementById('popupTitle').style.color = color;
    const popup = document.getElementById('statusPopup');
    popup.style.borderColor = color;
    popup.style.boxShadow = `0 0 30px ${color}`;
    popup.classList.add('active');
    console.log(`[POPUP] ${title}: ${message}`);
    
    // Play sound if one is specified
    if (soundName) {
        playSound(soundName);
    }
}

const hidePopup = () => {
    document.getElementById('statusPopup').classList.remove('active');
}

const updateFlexDisplay = () => {
    document.getElementById('flexTimeDisplay').textContent = flexTimeBalance + ' min';
    document.getElementById('flexTimeDisplay').style.color = flexTimeBalance >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
};

const updateDebtDisplay = () => {
    document.getElementById('debtTracker').textContent = `${screenTimeDebt} min`;
    document.getElementById('debtTracker').style.color = screenTimeDebt > 0 ? 'var(--neon-red)' : 'var(--neon-green)';
};


// --- Firestore Handlers ---

// 1. Authentication and Initialization
if (firebaseConfig) {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                document.getElementById('userIdDisplay').textContent = userId;
                userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'state', 'profile');
                
                listenToUserState();
                listenToTasks();

            } else {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            }
        });

    } catch (error) {
        console.error("Firebase Initialization Error:", error);
        showPopup("ERROR", "Failed to connect to the database. Check console.", 'var(--neon-red)', 'error');
    }
} else {
    console.error("Firebase Config Missing. Cannot use persistent storage.");
    showPopup("ERROR", "Firebase Configuration is missing.", 'var(--neon-red)', 'error');
}

// 2. Listen to User State (Flex Time and Debt)
const listenToUserState = () => {
    onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            flexTimeBalance = data.flexTime || 0;
            screenTimeDebt = data.screenTimeDebt || 0; 
            
        } else {
            setDoc(userDocRef, { flexTime: 60, screenTimeDebt: 0, lastUpdated: serverTimestamp() });
            flexTimeBalance = 60;
            screenTimeDebt = 0;
            showPopup("SYSTEM READY", "Dashboard connected. Initializing 60 min Flex Time.", 'var(--neon-blue)');
        }
        updateFlexDisplay();
        updateDebtDisplay();
    }, (error) => {
        console.error("Error listening to user state:", error);
    });
}

// 3. Listen to Tasks and Render
const listenToTasks = () => {
    const tasksCollectionRef = collection(db, 'artifacts', appId, 'users', userId, 'daily_tasks');
    const q = query(tasksCollectionRef);

    onSnapshot(q, (snapshot) => {
        currentTasks = [];
        let isInitialLoad = (snapshot.docChanges().length === 0 && snapshot.size === 0);
        
        snapshot.forEach((doc) => {
            currentTasks.push({ id: doc.id, ...doc.data() });
        });
        
        if (isInitialLoad && currentTasks.length === 0) {
            populateDefaultTasks();
        }

        currentTasks.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
        renderTasks();
        updateProgress();
    }, (error) => {
        console.error("Error listening to tasks:", error);
    });
}

// Initializer Function for a New User
async function populateDefaultTasks() {
    const defaultTasks = [
        { name: "Make Bed & Open Blinds", time: "6:45 AM", completed: false, createdAt: serverTimestamp() },
        { name: "Brush Teeth & Wash Face", time: "7:00 AM", completed: false, createdAt: serverTimestamp() },
        { name: "Get Dressed (No Pajamas!)", time: "7:15 AM", completed: false, createdAt: serverTimestamp() },
        { name: "Eat Breakfast & Clear Plate", time: "7:30 AM", completed: false, createdAt: serverTimestamp() }
    ];

    try {
        const tasksCollectionRef = collection(db, 'artifacts', appId, 'users', userId, 'daily_tasks');
        for (const task of defaultTasks) {
            await addDoc(tasksCollectionRef, task);
        }
        showPopup("DEFAULT ROUTINE", "Morning routine loaded. Start checking tasks!", 'var(--neon-blue)');
    } catch(e) {
         console.error("Error populating default tasks:", e);
    }
}


// --- UI Rendering ---
const renderTasks = () => {
    const taskListEl = document.getElementById('taskList');
    taskListEl.innerHTML = ''; 

    if (currentTasks.length === 0) {
        taskListEl.innerHTML = '<li style="text-align: center; opacity: 0.6; padding: 20px;">No tasks currently assigned. Add one below!</li>';
        return;
    }

    currentTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.dataset.taskId = task.id;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `task-${task.id}`;
        checkbox.checked = task.completed;
        checkbox.onclick = () => toggleTask(task.id, !task.completed);

        const label = document.createElement('label');
        label.htmlFor = `task-${task.id}`;
        label.className = 'task-label';
        label.textContent = task.name;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'task-time';
        timeSpan.innerHTML = `<i class="far fa-clock"></i> ${task.time || 'No deadline'}`;

        li.appendChild(checkbox);
        li.appendChild(label);
        li.appendChild(timeSpan);
        taskListEl.appendChild(li);
    });
}

// --- Task Actions (CRUD) ---

// Add Task
document.getElementById('addTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskName = document.getElementById('taskInput').value.trim();
    const taskTime = document.getElementById('timeInput').value.trim();

    if (taskName && userId) {
        try {
            await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'daily_tasks'), {
                name: taskName,
                time: taskTime,
                completed: false,
                createdAt: serverTimestamp()
            });
            document.getElementById('taskInput').value = '';
            document.getElementById('timeInput').value = '';
            showPopup("TASK ADDED", `"${taskName}" successfully added.`, 'var(--neon-blue)', 'added');
        } catch (error) {
            console.error("Error adding task:", error);
            showPopup("ERROR", "Could not add task. Try again.", 'var(--neon-red)', 'error');
        }
    }
});

// Toggle Task Completion
async function toggleTask(taskId, isCompleted) {
    if (!userId) return;
    try {
        const taskRef = doc(db, 'artifacts', appId, 'users', userId, 'daily_tasks', taskId);
        await updateDoc(taskRef, { completed: isCompleted });
    } catch (error) {
        console.error("Error toggling task:", error);
        showPopup("ERROR", "Could not update task status.", 'var(--neon-red)', 'error');
    }
}

// Reset All Tasks (Clears completed status)
async function resetTasks() {
    if (!userId) return;
    
    const completedTasks = currentTasks.filter(task => task.completed);
    
    if (completedTasks.length === 0) {
        showPopup("NO TASKS TO RESET", "All current tasks are incomplete.", 'var(--neon-blue)');
        return;
    }

    try {
         for (const task of completedTasks) {
            await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'daily_tasks', task.id));
         }
        showPopup("TASKS CLEARED", `${completedTasks.length} completed tasks removed!`, 'var(--neon-green)');
    } catch (error) {
        console.error("Error resetting tasks:", error);
        showPopup("ERROR", "Could not reset tasks.", 'var(--neon-red)', 'error');
    }
}

// --- Progress and Reward Logic ---

function updateProgress() {
    const totalTasks = currentTasks.length;
    const completedTasks = currentTasks.filter(task => task.completed).length;
    const progressPercent = totalTasks === 0 ? 0 : (completedTasks / totalTasks) * 100;
    
    const progressBar = document.getElementById('missionProgress');
    const progressText = document.getElementById('progressText');
    
    progressBar.style.width = progressPercent.toFixed(0) + '%';
    progressText.textContent = `${completedTasks}/${totalTasks} Tasks Completed`;

    if (completedTasks === totalTasks && totalTasks > 0) {
        progressBar.style.backgroundColor = 'var(--neon-blue)';
    } else {
        progressBar.style.backgroundColor = 'var(--neon-green)';
    }
}

// Request Reward (Confirmation)
async function requestConfirmation() {
    if (!userId) return;

    const totalTasks = currentTasks.length;
    const completedTasks = currentTasks.filter(task => task.completed).length;
    
    if (totalTasks === 0) {
        showPopup("HOLD UP", "There are no tasks to confirm! Add some tasks first.", 'var(--neon-red)', 'error');
        return;
    }

    if (completedTasks === totalTasks) {
        showPopup("REQUEST SENT", `Processing ${DAILY_REWARD} min Reward...`, 'var(--neon-blue)', 'sent');
        
        let netReward = DAILY_REWARD;
        let debtCleared = Math.min(DAILY_REWARD, screenTimeDebt);
        netReward = DAILY_REWARD - debtCleared;
        
        try {
            await updateDoc(userDocRef, {
                flexTime: flexTimeBalance + netReward,
                screenTimeDebt: screenTimeDebt - debtCleared,
                lastReward: serverTimestamp()
            });
            showPopup("ACCESS GRANTED!", `+${DAILY_REWARD} min awarded! Debt cleared: ${debtCleared} min.`, 'var(--neon-green)', 'success');
        } catch (error) {
            console.error("Error rewarding time:", error);
            showPopup("ERROR", "Failed to update time balance.", 'var(--neon-red)', 'error');
        }

    } else {
        showPopup("MISSION INCOMPLETE", `You have ${totalTasks - completedTasks} tasks remaining.`, 'var(--neon-red)', 'error');
    }
}

// Deduct Overage (Consequence)
async function deductOverage(minutes) {
    if (!userId) return;
    try {
        await updateDoc(userDocRef, {
            flexTime: flexTimeBalance - minutes,
            screenTimeDebt: screenTimeDebt + minutes,
            lastDeduction: serverTimestamp()
        });
        showPopup("WARNING: OVERAGE", `${minutes} min deducted. Debt increased.`, 'var(--neon-red)', 'deduct');
    } catch (error) {
        console.error("Error deducting time:", error);
        showPopup("ERROR", "Failed to deduct time.", 'var(--neon-red)', 'error');
    }
}

// --- Expose functions to the global scope for HTML inline handlers ---
window.toggleTask = toggleTask;
window.resetTasks = resetTasks;
window.requestConfirmation = requestConfirmation;
window.deductOverage = deductOverage;
window.hidePopup = hidePopup;