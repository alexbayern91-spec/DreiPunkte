
export default async function handler(req, res) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const FHOST = 'footapi7.p.rapidapi.com';
  const FH = {'x-rapidapi-key': process.env.FOOTBALL_API_KEY, 'x-rapidapi-host': FHOST};
  const data = await fetch('https://'+FHOST+'/api/matches/'+now.getDate()+'/'+(now.getMonth()+1)+'/'+now.getFullYear(), {headers:FH}).then(r=>r.json());
  const events = data?.events || [];
  const rows = events.map(m => ({
    id: m.id, home_team: m.homeTeam?.name||'', away_team: m.awayTeam?.name||'',
    home_team_id: m.homeTeam?.id||null, away_team_id: m.awayTeam?.id||null,
    league: m.tournament?.uniqueTournament?.name||m.tournament?.name||'',
    start_timestamp: m.startTimestamp||null, status: m.status?.type||'scheduled',
    home_score: m.homeScore?.current??null, away_score: m.awayScore?.current??null,
    venue: m.venue?.stadium?.name||'', home_form: m.homeTeamForm||'', away_form: m.awayTeamForm||'',
    match_date: today, raw: m
  }));
  if (rows.length) await supabase.from('matches').upsert(rows, {onConflict:'id'});
  return res.status(200).json({ count: rows.length });
}
