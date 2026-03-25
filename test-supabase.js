const https = require('https');

const options = {
    hostname: 'phwsgpceksjplkbhtpri.supabase.co',
    port: 443,
    path: '/rest/v1/app_users?select=*',
    method: 'GET',
    headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBod3NncGNla3NqcGxrYmh0cHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NTMwMzIsImV4cCI6MjA4NjIyOTAzMn0.volcnhVx6lg7LeZbwVZ6Cx-cdY4tI7Z3FQUnGNWNDCw',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBod3NncGNla3NqcGxrYmh0cHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NTMwMzIsImV4cCI6MjA4NjIyOTAzMn0.volcnhVx6lg7LeZbwVZ6Cx-cdY4tI7Z3FQUnGNWNDCw'
    }
};

const req = https.request(options, res => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        console.log('BODY:', data);
    });
});

req.on('error', e => {
    console.error(e);
});

req.end();
