import requests
import json

def get_fpl_data():
    print("Fetching master list...")
    # 1. Get the master list of players and teams
    bootstrap_url = "https://fantasy.premierleague.com/api/bootstrap-static/"
    response = requests.get(bootstrap_url).json()
    
    # Create a dictionary to map team IDs to short names
    teams = {team['id']: team['short_name'] for team in response['teams']}
    
    players_data = []
    elements = response['elements']
    
    print("Processing players...")
    
    # 2. Loop through players
    for player in elements:
        # Skip players with 0 minutes this season to save processing time
        if player['minutes'] == 0:
            continue
            
        player_id = player['id']
        name = f"{player['first_name']} {player['second_name']}"
        team_name = teams.get(player['team'], "UNK")
        season_xg = float(player.get('expected_goals', 0))
        season_xa = float(player.get('expected_assists', 0))
        
        # 3. Get individual player history
        history_url = f"https://fantasy.premierleague.com/api/element-summary/{player_id}/"
        
        try:
            history_resp = requests.get(history_url).json()
            # Grab only the last 5 matches from their history
            recent_matches = history_resp.get('history', [])[-5:]
            
            # Calculate the sum for the last 5 matches
            last_5_xg = sum(float(match.get('expected_goals', 0)) for match in recent_matches)
            last_5_xa = sum(float(match.get('expected_assists', 0)) for match in recent_matches)
            
            # 4. Append the clean, formatted data to our list
            players_data.append({
                "name": name,
                "team": team_name,
                "season_xG": round(season_xg, 2),
                "season_xA": round(season_xa, 2),
                "last_5_xG": round(last_5_xg, 2),
                "last_5_xA": round(last_5_xa, 2)
            })
            
        except Exception as e:
            continue
        
    # 5. Save the calculated data to a JSON file
    with open("players.json", "w", encoding="utf-8") as f:
        json.dump(players_data, f, indent=2)
        
    print(f"Success! Saved data for {len(players_data)} players.")

if __name__ == "__main__":
    get_fpl_data()
