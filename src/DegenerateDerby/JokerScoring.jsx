import React, { useState, useEffect } from "react";
import { useDerby } from "./DerbyContext";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function JokerScoring({ playerName, goBack }) {
  const { derbyState, scoreJoker } = useDerby();
  const [myVote, setMyVote] = useState({});
  const [allVotes, setAllVotes] = useState({});

  useEffect(() => {
    const fetchVotes = async () => {
      const snap = await getDoc(doc(db, "jokerVotes", playerName));
      if (snap.exists()) setMyVote(snap.data());

      const allVotesSnap = await getDoc(doc(db, "jokerVotes", "_allVotes"));
      if (allVotesSnap.exists()) setAllVotes(allVotesSnap.data());
    };
    fetchVotes();
  }, [playerName]);

  const handleScore = async (entryPlayer, score) => {
  if (myVote[entryPlayer]) return; // Prevent changing vote

  try {
    // Save individual vote to personal doc
    await setDoc(doc(db, "jokerVotes", playerName), { [entryPlayer]: score }, { merge: true });

    // Save vote in _allVotes collection
    const updatedVotes = {
      ...(allVotes[entryPlayer] || {}),
      [playerName]: score,
    };
    await setDoc(
      doc(db, "jokerVotes", "_allVotes"),
      { [entryPlayer]: updatedVotes },
      { merge: true }
    );

    // ✅ Call the main scoring function and check result
    const success = await scoreJoker(entryPlayer, score, playerName);
    if (!success) return;  // 🔒 Block UI update if not allowed

    setMyVote((prev) => ({ ...prev, [entryPlayer]: score }));
    setAllVotes((prev) => ({
      ...prev,
      [entryPlayer]: updatedVotes,
    }));
  } catch (err) {
    console.error("Error saving joker vote:", err);
  }
};


  const allVoters = derbyState.players || [];

  const isVotingComplete = (entryPlayer) => {
    const votesForEntry = allVotes[entryPlayer] || {};
    return allVoters.every((voter) => votesForEntry[voter]);
  };

  const calculateResults = (entryPlayer) => {
    const votes = Object.values(allVotes[entryPlayer] || {});
    const total = votes.reduce((sum, val) => sum + val, 0);
    const avg = votes.length ? (total / votes.length).toFixed(2) : "0.00";
    return { total, avg };
  };

  return (
    <div>
      <h2>Score Joker Submissions</h2>
      <button 
        className="button-burgundy"
        onClick={goBack}>Leave</button>
      {derbyState.jokerSubmissions.map((entry, index) => {
        const hasVoted = !!myVote[entry.player];
        const votingClosed = isVotingComplete(entry.player);

        return (
          <div key={index} style={{ color:"white", marginBottom: "1rem", padding: "1rem", border: "1px solid #ccc" }}>
            <p><strong>{entry.player}</strong> submitted:</p>
            <p style={{ fontStyle: "italic" }}>{entry.text}</p>

            {!votingClosed ? (
  entry.player === playerName ? (
    <p style={{ color: "gray", fontStyle: "italic" }}>
      You cannot vote on your own submission.
    </p>
  ) : (
    <div>
      <span>Score: </span>
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          onClick={() => handleScore(entry.player, score)}
          disabled={hasVoted}
          style={{
            margin: "0.25rem",
            padding: "0.3rem 0.6rem",
            borderRadius: "5px",
            backgroundColor: myVote[entry.player] === score ? "gold" : "#222",
            color: myVote[entry.player] === score ? "black" : "white",
            border: "1px solid gold"
          }}
        >
          {score}
        </button>
      ))}
      {hasVoted && (
        <p style={{ marginTop: "0.5rem", color: "lime" }}>
          You voted: {myVote[entry.player]}
        </p>
      )}
    </div>
  )
) : (

              <div style={{ marginTop: "0.5rem", color: "#0f0", borderTop: "1px solid #666", paddingTop: "0.5rem" }}>
                <p><strong>Voting complete!</strong></p>
                <p>Total Score: {calculateResults(entry.player).total}</p>
                <p>Average Score: {calculateResults(entry.player).avg}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
