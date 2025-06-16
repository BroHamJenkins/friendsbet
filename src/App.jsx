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
import PokerTracker from "./PokerTracker";
import OddsWidget from "./OddsWidget";

async function distributeParimutuelWinnings(scenario, db) {
  const { votes, winner } = scenario;
  if (!votes || !winner) return;

  const winningKey = winner;
  const winningVoters = Object.entries(votes).filter(([, v]) => v.choice === winningKey);
  const losingVoters = Object.entries(votes).filter(([, v]) => v.choice !== winningKey);

  const totalWinningBet = winningVoters.reduce((sum, [, v]) => sum + (v.amount || 0), 0);
  const totalLosingBet = losingVoters.reduce((sum, [, v]) => sum + (v.amount || 0), 0);

  for (const [player, vote] of winningVoters) {
    const payout =
      vote.amount +
      (totalWinningBet > 0 ? (vote.amount / totalWinningBet) * totalLosingBet : 0);

    const userRef = doc(db, "tokens", player);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const current = userSnap.data().amount || 0;
      await updateDoc(userRef, { amount: current + payout });
    }
  }
}

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

const adminUsers = ["Raul", "Christian", "David"];

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

  const [showOdds, setShowOdds] = useState(false);
const [showOddsWidget, setShowOddsWidget] = useState(false);


  const [roomList, setRoomList] = useState([]);
  const [betAmount, setBetAmount] = useState("");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [hasEnteredName, setHasEnteredName] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(100);

useEffect(() => {
  if (!name) return;

  const playerRef = doc(db, "players", name);
  const unsubscribe = onSnapshot(playerRef, (docSnap) => {
    const data = docSnap.data();
    if (data?.tokens !== undefined) {
      setTokenBalance(data.tokens);
    }
  });

  return () => unsubscribe();
}, [name]);


  
  const [loanBalance, setLoanBalance] = useState(0);
  const [balanceMode, setBalanceMode] = useState(0); // 0: Balance, 1: Loan, 2: Net
  const getBalanceDisplay = () => {
    switch (balanceMode) {
      case 0:
        return `Balance: $${Number(tokenBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 1:
        return `Loan: $${Number(loanBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 2:
        return `Net: $${Number(tokenBalance - loanBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      default:
        return "";
    }
  };




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
  const storedName = localStorage.getItem("playerName");
  if (storedName && !hasEnteredName) {
    setPlayerName(storedName);
    setHasEnteredName(true);
  }
}, [hasEnteredName]);


  useEffect(() => {
    const interval = setInterval(() => {
      setHeaderIndex((prev) => (prev + 1) % casinoMessages.length);
    }, 4000); // rotate every 4 seconds





async function declareWinner(scenarioId, winningKey) {
  const scenarioRef = doc(db, "scenarios", scenarioId);

  let scenarioSnap;
  try {
    scenarioSnap = await getDoc(scenarioRef);
  } catch (err) {
    console.error("Failed to fetch scenario:", err);
    return;
  }

  const scenario = scenarioSnap.data();
  if (!scenario || scenario.winner) return;

  const votes = scenario.votes || {};

  // NEW: much simpler, always treat votes as objects!
  const winningVoters = [];
  const losingVoters = [];

  for (const [player, vote] of Object.entries(votes)) {
    // vote is always { choice, amount }
    const choice = vote.choice;
    const amount = Number(vote.amount);

    if (typeof choice !== "string" || isNaN(amount)) continue;

    if (choice === winningKey) {
      winningVoters.push({ player, amount });
    } else {
      losingVoters.push({ player, amount });
    }
  }

  const totalWinning = winningVoters.reduce((sum, v) => sum + v.amount, 0);
  const totalLosing = losingVoters.reduce((sum, v) => sum + v.amount, 0);

  for (const { player, amount } of winningVoters) {
    const payout = amount + (totalWinning > 0 ? (amount / totalWinning) * totalLosing : 0);
    if (!isNaN(payout) && isFinite(payout)) {
      try {
        await updateDoc(doc(db, "players", player), {
          tokens: increment(payout)
        });

        // If this is the current user, update their UI balance (if needed)
        if (player === userName) {
          const playerSnap = await getDoc(doc(db, "players", player));
          const newBalance = playerSnap.data()?.tokens ?? 0;
          setTokenBalance(newBalance);
        }
      } catch (err) {
        console.error(`Failed to update tokens for ${player}:`, err);
      }
    }
  }

  try {
    await updateDoc(scenarioRef, { winner: winningKey });
  } catch (err) {
    console.error("Failed to update scenario winner:", err);
  }
}


    return () => clearInterval(interval); // cleanup
  }, []);

{showOdds && <OddsWidget />}


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
  const isAResolved = !!a.winner;
  const isBResolved = !!b.winner;

  if (isAResolved && !isBResolved) return 1;  // move A down
  if (!isAResolved && isBResolved) return -1; // move B down

  const timeA = a.createdAt?.seconds || 0;
  const timeB = b.createdAt?.seconds || 0;
  return timeB - timeA;
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

    const docRef = await addDoc(collection(db, "rooms", selectedRoom.id, "scenarios"), {
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

// Immediately expand the new scenario by its ID
setExpandedScenarioIds(prev => ({
  ...prev,
  [docRef.id]: true,
}));

setNewScenario("");
setShowScenarioForm(false);
setScenarioMode("");





    setNewScenario("");
    setShowScenarioForm(false); // <--- ADDED
  setScenarioMode("");        // <--- Optional: reset mode as with house
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

    votes[playerName] = { choice: outcomeKey, amount: isPari ? betAmount : data.betAmount ?? 1 };



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


 const declareWinner = async (scenarioId, winningKey) => {
  const scenarioRef = doc(db, "rooms", selectedRoom.id, "scenarios", scenarioId);
  await updateDoc(scenarioRef, { winner: winningKey });

  const snap = await getDoc(scenarioRef);
  const data = snap.data();
  const votes = data.votes || {};

  const winners = Object.entries(votes).filter(
    ([, v]) => v.choice === winningKey
  );
  const losers = Object.entries(votes).filter(
    ([, v]) => v.choice !== winningKey
  );

  const totalWinning = winners.reduce((sum, [, v]) => sum + Number(v.amount || 0), 0);
  const totalLosing = losers.reduce((sum, [, v]) => sum + Number(v.amount || 0), 0);

  for (const [player, v] of winners) {
    const base = Number(v.amount || 0);
    const share = totalWinning > 0 ? (base / totalWinning) * totalLosing : 0;
    const payout = base + share;

    if (payout > 0) {
      await updateDoc(doc(db, "players", player), {
        tokens: increment(parseFloat(payout.toFixed(2)))
      });

      await addDoc(collection(db, "players", player, "transactions"), {
        type: "payout",
        amount: payout,
        scenarioId,
        scenarioText: data.description,
        timestamp: serverTimestamp()
      });
    }
  }
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

    // FLAT MODE -- as before
    if (data.mode === "flat") {
      const votes = data.votes;
      const winnerKey = data.winner;
      const winningVoters = Object.entries(votes)
  .filter(([, vote]) => {
    const choice = vote.choice;
    return Array.isArray(data.winner) ? data.winner.includes(choice) : choice === data.winner;
  })
  .map(([player]) => player);


      const betAmount = data.betAmount ?? 1;
      const totalPot = Object.keys(votes).length * betAmount;
      const payout = winningVoters.length > 0 ? (totalPot / winningVoters.length) : 0;

      if (winningVoters.length > 0) {
        for (const winner of winningVoters) {
  await updatePlayerBalance(winner, payout);
  await addDoc(collection(db, "players", winner, "transactions"), {
    type: "payout",
    amount: payout,
    scenarioId,
    scenarioText: data.description,
    timestamp: serverTimestamp()
  });

  if (winner === playerName) {
    adjustTokens(payout);  // update local balance only for this client
  }
}

      } else {
        // Refund all players
        // Refund all players (no winners)
for (const player of Object.keys(votes)) {
  const vote = votes[player];
  const refund = vote.amount;
  await updatePlayerBalance(player, refund); // backend for every player

  if (player === playerName) {
    adjustTokens(refund); // UI for local user
  }
  await addDoc(collection(db, "players", player, "transactions"), {
    type: "refund",
    amount: refund,
    scenarioId,
    scenarioText: data.description,
    timestamp: serverTimestamp()
  });
}


      }
      return; // STOP here for flat mode
    }

    // ===== PARIMUTUEL ("pari") MODE: True parimutuel payout logic =====
    if (data.mode === "pari") {
      // votes: {player: {choice, amount}}
      const votes = data.votes || {};
      const winnerKey = data.winner;

      // Winners: [{player, amount}]
      const winningVoters = Object.entries(votes)
        .filter(([, v]) => v.choice === winnerKey)
        .map(([player, v]) => ({ player, amount: v.amount }));

      // Losers: [{player, amount}]
      const losingVoters = Object.entries(votes)
        .filter(([, v]) => v.choice !== winnerKey)
        .map(([player, v]) => ({ player, amount: v.amount }));

if (winningVoters.length === 0) {
  // Push: return everyone's bet
  for (const [player, vote] of Object.entries(votes)) {
    const refund = vote?.amount || 0;
    await adjustTokens(refund);
    await addDoc(collection(db, "players", player, "transactions"), {
      type: "refund",
      amount: refund,
      scenarioId,
      scenarioText: data.description,
      timestamp: serverTimestamp(),
    });
  }
  return;
}


      const totalWinningBet = winningVoters.reduce((sum, v) => sum + (v.amount || 0), 0);
      const totalLosingBet = losingVoters.reduce((sum, v) => sum + (v.amount || 0), 0);

      for (const { player, amount } of winningVoters) {
        // Parimutuel payout = original bet + proportional share of losing pot
        const payout = amount + (totalWinningBet > 0 ? (amount / totalWinningBet) * totalLosingBet : 0);

        await updatePlayerBalance(player, payout); // CORRECT: updates all winners
  if (player === playerName) {
    adjustTokens(payout); // keep local UI in sync for the current user
  }
  await addDoc(collection(db, "players", player, "transactions"), {
          type: "payout",
          amount: (payout),
          scenarioId,
          scenarioText: data.description,
          timestamp: serverTimestamp(),
        });
      }
      // Losers get nothing (their bets are lost)
      return;
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

async function updatePlayerBalance(player, amount) {
  const playerRef = doc(db, "players", player);
  await updateDoc(playerRef, {
    tokens: increment(amount)  // <- CORRECT FIELD
  });
}




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
              ${Math.round(tokenBalance)}

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
          <div style={{ width: "93%" }}>
            <input
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              const matchedName = findApprovedName(playerName);
              if (matchedName) {
                setPlayerName(matchedName);
                localStorage.setItem("playerName", matchedName);
                setTriggerMainAnim(true);
                setTimeout(() => setHasEnteredName(true), 500); // allow animation to complete
              }
              else {
                alert("Are you so drunk that you've forgotten how to spell your own name? Or are you up to some funny business? Either way, get your shit together and use your real name or this won't work.");
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

{["Raul", "Christian", "David"].includes(playerName) && (
  <div
    style={{
      position: "fixed",
      top: "16px",
      left: "16px",
      zIndex: 1001,
      cursor: "pointer"
    }}
    onClick={() => {
      localStorage.removeItem("playerName");
      setHasEnteredName(false);
      setPlayerName("");
    }}
    title="Sign Out"
  >
    <img
      src="/SignOutX.png"
      alt="Sign Out x"
      style={{
        width: "30px",
        height: "30px",
        display: "block",
        //filter: "drop-shadow(0 2px 6px #aa1155)"
      }}
      draggable="false"
    />
  </div>
)}


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
                  {playerName.trim().toLowerCase() === "bob"
  ? "BLACK BOB"
  : playerName.toUpperCase()}

                </p>
              </div>
            </div>





            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
              <button
                className="button"
                onClick={() => setGameSelected("Casino")}
                style={{
                  marginBottom: "0.25rem",
                  marginTop: "0.25rem",
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

{playerName === "Raul" && (
                  <button
  className="button-goldenrod"
  onClick={() => setGameSelected("PokerTracker")}
>
  Poker Tracker
</button>
                )}






              <button 
              className= "deleteMe-button"
              onClick={() => {
  localStorage.removeItem("playerName");
  setHasEnteredName(false);
  setPlayerName("");
}}>DeleteMeLater!!</button>


{playerName === "Raul" && (
<button                                     // toggles the OddsWidget
  className="deleteMe-button"
  onClick={() => setShowOddsWidget(prev => !prev)}
>
  {showOddsWidget ? "Hide Odds" : "SportsOdds"}
</button>
)}
<div>{showOddsWidget && <OddsWidget />}</div>   {/* take this with the button           */} 


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
  boxShadow: "0 0 10px rgba(0, 255, 136, 0.5), inset 0 0 5px rgba(0, 255, 136, 0.3)",
  cursor: "pointer"
}}
title="Click to switch: Balance / Loan / Net"
onClick={() => setBalanceMode((balanceMode + 1) % 3)}
>
  {getBalanceDisplay()}
</div>



            <Bank
              playerName={playerName}
              tokenBalance={tokenBalance}
              setTokenBalance={setTokenBalance}
              loanBalance={loanBalance}
              setLoanBalance={setLoanBalance}
            />



          </div>
        </>




     ) : gameSelected === "Degenerate Derby" ? (
  <DegenerateDerby
    playerName={playerName}
    setGameSelected={setGameSelected}
  />
) : gameSelected === "PokerTracker" ? (
  <PokerTracker playerName={playerName} />





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
              <li key={room.id} >
              
                <button 
                onClick={() => joinRoom(room)}>{room.name}</button>
                {playerName === "Raul" && (
                  <button 
                  className= "button-burgundy"
                  onClick={() => deleteRoom(room.id)} >Delete</button>
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
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "0.5rem", justifyContent: "center" }}>
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
                    width: "120px",
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
                    width: "115px",
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
              <span style={{ display: "flex", justifyContent: "center" }}>
                <button
                  className="img-button"
                  onClick={() => {
                    setShowScenarioForm(false);
                    setScenarioMode("");
                  }} style={{ marginTop: "0.5rem" }}>
                  <img
                    src="/CasinoCancel.png"
                    alt="cancel options button"
                    style={{
                      height: "auto",
                      width: "100px",
                      display: "block",
                      pointerEvents: "none",
                      userSelect: "none"
                    }}
                    draggable="false"
                  />
                </button>
              </span>
            </>
          ) : (
            <div style={{ marginBottom: "0rem" }}>
              <div style={{ width: "90%" }}>
                <input
                  placeholder="New Prop Bet"
                  value={newScenario}
                  onChange={(e) => setNewScenario(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0rem", flexWrap: "wrap" }}>
                <input
                  type="number"
                  placeholder="Min Bet"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  style={{ width: "20%" }}
                />
                <input
                  type="number"
                  placeholder="Max Bet"
                  value={maxBetAmount}
                  onChange={(e) => setMaxBetAmount(Number(e.target.value))}
                  style={{ width: "20%", marginRight: "2rem" }}
                />
                <button
                  className="img-button"
                  onClick={() => setScenarioMode((prev) => prev === "house" ? "" : "house")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    cursor: "pointer"
                  }}
                >
                  <img
                    src="/HouseBetButton.png"
                    alt="House Bet button"
                    style={{
                      height: "auto",
                      width: "80px",
                      display: "block",
                      pointerEvents: "none",
                      userSelect: "none"
                    }}
                    draggable="false"
                  />
                </button>



              </div>
              <div style={{ display: "flex", justifyContent: "center", marginTop: "0.2rem", marginBottom: "1rem" }}>
                <button
                  className="img-button"
                  onClick={addScenario}>
                  <img
                    src="/CreateOptions.png"
                    alt="Create options button"
                    style={{
                      height: "auto",
                      width: "120px",
                      display: "block",
                      pointerEvents: "none",
                      userSelect: "none"
                    }}
                    draggable="false"
                  />
                </button>
                <button
                  className="img-button"
                  onClick={() => {
                    setShowScenarioForm(false);
                    setScenarioMode("");
                  }} style={{ marginLeft: "0rem" }}>
                  <img
                    src="/CasinoCancel.png"
                    alt="cancel  options button"
                    style={{
                      height: "auto",
                      width: "118px",
                      display: "block",
                      pointerEvents: "none",
                      userSelect: "none"
                    }}
                    draggable="false"
                  />
                </button>
              </div>
            </div>
          )}



          {scenarios.map((sc) => (
            <div key={sc.id} className={`scenario-box ${sc.winner ? "resolved-scenario" : ""}`}>

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
  .filter(([, vote]) => vote.choice === key)
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
                        <div >
                          <input
                            style={{ width: "90%", marginRight: "0.5rem" }}
                            placeholder="New option"
                            value={outcomeInputs[sc.id] || ""}
                            onChange={(e) =>
                              setOutcomeInputs({ ...outcomeInputs, [sc.id]: e.target.value })
                            }
                          />
                          <button onClick={() => addOutcome(sc.id)}>Accept Option</button>
                        </div>
                      )}

                      {sc.creator === playerName && !sc.launched && (
                        <button
  onClick={() => {
    const numOptions = Object.keys(sc.outcomes || {}).length;
    const hasUnsubmittedInput =
      (outcomeInputs[sc.id] || "").trim().length > 0;

    if (hasUnsubmittedInput) {
      alert("You have a filled-in option that hasn't been accepted.");
      return;
    }

    if (numOptions < 2) {
      alert("You need at least two outcome options.");
      return;
    }

    launchScenario(sc.id);
  }}
  style={{ marginLeft: "0.5rem" }}
>
  Ready, set, BET!
</button>



                      )}

                      {selectedRoom.type === "prop" &&
                        sc.creator === playerName &&
                        sc.launched &&
                        !sc.winner && (
                          <div>
                            {!showDeclareButtons[sc.id] ? (
                              <button onClick={() => toggleDeclareButtons(sc.id)}>Declare Winner</button>
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
  .filter(([, vote]) => (typeof vote === "string" ? vote : vote.choice) === key)
  .map(([voter]) => voter);

      const isWinner = Array.isArray(sc.winner)
        ? sc.winner.includes(key)
        : sc.winner === key;

      return (
        <div key={key} style={{ color: isWinner ? "green" : "inherit" }}>
          {val}:
          {" "}
          {voters.length > 0 ? (
            isWinner ? (
              <strong>{voters.join(", ")} (Winner)</strong>
            ) : (
              voters.join(", ")
            )
          ) : (
            isWinner ? <strong>No Bets (Winner)</strong> : "No Bets"
          )}
          {isWinner && voters.length === 0 && " (Push - All Bets Returned)"}
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