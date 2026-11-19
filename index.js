const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const PHONE_NUMBER = '201119815662';

const client = new Client({
    authStrategy: new LocalAuth(),
    pairWithPhoneNumber: {
        phoneNumber: PHONE_NUMBER,
        showNotification: true
    },
    puppeteer: {
        headless: true,
        protocolTimeout: 120000,
        timeout: 0,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote'
        ]
    }
});

client.on('code', (code) => {
    console.log('PAIRING CODE:', code);
});

client.on('ready', () => {
    console.log('Bot is ready!');
});

let isBotClosed = false;
let privateMode = false;
let antiGroupLink = true;
const allowedUsers = new Set();
const mutedUsers = new Set();

const badWords = [
    'كسمك',
    'يبن الاحبه',
    'يبن مرا متناكه',
    'يبن شرموطه',
    'يبن عرص'
];

function normalizeToSerialized(input) {
    if (!input) return null;
    if (input.endsWith('@c.us') || input.endsWith('@g.us')) return input;
    const digits = String(input).replace(/\D/g, '');
    if (!digits) return null;
    return `${digits}@c.us`;
}

async function isBotGroupAdmin(chat) {
    if (!chat.isGroup) return false;
    const botId = client.info.wid._serialized;
    const botParticipant = (chat.participants || []).find((p) => p.id._serialized === botId);
    return Boolean(botParticipant && (botParticipant.isAdmin || botParticipant.isSuperAdmin));
}

async function getTargetUserId(msg, argsText = '') {
    if (msg.mentionedIds && msg.mentionedIds.length > 0) {
        return msg.mentionedIds[0];
    }
    if (msg.hasQuotedMsg) {
        const quoted = await msg.getQuotedMessage();
        return quoted.author || quoted.from;
    }
    const clean = argsText.replace(/@/g, '').trim();
    return normalizeToSerialized(clean);
}

async function handleCommand(msg) {
    const text = (msg.body || '').trim();
    const chat = await msg.getChat();
    const senderId = msg.author || msg.from;
    const isAuthorized = msg.fromMe || allowedUsers.has(senderId);

    if (chat.isGroup && !msg.fromMe && mutedUsers.has(senderId)) {
        const canDelete = await isBotGroupAdmin(chat);
        if (canDelete) {
            try {
                await msg.delete(true);
            } catch (_) {}
        }
        return;
    }

    if (
        chat.isGroup &&
        antiGroupLink &&
        !msg.fromMe &&
        /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/i.test(text)
    ) {
        const canDelete = await isBotGroupAdmin(chat);
        if (canDelete) {
            try {
                await msg.delete(true);
                await chat.sendMessage('ممنوع نشر لينكات جروبات هنا.');
            } catch (_) {}
        }
        return;
    }

    if (msg.fromMe && text === '.قفل') {
        isBotClosed = true;
        await msg.reply('تم قفل البوت.');
        return;
    }

    if (msg.fromMe && text === '.فتح') {
        isBotClosed = false;
        await msg.reply('تم فتح البوت.');
        return;
    }

    if (msg.fromMe && text === '.اسكت1') {
        antiGroupLink = false;
        await msg.reply('تم إيقاف حذف لينكات الجروبات تلقائياً.');
        return;
    }

    if (msg.fromMe && text.startsWith('.استخدام')) {
        const arg = text.replace('.استخدام', '').trim();
        const targetId = await getTargetUserId(msg, arg);
        if (!targetId) {
            await msg.reply('اكتب: .استخدام 201xxxxxxxxx أو اعمل منشن/رد على الشخص.');
            return;
        }
        allowedUsers.add(targetId);
        await msg.reply(`تم السماح لـ ${targetId.replace('@c.us', '')} باستخدام البوت.`);
        return;
    }

    if (msg.fromMe && text.startsWith('.عدم استخدام')) {
        const arg = text.replace('.عدم استخدام', '').trim();
        const targetId = await getTargetUserId(msg, arg);
        if (!targetId) {
            await msg.reply('اكتب: .عدم استخدام 201xxxxxxxxx أو اعمل منشن/رد على الشخص.');
            return;
        }
        allowedUsers.delete(targetId);
        await msg.reply(`تم إلغاء صلاحية استخدام البوت عن ${targetId.replace('@c.us', '')}.`);
        return;
    }

    if (isBotClosed) return;

    if (msg.fromMe && text === '.خاص') {
        privateMode = true;
        await msg.reply('تم تفعيل الوضع الخاص (لأوامرك فقط).');
        return;
    }

    if (msg.fromMe && text === '.جماعي') {
        privateMode = false;
        await msg.reply('تم تفعيل الوضع الجماعي (الكل يقدر يستخدم البوت).');
        return;
    }

    if (privateMode && !isAuthorized) {
        return;
    }

    if (!msg.fromMe && badWords.some((word) => text.includes(word))) {
        await msg.reply('كسمك');
        return;
    }

    if (text === 'اوامر' || text === '.اوامر') {
        await msg.reply(
            'قائمة الأوامر:\n' +
            '1- اوامر\n' +
            '2- نكتة\n' +
            '3- حظي\n' +
            '4- ملك او كتابة\n' +
            '5- .محكمة (لعبة المحكمة داخل الجروب)\n' +
            '6- .استرداد (منشن أو رد لسحب صورة البروفايل)\n' +
            '7- .رفع (منشن أو رد لرفع مشرف في الجروب)\n' +
            '8- .طرد (منشن شخص داخل الجروب)\n' +
            '9- .كتم / .فك_الكتم (منشن أو رد داخل الجروب)\n' +
            '10- .جوزني (داخل الجروب)\n' +
            '11- .استخدام / .عدم استخدام + رقم/منشن (للمالك)\n' +
            '12- .اسكت1 / .قفل / .فتح / .خاص / .جماعي (للمالك)'
        );
    } else if (text === 'نكتة') {
        const jokes = [
            'مرة واحد كسلان راح الامتحان، سلم الورقة فاضية وكتب: الوقت لا يكفي.',
            'مرة مهندس اشترى عربية، كل ما تقف ينزل يخبط الكبوت ويقول: شغال اهو.',
            'مرة طالب بيقول للمدرس: يا أستاذ هو الواحد ممكن يتعاقب على حاجة معملهاش؟ قاله: لأ طبعاً. قاله: طب أنا معملتش الواجب.'
        ];
        await msg.reply(jokes[Math.floor(Math.random() * jokes.length)]);
    } else if (text === 'حظي') {
        const luck = [
            'حظك النهاردة حلو جداً، خبر كويس في الطريق.',
            'حظك متوسط، خد الأمور بهدوء وبلاش تسرع.',
            'حظك محتاج صبر شوية النهاردة، وبكرة أحلى.'
        ];
        await msg.reply(luck[Math.floor(Math.random() * luck.length)]);
    } else if (text === 'ملك او كتابة') {
        const coin = Math.random() < 0.5 ? 'ملك' : 'كتابة';
        await msg.reply('النتيجة: ' + coin);
    } else if (text === '.محكمة') {
        if (!chat.isGroup) {
            await msg.reply('لعبة المحكمة بتشتغل جوه الجروبات بس.');
            return;
        }
        const participants = chat.participants || [];
        if (participants.length === 0) return;

        const accused = participants[Math.floor(Math.random() * participants.length)];
        const contact = await client.getContactById(accused.id._serialized);
        const tag = '@' + accused.id.user;

        const charges = [
            'اختفاء البطارية وقت الجد',
            'تأخير الرد على الرسايل 3 أيام',
            'نشر نكت بايخة في الجروب',
            'أكل آخر حتة في الصينية بدون استئذان'
        ];
        const verdicts = [
            'حكمت المحكمة حضورياً بالبراءة لعدم كفاية الأدلة.',
            'حكمت المحكمة بغرامة 50 جنيه تدفع في أقرب قعدة.',
            'حكمت المحكمة بالأشغال الشاقة: يكتب نكتة حلوة دلوقتي.',
            'حكمت المحكمة بالحبس الاحتياطي في الجروب لمدة 10 دقايق.'
        ];

        const charge = charges[Math.floor(Math.random() * charges.length)];
        const verdict = verdicts[Math.floor(Math.random() * verdicts.length)];

        await chat.sendMessage(
            `⚖️ *جلسة محكمة الجروب*\n` +
            `المتهم: ${tag}\n` +
            `التهمة: ${charge}\n` +
            `الحكم: ${verdict}`,
            { mentions: [contact] }
        );
    } else if (text.startsWith('.استرداد')) {
        const arg = text.replace('.استرداد', '').trim();
        const targetId = await getTargetUserId(msg, arg);
        if (!targetId) {
            await msg.reply('اعمل منشن أو رد على رسالة الشخص واكتب .استرداد');
            return;
        }
        try {
            const picUrl = await client.getProfilePicUrl(targetId);
            if (!picUrl) {
                await msg.reply('الشخص ده قافل صورة البروفايل أو مش حاطط صورة.');
                return;
            }
            const media = await MessageMedia.fromUrl(picUrl);
            await msg.reply(media, undefined, { caption: 'صورة البروفايل:' });
        } catch (_) {
            await msg.reply('مقدرتش أجيب صورة البروفايل.');
        }
    } else if (text.startsWith('.رفع')) {
        if (!isAuthorized) {
            await msg.reply('الأمر ده للمالك أو الأشخاص المسموح لهم بس.');
            return;
        }
        if (!chat.isGroup) {
            await msg.reply('الأمر ده بيشتغل جوه الجروبات بس.');
            return;
        }
        const canPromote = await isBotGroupAdmin(chat);
        if (!canPromote) {
            await msg.reply('لازم ترفعني مشرف في الجروب الأول عشان أقدر أرفع غيري.');
            return;
        }
        const arg = text.replace('.رفع', '').trim();
        const targetId = await getTargetUserId(msg, arg);
        if (!targetId) {
            await msg.reply('منشن الشخص أو رد على رسالته واكتب .رفع');
            return;
        }
        try {
            await chat.promoteParticipants([targetId]);
            const contact = await client.getContactById(targetId);
            await chat.sendMessage(`تم رفع @${contact.id.user} مشرفاً بنجاح.`, {
                mentions: [contact]
            });
        } catch (_) {
            await msg.reply('مقدرتش أرفعه مشرف.');
        }
    } else if (text.startsWith('.كتم') && !text.startsWith('.فك_الكتم')) {
        if (!isAuthorized) {
            await msg.reply('الأمر ده للمالك أو الأشخاص المسموح لهم بس.');
            return;
        }
        if (!chat.isGroup) {
            await msg.reply('الأمر ده بيشتغل جوه الجروبات بس.');
            return;
        }
        const canMute = await isBotGroupAdmin(chat);
        if (!canMute) {
            await msg.reply('لازم ترفعني مشرف في الجروب الأول عشان أقدر أمسح رسايل الشخص المكتوم.');
            return;
        }
        const arg = text.replace('.كتم', '').trim();
        const targetId = await getTargetUserId(msg, arg);
        if (!targetId) {
            await msg.reply('منشن الشخص أو رد على رسالته واكتب .كتم');
            return;
        }
        mutedUsers.add(targetId);
        const contact = await client.getContactById(targetId);
        await chat.sendMessage(`تم كتم @${contact.id.user}.`, {
            mentions: [contact]
        });
    } else if (text.startsWith('.فك_الكتم')) {
        if (!isAuthorized) {
            await msg.reply('الأمر ده للمالك أو الأشخاص المسموح لهم بس.');
            return;
        }
        const arg = text.replace('.فك_الكتم', '').trim();
        const targetId = await getTargetUserId(msg, arg);
        if (!targetId) {
            await msg.reply('منشن الشخص أو رد على رسالته واكتب .فك_الكتم');
            return;
        }
        mutedUsers.delete(targetId);
        await msg.reply(`تم فك الكتم عن ${targetId.replace('@c.us', '')}.`);
    } else if (text === '.جوزني') {
        if (!chat.isGroup) {
            await msg.reply('الأمر ده بيشتغل جوه الجروبات بس.');
            return;
        }
        const candidates = (chat.participants || []).filter((p) => p.id._serialized !== senderId);
        if (candidates.length === 0) {
            await msg.reply('مفيش حد تاني في الجروب أختاره.');
            return;
        }
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        const contact = await client.getContactById(chosen.id._serialized);
        await chat.sendMessage(`مبروك معرصين @${chosen.id.user}`, {
            mentions: [contact]
        });
    } else if (text.startsWith('.طرد')) {
        if (!isAuthorized) {
            await msg.reply('الأمر ده للمالك أو الأشخاص المسموح لهم بس.');
            return;
        }
        if (!chat.isGroup) {
            await msg.reply('الأمر ده بيشتغل جوه الجروبات بس.');
            return;
        }
        const canKick = await isBotGroupAdmin(chat);
        if (!canKick) {
            await msg.reply('لازم ترفعني مشرف (أدمن) في الجروب الأول عشان أقدر أطرد.');
            return;
        }
        const targets = msg.mentionedIds || [];
        if (targets.length === 0) {
            await msg.reply('منشن الشخص اللي عايز تطرده مع كلمة .طرد');
            return;
        }
        try {
            await chat.removeParticipants(targets);
            await msg.reply('تم الطرد بنجاح.');
        } catch (_) {
            await msg.reply('مقدرتش أطرده (ممكن يكون مشرف أو في مشكلة في الصلاحيات).');
        }
    }
}

client.on('message', async (msg) => {
    await handleCommand(msg);
});

client.on('message_create', async (msg) => {
    if (msg.fromMe) {
        await handleCommand(msg);
    }
});

client.initialize();
            
