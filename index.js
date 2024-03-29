'use strict';

const { client, eventList } = require('./xmpp');

const logger = require('pino')({
	transport: {
		target: 'pino-pretty',
		options: {
			colorize: true,
		},
	},
});

//// Setup
// connect to xmpp server {url, username, pass}
const a = new client('xmpps://xmpp.jp:5223', 'a.osaimi', 'Xmp@1598753');

// control logs display
a.activeDebug(false, false);

//// Contacts
// To add user use subscribe
a.subscribe('ah.osaimi@xmpp.jp');

// To delete user use unsubscribe
a.unsubscribe('ah.osaimi@xmpp.jp');

// To get contact Card
a.getVCard('ah.osaimi@xmpp.jp');

// Sends a chat type message
a.sendMessage('ah.osaimi@xmpp.jp', 'Hello');

// Block a contact
a.blockContact('ah.osaimi@xmpp.jp');

// unblock a constact
a.unBlockContact('ah.osaimi@xmpp.jp');

//// Events
// You can add event handler using addEventListener
a.addEventListener(eventList.CONTACT_STATUS_CHANGED, (contact) => {
	console.log('contacts');
	console.log(contact);
});

// or pass callback function
function joinCallEventHandler(room) {
	logger.info({ room }, 'joinCallEventHandler from client');
}
a.addEventListener(eventList.CONTACT_STATUS_CHANGED, joinCallEventHandler);

//// Send Invitations
const para = {
	url: 'http://google.com',
	password: '1234',
};

// send invite from user to itself with para object,
// Note: sendVideoCallInvite it will add datetime automatically
a.sendVideoCallInvite(a.currentUser, para);

a.connect();
