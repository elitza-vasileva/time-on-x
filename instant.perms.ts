import type { InstantRules } from "@instantdb/core";

const rules = {
  profiles: {
    allow: {
      view: "true",
      create: "isOwner && data.public == true && rateLimit.profileWrites.limit(auth.id)",
      update: "isOwner && newData.ownerId == auth.id && newData.publicId == data.publicId && rateLimit.profileWrites.limit(auth.id)",
      delete: "isOwner && rateLimit.profileWrites.limit(auth.id)",
    },
    bind: {
      isOwner: "auth.id != null && data.ownerId == auth.id",
    },
    fields: {
      ownerId: "auth.id == data.ownerId",
    },
  },
  dailyTotals: {
    allow: {
      view: "true",
      create: "isValidOwner && isValidDuration && rateLimit.totalWrites.limit(auth.id)",
      update: "isValidOwner && newData.ownerId == auth.id && newData.publicId == data.publicId && newData.key == data.key && newData.date == data.date && newData.durationMs >= 0 && newData.durationMs <= 86400000 && rateLimit.totalWrites.limit(auth.id)",
      delete: "isValidOwner && rateLimit.totalWrites.limit(auth.id)",
    },
    bind: {
      isValidOwner: "auth.id != null && data.ownerId == auth.id && auth.id in data.ref('profile.ownerId') && data.publicId in data.ref('profile.publicId')",
      isValidDuration: "data.durationMs >= 0 && data.durationMs <= 86400000",
    },
    fields: {
      ownerId: "auth.id == data.ownerId",
      key: "auth.id == data.ownerId",
    },
  },
  $default: {
    allow: { $default: "false" },
  },
  attrs: {
    allow: { $default: "false" },
  },
  $rateLimits: {
    profileWrites: {
      limits: [
        { capacity: 100, refill: { amount: 100, period: "1 day" } },
        { capacity: 50, refill: { amount: 50, period: "1 minute" } },
      ],
    },
    totalWrites: {
      limits: [
        { capacity: 1000, refill: { amount: 1000, period: "1 day" } },
        { capacity: 1000, refill: { amount: 1000, period: "1 minute" } },
      ],
    },
  },
} satisfies InstantRules;

export default rules;
