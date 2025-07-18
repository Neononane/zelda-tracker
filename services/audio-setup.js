const { execSync } = require("child_process");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensurePipeWireAudio() {
  console.log("🔄 Ensuring PipeWire is active...");

  // Test PipeWire availability
  try {
    const info = execSync("pactl info").toString();
    if (!info.includes("Server Name: PulseAudio (on PipeWire")) {
      console.warn("⚠️ PipeWire is not active as PulseAudio replacement.");
      console.warn("You may need to reboot after installing pipewire-pulse.");
      return;
    }
    console.log("✅ PipeWire audio is active.");
  } catch (err) {
    console.error("❌ 'pactl' failed. Is PipeWire running?");
    return;
  }

  // Step 1: Load virtual devices if not present
  const virtualModules = [
    {
      name: "discord_sink",
      cmd: "pactl load-module module-null-sink sink_name=discord_sink sink_properties=device.description=DiscordSink"
    },
    {
      name: "obs_mix_out",
      cmd: "pactl load-module module-null-sink sink_name=obs_mix_out sink_properties=device.description=OBSMixOut"
    },
    {
      name: "discord_mic",
      cmd: "pactl load-module module-remap-source master=discord_sink.monitor source_name=discord_mic source_properties=device.description=DiscordMic"
    }
  ];

  const shortSources = execSync("pactl list short sources").toString();
  const shortSinks = execSync("pactl list short sinks").toString();

  for (const { name, cmd } of virtualModules) {
    const alreadyExists = shortSources.includes(name) || shortSinks.includes(name);
    if (!alreadyExists) {
      execSync(cmd);
      console.log(`✅ Loaded ${name}`);
    } else {
      console.log(`✅ ${name} already exists`);
    }
  }

  // Step 2: Set defaults
  try {
    execSync("pactl set-default-source discord_mic");
    execSync("pactl set-default-sink obs_mix_out");
    console.log("🎚️ Defaults set: source → discord_mic, sink → obs_mix_out");
  } catch (err) {
    console.error("❌ Failed to set default input/output:", err.message);
  }

  // Step 3: Ensure OBS audio is routed to Discord
  try {
    const modules = execSync("pactl list short modules").toString();
    if (!modules.includes("module-loopback") || !modules.includes("obs_mix_out.monitor")) {
      execSync("pactl load-module module-loopback source=obs_mix_out.monitor sink=discord_sink latency_msec=20");
      console.log("🔁 Loopback from obs_mix_out.monitor → discord_sink enabled");
    } else {
      console.log("🔁 Loopback already active");
    }
  } catch (err) {
    console.error("❌ Failed to create loopback:", err.message);
  }
}

module.exports = {
  ensurePipeWireAudio
};
