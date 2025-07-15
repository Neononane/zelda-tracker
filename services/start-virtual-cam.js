import OBSWebSocket from "obs-websocket-js";

const obs = new OBSWebSocket();

async function startVirtualCam() {
  try {
    await obs.connect(process.env.OBS_ADDRESS);
    console.log("Connected to OBS for VirtualCam start.");

    await obs.call("StartVirtualCam");
    console.log("✅ Virtual Camera started in OBS.");

    await obs.disconnect();
  } catch (err) {
    console.error("Failed to start Virtual Camera:", err);
    process.exit(1);
  }
}

startVirtualCam();
