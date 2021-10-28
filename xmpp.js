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


const { client, xml } = require("@xmpp/client");
const setupVcard = require("./vcard");
const debug = require("@xmpp/debug");
const setupRoster = require("@xmpp-plugins/roster");

const events = require('events');
const logger = require('pino')()


const eventEmitter = new events.EventEmitter();


// Insecure!
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var STATUS = {
    AWAY: "away",
    DND: "dnd",
    XA: "xa",
    ONLINE: "online",
    OFFLINE: "offline"
};

class NvcsXmppClient {

    // publicField


    // privateField
    #xmpp;
    #service;
    #username;
    #password;

    contacts = {};

    constructor(service, username, password) {

        this.#service = "xmpps://xmpp.jp:5223";
        this.#username = "a.osaimi";
        this.#password = "Xmp@1598753";

        this.xmpp = client({
            service: this.#service,
            username: this.#username,
            password: this.#password,
            resource: 'nvcsClient',
        });

        this.roster = setupRoster(this.xmpp);
        //Assign the event handler to an event:

        eventEmitter.on('joinRoom', function () {
            logger.info('*******joinCallEventHandler********');
        });

        this.xmpp.on("online", async (address) => {

            this.currentUser = address;
            logger.info(`online as ${address.toString()}`);

            // Makes itself available
            await this.xmpp.send(xml("presence"));
        });

        // this.xmpp.on("error", (err) => {
        //     logger.debug("error accoured !");
        //     logger.error(err);
        // });

        this.xmpp.on("offline", () => {
            logger.info("offline");
        });

        this.xmpp.on("stanza", async (stanza) => {
            logger.debug("==============stanza=============");

            // if (stanza == null || stanza === undefined) {
            //     logger.debug("==============undefined stanza=============");
            //     return;
            // }

            if (stanza.is("message")) {
                this.messageHandle(stanza);
            }
            else if (stanza.is("presence")) {
                this.presenceHandel(stanza);
            }
            // else if (stanza.is("iq")) {
            //     this.iqHandel(stanza);
            // }
            // else {
            //     logger.warn("unknown stanza:" + stanza.toString());
            // }

        });

    }

    async iqHandel(stanza) {

        logger.warn(`received iq from ${stanza.attrs.from}`);

        logger.trace(stanza.toString(), "iqHandel");

        // switch (stanza.attrs.type) {
        //     case "subscribe":
        //         this.acceptSubscription(stanza.attrs.from);
        //         break;
        //     case "unsubscribe":
        //         this.acceptUnsubscription(stanza.attrs.from);
        //         break;
        //     case "subscribed":
        //         this.acceptSubscription(stanza.attrs.from);
        //         break;
        //     case "unsubscribed":
        //         this.acceptUnsubscription(stanza.attrs.from);
        //         break;
        //     default:

        //         break;
        // }

    }

    async presenceHandel(stanza) {

        try {

            logger.trace(stanza.toString(), "presenceHandel");

            if (stanza.attrs.type == null) {
                logger.warn("stanza.attrs.type == null");
                return;
            }

            switch (stanza.attrs.type) {
                case "subscribe":
                    this.acceptSubscription(stanza.attrs.from);
                    break;
                case "unsubscribe":
                    this.acceptUnsubscription(stanza.attrs.from);
                    break;
                case "subscribed":
                    this.acceptSubscription(stanza.attrs.from);
                    break;
                case "unsubscribed":
                    this.acceptUnsubscription(stanza.attrs.from);
                    break;
                default:
                    logger.warn("unkown stanza.attrs.type");
                    break;
            }

            // this.getRoster();
            // logger.trace(this.connect);
        } catch (error) {
            logger.error(error);
        }

    }

    async messageHandle(stanza) {

        logger.warn("message:" + stanza.toString());

        if (!stanza.getChild("body")) {
            logger.warn("body is empity");
            return;
        }

        const messageText = stanza.getChild("body").text();
        const { from } = stanza.attrs;

        switch (messageText) {
            case "ping":
                await this.sendMessage(from, "ping");
                break;
            case "joinRoom":
                await eventEmitter.emit('joinRoom');
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
        if (trace)
            logger.level = "trace"
    }

    /**
     * none:
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
    async getRosterL(subscription) {

        logger.debug("++++++ Start getRosterL ++++++");

        const req = xml('query', 'jabber:iq:roster');

        logger.debug(req.toString());

        const res = await this.xmpp.iqCaller.get(req);

        if (subscription) {

            this.contacts = res.getChildren('item').filter(child =>
                child.attrs.subscription == "both").map(child => child.attrs.jid);
        }
        else {
            this.contacts = await (res.getChildren('item').map(child => child.attrs.jid));
        }

        logger.info("++++++ End getRosterL ++++++");
        return this.contacts;
    }

    async getRoster(subscription) {

        logger.debug("++++++ Start getRoster ++++++");

        try {

            const { version, items } = await this.roster.get();
            logger.debug(`Current roster version is ${version}`);


            if (subscription) {
                this.contacts = items.filter(child =>
                    child.attrs.subscription == subscription);//.map(child => child.attrs.jid);
            }
            else {
                this.contacts = items;//.map(child => child.attrs.jid);
            }

        } catch (error) {
            logger.error(error);
        }
        logger.debug("++++++ End getRoster ++++++");
        return this.contacts;
    }

    getVCard(jid) {
        logger.info(`****** getVCard for ${jid}`)
        this.sendStanza(xml(
            "iq",
            { from: this.currentUser, to: jid, type: "get", id: "v3" }, xml("vCard", { xmlns: 'vcard-temp' }, null)));
        logger.info(`****** getVCard for ${jid}`)
    }

    async getRosterPresence(JID) {

        logger.debug("getRoster start " + JID);

        try {
            const message = xml(
                "presence",
                { to: JID, type: "probe", xmlns: "jabber:client" },
            );

            const r = await this.sendStanza(message);
            logger.warn(r);
            if (r)
                logger.info(`${JID} is online`);
            else
                logger.info(`${JID} is offline`);
        } catch (error) {
            logger.error(error)
        }
    }

    // Sends a santaza
    async sendStanza(stanza) {

        logger.debug(`sending stanza to ${stanza.toString()}`);

        try {
            await this.xmpp.send(stanza);
        }
        catch (error) {
            console.log("**********" + error)
        }

    }

    // Sends a chat message  
    async sendMessage(to, body) {

        logger.debug(`sending message to ${to} : ${body}`);

        const msg = xml(
            "message",
            { type: "chat", to: to },
            xml("body", {}, body),
        );
        await this.xmpp.send(msg);

    }

    async sendMessageMany(recipients, body) {

        const stanzas = recipients.map((address) =>
            xml("message", { to: address, type: "chat" }, xml("body", null, body)),
        );

        await xmpp.sendMany(stanzas).catch(console.error);
    }


    async subscribe(jid) {

        try {

            const stanza = xml(
                "presence"
            );

            logger.debug("send subscribe request to " + jid);

            await this.sendStanza(stanza);
        } catch (error) {
            console.log("**********" + error)
        }
    }


    async unsubscribe(jid) {

        const stanza = xml(
            "presence",
            { to: jid, type: "unsubscribe" }
        );

        logger.debug({ presence: stanza.toString() }, "send unsubscribe request to " + jid);

        await this.sendStanza(stanza);
    }

    async acceptSubscription(jid) {

        const stanza = xml(
            "presence",
            { to: jid, type: "subscribed" }
        );

        logger.debug({ presence: stanza }, "accept Subscription request from " + jid);

        this.sendStanza(stanza);
    }

    async acceptUnsubscription(jid) {
        const stanza = xml(
            "presence",
            { to: jid, type: "unsubscribed" }
        );

        logger.debug({ presence: stanza.toString() }, "accept Unsubscription request from " + jid);
        this.sendStanza(stanza);
    }

    async connect() {
        await this.xmpp.start().catch(console.error);
    }

}


module.exports = NvcsXmppClient;