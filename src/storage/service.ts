// Karma Storage Service
// SQLite-based persistence layer

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, desc } from 'drizzle-orm';
import {
  clients,
  sessions,
  confirmedFacts,
  predictions,
  messages,
  type Client,
  type Session,
  type ConfirmedFact,
  type Prediction,
  type Message,
} from './schema.js';
import type {
  CreateClientInput,
  CreateSessionInput,
  CreateConfirmedFactInput,
  CreatePredictionInput,
  CreateMessageInput,
} from './types.js';

// Generate unique ID with prefix
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

export class StorageService {
  private db: Database.Database;
  private drizzleDb: ReturnType<typeof drizzle>;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.drizzleDb = drizzle(this.db);
    this.initializeTables();
  }

  // Initialize tables with SQL (auto-create)
  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT,
        gender TEXT,
        birth_date TEXT,
        birth_date_lunar TEXT,
        birth_place TEXT,
        current_city TEXT,
        bazi_summary TEXT,
        zodiac_western TEXT,
        zodiac_chinese TEXT,
        persona_archetype TEXT,
        core_elements TEXT,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        session_count INTEGER DEFAULT 1,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        client_id TEXT REFERENCES clients(id),
        sdk_session_id TEXT,
        platform TEXT,
        external_chat_id TEXT,
        status TEXT DEFAULT 'active',
        started_at TEXT NOT NULL,
        ended_at TEXT,
        summary TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS confirmed_facts (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES clients(id),
        session_id TEXT NOT NULL REFERENCES sessions(id),
        fact TEXT NOT NULL,
        category TEXT,
        confirmed INTEGER,
        original_prediction TEXT,
        client_response TEXT,
        reframe TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS predictions (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES clients(id),
        session_id TEXT NOT NULL REFERENCES sessions(id),
        prediction TEXT NOT NULL,
        target_year INTEGER,
        category TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        verified_at TEXT,
        verification_notes TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        raw_content TEXT,
        tool_calls TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON sessions(client_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_sdk_session_id ON sessions(sdk_session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_external_chat_id ON sessions(external_chat_id);
      CREATE INDEX IF NOT EXISTS idx_facts_client_id ON confirmed_facts(client_id);
      CREATE INDEX IF NOT EXISTS idx_predictions_client_id ON predictions(client_id);
      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    `);
  }

  // ===== 客户管理 =====

  async createClient(data: CreateClientInput): Promise<string> {
    const id = generateId('client');
    const now = new Date().toISOString();

    await this.drizzleDb.insert(clients).values({
      id,
      ...data,
      firstSeenAt: now,
      lastSeenAt: now,
      sessionCount: 1,
    });

    return id;
  }

  async getClient(id: string): Promise<Client | null> {
    const result = await this.drizzleDb
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findClientByBirthInfo(birthDate: string, birthPlace: string): Promise<Client | null> {
    const result = await this.drizzleDb
      .select()
      .from(clients)
      .where(and(
        eq(clients.birthDate, birthDate),
        eq(clients.birthPlace, birthPlace)
      ))
      .limit(1);

    return result[0] || null;
  }

  async updateClient(id: string, data: Partial<Omit<Client, 'id' | 'firstSeenAt'>>): Promise<void> {
    const updateData = {
      ...data,
      lastSeenAt: new Date().toISOString(),
    };

    await this.drizzleDb
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id));
  }

  async searchClients(query: string): Promise<Client[]> {
    const result = await this.drizzleDb
      .select()
      .from(clients)
      .where(eq(clients.name, query));

    return result;
  }

  // ===== 会话管理 =====

  async createSession(data: CreateSessionInput): Promise<string> {
    const id = generateId('session');
    const now = new Date().toISOString();

    await this.drizzleDb.insert(sessions).values({
      id,
      ...data,
      status: 'active',
      startedAt: now,
    });

    return id;
  }

  async getSession(id: string): Promise<Session | null> {
    const result = await this.drizzleDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    return result[0] || null;
  }

  async getSessionByExternalChatId(platform: string, externalChatId: string): Promise<Session | null> {
    const result = await this.drizzleDb
      .select()
      .from(sessions)
      .where(and(
        eq(sessions.platform, platform),
        eq(sessions.externalChatId, externalChatId)
      ))
      .orderBy(desc(sessions.startedAt))
      .limit(1);

    return result[0] || null;
  }

  async getSessionBySdkId(sdkSessionId: string): Promise<Session | null> {
    const result = await this.drizzleDb
      .select()
      .from(sessions)
      .where(eq(sessions.sdkSessionId, sdkSessionId))
      .limit(1);

    return result[0] || null;
  }

  async updateSdkSessionId(sessionId: string, sdkSessionId: string): Promise<void> {
    await this.drizzleDb
      .update(sessions)
      .set({ sdkSessionId })
      .where(eq(sessions.id, sessionId));
  }

  async endSession(sessionId: string, summary?: string): Promise<void> {
    const updateData: Partial<Session> = {
      status: 'completed',
      endedAt: new Date().toISOString(),
    };

    if (summary) {
      updateData.summary = summary;
    }

    await this.drizzleDb
      .update(sessions)
      .set(updateData)
      .where(eq(sessions.id, sessionId));
  }

  // ===== 事实管理 =====

  async addConfirmedFact(data: CreateConfirmedFactInput): Promise<string> {
    const id = generateId('fact');

    await this.drizzleDb.insert(confirmedFacts).values({
      id,
      ...data,
      createdAt: new Date().toISOString(),
    });

    return id;
  }

  async getClientFacts(clientId: string): Promise<ConfirmedFact[]> {
    return this.drizzleDb
      .select()
      .from(confirmedFacts)
      .where(eq(confirmedFacts.clientId, clientId))
      .orderBy(desc(confirmedFacts.createdAt));
  }

  async getSessionFacts(sessionId: string): Promise<ConfirmedFact[]> {
    return this.drizzleDb
      .select()
      .from(confirmedFacts)
      .where(eq(confirmedFacts.sessionId, sessionId))
      .orderBy(desc(confirmedFacts.createdAt));
  }

  // ===== 预测管理 =====

  async addPrediction(data: CreatePredictionInput): Promise<string> {
    const id = generateId('fact');

    await this.drizzleDb.insert(predictions).values({
      id,
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    return id;
  }

  async getClientPredictions(clientId: string): Promise<Prediction[]> {
    return this.drizzleDb
      .select()
      .from(predictions)
      .where(eq(predictions.clientId, clientId))
      .orderBy(desc(predictions.createdAt));
  }

  async updatePredictionStatus(
    predictionId: string,
    status: Prediction['status'],
    notes?: string
  ): Promise<void> {
    const updateData: Partial<Prediction> = {
      status,
      verifiedAt: new Date().toISOString(),
    };

    if (notes) {
      updateData.verificationNotes = notes;
    }

    await this.drizzleDb
      .update(predictions)
      .set(updateData)
      .where(eq(predictions.id, predictionId));
  }

  // ===== 消息管理 =====

  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    rawContent?: string
  ): Promise<void> {
    const id = generateId('msg');

    await this.drizzleDb.insert(messages).values({
      id,
      sessionId,
      role,
      content,
      rawContent,
      createdAt: new Date().toISOString(),
    });
  }

  async getSessionMessages(sessionId: string, limit = 100): Promise<Message[]> {
    return this.drizzleDb
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  // ===== 工具方法 =====

  async generateClientProfilePrompt(clientId: string): Promise<string> {
    const client = await this.getClient(clientId);
    if (!client) {
      return '';
    }

    const parts: string[] = ['# 客户档案\n'];

    if (client.name) {
      parts.push(`姓名: ${client.name}`);
    }
    if (client.gender) {
      parts.push(`性别: ${client.gender === 'male' ? '男' : '女'}`);
    }
    if (client.birthDate) {
      parts.push(`生辰: ${client.birthDate}`);
    }
    if (client.birthPlace) {
      parts.push(`出生地: ${client.birthPlace}`);
    }
    if (client.currentCity) {
      parts.push(`现居: ${client.currentCity}`);
    }

    if (client.baziSummary) {
      parts.push(`\n## 已排定的八字\n${client.baziSummary}`);
    }

    // 添加确认的事实
    const facts = await this.getClientFacts(clientId);
    const confirmedFactsList = facts.filter(f => f.confirmed);
    if (confirmedFactsList.length > 0) {
      parts.push('\n## 已确认的事实');
      for (const fact of confirmedFactsList) {
        parts.push(`- ${fact.fact}`);
      }
    }

    // 添加预测
    const preds = await this.getClientPredictions(clientId);
    if (preds.length > 0) {
      parts.push('\n## 已做出的预测');
      for (const pred of preds) {
        const yearStr = pred.targetYear ? ` (${pred.targetYear}年)` : '';
        parts.push(`- ${pred.prediction}${yearStr}`);
      }
    }

    return parts.join('\n');
  }

  close(): void {
    this.db.close();
  }
}
