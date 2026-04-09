const fs = require('fs');
const data = JSON.parse(fs.readFileSync('players.json'));
const state = { players: data.players };
const teamFixtures = {};
state.players.forEach((p) => {
  if (!teamFixtures[p.team]) teamFixtures[p.team] = [];
  if (teamFixtures[p.team].length === 0 && p.fixtures) {
    teamFixtures[p.team] = p.fixtures;
  }
});
for (let t in teamFixtures) {
  console.log(t, teamFixtures[t].map(f => f.gw));
}
