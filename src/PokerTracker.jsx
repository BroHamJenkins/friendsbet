import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, addDoc, doc, updateDoc, getDoc,
  onSnapshot, serverTimestamp, query, where
} from "firebase/firestore";

const PokerTracker = ({ playerName, setGameSelected }) => {

  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [newSessionName, setNewSessionName] = useState("");


  // Load active sessions
  useEffect(() => {
    const q = query(collection(db, "pokerGames"), where("isActive", "==", true));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSessions(list);
    });
  }, []);

  // Load players if in a session
  useEffect(() => {
    if (!selectedSession) return;
    const q = collection(db, "pokerGames", selectedSession.id, "players");
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPlayers(list);
    });
  }, [selectedSession]);

  const startSession = async () => {
    if (!newSessionName.trim()) return;
    const docRef = await addDoc(collection(db, "pokerGames"), {
      name: newSessionName.trim(),
      createdBy: playerName,
      createdAt: serverTimestamp(),
      isActive: true
    });
    setSelectedSession({ id: docRef.id, name: newSessionName.trim(), createdBy: playerName });
    setNewSessionName("");
  };

  const joinSession = (session) => {
    setSelectedSession(session);
  };

  const addPlayerBuyIn = async (playerId, amount) => {
    const ref = doc(db, "pokerGames", selectedSession.id, "players", playerId);
    const snap = await getDoc(ref);
    const data = snap.data();
    const updated = {
      rebuys: [...(data.rebuys || []), amount]
    };
    await updateDoc(ref, updated);
  };

  const addNewPlayer = async () => {
    const existing = players.find(p => p.name === playerName);
    if (existing) return;
    await addDoc(collection(db, "pokerGames", selectedSession.id, "players"), {
      name: playerName,
      buyIn: 0,
      rebuys: [],
      cashOut: 0
    });
  };

  const updateBuyIn = async (playerId, amount) => {
    await updateDoc(doc(db, "pokerGames", selectedSession.id, "players", playerId), {
      buyIn: amount
    });
  };

  const updateCashOut = async (playerId, amount) => {
    await updateDoc(doc(db, "pokerGames", selectedSession.id, "players", playerId), {
      cashOut: amount
    });
  };

  const leaveSession = () => {
    setSelectedSession(null);
    setPlayers([]);
  };

  return (
    <div>
      {!selectedSession ? (
        <div>
          <h2>Active Poker Games</h2>
          <ul>
            {sessions.map((s) => (
              <li 
              style={{ color: "white"}}
              key={s.id}>
                {s.name} (created by {s.createdBy})
                <button onClick={() => joinSession(s)}>Join</button>
              </li>
            ))}
          </ul>
          <input
            placeholder="New Session Name"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
          />
          <button onClick={startSession}>Start Game</button>
        </div>
      ) : (
        <div>
          <h2>{selectedSession.name}</h2>
          <p>Created by: {selectedSession.createdBy}</p>
          <button onClick={leaveSession}>Leave</button>
          <button onClick={addNewPlayer}>Join Table</button>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Buy-In</th>
                <th>Rebuys</th>
                <th>Cash-Out</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const totalBuyIn = (p.buyIn || 0) + (p.rebuys || []).reduce((a, b) => a + b, 0);
                const net = (p.cashOut || 0) - totalBuyIn;

                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      {selectedSession.createdBy === playerName ? (
                        <input
                          type="number"
                          value={p.buyIn}
                          onChange={(e) => updateBuyIn(p.id, Number(e.target.value))}
                          style={{ width: "60px" }}
                        />
                      ) : (
                        `$${p.buyIn}`
                      )}
                    </td>
                    <td>
                      {p.rebuys?.join(", ") || "-"}
                      {selectedSession.createdBy === playerName && (
                        <button
                          onClick={() => {
                            const amt = prompt("Enter rebuy amount");
                            if (amt) addPlayerBuyIn(p.id, Number(amt));
                          }}
                          style={{ marginLeft: "0.5rem" }}
                        >
                          +
                        </button>
                      )}
                    </td>
                    <td>
                      {selectedSession.createdBy === playerName ? (
                        <input
                          type="number"
                          value={p.cashOut}
                          onChange={(e) => updateCashOut(p.id, Number(e.target.value))}
                          style={{ width: "60px" }}
                        />
                      ) : (
                        `$${p.cashOut}`
                      )}
                    </td>
                    <td style={{ fontWeight: "bold", color: net >= 0 ? "green" : "red" }}>
                      {net >= 0 ? "+" : ""}${net}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PokerTracker;
