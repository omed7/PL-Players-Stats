import requests
import json
from concurrent.futures import ThreadPoolExecutor


def calc_stats(match_list):
    mins = 0
    defcon = 0
    saves = 0
    xg = 0.0
    xa = 0.0
    xgi = 0.0
    xgc = 0.0
    creativity = 0.0
    threat = 0.0
    ict = 0.0
    bps = 0
    bonus = 0
    points = 0

    for m in match_list:
        mins += int(m.get("minutes", 0))
        defcon += int(m.get("clearances_blocks_interceptions", m.get("recoveries", 0)))
        saves += int(m.get("saves", 0))
        xg += float(m.get("expected_goals", 0))
        xa += float(m.get("expected_assists", 0))
        xgi += float(m.get("expected_goal_involvements", 0))
        xgc += float(m.get("expected_goals_conceded", 0))
        creativity += float(m.get("creativity", 0))
        threat += float(m.get("threat", 0))
        ict += float(m.get("ict_index", 0))
        bps += int(m.get("bps", 0))
        bonus += int(m.get("bonus", 0))
        points += int(m.get("total_points", 0))

    max_mins = len(match_list) * 90
    min_pct = round((mins / max_mins) * 100) if max_mins > 0 else 0

    return {
        "minutes": mins,
        "min_pct": min_pct,
        "xG": xg,
        "xA": xa,
        "xGI": xgi,
        "xGC": xgc,
        "creativity": creativity,
        "threat": threat,
        "ict": ict,
        "bps": bps,
        "bonus": bonus,
        "points": points,
        "saves": saves,
        "defcon": defcon,
    }


def process_player(player, teams, positions, headers, session):
    player_id = player["id"]
    fpl_name = player["web_name"]
    team_info = teams.get(player["team"], {"short_name": "UNK", "logo": ""})

    pos = positions.get(player["element_type"], "UNK")
    price = player["now_cost"] / 10.0

    chance = player.get("chance_of_playing_next_round")
    status_pct = chance if chance is not None else 100

    history_url = f"https://fantasy.premierleague.com/api/element-summary/{player_id}/"
    try:
        history_resp = session.get(history_url, headers=headers, timeout=10).json()
        history = history_resp.get("history", [])

        if not history:
            return None

        recent_5 = history[-5:]
        recent_10 = history[-10:]

        player_obj = {
            "name": fpl_name,
            "team": team_info["short_name"],
            "logo": team_info["logo"],
            "position": pos,
            "price": price,
            "status_pct": status_pct,
        }

        # Add stats dynamically for both timeframes
        timeframes = [("last_5", recent_5), ("last_10", recent_10)]
        for prefix, match_list in timeframes:
            stats = calc_stats(match_list)
            for key, value in stats.items():
                if isinstance(value, float):
                    player_obj[f"{prefix}_{key}"] = round(value, 2)
                else:
                    player_obj[f"{prefix}_{key}"] = value

        return player_obj

    except requests.exceptions.RequestException as e:
        print(f"Network error fetching history for player {player_id}: {e}")
        return None
    except ValueError as e:
        print(f"JSON decoding error for player {player_id}: {e}")
        return None
    except KeyError as e:
        print(f"Missing expected data key for player {player_id}: {e}")
        return None
    except Exception as e:
        print(f"Error processing player {player_id}: {e}")
        return None


def get_fpl_data():
    print("Fetching FPL master list...")
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
    bootstrap_url = "https://fantasy.premierleague.com/api/bootstrap-static/"
    try:
        response = requests.get(bootstrap_url, headers=headers, timeout=10).json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching bootstrap data: {e}")
        return

    teams = {
        team["id"]: {
            "short_name": team["short_name"],
            "logo": f"https://resources.premierleague.com/premierleague/badges/t{team['code']}.png",
        }
        for team in response["teams"]
    }

    positions = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}

    elements = [p for p in response["elements"] if p["minutes"] > 0]

    print(f"Processing {len(elements)} players...")

    players_data = []

    max_workers = 20

    with requests.Session() as session:
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=max_workers, pool_maxsize=max_workers
        )
        session.mount("https://", adapter)
        session.mount("http://", adapter)

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Maintain original order by iterating over elements directly
            futures = [
                executor.submit(
                    process_player, player, teams, positions, headers, session
                )
                for player in elements
            ]

            for future in futures:
                try:
                    result = future.result()
                    if result:
                        players_data.append(result)
                except Exception as e:
                    print(f"Unhandled error in thread: {e}")

    with open("players.json", "w", encoding="utf-8") as f:
        json.dump(players_data, f, indent=2)

    print("Success! Saved updated FPL data.")


if __name__ == "__main__":
    get_fpl_data()
