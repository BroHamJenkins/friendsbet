import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  getDoc,
  deleteDoc,
  query,
  where
} from "firebase/firestore";

function App() {
  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState("prop");
  const [roomList, setRoomList] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [hasEnteredName, setHasEnteredName] = useState(false);
  const [scenarios, setScenarios] = useState([]);
  const [newScenario, setNewScenario] = useState("");
  const [outcomeInputs, setOutcomeInputs] = useState({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "rooms"), (snapshot) => {
      const rooms = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRoomList(rooms);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedRoom) return;
    const q = collection(db, "rooms", selectedRoom.id, "scenarios");
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedScenarios = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            outcomes: data.outcomes || {},
            votes: data.votes || {},
            winner: data.winner || null,
            launched: data.launched || false,
            order: data.order || [],
          };
        })
      );
      setScenarios(fetchedScenarios);
    });
    return () => unsubscribe();
  }, [selectedRoom]);

  const createRoom = async () => {
    if (!roomName.trim()) return;
    const newRoomRef = doc(collection(db, "rooms"));
    await setDoc(newRoomRef, {
      name: roomName,
      createdAt: serverTimestamp(),
      type: roomType
    });
    setRoomName("");
  };

  const joinRoom = (room) => {
    setSelectedRoom(room);
    localStorage.setItem("lastRoomId", room.id);
  };

  const addScenario = async () => {
    if (!newScenario.trim() || !selectedRoom) return;
    await addDoc(collection(db, "rooms", selectedRoom.id, "scenarios"), {
      description: newScenario,
      createdAt: serverTimestamp(),
      creator: playerName,
      outcomes: {},
      votes: {},
      winner: null,
      launched: false,
      order: [],
    });
    setNewScenario("");
  };

  const addOutcome = async (scenarioId) => {
    const input = outcomeInputs[scenarioId]?.trim();
    if (!input) return;
    const scenarioRef = doc(db, "rooms", selectedRoom.id, "scenarios", scenarioId);
    const snap = await getDoc(scenarioRef);
    const data = snap.data();
    if (data.creator !== playerName || data.launched) return;
    const outcomes = data.outcomes || {};
    const order = data.order || [];
    const newKey = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    outcomes[newKey] = input;
    order.push(newKey);
    await updateDoc(scenarioRef, { outcomes, order });
    setOutcomeInputs((prev) => ({ ...prev, [scenarioId]: "" }));
  };

  const voteOutcome = async (scenarioId, outcomeKey) => {
    const scenarioRef = doc(db, "rooms", selectedRoom.id, "scenarios", scenarioId);
    const snap = await getDoc(scenarioRef);
    const data = snap.data();
    if (!data.launched || data.winner) return;
    const votes = data.votes || {};
    votes[playerName] = outcomeKey;
    await updateDoc(scenarioRef, { votes });
  };

  const declareWinner = async (scenarioId, outcomeKey) => {
    const scenarioRef = doc(db, "rooms", selectedRoom.id, "scenarios", scenarioId);
    const snap = await getDoc(scenarioRef);
    const data = snap.data();
    if (data.creator !== playerName || !data.launched) return;
    await updateDoc(scenarioRef, { winner: outcomeKey });
  };

  const closePoll = async (scenarioId) => {
  const scenarioRef = doc(db, "rooms", selectedRoom.id, "scenarios", scenarioId);
  const snap = await getDoc(scenarioRef);
  const data = snap.data();
  if (data.creator !== playerName || !data.launched || data.winner) return;

  const tally = {};
  Object.values(data.votes || {}).forEach((vote) => {
    if (vote in data.outcomes) {
      tally[vote] = (tally[vote] || 0) + 1;
    }
  });

  const sorted = Object.entries(tally).sort(([, aVotes], [, bVotes]) => bVotes - aVotes);
  if (!sorted.length) return;

  const highestVoteCount = sorted[0][1];
  const topOutcomes = sorted.filter(([, count]) => count === highestVoteCount).map(([key]) => key);

  await updateDoc(scenarioRef, { winner: topOutcomes });
};

  const launchScenario = async (scenarioId) => {
    const scenarioRef = doc(db, "rooms", selectedRoom.id, "scenarios", scenarioId);
    const snap = await getDoc(scenarioRef);
    const data = snap.data();
    if (data.creator !== playerName || data.launched) return;
    await updateDoc(scenarioRef, { launched: true });
  };

  const deleteRoom = async (roomId) => {
    if (playerName !== "Raul") return;
    await deleteDoc(doc(db, "rooms", roomId));
    setSelectedRoom(null);
  };

  const propRooms = roomList.filter(r => r.type !== "poll");
  const pollRooms = roomList.filter(r => r.type === "poll");

  return (
    <div style={{ maxWidth: "600px", margin: "auto", padding: "1rem", fontFamily: "Arial, sans-serif" }}>
      {!hasEnteredName ? (
        <div>
          <h2>Enter Your Name</h2>
          <input
            placeholder="Your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          <button onClick={() => playerName.trim() && setHasEnteredName(true)}>Continue</button>
        </div>
      ) : !selectedRoom ? (
        <div>
          <input
            placeholder="New room name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
          <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
            <option value="prop">Proposition</option>
            <option value="poll">Poll</option>
          </select>
          <button onClick={createRoom}>Create Room</button>
          <h3>Join a proposition room:</h3>
          <ul>
            {propRooms.map((room) => (
              <li key={room.id}>
                <button onClick={() => joinRoom(room)}>{room.name}</button>
                {playerName === "Raul" && (
                  <button onClick={() => deleteRoom(room.id)} style={{ marginLeft: "1rem" }}>Delete</button>
                )}
              </li>
            ))}
          </ul>
          <h3>Join a poll room:</h3>
          <ul>
            {pollRooms.map((room) => (
              <li key={room.id}>
                <button onClick={() => joinRoom(room)}>{room.name}</button>
                {playerName === "Raul" && (
                  <button onClick={() => deleteRoom(room.id)} style={{ marginLeft: "1rem" }}>Delete</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div>
          <button onClick={() => setSelectedRoom(null)}>Leave Room</button>
          <h2>Room: {selectedRoom.name}</h2>
          <p>Logged in as: {playerName}</p>
          <input
            placeholder="New scenario"
            value={newScenario}
            onChange={(e) => setNewScenario(e.target.value)}
          />
          <button onClick={addScenario}>Add Scenario</button>
          {scenarios.map((sc) => (
            <div key={sc.id} style={{ border: "1px solid #ccc", padding: "0.5rem", marginTop: "1rem" }}>
              <strong>{sc.description}</strong>
              <div>
                {(sc.order || Object.keys(sc.outcomes)).map((key) => {
                  const val = sc.outcomes[key];
                  const voters = Object.entries(sc.votes || {})
                    .filter(([, vote]) => vote === key)
                    .map(([voter]) => voter);
                  const isWinner = sc.winner === key;
                  const userVoted = sc.votes[playerName] === key;
                  return (
                    <div key={key} style={{ color: isWinner ? "green" : "inherit" }}>
                      {val}
                      {sc.launched && !sc.winner && (
                        <button
                          onClick={() => voteOutcome(sc.id, key)}
                          style={{ marginLeft: "0.5rem", backgroundColor: userVoted ? "yellow" : "" }}
                        >
                          Vote
                        </button>
                      )}
                      {isWinner && <span style={{ marginLeft: "0.5rem" }}>(Winner)</span>}
                    </div>
                  );
                })}
                {sc.creator === playerName && !sc.launched && (
                  <div>
                    <input
                      placeholder="New outcome"
                      value={outcomeInputs[sc.id] || ""}
                      onChange={(e) => setOutcomeInputs({ ...outcomeInputs, [sc.id]: e.target.value })}
                    />
                    <button onClick={() => addOutcome(sc.id)}>Add Outcome</button>
                  </div>
                )}
                {sc.creator === playerName && !sc.launched && (
                  <button onClick={() => launchScenario(sc.id)}>Launch</button>
                )}
                {selectedRoom.type === "prop" && sc.creator === playerName && sc.launched && !sc.winner && (
                  <div>
                    <p>Declare Winner:</p>
                    {(sc.order || Object.keys(sc.outcomes)).map((key) => (
                      <button key={key} onClick={() => declareWinner(sc.id, key)}>{sc.outcomes[key]}</button>
                    ))}
                  </div>
                )}
                {selectedRoom.type === "poll" && sc.creator === playerName && sc.launched && !sc.winner && (
                  <button onClick={() => closePoll(sc.id)}>Close Poll</button>
                )}
                {sc.winner && (
                  <div>
                    <p>Votes:</p>
                    {(sc.order || Object.keys(sc.outcomes)).map((key) => {
                      const voters = Object.entries(sc.votes || {})
                        .filter(([, vote]) => vote === key)
                        .map(([voter]) => voter);
                      const isWinner = sc.winner === key;
                      return (
                        <div key={key} style={{ color: isWinner ? "green" : "inherit" }}>
                          {sc.outcomes[key]}: {voters.join(", ") || "No votes"}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
