import requests
import json
import time


def get_fpl_data():
    print("Fetching FPL master list...")
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
    bootstrap_url = "https://fantasy.premierleague.com/api/bootstrap-static/"
    response = requests.get(bootstrap_url, headers=headers).json()

    teams = {
        team["id"]: {
            "short_name": team["short_name"],
            "logo": f"https://resources.premierleague.com/premierleague/badges/t{team['code']}.png",
        }
        for team in response["teams"]
    }

    positions = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}

    players_data = []
    elements = [p for p in response["elements"] if p["minutes"] > 0]

    print(f"Processing {len(elements)} players...")

    for player in elements:
        player_id = player["id"]
        fpl_name = player["web_name"]
        team_info = teams.get(player["team"], {"short_name": "UNK", "logo": ""})

        pos = positions.get(player["element_type"], "UNK")
        price = player["now_cost"] / 10.0

        chance = player.get("chance_of_playing_next_round")
        status_pct = chance if chance is not None else 100

        history_url = (
            f"https://fantasy.premierleague.com/api/element-summary/{player_id}/"
        )
        try:
            history_resp = requests.get(history_url, headers=headers).json()
            history = history_resp.get("history", [])

            if not history:
                continue

            recent_5 = history[-5:]
            recent_10 = history[-10:]

            def calc_stats(match_list):
                mins = sum(int(m.get("minutes", 0)) for m in match_list)
                max_mins = len(match_list) * 90
                min_pct = round((mins / max_mins) * 100) if max_mins > 0 else 0

                # Attempt to pull hidden defensive stats if available, otherwise 0
                defcon = sum(
                    int(
                        m.get("clearances_blocks_interceptions", m.get("recoveries", 0))
                    )
                    for m in match_list
                )
                saves = sum(int(m.get("saves", 0)) for m in match_list)

                return {
                    "minutes": mins,
                    "min_pct": min_pct,
                    "xG": sum(float(m.get("expected_goals", 0)) for m in match_list),
                    "xA": sum(float(m.get("expected_assists", 0)) for m in match_list),
                    "xGI": sum(
                        float(m.get("expected_goal_involvements", 0))
                        for m in match_list
                    ),
                    "xGC": sum(
                        float(m.get("expected_goals_conceded", 0)) for m in match_list
                    ),
                    "creativity": sum(
                        float(m.get("creativity", 0)) for m in match_list
                    ),
                    "threat": sum(float(m.get("threat", 0)) for m in match_list),
                    "ict": sum(float(m.get("ict_index", 0)) for m in match_list),
                    "bps": sum(int(m.get("bps", 0)) for m in match_list),
                    "bonus": sum(int(m.get("bonus", 0)) for m in match_list),
                    "points": sum(int(m.get("total_points", 0)) for m in match_list),
                    "saves": saves,
                    "defcon": defcon,
                }

            stats_5 = calc_stats(recent_5)
            stats_10 = calc_stats(recent_10)

            player_dict = {
                "name": fpl_name,
                "team": team_info["short_name"],
                "logo": team_info["logo"],
                "position": pos,
                "price": price,
                "status_pct": status_pct,
            }

            for prefix, stats in [("last_5", stats_5), ("last_10", stats_10)]:
                for key, val in stats.items():
                    player_dict[f"{prefix}_{key}"] = (
                        round(val, 2) if isinstance(val, float) else val
                    )

            players_data.append(player_dict)

            time.sleep(0.05)

        except Exception:
            continue

    with open("players.json", "w", encoding="utf-8") as f:
        json.dump(players_data, f, indent=2)

    print("Success! Saved updated FPL data.")


if __name__ == "__main__":
    get_fpl_data()
