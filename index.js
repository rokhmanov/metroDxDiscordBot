//
// QRM Bot for Metro DX Discord
//
const { Client, Events, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const ts = require('tail-stream');
const { token } = require('./config.json');
const targetChannelName = 'hamfest';
const filePath = '/etc/thelounge/logs/andy/geekshed-c280-4801-9d0c-293da958783a/';
const fileName = '#hamfest.log';
const fullPath = filePath + fileName;
const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  'partials': [Partials.Channel]
});

let searchMap = new Map();
let searchKeys = new Set();
let botId;

client.once(Events.ClientReady, async readyClient => {
    botId = readyClient.user.id;
    console.log(`Ready! Logged in as ${readyClient.user.tag} (ID: ${botId})`);
    const guild = client.guilds.cache.first(); // Get the first guild (server)
    try {
        await guild.members.fetch();
    } catch (error) {
        console.error('Error fetching members:', error);
    }
    watchForUpdates();
});


client.on('messageCreate', (message) => {
    const command = message.content.split(' ')[0];
    switch (command) {
        case '!add':
            const addKey = message.content.slice(5).toLowerCase(); 
            const username = message.author.username;
            addSearchParam(addKey, username);
            saveMapToFile(searchMap); 
            sendKeysToUser(message);
            break;
        case '!del':
            const delKey = message.content.slice(5).toLowerCase();
            const delusername = message.author.username;
            delSearchParam(delKey, delusername);
            saveMapToFile(searchMap); 
            sendKeysToUser(message);
            break;
        case '!list':
            sendKeysToUser(message);
            break;
        case '!help':
            sendHelpToUser(message);
            break;
        default:
            break;
    }
});


function sendHelpToUser(message) {
    const txt = "QRM Bot will send directly to you all matching 'For Sale' messages. Available commands: !help, !list, !add <keyword>, !del <keyword>. Example: !add rigexpert.";
    console.log(`Trying to send DM to: ${message.author.username} (ID: ${message.author.id})`);
    if (message.author.id === botId) {
        console.error("Cannot send DM to the bot itself.");
        return;
    }
    message.author.send(txt).catch((error) => {
        if (error.code === 50007) {
            console.error(`Error sending DM to ${message.author.username}: Cannot send messages to this user. User ID: ${message.author.id}`);
        } else {
            console.error(`Error sending DM to ${message.author.username}: ${error}. User ID: ${message.author.id}`);
        }
    });
}


function sendKeysToUser(message) {
    const username = message.author.username;
    const userKeys = searchByUser(username);
    const keyString = userKeys.join(', ');
    //console.log(`Trying to send DM to: ${username} (ID: ${message.author.id})`);
    if (message.author.id === botId) {
        //console.error("Cannot send DM to the bot itself.");
        return;
    }
    message.author.send(`Your keys: ${keyString}`).catch((error) => {
        if (error.code === 50007) {
            console.error(`Error sending DM to ${username}: Cannot send messages to this user. User ID: ${message.author.id}`);
        } else {
            console.error(`Error sending DM to ${username}: ${error}. User ID: ${message.author.id}`);
        }
    });
}


function searchByUser(user) {
    const matchingKeys = [];
    for (let [key, values] of searchMap) {
        if (values.includes(user)) {
            matchingKeys.push(key);
        }
    }
    return matchingKeys;
}

function addSearchParam(keystr, user) {
    console.log('add keystr:' + keystr + ' for user:' + user);
    if (!/^[a-zA-Z0-9]+$/.test(keystr)) {
        return;
    }
    if (searchMap.has(keystr)){
        let users = searchMap.get(keystr);
        if (!users.includes(user)) {
            users.push(user);
        }
    } else {
        searchMap.set(keystr,[user]);
	searchKeys = new Set(searchMap.keys());
    }
}


function delSearchParam(keystr, user) {
    console.log('del keystr:' + keystr + ' for user:' + user);
    if (!/^[a-zA-Z0-9]+$/.test(keystr)) {
        return;
    }
    // Check if the key exists in the map
    if (searchMap.has(keystr)) {
        // Get the current array of values for the key
        let values = searchMap.get(keystr);
	//console.log('values:' + values);
        // Find the index of the value to be removed
        const index = values.indexOf(user);        
        // If the value is found, remove it
        if (index > -1) {
            values.splice(index, 1);
        }        
        // If the array is empty after removal, delete the key from the map
        if (values.length === 0) {
            searchMap.delete(keystr);
        } else {
            // Otherwise, update the map with the modified array
            searchMap.set(keystr, values);
        }
	searchKeys = new Set(searchMap.keys());
    }
}


function saveMapToFile(myMap) {
    const obj = Object.fromEntries(myMap);
    const data = JSON.stringify(obj, null, 2);
    fs.writeFileSync('/home/pi/discord/users.json', data, 'utf8');
}


function loadMapFromFile() {
    let myMap = new Map();
    const jsonData = fs.readFileSync('/home/pi/discord/users.json', 'utf8');
    const dataObject = JSON.parse(jsonData);
    for (const key in dataObject) {
        if (dataObject.hasOwnProperty(key)) {
            myMap.set(key, dataObject[key]);
        }
    }
    searchKeys = new Set(myMap.keys());
    console.log('Loaded map: ', myMap);
    return myMap;
}


function watchForUpdates(){
	searchMap = loadMapFromFile();
	fs.stat(fullPath, function(err, stats) {
		if (err) {
			console.log('An error occurred: ', err);
			return;
		}
		console.log('File size:' + stats.size);
		const tstream = ts.createReadStream(fullPath, {
			beginAt: stats.size,
			onMove: 'stay',
			detectTruncate: true,
			onTruncate: 'reset',
			endOnError: false,
		});
	
		tstream.on('data', function(data) {
			// console.log('New line: ' + data);
			let strData = data.toString('utf-8');
			if (!strData.includes('***')){
				strData = strData.substring(strData.indexOf('<@qrm>') + 6);
				strData = strData.replace(/\x02/g, '');
				//console.log('Filtered: ' + strData);
				sendUpdateMessage(strData);
				sendKeywordNotification(strData);
			}
		});
	
		tstream.on('end', function() {
			console.log('End of file reached');
		});

		tstream.on('error', function(err) {
			console.log('An error occurred: ', err);
		});
	});	
}

async function sendKeywordNotification(text) {
    if (text && (!text.startsWith("http") || !text.startsWith("mailto"))) {
        const matchH = text.match(/^(.*?)(http|$)/);
        const noHttpText = matchH ? matchH[1] : text;
        const matchM = noHttpText.match(/^(.*?)(mailto|$)/);
        const noMailText = matchM ? matchM[1] : noHttpText;
        const words = noMailText.split(" ").filter(wrd => wrd.length > 2);
        for (const word of words) {
            lowerCaseWord = word.toLowerCase();
            if (searchKeys.has(lowerCaseWord)) {
                const matchingUsers = searchMap.get(lowerCaseWord) || [];
                for (const username of matchingUsers) {
                    let user = guild.members.cache.find(member => member.user.username === username);
                    if (user && !user.bot) { // Check if user is not the bot
                        console.log(`Trying to send "${lowerCaseWord}" DM to: ${username} (ID: ${user.id})`);
                        user.send(`Found key "${lowerCaseWord}":\n"${text}"`).catch((error) => {
                            console.error(`Error sending "${lowerCaseWord}" DM to ${username}: ${error}`);
                        });
                    }
                }
            }
        }
    } else {
        console.log('Invalid string:' + text);
    }
}


async function sendUpdateMessage(text) {
	guild = client.guilds.cache.first(); // Get the first guild (server)
	const channel = getChannelByName(guild, targetChannelName);
	if (!channel) {
		console.error(`Channel "${targetChannelName}" not found.`);
		return;
	}
	await channel.send(text);
}

function getChannelByName(guild, channelName) {
	return guild.channels.cache.find((channel) => channel.name === channelName);
}

client.login(token);
