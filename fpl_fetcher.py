import requests
import json

def get_fpl_data():
    print("Fetching master list...")
    
    # Disguise the script as a web browser to bypass FPL security blocks
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
    
    # 1. Get the master list
    bootstrap_url = "https://fantasy.premierleague.com/api/bootstrap-static/"
    response = requests.get(bootstrap_url, headers=headers).json()
    
    teams = {team['id']: team['short_name'] for team in response['teams']}
    players_data = []
    
    print("Processing players...")
    
    # 2. Loop through players
    for player in response['elements']:
        if player['minutes'] == 0:
            continue
            
        player_id = player['id']
        name = f"{player['first_name']} {player['second_name']}"
        team_name = teams.get(player['team'], "UNK")
        season_xg = float(player.get('expected_goals', 0))
        season_xa = float(player.get('expected_assists', 0))
        
        # 3. Get individual history
        history_url = f"https://fantasy.premierleague.com/api/element-summary/{player_id}/"
        
        try:
            history_resp = requests.get(history_url, headers=headers).json()
            recent_matches = history_resp.get('history', [])[-5:]
            
            last_5_xg = sum(float(match.get('expected_goals', 0)) for match in recent_matches)
            last_5_xa = sum(float(match.get('expected_assists', 0)) for match in recent_matches)
            
            players_data.append({
                "name": name,
                "team": team_name,
                "season_xG": round(season_xg, 2),
                "season_xA": round(season_xa, 2),
                "last_5_xG": round(last_5_xg, 2),
                "last_5_xA": round(last_5_xa, 2)
            })
        except Exception:
            continue
            
    # 5. Save the data
    with open("players.json", "w", encoding="utf-8") as f:
        json.dump(players_data, f, indent=2)
        
    print(f"Success! Saved data for {len(players_data)} players.")

if __name__ == "__main__":
    get_fpl_data()
