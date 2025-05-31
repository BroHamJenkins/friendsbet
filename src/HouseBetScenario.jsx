import React, { useState } from "react";
import { doc, updateDoc, getDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";



const HouseBetScenario = ({ scenario, playerName, adjustTokens }) => {
  const [betAmount, setBetAmount] = useState("");

  const hasVoted = scenario.votes && scenario.votes[playerName];
  const isHouse = scenario.housePlayer === playerName;

  const isVotingActive = scenario.launched && !scenario.winner && !scenario.betsClosed;

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

    votes[playerName] = { amount };

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

  return (
  <div className="house-scenario-box">
    <h3>{scenario.description}</h3>
    <p>
      <strong>House:</strong> {scenario.housePlayer}
    </p>
    <p>
      <strong>House’s Outcome:</strong> {scenario.houseOutcome}
    </p>
    <p>
      <strong>Status:</strong>{" "}
      {scenario.winner
        ? scenario.winner === scenario.houseOutcome
          ? "House Wins"
          : "House Loses"
        : "Open"}
    </p>

    {!scenario.winner && !hasVoted && !isHouse && (
      <>
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(Number(e.target.value))}
          min={1}
          placeholder="Enter bet amount"
        />
        <button onClick={submitBet}>Bet Against House</button>
      </>
    )}

    {isHouse && <p className="info-text">You are the house. Waiting on bets...</p>}
    {hasVoted && <p className="info-text">You’ve already bet against the house.</p>}
    {scenario.winner && (
      <p className="info-text">Scenario resolved: {scenario.winner}</p>
    )}
  </div>
);

};

export default HouseBetScenario;
