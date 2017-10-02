const emoji = require('node-emoji');

function greet(sessionId, context, cb) {
  var greetings = [ "Hello! I'm Cuprum. ",
                    "Hi! I'm Cuprum. ",
                    "Hey, my name is Cuprum! " 
                  ];
  context.greeting = greetings[Math.floor(Math.random() * greetings.length)];

  var connectors = [ "I can do many things. ",
                    "Let me show you what I can do. ",
                    "Let's try something. "
                  ];
  context.connector = connectors[Math.floor(Math.random() * connectors.length)];

  var suggestions = [ "Send me a photo!",
                      "Tell me what you want for lunch!",
                      "Tell me what is your favorite animal!"
                    ];
  context.suggestion = suggestions[Math.floor(Math.random() * suggestions.length)];

  cb(context);
}

function favoriteAnimal(sessionId, context, cb) {
  var animal = context.animal;
  var e = emoji.get(animal);
  context.emoji = e;
  cb(context);
}

function removeGreeting(sessionId, context, cb) {
  delete context.greeting;
  delete context.connector;
  delete context.suggestion;
  cb(context);
}

function removeFood(sessionId, context, cb) {
  delete context.food;
  delete context.place;
  delete context.address;
  cb(context);
}

function removeEmoji(sessionId, context, cb) {
  delete context.animal;
  delete context.emoji;
  cb(context);
}

module.exports = {
  greet : greet,
  removeGreeting : removeGreeting,
  removeFood : removeFood,
  favoriteAnimal : favoriteAnimal,
  removeEmoji : removeEmoji,
}