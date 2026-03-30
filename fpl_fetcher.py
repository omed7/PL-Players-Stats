import requests
import json
import time

def get_fpl_data():
    print("Fetching FPL master list...")
    headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
    bootstrap_url = "https://fantasy.premierleague.com/api/bootstrap-static/"
    response = requests.get(bootstrap_url, headers=headers).json()
    
    teams = {
        team['id']: {
            'short_name': team['short_name'], 
            'logo': f"https://resources.premierleague.com/premierleague/badges/t{team['code']}.png"
        } 
        for team in response['teams']
    }
    
    # Map FPL element types to actual positions
    positions = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}
    
    players_data = []
    elements = [p for p in response['elements'] if p['minutes'] > 0]
    
    print(f"Processing {len(elements)} players for Last 5 and Last 10 matches...")
    
    for player in elements:
        player_id = player['id']
        fpl_name = player['web_name'] 
        team_info = teams.get(player['team'], {'short_name': 'UNK', 'logo': ''})
        
        # Base Player Info
        pos = positions.get(player['element_type'], "UNK")
        price = player['now_cost'] / 10.0 # Converts 75 to 7.5
        
        # Injury/Suspension Status (FPL returns None if perfectly healthy)
        chance = player.get('chance_of_playing_next_round')
        status_pct = chance if chance is not None else 100
        
        history_url = f"https://fantasy.premierleague.com/api/element-summary/{player_id}/"
        try:
            history_resp = requests.get(history_url, headers=headers).json()
            history = history_resp.get('history', [])
            
            if not history:
                continue
                
            recent_5 = history[-5:]
            recent_10 = history[-10:]
            
            def calc_stats(match_list):
                return {
                    "minutes": sum(int(m.get('minutes', 0)) for m in match_list),
                    "xG": sum(float(m.get('expected_goals', 0)) for m in match_list),
                    "xA": sum(float(m.get('expected_assists', 0)) for m in match_list),
                    "xGI": sum(float(m.get('expected_goal_involvements', 0)) for m in match_list),
                    "xGC": sum(float(m.get('expected_goals_conceded', 0)) for m in match_list),
                    "creativity": sum(float(m.get('creativity', 0)) for m in match_list),
                    "threat": sum(float(m.get('threat', 0)) for m in match_list),
                    "ict": sum(float(m.get('ict_index', 0)) for m in match_list),
                    "bps": sum(int(m.get('bps', 0)) for m in match_list),
                    "bonus": sum(int(m.get('bonus', 0)) for m in match_list),
                    "points": sum(int(m.get('total_points', 0)) for m in match_list)
                }
            
            stats_5 = calc_stats(recent_5)
            stats_10 = calc_stats(recent_10)
            
            players_data.append({
                "name": fpl_name,
                "team": team_info['short_name'],
                "logo": team_info['logo'],
                "position": pos,
                "price": price,
                "status_pct": status_pct,
                
                "last_5_minutes": stats_5["minutes"],
                "last_5_xG": round(stats_5["xG"], 2),
                "last_5_xA": round(stats_5["xA"], 2),
                "last_5_xGI": round(stats_5["xGI"], 2),
                "last_5_xGC": round(stats_5["xGC"], 2),
                "last_5_creativity": round(stats_5["creativity"], 2),
                "last_5_threat": round(stats_5["threat"], 2),
                "last_5_ict": round(stats_5["ict"], 2),
                "last_5_bps": stats_5["bps"],
                "last_5_bonus": stats_5["bonus"],
                "last_5_points": stats_5["points"],
                
                "last_10_minutes": stats_10["minutes"],
                "last_10_xG": round(stats_10["xG"], 2),
                "last_10_xA": round(stats_10["xA"], 2),
                "last_10_xGI": round(stats_10["xGI"], 2),
                "last_10_xGC": round(stats_10["xGC"], 2),
                "last_10_creativity": round(stats_10["creativity"], 2),
                "last_10_threat": round(stats_10["threat"], 2),
                "last_10_ict": round(stats_10["ict"], 2),
                "last_10_bps": stats_10["bps"],
                "last_10_bonus": stats_10["bonus"],
                "last_10_points": stats_10["points"]
            })
            
            time.sleep(0.05)
            
        except Exception:
            continue
            
    with open("players.json", "w", encoding="utf-8") as f:
        json.dump(players_data, f, indent=2)
        
    print(f"Success! Saved pure FPL data for {len(players_data)} players.")

if __name__ == "__main__":
    get_fpl_data()
