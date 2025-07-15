const { execSync } = require("child_process");

async function stopStreamlink() {
  try {
    console.log("Looking for streamlink processes...");

    const result = execSync(`pgrep -f streamlink || true`, { encoding: "utf-8" });
    const pids = result
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    if (pids.length === 0) {
      console.log("✅ No streamlink processes running.");
      return;
    }

    for (const pid of pids) {
      console.log(`Killing streamlink process ${pid}...`);
      execSync(`kill -9 ${pid}`);
      console.log(`✅ Killed streamlink process ${pid}`);
    }
  } catch (err) {
    console.error("Failed to stop streamlink:", err);
    throw err;
  }
}

module.exports = { stopStreamlink };
