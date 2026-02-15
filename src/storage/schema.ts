// Karma Storage Schema
// Drizzle ORM schema for SQLite

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 客户档案
export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  name: text('name'),
  gender: text('gender'),
  birthDate: text('birth_date'),
  birthDateLunar: text('birth_date_lunar'),
  birthPlace: text('birth_place'),
  currentCity: text('current_city'),

  // 八字信息
  baziSummary: text('bazi_summary'),
  zodiacWestern: text('zodiac_western'),
  zodiacChinese: text('zodiac_chinese'),
  personaArchetype: text('persona_archetype'),
  coreElements: text('core_elements', { mode: 'json' }),

  // 元数据
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  sessionCount: integer('session_count').default(1),
  metadata: text('metadata', { mode: 'json' }),
});

// 会话记录
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id),
  sdkSessionId: text('sdk_session_id'),

  platform: text('platform'),
  externalChatId: text('external_chat_id'),

  status: text('status').default('active'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),

  summary: text('summary'),
  metadata: text('metadata', { mode: 'json' }),
});

// 确认/否认的事实
export const confirmedFacts = sqliteTable('confirmed_facts', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id),
  sessionId: text('session_id').references(() => sessions.id),

  fact: text('fact').notNull(),
  category: text('category'),
  confirmed: integer('confirmed', { mode: 'boolean' }),

  originalPrediction: text('original_prediction'),
  clientResponse: text('client_response'),
  reframe: text('reframe'),

  createdAt: text('created_at').notNull(),
});

// 预测记录
export const predictions = sqliteTable('predictions', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id),
  sessionId: text('session_id').references(() => sessions.id),

  prediction: text('prediction').notNull(),
  targetYear: integer('target_year'),
  category: text('category'),
  status: text('status').default('pending'),

  createdAt: text('created_at').notNull(),
  verifiedAt: text('verified_at'),
  verificationNotes: text('verification_notes'),
});

// 消息记录
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id),

  role: text('role').notNull(),
  content: text('content').notNull(),
  rawContent: text('raw_content'),

  toolCalls: text('tool_calls', { mode: 'json' }),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
});

// Type exports
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type ConfirmedFact = typeof confirmedFacts.$inferSelect;
export type NewConfirmedFact = typeof confirmedFacts.$inferInsert;
export type Prediction = typeof predictions.$inferSelect;
export type NewPrediction = typeof predictions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
