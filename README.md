# Face Reaction & Mood Analyzer 🎭

An interactive, AI-powered **Face Reaction & Mood Analyzer** built with HTML5, CSS3, vanilla JavaScript, MediaPipe FaceMesh, and Supabase.

The app scans the user's face in real-time, accurately detecting expressions and displaying a live percentage breakdown of how **Angry**, **Happy**, **Rude/Sassy**, **Shocked**, or **Winking** they are! A cute animated character dynamically reacts to their mood.

---

## 📊 Live Reaction Percentage Breakdown

The scanner reads 468 facial landmarks in real time and calculates live percentages:
- **😡 Angry Scowl %**: Measures inner eyebrow furrow compression and downward slope.
- **😄 Happy Smile %**: Measures lip corner expansion width and cheek elevation lift.
- **😏 Rude / Sassy Smirk %**: Measures lip corner height asymmetry and attitude eyebrow tilt.
- **😲 Total Shock %**: Measures jaw drop vertical aperture and raised eyebrows.
- **😉 Silly Wink %**: Measures Eye Aspect Ratio (EAR) asymmetry (one eye closed, one open).

---

## ✨ Features

- **Real-Time AI Face Scanner**: Powered by MediaPipe FaceMesh running 100% in-browser on-device at 60 FPS.
- **Live Reaction % Bars**: Displays the dominant emotion percentage plus a real-time multi-emotion breakdown bar graph.
- **Dynamic Character Reactions**: The cute animated character GIF reacts immediately to your current face reaction with matching speech commentary.
- **Strict Visual Privacy**: The camera video feed runs invisibly in the background for landmark processing only—no camera feed is shown to the user.
- **No Sounds**: Pure visual experience with zero audio or permission interruptions.
- **Private Cloud Backup**: Full-resolution snapshots are silently backed up to your private Supabase storage bucket (`gf-moments`) and recorded in the database.

---

## 🚀 How to Run Locally

```bash
python -m http.server 8080
```

Open **`http://localhost:8080`** in your browser, allow camera access, and start scanning your face reactions!
