import React, { useState, useEffect, createContext, useContext } from "react";
import {doc, deleteDoc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase"; // ✅ This imports from firebase.js file
import { collection, getDocs } from "firebase/firestore";



const DerbyContext = createContext();

export function DerbyProvider({ children }) {
  const resetShotgunShowdown = async () => {
  await setDoc(doc(db, "derbyState", "shotgunShowdown"), {
    bracket: [],
    placings: {},
    points: {},
  });

  setDerbyState(prev => ({
    ...prev,
    shotgunShowdownBracket: [],
    shotgunShowdownPlacings: {},
    shotgunShowdownPoints: {},
  }));
};


useEffect(() => {
  const unsub = onSnapshot(doc(db, "derbyState", "shotgunShowdown"), (docSnap) => {
    const data = docSnap.data();
    if (!data) return;
    setDerbyState(prev => ({
      ...prev,
      shotgunShowdownBracket: data.bracket || [],
      shotgunShowdownPlacings: data.placings || {},
      shotgunShowdownPoints: data.points || {},
    }));
  });
  return () => unsub();
}, []);

const createShotgunShowdownBracket = async () => {
  const players = derbyState.players;
  const shuffled = [...players]; // or randomize if you wish

  const round1 = [
    { id: 1, p1: shuffled[0], p2: shuffled[1], winner: null },
    { id: 2, p1: shuffled[2], p2: shuffled[3], winner: null },
    { id: 3, p1: shuffled[4], p2: shuffled[5], winner: null },
    { id: 4, p1: shuffled[6], p2: shuffled[7], winner: null },
  ];

  const bracketData = [
    { round: 1, matches: round1 },
    { round: 2, matches: [] },
    { round: 3, matches: [] },
    { round: "loser", matches: [] },
  ];

  // Update Firestore
  await setDoc(doc(db, "derbyState", "shotgunShowdown"), {
    bracket: bracketData,
    placings: {},
    points: {},
  });

  // Update local state immediately for snappy UI
  setDerbyState(prev => ({
    ...prev,
    shotgunShowdownBracket: bracketData,
    shotgunShowdownPlacings: {},
    shotgunShowdownPoints: {},
  }));
};


const recordShotgunMatchWinner = async (roundNum, matchId, winner) => {
  // Copy and update bracket in memory
  const bracket = JSON.parse(JSON.stringify(derbyState.shotgunShowdownBracket));
  const round = bracket[roundNum - 1];
  const matchIdx = round.matches.findIndex(m => m.id === matchId);
  if (matchIdx === -1) return;
  round.matches[matchIdx].winner = winner;

  // Prepare new data object for Firestore
  const newData = {
    bracket,
    placings: derbyState.shotgunShowdownPlacings,
    points: derbyState.shotgunShowdownPoints,
  };

  // Write to Firestore
  await setDoc(doc(db, "derbyState", "shotgunShowdown"), newData, { merge: true });

  // Local state update for instant feedback
  setDerbyState(prev => ({
    ...prev,
    shotgunShowdownBracket: bracket,
  }));
};


  const resetJokerVotes = async () => {
  const votesCollection = collection(db, "jokerVotes");
  const snapshot = await getDocs(votesCollection);
  const deletePromises = snapshot.docs.map((d) =>
    deleteDoc(doc(db, "jokerVotes", d.id))
  );
  await Promise.all(deletePromises);
  console.log("Cleared all jokerVotes documents");
};
  

  const resetJokerData = async () => {
  try {
    await resetJokerVotes(); // ✅ call the now properly defined function

    await setDoc(
      doc(db, "derbyState", "jokerSubmissions"),
      {
        submissions: [],
        votes: {},
        lockedVotes: {}
      },
      { merge: true }
    );

    setDerbyState((prev) => ({
      ...prev,
      jokerSubmissions: [],
      votes: {},
      lockedVotes: {},
      jokerVotes: {},
      
    }));

    console.log("✅ Joker data fully reset.");
  } catch (err) {
    console.error("❌ Failed to reset joker data:", err);
  }
};



  const markTaskComplete = async (playerName, taskId) => {
  const docRef = doc(db, "derbyState", "jokerSubmissions");

  try {
    const docSnap = await getDoc(docRef);
    const data = docSnap.exists() ? docSnap.data() : {};
    const prevTasks = data?.scavengerTasks?.[playerName] || {};
    const updatedTasks = {
      ...(data.scavengerTasks || {}),
      [playerName]: {
        ...prevTasks,
        [taskId]: true,
      },
    };

    await setDoc(docRef, { scavengerTasks: updatedTasks }, { merge: true });

    setDerbyState(prev => ({
      ...prev,
      scavengerTasks: updatedTasks,
    }));
  } catch (err) {
    console.error("Failed to mark task complete:", err);
  }
};




  const [derbyState, setDerbyState] = useState({
    name: "Degenerate Derby",
    players: ["Jake", "Christian", "David", "Luke", "Bob", "Will", "Danny", "Ryan"],
    tasks: [],
    bracket: [],
    votes: {},
    jokerSubmissions: [],   // [{ player: "David", text: "Jumped off a tiki bar", score: null }]
    heats: [],
    scores: {},
    scavengerProgress: {},
    jokerVotes: {},
    lockedVotes: {},
    shotgunShowdownBracket: [],   // [{round: 1, matches: [ {p1: "Jake", p2: "Christian", winner: null}, ... ]}, ...]
    shotgunShowdownPlacings: {},  // { player: place }
    shotgunShowdownPoints: {}    // { player: points }
  });

useEffect(() => {
  const unsub = onSnapshot(doc(db, "derbyState", "jokerSubmissions"), (docSnap) => {
    const data = docSnap.data();
    if (!data) return;

    setDerbyState((prev) => ({
      ...prev,
      jokerSubmissions: data.submissions || [],
      scavengerTasks: data.scavengerTasks || {},
      lockedVotes: data.lockedVotes || {},
      votes: data.votes || {},


    }));
  });

  const votesUnsub = onSnapshot(doc(db, "derbyState", "jokerVotes"), (docSnap) => {
    const data = docSnap.data();
    if (!data) return;

    setDerbyState((prev) => ({
      ...prev,
      jokerVotes: data,
    }));
  });

  return () => {
    unsub();
    votesUnsub();
  };
}, []);




const submitJoker = async (player, text) => {
  try {
    const newEntry = { player, text };
    const newSubmissions = [...derbyState.jokerSubmissions, newEntry];

    await setDoc(
      doc(db, "derbyState", "jokerSubmissions"),
      { submissions: newSubmissions },
      { merge: true }
    );

    setDerbyState((prev) => ({
      ...prev,
      jokerSubmissions: newSubmissions,
    }));
  } catch (err) {
    console.error("Error submitting Joker:", err);
  }
};


const scoreJoker = async (player, score, voter) => {
  console.log("scoreJoker called with:", { player, score, voter });

   if (player.trim().toLowerCase() === voter.trim().toLowerCase()) {
    console.warn("Submitter cannot vote on their own Joker.");
    return false;
  }
  const jokerRef = doc(db, "derbyState", "jokerSubmissions");

  // Prevent changing vote after lock
  const currentLocked = derbyState.lockedVotes?.[player];
  if (currentLocked) return;

  // Build new votes object
  const prevVotes = derbyState.votes?.[player] || {};
  const updatedVotes = {
    ...prevVotes,
    [voter]: score
  };

const totalPlayers = derbyState.players?.length || 8; // Default to 8 if undefined
const votesNeeded = totalPlayers - 1; // Exclude the Joker performer
const voteCount = Object.keys(updatedVotes).length;
const allVoted = voteCount >= votesNeeded;


  // Update votes (and lock if needed)
  const newVotesState = {
    ...derbyState.votes,
    [player]: updatedVotes
  };

  const newLockedState = {
    ...derbyState.lockedVotes,
    ...(allVoted ? { [player]: true } : {})
  };

  // Push to Firestore
  await setDoc(jokerRef, {
    votes: newVotesState,
    lockedVotes: newLockedState
  }, { merge: true });

  // Update local state
  setDerbyState((prev) => ({
    ...prev,
    votes: newVotesState,
    lockedVotes: newLockedState
  }));

  return true;
};




const recordJokerVote = async (voterName, player, score) => {
  try {
    const docRef = doc(db, "derbyState", "jokerVotes");
    const snap = await getDoc(docRef);
    const prevVotes = snap.exists() ? snap.data().votes || {} : {};

    const updatedVotes = {
      ...prevVotes,
      [voterName]: { player, score },
    };

    await setDoc(docRef, { votes: updatedVotes }, { merge: true });

    setDerbyState((prev) => ({
      ...prev,
      jokerVotes: updatedVotes,
    }));
  } catch (err) {
    console.error("Failed to record joker vote:", err);
  }
};

  return (
    <DerbyContext.Provider value={{
  derbyState,
  setDerbyState,
  markTaskComplete,
  submitJoker,
  scoreJoker,
  recordJokerVote,
  resetJokerData,
  createShotgunShowdownBracket,     
  recordShotgunMatchWinner,
  resetShotgunShowdown    
}}>



      {children}
    </DerbyContext.Provider>
  );
}

export function useDerby() {
  return useContext(DerbyContext);
}

