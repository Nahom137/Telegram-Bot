import { Sequelize } from "sequelize";

const sequelize = new Sequelize(
  process.env.DATABASE_URL ||
    "mysql://telegram_bot:telegram_bot@localhost:3306/telegram_bot_db",
  { logging: false }
);

export default sequelize;
