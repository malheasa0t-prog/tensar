const fs = require('fs');
let content = fs.readFileSync('public/__tz-panel.html', 'utf8');
const regex = /\s*<div class="admin-login-overlay"[\s\S]*?<\/form>\s*<\/div>\s*<\/div>/;
content = content.replace(regex, '\n    <!-- Admin auth is enforced at the gate level -->');
fs.writeFileSync('public/__tz-panel.html', content);
console.log('Login overlay removed successfully');
