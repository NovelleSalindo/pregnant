# PregnaCare Mobile App (React Native + Expo)

A native mobile client for **PregnaCare** built with React Native, Expo, and TypeScript. Connects to the existing PHP/MySQL backend via REST APIs while featuring an offline-capable clinical decision support risk engine.

---

## Features

- **Personalized Pregnancy Milestone**:
  - Gestational age calculator (week, day, trimester)
  - Due date countdown
  - Week-by-week fruit-size comparison & milestone illustrations
- **Maternal Risk Decision Support**:
  - Semicircular animated SVG risk gauge
  - Real-time client-side AHP + Fuzzy Logic + Clinical Safety-Net Rules
  - Works **100% offline** on the device
  - Synchronizes assessments with the MySQL clinic database
- **Daily Vitals Monitoring**:
  - Blood Pressure (systolic/diastolic), Blood Sugar, Hemoglobin, Weight, and Temperature
  - Automated clinical threshold warning banners (hypertension, hyperglycemia, anemia)
  - Measurement history and trends
- **Kick Counter**:
  - Tactile haptic feedback on every kick recorded (`expo-haptics`)
  - 2-hour session timer with 10-kick target indicator
- **Contraction Timer**:
  - Start/stop contraction duration stopwatch
  - Interval & frequency analysis
  - Automated **5-1-1 Rule Alert** when contractions indicate active labor
- **Wellness Tools**:
  - Hospital Bag packing checklist with progress indicator
  - Daily prenatal vitamin & medication reminder checklist
  - Birth preferences plan editor
  - IOM gestational weight gain guidelines by BMI category
- **Configurable Backend Connection**:
  - Switch between `localhost` (emulators) and local Wi-Fi IP (physical devices running Expo Go) with one tap.

---

## Quick Start

### 1. Prerequisites
- **XAMPP**: Apache & MySQL running on your computer with the `pregnacare` database imported.
- **Node.js**: v18 or later.
- **Expo Go App**: (Optional) Installed on your physical Android or iPhone from Google Play / App Store.

### 2. Start the Mobile App

Navigate to the `mobile/` directory:

```bash
cd mobile
npm start
```

This launches the Expo CLI with a QR code in your terminal:
- **Scan the QR Code** with your phone's camera (iOS) or the Expo Go app (Android).
- Or press `a` to launch in an Android Emulator.
- Or press `i` to launch in an iOS Simulator.

### 3. Connecting Physical Devices on Local Wi-Fi

When testing on a physical phone:
1. Ensure your phone and computer are on the same Wi-Fi network.
2. Find your computer's local IP address (e.g. `192.168.1.100` via `ipconfig`).
3. On the login screen, tap **Server: ...** at the bottom and enter:
   ```
   http://192.168.1.100/HAYYYSSSS/pregnacare_old/api
   ```
4. Sign in with the demo patient account:
   - **Email**: `ana@demo.com`
   - **Password**: `demo123`
