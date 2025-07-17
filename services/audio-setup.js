const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const RUNTIME_DIR = "/tmp/pulse-runtime";
const CONFIG_DIR = "/tmp/pulse-config";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensurePulseAudioHeadless() {
  if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

  process.env.XDG_RUNTIME_DIR = RUNTIME_DIR;
  process.env.PULSE_RUNTIME_PATH = RUNTIME_DIR;
  process.env.PULSE_CONFIG_PATH = CONFIG_DIR;
  process.env.PULSE_STATE_PATH = path.join(RUNTIME_DIR, "state");

  // Launch PulseAudio manually
  try {
    spawn("pulseaudio", [
      "--daemonize=yes",
      "--exit-idle-time=-1",
      `--log-target=stderr`,
      `--disallow-exit`
    ], {
      env: process.env,
      stdio: "ignore",
      detached: true
    });

    console.log("🚀 PulseAudio launched in headless mode.");
  } catch (err) {
    console.error("❌ Failed to start PulseAudio:", err.message);
    return;
  }

  // Retry for a few seconds until PulseAudio is ready
  let ready = false;
  for (let i = 0; i < 10; i++) {
    try {
      execSync("pactl info", { env: process.env });
      ready = true;
      break;
    } catch {
      await sleep(500);
    }
  }

  if (!ready) {
    console.error("❌ PulseAudio did not become ready in time.");
    return;
  }

  console.log("✅ PulseAudio ready.");

  const MODULES = [
    { name: "module-null-sink", args: "sink_name=discord_sink", check: "discord_sink" },
    { name: "module-null-sink", args: "sink_name=obs_mix_out", check: "obs_mix_out" },
    { name: "module-remap-source", args: "master=discord_sink.monitor source_name=discord_mic", check: "discord_mic" }
  ];

  const moduleList = execSync("pactl list short modules", { env: process.env }).toString();

  for (const { name, args, check } of MODULES) {
    if (!moduleList.includes(check)) {
      try {
        execSync(`pactl load-module ${name} ${args}`, { env: process.env });
        console.log(`✅ Loaded module: ${check}`);
      } catch (err) {
        console.error(`❌ Failed to load module ${check}:`, err.message);
      }
    } else {
      console.log(`✅ Module ${check} already loaded.`);
    }
  }

  // Set default source
  try {
    execSync("pactl set-default-source discord_mic", { env: process.env });
    console.log("✅ Set default source to discord_mic.");
  } catch (err) {
    console.error("❌ Failed to set default source:", err.message);
  }
}

module.exports = {
  ensurePulseAudioHeadless
};
