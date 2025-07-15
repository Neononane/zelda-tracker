const { spawn } = require("child_process");
const util = require("util");
const execAsync = util.promisify(require("child_process").exec);
const { startDiscord, stopDiscord } = require("./discord-control.js");

const OBSWebSocket = require("obs-websocket-js");

async function setOBSVideoSettings() {
  const obs = new OBSWebSocket();

  try {
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
  } catch (err) {
    console.error("❌ Failed to set video settings in OBS:", err);
    process.exit(1);
  }
}



function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function launchOBS() {
  console.log("🚀 Launching OBS...");

  const obsProcess = spawn(
    "obs",
    ["--multi", "--obs-port=4455"],
    {
      detached: true,
      stdio: "ignore"
    }
  );

  obsProcess.unref();
}

function startXvfb() {
  console.log("🚀 Launching Xvfb...");

  const xvfb = spawn(
    "Xvfb",
    [":98", "-screen", "0", "1920x1080x24", "-ac"],
    { detached: true, stdio: "ignore" }
  );
  xvfb.unref();

  process.env.DISPLAY = ":98";
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

async function runStreamPipeline(player1, player2) {
  startTwitchFIFOStreams(player1, player2);
  await sleep(15 * 1000);

  startXvfb();
  await sleep(5 * 1000);

  launchOBS();
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

  console.log("🚀 Switching scene to Intro...");
  await execAsync(`node ./services/switch-scene.js Intro`);
  await sleep(5 * 1000);

  console.log("🚀 Starting Virtual Camera...");
  await execAsync(`node ./services/start-virtual-cam.js`);
  await sleep(5 * 1000);

  console.log("🚀 Starting Discord automation...");
  try {
    await startDiscord();
    console.log("✅ Discord automation complete.");
  } catch (err) {
    console.error("❌ Discord automation failed:", err);
    console.log("Aborting pipeline!");
    return;
  }
  await sleep(5 * 1000);


  console.log("🚀 Starting OBS stream...");
  execAsync(`node ./services/start-obs.js`);
  console.log("✅ Stream pipeline complete!");
}

module.exports = { runStreamPipeline };
