// Game2.jsx
import React, { useState, useEffect } from "react";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import { deleteDoc } from "firebase/firestore";

// Your 8 players
const GAME2_PLAYERS = [
  "Bob", "Christian", "Danny", "David", "Jake", "Luke", "Ryan", "Will",
];

const CHALLENGE_LIMIT = 5;  // sets a limit on challenges issued and received per player

function getChallengeLimit(instances, player, role) {
  return instances.filter(
    (inst) => inst[role] === player
  ).length;
}

function calcAllPlayerLimits(challenges) {
  // Returns: { Danny: { challenger: 2, challengee: 3 }, ... }
  const limits = {};
  GAME2_PLAYERS.forEach((p) => {
    limits[p] = { challenger: 0, challengee: 0 };
  });
  challenges.forEach((ch) => {
    ch.instances.forEach((inst) => {
      if (inst.challenger && limits[inst.challenger]) limits[inst.challenger].challenger++;
      if (inst.challengee && limits[inst.challengee]) limits[inst.challengee].challengee++;
    });
  });
  return limits;
}

function getWinnerStyle(winner, player) {
  if (!winner) return {};
  return {
    color: winner === player ? "lawngreen" : "white",
    fontWeight: winner === player ? "bold" : "normal"
  };
}

export default function Game2({
  playerName,
  setGameSelected
}) {
  const [challenges, setChallenges] = useState([]);
  const [challengeDesc, setChallengeDesc] = useState("");
  const [selectedOpponent, setSelectedOpponent] = useState("");
  const [challengeTarget, setChallengeTarget] = useState(null); // challengeId for joining
  const [gameEnded, setGameEnded] = useState(false);
  const [scores, setScores] = useState({});
  const [limits, setLimits] = useState({}); // Per-player limits
  const [showScores, setShowScores] = useState(false);
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [openInstances, setOpenInstances] = useState({});
  const [sending, setSending] = useState(false);









  // Load challenges
  useEffect(() => {
    const q = collection(db, "game2Challenges");

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChallenges(list);
    });
    return () => unsub();
  }, []);


  // Compute limits every time challenges update
  useEffect(() => {
    const lims = calcAllPlayerLimits(challenges);
    setLimits(lims);

    // Check if all players have issued/received their limit
    const allLimitsReached = GAME2_PLAYERS.every(
      (p) =>
        (lims[p]?.challenger ?? 0) >= CHALLENGE_LIMIT &&
        (lims[p]?.challengee ?? 0) >= CHALLENGE_LIMIT
    );

    // Check if all challenge instances have a winner (no undecided)
    const allDecided = challenges.every(
      (ch) =>
        ch.instances.every((inst) => !!inst.winner)
    );

    // Only end the game if both conditions are true
    setGameEnded(allLimitsReached && allDecided);
  }, [challenges]);


  // Compute scores
  useEffect(() => {
    // Scores: +1 for each instance where player is winner
    const s = {};
    GAME2_PLAYERS.forEach(p => s[p] = 0);
    challenges.forEach(ch => {
      ch.instances.forEach(inst => {
        if (inst.winner && s[inst.winner] !== undefined) s[inst.winner]++;
      });
    });
    setScores(s);
  }, [challenges]);

  // Create a new challenge (as the challenger)
  async function handleCreateChallenge() {
    if (sending) return;           // Guard: ignore if already sending
    setSending(true);
    setShowNewChallenge(false);    // Closes modal immediately

    try {
      const desc = challengeDesc.trim();
      const opp = selectedOpponent.trim();
      if (!desc || !opp || opp === playerName) {
        alert("Enter a task and pick a valid opponent.");
        return;
      }
      if ((limits[playerName]?.challenger ?? 0) >= CHALLENGE_LIMIT) {
        alert("You’ve hit your challenger limit.");
        return;
      }
      if ((limits[opp]?.challengee ?? 0) >= CHALLENGE_LIMIT) {
        alert(`${opp} has reached their challengee limit.`);
        return;
      }

      // Create the challenge doc with first instance
      const q = collection(db, "game2Challenges")

      await addDoc(q, {
        description: desc,
        createdAt: serverTimestamp(),
        creator: playerName,
        instances: [
          {
            challenger: playerName,
            challengee: opp,
            winner: null,
            decidedBy: null,
            decidedAt: null
          }
        ]
      });
      setChallengeDesc("");
      setSelectedOpponent("");
    } catch (err) {
      alert("Failed to create challenge. Try again.");
      console.error(err);
    } finally {
      setSending(false); // Always re-enable button on finish
    }
  }


  // Join an existing challenge (as challenger)
  async function handleJoinChallenge(challenge) {
    if (!selectedOpponent || selectedOpponent === playerName) {
      alert("Pick a valid opponent.");
      return;
    }
    if ((limits[playerName]?.challenger ?? 0) >= CHALLENGE_LIMIT) {
      alert("You’ve hit your challenger limit.");
      return;
    }
    if ((limits[selectedOpponent]?.challengee ?? 0) >= CHALLENGE_LIMIT) {
      alert(`${selectedOpponent} has reached their challengee limit.`);
      return;
    }
    // Prevent duplicate matchups in the same challenge
    if (challenge.instances.some(
      inst =>
        inst.challenger === playerName &&
        inst.challengee === selectedOpponent
    )) {
      alert("You’ve already issued this challenge to that opponent.");
      return;
    }

    const docRef = doc(db, "game2Challenges", challenge.id)

    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const updated = {
      ...data,
      instances: [
        ...data.instances,
        {
          challenger: playerName,
          challengee: selectedOpponent,
          winner: null,
          decidedBy: null,
          decidedAt: null
        }
      ]
    };
    await setDoc(docRef, updated);
    setChallengeTarget(null);
    setSelectedOpponent("");
  }

  // Mark winner for a challenge instance
  async function decideWinner(challenge, instIdx, winner) {
    const inst = challenge.instances[instIdx];
    if (inst.winner) return; // already decided
    if (inst.challenger !== playerName) {
      alert("Only the challenger can decide the winner for this instance.");
      return;
    }
    const docRef = doc(db, "game2Challenges", challenge.id);

    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const instances = [...data.instances];
    instances[instIdx] = {
      ...instances[instIdx],
      winner,
      decidedBy: playerName,
      decidedAt: Date.now()
    };
    await updateDoc(docRef, { instances });
  }

  // UI
  return (

    
    <div style={{ margin: "0 auto", padding: "0.1rem" }}>
      <div className="derby-logo-wrapper">
        <img
  src="/Derby-Logo.png"
  alt="Derby Logo"
  className="derby-logo"
  style={{ cursor: "pointer" }}
  onClick={() => {
    const audio = new Audio("/RalphDanger.mp3");
    audio.play().catch(() => {}); // Prevent unhandled promise if user has not interacted yet
  }}
/>

        <img
          src="/derby-sticker.png"
          alt="17% more alliteration"
          className="derby-sticker"
        />
      </div>



      {/* GAME END DISPLAY */}
      {gameEnded && (() => {
        // Get array of players and their scores
        const sortedPlayers = [...GAME2_PLAYERS].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
        const highScore = scores[sortedPlayers[0]] ?? 0;
        // Get all players with the top score (handle ties)
        const winners = sortedPlayers.filter(p => scores[p] === highScore);

        return (
          <div style={{
            background: "#222",
            color: "#00ff88",
            borderRadius: "14px",
            padding: "1rem",
            margin: "1rem 0",
            textAlign: "center"
          }}>
            <h3>GAME OVER</h3>
            <p>
              And the winner{winners.length > 1 ? "s are" : " is"}...
              <b>
                {winners.map((p, i) =>
                  `${i > 0 ? " & " : " "}${p}`
                )}
              </b>
              !
            </p>
            <strong>Final Scores:</strong>
            <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0" }}>
              {sortedPlayers.map(p =>
                <li key={p}>{p}: <b>{scores[p]}</b></li>
              )}
            </ul>
          </div>
        );
      })()}


      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",       // ✅ force it to use full width of the parent
        textAlign: "center", // optional: helps with fallback rendering
        gap: "1rem",
        padding: "0.1rem",
      }}
      >
        <button
          className="button-score"
          onClick={() => setShowScores((s) => !s)}
          style={{
            background: "transparent",    // Or use your class styling
            border: "none",
            padding: "0",
            cursor: "pointer",
            outline: "none"
          }}
        >
          <img
            src="/score-button2.png"
            alt="Show scores"
            style={{
              height: "auto",   // Adjust size as needed
              width: "80px",
              display: "block",
              pointerEvents: "none",  // Ensures the button click still works
              userSelect: "none"
            }}
            draggable="false"
          />
        </button>

        <button
          className="button-newchallenge"
          onClick={() => setShowNewChallenge(s => !s)}
          style={{
            background: "transparent",
            border: "none",
            padding: "0",
            cursor: "pointer",
            outline: "none"
          }}
        >
          <img
            src="/New-challenge.png"
            alt="New Challenge"
            style={{
              height: "auto",
              width: "100px",
              display: "block",
              pointerEvents: "none",
              userSelect: "none"
            }}
            draggable="false"
          />
        </button>

        <button
          onClick={() => setGameSelected("")}
          className="button-score"
          style={{
            background: "transparent",    // Or use your class styling
            border: "none",
            padding: "0",
            cursor: "pointer",
            outline: "none"
          }}
        >
          <img
            src="/exit-button.png"
            alt="Show scores"
            style={{
              height: "auto",   // Adjust size as needed
              width: "80px",
              display: "block",
              pointerEvents: "none",  // Ensures the button click still works
              userSelect: "none"
            }}
            draggable="false"
          />
        </button>

      </div>

      {playerName === "Raul" && (
        <button
          style={{
            background: "#f44",
            color: "white",
            fontWeight: "bold",
            borderRadius: "8px",
            border: "none",
            padding: "0.6rem 1.2rem",
            margin: "1rem auto",
            display: "block",
            fontSize: "1.15rem",
            cursor: "pointer"
          }}
          onClick={async () => {
            if (!window.confirm("Are you sure you want to reset the Derby? This will delete ALL current challenges!")) return;
            const q = collection(db, "game2Challenges");
            const docs = await getDocs(q);
            for (const docSnap of docs.docs) {
              await deleteDoc(docSnap.ref); // CORRECT WAY
            }
            alert("Derby has been reset.");
          }}
        >
          Reset Derby (Danger!)
        </button>
      )}


      {showScores && (
        <div>
          {/* SHOW LIMITS */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "0.3rem", margin: "0", alignItems: "center", justifyContent: "center", background: "", padding: "0.5rem", borderRadius: "10px"
          }}>
            {GAME2_PLAYERS.map(p => (
              <div key={p} style={{
                padding: "0.5rem 0.3rem",
                background: p === playerName ? "#fffae0" : "#fffaaa",
                borderRadius: "15px",
                boxShadow: "0 2px 18px #ffdd82, 0 0 0 4px #222 inset",
                minWidth: 90,
                textAlign: "center"
              }}>
                <div style={{ fontWeight: "bold" }}>{p}</div>
                <div style={{ fontSize: "0.7rem" }}>
                  <span title="Times as Challenger">Sent:</span> {limits[p]?.challenger ?? 0} / {CHALLENGE_LIMIT}<br />
                  <span title="Times as Challengee">Rec'v:</span> {limits[p]?.challengee ?? 0} / {CHALLENGE_LIMIT}
                </div>
                <div style={{ fontSize: "0.9rem", color: "red", fontWeight: "bold" }}>★Score: {scores[p]}★</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* DISABLE CREATE IF LIMIT HIT OR GAME OVER */}
      {(!gameEnded && (limits[playerName]?.challenger ?? 0) < CHALLENGE_LIMIT) ? (
        <div style={{ margin: "0" }}>


          {showNewChallenge && (
            <div
              style={{
                border: "1px solid #888",
                padding: "1rem",
                borderRadius: "12px",
                background: "#1b1b2f"
              }}
            >
              <input
                style={{ width: "90%", marginBottom: "0.5rem" }}
                placeholder="Describe your challenge"
                value={challengeDesc}
                onChange={e => setChallengeDesc(e.target.value)}
                disabled={gameEnded}
              />
              <select
                value={selectedOpponent}
                onChange={e => setSelectedOpponent(e.target.value)}
                disabled={gameEnded}
                style={{ marginLeft: "0rem", width: "98%" }}
              >
                <option value="">Choose your opponent</option>
                {GAME2_PLAYERS.filter(p => p !== playerName && (limits[p]?.challengee ?? 0) < CHALLENGE_LIMIT).map(p =>
                  <option key={p} value={p}>{p}</option>
                )}
              </select>
              <div style={{ display: "flex", gap: "1rem", marginBottom: "10px", justifyContent: "center" }}>
                <button
                  className="img-button"
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 0,

                    border: "none",
                    background: "none",
                    width: "130px",         // or whatever (should be >= image width)
                    height: "60px",
                    outline: "none",
                    boxShadow: "none",
                    cursor: "pointer",
                  }}
                  onClick={handleCreateChallenge}
                  disabled={sending || !challengeDesc || !selectedOpponent || gameEnded}
                >
                  <img
                    src="/send-button.png"
                    alt="Send button"
                    style={{
                      height: "auto",
                      width: "130px",
                      display: "block",
                      pointerEvents: "none",
                      userSelect: "none"
                    }}
                    draggable="false"
                  />
                </button>
                <button
                  className="img-button"
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 0,
                    margin: 0,
                    border: "none",
                    background: "none",
                    width: "130px",         // or whatever (should be >= image width)
                    height: "60px",
                    outline: "none",
                    boxShadow: "none",
                    cursor: "pointer",
                  }}
                  onClick={() => setShowNewChallenge(false)}
                >
                  <img
                    src="/derby-cancel.png"
                    alt="Cancel button"
                    style={{
                      height: "auto",
                      width: "130px",
                      display: "block",
                      pointerEvents: "none",
                      userSelect: "none"
                    }}
                    draggable="false"
                  />
                </button>
              </div>

            </div>
          )}

        </div>
      ) : !gameEnded && (
        <div style={{ color: "#aaa", margin: "1rem 0" }}>
          You have reached your challenger limit.
        </div>
      )}


      {/* LIST ALL CHALLENGES */}
      <div style={{ marginTop: "0" }}>

        {challenges.length === 0 && <p>No challenges created yet.</p>}
        {challenges.map(challenge => (
          <div
            key={challenge.id} // <-- Move key here!
            style={{ display: "flex", justifyContent: "center", width: "100%" }}
          >
            <div className="challenge-info-block">
              {/* Header row: description and chevron in flex, clicking toggles */}
              <div className="bungee-regular"
                style={{


                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: "white",
                  marginBottom: "0.1rem",
                  cursor: "pointer",
                  width: "100%"
                }}
                onClick={() =>
                  setOpenInstances((prev) => ({
                    ...prev,
                    [challenge.id]: !prev[challenge.id],
                  }))
                }
              >
                <span>{challenge.description}</span>
                <span style={{ marginLeft: "1rem", color: openInstances[challenge.id] ? "#25919d" : "#25919d" }}>
                  {openInstances[challenge.id] ? "▲" : "▼"}
                </span>
              </div>

              {/* Only show matchups if open */}
              {openInstances[challenge.id] &&
                challenge.instances.map((inst, i) => (
                  <div key={i} style={{ marginBottom: "0.1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.08rem" }}>
                      <span
                        style={{
                          color: "white",
                          ...getWinnerStyle(inst.winner, inst.challenger),
                          marginRight: "0.25rem"
                        }}
                      >
                        {inst.challenger}
                      </span>
                      <span
                        style={{
                          color: "black",
                          fontWeight: "bold",
                          margin: "0 0.15rem"
                        }}
                      >vs</span>
                      <span
                        style={{
                          color: "white",
                          ...getWinnerStyle(inst.winner, inst.challengee)
                        }}
                      >
                        {inst.challengee}
                      </span>
                    </div>
                    {/* BUTTONS BELOW */}
                    {!inst.winner && (inst.challenger === playerName && !gameEnded) && (
                      <div style={{

                        display: "flex",
                        gap: "0.5rem",
                        marginTop: "0.25rem",
                      }}>
                        <button
                          className="button-37"
                          onClick={() => decideWinner(challenge, i, inst.challenger)}
                        >{inst.challenger} wins</button>
                        <button
                          className="button-37"
                          onClick={() => decideWinner(challenge, i, inst.challengee)}
                        >{inst.challengee} wins</button>
                      </div>
                    )}
                  </div>
                ))
              }





              {/* Join challenge (as challenger) */}
              {(!gameEnded &&
                (limits[playerName]?.challenger ?? 0) < CHALLENGE_LIMIT &&
                challenge.instances.filter(inst => inst.challenger === playerName).length === 0) && (
                  <div>

                    <div style={{ display: "flex", justifyContent: "center", margin: "0", padding: "0" }}>
                      <button
                        className="challenge-orange"
                        onClick={() => setChallengeTarget(challenge.id)}
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          border: "none",
                          background: "transparent",
                          padding: "none"
                        }}
                      >
                        <img
                          src="/challenge-button.png"
                          alt="Issue Challenge"
                          style={{
                            width: "80px",
                            height: "auto",
                            display: "block",
                            pointerEvents: "none",  // Ensures the button click still works
                            userSelect: "none"
                          }}
                          draggable="false"
                        />

                      </button>
                    </div>

                    {challengeTarget === challenge.id && (
                      <span style={{ marginLeft: "0.5rem" }}>

                        <select style={{ width: "75%" }}
                          value={selectedOpponent}
                          onChange={e => setSelectedOpponent(e.target.value)}
                        >
                          <option value="">Who's your bitch?</option>
                          {GAME2_PLAYERS.filter(p =>
                            p !== playerName &&
                            (limits[p]?.challengee ?? 0) < CHALLENGE_LIMIT &&
                            !challenge.instances.some(inst =>
                              inst.challenger === playerName && inst.challengee === p
                            )
                          ).map(p =>
                            <option key={p} value={p}>{p}</option>
                          )}
                        </select>

                        <button
                          onClick={() => {
                            const ch = challenges.find(ch => ch.id === challenge.id);
                            if (ch) handleJoinChallenge(ch);
                          }}
                          disabled={!selectedOpponent}
                          className="small-button"
                        >Go</button>
                        <button className="small-button-red" onClick={() => { setChallengeTarget(null); setSelectedOpponent(""); }}>Cancel</button>
                      </span>
                    )}
                  </div>
                )}
            </div>
          </div>

        ))}
      </div>
    </div>
  );
}
