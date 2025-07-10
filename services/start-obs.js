import OBSWebSocket from "obs-websocket-js";

const obs = new OBSWebSocket();

async function connectOBSAndAddStream() {
  try {
    await obs.connect("ws://localhost:4455");
    console.log("Connected to OBS!");

    // Check if streaming
    const streamingStatus = await obs.call("GetStreamStatus");

    if (streamingStatus.outputActive) {
      console.log("Stream is running. Stopping it first...");
      await obs.call("StopStream");
      console.log("Stream stopped.");
    } else {
      console.log("Stream is not running. Good to proceed.");
    }

await obs.call("SetVideoSettings", {
  baseWidth: 1280,
  baseHeight: 720,
  outputWidth: 1280,
  outputHeight: 720,
  fpsNumerator: 30,
  fpsDenominator: 1
});
	

    // Update stream settings
    await obs.call("SetStreamServiceSettings", {
      streamServiceType: "rtmp_custom",
      streamServiceSettings: {
        server: "rtmp://live.twitch.tv/app/",
        key: "live_1328725455_4WHgEh0WGn35vGDMGo4e6YtZBEEMT2",
        use_auth: false
      }
    });

    console.log("Stream settings updated!");

    // Start streaming
    await obs.call("StartStream");
    console.log("Streaming started!");

  } catch (error) {
    console.error("Error connecting to OBS:", error);
  }
}

connectOBSAndAddStream();
