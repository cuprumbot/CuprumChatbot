'use strict';
// get the api keys
const CONFIG = require('./config');
// port for subscribing the webhook
const PORT = 8445;
const request = require('request');
const express = require('express');
// foursquare
const foursquare = (require('foursquarevenues'))(CONFIG.FSQ_KEY, CONFIG.FSQ_SECRET);
// language processing
const Wit = require('node-wit').Wit;
const WitActions = require('./WitActions.js');
// json
const bodyParser = require('body-parser');
// computer vision
const vision = require('node-cloud-vision-api');
vision.init({auth: CONFIG.CLOUD_VISION_API_KEY});
// emoji support
const emoji = require('node-emoji');

// start express app
const app = express();
app.set('port', PORT);
app.listen(app.get('port'));
app.use(bodyParser.json());

// fb request
const fbReq = request.defaults({
  uri: 'https://graph.facebook.com/me/messages',
  method: 'POST',
  json: true,
  qs: { access_token: CONFIG.FB_PAGE_TOKEN },
  headers: {'Content-Type': 'application/json'},
});

// fb message
function fbMessage (recipientId, msg, cb) {
  console.log("fbMessage");
  const opts = {
    form: {
      recipient: {
        id: recipientId,
      },
      message: {
        text: msg,
      },
    },
  };
  fbReq(opts, (err, resp, data) => {
    if (cb) {
      cb(err || data.error && data.error.message, data);
    }
  });
};

// incoming messages data
function getFirstMessagingEntry (body) {  
  const val = body.object == 'page' &&
    body.entry &&
    Array.isArray(body.entry) &&
    body.entry.length > 0 &&
    body.entry[0] &&
    body.entry[0].id == CONFIG.FB_PAGE_ID &&
    body.entry[0].messaging &&
    Array.isArray(body.entry[0].messaging) &&
    body.entry[0].messaging.length > 0 &&
    body.entry[0].messaging[0]
  ;
  return val || null;
};

// Wit.ai bot specific code
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

// create a session to know which user the bot should respond
function findOrCreateSession (fbid) {
  let sessionId;
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      sessionId = k;
    }
  });
  if (!sessionId) {
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  return sessionId; 
};

// get a wit.ai entity
function firstEntityValue (entities, entity) {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

// this action shouldn't be moved to WitActions because it uses the variable foursquare
function findPlace(sessionId, context, cb) {
  var params = {
    'near': "Guatemala City, Guatemala",
    'query': context.food
  };
 
  foursquare.getVenues(params, function(error, venues) {
    if (!error) {     
      if (venues['response'] && venues['response']['venues'].length > 0) {
        var place = venues['response']['venues'][0]['name'];
        var address = venues['response']['venues'][0]['location']['address'];

        for (var i = 1; i < venues['response']['venues'].length && address === undefined; i++) {
          if (venues['response']['venues'][i]['location']['address'] !== undefined) {
            place = venues['response']['venues'][i]['name'];
            address = venues['response']['venues'][i]['location']['address'];
            break;
          }
        }

        const suggestions = [ "Why don't you try the ",
                              "How about getting some ",
                              "I suggest eating "
                            ];
        var food = suggestions[Math.floor(Math.random() * suggestions.length)] + context.food;
        context.food = food;
        context.place = place;
        context.address = address;
        cb(context);      
      } else {
        cb();
      }
    } else {
      cb();
    }
  });    
}

const actions = {
  say(sessionId, context, msg, cb) {
    const recipientId = sessions[sessionId].fbid;
    if (recipientId) {
      fbMessage(recipientId, msg, (err, data) => {
        if (err) {
          console.log(
            'Oops! An error occurred while forwarding the response to',
            recipientId,
            ':',
            err
          );
        }
        cb();
      });
    } else {
      console.log('Oops! Couldn\'t find user for session:', sessionId);
      cb();
    }
  },
  merge(sessionId, context, entities, message, cb) {
    const food = firstEntityValue(entities, 'food');
    const animal = firstEntityValue(entities, 'animal');
    if (food) {
      context.food = food;
      console.log("\tfood set to: " + food);
    }
    if (animal) {
      context.animal = animal;
      console.log("\tanimal set to: " + animal);
    }
    cb(context);
  },
  error(sessionId, context, msg) {
    console.log('Oops, I don\'t know what to do.');
  },
  
  greet : WitActions.greet,
  removeGreeting : WitActions.removeGreeting,
  findPlace : findPlace,
  removeFood : WitActions.removeFood,
  favoriteAnimal: WitActions.favoriteAnimal,
  removeEmoji : WitActions.removeEmoji
};

// wit.ai, must be after the actions definition
const wit = new Wit(CONFIG.WIT_TOKEN, actions);

// request type: GET
// used to subscribe the page
app.get('/fb', (req, res) => {
  if (!CONFIG.FB_VERIFY_TOKEN) {
    throw new Error('missing FB_VERIFY_TOKEN');
  }
  //console.log(req.query['hub.mode']);
  //console.log(req.query['hub.verify_token']);
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === CONFIG.FB_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else { 
    res.sendStatus(400);
  }
});

// request type: POST
// used to receive messages
app.post('/fb', (req, res) => {    
  const messaging = getFirstMessagingEntry(req.body);

  if (messaging && messaging.message && messaging.recipient.id == CONFIG.FB_PAGE_ID) {    
    const sender = messaging.sender.id;
    const sessionId = findOrCreateSession(sender);
    const msg = messaging.message.text;
    const atts = messaging.message.attachments;

    console.log("\nGot a new message: " + msg);

    if (atts) {
      const attachment = atts[0]
      if (attachment.type == 'image') {
        console.log("analyzing " + attachment.payload.url);

        const analyzingMsg = "Analyzing your picture...";
        fbMessage(
            sender,
            analyzingMsg
        );
        const req = new vision.Request({
          image: new vision.Image({
            url: attachment.payload.url
          }),
          features: [
            new vision.Feature('LABEL_DETECTION', 10),
          ]
        });

        vision.annotate(req).then((res) => {
          const firsResponse = res.responses[0];
          const labelResponses = firsResponse.labelAnnotations;
          
          var labelsDescriptions = [];

          if (labelResponses) {  
            labelResponses.forEach(function (value) {
              if (labelsDescriptions.indexOf(value.description) === -1) {
                labelsDescriptions.push(value.description);
              }             
          });
          }

          var labels = "Some tags for your picture: " + labelsDescriptions.toString();              
          if (labelsDescriptions.length > 0) {
            if (labels.includes("panda")) labels = "PANDA PANDA PANDA PANDA PANDA :D"
            fbMessage(
              sender,
              labels
            );            
          }

        }, (e) => {
          console.log('Error: ', e)
        })
      }
                  
    } else if (msg) {
      wit.runActions(
        sessionId,
        msg, 
        sessions[sessionId].context, 
        (error, context) => {
          if (error) {
            console.log('Oops! Got an error from Wit:', error);
          } else {
            console.log('Waiting for further messages.');
            sessions[sessionId].context = context;
          }
        }
      );
    }
  }
  res.sendStatus(200);
});

console.log("Ready!");