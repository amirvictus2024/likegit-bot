// Telegram Like Bot - Main Handler
import { Bot, webhookCallback } from "grammy";
import { kv } from "@vercel/kv";

// Bot configuration
const bot = new Bot(process.env.BOT_TOKEN || "");

// Channel ID for mandatory subscription
const REQUIRED_CHANNEL = "@NoiDUsers";

// Bot commands
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  
  // Check if user is subscribed to required channel
  const isSubscribed = await checkSubscription(ctx, REQUIRED_CHANNEL);
  if (!isSubscribed) {
    return ctx.reply(
      `سلام ${username}! 👋\n\nبرای استفاده از ربات لایک، ابتدا باید عضو کانال ما شوید:\n\n${REQUIRED_CHANNEL}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "عضویت در کانال 📢", url: `https://t.me/${REQUIRED_CHANNEL.slice(1)}` }],
            [{ text: "بررسی عضویت ✅", callback_data: "check_subscription" }]
          ]
        }
      }
    );
  }

  // Main menu
  await showMainMenu(ctx);
});

// Check subscription callback
bot.callbackQuery("check_subscription", async (ctx) => {
  const isSubscribed = await checkSubscription(ctx, REQUIRED_CHANNEL);
  if (isSubscribed) {
    await showMainMenu(ctx);
  } else {
    await ctx.answer("هنوز عضو کانال نشده‌اید! لطفاً ابتدا عضو شوید.");
  }
});

// Main menu
async function showMainMenu(ctx) {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  
  // Check if user has set up a channel
  const userChannel = await kv.get(`user_channel:${userId}`);
  
  const buttons = [
    [{ text: "ساخت لایک 🎯", callback_data: "create_like" }],
    [{ text: "تنظیمات کانال ⚙️", callback_data: "channel_settings" }],
    [{ text: "آمار لایک‌ها 📊", callback_data: "like_stats" }]
  ];

  if (userChannel) {
    buttons.push([{ text: "کانال تنظیم شده: " + userChannel, callback_data: "view_channel" }]);
  }

  await ctx.reply(
    `سلام ${username}! 👋\n\nبه ربات لایک خوش آمدید!\n\nچه کاری می‌خواهید انجام دهید؟`,
    {
      reply_markup: {
        inline_keyboard: buttons
      }
    }
  );
}

// Create like
bot.callbackQuery("create_like", async (ctx) => {
  await ctx.reply(
    "لطفاً نام لایک مورد نظر خود را وارد کنید:\n\nمثال: لایک من، محصول جدید، ویدیو و...",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "لغو عملیات ❌", callback_data: "cancel_operation" }
          ],
          [
            { text: "🔙 بازگشت", callback_data: "back_to_menu" }
          ]
        ]
      }
    }
  );
  
  // Set user state to waiting for like name
  await kv.set(`user_state:${ctx.from.id}`, "waiting_like_name");
});

// Handle text messages for like creation
bot.on("message:text", async (ctx) => {
  const userId = ctx.from.id;
  const userState = await kv.get(`user_state:${userId}`);
  
  if (userState === "waiting_like_name") {
    const likeName = ctx.message.text;
    
    // Generate unique like ID
    const likeId = `like_${Date.now()}_${userId}`;
    
    // Save like data
    await kv.set(`like:${likeId}`, {
      name: likeName,
      userId: userId,
      username: ctx.from.username || ctx.from.first_name,
      createdAt: Date.now(),
      likes: 0
    });
    
    // Track like under creator stats
    const userLikes = (await kv.get(`user_likes:${userId}`)) || [];
    userLikes.unshift(likeId);
    await kv.set(`user_likes:${userId}`, userLikes);
    
    // Clear user state
    await kv.del(`user_state:${userId}`);
    
    // Check if user has set up a channel
    const userChannel = await kv.get(`user_channel:${userId}`);
    
    const buttons = [];
    
    if (userChannel) {
      // Like + Join row when channel is configured
      buttons.push([
        { text: "لایک ❤️", callback_data: `like_with_sub:${likeId}` },
        { text: "عضویت در کانال 📢", url: `https://t.me/${userChannel.slice(1)}` }
      ]);
    } else {
      buttons.push([
        { text: "لایک ❤️", callback_data: `like_simple:${likeId}` }
      ]);
    }
    
    // Share banner button
    buttons.push([{ text: "اشتراک بنر 📢", callback_data: `share_banner:${likeId}` }]);
    
    await ctx.reply(
      `✅ لایک شما با موفقیت ساخته شد!\n\n📝 نام: ${likeName}\n🆔 شناسه: ${likeId}\n\nحالا می‌توانید بنر لایک را اشتراک‌گذاری کنید:`,
      {
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    );
  }
});

// Share banner
bot.callbackQuery(/^share_banner:(.+)$/, async (ctx) => {
  const likeId = ctx.match[1];
  const likeData = await kv.get(`like:${likeId}`);
  
  if (!likeData) {
    return ctx.answer("لایک مورد نظر یافت نشد!");
  }
  
  const userChannel = await kv.get(`user_channel:${likeData.userId}`);
  
  let buttons = [
    [{ text: "🔙 بازگشت", callback_data: "back_to_menu" }]
  ];
  
  if (userChannel) {
    // Like + Join in the same row
    buttons.unshift([
      { text: "لایک ❤️", callback_data: `like_with_sub:${likeId}` },
      { text: "عضویت در کانال 📢", url: `https://t.me/${userChannel.slice(1)}` }
    ]);
  } else {
    buttons.unshift([
      { text: "لایک ❤️", callback_data: `like_simple:${likeId}` }
    ]);
  }
  
  await ctx.reply(
    `🎯 لایک: ${likeData.name}\n\n👤 سازنده: ${likeData.username}\n❤️ تعداد لایک: ${likeData.likes}\n\nبرای لایک کردن روی دکمه زیر کلیک کنید:`,
    {
      reply_markup: {
        inline_keyboard: buttons
      }
    }
  );
});

// Simple like (no subscription required)
bot.callbackQuery(/^like_simple:(.+)$/, async (ctx) => {
  const likeId = ctx.match[1];
  const likeData = await kv.get(`like:${likeId}`);
  
  if (!likeData) {
    return ctx.answer("لایک مورد نظر یافت نشد!");
  }
  
  // Prevent duplicate likes
  const userId = ctx.from.id;
  const alreadyLiked = await kv.get(`user_liked:${userId}:${likeId}`);
  if (alreadyLiked) {
    return ctx.answer("شما قبلاً این لایک را کرده‌اید!");
  }

  // Increment like count
  likeData.likes += 1;
  await kv.set(`like:${likeId}`, likeData);
  
  // Save user's like
  await kv.set(`user_liked:${userId}:${likeId}`, Date.now());
  
  await ctx.answer("✅ لایک شما ثبت شد!");
  
  // Update the message
  await ctx.editMessageText(
    `🎯 لایک: ${likeData.name}\n\n👤 سازنده: ${likeData.username}\n❤️ تعداد لایک: ${likeData.likes}\n\nبرای لایک کردن روی دکمه زیر کلیک کنید:`,
    {
      reply_markup: ctx.callbackQuery.message.reply_markup
    }
  );
});

// Like with subscription required
bot.callbackQuery(/^like_with_sub:(.+)$/, async (ctx) => {
  const likeId = ctx.match[1];
  const likeData = await kv.get(`like:${likeId}`);
  
  if (!likeData) {
    return ctx.answer("لایک مورد نظر یافت نشد!");
  }
  
  const userChannel = await kv.get(`user_channel:${likeData.userId}`);
  
  // Check if user is subscribed to the channel
  const isSubscribed = await checkSubscription(ctx, userChannel);
  
  if (!isSubscribed) {
    // Keyboard already contains join button; just notify
    return ctx.answer(`برای لایک کردن باید عضو کانال ${userChannel} باشید!`);
  }
  
  // Check if user already liked
  const userId = ctx.from.id;
  const alreadyLiked = await kv.get(`user_liked:${userId}:${likeId}`);
  
  if (alreadyLiked) {
    return ctx.answer("شما قبلاً این لایک را کرده‌اید!");
  }
  
  // Increment like count
  likeData.likes += 1;
  await kv.set(`like:${likeId}`, likeData);
  
  // Save user's like
  await kv.set(`user_liked:${userId}:${likeId}`, Date.now());
  
  await ctx.answer("✅ لایک شما ثبت شد!");
  
  // Update the message
  await ctx.editMessageText(
    `🎯 لایک: ${likeData.name}\n\n👤 سازنده: ${likeData.username}\n❤️ تعداد لایک: ${likeData.likes}\n\nبرای لایک کردن روی دکمه زیر کلیک کنید:`,
    {
      reply_markup: ctx.callbackQuery.message.reply_markup
    }
  );
});

// Check subscription for like
bot.callbackQuery(/^check_sub_for_like:(.+)$/, async (ctx) => {
  const likeId = ctx.match[1];
  const likeData = await kv.get(`like:${likeId}`);
  
  if (!likeData) {
    return ctx.answer("لایک مورد نظر یافت نشد!");
  }
  
  const userChannel = await kv.get(`user_channel:${likeData.userId}`);
  const isSubscribed = await checkSubscription(ctx, userChannel);
  
  if (isSubscribed) {
    // Process the like
    const userId = ctx.from.id;
    const alreadyLiked = await kv.get(`user_liked:${userId}:${likeId}`);
    
    if (alreadyLiked) {
      return ctx.answer("شما قبلاً این لایک را کرده‌اید!");
    }
    
    likeData.likes += 1;
    await kv.set(`like:${likeId}`, likeData);
    await kv.set(`user_liked:${userId}:${likeId}`, Date.now());
    
    await ctx.answer("✅ لایک شما ثبت شد!");
  } else {
    await ctx.answer("هنوز عضو کانال نشده‌اید!");
  }
});

// Channel settings
bot.callbackQuery("channel_settings", async (ctx) => {
  const userId = ctx.from.id;
  const userChannel = await kv.get(`user_channel:${userId}`);
  
  let message = "⚙️ تنظیمات کانال\n\n";
  
  if (userChannel) {
    message += `کانال فعلی: ${userChannel}\n\nبرای تغییر کانال، نام کانال جدید را وارد کنید:`;
  } else {
    message += "هیچ کانالی تنظیم نشده است.\n\nبرای تنظیم کانال، نام کانال را وارد کنید:";
  }
  
  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "لغو عملیات ❌", callback_data: "cancel_operation" }
        ],
        [
          { text: "🔙 بازگشت", callback_data: "back_to_menu" }
        ]
      ]
    }
  });
  
  // Set user state to waiting for channel name
  await kv.set(`user_state:${userId}`, "waiting_channel_name");
});

// Handle channel name input
bot.on("message:text", async (ctx) => {
  const userId = ctx.from.id;
  const userState = await kv.get(`user_state:${userId}`);
  
  if (userState === "waiting_channel_name") {
    let channelName = ctx.message.text.trim();
    
    // Remove @ if present
    if (channelName.startsWith('@')) {
      channelName = channelName.slice(1);
    }
    
    // Validate channel name
    if (channelName.length < 3) {
      await ctx.reply("نام کانال باید حداقل 3 کاراکتر باشد!");
      return;
    }
    
    // Save channel
    await kv.set(`user_channel:${userId}`, `@${channelName}`);
    
    // Clear user state
    await kv.del(`user_state:${userId}`);
    
    await ctx.reply(
      `✅ کانال ${channelName} با موفقیت تنظیم شد!\n\nحالا لایک‌های شما نیاز به عضویت در این کانال خواهند داشت.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 بازگشت به منو", callback_data: "back_to_menu" }]
          ]
        }
      }
    );
  }
});

// Like statistics
bot.callbackQuery("like_stats", async (ctx) => {
  const userId = ctx.from.id;
  
  // Get user's likes
  const userLikes = await kv.get(`user_likes:${userId}`) || [];
  
  let message = "📊 آمار لایک‌های شما\n\n";
  
  if (userLikes.length === 0) {
    message += "هنوز هیچ لایکی نساخته‌اید.";
  } else {
    message += `تعداد لایک‌های ساخته شده: ${userLikes.length}\n\n`;
    
    for (let i = 0; i < Math.min(userLikes.length, 5); i++) {
      const likeData = await kv.get(`like:${userLikes[i]}`);
      if (likeData) {
        message += `${i + 1}. ${likeData.name} - ${likeData.likes} لایک\n`;
      }
    }
    
    if (userLikes.length > 5) {
      message += `\nو ${userLikes.length - 5} لایک دیگر...`;
    }
  }
  
  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 بازگشت", callback_data: "back_to_menu" }]
      ]
    }
  });
});

// Back to menu
bot.callbackQuery("back_to_menu", async (ctx) => {
  await showMainMenu(ctx);
});

// Cancel any in-progress operation and return to main menu
bot.callbackQuery("cancel_operation", async (ctx) => {
  const userId = ctx.from.id;
  await kv.del(`user_state:${userId}`);
  await ctx.answer("عملیات لغو شد.");
  await showMainMenu(ctx);
});

// Check if user is subscribed to a channel
async function checkSubscription(ctx, channel) {
  try {
    const chatMember = await ctx.api.getChatMember(channel, ctx.from.id);
    return chatMember.status !== "left" && chatMember.status !== "kicked";
  } catch (error) {
    console.error("Error checking subscription:", error);
    return false;
  }
}

// Error handling
bot.catch((err) => {
  console.error("Bot error:", err);
});

// Export for Cloudflare Pages
export default {
  async fetch(request, env, ctx) {
    // Set environment variables
    process.env.BOT_TOKEN = env.BOT_TOKEN;
    
    // Handle webhook
    return webhookCallback(bot, "cloudflare-mod")(request);
  }
};
