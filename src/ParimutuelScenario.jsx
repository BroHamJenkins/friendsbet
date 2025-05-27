import React from "react";

function ParimutuelScenario({ scenario, playerName, voteAmounts, setVoteAmounts, voteOutcome, outcomeInputs, setOutcomeInputs, addOutcome, launchScenario, selectedRoom, showDeclareButtons, toggleDeclareButtons, declareWinner }) {
  const betValue = voteAmounts[scenario.id] || "";
  const setBetValue = (val) => {
    setVoteAmounts((prev) => ({
      ...prev,
      [scenario.id]: val
    }));
  };

  const hasVoted = !!scenario.votes[playerName];

  return (
    <div>
      <strong>{scenario.description}</strong>
      <div style={{ fontStyle: "italic", marginBottom: "0.5rem" }}>
        Min. Bet: ${scenario.minBet} — Max. Bet: ${scenario.maxBet}
      </div>

      {/* ✅ Always show outcome list */}
      {Object.keys(scenario.outcomes).map((key) => {
  const val = scenario.outcomes[key];
  const userVoted = scenario.votes[playerName]?.choice === key;

  const isVotingActive =
    scenario.launched && !scenario.winner && !scenario.betsClosed;

  return isVotingActive ? (
    <button
      key={key}
      type="button"
      onClick={() => {
        const raw = voteAmounts[scenario.id];
        const amount = Number(raw);
        if (!raw || isNaN(amount)) {
          alert("Please enter a valid bet amount.");
          return;
        }
        if (amount < scenario.minBet || amount > scenario.maxBet) {
          alert(`Bet must be between ${scenario.minBet} and ${scenario.maxBet}`);
          return;
        }
        voteOutcome(scenario.id, key, amount);
      }}
      className={`casino-button-gold ${userVoted ? "voted-button" : ""}`}
      style={{ marginLeft: "0.5rem", position: "relative" }}
    >
      {val}
      {userVoted && (
        <span
          style={{
            position: "absolute",
            top: "-8px",
            right: "-8px",
            backgroundColor: "#00ff88",
            color: "#000",
            borderRadius: "50%",
            fontSize: "0.7rem",
            padding: "2px 5px",
            fontWeight: "bold"
          }}
        >
          ✓
        </span>
      )}
    </button>
  ) : (
    <div key={key} style={{ marginBottom: "0.25rem" }}>
      {val}
    </div>
  );
})}



      {scenario.creator === playerName && !scenario.launched && (
        <div style={{ marginTop: "1rem" }}>
          <input
            placeholder="New outcome"
            value={outcomeInputs[scenario.id] || ""}
            onChange={(e) =>
              setOutcomeInputs({ ...outcomeInputs, [scenario.id]: e.target.value })
            }
          />
          <button onClick={() => addOutcome(scenario.id)}>Add Outcome</button>
          <button onClick={() => launchScenario(scenario.id)} style={{ marginLeft: "0.5rem" }}>
            Ready, set, BET!
          </button>
        </div>
      )}

      {scenario.creator === playerName && scenario.launched && !scenario.winner && selectedRoom?.type === "prop" && (
        <div style={{ marginTop: "1rem" }}>
          {!showDeclareButtons?.[scenario.id] ? (
            <button onClick={() => toggleDeclareButtons(scenario.id)}>Declare Winner</button>
          ) : (
            <>
              <p>Declare Winner:</p>
              {Object.keys(scenario.outcomes).map((key) => (
                <button key={key} onClick={() => declareWinner(scenario.id, key)}>
                  {scenario.outcomes[key]}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {scenario.launched && !scenario.winner && !scenario.betsClosed && !hasVoted && (
        <input
          type="number"
          min={scenario.minBet}
          max={scenario.maxBet}
          step="1"
          placeholder={`Bet (${scenario.minBet}–${scenario.maxBet})`}
          value={betValue}
          onChange={(e) => setBetValue(e.target.value)}
          style={{ width: "8rem", marginBottom: "0.5rem" }}
        />
      )}

      {scenario.winner && (
        <div>
          {Object.keys(scenario.outcomes).map((key) => {
            const val = scenario.outcomes[key];
            const voters = Object.entries(scenario.votes || {})
              .filter(([, vote]) => vote?.choice === key)
              .map(([voter]) => voter);
            const isWinner = Array.isArray(scenario.winner)
              ? scenario.winner.includes(key)
              : scenario.winner === key;

            return (
              <div key={key} style={{ color: isWinner ? "green" : "inherit" }}>
                {val}: {voters.length > 0 ? voters.join(", ") : "No Bets"}{" "}
{isWinner && voters.length === 0
  ? "(Push - All Bets Returned)"
  : isWinner
  ? "(Winner)"
  : ""}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ParimutuelScenario;

