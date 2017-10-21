'use strict';
const TelegramBot = require('node-telegram-bot-api');
const util = require('util');
const imgur = require('imgur');
const fs = require('fs');
const sharp = require('sharp');
const exec = require('child_process').exec;
const config = require('../data/telegram.json');
const request = require('request');

let main;
let username;

imgur.setClientId('41ad90f344bdf2f');

// Init API
const bot = new TelegramBot(config.token[0], {
    polling: {
        interval: 0,
        params: {
            timeout: 60
        }
    }
});


// Clean up Sticker Cache
exec('rm -rf TGtmp_*');

// Get Username
bot.getMe().then((me) => username = me.username);

// message
bot.on('message', (msg) => {
    if (msg.chat.id !== config.ChatID) {
        return;
    }
    // message processes
    const send = (message) => {
        if (msg.reply_to_message) {
            if (msg.reply_to_message.text) {
                if (msg.reply_to_message.from.username === username) {
                    const ReplyUsername = msg.reply_to_message.text.match(/<(\S+)>/i)[1];
                    let ShortMessage;
                    if (msg.reply_to_message.text.replace(/^<\S+>: /i, '').length > 5) {
                        ShortMessage = msg.reply_to_message.text.replace(/^<\S+>: /i, '').substr(0, 5) + '...';
                    } else {
                        ShortMessage = msg.reply_to_message.text.replace(/^<\S+>: /i, '');
                    }
                    main.message('Telegram', msg.from.username, util.format('(%s: %s) %s', ReplyUsername, ShortMessage, message));
                } else {
                    let ShortMessage;
                    if (msg.reply_to_message.text.length > 5) {
                        ShortMessage = msg.reply_to_message.text.replace(/\s/g, ' ').substr(0, 5) + '...';
                    } else {
                        ShortMessage = msg.reply_to_message.text.replace(/\s/g, ' ');
                    }
                    main.message('Telegram', msg.from.username, util.format('(%s: %s) %s', msg.reply_to_message.from.username, ShortMessage, message));
                }
            } else {
                if (msg.reply_to_message.from.username === username) {
                    const ReplyUsername = msg.reply_to_message.text.match(/<\S+>/i)[0].match(/[^<>]+/i)[0];
                    main.message('Telegram', msg.from.username, util.format('(reply %s) %s', ReplyUsername, message));
                } else {
                    main.message('Telegram', msg.from.username, util.format('(reply %s) %s', msg.reply_to_message.from.username, message));
                }
            }
        } else {
            main.message('Telegram', msg.from.username, message);
        }
    };

    if (msg.text) {
        send(msg.text);
    }
    if (msg.photo) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        bot.getFileLink(fileId).then((url) => {
            imgur.uploadUrl(url).then((res) => {
                if (msg.caption) {
                    send(util.format(`${res.data.link} ${msg.caption}`));
                } else {
                    send(res.data.link);
                }
            });
        });
    }
    if (msg.sticker) {
        fs.mkdtemp('./TGtmp_', (err, tmp) => {
            if (err) {
                throw err;
            }
            bot.downloadFile(msg.sticker.file_id, tmp).then((path) => {
                sharp(path).toFile(path + '.png').then(() => imgur.uploadFile(path + '.png').then((res) => {
                    if (msg.sticker.emoji) {
                        send(msg.sticker.emoji + ' ' + res.data.link);
                    } else {
                        send(res.data.link);
                    }
                    fs.unlink(path);
                    fs.unlink(path + '.png', () => fs.rmdir(tmp));
                }));
            });
        });
    }
    if (msg.document) {
        if (msg.document.mime_type.match('image')) {
            bot.getFileLink(msg.document.file_id).then((url) => {
                imgur.uploadUrl(url).then((res) => {
                    if (msg.caption) {
                        send(util.format(`${res.data.link} ${msg.caption}`));
                    } else {
                        send(res.data.link);
                    }
                });
            });
        }
    }
});

function* senderTokenMaker() {
    var index = 0;
    while(true){
        yield config.token[index];
        index++;
        if(index>=config.token.length) index = 0;
    }
}

var senderToken = senderTokenMaker();

module.exports = (Hub) => {
    main = Hub;
    main.on('message', (from, sender, message) => {
        setImmediate(() => {
            if (from !== 'Telegram') {
                var x = senderToken.next().value;
                console.log('https://api.telegram.org/bot'+x+'/sendMessage')
                request.post('https://api.telegram.org/bot'+x+'/sendMessage', {form:{
                    chat_id: config.ChatID,
                    text: util.format('<%s>: %s', sender, message)
                }})
                //bot.sendMessage(config.ChatID, util.format('OwO <%s>: %s', sender, message));
            }
        });
    });
};