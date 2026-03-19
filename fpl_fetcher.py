import requests
import json
import re

# Scrape the raw Understat HTML
response = requests.get('https://understat.com/league/EPL')
html = response.text

# Extract the hidden JSON block using Regex
json_data = re.search(r"playersData\s*=\s*JSON\.parse\('(.*?)'\);", html)
understat_players = json.loads(json_data.group(1).encode('utf8').decode('unicode_escape'))

def get_fpl_data():
    print("Fetching master list...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
    
    bootstrap_url = "https://fantasy.premierleague.com/api/bootstrap-static/"
    response = requests.get(bootstrap_url, headers=headers).json()
    
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
        
        # Original Season stats
        season_xg = float(player.get('expected_goals', 0))
        season_xa = float(player.get('expected_assists', 0))
        season_npxg = float(player.get('expected_goals_non_penalty', season_xg)) 
        season_creativity = float(player.get('creativity', 0))
        season_points = int(player.get('total_points', 0))
        
        # NEW Season stats from FPL App Menu
        season_bonus = int(player.get('bonus', 0))
        season_bps = int(player.get('bps', 0))
        season_influence = float(player.get('influence', 0))
        season_threat = float(player.get('threat', 0))
        season_ict = float(player.get('ict_index', 0))
        season_chances_created = 0 # Placeholder: FPL API does not provide this natively
        
        history_url = f"https://fantasy.premierleague.com/api/element-summary/{player_id}/"
        try:
            history_resp = requests.get(history_url, headers=headers).json()
            recent_matches = history_resp.get('history', [])[-5:]
            
            # Original Last 5 Matches stats
            last_5_xg = sum(float(match.get('expected_goals', 0)) for match in recent_matches)
            last_5_xa = sum(float(match.get('expected_assists', 0)) for match in recent_matches)
            last_5_npxg = sum(float(match.get('expected_goals_non_penalty', match.get('expected_goals', 0))) for match in recent_matches)
            last_5_creativity = sum(float(match.get('creativity', 0)) for match in recent_matches)
            last_5_points = sum(int(match.get('total_points', 0)) for match in recent_matches)
            
            # NEW Last 5 Matches stats
            last_5_bonus = sum(int(match.get('bonus', 0)) for match in recent_matches)
            last_5_bps = sum(int(match.get('bps', 0)) for match in recent_matches)
            last_5_influence = sum(float(match.get('influence', 0)) for match in recent_matches)
            last_5_threat = sum(float(match.get('threat', 0)) for match in recent_matches)
            last_5_ict = sum(float(match.get('ict_index', 0)) for match in recent_matches)
            last_5_chances_created = 0 # Placeholder
            
            players_data.append({
                "name": name,
                "team": team_info['short_name'],
                "logo": team_info['logo'],
                "season_xG": round(season_xg, 2),
                "season_xA": round(season_xa, 2),
                "season_npxG": round(season_npxg, 2),
                "season_creativity": round(season_creativity, 2),
                "season_points": season_points,
                "season_bonus": season_bonus,
                "season_bps": season_bps,
                "season_influence": round(season_influence, 2),
                "season_threat": round(season_threat, 2),
                "season_ict": round(season_ict, 2),
                "season_chances_created": season_chances_created,
                "last_5_xG": round(last_5_xg, 2),
                "last_5_xA": round(last_5_xa, 2),
                "last_5_npxG": round(last_5_npxg, 2),
                "last_5_creativity": round(last_5_creativity, 2),
                "last_5_points": last_5_points,
                "last_5_bonus": last_5_bonus,
                "last_5_bps": last_5_bps,
                "last_5_influence": round(last_5_influence, 2),
                "last_5_threat": round(last_5_threat, 2),
                "last_5_ict": round(last_5_ict, 2),
                "last_5_chances_created": last_5_chances_created
            })
        except Exception:
            continue
            
    with open("players.json", "w", encoding="utf-8") as f:
        json.dump(players_data, f, indent=2)
        
    print(f"Success! Saved data for {len(players_data)} players.")

if __name__ == "__main__":
    get_fpl_data()
