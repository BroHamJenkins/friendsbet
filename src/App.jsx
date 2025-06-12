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
  getDocs,
  orderBy,
  increment
} from "firebase/firestore";
import DegenerateDerby from "./DegenerateDerby/DegenerateDerby";
import Bank from "./Bank";
import ParimutuelScenario from "./ParimutuelScenario";
import HouseScenario from "./HouseScenario";
import HouseBetScenario from "./HouseBetScenario";
import Game2 from "./Game2";



function distributeWinningsForHouseScenario(scenario, votes, adjustTokens) {
  if (!scenario || !votes || !adjustTokens) {
    console.error("Missing required arguments for house scenario payout.");
    return;
  }

  const creator = scenario.creator;

  const winners = Object.entries(votes)
    .filter(([, vote]) => vote.choice === "no")
    .map(([voter, vote]) => ({ voter, amount: vote.amount }));

  for (const { voter, amount } of winners) {
    // Payout: bettor gets their bet back + equal amount from house
    adjustTokens(voter, amount * 2);      // full return + winnings
    adjustTokens(creator, -amount);       // house pays the winnings
    // Note: house never "got" their initial bet — it was implied, so only subtract once
  }
}


const clearRoomData = async () => {
  if (!selectedRoom?.id) {
    alert("No room selected.");
    return;
  }

  const confirm = window.confirm(
    `This will permanently delete ALL SCENARIOS in room "${selectedRoom.id}". Are you sure?`
  );
  if (!confirm) return;

  try {
    const scenarioRef = collection(db, "rooms", selectedRoom.id, "scenarios");
    const snap = await getDocs(scenarioRef);

    const deletions = snap.docs.map((docSnap) => deleteDoc(docSnap.ref));
    await Promise.all(deletions);

    alert("Scenarios successfully deleted.");
  } catch (err) {
    console.error("Error deleting scenarios:", err);
    alert("Failed to delete scenarios. See console for details.");
  }
};


const approvedUsers = [
  "David", "Raul", "Christian", "Cole", "Bob", "Will", "Danny", "Ryan", "Luke", "Kaya", "Jake",
  "Sleepy", "Doc", "Bashful", "Dopey", "Grumpy", "Sneezy", "Happy", "Snow White"
];

const normalize = (name) => name.trim().toLowerCase();

const findApprovedName = (inputName) => {
  const normalizedInput = normalize(inputName);
  return approvedUsers.find((name) => normalize(name) === normalizedInput);
};


function App() {
  const handleLogoClick = () => {
    if (isPlaying) return;

    const audio = new Audio("/audio/PartyZone.mp3");
    setIsPlaying(true);
    audio.play().catch(console.error);
    audio.onended = () => setIsPlaying(false);
  };
  const [isPlaying, setIsPlaying] = useState(false);
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

  const [triggerMainAnim, setTriggerMainAnim] = useState(false);
  const [scenarioMode, setScenarioMode] = useState("flat");
  const [maxBetAmount, setMaxBetAmount] = useState("");
  const [voteAmounts, setVoteAmounts] = useState({});
  const [showScenarioForm, setShowScenarioForm] = useState(false);
  const [editableRoomName, setEditableRoomName] = useState("");
  const [roomName, setRoomName] = useState("");

  const [roomList, setRoomList] = useState([]);
  const [betAmount, setBetAmount] = useState("");
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
  const distributeWinningsForHouseScenario = async (scenarioId, votes, adjustTokens) => {
    const scenarioRef = doc(db, "rooms", selectedRoom.id, "scenarios", scenarioId);
    const snap = await getDoc(scenarioRef);
    const scenario = snap.data();

    // Patch: manually set id and roomId (Firestore does not store them in doc data)
    scenario.id = scenarioId;
    scenario.roomId = selectedRoom.id;

    // The rest of your payout logic:
    const housePlayer = scenario.creator;
    const houseWon = scenario.winner === scenario.houseOutcome;
    const voterEntries = Object.entries(votes || {});

    for (const [voter, { amount }] of voterEntries) {
      if (voter === housePlayer) continue;

      const houseRef = doc(db, "players", housePlayer);
      const voterRef = doc(db, "players", voter);

      if (houseWon) {
        await updateDoc(houseRef, {
          tokens: increment(amount),
        });

        await addDoc(collection(db, "players", housePlayer, "transactions"), {
          type: "payout",
          amount,
          from: voter,
          scenarioId,
          scenarioText: scenario.description,
          timestamp: serverTimestamp(),
        });
      } else {
        await updateDoc(voterRef, {
          tokens: increment(amount * 2),
        });

        await addDoc(collection(db, "players", voter, "transactions"), {
          type: "payout",
          amount: amount * 2,
          from: housePlayer,
          scenarioId,
          scenarioText: scenario.description,
          timestamp: serverTimestamp(),
        });

        await updateDoc(houseRef, {
          tokens: increment(-amount),
        });
      }
    }
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

  const [expandedScenarioIds, setExpandedScenarioIds] = useState({});


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
    const roomQuery = query(collection(db, "rooms"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(roomQuery, (snapshot) => {
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
    const wrapper = document.querySelector('.app-wrapper');
    if (!wrapper) return;

    wrapper.classList.add('animating');
    const timeout = setTimeout(() => wrapper.classList.remove('animating'), 600);

    return () => clearTimeout(timeout);
  }, [gameSelected]);


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
      type: "prop"

    });
    setRoomName("");
  };

  useEffect(() => {
    if (!playerName) return;
    const playerRef = doc(db, "players", playerName);
    // Listen for real-time updates
    const unsubscribe = onSnapshot(playerRef, (docSnap) => {
      if (docSnap.exists()) {
        setTokenBalance(docSnap.data().tokens ?? 0);
      }
    });
    return () => unsubscribe();
  }, [playerName]);


  const joinRoom = (room) => {
    setSelectedRoom(room);
    setEditableRoomName(room.name);  // ← preload editable name
    localStorage.setItem("lastRoomId", room.id);
  };


  const addScenario = async () => {
    if (!newScenario.trim() || !selectedRoom) return;
    const min = Number(betAmount);
    const max = Number(maxBetAmount);

    if (!min || !max) {
      alert("Please enter both a minimum and maximum bet.");
      return;
    }

    if (min > max) {
      alert("Minimum bet cannot be greater than maximum bet. Please correct the values.");
      return;
    }

    const mode = min === max ? "flat" : "pari";

    await addDoc(collection(db, "rooms", selectedRoom.id, "scenarios"), {
      description: newScenario,
      createdAt: serverTimestamp(),
      creator: playerName,
      outcomes: {},
      votes: {},
      winner: null,
      launched: false,
      order: [],
      betAmount: min,
      minBet: min,
      maxBet: max,
      mode
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

  // payout for house mode
  const resolveHouseScenario = async (data, scenarioId) => {
    const scenarioRef = doc(db, "rooms", selectedRoom.id, "scenarios", scenarioId);
    const snap = await getDoc(scenarioRef);
    const scenario = snap.data();

    const house = scenario.housePlayer;
    const houseOutcome = scenario.houseOutcome;
    const winner = scenario.winner;
    const votes = scenario.votes || {};

    let totalCollected = 0;
    let totalPayout = 0;

    for (const [player, vote] of Object.entries(votes)) {
      const amount = vote.amount;

      if (winner !== houseOutcome) {
        // House lost → pay each bettor 2x
        const payout = amount * 2;
        totalPayout += payout;

        await updateDoc(doc(db, "players", player), {
          tokens: increment(payout),
        });

        await addDoc(collection(db, "players", player, "transactions"), {
          type: "win",
          amount: payout,
          scenarioId,
          scenarioText: scenario.description,
          timestamp: serverTimestamp(),
        });
      } else {
        // House won → collects the player's bet
        totalCollected += amount;
      }
    }

    const netChange = totalCollected - totalPayout;

    await updateDoc(doc(db, "players", house), {
      tokens: increment(netChange),
    });

    await addDoc(collection(db, "players", house, "transactions"), {
      type: winner === houseOutcome ? "win" : "loss",
      amount: netChange,
      scenarioId,
      scenarioText: scenario.description,
      timestamp: serverTimestamp(),
    });
  };




  const distributeWinnings = async (scenarioId) => {
    const scenarioRef = doc(db, "rooms", selectedRoom.id, "scenarios", scenarioId);
    const snap = await getDoc(scenarioRef);
    const data = snap.data();

    if (data.mode === "house") {
      await resolveHouseScenario(data, scenarioId);
      return;
    }

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


  return (
    <div className={`app-wrapper ${!hasEnteredName
      ? 'login'
      : gameSelected
        ? gameSelected.toLowerCase().replace(/\s/g, '-')
        : 'home'

      }`}>



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
              src="/Casino-Logo.png"
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
        <div style={{ textAlign: "center", position: "relative", minHeight: "80vh" }}>
          <h2>WELCOME</h2>
          <input
            placeholder="Your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          <button
            onClick={() => {
              const matchedName = findApprovedName(playerName);
              if (matchedName) {
                setPlayerName(matchedName);
                setTriggerMainAnim(true);
                setTimeout(() => setHasEnteredName(true), 500); // allow animation to complete
              }
              else {
                alert("Are you so drunk that you've forgotten how to spell your own name? Or are you up to some funny business? Either way, get your shit together.");
              }
            }}
          >
            Continue
          </button>

          <p style={{
            fontSize: "0.65rem",
            color: "#fff",
            position: "absolute",
            bottom: "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            width: "90%",
            maxWidth: "500px",
            lineHeight: "1.2",
            textAlign: "center",
            opacity: 0.75
          }}>
            © 2025 Danny’s App™. All rights reserved. Danny’s App is a registered trademark. Use of this app is at your own risk. We accept zero responsibility for financial losses, physical injury, emotional damage, or sudden existential dread. By continuing, you agree we warned you. Aggressively. Bob!
          </p>
        </div>

      ) : !gameSelected ? (

        <div className="main-screen">
          <div className="home-logo-container">

            <img
              src="/Home-Logo.png"
              alt="Logo"
              className="home-logo"
              onClick={handleLogoClick}
              style={{ cursor: "pointer" }}
            />

          </div>

          <div>

            <div style={{ display: "flex", justifyContent: "center", marginTop: "0rem", marginBottom: "0.5rem" }}>
              <div
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.4)",
                  paddingTop: ".5rem",
                  paddingBottom: ".15rem",
                  paddingLeft: "3rem",
                  paddingRight: "3rem",
                  borderRadius: "20px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "0.75rem", margin: 0, color: "#ff5fff" }}>WELCOME BACK</p>
                <p
                  style={{
                    fontSize: "2rem",
                    fontWeight: "bold",
                    margin: 0,
                    color: "#fff",
                  }}
                >
                  {playerName.toUpperCase()}
                </p>
              </div>
            </div>





            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <button
                className="button"
                onClick={() => setGameSelected("Casino")}
                style={{
                  marginBottom: "0.25rem",
                  marginTop: "0rem",
                }}
              >
                Casino
              </button>
              <button
                className="button-ocean"
                onClick={() => setGameSelected("Game2")}
                style={{ marginBottom: "0.25rem" }}
              >
                Derby
              </button>
              <button
                className="button-emerald"
                onClick={() => setGameSelected("Bank")}
              >
                Bank
              </button>

              {/*/<button
                className="button-53"
                onClick={() => setGameSelected("Degenerate Derby")}
                style={{ marginBottom: "0.5rem" }}
              >
                Degenerate Derby
              </button>
        */}
            </div>
          </div>
        </div>

      ) : gameSelected === "Game2" ? (
        <Game2 playerName={playerName} setGameSelected={setGameSelected} />

      ) : gameSelected === "Bank" ? (
        <>
          <div className="bank-logo-container">
            <img src="/Bank-Logo.png" alt="Bank Logo" className="bank-logo" />
          </div>

          <div>

            <button                  //takes user back to Home page (aka Select a game page)
              className="button-burgundy"
              onClick={() => setGameSelected("")}
            >
              Leave
            </button>

            <div style={{
              backgroundColor: "#111",
              padding: "0.5rem 0.5rem",
              borderRadius: "12px",
              marginTop: "0.5rem",
              marginBottom: "0.5rem",
              textAlign: "center",
              color: "#00ff88",  // bright mint green
              fontSize: "2rem",
              fontFamily: "'Orbitron', sans-serif",
              boxShadow: "0 0 10px rgba(0, 255, 136, 0.5), inset 0 0 5px rgba(0, 255, 136, 0.3)"
            }}>
              Balance: ${tokenBalance.toLocaleString()}
            </div>


            <Bank
              playerName={playerName}
              tokenBalance={tokenBalance}
              setTokenBalance={setTokenBalance}
            />


          </div>
        </>

      ) : gameSelected === "Degenerate Derby" ? (
        <DegenerateDerby
          playerName={playerName}
          setGameSelected={setGameSelected}
        />




      ) : gameSelected === "Beach Olympics" ? (
        <div className="beach-olympics-page" style={{ textAlign: "center" }}>



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
          <h2 className="beach-olympics-header">
            Beach Olympics
          </h2>



          <img
            src="/icons/back-arrow.png"
            alt="Leave Olympics"
            onClick={() => setGameSelected("")}
            className="clickable-arrow"
          />

        </div>


      ) : gameSelected === "Road Trip Mayhem" ? (
        <div>
          <h2>Road Trip Mayhem</h2>
          <button onClick={() => setGameSelected("")}>Leave Roadtrip Mayhem</button>
        </div>




      ) : !selectedRoom ? (
        <div>


          {playerName === "Raul" && (
            <>
              <input
                placeholder="New room name"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
              />

              <button onClick={createRoom}>Create Room</button>
            </>
          )}
<div style={{ justifyContent: "center", display: "flex", marginBottom: "0.5rem" }}>
          <button                  //takes user back to Home page (aka Select a game page)
            className="img-button"
            onClick={() => setGameSelected("")}
          >
           <img
                  src="/NewBetExit.png"
                  alt="NewBet Exit button"
                  style={{
                    height: "auto",
                    width: "90px",
                    display: "block",
                    pointerEvents: "none",
                    userSelect: "none"
                  }}
                  draggable="false"
                />

          </button>
</div>
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
            <h2 style={{ margin: "0.5rem" }} className="room-name-display">{selectedRoom.name}</h2>
          )}



          {playerName === "Raul" && selectedRoom && (
            <div style={{ marginTop: "1rem" }}>
              <button
                onClick={clearRoomData}
                style={{
                  background: "#8b0000",
                  color: "white",
                  padding: "0.5rem 1rem",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  boxShadow: "0 0 5px red",
                  cursor: "pointer"
                }}
              >
                ⚠️ Delete All Scenarios in This Room
              </button>
            </div>
          )}



          {!showScenarioForm ? (
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "0.5rem",justifyContent: "center" }}>
              <button
                className="img-button"
                onClick={() => setShowScenarioForm(true)}
                style={{ background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer" }}
              >
                <img
                  src="/NewBet.png"
                  alt="New bet button"
                  style={{
                    justifyContent: "center",
                    height: "auto",
                    width: "100px",
                    display: "block",
                    pointerEvents: "none",
                    userSelect: "none"
                  }}
                  draggable="false"
                />
              </button>
              <button
                className="img-button"
                onClick={() => setSelectedRoom(null)}
                style={{ background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer" }}
              >
                <img
                  src="/NewBetExit.png"
                  alt="NewBet Exit button"
                  style={{
                    height: "auto",
                    width: "90px",
                    display: "block",
                    pointerEvents: "none",
                    userSelect: "none"
                  }}
                  draggable="false"
                />
              </button>
            </div>

          ) : scenarioMode === "house" ? (
            <>
              <HouseScenario
                playerName={playerName}
                onScenarioCreated={() => {
                  setShowScenarioForm(false);
                  setScenarioMode("");
                }}
                roomId={selectedRoom.id}
              />
              <button onClick={() => {
                setShowScenarioForm(false);
                setScenarioMode("");
              }} style={{ marginTop: "0.5rem" }}>
                Cancel
              </button>
            </>
          ) : (
            <div style={{ marginBottom: "0rem" }}>
              <input
                placeholder="New Prop Bet"
                value={newScenario}
                onChange={(e) => setNewScenario(e.target.value)}
              />
              <div style={{ display: "flex", alignItems: "center", gap: "0rem", flexWrap: "wrap" }}>
                <input
                  type="number"
                  placeholder="Min Bet"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  style={{ width: "33%" }}
                />
                <input
                  type="number"
                  placeholder="Max Bet"
                  value={maxBetAmount}
                  onChange={(e) => setMaxBetAmount(Number(e.target.value))}
                  style={{ width: "33%" }}
                />
                <button
                  onClick={() => setScenarioMode((prev) => prev === "house" ? "" : "house")}
                  style={{
                    width: "40%",
                    padding: "0.4rem 0.75rem",
                    fontSize: "0.9rem",
                    borderRadius: "8px",
                    background: scenarioMode === "house" ? "#640f21" : "#444",
                    color: "#fff",
                    fontWeight: "bold",
                    border: "2px solid #999",
                    boxShadow: scenarioMode === "house"
                      ? "0 0 6px #ff3c3c"
                      : "0 2px 4px rgba(0,0,0,0.3)",
                    transition: "0.2s ease",
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  {scenarioMode === "house" ? "Cancel Boss Mode" : "Boss Mode"}
                </button>
              </div>
              <button onClick={addScenario}>Create Choices</button>
              <button onClick={() => {
                setShowScenarioForm(false);
                setScenarioMode("");
              }} style={{ marginLeft: "0rem" }}>
                Cancel
              </button>
            </div>
          )}



          {scenarios.map((sc) => (
            <div key={sc.id} className="scenario-box">
              {sc.mode === "house" ? (
                <HouseBetScenario
                  scenario={{ ...sc, roomId: selectedRoom.id }}
                  playerName={playerName}
                  adjustTokens={adjustTokens}
                  distributeWinnings={distributeWinningsForHouseScenario}
                />




              ) : sc.mode === "pari" ? (
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
                  expanded={!!expandedScenarioIds[sc.id]}
                  toggleExpanded={() =>
                    setExpandedScenarioIds(prev => ({
                      ...prev,
                      [sc.id]: !prev[sc.id]
                    }))
                  }
                />



              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontWeight: "bold",
                      marginBottom: "0.2rem",
                      cursor: "pointer",
                      color: "black"
                    }}
                    onClick={() =>
                      setExpandedScenarioIds(prev => ({
                        ...prev,
                        [sc.id]: !prev[sc.id]
                      }))
                    }
                  >
                    <span>{sc.description}</span>
                    <span style={{
                      marginLeft: "1rem",
                      color: expandedScenarioIds[sc.id] ? "#ffeb9c" : "#ccc",
                      fontSize: "1.2rem",
                      fontWeight: "bold"
                    }}>
                      {expandedScenarioIds[sc.id] ? "▲" : "▼"}
                    </span>
                  </div>

                  <div style={{ fontStyle: "italic", marginBottom: "0.5rem" }}>
                    Flat Bet: ${sc.betAmount ?? 1}
                  </div>
                  {expandedScenarioIds[sc.id] && (
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
                  )}
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
