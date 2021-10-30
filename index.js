/* eslint-disable node/no-extraneous-require */

'use strict';

const xmpp = require('./xmpp');
const logger = require('pino')();

const a = new xmpp('xmpps://xmpp.jp:5223', 'a.osaimi', 'Xmp@1598753');

a.activeDebug(false, true);

function print(contacts) {
	contacts.forEach((element) => {
		switch (element.subscription) {
			case 'both':
				logger.info(`[frind] ${element.jid}`);
				break;
			case 'from':
				logger.info(`[from] ${element.jid}`);
				break;
			case 'to':
				logger.info(`[to] ${element.jid}`);
				break;
			case 'none':
				logger.warn(`[none] ${element.jid}`);
				break;
			default:
				logger.info(`[unkown] ${element.jid}`);
				break;
		}
	});
}

async function doconn() {
	try {
		const joinCallEventHandler = () => {
			logger.info('joinCallEventHandler from client');
		};

		a.addEventListener(a.eventList.VIDEOCALL, joinCallEventHandler);
		await a.connect();
		await a.getRoster();
		console.log(a.contacts);
	} catch (error) {
		console.log(error);
	}
}

doconn();
