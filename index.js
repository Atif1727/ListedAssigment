const {google} = require('googleapis');
const {OAuth2Client} = require('google-auth-library');

// Set up OAuth2 client with your credentials
const credentials = require('./credentials.json');
const {client_secret, client_id, redirect_uris} = credentials.web;
const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

// Set up a readline interface to prompt the user to authorize the app
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.compose'],
});
console.log('Authorize this app by visiting this url:', authUrl);
rl.question('Enter the code from that page here: ', (code) => {
  rl.close();
  oAuth2Client.getToken(code, (err, token) => {
    if (err) return console.error('Error retrieving access token', err);
    oAuth2Client.setCredentials(token);
    console.log('Access token:', token);
  });
});

// Set up Gmail API client
const gmail = google.gmail({version: 'v1', auth: oAuth2Client});

// Set up function to check for new emails
const checkEmails = async () => {
  try {
    // Retrieve the latest 10 messages from your inbox
    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults:10,
      q: 'is:unread',
    });

    // Check if each email thread has any prior replies
    const threads = res.data.messages;
    for (const thread of threads) {
      const threadId = thread.threadId;
      const threadRes = await gmail.users.threads.get({userId: 'me', id: threadId});
      const messages = threadRes.data.messages;
      const firstMessage = messages[0];

      // If the email thread has no prior replies, send a reply
      if (firstMessage.labelIds.indexOf('SENT') === -1) {
        const message = 'Thank you for your email! I am currently out of the office and will respond when I return.';
        await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: message,
          },
        });

        // Add a label to the email and move it to the label
        const labelName = 'Vacation';
        const labelRes = await gmail.users.labels.list({userId: 'me'});
        const labels = labelRes.data.labels;
        const labelExists = labels.some(label => label.name === labelName);
        if (!labelExists) {
          await gmail.users.labels.create({
            userId: 'me',
            requestBody: {
              name: labelName,
              labelListVisibility: 'labelShow',
              messageListVisibility: 'show',
            },
          });
        }
        const addLabelRes = await gmail.users.messages.modify({
          userId: 'me',
          id: threadId,
          requestBody: {
            addLabelIds: [labelName],
            removeLabelIds: ['INBOX'],
          },
        });
        console.log(`Added label ${labelName} to email ${threadId}`);
      }
    }
  } catch (err) {
    console.error('Error checking emails', err);
  }
};

// Set up function to repeat the sequence of steps 1-3 in random intervals
const repeatCheckEmails = () => {
    const minInterval = 45000; // 45 seconds
    const maxInterval = 120000; // 120 seconds
    const interval = Math.floor(Math.random() * (maxInterval - minInterval + 1) + minInterval);
    setTimeout(async () => {
        await checkEmails();
        repeatCheckEmails();
    }, interval);
};

