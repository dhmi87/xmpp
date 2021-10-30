/**
 * Copyright (c) 2020-2021, NVCS Development Team
 *
 * @functions:
 * Get contacts (roster)
 * Send message to (one or many) contact
 * Event handel
 *
 * TODO:
 * Get resort and status
 * Send & receive invitations
 * events handling
 *
 * Change Logs:
 * Date           Author                    Notes
 * 2021-10-15     Abdulrahman Alosaimi      the first version
 */

const { client, xml } = require('@xmpp/client');
const debug = require('@xmpp/debug');

const events = require('events');
const logger = require('pino')();

const eventEmitter = new events.EventEmitter();

// Insecure!
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var STATUS = {
	AWAY: 'away',
	DND: 'dnd',
	XA: 'xa',
	ONLINE: 'online',
	OFFLINE: 'offline',
};

function parseItem(item) {
	return Object.assign({}, item.attrs, {
		groups: item.getChildren('group').map((group) => group.text()),
		approved: item.attrs.approved === 'true',
		ask: item.attrs.ask === 'subscribe',
		name: item.attrs.name || '',
		subscription: item.attrs.subscription || 'none',
		jid: item.attrs.jid || '',
	});
}

class NvcsXmppClient {
	// publicField
	eventList = {
		VOICECALL: 'VOICECALL',
		VIDEOCALL: 'VIDEOCALL',
		KEYEXCHANGE: 'KEYEXCHANGE',
		PING: 'PING',
		ONLINE: 'online',
		OFFLINE: 'offline',
	};
	// privateField

	#service;
	#username;
	#password;

	contacts = {};

	constructor(service, username, password) {
		this.#service = 'xmpps://xmpp.jp:5223';
		this.#username = 'a.osaimi';
		this.#password = 'Xmp@1598753';

		this.xmpp = client({
			service: this.#service,
			username: this.#username,
			password: this.#password,
			resource: 'nvcsClient',
		});

		this.xmpp.on('online', async (address) => {
			this.currentUser = address;
			logger.info(`online as ${address.toString()}`);

			// Makes itself available
			await this.xmpp.send(xml('presence'));
		});

		this.xmpp.on('error', (err) => {
			logger.debug('error accoured !');
			logger.error(err);
		});

		this.xmpp.on('offline', () => {
			this.offline();
		});

		this.xmpp.on('stanza', async (stanza) => {
			if (stanza == null || stanza === undefined) {
				logger.error('==============undefined stanza=============');
				return;
			}

			if (stanza.is('message')) {
				this.messageHandle(stanza);
			} else if (stanza.is('presence')) {
				this.presenceHandel(stanza);
			} else if (stanza.is('iq')) {
				this.iqHandel(stanza);
			}
			// else {
			//     logger.warn("unknown stanza:" + stanza.toString());
			// }
		});
	}

	async iqHandel(stanza) {
		logger.warn(`received iq from ${stanza.attrs.from}`);

		logger.trace(stanza.toString());
	}

	/**
	 *  The 'type' attribute of a presence stanza is OPTIONAL , the 'type' attribute MUST have one of the following values:
	 *  probe -- A request for an entity's current presence; SHOULD be generated only by a server on behalf of a user.
	 *  error -- An error has occurred regarding processing or delivery of a previously-sent presence stanza.
	 * @param {stanza} stanza
	 * @returns
	 */
	async presenceHandel(stanza) {
		if (stanza.attrs.type == null) {
			logger.trace(stanza.toString());
			return;
		}

		switch (stanza.attrs.type) {
			case 'subscribe':
				logger.info(
					"subscribe -- The sender wishes to subscribe to the recipient's presence.",
				);
				this.acceptSubscription(stanza.attrs.from);
				break;
			case 'unsubscribe':
				logger.info(
					"unsubscribe -- The sender is unsubscribing from another entity's presence.",
				);
				this.cancelSubscription(stanza.attrs.from);
				break;
			case 'subscribed':
				logger.info(
					'subscribed -- The sender has allowed the recipient to receive their presence.',
				);
				break;
			case 'unsubscribed':
				logger.info(
					'unsubscribed -- The subscription request has been denied or a previously-granted subscription has been cancelled.',
				);
				this.cancelSubscription(stanza.attrs.from);
				break;
			case 'unavailable':
				logger.info(
					'unavailable -- Signals that the entity is no longer available for communication.',
				);
				break;
			default:
				logger.warn('unkown stanza.attrs.type' + stanza.attrs.type);
				break;
		}
	}

	async messageHandle(stanza) {
		if (!stanza.getChild('body')) {
			logger.warn('body is empity');
			logger.warn(stanza.toString());
			return;
		}

		const messageText = stanza.getChild('body').text();
		const { from } = stanza.attrs;

		switch (messageText) {
			case this.eventList.PING:
				await this.sendMessage(from, 'ping');
				break;
			case this.eventList.VIDEOCALL:
				await eventEmitter.emit(this.eventList.VIDEOCALL);
				break;
			case this.eventList.VOICECALL:
				await eventEmitter.emit(this.eventList.VOICECALL);
				break;
			case this.eventList.KEYEXCHANGE:
				await eventEmitter.emit(this.eventList.KEYEXCHANGE);
				break;
			default:
				logger.info(`received message "${messageText}" from "${from}"`);
				break;
		}
	}

	addEventListener(eventName, callback) {
		eventEmitter.on(eventName, callback);
	}

	activeDebug(xmppDebug, trace) {
		debug(this.xmpp, xmppDebug);
		if (trace) logger.level = 'trace';
	}

	/**
	 *  none:
	 *  the user does not have a subscription to the contact's presence, and the contact does not have a subscription to the user's presence; this is the default value, so if the subscription attribute is not included then the state is to be understood as "none"
	 *  to:
	 *  the user has a subscription to the contact's presence, but the contact does not have a subscription to the user's presence
	 *  from:
	 *  the contact has a subscription to the user's presence, but the user does not have a subscription to the contact's presence
	 *  both:
	 *  the user and the contact have subscriptions to each other's presence (also called a "mutual subscription")
	 * @param {*} subscription
	 * @returns
	 */
	async getRoster(subscription) {
		const req = xml('query', 'jabber:iq:roster');

		logger.debug(req.toString());

		const res = await this.xmpp.iqCaller.get(req);

		logger.debug(res.toString());

		if (subscription) {
			this.contacts = res
				.getChildren('item')
				.filter((child) => child.attrs.subscription == 'both');
		} else {
			this.contacts = res.getChildren('item');
		}

		this.contacts = this.contacts.map((x) => parseItem(x));
		return true;
	}

	getVCard(jid) {
		logger.info(`****** getVCard for ${jid}`);
		this.sendStanza(
			xml(
				'iq',
				{ from: this.currentUser, to: jid, type: 'get', id: 'v3' },
				xml('vCard', { xmlns: 'vcard-temp' }, null),
			),
		);
		logger.info(`****** getVCard for ${jid}`);
	}

	/**
	 * Remove an item from the roster.
	 *
	 * @param {string} jid Jabber id for item to remove from the roster
	 * @returns {Promise<void>} Completion promise
	 */
	async removeItem(jid) {
		if (!this.isInRoster(jid)) {
			logger.error(`The JID ${jid} isn't in contats`);
			return false;
		}

		const req = xml(
			'query',
			{ xmlns: 'jabber:iq:roster' },
			xml('item', { jid, subscription: 'remove' }),
		);

		logger.debug(req.toString());

		const res = await this.xmpp.iqCaller.set(req);

		if (res) {
			logger.info(`The ${jid} was removed`);
			this.getRoster();
			return res;
		}

		return false;
	}

	async getRosterPresence(JID) {
		logger.debug('getRoster start ' + JID);

		try {
			const message = xml('presence', {
				to: JID,
				type: 'probe',
				xmlns: 'jabber:client',
			});

			const r = await this.sendStanza(message);
			logger.warn(r);
			if (r) logger.info(`${JID} is online`);
			else logger.info(`${JID} is offline`);
		} catch (error) {
			logger.error(error);
		}
	}

	// Sends a santaza
	async sendStanza(stanza) {
		logger.debug(`sending stanza to ${stanza.toString()}`);

		try {
			await this.xmpp.send(stanza);
		} catch (error) {
			console.log('**********' + error);
		}
	}

	// Sends a chat message
	async sendMessage(to, body) {
		logger.debug(`sending message to ${to} : ${body}`);

		const msg = xml('message', { type: 'chat', to: to }, xml('body', {}, body));
		await this.xmpp.send(msg);
	}

	async sendMessageMany(recipients, body) {
		const stanzas = recipients.map((address) =>
			xml('message', { to: address, type: 'chat' }, xml('body', null, body)),
		);

		await xmpp.sendMany(stanzas).catch(console.error);
	}

	isInRoster(jid) {
		for (const element of this.contacts) {
			if (element.jid == jid) {
				console.log(element.jid + '==' + jid);
				return true;
			}
		}
		return false;
	}

	/**
	 *  Unavailable Presence
	 * become unavailable by sending "unavailable presence"
	 * @param {jid} jid
	 */
	async offline() {
		logger.debug('send unavailable request');
		const stanza = xml('presence', { type: 'unavailable' });

		return await this.sendStanza(stanza);
	}

	/**
	 * Requesting a Subscription
	 * A request to subscribe to another entity's presence is made by sending a presence stanza of type "subscribe".
	 * @param {jid} jid
	 */
	async subscribe(jid) {
		if (this.isInRoster(jid)) {
			logger.error(`The JID ${jid} is already exsit in contats`);
			return false;
		}

		logger.debug('send subscribe request to ' + jid);
		const stanza = xml('presence', { to: jid, type: 'subscribe' });

		//return await this.sendStanza(stanza);
	}

	/**
	 * Unsubscribing from Another Entity's Presence:
	 * If a user would like to unsubscribe from the presence of another entity,
	 * it sends a presence stanza of type "unsubscribe".
	 * @param {jid} jid
	 */
	async unsubscribe(jid) {
		if (!this.isInRoster(jid)) {
			logger.error(`The JID ${jid} isn't in contats`);
			return false;
		}
		const stanza = xml('presence', { to: jid, type: 'unsubscribe' });
		logger.debug('send unsubscribe request to ' + jid);

		await this.sendStanza(stanza);
	}

	/**
	 *  Approving a subscription request
	 *  approve the request by sending a presence stanza of type "subscribed"
	 *  @param {jid} jid
	 */
	async acceptSubscription(jid) {
		const stanza = xml('presence', { to: jid, type: 'subscribed' });

		logger.debug('accept Subscription request from ' + jid);

		console.log('[[[' + jid + ']]]');
		await this.sendStanza(stanza);
	}

	/**
	 * Refusing a presence subscription request:
	 * refuse the request by sending a presence stanza of type "unsubscribed".
	 * @param {jid} jid
	 */
	async rejectSubscription(jid) {
		const stanza = xml('presence', { to: jid, type: 'unsubscribed' });

		logger.debug(
			{ presence: stanza.toString() },
			'reject subscription request from ' + jid,
		);
		await this.sendStanza(stanza);
	}

	/**
	 * Cancelling a Subscription from Another Entity:
	 * If a user would like to cancel a previously-granted subscription request,
	 * it sends a presence stanza of type "unsubscribed".
	 * @param {jid} jid
	 */
	async cancelSubscription(jid) {
		const stanza = xml('presence', { to: jid, type: 'unsubscribed' });

		logger.debug('cancel subscription from ' + jid);
		await this.sendStanza(stanza);
	}

	async connect() {
		await this.xmpp.start().catch(console.error);
	}
}

module.exports = NvcsXmppClient;
