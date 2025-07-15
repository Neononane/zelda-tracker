import OBSWebSocket from "obs-websocket-js";

const obs = new OBSWebSocket();

async function connectOBSAndAddStream(twitchChannel) {
  try {
    await obs.connect(process.env.OBS_ADDRESS);
    console.log("Connected to OBS!");

    // Check if streaming
    const streamingStatus = await obs.call("GetStreamStatus");

    if (streamingStatus.outputActive) {
      console.log("OBS output already running. Skipping video settings change.");
    } else {
      console.log("No outputs active. Good to proceed...");
      // await obs.call("SetVideoSettings", {
      //   baseWidth: 1280,
      //   baseHeight: 720,
      //   outputWidth: 1280,
      //   outputHeight: 720,
      //   fpsNumerator: 30,
      //   fpsDenominator: 1
      // });
    }

    // Handle stream key selection
    if (!twitchChannel) {
      console.log("No Twitch channel provided. Defaulting to DEV.");
      twitchChannel = "DEV";
    }

    const envVarName = `${twitchChannel}_TWITCH_KEY`;
    const streamKey = process.env[envVarName];

    if (!streamKey) {
      throw new Error(`No stream key found for channel: ${twitchChannel}`);
    }

    console.log(`Using stream key for channel: ${twitchChannel}`);

    await obs.call("SetStreamServiceSettings", {
      streamServiceType: "rtmp_custom",
      streamServiceSettings: {
        server: "rtmp://live.twitch.tv/app/",
        key: streamKey,
        use_auth: false
      }
    });

    console.log("Stream settings updated!");

    // Start streaming
    await obs.call("StartStream");
    console.log("Streaming started!");

  } catch (error) {
    console.error("Error connecting to OBS:", error);
    process.exit(1);
  }
}

// -----------------------------------------------
// Execute immediately if run via CLI
// -----------------------------------------------

const twitchChannelArg = process.argv[2];
connectOBSAndAddStream(twitchChannelArg);
