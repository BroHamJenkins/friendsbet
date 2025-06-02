import React, { useState } from "react";
import { useDerby } from "./DerbyContext";

export default function JokerForm({ playerName, goBack, submitJoker }) {
  const { derbyState } = useDerby(); 

  const [text, setText] = useState("");

  const alreadySubmitted = derbyState.jokerSubmissions.some(
    (entry) => entry.player === playerName
  );

  const handleSubmit = () => {
    if (text.trim()) {
      submitJoker(playerName, text.trim());
    }
    goBack();
  };

  if (alreadySubmitted) {
    return (
      <div>
        <p>You already submitted your Joker task.</p>
        <button onClick={goBack}>Back</button>
      </div>
    );
  }

  return (
    <div>
      <h3>Submit Your Joker Task</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe your made-up challenge..."
        rows={4}
        style={{ width: "100%", marginBottom: "1rem" }}
      />
      <div>
        <button onClick={handleSubmit} style={{ marginRight: "1rem" }}>
          Submit
        </button>
        <button onClick={goBack}>Cancel</button>
      </div>
    </div>
  );
}
