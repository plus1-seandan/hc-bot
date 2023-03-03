"use strict";
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const request = require("request");
const app = express();
const { Configuration, OpenAIApi } = require("openai");

app.set("port", process.env.PORT || 5000);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Home
app.get("/", function (req, res) {
  res.send("Hello world!");
});
// Start the server
app.listen(app.get("port"), function () {
  console.log("running on port", app.get("port"));
});

// Adds support for GET requests to our webhook
app.get("/webhook", (req, res) => {
  // Your verify token. Should be a random string.
  let VERIFY_TOKEN = process.env.TOKEN;
  console.log(VERIFY_TOKEN);
  // Parse the query params
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
    // Checks the mode and token sent is correct
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      // Responds with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

// Creates the endpoint for our webhook
app.post("/webhook", async (req, res) => {
  let messaging_events = req.body.entry[0].messaging;
  for (let i = 0; i < messaging_events.length; i++) {
    let event = req.body.entry[0].messaging[i];
    let sender = event.sender.id;
    if (event.message && event.message.text) {
      let text = event.message.text;
      if (text === "pr") {
        sendTextMessage(sender, prayer_request);
      } else {
        const response = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: `You are a ${grade} grade teacher.` },
            { role: "user", content: text },
          ],
        });
        console.log({ response });
        sendTextMessage(sender, response.data.choices[0].message.content);
      }
    }
  }
  res.sendStatus(200);
});

function sendTextMessage(sender, text) {
  let messageData = { text: text };
  request(
    {
      url: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: process.env.TOKEN },
      method: "POST",
      json: {
        recipient: { id: sender },
        message: messageData,
      },
    },
    function (error, response, body) {
      if (error) {
        console.log("Error sending messages: ", error);
      } else if (response.body.error) {
        console.log("Error: ", response.body.error);
      }
    }
  );
}

const prayer_request = `Abel Kim: Thankful for meal with siblings, week has been taxing, not sleeping well, issues with clenching teeth at night. Sister's dog staying over; can be loud. PR: for car and sleep situation to get figured out \n
Daniel Kwak: Thankful for meet ups with Sean, Sam; relationship depends on day by day but doing okay. Felt tired, mental health not great, rough week. Feeling shame, hard to talk about things that don't go right, feeling stressed on next steps, uncomfortable to share. PR: to get sleep and inner peace \n
Gabriel Ra: Thankful for better sleep, felt stressed about interviews for internship; not too anxious but not at peace. Really busy and tiring with school. PR: for better sleep, for 2 interviews on Monday.\n
Hana Park: Work has been bad, still feeling lazy but at a better headspace with relationships and accepting where she is. Good reminder from preparing testimony, lots of little joys this week, want to build better habits. PR: to build good habits\n
Maria Kim: X\n
Noah Choe: Thankful for Monday off, hanging out with people. Feeling confused; still not on a project and lowkey anxious but trying to trust, questioning what God has in store. PR: to get on a project, more discipline on devotionals and work life \n
Odelia Kim: to do well on her procedure on patient tomorrow and for her to recover from being sick \n
Sean Dan: Thankful for the ways that God work, feeling healing from mental health, realizing the need for Jesus. Work has been very not busy, spending more time with people, been waking up earlier and gets easier. PR: waking up earlier\n
Tiffany Jeong: Thankful for spending time w people, felt good overall but feeling sad when people count John and i on a different boat relationship wise, PR: to find a dress I love tmrw!!\n
Timothy Cho: X\n
Zach Munder: Thankful for hosting HC this week, haven't heard back from internships yet, very nerve wrecking, not feeling motivated with school. PR: to hear back from internships`;
