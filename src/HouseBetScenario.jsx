import React, { useState } from "react";
import {
  doc,
  updateDoc,
  getDoc,
  addDoc,
  serverTimestamp,
  collection
} from "firebase/firestore";
import { db } from "./firebase";

const HouseBetScenario = ({ scenario, playerName, adjustTokens, distributeWinnings }) => {
  const [betAmount, setBetAmount] = useState("");

  const [expanded, setExpanded] = useState(false);

  const hasVoted = scenario.votes && scenario.votes[playerName];
  const isHouse = scenario.housePlayer === playerName;
  const isVotingActive = scenario.launched && !scenario.winner && !scenario.betsClosed;

  const houseOutcomeLabel = "Yes";
  const otherOutcomeKey = "no";
  const otherOutcomeLabel = scenario.outcomes?.[otherOutcomeKey] ?? "No";

  const submitBet = async () => {
    if (!playerName || !scenario?.id) {
      console.error("❌ submitBet: Missing playerName or scenario.id", {
        playerName,
        scenarioId: scenario?.id,
      });
      alert("Error: Missing player name or scenario. Bet not submitted.");
      return;
    }

    const amount = Number(betAmount);
    if (!amount || isNaN(amount)) {
      alert("Enter a valid bet amount");
      return;
    }

    if (!scenario.outcomes || typeof scenario.outcomes[otherOutcomeKey] !== "string") {
      console.warn("Unexpected or missing outcome. Proceeding cautiously.");
    }

    if (amount < scenario.minBet || amount > scenario.maxBet) {
      alert(`Bet must be between ${scenario.minBet} and ${scenario.maxBet}`);
      return;
    }

    const scenarioRef = doc(db, "rooms", scenario.roomId, "scenarios", scenario.id);
    const snap = await getDoc(scenarioRef);
    const data = snap.data();

    const votes = data.votes || {};
    if (votes[playerName]) {
      alert("You've already bet against the house.");
      return;
    }

    votes[playerName] = {
      amount,
      choice: otherOutcomeKey
    };

    await updateDoc(scenarioRef, { votes });
    adjustTokens(-amount);

    await addDoc(collection(db, "players", playerName, "transactions"), {
      type: "wager",
      amount: -amount,
      scenarioId: scenario.id,
      scenarioText: scenario.description,
      timestamp: serverTimestamp()
    });

    setBetAmount("");
  };

  // FIXED: Call payout with scenario.id, not the full scenario object
  const declareWin = async (winningKey) => {
    const scenarioRef = doc(db, "rooms", scenario.roomId, "scenarios", scenario.id);
    await updateDoc(scenarioRef, { winner: winningKey });

    const snap = await getDoc(scenarioRef);
    const data = snap.data();
    const votes = data.votes || {};

    await distributeWinnings(scenario.id, votes, adjustTokens); // <-- THIS IS THE FIX
  };

// ====== [ADD THIS BLOCK before return()] ======
let resultsDisplay = null;

if (scenario.winner) {
  const votes = scenario.votes || {};
  const bettors = Object.entries(votes);

  if (scenario.winner === scenario.houseOutcome) {
    // House wins, collects all losing bets
    const total = bettors.reduce((sum, [player, v]) => sum + (v.amount || 0), 0);
    resultsDisplay = (
      <div style={{ fontWeight: 600, color: "black", margin: "0.5rem 0" }}>
        HOUSE ({scenario.housePlayer}) WINS<br />
        Wins: ${total}
      </div>
    );
  } else {
    // Bettors win, each gets 2x their bet
    resultsDisplay = (
      <div style={{ fontWeight: 600, color: "black", margin: "0.5rem 0" }}>
        BETTORS WIN!<br />
        {bettors.map(([player, v]) => (
          <div key={player}>
            {player} wins ${v.amount * 2}
          </div>
        ))}
      </div>
    );
  }
}


  return (
  <div>
    {/* HEADER WITH CHEVRON - ONLY DESCRIPTION AND HOUSEPLAYER */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        cursor: "pointer",
        padding: "0.5rem 0.5rem 0.5rem 1rem",
        fontWeight: "bold"
      }}
      onClick={() => setExpanded(e => !e)}
    >
      
      <span style={{ color: "red" }}>{scenario.description}</span>
      <span style={{
        
        color: expanded ? "#ffeb9c" : "#ccc",
        fontSize: "1.2rem",
        fontWeight: "bold"
      }}>
        {expanded ? "▲" : "▼"}
      </span>
      
    </div>

    {/* EXPANDABLE CONTENT IS SEPARATE, NOT NESTED INSIDE HEADER */}
    {expanded && (
      <>
<span
        style={{
          marginLeft: "1rem",
          fontWeight: 400,
          color: "#333"
        }}
      >
        {scenario.housePlayer} bets he can!
      </span>

        {isVotingActive && !hasVoted && !isHouse && (
          <>
            {otherOutcomeKey && otherOutcomeLabel ? (
              <>
                <div style={{ fontStyle: "italic", marginBottom: "0.5rem" }}>
                  Bet ${scenario.minBet} —  ${scenario.maxBet}
                </div>

                
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  min={1}
                  placeholder="Enter bet amount"
                  style={{ width: "175px" }}
                />
                <button onClick={submitBet}>Bet Against {scenario.housePlayer}</button>
              </>
            ) : (
              <p style={{ color: "red" }}>
                ⚠️ Could not identify your voting option. This scenario may be misconfigured.
              </p>
            )}
          </>
        )}

        {isHouse && <p className="info-text">You are the house.</p>}
        {hasVoted && (
          <p className="info-text">
            You&apos;ve bet $
            {scenario.votes && scenario.votes[playerName] && scenario.votes[playerName].amount
              ? scenario.votes[playerName].amount
              : "?"}
            {" against the house."}
          </p>
        )}

        {resultsDisplay}



        {isHouse && scenario.launched && !scenario.winner && (
          <>
            {!scenario.betsClosed ? (
              <button
                onClick={async () => {
                  const scenarioRef = doc(
                    db,
                    "rooms",
                    scenario.roomId,
                    "scenarios",
                    scenario.id
                  );
                  await updateDoc(scenarioRef, { betsClosed: true });
                  alert("Bets closed. You can now declare the winner.");
                }}
                style={{ marginTop: "0.5rem" }}
              >
                Close Bets
              </button>
            ) : (
              <>
                <p style={{ fontWeight: "bold" }}>Declare Winner:</p>
                <button
                  onClick={() => declareWin(scenario.houseOutcome)}
                  style={{ marginRight: "1rem" }}
                >
                  House Wins
                </button>
                <button onClick={() => declareWin(otherOutcomeKey)}>
                  Bettor Wins
                </button>
              </>
            )}
          </>
        )}
      </>
    )}
  </div>
);

};

export default HouseBetScenario;