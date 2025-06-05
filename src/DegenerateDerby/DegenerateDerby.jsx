import React, { useState } from "react";
import ScavengerHunt from "./ScavengerHunt";
import { useDerby } from "./DerbyContext";
import ShotgunShowdown from "./ShotgunShowdown";
import CocktailComp from "./CocktailComp";

export default function DegenerateDerby({ playerName, setGameSelected }) {
  const [view, setView] = useState("menu");
  const { resetJokerData, resetShotgunShowdown } = useDerby();

  const [playerCount, setPlayerCount] = useState(8);
  const isRaul = playerName?.toLowerCase() === "raul";

  const applyPlayerCount = () => {
    const newPlayers = Array.from({ length: playerCount }, (_, i) => `Player ${i + 1}`);
    setDerbyState((prev) => ({
      ...prev,
      players: newPlayers
    }));
  };

  if (view === "scavenger") return <ScavengerHunt playerName={playerName} goBack={() => setView("menu")} />;
  if (view === "shotgun") return <ShotgunShowdown playerName={playerName} goBack={() => setView("menu")} />;
  if (view === "cockfight") return <CocktailComp playerName={playerName} goBack={() => setView("menu")} />;


  //if (view === "shotgun") return <shotgunShowdown playerName={playerName} goBack={() => setView("menu")} />;
  //if (view === "cockfight") return <CocktailComp playerName={playerName} goBack={() => setView("menu")} />;

  return (
    <div style={{ textAlign: "center", padding: "1rem" }}>
      {isRaul && (
  <div>
    <label>Set number of players: </label>
    <input
      type="number"
      min="2"
      max="100"
      value={playerCount}
      onChange={(e) => setPlayerCount(Number(e.target.value))}
    />
    <button onClick={applyPlayerCount}>Apply</button>
  </div>
)}

  {isRaul && (
    <button
      style={{
          background: "#800", color: "white", marginBottom: "1rem",
          borderRadius: "8px", padding: "0.6rem 1.2rem", fontWeight: "bold" }}
      onClick={resetJokerData}
    >
      Reset Dash Data
    </button>
  )}
{
    isRaul && (
      <button
        style={{
          background: "#800", color: "white", marginBottom: "1rem",
          borderRadius: "8px", padding: "0.6rem 1.2rem", fontWeight: "bold"
        }}
        onClick={() => {
          if (window.confirm("Are you sure you want to reset the tournament? This cannot be undone.")) {
            resetShotgunShowdown();
          }
        }}
      >
        Reset Showdown
      </button>
    )
  }


      <h2>Degenerate Derby</h2>
      <button 
        className="button-burgundy"
        onClick={() => setGameSelected("")} style={{ marginTop: "1rem" }}>
        Leave
      </button>
      <br />
      <button onClick={() => setView("scavenger")}>Derby Dash</button>
      <button onClick={() => setView("shotgun")}>Shotgun Showdown</button>
      <button onClick={() => setView("cockfight")}>Cockfight</button>
    </div>
  );
}
