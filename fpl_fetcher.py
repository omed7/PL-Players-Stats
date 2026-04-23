import requests
import json
import time
from datetime import datetime, timezone
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Moved outside player loop — was re-compiled ~500× per run previously
def calc_stats(match_list):
    mins     = sum(int(m.get('minutes', 0)) for m in match_list)
    max_mins = len(match_list) * 90
    min_pct  = round((mins / max_mins) * 100) if max_mins > 0 else 0
    return {
        "minutes":    mins,
        "min_pct":    min_pct,
        "goals":      sum(int(m.get('goals_scored', 0))                    for m in match_list),
        "assists":    sum(int(m.get('assists', 0))                         for m in match_list),
        "ppg":        round(sum(int(m.get('total_points', 0)) for m in match_list) / max(sum(1 for m in match_list if int(m.get('minutes', 0)) > 0), 1), 2),
        "clean_sheets": sum(int(m.get('clean_sheets', 0))                  for m in match_list),
        "xG":         sum(float(m.get('expected_goals', 0))               for m in match_list),
        "xA":         sum(float(m.get('expected_assists', 0))              for m in match_list),
        "xGI":        sum(float(m.get('expected_goal_involvements', 0))    for m in match_list),
        "creativity": sum(float(m.get('creativity', 0))                    for m in match_list),
        "threat":     sum(float(m.get('threat', 0))                        for m in match_list),
        "influence":  sum(float(m.get('influence', 0))                     for m in match_list),
        "ict":        sum(float(m.get('ict_index', 0))                     for m in match_list),
        "bps":        sum(int(m.get('bps', 0))                             for m in match_list),
        "bonus":      sum(int(m.get('bonus', 0))                           for m in match_list),
        "points":     sum(int(m.get('total_points', 0))                    for m in match_list),
        "saves":      sum(int(m.get('saves', 0))                           for m in match_list),
        "defcon":     sum(
            int(m.get('clearances_blocks_interceptions', 0)) +
            int(m.get('tackles', 0)) +
            int(m.get('recoveries', 0)) +
            int(m.get('saves', 0)) +
            (int(m.get('clean_sheets', 0)) * 5)
            for m in match_list
        ),
    }


def get_fpl_data():
    print("Initializing session...")
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504])
    session.mount('https://', HTTPAdapter(max_retries=retries))
    session.headers.update({'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
    req_timeout = 10

    print("Fetching FPL master list...")
    try:
        response = session.get(
            "https://fantasy.premierleague.com/api/bootstrap-static/",
            timeout=req_timeout
        ).json()
    except Exception as e:
        print(f"Fatal: failed to fetch bootstrap data: {e}")
        return

    teams = {
        team['id']: {
            'short_name': team['short_name'],
            'logo': f"https://resources.premierleague.com/premierleague/badges/t{team['code']}.png"
        }
        for team in response['teams']
    }
    positions = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}

    current_gw = next(
        (e['id'] for e in response['events'] if e['is_current']),
        next((e['id'] for e in response['events'] if e['is_next']), 1)
    )
    next_gws = list(range(current_gw, current_gw + 5))

    target_event = (
        next((e for e in response['events'] if e['is_next']), None) or
        next((e for e in response['events'] if e['is_current']), None)
    )
    deadline = target_event['deadline_time'] if target_event else None

    # Max possible minutes this season so far (used for season_min_pct)
    season_max_mins = max(current_gw * 90, 1)

    players_data = []
    elements = [p for p in response['elements'] if p['minutes'] > 0]
    print(f"Processing {len(elements)} players (GW {current_gw})...")

    for player in elements:
        player_id  = player['id']
        fpl_name   = player['web_name']
        team_info  = teams.get(player['team'], {'short_name': 'UNK', 'logo': ''})
        pos        = positions.get(player['element_type'], "UNK")
        price      = player['now_cost'] / 10.0
        chance     = player.get('chance_of_playing_next_round')
        status_pct = chance if chance is not None else 100
        ownership  = player.get('selected_by_percent', "0.0")

        # ── Feature 5: price change fields (FPL stores in tenths of £)
        cost_change_event = round((player.get('cost_change_event', 0) or 0) / 10, 1)
        cost_change_start = round((player.get('cost_change_start', 0) or 0) / 10, 1)

        # ── Feature: Transfer Trends
        transfers_in_event = int(player.get('transfers_in_event', 0))
        transfers_out_event = int(player.get('transfers_out_event', 0))
        net_transfers = transfers_in_event - transfers_out_event

        # ── Feature 1: season totals — all free from bootstrap, no extra API calls
        s_mins  = int(player.get('minutes', 0))
        season_fields = {
            "season_minutes":      s_mins,
            "season_min_pct":      round((s_mins / season_max_mins) * 100),
            "season_goals":        int(player.get('goals_scored', 0)),
            "season_assists":      int(player.get('assists', 0)),
            "season_clean_sheets": int(player.get('clean_sheets', 0)),
            "season_points":       int(player.get('total_points', 0)),
            "season_ppg":          round(float(player.get('points_per_game', 0) or 0), 2),
            "season_form":         round(float(player.get('form', 0) or 0), 1),
            "season_xG":           round(float(player.get('expected_goals', 0) or 0), 2),
            "season_xA":           round(float(player.get('expected_assists', 0) or 0), 2),
            "season_xGI":          round(float(player.get('expected_goal_involvements', 0) or 0), 2),
            "season_influence":    round(float(player.get('influence', 0) or 0), 1),
            "season_creativity":   round(float(player.get('creativity', 0) or 0), 1),
            "season_threat":       round(float(player.get('threat', 0) or 0), 1),
            "season_ict":          round(float(player.get('ict_index', 0) or 0), 1),
            "season_bps":          int(player.get('bps', 0)),
            "season_bonus":        int(player.get('bonus', 0)),
            "season_saves":        int(player.get('saves', 0)),
            "season_defcon":       0,   # not available from bootstrap
        }

        history_url = f"https://fantasy.premierleague.com/api/element-summary/{player_id}/"
        try:
            history_resp = session.get(history_url, timeout=req_timeout).json()
            history = history_resp.get('history', [])
            if not history:
                continue

            stats_5  = calc_stats(history[-5:])
            stats_10 = calc_stats(history[-10:])

            gw_history = [
                {
                    "gw":         m.get('round', 0),
                    "pts":        int(m.get('total_points', 0)),
                    "xG":         round(float(m.get('expected_goals', 0)), 2),
                    "xA":         round(float(m.get('expected_assists', 0)), 2),
                    "minutes":    int(m.get('minutes', 0)),
                    "bonus":      int(m.get('bonus', 0)),
                    "xGI":        round(float(m.get('expected_goal_involvements', 0)), 2),
                    "influence":  round(float(m.get('influence', 0)), 1),
                    "creativity": round(float(m.get('creativity', 0)), 1),
                    "threat":     round(float(m.get('threat', 0)), 1),
                    "ict":        round(float(m.get('ict_index', 0)), 1),
                    "bps":        int(m.get('bps', 0)),
                    "saves":      int(m.get('saves', 0)),
                    "defcon":     int(m.get('clearances_blocks_interceptions', 0)) + int(m.get('tackles', 0)) + int(m.get('recoveries', 0)) + int(m.get('saves', 0)) + (int(m.get('clean_sheets', 0)) * 5),
                }
                for m in history[-10:]
            ]

            fixtures_raw = history_resp.get('fixtures', [])
            upcoming = sorted(
                [f for f in fixtures_raw if not f.get('finished', True) and f.get('event') is not None],
                key=lambda x: (x['event'], x.get('id', 0))
            )
            seen_gws = []
            fixtures_data = []
            for f in upcoming:
                gw = f['event']
                if gw not in seen_gws:
                    seen_gws.append(gw)
                is_home  = f.get('is_home', True)
                opp_id   = f['team_a'] if is_home else f['team_h']
                opp_info = teams.get(opp_id, {'short_name': '?', 'logo': ''})
                fixtures_data.append({
                    "gw":            gw,
                    "opponent":      opp_info['short_name'],
                    "opponent_logo": opp_info['logo'],
                    "difficulty":    f.get('difficulty', 3),
                    "is_home":       is_home,
                })

            record = {
                "name":               fpl_name,
                "team":               team_info['short_name'],
                "logo":               team_info['logo'],
                "position":           pos,
                "price":              price,
                "status_pct":         status_pct,
                "ownership":          ownership,
                "cost_change_event":  cost_change_event,
                "cost_change_start":  cost_change_start,
                "transfers_in_event": transfers_in_event,
                "transfers_out_event": transfers_out_event,
                "net_transfers":      net_transfers,

                "last_5_minutes":    stats_5["minutes"],   "last_5_min_pct":    stats_5["min_pct"],
                "last_5_xG":         round(stats_5["xG"],2),   "last_5_xA":    round(stats_5["xA"],2),
                "last_5_goals":      stats_5["goals"], "last_5_assists": stats_5["assists"], "last_5_clean_sheets": stats_5["clean_sheets"], "last_5_ppg": stats_5["ppg"],
                "last_5_xGI":        round(stats_5["xGI"],2),
                "last_5_influence":  round(stats_5["influence"],2), "last_5_creativity": round(stats_5["creativity"],2),
                "last_5_threat":     round(stats_5["threat"],2), "last_5_ict":  round(stats_5["ict"],2),
                "last_5_bps":        stats_5["bps"],   "last_5_bonus":  stats_5["bonus"],
                "last_5_points":     stats_5["points"],"last_5_saves":  stats_5["saves"],
                "last_5_defcon":     stats_5["defcon"],

                "last_10_minutes":    stats_10["minutes"],  "last_10_min_pct":    stats_10["min_pct"],
                "last_10_xG":         round(stats_10["xG"],2),  "last_10_xA":  round(stats_10["xA"],2),
                "last_10_goals":      stats_10["goals"], "last_10_assists": stats_10["assists"], "last_10_clean_sheets": stats_10["clean_sheets"], "last_10_ppg": stats_10["ppg"],
                "last_10_xGI":        round(stats_10["xGI"],2),
                "last_10_influence":  round(stats_10["influence"],2), "last_10_creativity": round(stats_10["creativity"],2),
                "last_10_threat":     round(stats_10["threat"],2),"last_10_ict":round(stats_10["ict"],2),
                "last_10_bps":        stats_10["bps"],  "last_10_bonus":  stats_10["bonus"],
                "last_10_points":     stats_10["points"],"last_10_saves": stats_10["saves"],
                "last_10_defcon":     stats_10["defcon"],

                "gw_history": gw_history,
                "fixtures":   fixtures_data,
            }
            record.update(season_fields)
            players_data.append(record)
            time.sleep(0.05)
        except Exception as e:
            print(f"Failed to fetch {fpl_name}: {e}")
            continue

    fetched_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    output = {
        "fetched_at": fetched_at,
        "next_gws":   next_gws,
        "current_gw": current_gw,
        "deadline":   deadline,
        "players":    players_data,
    }
    with open("players.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"Done. {len(players_data)} players saved. GW={current_gw}, fetched_at={fetched_at}")


if __name__ == "__main__":
    get_fpl_data()
