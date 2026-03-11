# Frontend - License Plate Recognition Web 💻

The web application interface designed for parking lot administrators and staff. Built with **React + Vite**.

## 🌟 Key Features
- **Live Monitoring**: Real-time display of incoming and outgoing vehicles (IN/OUT), automatically updated via WebSocket connections to the backend.
- **Dashboard Statistics**: Daily charts and metrics showing vehicle traffic, segmented by internal members vs. external visitors.
- **Member Management**: Complete CRM for organizational members (Add, Edit, Delete personnel and their registered vehicles).
- **Parking History**: Searchable historical logs of all parking sessions and events.
- **Session Adjustment**: Manual override capabilities allowing administrators to fix incorrect plate numbers read by the AI during a parking session.

---

## 📁 Folder Structure

```
FrontEnd/LicensePlate-Web/
├── index.html       
├── package.json     
├── vite.config.js
└── src/
    ├── App.jsx        # Application Routing structure
    ├── main.jsx       # React Entry Point
    ├── services/
    │   └── api.js     # Centralized API calls (Axios) to the Backend
    ├── components/    # Reusable React UI Components
    └── pages/         # Main application pages (Dashboard, Live, Members, etc.)
```

---

## ⚙️ Environment Configuration

To configure the Backend endpoint for the Frontend application, modify the URLs inside `src/services/api.js`.

```javascript
// Example configuration in api.js
const API_BASE_URL = "http://localhost:8000/api";
const EVENTS_WS_URL = "ws://localhost:8000/ws/events";
```
*(Update these URLs if your backend is hosted on a remote server instead of localhost).*

---

## 🛠️ Installation & Execution

1. **Navigate to the project folder**:
   ```bash
   cd FrontEnd/LicensePlate-Web
   ```
2. **Install Node Packages** (Node.js 18+ recommended):
   ```bash
   npm install
   ```
3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   The terminal will display the local URL to access the site (usually `http://localhost:5173`).
4. **Build for Production**:
   ```bash
   npm run build
   ```
   This compiles the application into static files within the `/dist` directory, ready to be hosted on platforms like Vercel, Netlify, or Nginx.
