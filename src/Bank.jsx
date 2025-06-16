// Updated Bank.jsx with Transaction Ledger View and Admin Panel

import React, { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";

const approvedUsers = [
  "David", "Raul", "Christian", "Cole", "Bob", "Will", "Danny", "Ryan", "Luke", "Kaya", "Jake",
  "Sleepy", "Doc", "Bashful", "Dopey", "Grumpy", "Sneezy", "Happy"
];

function Bank({ playerName, tokenBalance, setTokenBalance, loanBalance, setLoanBalance }) {

  const [showTransferForm, setShowTransferForm] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [showLedger, setShowLedger] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [loanAmount, setLoanAmount] = useState(0);
  
  const [loanMsg, setLoanMsg] = useState("");
  const [showLoanForm, setShowLoanForm] = useState(false);
const [balanceMode, setBalanceMode] = useState(0); // 0: Balance, 1: Loan, 2: Net



  useEffect(() => {
    const q = query(
      collection(db, "players", playerName, "transactions"),
      orderBy("timestamp", "desc")
    );
    const unsubscribeTx = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
    });

    // Fetch loan balance
    const playerRef = doc(db, "players", playerName);
  getDoc(playerRef).then((snap) => {
    setLoanBalance(snap.data()?.loan || 0);
  });
  // ...
}, [playerName, setLoanBalance]);


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

    setMessage(`Successfully sent $${amount} to ${normalizedRecipient}. Note: ${note}`);
    setAmount(0);
    setNote("");
    setRecipient("");
  };

  const handleSystemReset = async () => {
    setResetMessage("Running reset...");
    const playerSnap = await getDocs(collection(db, "players"));
    for (const playerDoc of playerSnap.docs) {
      await updateDoc(doc(db, "players", playerDoc.id), { tokens: 0, loan: 0 });
      const txSnap = await getDocs(collection(db, "players", playerDoc.id, "transactions"));
      for (const tx of txSnap.docs) {
        await deleteDoc(doc(db, "players", playerDoc.id, "transactions", tx.id));
      }
    }
    setResetMessage("All balances set to 0 and transactions deleted.");
  };

  const shortenScenario = (text = "") => {
  const words = text.split(" ");
  return words.length <= 5 ? text : words.slice(0, 4).join(" ") + " ...";
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
      case "loan":
        label = "Loan from Bank";
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
      {showLoanForm && (
        <div style={{ marginTop: "1rem", marginBottom: "1rem", padding: "0.75rem", background: "#222", color: "#ff3c3c", borderRadius: "8px" }}>
          <div>
            <b>Outstanding Loan:</b> {loanBalance}
          </div>
          <input
            type="number"
            min={1}
            max={500} // or whatever limit you want
            value={loanAmount}
            placeholder="Loan amount"
            onChange={e => setLoanAmount(parseInt(e.target.value) || 0)}
            style={{ marginRight: "0.5rem", width: "40%" }}
          />
          <button
            className="golden-button"
            onClick={async () => {
              if (loanAmount <= 0) { setLoanMsg("Enter a valid amount."); return; }
              if (loanAmount + loanBalance > 500) { setLoanMsg("Loan limit is 500 smackers."); return; }

              // Update balances in Firestore
              const playerRef = doc(db, "players", playerName);
              const playerSnap = await getDoc(playerRef);
              const tokens = playerSnap.data().tokens || 0;
              const loan = playerSnap.data().loan || 0;

              await updateDoc(playerRef, {
                tokens: tokens + loanAmount,
                loan: loan + loanAmount
              });

              await addDoc(collection(db, "players", playerName, "transactions"), {
                type: "loan",
                amount: loanAmount,
                note: "Loan taken from bank",
                timestamp: serverTimestamp()
              });

              await updateDoc(playerRef, {
                tokens: tokens + loanAmount,
                loan: loan + loanAmount
              });

              setLoanBalance(loan + loanAmount);
              setLoanMsg(`Loan approved for $${loanAmount}.`);
              setLoanAmount(0);
              setTokenBalance(tokens + loanAmount);
            }}
          >Take Out Loan</button>
          {loanMsg && <div style={{ color: "#fff", marginTop: "0.5rem" }}>{loanMsg}</div>}
        </div>
      )}

      <button
        style={{ marginBottom: "0.1rem" }}
        className="golden-button"
        onClick={() => setShowLoanForm((show) => !show)}
      >
        {showLoanForm ? "Cancel Loan" : "Loan Application"}
      </button>


      <button
        style={{ marginBottom: "0.1rem" }}
        className="golden-button"
        onClick={() => setShowTransferForm(!showTransferForm)}>
        {showTransferForm ? "Cancel" : "Send Money"}
      </button>


      {showTransferForm && (
        <>
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
          <span style={{
            display: "flex",
            justifyContent: "center",
            width: "100%"
          }}>
            <button style={{ width: "50%" }}
              className="golden-button"
              onClick={handleTransfer}>Send</button>
          </span>
        </>

      )}
      <button
        className="golden-button"
        onClick={() => setShowLedger(!showLedger)}>
        {showLedger ? "Hide Ledger" : "View My Ledger"}
      </button>
      {message && <p>{message}</p>}
      {showLedger && (
        <div style={{ backgroundColor: "rgba(0, 0, 0, 0.6)", padding: "1rem", borderRadius: "8px", color: "#fff", marginTop: "1rem" }}>
          <h3 style={{ textAlign: "center", borderBottom: "1px solid #ccc", paddingBottom: "0.5rem" }}>Transaction History</h3>
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
                      {amount > 0 ? "+" : ""}{Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

                    </td>
                    <td style={{ textAlign: "right", padding: "0.5rem", fontSize: "0.85rem", color: "#aaa" }}>{timestamp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {playerName === "Raul" && (
        <div style={{ marginTop: "2rem", padding: "1rem", backgroundColor: "#220", color: "#fff", borderRadius: "8px" }}>
          <h3>Admin Tools</h3>
          <button onClick={handleSystemReset} style={{ padding: "0.5rem 1rem", backgroundColor: "#800", color: "white", border: "none", borderRadius: "4px" }}>
            Reset All Balances and Clear Transactions
          </button>
          {resetMessage && <p style={{ marginTop: "1rem" }}>{resetMessage}</p>}
        </div>
      )}
    </div>
  );
}

export default Bank;


