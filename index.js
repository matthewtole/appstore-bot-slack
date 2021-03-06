'use strict';

require('dotenv').load();
var Slack = require('slack-client');
var _ = require('lodash');
var Algolia = require('algoliasearch');
var superagent = require('superagent');
var fs = require('fs');
var path = require('path');

var algoliaClient = Algolia(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_API_KEY);
var appstoreSearch = algoliaClient.initIndex(process.env.ALGOLIA_INDEX);

var token = process.env.SLACK_API_TOKEN;
var autoReconnect = true;
var autoMark = true;

var slack = new Slack(token, autoReconnect, autoMark);

slack.on('message', function(message) {
  var channel = slack.getChannelGroupOrDMByID(message.channel);
  if (isMessageForMe(message)) {
    var request = getRequest(message);
    switch (request.type) {
      case 'appstore.url':
      case 'appstore.hearts':
        doAppstoreRequest(request, channel);
        break;
      case 'docs':
        doDocsRequest(request, channel);
        break;
      default:
        console.log('Could not handle: ' + message);
    // TODO: What should we do here?
    }
  } else {
    if ((' ' + message.text + ' ').match(/\W?(sloths?)\W?/)) {
      if (message.user !== slack.self.id) {
        getSlothFact(function(err, fact) {
          if (err) {
            return console.log(err);
          }
          channel.send('Did someone mention sloths?' +
            'Here\'s a random fact stolen from SlothFactsBot on Reddit!\n\n' +
            fact);
        });
      }
    }
  }
});

slack.on('error', function(err) {
  console.log(err);
});

function isMessageForMe(message) {
  return (message.text && message.text.substr(0, 14) === `<@${slack.self.id}>: `);
}

function getRequest(message) {
  var messageText = message.text.substr(14);
  if (messageText.substr(0, 8) === ':heart: ' ||
      messageText.substr(0, 9) === ':hearts: ') {
    return {
      type: 'appstore.hearts',
      data: messageText.substr(messageText.indexOf(': ') + 2)
    };
  }
  if (messageText.substr(0, 7) === ':book: ') {
    return {
      type: 'docs',
      data: messageText.substr(7)
    };
  }
  return {
    type: 'appstore.url',
    data: messageText
  };
}

function doAppstoreRequest(request, channel) {
  var appName = request.data;
  var hardware;
  if ((hardware = appName.match(/\[(aplite|basalt|chalk)\]/))) {
    appName = appName.replace(hardware[0], '');
    hardware = hardware[1];
  }
  appstoreSearch.search(appName, function searchDone(err, content) {
    if (err) {
      return console.log(err);
    }
    if (!content.hits.length) {
      return channel.send('Could not find an app with that name. Sorry! :sob:');
    }
    var app = content.hits[0];
    var assetCollection = _.findWhere(app.asset_collections, {
      hardware_platform: hardware
    });
    if (!assetCollection) {
      assetCollection = app.asset_collections[0];
    }
    switch (request.type) {
      case 'appstore.url':
        let link = `https://apps.getpebble.com/en_US/applications/${app.id}`;
        if (hardware) {
          link += `?hardware=${hardware}`;
        }
        channel.postMessage({
          as_user: true,
          attachments: [
            {
              fallback: app.title + ' v' + app.version,
              title: app.title + ' v' + app.version,
              title_link: link,
              fields: [
                {
                  title: 'Hearts',
                  value: app.hearts,
                  short: true
                },
                {
                  title: 'Installs',
                  value: app.installs,
                  short: true
                },
                {
                  title: 'Description',
                  value: assetCollection.description
                }
              ],
              image_url: assetCollection.screenshots[0],
              author_name: app.author
            }
          ]
        });
        break;
      case 'appstore.hearts':
        channel.send(app.title + ' currently has ' + app.hearts + ' :heart:');
        break;
    }
  });
}

function doDocsRequest(request, channel) {
  let symbolsUrl = 'https://developer.getpebble.com/docs/symbols.json';
  superagent.get(symbolsUrl).end(function(err, res) {
    if (err) {
      return console.log(err);
    }
    if (!res.body || !res.body.length) {
      return console.log(err);
    }
    var symbol = _.findWhere(res.body, {
      name: request.data
    });
    channel.send(symbol.summary);
  });
}

function getSlothFact(callback) {
  fs.readFile(path.join(__dirname, 'sloths.txt'), function(err, data) {
    if (err) {
      return callback(err);
    }
    var lines = data.toString().split('\n');
    var fact = lines[Math.floor(Math.random() * lines.length)];
    return callback(null, fact);
  });
}

slack.login();
