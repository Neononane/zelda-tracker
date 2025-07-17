const express = require("express");
const router = express.Router();

const sqlite3 = require("sqlite3");
const db = new sqlite3.Database("./data/tracker.db");

const { runStreamPipeline } = require("../../services/streamPipeline.js");

router.post("/api/initialize-stream/:raceId", async (req, res) => {
  const raceId = req.params.raceId;

  try {
    console.log(`🚀 Initializing stream pipeline for race ${raceId}`);

    // Fetch the race name
    db.get(`SELECT name FROM races WHERE race_id = ?`, [raceId], (raceErr, raceRow) => {
      if (raceErr || !raceRow) {
        console.error(raceErr || `Race ID ${raceId} not found.`);
        return res.status(404).json({ error: "Race not found." });
      }

      const raceName = raceRow.name;

      // Fetch the race players
      db.all(
        `SELECT backend_name FROM players WHERE race_id = ?`,
        [raceId],
        async (err, rows) => {
          if (err) {
            console.error(err);
            return res
              .status(500)
              .json({ error: "Failed to look up race players." });
          }

          const players = rows.map((r) => r.backend_name);

          if (players.length < 2) {
            return res
              .status(400)
              .json({ error: "Pipeline requires at least 2 players." });
          }

          // ✅ Run stream pipeline with race name
          await runStreamPipeline(players[0], players[1], raceName);

          // Mark race as Ready for Stream
          db.run(
            `UPDATE races SET state = ? WHERE race_id = ?`,
            ["Ready for Stream", raceId],
            (err) => {
              if (err) {
                console.error(err);
                return res
                  .status(500)
                  .json({ error: "Failed to update race state." });
              }

              console.log(`✅ Race ${raceId} marked Ready for Stream`);
              res.json({
                message: `Stream pipeline initialized for race ${raceId}.`,
              });
            }
          );
        }
      );
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Failed to initialize stream pipeline." });
  }
});


module.exports = router;
