/**
 * 棋谱 SQLite 接入层 (主进程)
 *
 * - 数据库为只读历史语料 chess_records.db
 *   * 开发期: 项目根目录 (app.getAppPath())
 *   * 打包期: process.resourcesPath  (通过 electron-builder extraResources 注入)
 * - 使用 better-sqlite3, readonly 模式打开, 避免 WAL/SHM 副文件
 * - 暴露纯函数式 API, 不直接绑定 IPC, 由 main.ts 注册 ipcMain.handle
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

// ---------- 类型 ----------

export interface RecordSummary {
    id: number;
    event: string | null;
    red_team: string | null;
    red_player: string | null;
    black_team: string | null;
    black_player: string | null;
    result: string | null;
    opening: string | null;
}

export interface RecordWithMoves extends RecordSummary {
    moves: string;
}

export interface SearchOptions {
    keyword?: string;
    page?: number;
    pageSize?: number;
}

export interface SearchResult {
    data: RecordSummary[];
    total: number;
    page: number;
    pageSize: number;
}

// ---------- 路径解析 ----------

const DB_FILE_NAME = 'chess_records.db';

function resolveDbPath(): string {
    // 1. 打包后: extraResources 拷贝到 resourcesPath
    if (app.isPackaged) {
        const packed = path.join(process.resourcesPath, DB_FILE_NAME);
        if (fs.existsSync(packed)) return packed;
    }
    // 2. 开发期: 项目根目录
    const devPath = path.join(app.getAppPath(), DB_FILE_NAME);
    if (fs.existsSync(devPath)) return devPath;

    // 3. 兜底: 当前工作目录 (例如直接 node 起的场景)
    return path.resolve(process.cwd(), DB_FILE_NAME);
}

// ---------- 单例连接 ----------

let db: Database.Database | null = null;

/** 初始化连接, 应用启动时调用一次. */
export function initDatabase(): void {
    if (db) return;

    const dbPath = resolveDbPath();
    if (!fs.existsSync(dbPath)) {
        console.error(`[db] 数据库文件不存在: ${dbPath}`);
        throw new Error(`chess_records.db not found at ${dbPath}`);
    }

    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    // 只读连接也建议设置 temp_store=MEMORY 加速 ORDER BY
    db.pragma('temp_store = MEMORY');
    db.pragma('cache_size = -16000'); // 16MB 页缓存

    const row = db.prepare('SELECT COUNT(*) AS n FROM records').get() as { n: number };
    console.log(`[db] 已连接 ${dbPath}, 共 ${row.n.toLocaleString()} 局`);
}

/** 应用退出时调用. */
export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
    }
}

function ensureDb(): Database.Database {
    if (!db) {
        throw new Error('数据库未初始化, 请先调用 initDatabase()');
    }
    return db;
}

// ---------- 查询 ----------

/**
 * 分页搜索棋谱.
 * - keyword 为空: 按 id DESC 列表
 * - keyword 非空: 在 red_player / black_player / event 三列做 LIKE %kw% 模糊匹配
 * - 返回不含 moves 字段, 节省 IPC payload (单局 moves 可达数 KB)
 */
export function searchRecords(opts: SearchOptions = {}): SearchResult {
    const conn = ensureDb();

    const page = Math.max(1, Math.floor(opts.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize ?? 20)));
    const offset = (page - 1) * pageSize;
    const keyword = (opts.keyword ?? '').trim();

    const COLS = 'id, event, red_team, red_player, black_team, black_player, result, opening';

    let data: RecordSummary[];
    let total: number;

    if (keyword === '') {
        total = (conn.prepare('SELECT COUNT(*) AS n FROM records').get() as { n: number }).n;
        data = conn
            .prepare(
                `SELECT ${COLS} FROM records
                 ORDER BY id DESC
                 LIMIT @limit OFFSET @offset`
            )
            .all({ limit: pageSize, offset }) as RecordSummary[];
    } else {
        const like = `%${keyword}%`;
        total = (
            conn
                .prepare(
                    `SELECT COUNT(*) AS n FROM records
                     WHERE red_player   LIKE @kw
                        OR black_player LIKE @kw
                        OR event        LIKE @kw`
                )
                .get({ kw: like }) as { n: number }
        ).n;
        data = conn
            .prepare(
                `SELECT ${COLS} FROM records
                 WHERE red_player   LIKE @kw
                    OR black_player LIKE @kw
                    OR event        LIKE @kw
                 ORDER BY id DESC
                 LIMIT @limit OFFSET @offset`
            )
            .all({ kw: like, limit: pageSize, offset }) as RecordSummary[];
    }

    return { data, total, page, pageSize };
}

/**
 * 按 id 精准取单局, 包含 moves 字段.
 * 找不到返回 null, 不抛错 (前端可据此提示).
 */
export function getRecordMoves(id: number): RecordWithMoves | null {
    const conn = ensureDb();
    if (!Number.isFinite(id) || id <= 0) return null;

    const row = conn
        .prepare(
            `SELECT id, event, red_team, red_player, black_team, black_player,
                    result, opening, moves
             FROM records
             WHERE id = @id`
        )
        .get({ id: Math.floor(id) }) as RecordWithMoves | undefined;

    return row ?? null;
}
