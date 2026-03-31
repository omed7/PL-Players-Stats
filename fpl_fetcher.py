import requests
import json
import time
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def get_fpl_data():
    print("Initializing session with retries and timeouts...")

    session = requests.Session()
    retries = Retry(total=3, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504])
    session.mount('https://', HTTPAdapter(max_retries=retries))
    session.headers.update({'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
    req_timeout = 10

    print("Fetching FPL master list...")
    bootstrap_url = "https://fantasy.premierleague.com/api/bootstrap-static/"
    response = session.get(bootstrap_url, timeout=req_timeout).json()

    teams = {
        team['id']: {
            'short_name': team['short_name'],
            'logo': f"https://resources.premierleague.com/premierleague/badges/t{team['code']}.png"
        }
        for team in response['teams']
    }

    positions = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}

    # ── Determine the current gameweek ──────────────────────────────────────
    current_gw = next(
        (e['id'] for e in response['events'] if e['is_current']),
        next((e['id'] for e in response['events'] if e['is_next']), 1)
    )
    # Next 3 GWs for the meta block (used to detect blank GWs on the frontend)
    next_gws = [gw for gw in range(current_gw, current_gw + 5)]

    players_data = []
    elements = [p for p in response['elements'] if p['minutes'] > 0]
    print(f"Processing {len(elements)} players (GW {current_gw})...")

    for player in elements:
        player_id   = player['id']
        fpl_name    = player['web_name']
        team_info   = teams.get(player['team'], {'short_name': 'UNK', 'logo': ''})
        pos         = positions.get(player['element_type'], "UNK")
        price       = player['now_cost'] / 10.0
        chance      = player.get('chance_of_playing_next_round')
        status_pct  = chance if chance is not None else 100
        ownership   = player.get('selected_by_percent', "0.0")

        history_url = f"https://fantasy.premierleague.com/api/element-summary/{player_id}/"
        try:
            history_resp = session.get(history_url, timeout=req_timeout).json()
            history      = history_resp.get('history', [])

            if not history:
                continue

            recent_5  = history[-5:]
            recent_10 = history[-10:]

            def calc_stats(match_list):
                mins     = sum(int(m.get('minutes', 0)) for m in match_list)
                max_mins = len(match_list) * 90
                min_pct  = round((mins / max_mins) * 100) if max_mins > 0 else 0
                defcon   = sum(int(m.get('clearances_blocks_interceptions', 0)) for m in match_list)
                saves    = sum(int(m.get('saves', 0)) for m in match_list)
                return {
                    "minutes":    mins,
                    "min_pct":    min_pct,
                    "xG":         sum(float(m.get('expected_goals', 0)) for m in match_list),
                    "xA":         sum(float(m.get('expected_assists', 0)) for m in match_list),
                    "xGI":        sum(float(m.get('expected_goal_involvements', 0)) for m in match_list),
                    "xGC":        sum(float(m.get('expected_goals_conceded', 0)) for m in match_list),
                    "creativity": sum(float(m.get('creativity', 0)) for m in match_list),
                    "threat":     sum(float(m.get('threat', 0)) for m in match_list),
                    "ict":        sum(float(m.get('ict_index', 0)) for m in match_list),
                    "bps":        sum(int(m.get('bps', 0)) for m in match_list),
                    "bonus":      sum(int(m.get('bonus', 0)) for m in match_list),
                    "points":     sum(int(m.get('total_points', 0)) for m in match_list),
                    "saves":      saves,
                    "defcon":     defcon,
                }

            stats_5  = calc_stats(recent_5)
            stats_10 = calc_stats(recent_10)

            # ── GW-by-GW history for trend sparklines (last 10 matches) ──────
            gw_history = []
            for m in history[-10:]:
                gw_history.append({
                    "gw":     m.get('round', 0),
                    "pts":    int(m.get('total_points', 0)),
                    "xG":     round(float(m.get('expected_goals', 0)), 2),
                    "xA":     round(float(m.get('expected_assists', 0)), 2),
                    "minutes": int(m.get('minutes', 0)),
                })

            # ── Upcoming fixtures (next 3 gameweeks) ─────────────────────────
            fixtures_raw = history_resp.get('fixtures', [])
            upcoming = sorted(
                [f for f in fixtures_raw
                 if not f.get('finished', True) and f.get('event') is not None],
                key=lambda x: (x['event'], x.get('id', 0))
            )

            # Group by GW, collect up to 3 unique GWs
            seen_gws = []
            fixtures_data = []
            for f in upcoming:
                gw = f['event']
                if gw not in seen_gws:
                    if len(seen_gws) >= 3:
                        break
                    seen_gws.append(gw)
                is_home    = f.get('is_home', True)
                opp_id     = f['team_a'] if is_home else f['team_h']
                opp_info   = teams.get(opp_id, {'short_name': '?', 'logo': ''})
                difficulty = f.get('difficulty', 3)
                fixtures_data.append({
                    "gw":            gw,
                    "opponent":      opp_info['short_name'],
                    "opponent_logo": opp_info['logo'],
                    "difficulty":    difficulty,
                    "is_home":       is_home,
                })

            players_data.append({
                "name":       fpl_name,
                "team":       team_info['short_name'],
                "logo":       team_info['logo'],
                "position":   pos,
                "price":      price,
                "status_pct": status_pct,
                "ownership":  ownership,

                "last_5_minutes":    stats_5["minutes"],
                "last_5_min_pct":    stats_5["min_pct"],
                "last_5_xG":         round(stats_5["xG"], 2),
                "last_5_xA":         round(stats_5["xA"], 2),
                "last_5_xGI":        round(stats_5["xGI"], 2),
                "last_5_xGC":        round(stats_5["xGC"], 2),
                "last_5_creativity": round(stats_5["creativity"], 2),
                "last_5_threat":     round(stats_5["threat"], 2),
                "last_5_ict":        round(stats_5["ict"], 2),
                "last_5_bps":        stats_5["bps"],
                "last_5_bonus":      stats_5["bonus"],
                "last_5_points":     stats_5["points"],
                "last_5_saves":      stats_5["saves"],
                "last_5_defcon":     stats_5["defcon"],

                "last_10_minutes":    stats_10["minutes"],
                "last_10_min_pct":    stats_10["min_pct"],
                "last_10_xG":         round(stats_10["xG"], 2),
                "last_10_xA":         round(stats_10["xA"], 2),
                "last_10_xGI":        round(stats_10["xGI"], 2),
                "last_10_xGC":        round(stats_10["xGC"], 2),
                "last_10_creativity": round(stats_10["creativity"], 2),
                "last_10_threat":     round(stats_10["threat"], 2),
                "last_10_ict":        round(stats_10["ict"], 2),
                "last_10_bps":        stats_10["bps"],
                "last_10_bonus":      stats_10["bonus"],
                "last_10_points":     stats_10["points"],
                "last_10_saves":      stats_10["saves"],
                "last_10_defcon":     stats_10["defcon"],

                # ── New fields ──────────────────────────────────
                "gw_history": gw_history,
                "fixtures":   fixtures_data,
            })

            time.sleep(0.05)

        except Exception as e:
            print(f"Failed to fetch {fpl_name}: {e}")
            continue

    # ── Save — include root-level next_gws for BGW detection ────────────────
    output = {
        "next_gws": next_gws[:5],  # e.g. [32, 33, 34, 35, 36]
        "current_gw": current_gw,
        "players": players_data,
    }

    with open("players.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"Done. Saved {len(players_data)} players. next_gws={next_gws[:5]}")

if __name__ == "__main__":
    get_fpl_data()