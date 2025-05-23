// Updated Bank.jsx with Transaction Ledger View

import React, { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

const approvedUsers = [
  "David", "Raul", "Christian", "Cole", "Bob", "Will", "Danny", "Ryan", "Luke", "Kaya", "Jake",
  "Sleepy", "Doc", "Bashful", "Dopey", "Grumpy", "Sneezy", "Happy"
];

function Bank({ playerName }) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [showLedger, setShowLedger] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "players", playerName, "transactions"),
      orderBy("timestamp", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
    });
    return () => unsubscribe();
  }, [playerName]);

  const handleTransfer = async () => {
    const normalizedRecipient = recipient.trim();
    if (!approvedUsers.includes(normalizedRecipient)) {
      setMessage("Recipient name is not approved.");
      return;
    }
    if (normalizedRecipient === playerName) {
      setMessage("You cannot send tokens to yourself.");
      return;
    }
    if (amount <= 0) {
      setMessage("Transfer amount must be greater than 0.");
      return;
    }

    const senderRef = doc(db, "players", playerName);
    const recipientRef = doc(db, "players", normalizedRecipient);
    const senderSnap = await getDoc(senderRef);
    const recipientSnap = await getDoc(recipientRef);

    if (!senderSnap.exists() || !recipientSnap.exists()) {
      setMessage("One or both player accounts do not exist.");
      return;
    }

    const senderTokens = senderSnap.data().tokens || 0;
    const recipientTokens = recipientSnap.data().tokens || 0;

    if (senderTokens < amount) {
      setMessage("Insufficient tokens.");
      return;
    }

    await updateDoc(senderRef, { tokens: senderTokens - amount });
    await updateDoc(recipientRef, { tokens: recipientTokens + amount });

    await addDoc(collection(db, "players", playerName, "transactions"), {
      type: "transfer_sent",
      amount: -amount,
      note,
      recipient: normalizedRecipient,
      timestamp: serverTimestamp()
    });

    await addDoc(collection(db, "players", normalizedRecipient, "transactions"), {
      type: "transfer_received",
      amount,
      note,
      sender: playerName,
      timestamp: serverTimestamp()
    });

    setMessage(`Successfully sent ${amount} tokens to ${normalizedRecipient}. Note: ${note}`);
    setAmount(0);
    setNote("");
    setRecipient("");
  };

  const shortenScenario = (text = "") => {
    return text.length <= 8 ? text : text.slice(0, 4) + "..." + text.slice(-4);
  };

  const renderTransaction = (tx) => {
    let label = "";
    switch (tx.type) {
      case "wager":
        label = `Wager - ${shortenScenario(tx.scenarioText)}`;
        break;
      case "payout":
        label = `Win - ${shortenScenario(tx.scenarioText)}`;
        break;
      case "refund":
        label = `Refund - ${shortenScenario(tx.scenarioText)}`;
        break;
      case "transfer_sent":
        label = `Sent to ${tx.recipient}`;
        break;
      case "transfer_received":
        label = `Received from ${tx.sender}`;
        break;
      default:
        label = "Unknown Transaction";
    }
    return {
      label,
      amount: tx.amount,
      timestamp: tx.timestamp?.toDate().toLocaleString() || "",
      note: tx.note || ""
    };
  };

  return (
    <div>
      <h2>Bank</h2>
      <p>Send tokens to another player.</p>
      <input
        placeholder="Recipient name"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
      />
      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(parseInt(e.target.value))}
      />
      <input
        placeholder="Optional note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button onClick={handleTransfer}>Send Tokens</button>
      <button onClick={() => setShowLedger(!showLedger)}>
        {showLedger ? "Hide Ledger" : "View My Ledger"}
      </button>
      {message && <p>{message}</p>}
      {showLedger && (
        <div style={{ backgroundColor: "rgba(0, 0, 0, 0.6)", padding: "1rem", borderRadius: "8px", color: "#fff", marginTop: "1rem" }}>
          <h3 style={{ borderBottom: "1px solid #ccc", paddingBottom: "0.5rem" }}>Transaction History</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #999" }}>Type</th>
                <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid #999" }}>Amount</th>
                <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid #999" }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const { label, amount, timestamp, note } = renderTransaction(tx);
                return (
                  <tr key={tx.id}>
                    <td style={{ padding: "0.5rem" }}>
                      {label}
                      {note && (
                        <div style={{ fontSize: "0.85rem", color: "#ccc" }}>Note: {note}</div>
                      )}
                    </td>
                    <td style={{ textAlign: "right", padding: "0.5rem", color: amount < 0 ? "#f88" : "#8f8" }}>
                      {amount > 0 ? "+" : ""}{amount}
                    </td>
                    <td style={{ textAlign: "right", padding: "0.5rem", fontSize: "0.85rem", color: "#aaa" }}>{timestamp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Bank;


