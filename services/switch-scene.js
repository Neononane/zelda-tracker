import OBSWebSocket from "obs-websocket-js";

const obs = new OBSWebSocket();

// Change these if needed:
const obsAddress = process.env.OBS_ADDRESS;
const obsPassword = process.env.OBS_PASSWORD; // e.g. "secret" if set

/**
 * Switches OBS to the given scene
 */
async function switchScene(sceneName) {
  try {
    await obs.connect(obsAddress, obsPassword);

    // Get all scenes for confirmation / error handling
    const { scenes } = await obs.call("GetSceneList");

    const exists = scenes.some(s => s.sceneName === sceneName);

    if (!exists) {
      console.log(`Scene "${sceneName}" does not exist in OBS.`);
      await obs.disconnect();
      process.exit(1);
    }

    await obs.call("SetCurrentProgramScene", {
      sceneName
    });

    console.log(`✅ Switched to scene: ${sceneName}`);

    await obs.disconnect();
  } catch (e) {
    console.error(e);
  }
}

// Parse CLI arg
const targetScene = process.argv[2];

if (!targetScene) {
  console.log("Usage: node switch-scene.js <SceneName>");
  process.exit(1);
}

switchScene(targetScene);
