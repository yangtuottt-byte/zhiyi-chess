#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * PGN -> SQLite 导入脚本
 *
 * 用法:
 *   node scripts/import_pgn.js <pgn文件或目录> [输出db路径]
 * 例:
 *   node scripts/import_pgn.js data/games.pgns
 *   node scripts/import_pgn.js data/                 (递归扫描 .pgns/.pgn)
 *   node scripts/import_pgn.js data/games.pgns chess_records.db
 *
 * 设计要点:
 *   - readline 逐行扫描, 内存常量级
 *   - 状态机: HEADERS -> MOVES -> 结算
 *   - 清洗走法: 去回合号 / 去结果标记 / "H2-E2" -> "h2e2"
 *   - better-sqlite3 事务批量提交 (BATCH_SIZE 局一次), 终端实时打印进度
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ------------------------------ SQLite 适配层 ------------------------------
// 优先使用 better-sqlite3 (有原生预编译时), 否则回退到 Node 22 内置 node:sqlite.
// 暴露统一接口: openDb(path) -> { exec, prepare(sql).run(obj), transaction(fn), pragma, close }

function loadSqliteBackend() {
    try {
        const Database = require('better-sqlite3');
        return {
            kind: 'better-sqlite3',
            open(dbPath) {
                const db = new Database(dbPath);
                return {
                    exec: (sql) => db.exec(sql),
                    prepare: (sql) => db.prepare(sql),
                    transaction: (fn) => db.transaction(fn),
                    pragma: (p) => db.pragma(p),
                    close: () => db.close(),
                };
            },
        };
    } catch (_) {
        // fallback
    }
    try {
        // Node >= 22.5: node:sqlite (实验性)
        const { DatabaseSync } = require('node:sqlite');
        return {
            kind: 'node:sqlite',
            open(dbPath) {
                const db = new DatabaseSync(dbPath);
                return {
                    exec: (sql) => db.exec(sql),
                    prepare: (sql) => {
                        const stmt = db.prepare(sql);
                        return {
                            run: (obj) => stmt.run(obj),
                            all: (...a) => stmt.all(...a),
                            get: (...a) => stmt.get(...a),
                        };
                    },
                    // 用显式 BEGIN/COMMIT 模拟 transaction
                    transaction: (fn) => {
                        return (rows) => {
                            db.exec('BEGIN');
                            try {
                                fn(rows);
                                db.exec('COMMIT');
                            } catch (e) {
                                db.exec('ROLLBACK');
                                throw e;
                            }
                        };
                    },
                    pragma: (p) => db.exec(`PRAGMA ${p}`),
                    close: () => db.close(),
                };
            },
        };
    } catch (e) {
        console.error('无法加载 SQLite 后端 (better-sqlite3 或 node:sqlite 都不可用):', e.message);
        process.exit(1);
    }
}

const sqlite = loadSqliteBackend();

// ------------------------------ 配置 ------------------------------

const BATCH_SIZE = 2000;            // 每多少局提交一次事务
const PROGRESS_EVERY = 500;         // 每多少局刷新一次终端进度

// 合法的 PGN 结果标记
const RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

// 元数据行: [Key "Value"]
const META_RE = /^\[(\w+)\s+"(.*)"\]\s*$/;

// 单个走法 token: 字母+数字+'-'+字母+数字 (中国象棋 9 列 a-i / 10 行 0-9)
const MOVE_RE = /^[A-Za-z]\d-[A-Za-z]\d$/;

// 回合号前缀: 1.   54.   1...
const TURN_RE = /\b\d+\.+/g;

// ------------------------------ DB ------------------------------

function openDatabase(dbPath) {
    const db = sqlite.open(dbPath);
    // 写入性能优化: WAL + 关闭同步刷盘 (导入期间安全, 导入完成后会 checkpoint)
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = OFF');
    db.pragma('temp_store = MEMORY');

    db.exec(`
        CREATE TABLE IF NOT EXISTS records (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            event        TEXT,
            red_team     TEXT,
            red_player   TEXT,
            black_team   TEXT,
            black_player TEXT,
            result       TEXT,
            opening      TEXT,
            moves        TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_records_event        ON records(event);
        CREATE INDEX IF NOT EXISTS idx_records_red_player   ON records(red_player);
        CREATE INDEX IF NOT EXISTS idx_records_black_player ON records(black_player);
    `);

    return db;
}

// ------------------------------ 清洗 ------------------------------

/**
 * 清洗一段走法文本, 输出 "h2e2 b9c7 h0g2 ..." 形式.
 * @param {string} raw 多行拼接后的走法字符串
 * @returns {string}
 */
function cleanMoves(raw) {
    if (!raw) return '';

    // 1. 去掉回合号前缀
    let s = raw.replace(TURN_RE, ' ');

    // 2. 去掉花括号注释 / 圆括号变着 (PGN 标准; 本数据集罕见但防御性处理)
    s = s.replace(/\{[^}]*\}/g, ' ').replace(/\([^)]*\)/g, ' ');

    // 3. 按空白切分, 逐 token 过滤
    const out = [];
    for (const tok of s.split(/\s+/)) {
        if (!tok) continue;
        if (RESULT_TOKENS.has(tok)) continue;
        if (!MOVE_RE.test(tok)) continue;        // 丢弃任何非走法残渣
        out.push(tok.replace('-', '').toLowerCase());
    }
    return out.join(' ');
}

// ------------------------------ 解析 ------------------------------

/**
 * 异步生成器: 逐局产出已清洗的 record 对象.
 * @param {string} filePath
 */
async function* parsePgnFile(filePath) {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    /** @type {Record<string,string>} */
    let headers = {};
    /** @type {string[]} */
    let moveLines = [];
    let inGame = false;            // 是否已开始收集一局 (至少有一个 header)
    let inMoves = false;           // 是否进入走法区

    const flush = () => {
        if (!inGame) return null;
        const movesStr = cleanMoves(moveLines.join(' '));
        const rec = {
            event:        headers.Event        || null,
            red_team:     headers.RedTeam      || null,
            red_player:   headers.Red          || null,
            black_team:   headers.BlackTeam    || null,
            black_player: headers.Black        || null,
            result:       headers.Result       || null,
            opening:      headers.Opening      || null,
            moves:        movesStr,
        };
        headers = {};
        moveLines = [];
        inGame = false;
        inMoves = false;
        return rec;
    };

    for await (const rawLine of rl) {
        const line = rawLine.trim();

        if (line === '') {
            // 空行: header 区与 move 区的天然分隔, 不结算
            if (inGame && Object.keys(headers).length > 0) inMoves = true;
            continue;
        }

        const meta = META_RE.exec(line);
        if (meta) {
            // 遇到新 header. 如果上一局已经收过 moves, 视为该局结束 -> 结算
            if (inMoves) {
                const r = flush();
                if (r) yield r;
            }
            headers[meta[1]] = meta[2];
            inGame = true;
            continue;
        }

        // 非 header 非空 -> 走法行
        inMoves = true;
        moveLines.push(line);

        // 行尾若为结果 token, 立即结算
        const lastTok = line.split(/\s+/).filter(Boolean).pop();
        if (lastTok && RESULT_TOKENS.has(lastTok)) {
            const r = flush();
            if (r) yield r;
        }
    }

    // 文件结束兜底
    const r = flush();
    if (r) yield r;
}

// ------------------------------ 文件收集 ------------------------------

function collectPgnFiles(target) {
    const stat = fs.statSync(target);
    if (stat.isFile()) return [target];

    const out = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(p);
            else if (/\.pgns?$/i.test(entry.name)) out.push(p);
        }
    };
    walk(target);
    return out.sort();
}

// ------------------------------ 主流程 ------------------------------

async function main() {
    const inputArg = process.argv[2];
    const dbPath = process.argv[3] || 'chess_records.db';

    if (!inputArg) {
        console.error('用法: node scripts/import_pgn.js <pgn文件或目录> [输出db路径]');
        process.exit(1);
    }
    if (!fs.existsSync(inputArg)) {
        console.error(`输入路径不存在: ${inputArg}`);
        process.exit(1);
    }

    const files = collectPgnFiles(inputArg);
    if (files.length === 0) {
        console.error('未找到任何 .pgn / .pgns 文件');
        process.exit(1);
    }

    console.log(`目标数据库: ${path.resolve(dbPath)}`);
    console.log(`待处理文件: ${files.length} 个`);

    const db = openDatabase(dbPath);
    const insert = db.prepare(`
        INSERT INTO records
            (event, red_team, red_player, black_team, black_player, result, opening, moves)
        VALUES
            (@event, @red_team, @red_player, @black_team, @black_player, @result, @opening, @moves)
    `);
    const insertMany = db.transaction((rows) => {
        for (const r of rows) insert.run(r);
    });

    let total = 0;
    let skipped = 0;
    let buffer = [];
    const t0 = Date.now();

    const flushBatch = () => {
        if (buffer.length === 0) return;
        insertMany(buffer);
        buffer = [];
    };

    const printProgress = () => {
        const sec = (Date.now() - t0) / 1000;
        const rate = total / Math.max(sec, 0.001);
        process.stdout.write(
            `\r已导入 ${total.toLocaleString()} 局  跳过 ${skipped}  ` +
            `用时 ${sec.toFixed(1)}s  速度 ${rate.toFixed(0)} 局/秒   `
        );
    };

    for (const file of files) {
        const fileSize = fs.statSync(file).size;
        console.log(`\n[文件] ${file}  (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

        for await (const rec of parsePgnFile(file)) {
            // 极宽松校验: 必须有走法, 否则丢弃
            if (!rec.moves) { skipped++; continue; }

            buffer.push(rec);
            total++;

            if (buffer.length >= BATCH_SIZE) flushBatch();
            if (total % PROGRESS_EVERY === 0) printProgress();
        }
    }

    flushBatch();
    printProgress();
    process.stdout.write('\n');

    // WAL 收尾
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();

    const sec = (Date.now() - t0) / 1000;
    console.log(`\n完成. 共 ${total.toLocaleString()} 局, 跳过 ${skipped} 局, 总耗时 ${sec.toFixed(1)}s.`);
    console.log(`数据库文件: ${path.resolve(dbPath)}`);
}

main().catch((err) => {
    console.error('\n导入失败:', err);
    process.exit(1);
});
