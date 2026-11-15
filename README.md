# OreWay Mars: Planetary Surface Navigation & In-Situ Resource Assessment

## 🚀 The Challenge
Future human missions to Mars face extreme environmental hazards, including steep terrains, extreme thermal shifts, radiation exposure, and a critical communication delay of 14 minutes and 20 seconds (Earth-Mars). Astronauts require a localized, multi-layered decision-support system to navigate safely, avoid hazards, and make autonomous decisions without real-time guidance from Earth.

## 🌟 Our Solution
**OreWay Mars** is a localized Mission Control dashboard designed for Martian surface exploration. It integrates real NASA data to provide astronauts with dynamic risk assessment, safe routing, and live telemetry simulation. 

## 🔬 Scientific Justification (Why Syrtis Major Planum?)
We selected **Syrtis Major Planum (8.400°N, 69.500°E)** for its high scientific value:
*   **Early Noachian Bedrock:** Contains ancient geological records (>4 billion years old).
*   **Hydrated Minerals:** CRISM data detects Phyllosilicates (clay minerals) and Carbonates, indicating a history of ancient water activity.
*   **Resource Extraction:** The area is rich in Basaltic plains, Olivine, and Iron/Titanium (Ti-Fe) ridges, ideal for In-Situ Resource Utilization (ISRU).

## ⚙️ Key Features (The Innovation)
1. **Dynamic Risk Score (0-100):** Fuses real NASA data layers (MOLA Topography, THEMIS Thermal, CRISM Minerals, and DONKI Space Weather) into a single, actionable safety metric for the astronaut.
2. **Interactive 'Simulate Walk' Telemetry:** A live simulation where the astronaut traverses the waypoints. The system dynamically tracks O2 depletion and triggers audio-visual geofenced hazard alerts when approaching danger zones (e.g., Dark Dunes).
3. **Autonomous Emergency Protocols:** Features a "Solar Storm (SPE)" trigger that automatically reroutes the astronaut to Base Camp and updates the Risk Score to 100, emphasizing local decision-making.
4. **Mission Briefing & Help UI:** A futuristic, dark-themed user interface that guides the astronaut with clear, step-by-step mission rules and quick help.

## 🛠️ Tech Stack
*   **Frontend:** HTML5, CSS3 (Custom NASA Dark Theme), Vanilla JavaScript.
*   **Mapping:** Leaflet.js integrated with NASA Mars Trek WMTS APIs.
*   **Data Processing:** Real-time telemetry simulation and Web Audio API for hazard cues.

## 💻 How to Run
1. Clone the repository.
2. Open `index.html` in any modern web browser.
3. Alternatively, run using a local server (e.g., VS Code Live Server).

---
*Developed for the NASA Space Apps Challenge 2026.*