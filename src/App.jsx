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
  where,
  getDocs
} from "firebase/firestore";
import Bank from "./Bank";
import ParimutuelScenario from "./ParimutuelScenario";



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
  const reloadScenarios = async () => {
  const snapshot = await getDocs(
    collection(db, "rooms", selectedRoom.id, "scenarios")
  );
  const list = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data()
    }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); // newest first
  setScenarios(list);
};


  const [scenarioMode, setScenarioMode] = useState("flat");  
  const [maxBetAmount, setMaxBetAmount] = useState(10);
  const [voteAmounts, setVoteAmounts] = useState({});
  const [showScenarioForm, setShowScenarioForm] = useState(false);
  const [editableRoomName, setEditableRoomName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState("prop");
  const [roomList, setRoomList] = useState([]);
  const [betAmount, setBetAmount] = useState(1);
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
  const toggleDeclareButtons = async (scenarioId) => {
    const current = showDeclareButtons[scenarioId];
    setShowDeclareButtons(prev => ({
      ...prev,
      [scenarioId]: !current
    }));

    if (!current) {
      const scenarioRef = doc(db, "rooms", selectedRoom.id, "scenarios", scenarioId);
      await updateDoc(scenarioRef, { betsClosed: true });
    }
  };


  const casinoMessages = [
    { text: "WELCOME TO", size: "2.2rem" },
    { text: "DANNY'S CASINO", size: "2.2rem" },
    { text: "...And adult lerning center", size: "2.2rem" },
    { text: "Built on HONESTY, INTEGRITY...", size: "2.2rem" },
    { text: "...and thinly veiled spite", size: "2.2rem" },
  ];

  const [headerIndex, setHeaderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeaderIndex((prev) => (prev + 1) % casinoMessages.length);
    }, 4000); // rotate every 4 seconds

    return () => clearInterval(interval); // cleanup
  }, []);


  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "rooms"), (snapshot) => {
      const rooms = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRoomList(rooms);

      if (selectedRoom) {
        const updatedRoom = rooms.find((r) => r.id === selectedRoom.id);
        if (
          updatedRoom &&
          JSON.stringify(updatedRoom) !== JSON.stringify(selectedRoom)
        ) {
          setSelectedRoom(updatedRoom);
        }
      }

    });

    return () => unsubscribe();
  }, [selectedRoom]);


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
      fetchedScenarios.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA; // newest first
      });

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
        setTokenBalance(docSnap.data().tokens ?? 0);

      } else {
        setDoc(playerRef, { tokens: 0 });
        setTokenBalance(0);
      }
    });
  }, [playerName]);

  const joinRoom = (room) => {
    setSelectedRoom(room);
    setEditableRoomName(room.name);  // ← preload editable name
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
  betAmount: betAmount ?? 1,
  minBet: betAmount ?? 1,
  maxBet: maxBetAmount ?? (betAmount ? betAmount * 5 : 10),

  mode: scenarioMode
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
    await reloadScenarios();

  };

  const voteOutcome = async (scenarioId, outcomeKey, betAmountFromUI) => {

    const scenarioRef = doc(db, "rooms", selectedRoom.id, "scenarios", scenarioId);
    const snap = await getDoc(scenarioRef);
    const data = snap.data();
    
    const isPari = data.mode === "pari";
const min = data.minBet ?? 1;
const max = data.maxBet ?? 10;
const betAmount = isPari ? betAmountFromUI : data.betAmount ?? 1;


    if (!data.launched || data.winner || data.betsClosed) return;


    if (isPari && (betAmount < min || betAmount > max)) {

      alert(`Bet must be between ${min} and ${max}`);
      return;
    }

    const votes = data.votes || {};
    const alreadyVoted = votes.hasOwnProperty(playerName);
    if (alreadyVoted) {
      alert("You've already voted.");
      return;
    }

    votes[playerName] = isPari
  ? { choice: outcomeKey, amount: betAmount }
  : outcomeKey;


    await updateDoc(scenarioRef, { votes });
    adjustTokens(-betAmount);

    await addDoc(collection(db, "players", playerName, "transactions"), {
      type: "wager",
      amount: -betAmount,
      scenarioId,
      scenarioText: data.description,
      timestamp: serverTimestamp()
    });
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

    const betAmount = data.betAmount ?? 1;
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
  const vote = votes[playerName];
  const refund = data.mode === "pari"
    ? vote?.amount || 0
    : data.betAmount ?? 1;

  adjustTokens(refund);
  await addDoc(collection(db, "players", playerName, "transactions"), {
    type: "refund",
    amount: refund,
    scenarioId,
    scenarioText: data.description,
    timestamp: serverTimestamp()
  });
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
        backgroundImage:
          gameSelected === "Casino"
            ? "url('/casinoBackground.jpg')"
            : "url('/background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",   
        height: "100vh",
overflowY: "auto",
        padding: "2rem",
        fontFamily: "Arial, sans-serif",
      }}

    >
      {gameSelected === "Casino" && (
        <>
          {/* Logo centered */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "1rem",
              position: "relative"
            }}
          >
            <img
              src="/Logo Icon-01.png"
              alt="Uncle Casino"
              style={{
                width: "180px",
                maxWidth: "90%",
                animation: "flickerGlow 5s ease-in-out infinite"
              }}
            />
          </div>

          {/* Bubble fixed in upper-right corner */}
          <div
            style={{
              position: "fixed",
              top: "1rem",
              right: "1rem",
              width: "80px",
              height: "80px",
              zIndex: 1000
            }}
          >
            <img
              src="/chat_bubble_large.png"
              alt="Balance Bubble"
              style={{
                width: "100%",
                height: "100%",
                animation: "bubbleGlow 2s ease-in-out infinite"
              }}
            />

            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontFamily: "'Orbitron', sans-serif",
                fontSize: "1.6rem",
                fontWeight: "bold",
                color: "#FF3C3C", // vivid red
                letterSpacing: "1px",
                textShadow: `
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      1px 1px 0 #000,
      0 0 6px #FFB800,
      0 0 12px #FF8C00
    `
              }}
            >
              ${tokenBalance}
            </div>


          </div>


          {/* <div
      style={{
        overflow: "hidden",
        whiteSpace: "nowrap",
        marginBottom: "1rem",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        borderRadius: "10px",
        padding: "1rem",
      }}
    >
      <div
        style={{
          display: "inline-block",
          animation: "marqueeScroll 20s linear infinite",
          fontFamily: "'Limelight', cursive",
          fontSize: "2.2rem",
          color: "#FFD700",
          textShadow:
            "0 0 5px #FFD700, 0 0 10px #FFB800, 0 0 20px #FFB800, 0 0 40px #FFA500",
        }}
      >
        WELCOME TO DANNY'S CASINO and Adult Lerning Center
               &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
               &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
               &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          Built on HONESTY, INTEGRITY, and pure, unmitigated spite
      </div>
    </div> */}
        </>
      )}




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
        <div style={{ textAlign: "center" }}>
          <img
            src="/blue-god.png"
            alt="Beach Olympics Mascot"
            style={{
              maxWidth: "200px",
              width: "100%",
              height: "auto",
              marginBottom: "1rem"
            }}
          />
          <h2 style={{ fontFamily: "'Orbitron', sans-serif", color: "#FFA500" }}>
            Beach Olympics
          </h2>
          <button onClick={() => setGameSelected("")}>Leave Olympics</button>
        </div>

      ) : gameSelected === "Road Trip Mayhem" ? (
        <div>
          <h2>Road Trip Mayhem</h2>
          <button onClick={() => setGameSelected("")}>Leave Roadtrip Mayhem</button>
        </div>




      ) : !selectedRoom ? (
        <div>






          <button
            className="casino-button-gold"
            onClick={() => setGameSelected("")}
          >
            Leave Casino

          </button>

          {playerName === "Raul" && (
            <>
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
            </>
          )}

          <h3 style={{ textAlign: "center" }}>Where to, Boss?</h3>

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





          {playerName === "Raul" ? (
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <input
                type="text"
                value={editableRoomName}
                onChange={(e) => setEditableRoomName(e.target.value)}
                style={{
                  fontFamily: "'Limelight', cursive",
                  fontSize: "2.4rem",
                  textAlign: "center",
                  border: "2px solid #FF3C3C",
                  borderRadius: "6px",
                  padding: "0.25rem 0.5rem",
                  color: "#FF3C3C",
                  textShadow: "0 0 5px #FFD700, 0 0 10px #FFB800, 0 0 20px #FF8C00, 0 0 40px #FF3C3C"
                }}
              />
              <button
                onClick={async () => {
                  const roomRef = doc(db, "rooms", selectedRoom.id);
                  await updateDoc(roomRef, { name: editableRoomName });
                }}
                style={{
                  marginLeft: "0.75rem",
                  padding: "0.4rem 1rem",
                  fontSize: "1rem",
                  cursor: "pointer"
                }}
              >
                Save
              </button>
            </div>
          ) : (
            <h2 className="room-name-display">{selectedRoom.name}</h2>
          )}
          <button onClick={() => setSelectedRoom(null)}>
            Leave {selectedRoom?.name}
          </button>
          <p className="status-line">Welcome back, {playerName}!</p>




          {!showScenarioForm ? (
            <button onClick={() => setShowScenarioForm(true)}>
              + New Prop Bet
            </button>
          ) : (
            <div style={{ marginBottom: "1rem" }}>
              <input
                placeholder="New Prop Bet"
                value={newScenario}
                onChange={(e) => setNewScenario(e.target.value)}
              />
              <input
                type="number"
                placeholder="Min Bet"
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                style={{ width: "7rem", marginRight: "0.5rem" }}
              />
              <input
                type="number"
                placeholder="Max Bet"
                value={maxBetAmount}
                onChange={(e) => setMaxBetAmount(Number(e.target.value))}
                style={{ width: "7rem", marginRight: "0.5rem" }}
              />
              <select
  value={scenarioMode}
  onChange={(e) => setScenarioMode(e.target.value)}
  style={{ margin: "0.5rem 0" }}
>
  <option value="flat">Flat</option>
  <option value="pari">Parimutuel</option>
</select>

              <button onClick={addScenario}>Create Choices</button>
              <button onClick={() => setShowScenarioForm(false)} style={{ marginLeft: "0.5rem" }}>
                Cancel
              </button>
            </div>
          )}

          {scenarios.map((sc) => (
            <div key={sc.id} className="scenario-box">
  {sc.mode === "pari" ? (
    <ParimutuelScenario
  scenario={sc}
  playerName={playerName}
  voteAmounts={voteAmounts}
  setVoteAmounts={setVoteAmounts}
  voteOutcome={voteOutcome}
  outcomeInputs={outcomeInputs}
  setOutcomeInputs={setOutcomeInputs}
  addOutcome={addOutcome}
  launchScenario={launchScenario}
  selectedRoom={selectedRoom}
  showDeclareButtons={showDeclareButtons}
  toggleDeclareButtons={toggleDeclareButtons}
  declareWinner={declareWinner}
/>


  ) : (
    <>
      <strong>{sc.description}</strong>
      <div style={{ fontStyle: "italic", marginBottom: "0.5rem" }}>
        Min. Bet: ${sc.betAmount ?? 1}
      </div>

      <div>
        {(sc.order || Object.keys(sc.outcomes)).map((key) => {
          const val = sc.outcomes[key];
          const voters = Object.entries(sc.votes || {})
            .filter(([, vote]) => vote === key)
            .map(([voter]) => voter);
          const isWinner = sc.winner === key;
          const userVoted =
  sc.mode === "pari"
    ? sc.votes[playerName]?.choice === key
    : sc.votes[playerName] === key;

          return (
            <div key={key} style={{ color: isWinner ? "green" : "inherit" }}>
              {!sc.launched && <span>{val}</span>}
              {sc.launched && !sc.winner && !sc.betsClosed && (
                <button
                  type="button"
                  onClick={() => voteOutcome(sc.id, key)}


                  className={`casino-button-gold ${userVoted ? "voted-button" : ""}`}
                  style={{ marginLeft: "0.5rem", position: "relative" }}
                >
                  {val}
                  {userVoted && (
                    <span
                      style={{
                        position: "absolute",
                        top: "-8px",
                        right: "-8px",
                        backgroundColor: "#00ff88",
                        color: "#000",
                        borderRadius: "50%",
                        fontSize: "0.7rem",
                        padding: "2px 5px",
                        fontWeight: "bold"
                      }}
                    >
                      ✓
                    </span>
                  )}
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
              onChange={(e) =>
                setOutcomeInputs({ ...outcomeInputs, [sc.id]: e.target.value })
              }
            />
            <button onClick={() => addOutcome(sc.id)}>Add Outcome</button>
          </div>
        )}

        {sc.creator === playerName && !sc.launched && (
          <button onClick={() => launchScenario(sc.id)}>Ready, set, BET!</button>
        )}

        {selectedRoom.type === "prop" &&
          sc.creator === playerName &&
          sc.launched &&
          !sc.winner && (
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

        {selectedRoom.type === "poll" &&
          sc.creator === playerName &&
          sc.launched &&
          !sc.winner && (
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
    </>
  )}
</div>

          ))}
        </div>
      )}
    </div>
  );
}

export default App;
