import React, { useState } from "react";
import { doc, setDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";


const HouseScenario = ({ playerName, onScenarioCreated, roomId }) => {
  const [description, setDescription] = useState("");
  const [outcomes, setOutcomes] = useState(["", ""]);
  const [houseOutcome, setHouseOutcome] = useState("");
  const [minBet, setMinBet] = useState(1);
  const [maxBet, setMaxBet] = useState(100);

  const handleOutcomeChange = (index, value) => {
    const updated = [...outcomes];
    updated[index] = value;
    setOutcomes(updated);
  };

  const addOutcome = () => {
    setOutcomes([...outcomes, ""]);
  };

  const createScenario = async () => {
    const scenarioId = `${playerName}-${Date.now()}`;
    const scenarioData = {
        mode: "house",
      description,
      outcomes: outcomes.reduce((acc, curr, i) => {
        if (curr.trim()) acc[`opt${i}`] = curr.trim();
        return acc;
      }, {}),
      housePlayer: playerName,
      houseOutcome,
      isHouseGame: true,
      minBet,
      maxBet,
      launched: false,
      winner: null,
      votes: {},
    };

    const scenarioRef = doc(collection(db, "rooms", roomId, "scenarios"));
await setDoc(scenarioRef, {
  ...scenarioData,
  createdAt: serverTimestamp(),
  creator: playerName
});
    onScenarioCreated();
  };

  return (
    <div className="house-scenario">
      <h2>Create House Scenario</h2>
      <input
        type="text"
        placeholder="Scenario Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <h3>Outcomes</h3>
      {outcomes.map((value, index) => (
        <input
          key={index}
          type="text"
          placeholder={`Outcome ${index + 1}`}
          value={value}
          onChange={(e) => handleOutcomeChange(index, e.target.value)}
        />
      ))}
      <button onClick={addOutcome}>Add Outcome</button>

      <h3>Pick Outcome You're Backing (as House)</h3>
      <select
        value={houseOutcome}
        onChange={(e) => setHouseOutcome(e.target.value)}
      >
        <option value="">-- Select --</option>
        {outcomes.map((outcome, index) => (
          <option key={index} value={`opt${index}`}>
            {outcome || `Option ${index + 1}`}
          </option>
        ))}
      </select>

      <div>
        <label>Min Bet: </label>
        <input
          type="number"
          value={minBet}
          onChange={(e) => setMinBet(Number(e.target.value))}
        />
      </div>
      <div>
        <label>Max Bet: </label>
        <input
          type="number"
          value={maxBet}
          onChange={(e) => setMaxBet(Number(e.target.value))}
        />
      </div>

      <button onClick={createScenario} disabled={!description || !houseOutcome}>
        Create House Scenario
      </button>
    </div>
  );
};

export default HouseScenario;
