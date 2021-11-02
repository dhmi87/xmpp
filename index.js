/* eslint-disable node/no-extraneous-require */

'use strict';

const xmpp = require('./xmpp');
const logger = require('pino')();

const a = new xmpp('xmpps://xmpp.jp:5223', 'a.osaimi', 'Xmp@1598753');

a.activeDebug(false, true);

function printContact(contact) {
	console.log('contacts');
	console.log(contact);
	//a.unBlockContact('ah.osaimi@xmpp.jp');
}

async function doconn() {
	try {
		const joinCallEventHandler = (room) => {
			logger.info('joinCallEventHandler from client');
			logger.info(room);
		};

		a.addEventListener(a.eventList.VIDEOCALL, joinCallEventHandler);
		a.addEventListener(a.eventList.CONTACT_STATUS_CHANGED, printContact);
		await a.connect();

		await a.removeContact('a@a.a');
	} catch (error) {
		console.log(error);
	}
}

doconn();
