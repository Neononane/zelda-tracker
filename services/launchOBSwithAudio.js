const { execSync, spawn } = require("child_process");
const fs = require("fs");

function getPulseRuntimePath() {
  const uid = process.getuid();
  return `/run/user/${uid}/pulse`;
}

function launchOBS() {
  const pulsePath = getPulseRuntimePath();
  if (!fs.existsSync(`${pulsePath}/native`)) {
    console.error("❌ PulseAudio native socket not found.");
    process.exit(1);
  }

  console.log("🚀 Launching OBS with PulseAudio integration...");
  const obs = spawn(
    "env",
    [
      `PULSE_RUNTIME_PATH=${pulsePath}`,
      `PULSE_SINK=obs_mix_out`,
      "obs",
      "--multi",
      "--obs-port=4455"
    ],
    {
      detached: true,
      stdio: "ignore",
      shell: true
    }
  );
  obs.unref();
}

launchOBS();
