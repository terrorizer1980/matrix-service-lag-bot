import { IService } from "../IService";
import config from "../config";
import { LogService } from "matrix-bot-sdk";

import { Api as TelegramAPI, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

export class TelegramService implements IService {

    private session: StringSession;
    private bot: any;
    private waiting: { [msgid: string]: () => void } = {};

    constructor() {
        this.session = new StringSession(config.telegram.session || '');
        this.bot = new TelegramClient(
            this.session,
            config.telegram.apiId,
            config.telegram.apiHash,
            { },
        );
        this.bot.start({ botAuthToken: config.telegram.botToken }).then(() => {
            this.bot.addEventHandler(this.onUpdate.bind(this));
            LogService.info("TelegramService", `Bot started! Session: ${this.session.save()}`);
        });

    }

    public get name(): string {
        return "telegram";
    }

    private onUpdate(update: TelegramAPI.TypeUpdate) {
        if (update.className !== 'UpdateNewMessage') {
            LogService.debug("TelegramService", `Ignoring Telegram update of type ${update.className}`);
            return;
        }

        const message = update.message;
        if (message.peerId.className === 'PeerChat') {
            const sentTo = message.peerId.chatId.valueOf()
            if (sentTo !== config.telegram.channelId) {
                LogService.debug("TelegramService", `Ignoring Telegram message sent to a non-tracked channel ${sentTo}`);
                return;
            }
        } else {
            LogService.debug("TelegramService", `Ignoring Telegram message of type ${message.peerId.className}`);
            return;
        }

        if (message instanceof TelegramAPI.MessageEmpty) {
            return;
        }

        const body = message.message;
        if (this.waiting[body]) {
            this.waiting[body](); // resolve
            delete this.waiting[body];
        }
    }

    public async sendMessage(targetReference: any, content: string) {
        return this.bot.invoke(new TelegramAPI.messages.SendMessage({
            peer: new TelegramAPI.InputPeerChat({
                chatId: config.telegram.channelId.toString(),
            }),
            message: content,
        }));
    }

    public waitForMessage(targetReference: any, content: string): Promise<void> {
        return new Promise((resolve, _) => {
            this.waiting[content] = resolve;
        });
    }

}
