import React from "react";

export default function CocktailComp({ playerName, goBack }) {
  return (
    <div>
      <h1 style={{ textAlign: "center", color:"white"}}>Cocktail Competition</h1>
      <p style={{ textAlign: "center", color:"white"}}>Shake it up, {playerName}!</p>
      <button onClick={goBack}>Back to Menu</button>
    </div>
  );
}
