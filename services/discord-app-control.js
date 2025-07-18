// services/discord-client-control.js (new script)
const { spawn, execSync } = require("child_process");

function launchDiscord() {
  console.log("🚀 Launching Discord client...");
  // Use env to route Discord audio appropriately
  const env = {
    ...process.env,
    DISPLAY: ":98",
    PULSE_SINK: "discord_sink",
    PULSE_SOURCE: "discord_mic"
  };
  // Launch the Discord client
  const discordProcess = spawn("discord", { env, detached: true, stdio: "ignore" });
  discordProcess.unref();
}
