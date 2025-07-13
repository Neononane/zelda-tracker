const OBSWebSocket = require("obs-websocket-js");
const obs = new OBSWebSocket();

async function main() {
  const sceneName = process.argv[2];

  if (!sceneName) {
    console.error("❌ Missing scene name argument.");
    process.exit(1);
  }

  try {
    await obs.connect(process.env.OBS_ADDRESS);
    console.log(process.env.OBS_PASSWORD);

    await obs.call("SetStudioModeEnabled", {
      studioModeEnabled: true,
    });

    console.log(`✅ Studio Mode enabled.`);

    await obs.call("SetCurrentPreviewScene", {
      sceneName,
    });

    console.log(`✅ Set preview scene to ${sceneName}.`);

    await obs.disconnect();
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}

main();
