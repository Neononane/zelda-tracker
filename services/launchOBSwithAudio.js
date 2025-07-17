const { execSync, spawn } = require("child_process");
const fs = require("fs");

function runCommand(command) {
  try {
    return execSync(command, { encoding: "utf-8" });
  } catch (e) {
    console.error(`Command failed: ${command}\n`, e.stderr || e.message);
    return null;
  }
}

function ensureSinkExists(name, description) {
  const sinks = runCommand("pactl list short sinks") || "";
  if (!sinks.includes(name)) {
    console.log(`Creating ${name}...`);
    runCommand(`pactl load-module module-null-sink sink_name=${name} sink_properties=device.description=${description}`);
  } else {
    console.log(`${name} already exists.`);
  }
}

function ensureRemapSourceExists(sourceName, master) {
  const sources = runCommand("pactl list short sources") || "";
  if (!sources.includes(sourceName)) {
    console.log(`Creating ${sourceName}...`);
    runCommand(`pactl load-module module-remap-source master=${master} source_name=${sourceName}`);
  } else {
    console.log(`${sourceName} already exists.`);
  }
}

function waitForMonitor(name, timeoutSeconds = 5) {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < timeoutSeconds) {
    const sources = runCommand("pactl list short sources") || "";
    if (sources.includes(name)) {
      console.log(`✅ ${name} is ready.`);
      return true;
    }
    console.log(`⏳ Waiting for ${name}...`);
    execSync("sleep 0.5");
  }
  console.error(`❌ ${name} did not become ready in time.`);
  process.exit(1);
}

function getPulseRuntimePath() {
  const uid = process.getuid();
  return `/run/user/${uid}/pulse`;
}

function launchOBS() {
  const pulsePath = getPulseRuntimePath();
  if (!fs.existsSync(`${pulsePath}/native`)) {
    console.error("❌ PulseAudio native socket not found. PulseAudio may not be running.");
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

function main() {
  ensureSinkExists("obs_mix_out", "obs_mix_out");
  ensureSinkExists("discord_sink", "discord_sink");
  ensureRemapSourceExists("discord_mic", "discord_sink.monitor");
  waitForMonitor("discord_sink.monitor");
  launchOBS();
}

main();
