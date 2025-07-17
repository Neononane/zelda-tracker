const { execSync, spawnSync } = require("child_process");
const fs = require("fs");

const RUNTIME_DIR = "/tmp/pulse-runtime";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensurePulseAudioHeadless() {
  if (!fs.existsSync(RUNTIME_DIR)) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  }

  // Step 1: Start DBus session
  try {
    const dbusOutput = execSync("dbus-launch").toString();
    dbusOutput.split("\n").filter(line => line.includes("=")).forEach(line => {
      const [key, value] = line.split("=");
      process.env[key.trim()] = value.trim();
    });
    console.log("✅ DBus session started.");
  } catch (err) {
    console.error("❌ Failed to launch DBus:", err.message);
    return;
  }

  process.env.XDG_RUNTIME_DIR = RUNTIME_DIR;

  // Step 2: Start PulseAudio
  spawnSync("pulseaudio", [
    "--daemonize=yes",
    "--exit-idle-time=-1",
    "--log-target=stderr",
    "--disallow-exit"
  ], {
    env: process.env,
    stdio: "ignore"
  });
  console.log("🚀 PulseAudio launched in headless mode.");

  // Step 3: Wait for it to be ready
  for (let i = 0; i < 20; i++) {
    try {
      execSync("pactl info", { env: process.env });
      break;
    } catch {
      await sleep(500);
    }
  }

  console.log("✅ PulseAudio ready.");

  // Step 4: Load modules
  const modules = [
    { check: "discord_sink", cmd: "pactl load-module module-null-sink sink_name=discord_sink" },
    { check: "obs_mix_out", cmd: "pactl load-module module-null-sink sink_name=obs_mix_out" },
    { check: "discord_mic", cmd: "pactl load-module module-remap-source master=discord_sink.monitor source_name=discord_mic" }
  ];

  for (const { check, cmd } of modules) {
    if (!execSync("pactl list short").toString().includes(check)) {
      execSync(cmd, { env: process.env });
      console.log(`✅ Loaded ${check}`);
    } else {
      console.log(`✅ ${check} already loaded`);
    }
  }

  // Step 5: Set defaults
  try {
    execSync("pactl set-default-source discord_mic", { env: process.env });
    execSync("pactl set-default-sink obs_mix_out", { env: process.env });
    console.log("✅ Default source → discord_mic | Default sink → obs_mix_out");
  } catch (err) {
    console.error("❌ Failed to set defaults:", err.message);
  }

  // Step 6: Loop obs_mix_out.monitor to discord_sink
    try {
    execSync("pactl load-module module-loopback source=obs_mix_out.monitor sink=discord_sink latency_msec=20", { env: process.env });
    console.log("✅ Loopback from obs_mix_out.monitor to discord_sink established.");
    } catch (err) {
    console.error("❌ Failed to create loopback to discord_sink:", err.message);
    }

}

module.exports = {
  ensurePulseAudioHeadless
};
