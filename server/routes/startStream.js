const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const { runStreamPipeline } = require("../../services/streamPipeline");

router.post("/start-stream/:raceId", async (req, res) => {
  const raceId = req.params.raceId;

  try {
    const db = new sqlite3.Database('./data/tracker.db');

    db.all(
      `
      SELECT player_slot, twitch_name
      FROM race_players
      WHERE race_id = ?
    `,
      [raceId],
      async (err, rows) => {
        if (err) {
          console.error(err);
          return res
            .status(500)
            .json({ error: "Database error fetching race players." });
        }

        if (!rows || rows.length === 0) {
          return res
            .status(400)
            .json({ error: "No players assigned for this race." });
        }

        const p1 = rows.find((r) => r.player_slot.toLowerCase() === "player1");
        const p2 = rows.find((r) => r.player_slot.toLowerCase() === "player2");

        if (!p1 || !p2) {
          return res
            .status(400)
            .json({ error: "Both Player1 and Player2 must be assigned." });
        }

        const player1Twitch = p1.twitch_name;
        const player2Twitch = p2.twitch_name;

        console.log(
          `Running stream pipeline for players: ${player1Twitch} vs ${player2Twitch}`
        );

        try {
          await runStreamPipeline(player1Twitch, player2Twitch);

          // Update race status to "In Progress"
          db.run(
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

module.exports = router;
