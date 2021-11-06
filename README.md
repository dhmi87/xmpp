# XMPP Client

this is an xmpp client for n project thay connects to xmpp server.

## Description

## Getting Started

### Dependencies

- xmpp.js JavaScript library for XMPP.
- pino Node.js logger.

### Installing

- clone the repo:

```
https://github.com/dhmi87/xmpp
```

- install packeges:

```
npm install
```

### Notes

- Subscription automaticllay accepted for both add and delete
- Unsubscribe dosn't remove contact from roster, in order to remove contact from the roster use:

```
removeContact(user@serveer.com)
```

- Invitations using message subject as type of Invitations.

## Example

```
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
a.sendMessage('ah.osaimi@xmpp.jp',"Hello");

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
a.sendVideoCallInvite(a.currentUser , para);


a.connect();

```

## Authors

Contributors names and contact info

- Abdulrahman Alosaimi

## Version History

- 0.1
  - Initial Release

## TODO:

- Retrieves Block List & update contact list
- enchance iq request with iqCaller promise
- Advanced Message Processing XEP-0079 (message expiration, preventing messages from being stored offline)
  \*nse

## Acknowledgments

Inspiration, code snippets, etc.

- [xmpp.org](https://xmpp.org/)
- [xmpp.js](https://github.com/xmppjs/xmpp.js/)
- [pino](https://github.com/pinojs/pino)
