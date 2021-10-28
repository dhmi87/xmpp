/* eslint-disable node/no-extraneous-require */

"use strict";

// var xmpp = require('simple-xmpp');

// xmpp.on('online', function (data) {
//     console.log('Connected with JID: ' + data.jid.user);
//     console.log('Yes, I\'m connected!');
// });

// xmpp.on('chat', function (from, message) {
//     xmpp.send(from, 'echo: ' + message);
// });

// xmpp.on('error', function (err) {
//     console.error(err);
// });

// xmpp.on('subscribe', function (from) {
//     console.log(from);
//     // if (from === 'a.friend@gmail.com') {
//     xmpp.acceptSubscription(from);
//     // }
// });

// xmpp.connect({
//     jid: "a.osaimi@xmpp.jp",
//     password: "Xmp@1598753",
//     host: 'xmpp.jp',
//     port: 5222
// });

// // check for incoming subscription requests
// xmpp.getRoster();


const xmpp = require('./xmpp');

const a = new xmpp("xmpps://xmpp.jp:5223", "a.osaimi", "Xmp@1598753");

a.activeDebug(false, true);

async function doconn(params) {
    try {
        await a.connect();
        const res = await a.getRoster();
        console.log(a.contacts);

        await a.subscribe("ah.osaimi@xmpp.jp");
    }
    catch (error) {
        console.log(error);
    }
}

doconn();
