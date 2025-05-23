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
import Bank from "./Bank";



const approvedUsers = [
  "David", "Raul", "Christian", "Cole", "Bob", "Will", "Danny", "Ryan", "Luke", "Kaya", "Jake",
  "Sleepy", "Doc", "Bashful", "Dopey", "Grumpy", "Sneezy", "Happy"
];

const normalize = (name) => name.trim().toLowerCase();

const findApprovedName = (inputName) => {
  const normalizedInput = normalize(inputName);
  return approvedUsers.find((name) => normalize(name) === normalizedInput);
};


function App() {
  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState("prop");
  const [roomList, setRoomList] = useState([]);
  const [betAmount, setBetAmount] = useState(10);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [hasEnteredName, setHasEnteredName] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(100);
  const adjustTokens = async (amount) => {
    const newBalance = tokenBalance + amount;
    setTokenBalance(newBalance);
    const playerRef = doc(db, "players", playerName);
    await updateDoc(playerRef, { tokens: newBalance });
  };

  const [gameSelected, setGameSelected] = useState("");
  const [scenarios, setScenarios] = useState([]);
  const [newScenario, setNewScenario] = useState("");
  const [outcomeInputs, setOutcomeInputs] = useState({});
  const [showDeclareButtons, setShowDeclareButtons] = useState({});   //Ends voting and shows declare winner buttons
  const toggleDeclareButtons = (scenarioId) => {
    setShowDeclareButtons(prev => ({
      ...prev,
      [scenarioId]: !prev[scenarioId]
    }));
  };



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

  useEffect(() => {
    if (!playerName) return;

    const playerRef = doc(db, "players", playerName);

    getDoc(playerRef).then((docSnap) => {
      if (docSnap.exists()) {
        setTokenBalance(docSnap.data().tokens || 100);
      } else {
        setDoc(playerRef, { tokens: 100 });
        setTokenBalance(100);
      }
    });
  }, [playerName]);

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
      betAmount: betAmount || 10
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
    const alreadyVoted = votes.hasOwnProperty(playerName);
    votes[playerName] = outcomeKey;
    await updateDoc(scenarioRef, { votes });
    if (!alreadyVoted) {
  const betAmount = data.betAmount || 10;
  adjustTokens(-betAmount);

  await addDoc(collection(db, "players", playerName, "transactions"), {
    type: "wager",
    amount: -betAmount,
    scenarioId,
    scenarioText: data.description,
    timestamp: serverTimestamp()
  });
}


  };

  const declareWinner = async (scenarioId, outcomeKey) => {
    const scenarioRef = doc(db, "rooms", selectedRoom.id, "scenarios", scenarioId);
    const snap = await getDoc(scenarioRef);
    const data = snap.data();
    if (data.creator !== playerName || !data.launched) return;
    await updateDoc(scenarioRef, { winner: outcomeKey });
    await distributeWinnings(scenarioId);
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
    await distributeWinnings(scenarioId);
  };

  const distributeWinnings = async (scenarioId) => {          //Winner Payout
    //debugging line
    console.log("💥 distributeWinnings called for", scenarioId);
    const scenarioRef = doc(db, "rooms", selectedRoom.id, "scenarios", scenarioId);
    const snap = await getDoc(scenarioRef);
    const data = snap.data();

    if (!data.winner || !data.votes) return;

    const votes = data.votes;
    const winnerKey = data.winner;
    const winningVoters = Object.entries(votes)
      .filter(([, choice]) =>
        Array.isArray(data.winner) ? data.winner.includes(choice) : choice === data.winner
      )
      .map(([player]) => player);

    const betAmount = data.betAmount || 10;
    const totalPot = Object.keys(votes).length * betAmount;
    const payout = winningVoters.length > 0 ? Math.floor(totalPot / winningVoters.length) : 0;


   
    if (winningVoters.length > 0) {
  if (winningVoters.includes(playerName)) {
    adjustTokens(payout);
      await addDoc(collection(db, "players", playerName, "transactions"), {
    type: "payout",
    amount: payout,
    scenarioId,
    scenarioText: data.description,
    timestamp: serverTimestamp()
  });

    console.log(`Awarded ${payout} tokens to ${playerName}`);
  }
} else {
  // Refund all players
    if (Object.keys(votes).includes(playerName)) {
      adjustTokens(betAmount);
        await addDoc(collection(db, "players", playerName, "transactions"), {
    type: "refund",
    amount: betAmount,
    scenarioId,
    scenarioText: data.description,
    timestamp: serverTimestamp()
  });

      console.log(`Refunded ${betAmount} tokens to ${playerName} (no winner)`);
    }
  }
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
    <div
      style={{
        backgroundImage: "url('/background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",
        padding: "2rem",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {!hasEnteredName ? (
        <div>
          <h2>Enter Your Name</h2>
          <input
            placeholder="Your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          <button onClick={() => {
            const matchedName = findApprovedName(playerName);
            if (matchedName) {
              setPlayerName(matchedName);
              setHasEnteredName(true);
            } else {
              alert("Name not recognized. Please enter an approved name.");
            }
          }}>Continue</button>
        </div>
      ) : !gameSelected ? (
        <div>
          <h2>Select a Game</h2>
          <select onChange={(e) => setGameSelected(e.target.value)} defaultValue="">
            <option value="" disabled>Select a game</option>
            <option value="Casino">Casino</option>
            <option value="Beach Olympics">Beach Olympics</option>
            <option value="Road Trip Mayhem">Road Trip Mayhem</option>
            <option value="Bank">Bank</option>
          </select>
        </div>

      ) : gameSelected === "Bank" ? (
        <div>
          <button onClick={() => setGameSelected("")}>Leave Bank</button>
          <Bank playerName={playerName} />
        </div>
      ) : gameSelected === "Beach Olympics" ? (
        <div>
          <h2>Beach Olympics</h2>
          <button onClick={() => setGameSelected("")}>Leave Olympics</button>
        </div>
      ) : gameSelected === "Road Trip Mayhem" ? (
        <div>
          <h2>Road Trip Mayhem</h2>
          <button onClick={() => setGameSelected("")}>Leave Roadtrip Mayhem</button>
        </div>




      ) : !selectedRoom ? (
        <div>
          <button onClick={() => setGameSelected("")}>Leave Game</button>

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
          <button onClick={() => setSelectedRoom(null)}>Leave Casino</button>
          <h2>Room: {selectedRoom.name}</h2>
          <p className="status-line">Welcome back, {playerName}!</p>
<p className="status-line token-balance">Casino Balance: {tokenBalance}</p>

          <input
            placeholder="New scenario"
            value={newScenario}
            onChange={(e) => setNewScenario(e.target.value)}
          />

          <input
            type="number"
            placeholder="Bet amount"
            value={betAmount}
            onChange={(e) => setBetAmount(Number(e.target.value))}
          />


          <button onClick={addScenario}>Add Scenario</button>
          {scenarios.map((sc) => (
            <div key={sc.id} className="scenario-box">
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
                      {!sc.launched && <span>{val}</span>}
                      {sc.launched && !sc.winner && (
                        <button
                          onClick={() => voteOutcome(sc.id, key)}
                          style={{ marginLeft: "0.5rem", backgroundColor: userVoted ? "yellow" : "" }}
                        >
                          {val}
                        </button>
                      )}

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
                    {!showDeclareButtons[sc.id] ? (
                      <button onClick={() => toggleDeclareButtons(sc.id)}>End All Bets</button>
                    ) : (
                      <>
                        <p>Declare Winner:</p>
                        {(sc.order || Object.keys(sc.outcomes)).map((key) => (
                          <button key={key} onClick={() => declareWinner(sc.id, key)}>
                            {sc.outcomes[key]}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {selectedRoom.type === "poll" && sc.creator === playerName && sc.launched && !sc.winner && (
                  <button onClick={() => closePoll(sc.id)}>Close Poll</button>
                )}
                {sc.winner && (
                  <div>
                    {(sc.order || Object.keys(sc.outcomes)).map((key) => {
                      const val = sc.outcomes[key];
                      const voters = Object.entries(sc.votes || {})
                        .filter(([, vote]) => vote === key)
                        .map(([voter]) => voter);
                      const isWinner = Array.isArray(sc.winner)
                        ? sc.winner.includes(key)
                        : sc.winner === key;
                      return (
                        <div key={key} style={{ color: isWinner ? "green" : "inherit" }}>
                          {val}: {voters.length > 0 ? voters.join(", ") : "No Bets"}{" "}
{isWinner && voters.length === 0
  ? "(Push - All Bets Returned)"
  : isWinner
    ? "(Winner)"
    : ""}

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
