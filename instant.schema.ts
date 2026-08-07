import { i } from "@instantdb/core";

const _schema = i.schema({
  entities: {
    profiles: i.entity({
      ownerId: i.string().unique().indexed(),
      publicId: i.string().unique().indexed(),
      handle: i.string(),
      handleLower: i.string().unique().indexed(),
      displayName: i.string(),
      avatarUrl: i.string(),
      xUserId: i.string(),
      public: i.boolean().indexed(),
      consentVersion: i.string(),
      consentedAt: i.date(),
      updatedAt: i.date(),
      lastSyncedAt: i.date(),
    }),
    dailyTotals: i.entity({
      key: i.string().unique().indexed(),
      ownerId: i.string().indexed(),
      publicId: i.string().indexed(),
      date: i.string().indexed(),
      durationMs: i.number(),
      updatedAt: i.date(),
    }),
  },
  links: {
    dailyProfile: {
      forward: { on: "dailyTotals", has: "one", label: "profile", required: true },
      reverse: { on: "profiles", has: "many", label: "dailyTotals" },
    },
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
