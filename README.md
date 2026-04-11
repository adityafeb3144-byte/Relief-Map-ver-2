# Relief-Map 🆘

Relief-Map is a real-time emergency response web application built for the GDG Hackathon. It connects people in distress with nearby responders using real-time GPS tracking, Google Maps, and Gemini AI analysis.

## Features 🚀

- **Real-Time Proximity Feed**: View emergency requests within a 2km radius on a dark-themed Google Map.
- **Multimodal Dispatcher**: Request help with text and photos.
- **Gemini AI Brain**: Automatically categorizes requests (Food, Medical, Rescue) and assigns urgency scores (1-10).
- **Material Design 3**: A polished, high-end Google aesthetic.
- **Full-Stack Architecture**: Express + Vite + Firebase + Google GenAI.

## Tech Stack 🛠️

- **Frontend**: React 19, Vite, Tailwind CSS 4, Motion (Framer Motion).
- **Backend**: Node.js, Express.
- **Database & Auth**: Firebase Firestore, Firebase Authentication (Google Sign-in).
- **AI**: Google Gemini 1.5 Flash (@google/genai).
- **Maps**: Google Maps JavaScript API (@vis.gl/react-google-maps).

## Getting Started 🏁

### Prerequisites

- Node.js (v18 or higher)
- A Firebase Project
- A Google Cloud Project with Maps and Gemini API enabled

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/Relief-Map-GDG.git
   cd Relief-Map-GDG
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Variables**:
   Create a `.env` file in the root directory and add your keys (see `.env.example`):
   ```env
   GEMINI_API_KEY="your_gemini_api_key"
   VITE_GOOGLE_MAPS_API_KEY="your_google_maps_api_key"
   ```

4. **Firebase Configuration**:
   Ensure you have a `firebase-applet-config.json` in the root directory with your Firebase credentials:
   ```json
   {
     "projectId": "your-project-id",
     "appId": "your-app-id",
     "apiKey": "your-api-key",
     "authDomain": "your-auth-domain",
     "firestoreDatabaseId": "your-database-id"
   }
   ```

### Running the App

- **Development**:
  ```bash
  npm run dev
  ```
  The app will be available at `http://localhost:3000`.

- **Production Build**:
  ```bash
  npm run build
  npm start
  ```

## Deployment 🌐

### Google Cloud Run

This project is ready for Cloud Run. Ensure your environment variables are set in the Cloud Run service configuration.

### Firebase Hosting

You can also deploy the `dist` folder to Firebase Hosting for a static deployment (though the Express server provides more flexibility for future API expansions).

## License 📄

Apache-2.0
