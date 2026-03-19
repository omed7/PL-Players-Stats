import requests
import json
import re
import unicodedata
from difflib import get_close_matches

# Helper function to strip accents (e.g., Ødegaard -> Odegaard) for better matching
def normalize_name(name):
    nfkd_form = unicodedata.normalize('NFKD', name)
    return u"".join([c for c in nfkd_form if not unicodedata.combining(c)]).lower()

def get_understat_data():
    print("Fetching Understat data...")
    response = requests.get('https://understat.com/league/EPL')
    html = response.text
    
    # Extract the hidden JSON block using Regex
    match = re.search(r"playersData\s*=\s*JSON\.parse\('(.*?)'\);", html)
    if not match:
        print("Could not find Understat data.")
        return {}
        
    data = json.loads(match.group(1).encode('utf8').decode('unicode_escape'))
    
    understat_dict = {}
    for p in data:
        norm_name = normalize_name(p['player_name'])
        understat_dict[norm_name] = {
            'xG': float(p.get('xG', 0)),
            'xA': float(p.get('xA', 0)),
            'npxG': float(p.get('npxG', 0)),
            'key_passes': int(p.get('key_passes', 0))
        }
    return understat_dict

def get_fpl_data():
    # 1. Grab Understat data first
    understat_data = get_understat_data()
    understat_names = list(understat_data.keys())
    
    print("Fetching FPL master list...")
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
    print("Processing players and merging Understat stats...")
    
    for player in response['elements']:
        if player['minutes'] == 0:
            continue
            
        player_id = player['id']
        fpl_name = f"{player['first_name']} {player['second_name']}"
        fpl_web_name = player['web_name'] 
        team_info = teams.get(player['team'], {'short_name': 'UNK', 'logo': ''})
        
        # 2. Fuzzy Match the FPL name with the Understat name
        norm_full = normalize_name(fpl_name)
        norm_web = normalize_name(fpl_web_name)
        
        match_name = None
        matches = get_close_matches(norm_full, understat_names, n=1, cutoff=0.7)
        if matches:
            match_name = matches[0]
        else:
            matches_web = get_close_matches(norm_web, understat_names, n=1, cutoff=0.7)
            if matches_web:
                match_name = matches_web[0]
        
        # 3. Apply Understat data if matched, fallback to FPL if not
        if match_name:
            u_stats = understat_data[match_name]
            season_xg = u_stats['xG']
            season_xa = u_stats['xA']
            season_npxg = u_stats['npxG']
            season_chances_created = u_stats['key_passes']
        else:
            season_xg = float(player.get('expected_goals', 0))
            season_xa = float(player.get('expected_assists', 0))
            season_npxg = float(player.get('expected_goals_non_penalty', season_xg))
            season_chances_created = 0
            
        # FPL specific season stats
        season_creativity = float(player.get('creativity', 0))
        season_points = int(player.get('total_points', 0))
        season_bonus = int(player.get('bonus', 0))
        season_bps = int(player.get('bps', 0))
        season_influence = float(player.get('influence', 0))
        season_threat = float(player.get('threat', 0))
        season_ict = float(player.get('ict_index', 0))
        
        # 4. Process Match history for Last 5 Matches (FPL Data)
        history_url = f"https://fantasy.premierleague.com/api/element-summary/{player_id}/"
        try:
            history_resp = requests.get(history_url, headers=headers).json()
            recent_matches = history_resp.get('history', [])[-5:]
            
            last_5_xg = sum(float(match.get('expected_goals', 0)) for match in recent_matches)
            last_5_xa = sum(float(match.get('expected_assists', 0)) for match in recent_matches)
            last_5_npxg = sum(float(match.get('expected_goals_non_penalty', match.get('expected_goals', 0))) for match in recent_matches)
            last_5_creativity = sum(float(match.get('creativity', 0)) for match in recent_matches)
            last_5_points = sum(int(match.get('total_points', 0)) for match in recent_matches)
            last_5_bonus = sum(int(match.get('bonus', 0)) for match in recent_matches)
            last_5_bps = sum(int(match.get('bps', 0)) for match in recent_matches)
            last_5_influence = sum(float(match.get('influence', 0)) for match in recent_matches)
            last_5_threat = sum(float(match.get('threat', 0)) for match in recent_matches)
            last_5_ict = sum(float(match.get('ict_index', 0)) for match in recent_matches)
            last_5_chances_created = 0 # Cannot pull rapid match-by-match chances without getting banned
            
            players_data.append({
                "name": fpl_name,
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
        
    print(f"Success! Saved merged data for {len(players_data)} players.")

if __name__ == "__main__":
    get_fpl_data()
