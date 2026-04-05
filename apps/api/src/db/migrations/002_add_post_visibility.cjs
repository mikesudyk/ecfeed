/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns("posts", {
    visibility: {
      type: "varchar(20)",
      notNull: true,
      default: "public",
    },
  });

  pgm.addConstraint("posts", "posts_visibility_check", {
    check: "visibility IN ('public', 'team_only')",
  });

  pgm.createIndex("posts", "visibility");
};

exports.down = (pgm) => {
  pgm.dropIndex("posts", "visibility");
  pgm.dropConstraint("posts", "posts_visibility_check");
  pgm.dropColumns("posts", ["visibility"]);
};
