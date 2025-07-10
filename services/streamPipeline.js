const { spawn } = require("child_process");
const util = require("util");
const execAsync = util.promisify(require("child_process").exec);

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
  await sleep(10 * 1000);

  launchOBS();
  await sleep(10 * 1000);

  console.log("🚀 Switching scene...");
  await execAsync(`node ./services/switch-scene.js Scene`);
  await sleep(5 * 1000);

  console.log("🚀 Switching audio...");
  await execAsync(`node ./services/switch-audio.js Player1`);
  await sleep(5 * 1000);

  console.log("🚀 Switching scene to Intro...");
  await execAsync(`node ./services/switch-scene.js Intro`);
  await sleep(5 * 1000);

  console.log("🚀 Starting OBS stream...");
  await execAsync(`node ./services/start-obs.js`);
  console.log("✅ Stream pipeline complete!");
}

module.exports = { runStreamPipeline };
