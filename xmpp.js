/**
 * Copyright (c) 2020-2021, NVCS Development Team
 *
 * @functions:
 * Get contacts (roster)
 * Send message to (one or many) contact
 * Event handel
 *
 * TODO:
 * Send & receive invitations
 * Retrieves Block List & update contact list
 * enchance iq request with iqCaller promise
 *
 * Change Logs:
 * Date           Author                    Notes
 * 2021-10-15     Abdulrahman Alosaimi      the first version
 * 2021-10-20     Abdulrahman Alosaimi      implements rotser
 * 2021-10-25     Abdulrahman Alosaimi      add events handler
 * 2021-10-25     Abdulrahman Alosaimi      add events handler
 * 2021-11-2      Abdulrahman Alosaimi      blocking/unblockin contact
 */

const events = require('events');
const { client, xml } = require('@xmpp/client');
const jid = require('@xmpp/jid');
const debug = require('@xmpp/debug');
const pino = require('pino');
const logger = pino({
	transport: {
		target: 'pino-pretty',
		options: {
			colorize: true,
		},
	},
});

const eventEmitter = new events.EventEmitter();

var STATUS = {
	AWAY: 'away',
	DND: 'busy',
	XA: 'away for long',
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
		show: '',
		status: '',
		available: STATUS.OFFLINE,
	});
}

function parseVcard({ children }) {
	return children.reduce((dict, c) => {
		dict[c.name] =
			c.children && typeof c.children[0] === 'string'
				? c.text()
				: parseVcard(c);
		return dict;
	}, {});
}

function bareJID(jid) {
	return jid.split('/')[0];
}

class NvcsXmppClient {
	// publicField
	eventList = {
		CONTACT_STATUS_CHANGED: 'CONTACT_STATUS_CHANGED',
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

	contacts = [];

	constructor(service, username, password) {
		this.#service = 'xmpps://xmpp.jp:5223';
		this.#username = 'a.osaimi';
		this.#password = 'Xmp@1598753';

		this.xmpp = client({
			service: this.#service,
			username: this.#username,
			password: this.#password,
			resource: 'nvcsClientOffice',
		});

		this.xmpp.on('online', async (address) => {
			this.currentUser = address.toString();
			logger.info(`online as ${address.toString()}`);

			await this.getRoster();
			// Makes itself available
			await this.xmpp.send(xml('presence'));
		});

		this.xmpp.on('error', (err) => {
			//TODO: "message": "conflict - Replaced by new connection",
			logger.debug('error accoured !');
			//	logger.error(err.message);
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
			} else {
				logger.warn('unknown stanza:' + stanza.toString());
			}
		});
	}

	async iqHandel(stanza) {
		logger.warn(`received iq from ${stanza.attrs.from}`);

		logger.trace(stanza.toString());
	}

	/**
	 *  The 'type' attribute of a presence stanza is OPTIONAL
	 * @param {stanza} stanza
	 * @returns
	 */
	async presenceHandel(stanza) {
		if (stanza.attrs.to == this.currentUser) logger.debug('<==== incoming');
		else logger.debug('====> outgoing');

		switch (stanza.attrs.type) {
			case 'subscribe':
				logger.info(
					'subscribe -- The ' +
						stanza.attrs.from +
						" wishes to subscribe to the recipient's presence.",
				);
				this.acceptSubscription(stanza.attrs.from);
				this.subscribe(stanza.attrs.from);
				break;
			case 'unsubscribe':
				logger.info(
					'unsubscribe -- The ' +
						stanza.attrs.from +
						" is unsubscribing from another entity's presence.",
				);
				this.cancelSubscription(stanza.attrs.from);
				break;
			case 'subscribed':
				logger.info(
					'subscribed -- The +stanza.attrs.from+ has allowed the recipient to receive their presence.',
				);
				break;
			case 'unsubscribed':
				logger.info(
					'unsubscribed -- The ' +
						stanza.attrs.from +
						' subscription request has been denied or a previously-granted subscription has been cancelled.',
				);
				this.cancelSubscription(stanza.attrs.from);
				break;
			case 'unavailable':
				logger.info(
					'unavailable -- The ' +
						stanza.attrs.from +
						' signals that the entity is no longer available for communication.',
				);
				this.setContactAvailability(bareJID(stanza.attrs.from), STATUS.OFFLINE);
				eventEmitter.emit(this.eventList.CONTACT_STATUS_CHANGED, this.contacts);
				break;
			case 'probe':
				logger.info(
					"probe -- A request for an entity's current presence; SHOULD be generated only by a server on behalf of a user.",
				);
				this.cancelSubscription(stanza.attrs.from);
				break;
			case 'error':
				logger.info(
					'error -- An error has occurred regarding processing or delivery of a previously-sent presence stanza.',
				);
				break;
			default:
				// A presence stanza that does not possess a 'type' attribute is used to signal to the server that the sender is online and available for communication
				this.presenceVcardUpdate(stanza);
				break;
		}

		//
	}

	async messageHandle(stanza) {
		const { from } = stanza.attrs;

		if (!stanza.getChild('body')) {
			logger.debug(`[${from}] is change chat state`);
			// logger.warn(stanza.toString());
			/** TODO: Dealing with Chat State Notifications XEP-0085
			 *  Chat states describe your involvement with a conversation, which can be one of the following:
			 *	Starting
			 *	Someone started a conversation, but you haven’t joined in yet.
			 *
			 *	Active
			 *	You are actively involved in the conversation. You’re currently not composing any message, but you are paying close attention.
			 *
			 *	Composing
			 *	You are actively composing a message.
			 *
			 *	Paused
			 *	You started composing a message, but stopped composing for some reason.
			 *
			 *	Inactive
			 *	You haven’t contributed to the conversation for some period of time.
			 *
			 *	Gone
			 *	Your involvement with the conversation has effectively ended (e.g., you have closed the chat window).
			 */
			return;
		}

		const messageText = stanza.getChild('body').text();

		switch (messageText) {
			case this.eventList.PING:
				await this.sendMessage(from, 'ping');
				break;
			case this.eventList.VIDEOCALL:
				eventEmitter.emit(this.eventList.VIDEOCALL, messageText);
				break;
			case this.eventList.VOICECALL:
				eventEmitter.emit(this.eventList.VOICECALL);
				break;
			case this.eventList.KEYEXCHANGE:
				eventEmitter.emit(this.eventList.KEYEXCHANGE);
				break;
			default:
				logger.info(`[${from}]: "${messageText}"`);
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

	findUserInContacts(jid) {
		for (const c of this.contacts) {
			if (c.jid == jid) return c;
		}
		return null;
	}

	/**
	 *  none:
	 *  the user does not have a subscription to the contact's presence, and the contact does not have a subscription to the user's presence; this is the default value, so if the subscription attribute is not included then the state is to be understood as "none"
	 *  to:
	 *  the user has a subscription to the contact's presence,
	 *  but the contact does not have a subscription to the user's presence
	 *  from:
	 *  the contact has a subscription to the user's presence, but the user does not have a subscription to the contact's presence
	 *  both:
	 *  the user and the contact have subscriptions to each other's presence (also called a "mutual subscription")
	 * @param {both| to | from | none} subscription
	 * @returns
	 */
	async getRoster(subscription) {
		logger.info('Getting contatc list ...');
		const req = xml('query', 'jabber:iq:roster');

		const res = await this.xmpp.iqCaller.get(req);

		if (subscription) {
			this.contacts = res
				.getChildren('item')
				.filter((child) => child.attrs.subscription == 'both');
		} else {
			this.contacts = res.getChildren('item');
		}

		logger.info('Update contatc list ...');
		this.contacts = this.contacts.map((x) => parseItem(x));

		eventEmitter.emit(this.eventList.CONTACT_STATUS_CHANGED, this.contacts);
		return true;
	}

	/**
	 * Blocking jid XEP-0191 .
	 *
	 * @param {string} jid Jabber id for item to block
	 * @returns {Promise<void>} Completion promise
	 * <iq from="you@yourdomain.tld/newjob" id="yu4er81v" to="you@yourdomain.tld" type="set">
	 *  <block xmlns="urn:xmpp:blocking">
	 *   <item jid="user@domain.com"/>
	 *  </block>
	 * </iq>
	 */
	async blockContact(jid) {
		logger.info(`Block ${jid}`);
		if (this.findUserInContacts(jid) == null || jid == '') {
			logger.error(`The JID ${jid} isn't in contats`);
			return false;
		}

		const response = await this.xmpp.iqCaller.request(
			xml(
				'iq',
				{ from: this.currentUser, type: 'set', id: 'block1' },
				xml('block', { xmlns: 'urn:xmpp:blocking' }, xml('item', { jid: jid })),
			),
			30 * 1000, // 30 seconds timeout - default
		);

		logger.info(response.toString());

		if (response) {
			logger.info(`The ${jid} was blocked`);
			return response;
		}
		return false;
	}

	async unBlockContact(jid) {
		logger.info(`unblock ${jid}`);

		if (this.findUserInContacts(jid) == null || jid == '') {
			logger.error(`The JID ${jid} isn't in contats`);
			return false;
		}

		const response = await this.xmpp.iqCaller.request(
			xml(
				'iq',
				{ from: this.currentUser, type: 'set', id: 'block1' },
				xml(
					'unblock',
					{ xmlns: 'urn:xmpp:blocking' },
					xml('item', { jid: jid }),
				),
			),
			30 * 1000, // 30 seconds timeout - default
		);

		logger.info(response.toString());

		if (response) {
			logger.info(`The ${jid} was unblocked`);
			return response;
		}

		return false;
	}

	/**
	 * Remove an item from the roster.
	 *
	 * @param {string} jid Jabber id for item to remove from the roster
	 * @returns {Promise<void>} Completion promise
	 */
	async removeContact(jid) {
		if (this.findUserInContacts(jid) == null || jid == '') {
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

	setContactAvailability(jid, val) {
		let c = this.findUserInContacts(jid);
		if (c != null) {
			c.available = val;
		}
	}

	presenceVcardUpdate(presence) {
		//logger.trace(presence.toString());

		let from = presence.attrs.from.split('/')[0]; // remove resoure value

		if (from == this.currentUser.split('/')[0]) {
			logger.debug('self presence !');
			return;
		}

		for (const c of this.contacts) {
			if (c.jid == from) {
				logger.info(c.jid + ' presence update !');

				this.setContactAvailability(c.jid, STATUS.ONLINE);

				logger.trace(presence.toString());

				if (presence.getChild('show') != null)
					c.show = presence.getChild('show').text();

				if (presence.getChild('status') != null)
					c.status = presence.getChild('status').text();

				eventEmitter.emit(this.eventList.CONTACT_STATUS_CHANGED, this.contacts);
				return;
			}
		}

		logger.error({ contact: this.contacts }, from + ' not found');
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
		logger.info(`sending stanza to ${stanza.toString()}`);

		try {
			await this.xmpp.send(stanza);
		} catch (error) {
			console.log('**********' + error);
		}
	}

	/**
	 * Unavailable Presence
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
		const c = this.findUserInContacts(jid);

		if (c != null && c.subscription == 'both') {
			logger.error(`The JID ${jid} is already exsit in contacts`);
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
		const c = this.findUserInContacts(jid);

		if (c == null) {
			logger.error(`The JID ${jid} isn't in contats to unsubscribe`);
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

	/*********** vCard Section XEP-0054: vcard-temp ***********/

	/**
	 * Retrieving vCard by sending an IQ-get,
	 * @param {jid | null} jid with null user will retrieves his or her own vCard
	 * @returns {IQ-result | error | null}
	 */
	async getVCard(jid) {
		logger.info(`Getting VCard for ${jid} ...`);
		let para = {};
		if (!jid) {
			para = {
				from: this.currentUser,
				type: 'get',
				id: 'v1',
			};
		} else {
			para = {
				to: jid,
				type: 'get',
				id: 'v3',
			};
		}

		const req = xml('iq', para, xml('vCard', { xmlns: 'vcard-temp' }, null));

		await this.sendStanza(req);
	}

	/*********** Message Section  ***********/

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

	async connect() {
		await this.xmpp.start().catch(console.error);
	}
}

module.exports = NvcsXmppClient;
