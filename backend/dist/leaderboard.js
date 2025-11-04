import { promises as fs } from 'fs';
import path from 'path';
const dataDir = path.resolve(process.cwd(), 'backend', 'data');
const filePath = path.join(dataDir, 'leaderboard.txt');
const reservedPath = path.join(dataDir, 'reserved_codes.txt');
async function ensureFile() {
    await fs.mkdir(dataDir, { recursive: true });
    try {
        await fs.access(filePath);
    }
    catch {
        await fs.writeFile(filePath, '', 'utf-8');
    }
    try {
        await fs.access(reservedPath);
    }
    catch {
        await fs.writeFile(reservedPath, '', 'utf-8');
    }
}
export async function readEntries() {
    await ensureFile();
    const txt = await fs.readFile(filePath, 'utf-8');
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const entries = [];
    for (const line of lines) {
        const [rankStr, rtStr, time, code, ...infoParts] = line.split(',');
        if (!rankStr || !rtStr || !time || !code)
            continue;
        const info = infoParts.join(',');
        const rank = Number(rankStr);
        const reactiountime = Number(rtStr);
        if (!Number.isFinite(rank) || !Number.isFinite(reactiountime))
            continue;
        entries.push({ rank, reactiountime, time, code, info });
    }
    // Ensure sorted and ranks consistent
    entries.sort((a, b) => a.reactiountime - b.reactiountime || a.time.localeCompare(b.time));
    entries.forEach((e, i) => (e.rank = i + 1));
    return entries;
}
export async function writeEntries(entries) {
    entries.sort((a, b) => a.reactiountime - b.reactiountime || a.time.localeCompare(b.time));
    entries.forEach((e, i) => (e.rank = i + 1));
    const lines = entries.map(e => [e.rank, e.reactiountime, e.time, e.code, e.info].join(','));
    await fs.writeFile(filePath, lines.join('\n') + (lines.length ? '\n' : ''), 'utf-8');
}
function sanitizeInfo(info) {
    // Limit length and replace commas to keep CSV simple
    const trimmed = info.slice(0, 32);
    return trimmed.replace(/,/g, '，').replace(/\r|\n/g, ' ');
}
function randomCode() {
    return Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
}
let writeQueue = Promise.resolve();
async function readReserved() {
    await ensureFile();
    const txt = await fs.readFile(reservedPath, 'utf-8');
    return new Set(txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean));
}
async function writeReserved(set) {
    const lines = Array.from(set);
    await fs.writeFile(reservedPath, lines.join('\n') + (lines.length ? '\n' : ''), 'utf-8');
}
export async function reserveUniqueCode() {
    // Generate a code not used in leaderboard nor reserved list; persist in reserved file
    await ensureFile();
    const [entries, reserved] = await Promise.all([readEntries(), readReserved()]);
    const used = new Set(entries.map(e => e.code));
    let code = randomCode();
    let guard = 0;
    while (used.has(code) || reserved.has(code)) {
        code = randomCode();
        guard++;
        if (guard > 1000)
            throw new Error('Failed to allocate code');
    }
    reserved.add(code);
    await writeReserved(reserved);
    return code;
}
async function releaseReservedCode(code) {
    const reserved = await readReserved();
    if (reserved.delete(code)) {
        await writeReserved(reserved);
    }
}
export async function insertEntry(reactiountime, infoRaw, providedCode) {
    const info = infoRaw ? sanitizeInfo(infoRaw) : '';
    if (!Number.isFinite(reactiountime) || reactiountime <= 0 || reactiountime > 3000) {
        throw new Error('Invalid reaction time');
    }
    const time = new Date().toISOString();
    // Serialize writes to avoid race conditions
    writeQueue = writeQueue.then(async () => {
        const entries = await readEntries();
        const codes = new Set(entries.map(e => e.code));
        const reserved = await readReserved();
        let code = providedCode && /^[0-9]{6}$/.test(providedCode) ? providedCode : '';
        if (code) {
            if (codes.has(code)) {
                throw new Error('该代号已被使用');
            }
            // 若来自预留列表则移除，若不在也允许，避免老版本客户端不预留时无法提交
            if (reserved.has(code)) {
                reserved.delete(code);
                await writeReserved(reserved);
            }
        }
        else {
            // 无提供代号时，生成新的且不与已用/预留冲突
            let c = randomCode();
            while (codes.has(c) || reserved.has(c))
                c = randomCode();
            code = c;
        }
        const newEntry = { rank: 0, reactiountime, time, code, info };
        entries.push(newEntry);
        await writeEntries(entries);
        return;
    });
    await writeQueue;
    const entries = await readEntries();
    const added = entries.find(e => e.time === time);
    return { entry: added, leaderboard: entries };
}
