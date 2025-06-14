import { useEffect, useState } from "react";
const API_KEY = import.meta.env.VITE_ODDS_API_KEY;

const OddsWidget = () => {
  const [odds, setOdds] = useState([]);


  useEffect(() => {
    const fetchOdds = async () => {
      try {
       const response = await fetch(
  `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=1d44238f1e66b8894eb32332e009ad8f&regions=us&markets=h2h&oddsFormat=american`
);

        const data = await response.json();
        setOdds(data.slice(0, 3)); // Show top 3 games
      } catch (err) {
        console.error("Failed to fetch odds:", err);
      }
    };
    fetchOdds();
  }, []);

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>🏀 NBA Odds – Tonight's Games</h2>
      <hr style={styles.hr} />
      {odds.map((game, i) => (
        <div key={i} style={styles.matchBlock}>
          <div style={styles.matchup}>
            {game.home_team} vs {game.away_team}
          </div>
          {game.bookmakers.map((book, j) => (
            <div key={j} style={styles.bookRow}>
              <strong>{book.title}:</strong>{" "}
              {book.markets[0].outcomes.map((o, k) => (
                <span key={k} style={{ marginRight: "0.75rem" }}>
                  {o.name} ({o.price > 0 ? `+${o.price}` : o.price})
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}
      <button style={styles.button}>More games</button>
    </div>
  );
};

const styles = {
  container: {
    background: "#111",
    border: "2px solid gold",
    borderRadius: "15px",
    padding: "1.5rem",
    fontFamily: "'Oswald', sans-serif",
    color: "#f9d85c",
    width: "80%",
    maxWidth: "420px",
    margin: "2rem auto",
    boxShadow: "0 0 15px gold",
  },
  header: {
    fontSize: "1.5rem",
    marginBottom: "1rem",
    color: "#ffe066",
  },
  hr: {
    border: "none",
    borderTop: "1px solid #f9d85c",
    marginBottom: "1rem",
  },
  matchBlock: {
    marginBottom: "1.5rem",
  },
  matchup: {
    fontSize: "1.2rem",
    marginBottom: "0.5rem",
  },
  bookRow: {
    marginLeft: "1rem",
    fontSize: "0.95rem",
  },
  button: {
    marginTop: "1rem",
    background: "transparent",
    border: "1px solid #ffe066",
    borderRadius: "8px",
    color: "#ffe066",
    padding: "0.4rem 1rem",
    cursor: "pointer",
    fontFamily: "'Limelight', sans-serif",
  },
};

export default OddsWidget;
