import OBSWebSocket from "obs-websocket-js";

const obs = new OBSWebSocket();

// Grab race name from CLI args
const newText = process.argv[2];
if (!newText) {
  console.error("❌ Please provide the match text as an argument.");
  process.exit(1);
}

// Target scenes and source
const scenesToUpdate = ["Intro", "Outro"];
const sourceName = "Match Information";

async function updateTextSource() {
  try {
    await obs.connect(process.env.OBS_ADDRESS, process.env.OBS_PASSWORD || undefined);
    console.log("✅ Connected to OBS WebSocket.");

    for (const sceneName of scenesToUpdate) {
      try {
        await obs.call("SetInputSettings", {
          inputName: sourceName,
          inputSettings: { text: newText },
          overlay: false,
        });
        console.log(`✅ Updated text in scene "${sceneName}".`);
      } catch (sceneErr) {
        console.error(`❌ Failed to update scene "${sceneName}":`, sceneErr.message);
      }
    }

    await obs.disconnect();
    console.log("🔌 Disconnected from OBS.");
  } catch (err) {
    console.error("❌ Failed to connect to OBS WebSocket:", err.message);
    process.exit(1);
  }
}

updateTextSource();
