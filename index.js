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

let searchMap = {};

let searchKeys = new Set(Object.keys(searchMap));

client.once(Events.ClientReady, async readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
	const guild = client.guilds.cache.first(); // Get the first guild (server)
	try {
		await guild.members.fetch();
	} catch (error) {
		console.error('Error fetching members:', error);
	}
	watchForUpdates();
});

client.on('messageCreate', (message) => {
  if (message.content.startsWith('!add ')) {
    const addKey = message.content.slice(5).toLowerCase(); 
    searchMap[addKey] = message.author.username;
    searchKeys = new Set(Object.keys(searchMap));
    saveMapToFile(); 
    sendKeysToUser(message);
  } else if (message.content.startsWith('!delete ')) {
    const delKey = message.content.slice(8).toLowerCase();
    delete searchMap[delKey];
    searchKeys = new Set(Object.keys(searchMap));
    saveMapToFile();
    sendKeysToUser(message);
  } else if (message.content.startsWith('!del ')) {
    const delKey = message.content.slice(5).toLowerCase();
    delete searchMap[delKey];
    searchKeys = new Set(Object.keys(searchMap));
    saveMapToFile();
    sendKeysToUser(message);
  } else if (message.content === '!list') {
    sendKeysToUser(message);
  } else if (message.content === '!help') {
    sendHelpToUser(message);
  }
});



function sendHelpToUser(message) {
	const txt = "QRM Bot will send directly to you all matching 'For Sale' messages. " 
	+ "Available commands: !help, !list, !add <keyword>, !del <keyword>. Example: !add icom";
	message.author.send(txt).catch((error) => {
        console.error(`Error sending DM: ${error}`);
        message.channel.send("Oops! There was an error sending the DM. Please check your privacy settings.");
      }); 
}

function sendKeysToUser(message) {
	const userKeys = Object.keys(searchMap);
	message.author.send(`Your keys: ${userKeys.join(', ')}`).catch((error) => {
        console.error(`Error sending DM: ${error}`);
        message.channel.send("Oops! There was an error sending the DM. Please check your privacy settings.");
      }); 
}

function saveMapToFile() {
	const data = JSON.stringify(searchMap, null, 2); // Pretty-print the JSON
	console.log('About to save map: ', data);
	fs.writeFileSync('/home/pi/discord/users.json', data, 'utf8');
}


function watchForUpdates(){
	try {
		const rawData = fs.readFileSync('/home/pi/discord/users.json', 'utf8');
		searchMap = JSON.parse(rawData);
		console.log('Loaded map: ', searchMap);
		searchKeys = new Set(Object.keys(searchMap));
	} catch (error) {
		console.error(`Error loading searchMap from file: ${error}`);
	};
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

// Function to send matching keyword message to a user
async function sendKeywordNotification(text) {
	console.log('Before Cleaning:', text);
	if (text && (!text.startsWith("http") || !text.startsWith("mailto"))) {
		console.log('Inside Cleaning:', text);
		const matchH = text.match(/^(.*?)(http|$)/);
		const noHttpText = matchH ? matchH[1] : text;

		const matchM = noHttpText.match(/^(.*?)(mailto|$)/);
		const noMailText = matchM ? matchM[1] : noHttpText;

		//const words = noMailText.split(/[^A-Za-z]+/).filter(wrd => wrd.length > 2);
		const words = noMailText.split(" ").filter(wrd => wrd.length > 2);
		console.log('SearchKeys', searchKeys);
		for (const word of words) {
			lowerCaseWord = word.toLowerCase();
			console.log(`Searching-->${lowerCaseWord}<--`)
			if (searchKeys.has(lowerCaseWord)) {
				console.log(`Found key "${lowerCaseWord}": ${searchMap[lowerCaseWord]} \n"${text}"`);
				let user = guild.members.cache.find(member => member.user.username === searchMap[lowerCaseWord]);
				if (user) {
					user.send(`Found key "${lowerCaseWord}":\n"${text}"`);
				} else {
					console.log(`User ${username} not found in this guild.`);
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
