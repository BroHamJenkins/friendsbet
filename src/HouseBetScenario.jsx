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

  const hasVoted = scenario.votes && scenario.votes[playerName];
  const isHouse = scenario.housePlayer === playerName;
  const isVotingActive = scenario.launched && !scenario.winner && !scenario.betsClosed;

  const houseOutcomeLabel = scenario.outcomes?.[scenario.houseOutcome] || "(unknown)";
  const allOutcomeKeys = Object.keys(scenario.outcomes || {});
const otherOutcomeKey = allOutcomeKeys.length === 2
  ? allOutcomeKeys.find((key) => key !== scenario.houseOutcome)
  : null;

const otherOutcomeLabel = otherOutcomeKey ? scenario.outcomes[otherOutcomeKey] : null;

console.log("🏠 House Outcome:", scenario.houseOutcome);
console.log("🤼 Other Outcome:", otherOutcomeKey);

  

  const submitBet = async () => {
    const amount = Number(betAmount);
    if (!amount || isNaN(amount)) {
      alert("Enter a valid bet amount");
      return;
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

  const declareWin = async (winningKey) => {
    const scenarioRef = doc(db, "rooms", scenario.roomId, "scenarios", scenario.id);
    await updateDoc(scenarioRef, { winner: winningKey });
    await distributeWinnings(scenario.id);
  };

  return (
    <div className="house-scenario-box">
      <h3>{scenario.description}</h3>

      <p><strong>House:</strong> {scenario.housePlayer}</p>

      <p><strong>House’s Outcome:</strong> {houseOutcomeLabel}</p>

      <p>
        <strong>Status:</strong>{" "}
        {scenario.winner
          ? scenario.winner === scenario.houseOutcome
            ? "House Wins"
            : "House Loses"
          : "Open"}
      </p>

      {isVotingActive && !hasVoted && !isHouse && (
  <>
    {otherOutcomeKey && otherOutcomeLabel ? (
      <>
        <p><strong>Your Option:</strong> {otherOutcomeLabel}</p>
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(Number(e.target.value))}
          min={1}
          placeholder="Enter bet amount"
        />
        <button onClick={submitBet}>Bet Against House</button>
      </>
    ) : (
      <p style={{ color: "red" }}>⚠️ Could not identify your voting option. This scenario may be misconfigured.</p>
    )}
  </>
)}


      {isHouse && <p className="info-text">You are the house. Waiting on bets...</p>}
      {hasVoted && <p className="info-text">You’ve already bet against the house.</p>}
      {scenario.winner && (
        <p className="info-text">Scenario resolved: {scenario.outcomes?.[scenario.winner]}</p>
      )}

      {isHouse && scenario.launched && !scenario.winner && (
        <>
          {!scenario.betsClosed ? (
            <button
              onClick={async () => {
                const scenarioRef = doc(db, "rooms", scenario.roomId, "scenarios", scenario.id);
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
              <button
                onClick={() => declareWin(otherOutcomeKey)}
              >
                Bettor Wins
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default HouseBetScenario;
