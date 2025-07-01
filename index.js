require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.static('public')); // to serve overlay page later

// SQLite DB
const db = new sqlite3.Database('./tracker.db');
const playersDb = new sqlite3.Database('./players.db')

const fs = require('fs');

const migrationsPath = path.join(__dirname, 'migrations.sql');
const migrationsSql = fs.readFileSync(migrationsPath, 'utf-8');

const playersMigrationsPath = path.join(__dirname, 'players_migrations.sql');
const playersMigrationsSql = fs.readFileSync(playersMigrationsPath, 'utf-8');

const universalItems = [
  "Candle", "Arrow", "Bow", "Ladder", "Raft", "Recorder",
  "Bracelet", "Ring", "AKey", "Wand", "Book",
  "Boomerang", "Magical Boomerang", "Sword", "Heart Container"
];

const requiredItems = new Set([
  "Bow", "Ladder", "Raft", "Recorder", "Bracelet"
]);


db.exec(migrationsSql, (err) => {
  if (err) {
    console.error("Error running migrations:", err);
  } else {
    console.log("Database migrations applied!");
  }
});

playersDb.exec(playersMigrationsSql, (err) => {
  if (err) {
    console.error("Error running players migrations:", err);
  } else {
    console.log("Players database migrations applied!");
  }
});

// Utils
function generateApiKey() {
  return crypto.randomBytes(16).toString('hex');
}

function generateRaceId() {
  return crypto.randomBytes(4).toString('hex');
}

// AUTH middleware
function authPerRace(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized - no token");
  }
  const token = authHeader.substring(7);

  const raceId = req.params.raceId;

  db.get(
    `SELECT * FROM races WHERE race_id = ?`,
    [raceId],
    (err, race) => {
      if (err) return res.status(500).send("DB error");
      if (!race) return res.status(404).send("Race not found");

      if (race.api_key !== token) {
        return res.status(403).send("Forbidden - bad API key");
      }
      req.race = race;
      next();
    }
  );
}



// Routes

// Home
app.get('/', (req, res) => {
  res.send('Zelda Tracker running!');
});

// Create a new race
app.post('/api/races', (req, res) => {
  const name = req.body.name || "Unnamed Race";
  const racers = req.body.racers || [];
  const raceId = generateRaceId();
  const apiKey = generateApiKey();

  db.run(
    `INSERT INTO races (race_id, name, api_key, state) VALUES (?, ?, ?, ?)`,
    [raceId, name, apiKey, 'In Progress'],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Error creating race');
      }

      // Initialize race_items...
      const items = [
        "Candle", "Arrow", "Bow", "Ladder", "Raft", "Recorder",
        "Bracelet", "Ring", "AKey", "Wand", "Book",
        "Boomerang", "Magical Boomerang", "Sword", "Heart Container"
      ];

      const requiredItems = new Set([
        "Bow", "Ladder", "Raft", "Recorder", "Bracelet"
      ]);

      items.forEach(item => {
        db.run(
          `INSERT INTO race_items (race_id, item_name, location, required)
           VALUES (?, ?, ?, ?)`,
          [
            raceId,
            item,
            "unknown",
            requiredItems.has(item) ? "unknown" : null
          ]
        );
      });

      // Insert selected players
      if (racers.length > 0) {
        racers.forEach(internalName => {
          playersDb.get(
            `SELECT * FROM library_players WHERE internal_name = ?`,
            [internalName],
            (err, playerRow) => {
              if (err) {
                console.error(err);
                return;
              }
              if (playerRow) {
                db.run(
                  `INSERT INTO players
                    (race_id, backend_name, display_name, collected_items, dungeons_seen, dungeons_with_triforce)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [
                    raceId,
                    playerRow.internal_name,
                    playerRow.display_name,
                    JSON.stringify([]),
                    JSON.stringify([]),
                    JSON.stringify([])
                  ],
                  function(err) {
                    if (err) {
                      console.error("Error inserting player:", err);
                    }
                  }
                );
              }
            }
          );
        });
      }

      io.emit('admin:racesUpdated');

      res.json({
        race_id: raceId,
        api_key: apiKey
      });
    }
  );
});


//Get all item states in a race
app.get('/api/race/:raceId/items', (req, res) => {
  const raceId = req.params.raceId;

  db.all(
    `SELECT item_name, location, required FROM race_items WHERE race_id = ?`,
    [raceId],
    (err, rows) => {
      if (err) return res.status(500).send("DB error");

      // Convert DB rows to a lookup object
      const existing = {};
      rows.forEach(row => {
        existing[row.item_name] = {
          location: row.location,
          required: row.required
        };
      });

      // Build a complete response for all items
      const result = {};
      universalItems.forEach(item => {
        if (existing[item]) {
          result[item] = existing[item];
        } else {
          result[item] = {
            location: "unknown",
            required: requiredItems.has(item) ? "unknown" : null
          };
        }
      });

      res.json(result);
    }
  );
});


//update item state
app.patch('/api/race/:raceId/item/:itemName', authPerRace, (req, res) => {
  const raceId = req.params.raceId;
  const itemName = req.params.itemName;
  const { location, required } = req.body;

  db.run(
    `UPDATE race_items
     SET location = ?, required = ?
     WHERE race_id = ? AND item_name = ?`,
    [location, required, raceId, itemName],
    function (err) {
      if (err) return res.status(500).send("DB error");

      emitRaceItemsUpdate(raceId);
      res.sendStatus(200);
    }
  );
});

//Update race state
app.patch('/api/race/:raceId/state', authPerRace, (req, res) => {
  const raceId = req.params.raceId;
  const { state } = req.body;

  db.run(
    `UPDATE races
     SET state = ?
     WHERE race_id = ?`,
    [state, raceId],
    function (err) {
      if (err) return res.status(500).send("DB error");

      io.emit('admin:racesUpdated');
      res.sendStatus(200);
    }
  );
});



// Get all players in a race
app.get('/api/race/:raceId/players', (req, res) => {
  const raceId = req.params.raceId;
  db.all(
    `SELECT * FROM players WHERE race_id = ?`,
    [raceId],
    (err, rows) => {
      if (err) return res.status(500).send("DB error");
      const formatted = rows.map(row => ({
        backendName: row.backend_name,
        displayName: row.display_name,
        collectedItems: JSON.parse(row.collected_items || "[]"),
        dungeonsSeen: JSON.parse(row.dungeons_seen || "[]"),
        dungeonsWithTriforce: JSON.parse(row.dungeons_with_triforce || "[]"),
      }));
      res.json(formatted);
    }
  );
});

// Create/update a player
app.patch(
  '/api/race/:raceId/player/:backendName',
  authPerRace,
  (req, res) => {
    const raceId = req.params.raceId;
    const backendName = req.params.backendName;
    const {
      displayName,
      collectedItems,
      dungeonsSeen,
      dungeonsWithTriforce
    } = req.body;

    // check if player exists
    db.get(
      `SELECT * FROM players WHERE race_id = ? AND backend_name = ?`,
      [raceId, backendName],
      (err, row) => {
        if (err) return res.status(500).send("DB error");

        const payload = [
          displayName,
          JSON.stringify(collectedItems || []),
          JSON.stringify(dungeonsSeen || []),
          JSON.stringify(dungeonsWithTriforce || []),
          raceId,
          backendName
        ];

        if (row) {
          // update
          db.run(
            `UPDATE players
             SET display_name = ?, collected_items = ?, dungeons_seen = ?, dungeons_with_triforce = ?
             WHERE race_id = ? AND backend_name = ?`,
            payload,
            function (err) {
              if (err) return res.status(500).send("DB error");
              emitRaceUpdate(raceId);
              io.emit('admin:racesUpdated');
              res.sendStatus(200);
            }
          );
        } else {
          // insert
          db.run(
            `INSERT INTO players
             (display_name, collected_items, dungeons_seen, dungeons_with_triforce, race_id, backend_name)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              displayName,
              JSON.stringify(collectedItems || []),
              JSON.stringify(dungeonsSeen || []),
              JSON.stringify(dungeonsWithTriforce || []),
              raceId,
              backendName
            ],
            function (err) {
              if (err) return res.status(500).send("DB error");
              emitRaceUpdate(raceId);
              io.emit('admin:racesUpdated');
              res.sendStatus(200);
            }
          );
        }
      }
    );
  }
);
//Get all races open right now
app.get('/api/races', (req, res) => {
  db.all(
    `SELECT race_id, name, created_at, state, api_key FROM races`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send("DB error");
      res.json(rows);
    }
  );
});

//Delete a race from the database
app.delete('/api/race/:raceId', (req, res) => {
  const raceId = req.params.raceId;

  db.run(`DELETE FROM players WHERE race_id = ?`, [raceId], function(err) {
    if (err) return res.status(500).send("DB error");

    db.run(`DELETE FROM races WHERE race_id = ?`, [raceId], function(err) {
      if (err) return res.status(500).send("DB error");

      io.emit('admin:racesUpdated'); // << ADD THIS LINE

      res.sendStatus(200);
    });
  });
});

//update the races
app.patch('/api/race/:raceId', (req, res) => {
  const raceId = req.params.raceId;
  const { name, state, racers } = req.body;

  if (!name || !state || !Array.isArray(racers)) {
    return res.status(400).send("Invalid payload");
  }

  // Step 1: update race name and state
  db.run(
    `UPDATE races SET name = ?, state = ? WHERE race_id = ?`,
    [name, state, raceId],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).send("Error updating race");
      }

      // Step 2: delete old players for this race
      db.run(
        `DELETE FROM players WHERE race_id = ?`,
        [raceId],
        function(err) {
          if (err) {
            console.error(err);
            return res.status(500).send("Error clearing old players");
          }

          // Step 3: re-insert new players
          if (racers.length > 0) {
            racers.forEach(internalName => {
              playersDb.get(
                `SELECT * FROM library_players WHERE internal_name = ?`,
                [internalName],
                (err, playerRow) => {
                  if (err) {
                    console.error(err);
                    return;
                  }
                  if (playerRow) {
                    db.run(
                      `INSERT INTO players
                        (race_id, backend_name, display_name, collected_items, dungeons_seen, dungeons_with_triforce)
                       VALUES (?, ?, ?, ?, ?, ?)`,
                      [
                        raceId,
                        playerRow.internal_name,
                        playerRow.display_name,
                        JSON.stringify([]),
                        JSON.stringify([]),
                        JSON.stringify([])
                      ],
                      function(err) {
                        if (err) {
                          console.error("Error inserting player:", err);
                        }
                      }
                    );
                  }
                }
              );
            });
          }

          io.emit('admin:racesUpdated');
          res.sendStatus(200);
        }
      );
    }
  );
});


///Players APIs below
app.get('/api/library-players', (req, res) => {
  playersDb.all(`SELECT * FROM library_players`, [], (err, rows) => {
    if (err) return res.status(500).send("DB error");
    res.json(rows);
  });
});

app.post('/api/library-players', (req, res) => {
  const {
    internal_name,
    display_name,
    tracker_type,
    tracker_name,
    crop_left,
    crop_right,
    crop_top,
    crop_bottom,
    racetime_name,
    twitch_name
  } = req.body;

  playersDb.run(
    `INSERT INTO library_players
      (internal_name, display_name, tracker_type, tracker_name, crop_left, crop_right, crop_top, crop_bottom, racetime_name, twitch_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      internal_name,
      display_name,
      tracker_type,
      tracker_name,
      crop_left,
      crop_right,
      crop_top,
      crop_bottom,
      racetime_name,
      twitch_name
    ],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send("DB error");
      }
      res.sendStatus(201);
    }
  );
});

app.patch('/api/library-players/:internalName', (req, res) => {
  const internalName = req.params.internalName;
  const {
    display_name,
    tracker_type,
    tracker_name,
    crop_left,
    crop_right,
    crop_top,
    crop_bottom,
    racetime_name,
    twitch_name
  } = req.body;

  playersDb.run(
    `UPDATE library_players
     SET display_name = ?, tracker_type = ?, tracker_name = ?, crop_left = ?, crop_right = ?, crop_top = ?, crop_bottom = ?, racetime_name = ?, twitch_name = ?
     WHERE internal_name = ?`,
    [
      display_name,
      tracker_type,
      tracker_name,
      crop_left,
      crop_right,
      crop_top,
      crop_bottom,
      racetime_name,
      twitch_name,
      internalName
    ],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send("DB error");
      }
      res.sendStatus(200);
    }
  );
});

app.delete('/api/library-players/:internalName', (req, res) => {
  const internalName = req.params.internalName;

  playersDb.run(
    `DELETE FROM library_players WHERE internal_name = ?`,
    [internalName],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send("DB error");
      }
      res.sendStatus(200);
    }
  );
});





// WebSocket logic
io.on('connection', (socket) => {
  console.log('Client connected');
});

// emit data to the frontend overlay
function emitRaceUpdate(raceId) {
  db.all(
    `SELECT * FROM players WHERE race_id = ?`,
    [raceId],
    (err, rows) => {
      if (err) return console.error(err);
      const formatted = rows.map(row => ({
        backendName: row.backend_name,
        displayName: row.display_name,
        collectedItems: JSON.parse(row.collected_items || "[]"),
        dungeonsSeen: JSON.parse(row.dungeons_seen || "[]"),
        dungeonsWithTriforce: JSON.parse(row.dungeons_with_triforce || "[]"),
      }));
      io.emit(`tracker:update:${raceId}`, formatted);
    }
  );
}

function emitRaceItemsUpdate(raceId) {
  db.all(
    `SELECT item_name, location, required
     FROM race_items
     WHERE race_id = ?`,
    [raceId],
    (err, rows) => {
      if (err) return console.error(err);

      const items = {};
      rows.forEach(row => {
        items[row.item_name] = {
          location: row.location,
          required: row.required
        };
      });

      io.emit(`race:itemsUpdate:${raceId}`, items);
    }
  );
}


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
