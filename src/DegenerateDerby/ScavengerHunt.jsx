import React, { useState } from "react";
import { useDerby } from "./DerbyContext";
import { scavengerTasks } from "./derbyTasks";
import JokerForm from "./JokerForm";
import JokerScoring from "./JokerScoring";
import DegenerateDerby from "./DegenerateDerby";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";


export default function ScavengerHunt({ playerName, goBack }) {

  const { derbyState, markTaskComplete, submitJoker, scoreJoker } = useDerby();


  const completed = derbyState.scavengerTasks?.[playerName] || {};



  const getScore = () => {
    return scavengerTasks.reduce((sum, task) => {
      return completed[task.id] ? sum + task.points : sum;
    }, 0);
  };

const [view, setView] = useState("tasks");

if (view === "joker") {
  return (
    <JokerForm
      playerName={playerName}
      goBack={() => setView("tasks")}
      submitJoker={submitJoker}
    />
  );
}




if (view === "score") {
  return (
    <JokerScoring
      playerName={playerName}
      goBack={() => setView("tasks")}
      scoreJoker={scoreJoker}
      submissions={derbyState.jokerSubmissions}
    />
  );
}




  return (
    <div style={{ padding: "1rem", maxWidth: "600px", margin: "0 auto" }}>
      <h2 style={{ textAlign: "center" }}>Degenerate Derby Dash</h2>
      <p style={{ textAlign: "center", color:"white"}}>Total Points: {getScore()}</p>

<button 
  className="button-burgundy"
  onClick={goBack} style={{ marginBottom: "1rem" }}>
  Leave
</button>

<button
  onClick={() => setView("joker")}
  style={{
    marginBottom: "1rem",
    backgroundColor: "darkred",
    color: "white",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    fontWeight: "bold"
  }}
>  
  Submit Joker Task
</button>
<button
  onClick={() => setView("score")}
  style={{
    marginBottom: "1rem",
    backgroundColor: "darkgreen",
    color: "white",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    fontWeight: "bold"
  }}
>
  Score Joker Tasks
</button>

      {scavengerTasks.map((task) => (
        <div key={task.id} style={{ marginBottom: "0.75rem" }}>
                    <button
            disabled={!!completed[task.id]}
            onClick={async () => {
  if (completed[task.id]) return;

  const updated = { ...completed, [task.id]: true };

  try {
    await setDoc(
  doc(db, "derbySubmissions", playerName),
  { scavengerTasks: updated },
  { merge: true }
);
markTaskComplete(playerName, task.id); // <- update local context state

  } catch (err) {
    console.error("Error saving scavenger task to Firestore:", err);
  }
}}


            style={{
              backgroundColor: completed[task.id] ? "#444" : "#222",
              color: "#fff",
              border: "2px solid gold",
              borderRadius: "10px",
              padding: "0.6rem 1rem",
              width: "100%",
              textAlign: "left",
              fontWeight: "bold",
              cursor: completed[task.id] ? "not-allowed" : "pointer"
            }}
          >
            {completed[task.id] ? "✔️ " : "🟢 "}
            {task.title} — {task.points} pt{task.points !== 1 && "s"}
          </button>
        </div>
      ))}
    </div>
  );
}
