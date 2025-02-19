const sequelize = require("../config/database");

sequelize
  .sync({ force: false })
  .then(() => {
    console.log("✅ Database synced successfully!");
    process.exit();
  })
  .catch((error) => {
    console.error("❌ Database sync failed:", error);
    process.exit(1);
  });

