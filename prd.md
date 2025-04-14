📸 For Camera Input
You’ll need to feed in the camera texture:

Use expo-camera to capture the video

Render the frame to a texture

Feed that into gl-react as the shader input

🧪 For Post-Processing
If you only want to apply this to a video after recording, it may be easier to:

Use ffmpeg-kit to add filters (blur, curves, resolution drop)

Or process frame-by-frame using a headless gl-react pipeline (if you're ambitious)

🧰 Next Steps
Would you like a sample with the Expo Camera → GL shader → Display pipeline?

Or are you thinking more about applying this effect to pre-recorded clips?

Let me know how "live" this needs to be and I’ll tailor a starting point for you.






You said:
I want to use the app to record videos with this effect. First, help me create a PRD I can import into my editor's llm to give it context for the project.


ChatGPT said:
Perfect — here’s a Product Requirements Document (PRD) tailored for your app idea. It’s focused, descriptive, and structured to give your editor’s LLM the right technical and creative context.

📄 Product Requirements Document (PRD)
Project Title: SD Cam – Retro Video Recording App

Objective:
Build a cross-platform mobile app that lets users record videos using their device's camera while applying a live retro SD (standard-definition) video filter, simulating the look of late-80s to mid-90s television shows (e.g., Twin Peaks, X-Files, Unsolved Mysteries).

🎯 Goals
Allow users to record video directly with the SD retro filter applied in real time.

Emulate the look and feel of analog SD cameras from the 1990s.

Keep the app lightweight and performant on both iOS and Android.

Enable simple UX focused on creating short aesthetic videos (ideal for reels, TikToks, etc.).

🖼️ Visual Aesthetic
The SD filter should emulate:

Slight Gaussian blur / soft focus

Muted / vintage color grading (slight green or sepia tint)

Interlaced scanlines (subtle and moving)

Color bleeding and mild chromatic aberration

Lower resolution feel, even if recorded in HD

Optional timestamp overlay (e.g., "APR 13 1992")

Target references:

Twin Peaks intro sequence

1990s camcorder footage

Early episodes of The X-Files

🛠️ Technical Stack
Framework: Expo (React Native)

Cross-platform support (iOS & Android)

Eases camera and WebGL integration

Core Libraries:

expo-camera: to access and record video

expo-gl: to access the device's GPU with WebGL

gl-react + gl-react-expo: to apply GLSL shaders to camera frames in real time

expo-av: for video recording playback, storage, and sharing

Shader System:

Custom GLSL fragment shader applied to camera preview

Will simulate SD filter effects in real-time using gl-react

📱 Features
Feature	Description
Live Camera Preview	Real-time preview with SD filter applied
Record Video	Tap to record video with effect baked in
Toggle Timestamp Overlay	Add/remove timestamp overlay with current date/time
Save & Share	Save recorded video to device and share via native share sheet
Aspect Ratio Selector	Optional: Choose 4:3 (retro) or 16:9 (modern)
Audio Capture	Record video with synced device mic input
🔮 Stretch Goals (Future)
Multiple filter presets (e.g., 80s VHS, 2000s DV, ‘70s CRT)

Audio filters (e.g., tape hiss, reverb, EQ curve)

Overlay options (e.g., camcorder UI, subtitles)

Simple trim + clip editor

Reverse and glitch effects

🧪 MVP Checklist
 Real-time GLSL SD filter shader works in app

 Camera + shader preview renders consistently across devices

 Video recording captures output with shader effect baked in

 Save and share functionality tested

 App runs smoothly at 30fps on mid-tier devices
