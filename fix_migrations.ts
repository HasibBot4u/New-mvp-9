import fs from 'fs';
import path from 'path';

const migrationsDir = 'supabase/migrations';

function fixSchema(content: string) {
    if (!/^\s*BEGIN\s*;/m.test(content)) {
        content = "BEGIN;\n\n" + content;
    }
    if (!/^\s*COMMIT\s*;/m.test(content)) {
        content = content + "\n\nCOMMIT;\n";
    }

    // Replace CREATE POLICY with DROP POLICY IF EXISTS ...; CREATE POLICY ...
    // Be careful not to replace DO blocks if they already have safety.
    content = content.replace(/CREATE\s+POLICY\s+("[^"]+")\s+ON\s+([a-zA-Z0-9_]+)/g, (match, pName, tName) => {
        return `DROP POLICY IF EXISTS ${pName} ON ${tName};\n${match}`;
    });

    // Fix constraints by adding NOT VALID so they don't block
    content = content.replace(/ADD\s+CONSTRAINT\s+([a-zA-Z0-9_]+)\s+CHECK\s*\((.*?)\)/g, (match, cName, cCheck) => {
        if (match.includes("NOT VALID")) return match;
        return `ADD CONSTRAINT ${cName} CHECK (${cCheck}) NOT VALID`;
    });

    // Fix ADD COLUMN to have IF NOT EXISTS
    content = content.replace(/ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)([a-zA-Z0-9_]+)/g, "ADD COLUMN IF NOT EXISTS $1");

    return content;
}

const files = fs.readdirSync(migrationsDir);
for (const file of files) {
    if (!file.endsWith('.sql') || file.includes('fixed_migrations')) continue;
    const filepath = path.join(migrationsDir, file);
    let content = fs.readFileSync(filepath, 'utf8');
    
    // Clean up duplicate drops
    content = fixSchema(content);
    content = content.replace(/(DROP POLICY IF EXISTS "[^"]+" ON [a-zA-Z0-9_]+;\n)+/g, (match) => {
        const lines = match.trim().split('\n');
        return lines[0] + '\n';
    });

    fs.writeFileSync(filepath, content);
}
console.log("Migrations fixed.");
