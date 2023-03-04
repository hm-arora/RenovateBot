// initReplicate();
const dotenv = require("dotenv");
const TelegramBot = require("node-telegram-bot-api");

dotenv.config();

const { REPLICATE_API_KEY, TELEGRAM_TOKEN } = process.env;

const bot = new TelegramBot(TELEGRAM_TOKEN, {
  polling: true,
});

const chatIdToLatestFileLink = {};

async function processImage(chatId, fileId) {
  const fileLink = await bot.getFileLink(fileId);
  // sendMessageToTelegram(
  // chatId,
  // `File Uploaded Successfully, started processing... ${fileLink}`
  // );
  chatIdToLatestFileLink[chatId] = fileLink;
  sendMessageToTelegram(chatId, "Please write a prompt");
}

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  console.log(msg);
  if (msg.photo != null) {
    const fileObj = msg.photo[msg.photo.length - 1];
    processImage(chatId, fileObj["file_id"]);
    // sendMessageToTelegram(chatId, "Processing image");
  } else {
    const message = msg.text;
    if (chatIdToLatestFileLink[chatId] != null) {
      sendMessageToTelegram(chatId, "Please wait for 5-10 seconds");
      initReplicate(chatId, chatIdToLatestFileLink[chatId], message);
    } else {
      sendMessageToTelegram(chatId, "Upload an image");
    }
  }
});

async function sendMessageToTelegram(chatId, message) {
  bot.sendMessage(chatId, message);
}

async function initReplicate(chatId, imageUrl, prompt) {
  let startResponse = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Token " + REPLICATE_API_KEY,
    },
    body: JSON.stringify({
      version:
        "854e8727697a057c525cdb45ab037f64ecca770a1769cc52287c2e56472a247b",
      input: {
        image: imageUrl,
        prompt: prompt,
        a_prompt:
          "best quality, extremely detailed, photo from Pinterest, interior, cinematic photo, ultra-detailed, ultra-realistic, award-winning",
        n_prompt:
          "longbody, lowres, bad anatomy, bad hands, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality",
      },
    }),
  });
  let jsonStartResponse = await startResponse.json();

  let endpointUrl = jsonStartResponse.urls.get;

  // GET request to get the status of the image restoration process & return the result when it's ready
  let generatedImage = null;
  while (!generatedImage) {
    // Loop in 1s intervals until the alt text is ready
    let finalResponse = await fetch(endpointUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Token " + REPLICATE_API_KEY,
      },
    });
    let jsonFinalResponse = await finalResponse.json();
    if (jsonFinalResponse.status === "succeeded") {
      generatedImage = jsonFinalResponse.output[1];
    } else if (jsonFinalResponse.status === "failed") {
      break;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  sendMessageToTelegram(chatId, generatedImage);
}
