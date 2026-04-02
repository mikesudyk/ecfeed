/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Enable UUID extension
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Users table
  pgm.createTable("users", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    google_id: { type: "varchar", notNull: true, unique: true },
    email: { type: "varchar", notNull: true, unique: true },
    display_name: { type: "varchar", notNull: true },
    avatar_url: { type: "varchar" },
    bio: { type: "varchar(280)" },
    role_title: { type: "varchar(100)" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  // Category enum
  pgm.createType("post_category", [
    "dev",
    "ai",
    "sales_marketing",
    "design",
    "other",
  ]);

  // Posts table (top-level posts and replies)
  pgm.createTable("posts", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    author_id: {
      type: "uuid",
      notNull: true,
      references: '"users"',
      onDelete: "CASCADE",
    },
    parent_id: {
      type: "uuid",
      references: '"posts"',
      onDelete: "CASCADE",
    },
    quoted_post_id: {
      type: "uuid",
      references: '"posts"',
      onDelete: "SET NULL",
    },
    title: { type: "varchar(200)" },
    body: { type: "text", notNull: true },
    url: { type: "varchar(2048)" },
    image_url: { type: "varchar(2048)" },
    category: { type: "post_category", notNull: true },
    depth: { type: "integer", notNull: true, default: 0 },
    reply_count: { type: "integer", notNull: true, default: 0 },
    like_count: { type: "integer", notNull: true, default: 0 },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  // Body length constraint
  pgm.addConstraint("posts", "posts_body_length", {
    check: "char_length(body) <= 2000",
  });

  // Likes table
  pgm.createTable("likes", {
    user_id: {
      type: "uuid",
      notNull: true,
      references: '"users"',
      onDelete: "CASCADE",
    },
    post_id: {
      type: "uuid",
      notNull: true,
      references: '"posts"',
      onDelete: "CASCADE",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.addConstraint("likes", "likes_pkey", {
    primaryKey: ["user_id", "post_id"],
  });

  // Link previews table
  pgm.createTable("link_previews", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    url: { type: "varchar(2048)", notNull: true, unique: true },
    title: { type: "varchar(500)" },
    description: { type: "varchar(1000)" },
    image_url: { type: "varchar(2048)" },
    site_name: { type: "varchar(200)" },
    favicon_url: { type: "varchar(2048)" },
    fetched_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  // Indexes
  pgm.createIndex("posts", "created_at", {
    name: "idx_posts_feed",
    where: "parent_id IS NULL",
    method: "btree",
  });
  pgm.createIndex("posts", ["parent_id", "created_at"], {
    name: "idx_posts_parent",
  });
  pgm.createIndex("posts", ["author_id", "created_at"], {
    name: "idx_posts_author",
  });
  pgm.createIndex("posts", "category", {
    name: "idx_posts_category",
    where: "parent_id IS NULL",
  });
  pgm.createIndex("posts", "quoted_post_id", {
    name: "idx_posts_quoted",
    where: "quoted_post_id IS NOT NULL",
  });
  pgm.createIndex("likes", "post_id", { name: "idx_likes_post" });
  pgm.createIndex("link_previews", "url", { name: "idx_link_previews_url" });
};

exports.down = (pgm) => {
  pgm.dropTable("link_previews");
  pgm.dropTable("likes");
  pgm.dropTable("posts");
  pgm.dropType("post_category");
  pgm.dropTable("users");
};
