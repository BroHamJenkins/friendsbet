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

// Your 8 players
const GAME2_PLAYERS = [
  "Bob", "Christian", "Danny", "David", "Jake", "Luke", "Ryan", "Will", 
];

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
    color: winner === player ? "green" : "white",
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




  // Get the current roomId from localStorage
  const roomId = localStorage.getItem("lastRoomId");

  // Load challenges
  useEffect(() => {
    if (!roomId) return;
    const q = collection(db, "game2Challenges")

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChallenges(list);
    });
    return () => unsub();
  }, [roomId]);

  // Compute limits every time challenges update
  useEffect(() => {
    const lims = calcAllPlayerLimits(challenges);
    setLimits(lims);

    // Game ends if all players have 5+ in both roles
    const allFull = GAME2_PLAYERS.every(
      (p) => (lims[p]?.challenger ?? 0) >= 5 && (lims[p]?.challengee ?? 0) >= 5
    );
    setGameEnded(allFull);
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
    const desc = challengeDesc.trim();
    const opp = selectedOpponent.trim();
    if (!desc || !opp || opp === playerName) {
      alert("Enter a task and pick a valid opponent.");
      return;
    }
    if ((limits[playerName]?.challenger ?? 0) >= 5) {
      alert("You’ve hit your challenger limit.");
      return;
    }
    if ((limits[opp]?.challengee ?? 0) >= 5) {
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
  }

  // Join an existing challenge (as challenger)
  async function handleJoinChallenge(challenge) {
    if (!selectedOpponent || selectedOpponent === playerName) {
      alert("Pick a valid opponent.");
      return;
    }
    if ((limits[playerName]?.challenger ?? 0) >= 5) {
      alert("You’ve hit your challenger limit.");
      return;
    }
    if ((limits[selectedOpponent]?.challengee ?? 0) >= 5) {
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
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "1rem" }}>
      <div className="derby-logo-container">
            <img src="/Derby-Logo.png" alt="Derby Logo" className="derby-logo" />
          </div>
      
      <button onClick={() => setGameSelected("")} className="button-burgundy">
        Leave
      </button>

      {/* GAME END DISPLAY */}
      {gameEnded && (
        <div style={{
          background: "#222",
          color: "#00ff88",
          borderRadius: "14px",
          padding: "1rem",
          margin: "1rem 0",
          textAlign: "center"
        }}>
          <h3>GAME OVER</h3>
          <p>All players have exhausted their limits.</p>
          <strong>Final Scores:</strong>
          <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0" }}>
            {GAME2_PLAYERS.map(p =>
              <li key={p}>{p}: <b>{scores[p]}</b></li>
            )}
          </ul>
        </div>
      )}

<div style={{
  display: "flex",
  gap: "1rem",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "1rem"
}}>

<button
  className="button-score"
  onClick={() => setShowScores((s) => !s)}
  style={{
    background: "transparent",    // Or use your class styling
    border: "none",
    padding: 0,
    cursor: "pointer",
    outline: "none"
  }}
>
  <img
    src="/score-button.png"
    alt="Show scores"
    style={{
      height: "54px",   // Adjust size as needed
      width: "auto",
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
    padding: 0,
    cursor: "pointer",
    outline: "none"
  }}
>
  <img
    src="/New-challenge.png"
    alt="New Challenge"
    style={{
      height: "65px",
      width: "auto",
      display: "block",
      pointerEvents: "none",
      userSelect: "none"
    }}
    draggable="false"
  />
</button>

<button
  className="button-score"
  onClick={() => setShowScores((s) => !s)}
  style={{
    background: "transparent",    // Or use your class styling
    border: "none",
    padding: 0,
    cursor: "pointer",
    outline: "none"
  }}
>
  <img
    src="/score-button.png"
    alt="Show scores"
    style={{
      height: "54px",   // Adjust size as needed
      width: "auto",
      display: "block",
      pointerEvents: "none",  // Ensures the button click still works
      userSelect: "none"
    }}
    draggable="false"
  />
</button>

</div>


{showScores && (
<div>
      {/* SHOW LIMITS */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "0.5rem", margin: "0rem 0", alignItems: "center", justifyContent: "center", background: "#222", padding: "0.5rem", borderRadius: "10px"
      }}>
        {GAME2_PLAYERS.map(p => (
          <div key={p} style={{
            padding: "0.5rem 0.3rem",
            background: p === playerName ? "#fffae0" : "#fffaaa",
            borderRadius: "7px",
            minWidth: 90,
            textAlign: "center"
          }}>
            <div style={{ fontWeight: "bold" }}>{p}</div>
            <div style={{ fontSize: "0.9rem" }}>
              <span title="Times as Challenger">C:</span> {limits[p]?.challenger ?? 0} / 5<br />
              <span title="Times as Challengee">LB:</span> {limits[p]?.challengee ?? 0} / 5
            </div>
            <div style={{ fontSize: "0.9rem", color: "red" }}>Score: {scores[p]}</div>
          </div>
        ))}
      </div>
</div>
)}
      {/* DISABLE CREATE IF LIMIT HIT OR GAME OVER */}
      {(!gameEnded && (limits[playerName]?.challenger ?? 0) < 5) ? (
  <div style={{ margin: "1.5rem 0" }}>
    

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
      style={{ marginLeft: "0rem" }}
    >
      <option value="">Choose your opponent</option>
      {GAME2_PLAYERS.filter(p => p !== playerName && (limits[p]?.challengee ?? 0) < 5).map(p =>
        <option key={p} value={p}>{p}</option>
      )}
    </select>
    <button
      style={{ marginLeft: "0rem" }}
      onClick={handleCreateChallenge}
      disabled={!challengeDesc || !selectedOpponent || gameEnded}
    >
      SEND IT!
    </button>
    <button
      style={{
        background: "#eee",
        color: "#333",
        borderRadius: "8px",
        padding: "0.32rem 0.75rem"
      }}
      onClick={() => setShowNewChallenge(false)}
    >
      Cancel
    </button>
  </div>
)}

  </div>
) : !gameEnded && (
  <div style={{ color: "#aaa", margin: "1rem 0" }}>
    You have reached your challenger limit.
  </div>
)}


      {/* LIST ALL CHALLENGES */}
      <div style={{ marginTop: "1rem" }}>
        
        {challenges.length === 0 && <p>No challenges created yet.</p>}
        {challenges.map(challenge => (
  <div
    key={challenge.id}
    style={{
      border: "3px solid #555",
      borderRadius: "10px",
      marginBottom: "0.7rem",
      padding: "1rem",
      background: "#222"
    }}
  >
    {/* Header row: description and chevron in flex, clicking toggles */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        fontWeight: "bold",
        color: "white",
        marginBottom: "0.1rem",
        cursor: "pointer"
      }}
      onClick={() =>
        setOpenInstances((prev) => ({
          ...prev,
          [challenge.id]: !prev[challenge.id],
        }))
      }
    >
      <span>{challenge.description}</span>
      <span style={{ marginLeft: "1rem", color: openInstances[challenge.id] ? "#ffeb9c" : "#ccc" }}>
        {openInstances[challenge.id] ? "▲" : "▼"}
      </span>
    </div>

    {/* Only show matchups if open */}
    {openInstances[challenge.id] &&
      challenge.instances.map((inst, i) => (
        <div key={i} style={{ marginBottom: "0.1rem", marginLeft: "1.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: "1.08rem" }}>
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
                color: "grey",
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
                className="small-button"
                onClick={() => decideWinner(challenge, i, inst.challenger)}
              >{inst.challenger} wins</button>
              <button
                className="small-button"
                onClick={() => decideWinner(challenge, i, inst.challengee)}
              >{inst.challengee} wins</button>
            </div>
          )}
        </div>
      ))
    }

   



            {/* Join challenge (as challenger) */}
            {(!gameEnded &&
              (limits[playerName]?.challenger ?? 0) < 5 &&
              challenge.instances.filter(inst => inst.challenger === playerName).length === 0) && (
                <div style={{ marginTop: "0.3rem" }}>
                  <button
                  className="small-button"
                  onClick={() => setChallengeTarget(challenge.id)}>
                    Challenge
                  </button>
                  {challengeTarget === challenge.id && (
                    <span style={{ marginLeft: "0.5rem" }}>
                      <select
                        value={selectedOpponent}
                        onChange={e => setSelectedOpponent(e.target.value)}
                      >
                        <option value="">Who's your bitch?</option>
                        {GAME2_PLAYERS.filter(p =>
                          p !== playerName &&
                          (limits[p]?.challengee ?? 0) < 5 &&
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
        ))}
      </div>
    </div>
  );
}
