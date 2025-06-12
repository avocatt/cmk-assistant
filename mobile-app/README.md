# CMK Asistanı - Mobile App

This is a cross-platform mobile application for iOS and Android, built with React Native and Expo. It provides a simple, elegant, and voice-first interface for the CMK Asistanı backend.

## Technology Stack

- **Framework:** React Native with Expo
- **Language:** TypeScript
- **API Client:** Axios
- **Audio Recording:** `expo-av`
- **Speech-to-Text:** Secure backend integration with OpenAI Whisper API
- **Text-to-Speech:** `expo-speech`

## Prerequisites

- Node.js (LTS version)
- A physical device (iPhone or Android) with the **Expo Go** app installed.
- Your FastAPI backend server must be running.

## Setup

1.  **Configure Backend URL:**
    -   Create a `.env` file in the `mobile-app` directory by copying the example:
        ```bash
        cp .env.example .env
        ```
    -   Open the `.env` file and fill in the required value:
        -   `EXPO_PUBLIC_API_URL`: The URL of your running FastAPI backend. **Important:** When running on a physical device, this must be your computer's local network IP address (e.g., `http://192.168.1.10:8000`), not `localhost`.

    **🔒 Security Note:** No API keys are needed in the mobile app! Audio transcription is now handled securely by your backend server, keeping all API keys safe.

2.  **Install Dependencies:**
    -   Navigate to the mobile app directory and install the npm packages.
        ```bash
        cd mobile-app
        npm install
        ```

## Running the Application

1.  **Start the Metro Bundler:**
    ```bash
    npm start
    ```
    This will start the Expo development server and show a QR code in the terminal.

2.  **Run on Your Device:**
    -   Open the **Expo Go** app on your phone.
    -   Scan the QR code from your terminal.
    -   The app will be downloaded and run on your device. You can now interact with it. Any changes you make to the code will automatically reload in the app. 