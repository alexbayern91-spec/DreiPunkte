
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { matchId, type = 'prematch' } = req.body;
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (!match) return res.status(404).json({ error: 'Match not found' });
    const { data: existing } = await supabase.from('analyses').select('*').eq('match_id', matchId).eq('type', type).single();
    if (existing) return res.status(200).json(existing);
    const FHOST = 'footapi7.p.rapidapi.com';
    const FH = {'x-rapidapi-key': process.env.FOOTBALL_API_KEY, 'x-rapidapi-host': FHOST};
    const [formRes, h2hRes] = await Promise.all([
      fetch('https://'+FHOST+'/api/match/'+matchId+'/form', {headers:FH}).then(r=>r.json()).catch(()=>null),
      fetch('https://'+FHOST+'/api/match/'+matchId+'/h2h', {headers:FH}).then(r=>r.json()).catch(()=>null),
    ]);
    const hf = formRes?.homeTeamForm?.map(f=>f.result).join('') || match.home_form || '';
    const af = formRes?.awayTeamForm?.map(f=>f.result).join('') || match.away_form || '';
    const h2h = h2hRes?.teamDuel?.previousEvents || [];
    const h2hTxt = h2h.slice(0,5).map(h=>h.homeTeam?.name+' '+h.homeScore?.current+'-'+h.awayScore?.current+' '+h.awayTeam?.name).join(' | ');
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 600,
      messages: [{role:'user', content:'Analyse pré-match football en français (200 mots max, HTML avec strong et span class hl). Match: '+match.home_team+' vs '+match.away_team+' — '+match.league+'. Forme domicile: '+hf+'. Forme extérieur: '+af+'. H2H: '+(h2hTxt||'non dispo')+'. Structure: 1-Contexte 2-Forme 3-Facteur clé 4-H2H 5-Lecture finale. Direct et factuel.'}]
    });
    const content = msg.content[0]?.text || '';
    const hw = (hf.match(/W/g)||[]).length; const aw = (af.match(/W/g)||[]).length;
    const t = Math.max(hw+aw,2);
    const ph = Math.round(hw/t*60+20); const pa = Math.round(aw/t*60+15); const pd = Math.max(100-ph-pa,10);
    const { data: saved } = await supabase.from('analyses').upsert({
      match_id: matchId, type, content, prono_home: ph, prono_draw: pd, prono_away: pa,
      h2h: h2h, generated_at: new Date().toISOString()
    }, {onConflict:'match_id,type'}).select().single();
    return res.status(200).json(saved);
  } catch(e) { return res.status(500).json({ error: e.message }); }
}
