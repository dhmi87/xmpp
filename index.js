/* eslint-disable node/no-extraneous-require */

'use strict';

const xmpp = require('./xmpp');
const logger = require('pino')({
	transport: {
		target: 'pino-pretty',
		options: {
			colorize: true,
		},
	},
});

const a = new xmpp('xmpps://xmpp.jp:5223', 'a.osaimi', 'Xmp@1598753');

a.activeDebug(false, true);
const vRoom = {
	url: 'http://google.com',
	password: '1234',
};

function printContact(contact) {
	console.log('contacts');
	console.log(contact);
	//a.unBlockContact('ah.osaimi@xmpp.jp');
}

async function doconn() {
	try {
		const joinCallEventHandler = (room) => {
			logger.info({ room }, 'joinCallEventHandler from client');
		};

		a.addEventListener(a.eventList.VIDEOCALL, joinCallEventHandler);
		a.addEventListener(a.eventList.CONTACT_STATUS_CHANGED, printContact);
		await a.connect();
		await a.SendInvite(a.currentUser, a.eventList.VIDEOCALL, vRoom);
	} catch (error) {
		console.log(error);
	}
}

doconn();
