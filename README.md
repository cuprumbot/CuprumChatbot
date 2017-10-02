# CuprumChatbot
FB Messenger chatbot using Wit.ai

Download and extract ngrok
Run 'ngrok http 8445'

Go to your app page and set up the webhook.
Mine looks like this:
https://developers.facebook.com/apps/1945812245702890/webhooks/

You need a verify token that matches with the chatbot config.
The webhook address must be https and end with '/fb'
You can use the ngrok console at localhost:4040 to check the incoming connections.

Make sure to generate a fresh token when the webhook is changed.
I generate mine at:
https://developers.facebook.com/apps/1945812245702890/messenger/

