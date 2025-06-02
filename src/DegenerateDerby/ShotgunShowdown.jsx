import React from "react";

export default function ShotgunShowdown({ playerName, goBack }) {
  return (
    <div>
      
      <h2 style={{ textAlign: "center", color:"white"}}>Shotgun Showdown</h2>
      <p style={{ textAlign: "center", color:"white"}}>
        I'ma need you to take this beer to pound town, {playerName}!</p>
      <button onClick={goBack}>Back to Menu</button>
    </div>
  );
}
