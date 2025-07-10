const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const { runStreamPipeline } = require("../services/streamPipeline");

router.post("/start-stream/:raceId", async (req, res) => {
  const raceId = req.params.raceId;

  try {
    const dbRaces = new sqlite3.Database("./data/tracker.db");
    const dbPlayers = new sqlite3.Database("./data/players.db");

    // STEP 1 — load players from the race
    dbRaces.all(
      `SELECT backend_name
       FROM players
       WHERE race_id = ?
       ORDER BY player_id
       LIMIT 2`,
      [raceId],
      async (err, rows) => {
        if (err) {
          console.error(err);
          return res
            .status(500)
            .json({ error: "DB error fetching race players" });
        }

        if (!rows || rows.length < 2) {
          return res
            .status(400)
            .json({ error: "Not enough players assigned for this race." });
        }

        const backendNames = rows.map((r) => r.backend_name);

        // STEP 2 — look up Twitch names in players.sqlite3
        const twitchNames = [];

        for (const backendName of backendNames) {
          const twitchName = await getTwitchName(
            dbPlayers,
            backendName
          );
          if (!twitchName) {
            return res.status(400).json({
              error: `Could not find twitch_name for player ${backendName}`,
            });
          }
          twitchNames.push(twitchName);
        }

        const [player1Twitch, player2Twitch] = twitchNames;

        console.log(
          `Running stream pipeline for players: ${player1Twitch} vs ${player2Twitch}`
        );

        try {
          await runStreamPipeline(player1Twitch, player2Twitch);

          // Update race state
          dbRaces.run(
            `UPDATE races SET state = 'In Progress' WHERE race_id = ?`,
            [raceId],
            (updateErr) => {
              if (updateErr) {
                console.error(updateErr);
                return res
                  .status(500)
                  .json({ error: "Failed to update race state." });
              }

              return res.json({
                message: "Stream pipeline executed successfully!",
              });
            }
          );
        } catch (streamErr) {
          console.error(streamErr);
          return res
            .status(500)
            .json({ error: "Failed during stream pipeline." });
        }
      }
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Helper to get twitch_name from library_players
function getTwitchName(db, backendName) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT twitch_name
       FROM library_players
       WHERE internal_name = ?`,
      [backendName],
      (err, row) => {
        if (err) {
          console.error(err);
          return reject(err);
        }
        resolve(row ? row.twitch_name : null);
      }
    );
  });
}

module.exports = router;
