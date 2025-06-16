import React, { useState } from "react";
import { doc, setDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";


const HouseScenario = ({ playerName, onScenarioCreated, roomId }) => {
  const [description, setDescription] = useState("");
  const [userInput, setUserInput] = useState("Oh, you think I can't...");
  const [outcomes, setOutcomes] = useState(["", ""]);
  const [houseOutcome, setHouseOutcome] = useState("");
  const [minBet, setMinBet] = useState("");
  const [maxBet, setMaxBet] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);


  const handleOutcomeChange = (index, value) => {
    const updated = [...outcomes];
    updated[index] = value;
    setOutcomes(updated);
  };

  const addOutcome = () => {
    setOutcomes([...outcomes, ""]);
  };

  const createScenario = async () => {
  const min = parseInt(minBet);
  const max = parseInt(maxBet);

  if (isNaN(min) || isNaN(max)) {
    alert("Please enter valid numbers for min and max bet.");
    return;
  }

  if (min <= 0 || max <= 0) {
    alert("Bet values must be greater than 0.");
    return;
  }

  if (min > max) {
    alert("Min bet cannot exceed max bet.");
    return;
  }

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
    minBet: min,   // ✅ numeric
    maxBet: max,   // ✅ numeric
    launched: true,
    winner: null,
    votes: {},
    createdAt: serverTimestamp(),
    creator: playerName
  });

  onScenarioCreated();
};


  return (
    <div className="house-scenario">
      <div style={{display: "flex", width: "90%"}}>
      <input
  type="text"
  value={userInput}
  onChange={(e) => setUserInput(e.target.value)}
/>
</div>
      
        <div style={{ display: "flex", alignItems: "center", gap: "0rem", flexWrap: "wrap" }}>
        
        <input
  style={{ width: "27%" }}
  type="number"
  min="1"
  value={minBet}
  placeholder="Min Bet"
  onChange={e => setMinBet(e.target.value)}
/>

<input
  style={{ width: "27%" }}
  type="number"
  min="1"
  value={maxBet}
  placeholder="Max Bet"
  onChange={e => setMaxBet(e.target.value)}
/>

      
<span style= {{display: "flex", justifyContent: "center"}}>
      <button 
      className="img-button"
      onClick={() => setShowConfirm(true)} disabled={!userInput}>
  <img
                    src="/CreateBetButton.png"
                    alt="create bet button"
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
</span>
      </div>
      {showConfirm && (
  <div style={{
    position: "fixed",
    top: 0, left: 0, width: "100vw", height: "100vh",
    background: "rgba(0,0,0,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999
  }}>
    <div style={{
      background: "#fff",
      borderRadius: "10px",
      padding: "2rem 2.5rem",
      textAlign: "center",
      boxShadow: "0 0 24px #333",
      minWidth: "300px"
    }}>
      <div style={{ fontWeight: "bold", marginBottom: "1rem", fontSize: "1.1rem" }}>
        You are the House.  You will be covering all bets. 
      </div>
      <button
        style={{ marginRight: "1.5rem", padding: "0.5rem 1.2rem" }}
        onClick={() => {
          createScenario();
          setShowConfirm(false);
        }}
      >
        YOLO
      </button>
      <button
        style={{ padding: "0.5rem 0.5rem" }}
        onClick={() => setShowConfirm(false)}
      >
        Cancel
      </button>
    </div>
  </div>
)}

    </div>
  );
};

export default HouseScenario;
