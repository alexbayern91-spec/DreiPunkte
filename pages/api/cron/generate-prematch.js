
export default async function handler(req, res) {
  await fetch((process.env.VERCEL_URL?'https://'+process.env.VERCEL_URL:'http://localhost:3000')+'/api/matches');
  return res.status(200).json({ ok: true });
}
