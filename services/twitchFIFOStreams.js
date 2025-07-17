#!/usr/bin/env node

const { spawn, execSync } = require("child_process");
const fs = require("fs");

// --- Parse CLI arguments ---
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error("Usage: node twitchFifoStreams.js <twitch_user1> <twitch_user2>");
  process.exit(1);
}

const player1 = args[0];
const player2 = args[1];

const fifo1 = "/tmp/player1.ts";
const fifo2 = "/tmp/player2.ts";

console.log(`Launching streams for:
- Player 1: ${player1} -> ${fifo1}
- Player 2: ${player2} -> ${fifo2}
`);

// --- Helper to safely create a FIFO ---
function createFIFO(path) {
  try {
    if (fs.existsSync(path)) {
      console.log(`Removing existing FIFO: ${path}`);
      fs.unlinkSync(path);
    }
    console.log(`Creating FIFO: ${path}`);
    execSync(`mkfifo ${path}`);
  } catch (err) {
    console.error(`Error creating FIFO ${path}:`, err);
    process.exit(1);
  }
}

// --- Create both FIFOs ---
createFIFO(fifo1);
createFIFO(fifo2);

// --- Function to start a Streamlink process ---
function startStreamToFIFO(twitchName, fifoPath) {
  console.log(`Starting Streamlink for ${twitchName}...`);

  const streamlink = spawn(
    "streamlink",
    [`https://twitch.tv/${twitchName}`, "best", "-O"],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  const writeStream = fs.createWriteStream(fifoPath);

  writeStream.on("error", (err) => {
    if (err.code === "EPIPE") {
      console.warn(`[${twitchName}] FIFO write error: Broken pipe (EPIPE).`);
    } else {
      console.error(`[${twitchName}] WriteStream error:`, err);
    }
  });

  streamlink.stdout.pipe(writeStream);

  streamlink.stderr.on("data", (data) => {
    console.error(`[${twitchName} stderr] ${data.toString()}`);
  });

  streamlink.on("close", (code) => {
    console.log(`[${twitchName}] Streamlink exited with code ${code}`);
    writeStream.end();
  });

  return streamlink;
}

// --- Launch both streams ---
const stream1 = startStreamToFIFO(player1, fifo1);
const stream2 = startStreamToFIFO(player2, fifo2);
