const { execSync, spawn } = require("child_process");

function runCommand(command) {
  try {
    return execSync(command, { encoding: "utf-8" });
  } catch (e) {
    console.error(`Command failed: ${command}\n`, e.stderr || e.message);
    return null;
  }
}

function ensurePulseAudioRunning() {
  const status = runCommand("pulseaudio --check");
  if (status === null) {
    console.log("Starting PulseAudio...");
    runCommand("pulseaudio --start");
  } else {
    console.log("PulseAudio already running.");
  }
}

function ensureDiscordSinkExists() {
  const sinks = runCommand("pactl list short sinks") || "";
  if (!sinks.includes("discord_sink")) {
    console.log("Creating discord_sink...");
    runCommand("pactl load-module module-null-sink sink_name=discord_sink sink_properties=device.description=discord_sink");
  } else {
    console.log("discord_sink already exists.");
  }
}

function ensureDiscordMicExists() {
  const sources = runCommand("pactl list short sources") || "";
  if (!sources.includes("discord_mic")) {
    console.log("Creating discord_mic...");
    runCommand("pactl load-module module-remap-source master=discord_sink.monitor source_name=discord_mic");
  } else {
    console.log("discord_mic already exists.");
  }
}

function waitForSinkMonitor(timeoutSeconds = 5) {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < timeoutSeconds) {
    const sources = runCommand("pactl list short sources") || "";
    if (sources.includes("discord_sink.monitor")) {
      console.log("✅ discord_sink.monitor is ready.");
      return true;
    }
    console.log("⏳ Waiting for discord_sink.monitor...");
    require("child_process").execSync("sleep 0.5");
  }
  console.error("❌ discord_sink.monitor did not become ready in time.");
  process.exit(1);
}

function launchOBS() {
  console.log("🚀 Launching OBS...");
  const obs = spawn("obs", ["--multi", "--obs-port=4455"], {
    detached: true,
    stdio: "ignore",
  });
  obs.unref();
}

function main() {
  ensurePulseAudioRunning();
  ensureDiscordSinkExists();
  ensureDiscordMicExists();
  waitForSinkMonitor();
  launchOBS();
}

main();
