import React, { useState } from "react";
import { useDerby } from "./DerbyContext";

export default function ShotgunShowdown({ playerName, goBack }) {
  const { derbyState, createShotgunShowdownBracket, recordShotgunMatchWinner, resetShotgunShowdown } = useDerby();
  const isRaul = playerName?.toLowerCase() === "raul";
  const [bracketStarted, setBracketStarted] = useState(
    derbyState.shotgunShowdownBracket && derbyState.shotgunShowdownBracket.length > 0
  );



  // Start bracket if not started
  if (!bracketStarted) {
    return (
      <div>

        <h2 style={{ color: "white" }}>Shotgun Showdown</h2>
        {isRaul ? (
          <button onClick={() => {
            createShotgunShowdownBracket();
            setBracketStarted(true);
          }}>Start Tournament</button>
        ) : (
          <p>Waiting for Commissioner to start the tournament.</p>
        )}
        <button onClick={goBack}>Back to Menu</button>
      </div>
    );
  }

  // Display bracket
  const bracket = derbyState.shotgunShowdownBracket;

  // Helper to show matches for a round
  const renderRound = (roundObj, roundNum) => (
    <div key={roundNum} style={{ marginBottom: "1.5rem" }}>
      <h3 style={{ color: "gold" }}>
        {roundObj.round === "loser"
          ? "Loser Bracket"
          : `Round ${roundObj.round}`}
      </h3>
      {roundObj.matches.map((m, idx) => (
        <div key={m.id} style={{
          background: "#222", color: "#fff", borderRadius: "8px",
          padding: "0.5rem", marginBottom: "0.5rem", display: "flex", alignItems: "center"
        }}>
          <span style={{ marginRight: "1rem" }}>
            {m.p1} vs {m.p2}
          </span>
          {m.winner ? (
            <span style={{ color: "lime", marginLeft: "auto" }}>Winner: {m.winner}</span>
          ) : isRaul ? (
            <>
              <button style={{ marginLeft: "auto" }} onClick={() =>
                recordShotgunMatchWinner(roundNum, m.id, m.p1)
              }>{m.p1} Wins</button>
              <button onClick={() =>
                recordShotgunMatchWinner(roundNum, m.id, m.p2)
              }>{m.p2} Wins</button>
            </>
          ) : (
            <span style={{ marginLeft: "auto", color: "#aaa" }}>Pending</span>
          )}
        </div>
      ))}
    </div>
  );

  return (
    
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <img
            src="/PBRLogo.png"
            alt="Pabst Blue Ribbon Logo"
            style={{
              width: "240px", // or whatever size looks right
              display: "block",
              margin: "1rem auto 0rem auto"
            }}
          />
        <p style={{ fontFamily: "Dancing Script", color: "white", textAlign: "center", margin: "0" }}>Presents</p>
        
        
        <h2
  style={{
    fontFamily: "'Oswald', serif",
    fontWeight: 700,
    color: "white",
    textAlign: "center",
    transform: "scaleX(0.85)",
    fontSize: "1.5rem",
    letterSpacing: ".01em",
    textShadow: "2px 2px 0 #223355",
    margin: "0"
  }}
>
The Shotgun Showdown
</h2>

        
        
        {bracket.map((roundObj, idx) => renderRound(roundObj, idx + 1))}
        <button onClick={goBack} style={{ marginTop: "2rem" }}>Back to Menu</button>
      </div>
    
  );
}

