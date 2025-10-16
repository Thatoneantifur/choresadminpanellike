# Mission Control: Database Edition

A futuristic, neon-themed personal task dashboard designed to manage daily routines and track rewards. This application uses Firebase Firestore for real-time data persistence, allowing a user's tasks and status to be saved automatically.

## ✨ Features

* **Real-time Task Management**: Add, check off, and reset daily tasks.
* **Persistent Data**: All tasks and user stats (Flex Time, Screen Time Debt) are saved to a Firestore database.
* **Anonymous Authentication**: Users are automatically assigned a unique ID to store their data without needing to create an account.
* **Progress Tracking**: A visual progress bar shows how close you are to completing all daily objectives.
* **Reward System**: Earn "Flex Time" by completing all tasks, which can be used to pay off "Screen Time Debt."
* **Audio Feedback**: UI sound effects for key actions like adding tasks, earning rewards, and errors.

## 🚀 Setup & Installation

This is a front-end only application that connects to a Google Firebase backend.

1.  **Clone the Repository**
    ```sh
    git clone [https://github.com/your-username/mission-control.git](https://github.com/your-username/mission-control.git)
    ```

2.  **Firebase Configuration**
    This project requires a Firebase project to be set up for the database and authentication features.
    * Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
    * Create a **Firestore Database**.
    * In Project Settings, add a new **Web App**.
    * Copy the `firebaseConfig` object provided.

3.  **Provide Credentials**
    The `index.html` and `js/main.js` files are set up to look for global variables (`__firebase_config`, etc.). For local development, you can create a `config.js` file and add it to `index.html` **before** `main.js`:

    **`config.js`**
    ```javascript
    const __firebase_config = JSON.stringify({
        apiKey: "AIza...",
        authDomain: "your-project.firebaseapp.com",
        projectId: "your-project-id",
        storageBucket: "your-project.appspot.com",
        messagingSenderId: "...",
        appId: "1:..."
    });
    const __app_id = 'your-app-id'; // A unique name for your instance
    const __initial_auth_token = null; // Not needed for anonymous sign-in
    ```
    
    **`index.html` (add this line before the main.js script tag)**
    ```html
    <script src="config.js"></script>
    <script type="module" src="js/main.js"></script>
    ```

4.  **Run the Application**
    Simply open the `index.html` file in your web browser.

## 📂 File Structure

```
mission-control/
├── index.html         # Main HTML page
├── css/style.css      # All application styles
├── js/main.js         # Core application logic, Firebase integration, and audio
├── audio/             # Sound effects
└── README.md          # Project documentation
```
