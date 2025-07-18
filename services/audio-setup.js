const { execSync, spawnSync } = require("child_process");
const fs = require("fs");

const RUNTIME_DIR = `/run/user/${process.getuid()}`;
const MAX_STARTUP_ATTEMPTS = 20;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function exportRuntimeEnv() {
  process.env.XDG_RUNTIME_DIR = RUNTIME_DIR;
  process.env.PULSE_RUNTIME_PATH = `${RUNTIME_DIR}/pulse`;
  process.env.DISPLAY = process.env.DISPLAY || ":98";
}

function ensureDBusSession() {
  try {
    const dbusOutput = execSync("dbus-launch").toString();
    dbusOutput.split("\n").filter(line => line.includes("=")).forEach(line => {
      const [key, value] = line.split("=");
      process.env[key.trim()] = value.trim();
    });
    console.log("✅ DBus session started.");
  } catch (err) {
    console.error("❌ Failed to launch DBus:", err.message);
    return false;
  }
  return true;
}

function startPulseAudio() {
  // Try killing existing (non-system-wide) PulseAudio
  try {
    execSync("pulseaudio --check && pulseaudio --kill", { env: process.env });
    console.log("🔁 Restarted existing PulseAudio instance.");
  } catch {
    console.log("ℹ️ No existing PulseAudio to kill.");
  }

  // Ensure directory exists
  if (!fs.existsSync(RUNTIME_DIR)) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  }

  // Start clean
  spawnSync("pulseaudio", [
    "--daemonize=yes",
    "--exit-idle-time=-1",
    "--log-target=stderr",
    "--disallow-exit"
  ], {
    env: process.env,
    stdio: "ignore"
  });

  console.log("🚀 PulseAudio launch attempted.");
}

async function waitForPulseAudioReady() {
  for (let i = 0; i < MAX_STARTUP_ATTEMPTS; i++) {
    try {
      const result = execSync("pactl info", { env: process.env }).toString();
      if (result.includes("Server Name")) {
        console.log("✅ PulseAudio is ready.");
        return true;
      }
    } catch {
      // Silent retry
    }
    await sleep(500);
  }
  console.error("❌ Timeout waiting for PulseAudio.");
  return false;
}

function moduleExists(name, listOutput) {
  return listOutput.includes(name);
}

function loadVirtualModules() {
  const virtualModules = [
    {
      check: "discord_sink",
      cmd: "pactl load-module module-null-sink sink_name=discord_sink sink_properties=device.description=DiscordSink"
    },
    {
      check: "obs_mix_out",
      cmd: "pactl load-module module-null-sink sink_name=obs_mix_out sink_properties=device.description=OBSMixOut"
    },
    {
      check: "discord_mic",
      cmd: "pactl load-module module-remap-source master=discord_sink.monitor source_name=discord_mic source_properties=device.description=DiscordMic"
    }
  ];

  const allModules = execSync("pactl list short modules", { env: process.env }).toString();
  const allSinks = execSync("pactl list short sinks", { env: process.env }).toString();
  const allSources = execSync("pactl list short sources", { env: process.env }).toString();

  for (const { check, cmd } of virtualModules) {
    const exists = moduleExists(check, allModules) || moduleExists(check, allSinks) || moduleExists(check, allSources);
    if (!exists) {
      execSync(cmd, { env: process.env });
      console.log(`✅ Loaded ${check}`);
    } else {
      console.log(`✅ ${check} already exists`);
    }
  }
}

function configureLoopback() {
  const loadedModules = execSync("pactl list short modules", { env: process.env }).toString();
  const loopbackAlreadyExists = loadedModules.includes("module-loopback") && loadedModules.includes("obs_mix_out.monitor");

  if (!loopbackAlreadyExists) {
    execSync("pactl load-module module-loopback source=obs_mix_out.monitor sink=discord_sink latency_msec=20", { env: process.env });
    console.log("✅ Loopback from obs_mix_out.monitor to discord_sink established.");
  } else {
    console.log("✅ Loopback already configured.");
  }
}

function setDefaults() {
  try {
    execSync("pactl set-default-source discord_mic", { env: process.env });
    execSync("pactl set-default-sink obs_mix_out", { env: process.env });
    console.log("✅ Default source → discord_mic | Default sink → obs_mix_out");
  } catch (err) {
    console.error("❌ Failed to set default devices:", err.message);
  }
}

async function ensurePulseAudioHeadless() {
  exportRuntimeEnv();

  if (!ensureDBusSession()) return;

  startPulseAudio();

  const ready = await waitForPulseAudioReady();
  if (!ready) return;

  loadVirtualModules();
  setDefaults();
  configureLoopback();
}

module.exports = {
  ensurePulseAudioHeadless
};
