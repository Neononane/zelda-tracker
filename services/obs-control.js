
const { execSync } = require("child_process");
const OBSWebSocket = require("obs-websocket-js").default;

async function stopOBS() {
  const obs = new OBSWebSocket();

  try {
    await obs.connect(process.env.OBS_ADDRESS);
    console.log("✅ Connected to OBS for shutdown.");

    const streamingStatus = await obs.call("GetStreamStatus");
    if (streamingStatus.outputActive) {
      console.log("Stopping streaming output...");
      await obs.call("StopStream");
      console.log("✅ OBS streaming stopped.");
    } else {
      console.log("OBS streaming was not active.");
    }

    const virtualCamStatus = await obs.call("GetVirtualCamStatus");
    if (virtualCamStatus.outputActive) {
      console.log("Stopping virtual camera...");
      await obs.call("StopVirtualCam");
      console.log("✅ OBS virtual cam stopped.");
    } else {
      console.log("Virtual cam was not running.");
    }
    //execSync(`pkill streamlink`);
    await obs.disconnect();
    console.log("✅ OBS shutdown complete.");
  } catch (err) {
    console.error("Failed to shut down OBS:", err);
    throw err;
  }
}

module.exports = { stopOBS };
