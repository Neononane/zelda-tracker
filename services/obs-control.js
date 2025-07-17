
const { execSync } = require("child_process");
const OBSWebSocket = require("obs-websocket-js").default;

async function stopOBS() {
  const obs = new OBSWebSocket();

  try {
    await obs.connect(process.env.OBS_ADDRESS, process.env.OBS_PASSWORD || undefined);
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

    // Request graceful shutdown of OBS
    console.log("Closing OBS...");
    await obs.call("Shutdown");
    console.log("✅ OBS shutdown requested.");

    // Give it a few seconds to exit gracefully
    setTimeout(() => {
      try {
        console.warn("⏱ Checking if OBS is still running... attempting pkill as fallback.");
        execSync("pkill obs || true");
        console.log("✅ pkill fallback executed.");
      } catch (pkillErr) {
        console.error("⚠️ pkill fallback failed:", pkillErr.message);
      }
    }, 5000);
  } catch (err) {
    console.error("Failed to shut down OBS:", err);
    throw err;
  }
}

module.exports = { stopOBS };
