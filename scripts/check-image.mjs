import { writeFile } from 'fs/promises';

async function check() {
  const url = 'https://serva-s.com/assets/images/groups/capcut-pro.png';
  const res = await fetch(url, { 
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  console.log(res.status, res.headers.get('content-type'));
}

check().catch(console.error);
