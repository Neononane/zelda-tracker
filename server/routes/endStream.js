const express = require("express");
const router = express.Router();
const { stopDiscord } = require("../../services/discord-control.js");
const { stopOBS } = require("../../services/obs-control.js");
const { stopStreamlink } = require("../../services/streamlink-control.js");

const sqlite3 = require("sqlite3");
const db = new sqlite3.Database("./data/tracker.db");

router.post("/restream/end-stream", async (req, res) => {
  const raceId = req.body.raceId || null;

  console.log(`🚀 Ending stream for race: ${raceId}`);

  const errors = [];

  await Promise.allSettled([
    (async () => {
      try {
        await stopDiscord();
      } catch (e) {
        console.error("Error stopping Discord:", e);
        errors.push("Discord");
      }
    })(),
    (async () => {
      try {
        await stopOBS();
      } catch (e) {
        console.error("Error stopping OBS:", e);
        errors.push("OBS");
      }
    })(),
    (async () => {
      try {
        await stopStreamlink();
      } catch (e) {
        console.error("Error stopping Streamlink:", e);
        errors.push("Streamlink");
      }
    })(),
  ]);

  // ✅ Now update race state to Complete
  if (raceId) {
    try {
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE races SET state = ? WHERE race_id = ?`,
          ["Complete", raceId],
          function (err) {
            if (err) {
              console.error("Error updating race state:", err);
              reject(err);
            } else {
              console.log(`✅ Race ${raceId} marked as Complete.`);
              resolve();
            }
          }
        );
      });
    } catch (e) {
      errors.push("Race state update");
    }
  }

  if (errors.length > 0) {
    return res.status(500).json({
      message: `Some shutdown tasks failed: ${errors.join(", ")}`,
    });
  }

  return res.json({
    message: "Stream successfully ended and race marked Complete.",
  });
});

module.exports = router;
