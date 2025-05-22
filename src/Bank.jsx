// Bank UI Component and Integration for FriendsBet

import React, { useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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

    setMessage(`Successfully sent ${amount} tokens to ${normalizedRecipient}. Note: ${note}`);
    setAmount(0);
    setNote("");
    setRecipient("");
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
      {message && <p>{message}</p>}
    </div>
  );
}

export default Bank;
