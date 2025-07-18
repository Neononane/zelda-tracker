const { spawn } = require("child_process");
const util = require("util");
const execAsync = util.promisify(require("child_process").exec);
const { startDiscord, stopDiscord } = require("./discord-control.js");
const maxRetries = 30;
const retryDelay = 2000;
const { ensurePulseAudioHeadless, ensurePipeWireAudio } = require('./audio-setup');
const path = require("path");
const os = require("os");

const OBSWebSocket = require("obs-websocket-js").default;

async function setOBSVideoSettings() {
  const obs = new OBSWebSocket();

  try {
    const isConnected = await connectToOBS();
    if (isConnected){
      await obs.connect(process.env.OBS_ADDRESS);
      console.log("✅ Connected to OBS for video settings.");

      await obs.call("SetVideoSettings", {
        baseWidth: 1280,
        baseHeight: 720,
        outputWidth: 1280,
        outputHeight: 720,
        fpsNumerator: 30,
        fpsDenominator: 1
      });

      console.log("✅ Video settings applied in OBS.");
      await obs.disconnect();
    }
  } catch (err) {
    console.error("❌ Failed to set video settings in OBS:", err);
    process.exit(1);
  }
}



function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function connectToOBS(retries = maxRetries) {
  const obs = new OBSWebSocket();
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempting to connect to OBS WebSocket (Attempt ${attempt}/${retries})...`);
      
      // Attempt to connect
      await obs.connect(process.env.OBS_ADDRESS, process.env.OBS_PASSWORD, {
        rpcVersion: 1 // Ensure compatibility with OBS WebSocket 5.x
      });
      
      console.log('Connected to OBS WebSocket successfully!');
      
      // Verify connection by requesting OBS version
      const version = await obs.call('GetVersion');
      console.log('OBS WebSocket Version:', version.obsWebSocketVersion);
      
      return true; // Connection successful
    } catch (error) {
      console.error(`Connection attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === retries) {
        console.error('Max retries reached. Could not connect to OBS.');
        return false;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

async function launchOBS() {
  console.log("🚀 Launching OBS...");

  await execAsync(`node ./services/launchOBSwithAudio.js`);
}

function startXvfb() {
  console.log("🚀 Launching Xvfb on :98...");

  const xvfb = spawn("Xvfb", [":98", "-screen", "0", "1920x1080x24", "-ac"], {
    detached: true,
    stdio: "ignore"
  });
  xvfb.unref();

  process.env.DISPLAY = ":98";

  console.log("🎛️  Starting openbox window manager...");
  const openbox = spawn("openbox", [], {
    env: process.env,
    detached: true,
    stdio: "ignore"
  });
  openbox.unref();

  const vncPasswordFile = path.join(os.homedir(), ".vnc", "passwd");

  console.log("🖥️  Starting x11vnc server with password...");
  const vnc = spawn("x11vnc", [
    "-display", ":98",
    "-rfbauth", vncPasswordFile,
    "-forever",
    "-shared",
    "-rfbport", "5900"
  ], {
    env: process.env,
    detached: true,
    stdio: "ignore"
  });
  vnc.unref();

  console.log("✅ Xvfb, openbox, and x11vnc are running on DISPLAY=:98 (VNC on port 5900)");
}

function startTwitchFIFOStreams(player1, player2) {
  console.log("🚀 Launching twitchFIFOStreams.js...");

  const child = spawn(
    "node",
    ["./services/twitchFIFOStreams.js", player1, player2],
    {
      detached: true,
      stdio: "inherit",
    }
  );

  child.unref();
}

async function runStreamPipeline(player1, player2, raceName) {
  await ensurePipeWireAudio();
  console.log("🚀 Setting audio settings on server...");
  await sleep(1 * 1000);
  
  startTwitchFIFOStreams(player1, player2);
  await sleep(15 * 1000);

  startXvfb();
  await sleep(5 * 1000);

  await launchOBS();
  console.log("Awaiting 10 seconds for all settings to take hold..");
  await sleep(10 * 1000);

  console.log("🚀 Setting video settings in OBS...");
  await setOBSVideoSettings();
  await sleep (1 * 1000);

  console.log("🚀 Setting preview scene to Scene...");
  await execAsync(`node ./services/set-preview-scene.js Scene`);
  await sleep(5 * 1000);


  console.log("🚀 Switching scene...");
  await execAsync(`node ./services/switch-scene.js Scene`);
  await sleep(15 * 1000);

  console.log("🚀 Switching audio...");
  await execAsync(`node ./services/switch-audio.js Player1`);
  await sleep(5 * 1000);

  console.log("🚀 Enabling microphone...");
  await execAsync(`node ./services/toggleGlobalAudio.js "Mic/Aux 2" false`);
  await sleep(5 * 1000);

  console.log("🚀 Switching scene to Intro...");
  await execAsync(`node ./services/switch-scene.js Intro`);
  await sleep(5 * 1000);

  console.log("🚀 Updating race title...");
  await execAsync(`node ./services/set-match-info.js "${raceName}"`);
  await sleep(5 * 1000);

  console.log("🚀 Starting Virtual Camera...");
  await execAsync(`node ./services/start-virtual-cam.js`);
  await sleep(5 * 1000);

/*   console.log("🚀 Starting Discord automation...");
  try {
    await startDiscord();
    console.log("✅ Discord automation complete.");
  } catch (err) {
    console.error("❌ Discord automation failed:", err);
    console.log("Aborting pipeline!");
    return;
  }
  await sleep(5 * 1000); */


  // console.log("🚀 Starting OBS stream...");
  // execAsync(`node ./services/start-obs.js`);
  // console.log("✅ Stream pipeline complete!");
}

module.exports = { runStreamPipeline };
