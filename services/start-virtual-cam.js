import OBSWebSocket from "obs-websocket-js";

const obs = new OBSWebSocket();

async function startVirtualCam() {
  try {
    await obs.connect(process.env.OBS_ADDRESS);
    console.log("Connected to OBS for VirtualCam check/start.");

    // Check initial status
    let status = await obs.call("GetVirtualCamStatus");
    console.log("VirtualCam initially active?", status.outputActive);

    if (!status.outputActive) {
      console.log("VirtualCam not active. Starting it...");
      await obs.call("StartVirtualCam");
    } else {
      console.log("VirtualCam already running.");
    }

    // Wait until VirtualCam is confirmed active
    let retries = 60;
    let delayMs = 1000;

    while (retries > 0) {
      status = await obs.call("GetVirtualCamStatus");

      if (status.outputActive) {
        console.log("✅ Virtual Camera is running.");
        break;
      } else {
        console.log("Waiting for VirtualCam to become active...");
        await new Promise((res) => setTimeout(res, delayMs));
        retries--;
      }
    }

    if (!status.outputActive) {
      console.error("❌ VirtualCam did not start after waiting.");
      process.exit(1);
    }

    await obs.disconnect();
    console.log("Disconnected from OBS.");
  } catch (err) {
    console.error("Failed to start Virtual Camera:", err);
    process.exit(1);
  }
}

startVirtualCam();
