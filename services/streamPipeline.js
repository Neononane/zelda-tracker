const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);

async function runStreamPipeline(player1, player2) {
  console.log("Starting twitchFIFOStreams.js...");

  await execAsync(
    `node ./services/twitchFIFOStreams.js ${player1} ${player2}`
  );
  console.log("FIFO Streams script finished.");

  await sleep(10 * 1000);

  console.log("Launching OBS...");
  await execAsync(`obs --multi --obs-port=4455`);
  console.log("OBS launched.");

  await sleep(10 * 1000);

  console.log("Switching to scene 'Scene'...");
  await execAsync(`node ./services/switch-scene.js Scene`);
  await sleep(5 * 1000);

  console.log("Switching audio to Player1...");
  await execAsync(`node ./services/switch-audio.js Player1`);
  await sleep(5 * 1000);

  console.log("Switching to scene 'Intro'...");
  await execAsync(`node ./services/switch-scene.js Intro`);
  await sleep(5 * 1000);

  console.log("Starting OBS stream...");
  await execAsync(`node ./services/start-obs.js`);
  console.log("Stream started.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  runStreamPipeline,
};
