const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const RUNTIME_DIR = "/tmp/pulse-runtime";
const MODULES = [
  { name: "module-null-sink", args: "sink_name=discord_sink", check: "discord_sink" },
  { name: "module-null-sink", args: "sink_name=obs_mix_out", check: "obs_mix_out" },
  { name: "module-remap-source", args: "master=discord_sink.monitor source_name=discord_mic", check: "discord_mic" }
];

function ensurePulseAudioHeadless() {
  // Step 1: Set and export XDG_RUNTIME_DIR
  if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  process.env.XDG_RUNTIME_DIR = RUNTIME_DIR;

  // Step 2: Start PulseAudio if not running
  try {
    execSync("pulseaudio --check || pulseaudio --start --exit-idle-time=-1", {
      env: process.env,
      stdio: "ignore"
    });
    console.log("✅ PulseAudio started or already running.");
  } catch (err) {
    console.error("❌ Failed to start PulseAudio:", err.message);
  }

  // Step 3: Load required modules if not already loaded
  try {
    const moduleList = execSync("pactl list short modules", { env: process.env }).toString();
    MODULES.forEach(({ name, args, check }) => {
      if (!moduleList.includes(check)) {
        console.log(`🔧 Loading module: ${check}`);
        execSync(`pactl load-module ${name} ${args}`, { env: process.env });
        console.log(`✅ Module ${check} loaded.`);
      } else {
        console.log(`✅ Module ${check} already loaded.`);
      }
    });
  } catch (err) {
    console.error("❌ Failed to load PulseAudio modules:", err.message);
  }

  // Step 4: Set default source to discord_mic
  try {
    execSync("pactl set-default-source discord_mic", { env: process.env });
    console.log("✅ Default source set to discord_mic.");
  } catch (err) {
    console.error("❌ Failed to set default source:", err.message);
  }
}

module.exports = {
  ensurePulseAudioHeadless
};
