import requests
import json
import re
import unicodedata
import time
import urllib.parse
from difflib import get_close_matches

def normalize_name(name):
    nfkd = unicodedata.normalize('NFKD', name)
    return u"".join([c for c in nfkd if not unicodedata.combining(c)]).lower()

def fetch_understat_html(target_url):
    # Use a free open proxy to bypass the Cloudflare block on GitHub Actions
    encoded_url = urllib.parse.quote(target_url, safe='')
    proxy_url = f"https://api.allorigins.win/get?url={encoded_url}"
    try:
        resp = requests.get(proxy_url, timeout=15).json()
        return resp.get('contents', '')
    except Exception as e:
        print(f"Proxy failed for {target_url}: {e}")
        return ""

def get_fpl_data():
    print("Fetching Understat master list via proxy...")
    html = fetch_understat_html('https://understat.com/league/EPL')
    
    understat_map = {}
    try:
        match = re.search(r"playersData\s*=\s*JSON\.parse\('(.*?)'\);", html)
        if match:
            understat_players = json.loads(match.group(1).encode('utf8').decode('unicode_escape'))
            understat_map = {normalize_name(p['player_name']): p['id'] for p in understat_players}
    except Exception as e:
        print("Failed to parse Understat master list:", e)

    understat_names = list(understat_map.keys())

    print("Fetching FPL master list...")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
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
    print("Scraping pure Last 5 Matches data (This will take a few minutes)...")
    
    # Filter out inactive players to speed up the loop
    elements = [p for p in response['elements'] if p['minutes'] > 0]
    
    for player in elements:
        player_id = player['id']
        fpl_name = f"{player['first_name']} {player['second_name']}"
        team_info = teams.get(player['team'], {'short_name': 'UNK', 'logo': ''})
        
        norm_full = normalize_name(fpl_name)
        norm_web = normalize_name(player['web_name'])
        
        u_id = None
        if understat_names:
            matches = get_close_matches(norm_full, understat_names, n=1, cutoff=0.7)
            if matches:
                u_id = understat_map[matches[0]]
            else:
                matches_web = get_close_matches(norm_web, understat_names, n=1, cutoff=0.7)
                if matches_web:
                    u_id = understat_map[matches_web[0]]

        last_5_chances_created = 0
        u_last_5_xg = None
        u_last_5_xa = None
        u_last_5_npxg = None
        
        if u_id:
            try:
                # Add a timestamp to bypass any proxy caching
                timestamp = int(time.time())
                u_html = fetch_understat_html(f'https://understat.com/player/{u_id}?t={timestamp}')
                
                u_match = re.search(r"matchesData\s*=\s*JSON\.parse\('(.*?)'\);", u_html)
                if u_match:
                    matches_data = json.loads(u_match.group(1).encode('utf8').decode('unicode_escape'))
                    recent_u_matches = matches_data[-5:]
                    
                    last_5_chances_created = sum(int(m.get('key_passes', 0)) for m in recent_u_matches)
                    u_last_5_xg = sum(float(m.get('xG', 0)) for m in recent_u_matches)
                    u_last_5_xa = sum(float(m.get('xA', 0)) for m in recent_u_matches)
                    u_last_5_npxg = sum(float(m.get('npxG', 0)) for m in recent_u_matches)
                # Sleep to prevent proxy throttling
                time.sleep(1) 
            except Exception:
                pass

        # Grab the rest of the stats securely from FPL
        history_url = f"https://fantasy.premierleague.com/api/element-summary/{player_id}/"
        try:
            history_resp = requests.get(history_url, headers=headers).json()
            recent_matches = history_resp.get('history', [])[-5:]
            
            if not recent_matches:
                continue

            last_5_xg = u_last_5_xg if u_last_5_xg is not None else sum(float(match.get('expected_goals', 0)) for match in recent_matches)
            last_5_xa = u_last_5_xa if u_last_5_xa is not None else sum(float(match.get('expected_assists', 0)) for match in recent_matches)
            last_5_npxg = u_last_5_npxg if u_last_5_npxg is not None else last_5_xg
            
            last_5_creativity = sum(float(match.get('creativity', 0)) for match in recent_matches)
            last_5_points = sum(int(match.get('total_points', 0)) for match in recent_matches)
            last_5_bonus = sum(int(match.get('bonus', 0)) for match in recent_matches)
            last_5_bps = sum(int(match.get('bps', 0)) for match in recent_matches)
            last_5_influence = sum(float(match.get('influence', 0)) for match in recent_matches)
            last_5_threat = sum(float(match.get('threat', 0)) for match in recent_matches)
            last_5_ict = sum(float(match.get('ict_index', 0)) for match in recent_matches)
            
            players_data.append({
                "name": fpl_name,
                "team": team_info['short_name'],
                "logo": team_info['logo'],
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
        
    print(f"Success! Saved pure Last 5 Matches data for {len(players_data)} players.")

if __name__ == "__main__":
    get_fpl_data()
