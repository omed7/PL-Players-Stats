import requests
import json

def get_fpl_data():
    print("Fetching master list...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
    
    bootstrap_url = "https://fantasy.premierleague.com/api/bootstrap-static/"
    response = requests.get(bootstrap_url, headers=headers).json()
    
    # Store the short_name and dynamically generate the official logo URL
    teams = {
        team['id']: {
            'short_name': team['short_name'], 
            'logo': f"https://resources.premierleague.com/premierleague/badges/t{team['code']}.png"
        } 
        for team in response['teams']
    }
    
    players_data = []
    print("Processing players...")
    
    for player in response['elements']:
        if player['minutes'] == 0:
            continue
            
        player_id = player['id']
        name = f"{player['first_name']} {player['second_name']}"
        team_info = teams.get(player['team'], {'short_name': 'UNK', 'logo': ''})
        
        # Season stats
        season_xg = float(player.get('expected_goals', 0))
        season_xa = float(player.get('expected_assists', 0))
        season_npxg = float(player.get('expected_goals_non_penalty', season_xg)) 
        season_creativity = float(player.get('creativity', 0))
        season_points = int(player.get('total_points', 0))
        
        history_url = f"https://fantasy.premierleague.com/api/element-summary/{player_id}/"
        try:
            history_resp = requests.get(history_url, headers=headers).json()
            recent_matches = history_resp.get('history', [])[-5:]
            
            # Last 5 Matches stats
            last_5_xg = sum(float(match.get('expected_goals', 0)) for match in recent_matches)
            last_5_xa = sum(float(match.get('expected_assists', 0)) for match in recent_matches)
            last_5_npxg = sum(float(match.get('expected_goals_non_penalty', match.get('expected_goals', 0))) for match in recent_matches)
            last_5_creativity = sum(float(match.get('creativity', 0)) for match in recent_matches)
            last_5_points = sum(int(match.get('total_points', 0)) for match in recent_matches)
            
            players_data.append({
                "name": name,
                "team": team_info['short_name'],
                "logo": team_info['logo'],
                "season_xG": round(season_xg, 2),
                "season_xA": round(season_xa, 2),
                "season_npxG": round(season_npxg, 2),
                "season_creativity": round(season_creativity, 2),
                "season_points": season_points,
                "last_5_xG": round(last_5_xg, 2),
                "last_5_xA": round(last_5_xa, 2),
                "last_5_npxG": round(last_5_npxg, 2),
                "last_5_creativity": round(last_5_creativity, 2),
                "last_5_points": last_5_points
            })
        except Exception:
            continue
            
    with open("players.json", "w", encoding="utf-8") as f:
        json.dump(players_data, f, indent=2)
        
    print(f"Success! Saved data for {len(players_data)} players.")

if __name__ == "__main__":
    get_fpl_data()
