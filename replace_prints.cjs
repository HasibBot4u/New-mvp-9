const fs = require('fs');

let code = fs.readFileSync('backend/main.py', 'utf8');

if (!code.includes('import logging')) {
    code = code.replace('import os\n', 'import os\nimport logging\n\nlogging.basicConfig(level=logging.INFO, format=\'%(asctime)s - %(name)s - %(levelname)s - %(message)s\')\nlogger = logging.getLogger(\'nexusedu\')\n\n');
}

code = code.replace(/print\(([\s\S]*?),\s*flush=True\)/g, "logger.info($1)");
code = code.replace(/print\(([\s\S]*?)\)/g, "logger.info($1)");

fs.writeFileSync('backend/main.py', code);
console.log('done');
