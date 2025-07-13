const express = require("express");
const obsRouter = express.Router();
const { spawn } = require("child_process");
const OBSWebSocket = require("obs-websocket-js").default;
const obs = new OBSWebSocket();
const sqlite3 = require("sqlite3").verbose();




obsRouter.get("/:raceId", async (req, res) => {
  const raceId = req.params.raceId;
  const trackerDb = new sqlite3.Database("./data/tracker.db");
  const playersDb = new sqlite3.Database("./data/players.db");

  trackerDb.all(
    `SELECT backend_name, display_name FROM players WHERE race_id = ?`,
    [raceId],
    async (err, trackerRows) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Database error fetching race players.");
      }

      if (!trackerRows || trackerRows.length === 0) {
        trackerDb.close();
        return res.render("restream.ejs", {
          raceId,
          players: [],
          scenes: [],
        });
      }

      const enrichedPlayers = [];

      for (let i = 0; i < trackerRows.length; i++) {
        const row = trackerRows[i];
        const backendName = row.backend_name;
        const displayName = row.display_name || backendName;

        // Determine obs_source_name
        const obsSourceName = `Player${i + 1}`;

        await new Promise((resolve) => {
          playersDb.get(
            `SELECT twitch_name FROM library_players WHERE internal_name = ?`,
            [backendName],
            (err, libRow) => {
              if (err) {
                console.error(err);
                enrichedPlayers.push({
                  playerKey: `player${i + 1}`,
                  backend_name: backendName,
                  display_name: displayName,
                  twitch_name: null,
                  obs_source_name: obsSourceName
                });
                return resolve();
              }

              enrichedPlayers.push({
                playerKey: `player${i + 1}`,
                backend_name: backendName,
                display_name: displayName,
                twitch_name: libRow ? libRow.twitch_name : null,
                obs_source_name: obsSourceName
              });
              resolve();
            }
          );
        });
      }

      playersDb.close();
      trackerDb.close();

      let scenes = [];
      try {
        await obs.connect("ws://127.0.0.1:4455");
        const result = await obs.call("GetSceneList");
        scenes = result.scenes.map((scene) => scene.sceneName);
        obs.disconnect();
      } catch (e) {
        console.error("Could not fetch scenes from OBS:", e.message);
      }

      res.render("restream.ejs", {
        raceId,
        players: enrichedPlayers,
        scenes,
      });
    }
  );
});


obsRouter.post("/adjust-volume", (req, res) => {
  const player = req.body.player;
  const delta = req.body.delta;

  const child = spawn("node", ["./services/adjust-volume.js", delta.toString()], {
    stdio: "inherit"
  });
  child.on("close", () => res.json({ success: true }));
});

obsRouter.post("/switch-audio", (req, res) => {
  const player = req.body.player;

  const child = spawn("node", ["./services/switch-audio.js", player], {
    stdio: "inherit"
  });
  child.on("close", () => res.json({ success: true }));
});

obsRouter.post("/switch-scene", (req, res) => {
  const scene = req.body.scene;

  const child = spawn("node", ["./services/switch-scene.js", scene], {
    stdio: "inherit"
  });
  child.on("close", () => res.json({ success: true }));
});

obsRouter.get("/api/:raceId", async (req, res) => {
  const raceId = req.params.raceId;
  const trackerDb = new sqlite3.Database("./data/tracker.db");
  const playersDb = new sqlite3.Database("./data/players.db");

  trackerDb.all(
    `SELECT backend_name, display_name FROM players WHERE race_id = ?`,
    [raceId],
    async (err, trackerRows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error fetching race players." });
      }

      if (!trackerRows || trackerRows.length === 0) {
        trackerDb.close();
        playersDb.close();
        return res.json({ players: [] });
      }

      const enrichedPlayers = [];

      for (const row of trackerRows) {
        const backendName = row.backend_name;
        const displayName = row.display_name || backendName;

        await new Promise((resolve) => {
          playersDb.get(
            `SELECT twitch_name FROM library_players WHERE internal_name = ?`,
            [backendName],
            (err, libRow) => {
              if (err) {
                console.error(err);
                enrichedPlayers.push({
                  backend_name: backendName,
                  display_name: displayName,
                  twitch_name: null,
                  obs_source_name: backendName, // fallback
                });
                return resolve();
              }

              enrichedPlayers.push({
                backend_name: backendName,
                display_name: displayName,
                twitch_name: libRow ? libRow.twitch_name : null,
                obs_source_name: backendName, // adjust if you want Player1, Player2 etc
              });
              resolve();
            }
          );
        });
      }

      playersDb.close();
      trackerDb.close();

      res.json({ players: enrichedPlayers });
    }
  );
});

module.exports = obsRouter;