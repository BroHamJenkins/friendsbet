import React, { useState } from "react";
import { doc, setDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";


const HouseScenario = ({ playerName, onScenarioCreated, roomId }) => {
  const [description, setDescription] = useState("");
  const [userInput, setUserInput] = useState("Oh, you think I can't...");
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
  const scenarioRef = doc(collection(db, "rooms", roomId, "scenarios"));
  const outcomes = {
    yes: "Yes",
    no: "No"
  };

  await setDoc(scenarioRef, {
    mode: "house",
    description: userInput,
    outcomes,
    order: ["yes", "no"],
    housePlayer: playerName,
    houseOutcome: "yes",
    isHouseGame: true,
    minBet,
    maxBet,
    launched: true,
    winner: null,
    votes: {}, // House doesn't wager tokens
    createdAt: serverTimestamp(),
    creator: playerName
  });

  onScenarioCreated();
};


  return (
    <div className="house-scenario">
      <h2>Create House Bet</h2>
      <input
  type="text"
  value={userInput}
  onChange={(e) => setUserInput(e.target.value)}
/>


      <h3>Outcomes</h3>
      <p>Yep, sure can  </p>
      <p>Nope, no way</p>
      

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

      <button onClick={createScenario} disabled={!userInput}>


        Create House Scenario
      </button>
    </div>
  );
};

export default HouseScenario;
