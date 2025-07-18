const { execSync, spawnSync, spawn } = require("child_process");
const fs = require("fs");

function getPulseRuntimePath() {
  const uid = process.getuid();
  return `/run/user/${uid}/pulse`;
}

function waitForOBSWindow(maxAttempts = 20) {
  const displayEnv = { DISPLAY: ":98" };

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = execSync(`xdotool search --name "OBS"`, { env: displayEnv });
      const winId = result.toString().trim();
      if (winId) return winId;
    } catch {
      // Window not found yet
    }
    execSync("sleep 1");
  }
  return null;
}

function launchOBS() {
  const pulsePath = getPulseRuntimePath();
  if (!fs.existsSync(`${pulsePath}/native`)) {
    console.error("❌ PulseAudio native socket not found.");
    process.exit(1);
  }

  console.log("🚀 Launching OBS with PulseAudio + Xvfb integration...");
  const obs = spawn(
    "env",
    [
      `DISPLAY=:98`,
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

  console.log("🕒 Waiting for OBS to start...");
  const winId = waitForOBSWindow();

  if (!winId) {
    console.error("❌ Could not find OBS window after timeout.");
    return;
  }

  console.log(`✅ OBS window found: ${winId}`);
  console.log("🎬 Sending Ctrl+P to launch projector...");
  try {
    execSync(`xdotool windowactivate --sync ${winId} key --clearmodifiers ctrl+p`, {
      env: { DISPLAY: ":98" }
    });
    console.log("✅ Projector triggered.");
  } catch (err) {
    console.error("❌ Failed to send Ctrl+P to OBS:", err.message);
  }
}

launchOBS();
