import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
import { Sequelize } from "sequelize";
import User from "./models/User.js";
import dayjs from "dayjs";
import LocalSession from "telegraf-session-local";
import sequelize from "./config/database.js";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(new LocalSession({ database: "session_db.json" }).middleware());

const adminId = process.env.ADMIN_ID;
const isDebug = true;

let adminVerificationQueue = [];

async function isAdminCheck(ctx) {
  try {
    const user = await User.findOne({ where: { telegramId: ctx.from.id } });
    return user && user.isAdmin;
  } catch (error) {
    console.error("❌ Error checking admin status:", error);
    return false;
  }
}

const adminKeyboard = Markup.keyboard([
  ["📜 List Users", "👑 List Admins"],
  ["🗑 Delete User", "⬆ Promote User"],
  ["⬇ Unpromote Admin", "✅ Approve Pending Admins"],
  ["👤 My Profile"],
]);

const userKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("My Profile", "my_profile")],
  [Markup.button.callback("Request to be Admin", "request_admin")],
]);

bot.command("start", async (ctx) => {
  try {
    const user = await User.findOne({ where: { telegramId: ctx.from.id } });

    if (user) {
      ctx.reply("You are already registered.");
    } else {
      ctx.session = {};
      ctx.reply("Welcome! Please enter your full name:");
      ctx.session.step = "ask_fullName";
    }

    if (await isAdminCheck(ctx)) {
      ctx.reply("Admin Panel:", adminKeyboard);
    } else {
    
    }
  } catch (err) {
    console.error("Error in /start command:", err);
    ctx.reply("An error occurred while starting the bot. Please try again.");
  }
});

bot.action("my_profile", async (ctx) => {
  try {
    const userId = ctx.from.id;
    const user = await User.findOne({ where: { telegramId: userId } });

    if (!user) {
      return ctx.reply("You are not registered. Use /register to sign up.");
    }

    ctx.reply(
      `📌 *Your Profile:*\n\n👤 *Full Name:* ${user.fullName}\n📧 *Email:* ${user.email}\n📞 *Phone:* ${user.phoneNumber}`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error(error);
    ctx.reply("An error occurred while fetching your profile.");
  }
});

bot.hears("👤 My Profile", async (ctx) => {
  try {
    const user = await User.findOne({ where: { telegramId: ctx.from.id } });
    if (!user) return ctx.reply("You are not registered.");

    const registrationDate = dayjs(user.createdAt).format(
      "MMMM D, YYYY h:mm A"
    );
    const profileMessage = `
      👤 Name: ${user.fullName}
      📧 Email: ${user.email}
      📱 Phone: ${user.phoneNumber}
      📅 Registered: ${registrationDate}
    `;

    ctx.reply(profileMessage);
  } catch (error) {
    console.error(error);
    ctx.reply("An error occurred while fetching your profile.");
  }
});

bot.hears("📜 List Users", async (ctx) => {
  try {
    if (!(await isAdminCheck(ctx))) return ctx.reply("Unauthorized.");
    await listUsers(ctx, 1);
  } catch (error) {
    console.error(error);
    ctx.reply("An error occurred while fetching the user list.");
  }
});

bot.hears("👑 List Admins", async (ctx) => {
  try {
    if (!(await isAdminCheck(ctx))) return ctx.reply("Unauthorized.");

    const admins = await User.findAll({ where: { isAdmin: true } });

    if (admins.length === 0) return ctx.reply("There are no admins.");

    let message = "List of Admins:\n\n";
    admins.forEach((admin, index) => {
      const registrationDate = dayjs(admin.createdAt).format(
        "MMMM D, YYYY h:mm A"
      );
      message += `${index + 1}. 
      👤 Name: ${admin.fullName}
      📧 Email: ${admin.email}
      📱 Phone: ${admin.phoneNumber}
      💬 Telegram ID: ${admin.telegramId}
      📅 Registered: ${registrationDate}\n\n`;
    });

    ctx.reply(message);
  } catch (error) {
    console.error(error);
    ctx.reply("An error occurred while fetching the admin list.");
  }
});

bot.hears("🗑 Delete User", async (ctx) => {
  try {
    if (!(await isAdminCheck(ctx))) return ctx.reply("Unauthorized.");
    ctx.reply("Send the Telegram ID of the user to delete:");
    ctx.session.action = "delete";
  } catch (error) {
    console.error(error);
    ctx.reply("An error occurred while initiating the delete action.");
  }
});

bot.hears("⬆ Promote User", async (ctx) => {
  try {
    if (!(await isAdminCheck(ctx))) return ctx.reply("Unauthorized.");
    ctx.reply("Send the Telegram ID of the user to promote:");
    ctx.session.action = "promote";
  } catch (error) {
    console.error(error);
    ctx.reply("An error occurred while initiating the promote action.");
  }
});

bot.hears("⬇ Unpromote Admin", async (ctx) => {
  try {
    if (!(await isAdminCheck(ctx))) return ctx.reply("Unauthorized.");
    ctx.reply("Send the Telegram ID of the admin to unpromote:");
    ctx.session.action = "unpromote";
  } catch (error) {
    console.error(error);
    ctx.reply("An error occurred while initiating the unpromote action.");
  }
});

bot.hears("✅ Approve Pending Admins", async (ctx) => {
  try {
    if (!(await isAdminCheck(ctx))) return ctx.reply("Unauthorized.");
    if (adminVerificationQueue.length === 0)
      return ctx.reply("No pending approvals.");
    let message = "Pending Admin Approvals:\n\n";
    adminVerificationQueue.forEach((user, index) => {
      message += `${index + 1}. 
      👤 Name: ${user.fullName} 
      📧 Email: ${user.email} 
      💬 Telegram ID: ${user.telegramId}\n`;
    });
    ctx.reply(message);
  } catch (error) {
    console.error(error);
    ctx.reply("An error occurred while approving pending admins.");
  }
});

bot.action("request_admin", async (ctx) => {
  try {
    const userId = ctx.from.id;
    const user = await User.findOne({ where: { telegramId: userId } });

    if (!user) {
      return ctx.reply("You are not registered. Please register first.");
    }

    if (user.isAdmin) {
      return ctx.reply("You are already an admin.");
    }

    if (
      adminVerificationQueue.some(
        (pendingUser) => pendingUser.telegramId === userId
      )
    ) {
      return ctx.reply("Your request to become an admin is already pending.");
    }

    adminVerificationQueue.push(user);
    ctx.reply(
      "Your request to become an admin has been submitted and is awaiting approval."
    );
  } catch (error) {
    console.error(error);
    ctx.reply("An error occurred while submitting your admin request.");
  }
});

bot.on("text", async (ctx) => {
  try {
    if (!ctx.session) ctx.session = {};

    if (ctx.session.action === "promote") {
      await promoteUser(ctx, ctx.message.text);
    } else if (ctx.session.action === "delete") {
      await deleteUser(ctx, ctx.message.text);
    } else if (ctx.session.action === "unpromote") {
      await unpromoteAdmin(ctx, ctx.message.text);
    } else if (ctx.session.step === "ask_fullName") {
      ctx.session.fullName = ctx.message.text;
      ctx.session.step = "ask_email";
      ctx.reply("Now enter your email:");
    } else if (ctx.session.step === "ask_email") {
      if (!validateEmail(ctx.message.text))
        return ctx.reply("Please enter a valid email.");
      ctx.session.email = ctx.message.text;
      ctx.session.step = "ask_phoneNumber";
      ctx.reply("Now enter your phone number:");
    } else if (ctx.session.step === "ask_phoneNumber") {
      if (!validatePhoneNumber(ctx.message.text))
        return ctx.reply("Please enter a valid phone number.");
      ctx.session.phoneNumber = ctx.message.text;
      const telegramId = ctx.from.id;

      const existingUser = await User.findOne({
        where: {
          [sequelize.Sequelize.Op.or]: [
            { email: ctx.session.email },
            { telegramId },
          ],
        },
      });

      if (existingUser)
        return ctx.reply("This email or Telegram ID is already registered.");

      await User.create({
        fullName: ctx.session.fullName,
        email: ctx.session.email,
        phoneNumber: ctx.session.phoneNumber,
        isAdmin: false,
        telegramId,
      });

      ctx.reply("Registration complete!");
      ctx.session = {};

      ctx.reply(
        "You are now registered! Choose an option below:",
        userKeyboard
      );
    }
  } catch (error) {
    console.error(error);
    ctx.reply("An error occurred while processing your message.");
  }
});


async function promoteUser(ctx, telegramId) {
  try {
    const user = await User.findOne({ where: { telegramId } });
    if (!user) return ctx.reply("User not found.");

    user.isAdmin = true;
    await user.save();

    adminVerificationQueue = adminVerificationQueue.filter(
      (pendingUser) => pendingUser.telegramId !== telegramId
    );


    ctx.telegram.sendMessage(
      telegramId,
      "Congratulations! You have been promoted to an admin. You now have access to the admin panel."
    );

    ctx.reply(`${user.fullName} is now an admin.`);
  } catch (error) {
    console.error(error);
    ctx.reply("An error occurred while promoting the user.");
  }
}


async function deleteUser(ctx, telegramId) {
  try {
    const user = await User.findOne({ where: { telegramId } });
    if (!user) return ctx.reply("User not found.");
    await user.destroy();
    ctx.reply(`${user.fullName} has been deleted.`);
  } catch (error) {
    console.error(error);
    ctx.reply("An error occurred while deleting the user.");
  }
}

async function unpromoteAdmin(ctx, telegramId) {
  try {
    const user = await User.findOne({ where: { telegramId } });
    if (!user || !user.isAdmin)
      return ctx.reply("User not found or not an admin.");
    user.isAdmin = false;
    await user.save();
    ctx.reply(`${user.fullName} is no longer an admin.`);
  } catch (error) {
    console.error(error);
    ctx.reply("An error occurred while unpromoting the admin.");
  }
}

async function listUsers(ctx, page) {
  try {
    const usersPerPage = 10;
    const offset = (page - 1) * usersPerPage;
    const users = await User.findAll({ limit: usersPerPage, offset });

    if (users.length === 0) return ctx.reply("No users found.");

    let message = "Registered Users:\n\n";
    users.forEach((user, index) => {
      const registrationDate = dayjs(user.createdAt).format(
        "MMMM D, YYYY h:mm A"
      );
      message += `${index + 1}. 
      👤 Name: ${user.fullName}
      📧 Email: ${user.email}
      📱 Phone: ${user.phoneNumber}
      💬 Telegram ID: ${user.telegramId}
      📅 Registered: ${registrationDate}\n\n`;
    });

    const totalUsers = await User.count();
    const totalPages = Math.ceil(totalUsers / usersPerPage);

    let buttons = [];
    if (page > 1) {
      buttons.push(Markup.button.callback("◀ Previous", `page_${page - 1}`));
    }
    if (page < totalPages) {
      buttons.push(Markup.button.callback("Next ▶", `page_${page + 1}`));
    }

    ctx.reply(message, Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error(error);
    ctx.reply("An error occurred while fetching the user list.");
  }
}

function validateEmail(email) {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email);
}

function validatePhoneNumber(phoneNumber) {
  const re = /^[\+]?[0-9]{10,}$/;
  return re.test(phoneNumber);
}

bot.launch();
export default bot;

