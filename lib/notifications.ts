import { prisma } from "@/lib/prisma";

type BoosterNotification = {
  boosterId: string;
  type: string;
  title: string;
  message: string;
};

export async function sendTelegramMessage(
  chatId: string | null,
  message: string
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!chatId || !botToken) {
    return;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: `${message}\n\ntrynda-business`,
      }),
    }
  );

  if (!response.ok) {
    console.error(
      "Telegram notification failed:",
      await response.text()
    );
  }
}

export async function notifyBooster(
  notification: BoosterNotification
) {
  try {
    const booster = await prisma.user.findUnique({
      where: { id: notification.boosterId },
      select: { telegramChatId: true },
    });

    if (!booster) {
      return;
    }

    await prisma.notification.create({
      data: {
        userId: notification.boosterId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
      },
    });

    await sendTelegramMessage(
      booster.telegramChatId,
      `${notification.title}\n${notification.message}`
    );
  } catch (error) {
    console.error(
      "Telegram notification error:",
      error
    );
  }
}