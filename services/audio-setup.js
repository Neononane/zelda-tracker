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

  // Step 1: Start a DBus session
  let dbusOutput;
  try {
    dbusOutput = execSync("dbus-launch").toString();
    const dbusVars = dbusOutput.split("\n").filter(line => line.includes("="));
    for (const line of dbusVars) {
      const [key, value] = line.split("=");
      process.env[key.trim()] = value.trim();
    }
    console.log("✅ DBus session started.");
  } catch (err) {
    console.error("❌ Failed to launch DBus:", err.message);
    return;
  }

  // Step 2: Set runtime vars
  process.env.XDG_RUNTIME_DIR = RUNTIME_DIR;

  // Step 3: Start PulseAudio
  try {
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
  } catch (err) {
    console.error("❌ Failed to start PulseAudio:", err.message);
    return;
  }

  // Step 4: Wait until pactl responds
  let ready = false;
  for (let i = 0; i < 20; i++) {
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

  // Step 5: Load modules
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

  try {
    execSync("pactl set-default-source discord_mic", { env: process.env });
    console.log("✅ Set default source to discord_mic.");
    execSync("pactl set-default-sink obs_mix_out", { env: process.env });
    console.log("✅ Set default sink to obs_mix_out.");
  } catch (err) {
    console.error("❌ Failed to set default source:", err.message);
  }
}

module.exports = {
  ensurePulseAudioHeadless
};
